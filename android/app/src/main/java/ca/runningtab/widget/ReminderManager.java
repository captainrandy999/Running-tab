package ca.runningtab.widget;

import android.Manifest;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.CalendarContract;
import android.widget.Toast;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Iterator;
import java.util.ArrayList;
import org.json.JSONArray;
import org.json.JSONObject;

/** Schedules To-Do alarms on the phone, independently of the Running Tab WebView.
 *  Calendar events are only opened as editable drafts; the user saves them.
 */
public final class ReminderManager {
    private static final String PREFS = "running_tab_reminders";
    private static final String KEY = "todo_json";
    private static final String KEY_SNOOZES = "snoozes_json";
    private static final String CHANNEL = "running_tab_due_alerts";
    static final String ACTION_ALERT = "ca.runningtab.widget.REMIND_TODO";
    static final String ACTION_SNOOZE = "ca.runningtab.widget.SNOOZE_TODO";
    static final String ACTION_SNOOZE_ALERT = "ca.runningtab.widget.REMIND_SNOOZED_TODO";
    private static final long HOUR_MS = 60L * 60 * 1000;
    private ReminderManager() {}

    static boolean canNotify(Context context) {
        NotificationManager manager = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null || !manager.areNotificationsEnabled()) return false;
        return Build.VERSION.SDK_INT < 33
            || context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
    }

    static void sync(Context context, String json) {
        if (json == null || json.length() > 2000000) return;
        String old = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        if (json.equals(old)) return;
        cancelAll(context, old);
        context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, json).apply();
        reconcileSnoozes(context, json);
        restore(context);
    }

    static void restore(Context context) {
        if (!canNotify(context)) return;
        String value = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        reconcileSnoozes(context, value);
        JSONObject snoozes = readSnoozes(context);
        try {
            JSONArray items = new JSONArray(value);
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (!eligible(item)) continue;
                // A snooze replaces the already-delivered due alert until it fires.
                if (!snoozes.has(item.optString("id"))) schedule(context, item);
            }
            Iterator<String> ids = snoozes.keys();
            while (ids.hasNext()) {
                String id = ids.next();
                JSONObject record = snoozes.optJSONObject(id);
                if (record == null) continue;
                long at = record.optLong("at", -1);
                // After a restart, deliver recent overdue snoozes as soon as possible.
                scheduleAt(context, Math.max(at, System.currentTimeMillis() + 1000),
                    snoozedPending(context, id, PendingIntent.FLAG_UPDATE_CURRENT));
            }
        } catch (Exception ignored) {
            // Invalid/corrupt snapshots never interrupt the other app features.
        }
    }

    private static void cancelAll(Context context, String value) {
        try {
            JSONArray items = new JSONArray(value);
            AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
            if (alarms == null) return;
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (item == null) continue;
                String id = item.optString("id", "");
                if (id.isEmpty()) continue;
                PendingIntent pending = pending(context, id, PendingIntent.FLAG_NO_CREATE);
                if (pending != null) {
                    alarms.cancel(pending);
                    pending.cancel();
                }
            }
        } catch (Exception ignored) {}
    }

    private static JSONObject readSnoozes(Context context) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY_SNOOZES, "{}");
        try { return new JSONObject(raw); }
        catch (Exception ignored) { return new JSONObject(); }
    }

    private static boolean writeSnoozes(Context context, JSONObject snoozes) {
        // Commit before scheduling so a killed receiver cannot lose the snooze.
        return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .edit().putString(KEY_SNOOZES, snoozes.toString()).commit();
    }

    private static JSONObject eligibleTask(JSONArray items, String id) {
        if (id == null || id.isEmpty()) return null;
        for (int i = 0; i < items.length(); i++) {
            JSONObject task = items.optJSONObject(i);
            if (eligible(task) && id.equals(task.optString("id"))) return task;
        }
        return null;
    }

    private static JSONObject eligibleTask(Context context, String id) {
        String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            .getString(KEY, "[]");
        try { return eligibleTask(new JSONArray(raw), id); }
        catch (Exception ignored) { return null; }
    }

    private static void clearSnooze(Context context, String id) {
        JSONObject all = readSnoozes(context);
        if (all.has(id)) {
            all.remove(id);
            writeSnoozes(context, all);
        }
        cancelSnoozedAlarm(context, id);
    }

    private static void reconcileSnoozes(Context context, String tasksRaw) {
        JSONArray tasks;
        try { tasks = new JSONArray(tasksRaw); }
        catch (Exception ignored) { return; }
        JSONObject all = readSnoozes(context);
        ArrayList<String> invalid = new ArrayList<>();
        long now = System.currentTimeMillis();
        Iterator<String> ids = all.keys();
        while (ids.hasNext()) {
            String id = ids.next();
            JSONObject saved = all.optJSONObject(id);
            JSONObject task = eligibleTask(tasks, id);
            if (saved == null || task == null
                    || saved.optLong("source", -1) != scheduledTime(task)
                    || saved.optLong("at", -1) <= 0
                    || saved.optLong("at", -1) < now - 24 * HOUR_MS) {
                invalid.add(id);
            }
        }
        if (invalid.isEmpty()) return;
        NotificationManager manager = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        for (String id : invalid) {
            cancelSnoozedAlarm(context, id);
            if (manager != null) manager.cancel(id.hashCode());
            all.remove(id);
        }
        writeSnoozes(context, all);
    }

    private static boolean eligible(JSONObject item) {
        return item != null && !item.optBoolean("done", false)
            && item.optBoolean("notify", false)
            && "day".equals(item.optString("dueType"))
            && !item.optString("id").isEmpty()
            && !item.optString("title").isEmpty();
    }

    private static long scheduledTime(JSONObject item) {
        try {
            String date = item.getString("due");
            String time = item.optString("remindTime", "09:00");
            return LocalDateTime.parse(date + "T" + time)
                .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
        } catch (Exception ignored) { return -1; }
    }

    private static PendingIntent pending(Context context, String id, int flags) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        intent.setAction(ACTION_ALERT);
        intent.setData(Uri.parse("runningtab://todo/" + Uri.encode(id)));
        return PendingIntent.getBroadcast(context, 0, intent,
            flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent snoozedPending(Context context, String id, int flags) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        intent.setAction(ACTION_SNOOZE_ALERT);
        intent.setData(Uri.parse("runningtab://snoozed/" + Uri.encode(id)));
        return PendingIntent.getBroadcast(context, 0, intent,
            flags | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent snoozeActionPending(Context context, String id, int minutes, long source) {
        Intent intent = new Intent(context, ReminderReceiver.class);
        intent.setAction(ACTION_SNOOZE);
        intent.setData(Uri.parse("runningtab://snooze/" + Uri.encode(id) + "/" + minutes + "/" + source));
        return PendingIntent.getBroadcast(context, 0, intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static void cancelSnoozedAlarm(Context context, String id) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        PendingIntent existing = snoozedPending(context, id, PendingIntent.FLAG_NO_CREATE);
        if (existing == null) return;
        if (alarms != null) alarms.cancel(existing);
        existing.cancel();
    }

    private static void scheduleAt(Context context, long at, PendingIntent intent) {
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        try {
            // Exact alarms are restricted on newer Android versions.
            if (Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms())
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
            else
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        } catch (SecurityException e) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        }
    }

    private static void schedule(Context context, JSONObject item) {
        long at = scheduledTime(item);
        if (at <= System.currentTimeMillis()) return;
        scheduleAt(context, at,
            pending(context, item.optString("id"), PendingIntent.FLAG_UPDATE_CURRENT));
    }

    static void snooze(Context context, String id, int minutes, long source) {
        if (id == null || !(minutes == 15 || minutes == 60 || minutes == 240)) return;
        JSONObject task = eligibleTask(context, id);
        NotificationManager manager = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (task == null || scheduledTime(task) != source) {
            // A stale notification cannot snooze a completed or rescheduled To-Do.
            if (manager != null) manager.cancel(id.hashCode());
            clearSnooze(context, id);
            return;
        }
        long at = System.currentTimeMillis() + minutes * 60_000L;
        JSONObject snoozes = readSnoozes(context);
        JSONObject record = new JSONObject();
        try {
            record.put("at", at);
            record.put("source", source);
            snoozes.put(id, record);
        } catch (Exception ignored) { return; }
        if (!writeSnoozes(context, snoozes)) return;
        // Replace any earlier snooze; a task has at most one queued repeat alert.
        cancelSnoozedAlarm(context, id);
        scheduleAt(context, at,
            snoozedPending(context, id, PendingIntent.FLAG_UPDATE_CURRENT));
        if (manager != null) manager.cancel(id.hashCode());
    }

    static void deliverSnoozed(Context context, String id) {
        if (!canNotify(context) || id == null) return;
        JSONObject record = readSnoozes(context).optJSONObject(id);
        JSONObject task = eligibleTask(context, id);
        if (record == null) return;
        long at = record.optLong("at", -1);
        long now = System.currentTimeMillis();
        if (task == null || record.optLong("source", -1) != scheduledTime(task)
                || at <= 0 || at < now - 24 * HOUR_MS) {
            clearSnooze(context, id);
            return;
        }
        if (at > now + 60_000) return;
        clearSnooze(context, id);
        postNotification(context, task);
    }

    static void deliver(Context context, String id) {
        if (!canNotify(context) || id == null) return;
        JSONObject task = eligibleTask(context, id);
        if (task == null) return;
        JSONObject saved = readSnoozes(context).optJSONObject(id);
        if (saved != null && saved.optLong("source", -1) == scheduledTime(task)) {
            // An active snooze supersedes the original due alarm.
            return;
        }
        long due = scheduledTime(task);
        long now = System.currentTimeMillis();
        if (due < 0 || due > now + 60000 || due < now - 24 * HOUR_MS) return;
        postNotification(context, task);
    }

    private static void postNotification(Context context, JSONObject task) {
        createChannel(context);
        String id = task.optString("id", "");
        if (id.isEmpty()) return;
        String title = task.optString("title", "To-Do reminder");
        if (title.length() > 200) title = title.substring(0, 200);
        long source = scheduledTime(task);
        Intent open = new Intent(context, MainActivity.class);
        open.putExtra(MainActivity.EXTRA_SECTION, "todo");
        open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent tap = PendingIntent.getActivity(context, 1, open,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        Notification notification = new Notification.Builder(context, CHANNEL)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle(title)
            .setContentText("Remind me again in:")
            .setContentIntent(tap)
            .setCategory(Notification.CATEGORY_REMINDER)
            .setAutoCancel(true)
            .addAction(android.R.drawable.ic_popup_reminder, "15 min",
                snoozeActionPending(context, id, 15, source))
            .addAction(android.R.drawable.ic_popup_reminder, "1 hour",
                snoozeActionPending(context, id, 60, source))
            .addAction(android.R.drawable.ic_popup_reminder, "4 hours",
                snoozeActionPending(context, id, 240, source))
            .build();
        NotificationManager manager = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager != null) manager.notify(id.hashCode(), notification);
    }

    private static void createChannel(Context context) {
        NotificationManager manager = (NotificationManager)
            context.getSystemService(Context.NOTIFICATION_SERVICE);
        if (manager == null) return;
        NotificationChannel channel = new NotificationChannel(CHANNEL,
            "Running Tab reminders", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("Alerts for dated To-Do items");
        manager.createNotificationChannel(channel);
    }

    static void openCalendar(Activity activity, String title, String due, String time, String body) {
        try {
            long start = LocalDateTime.parse(due + "T" + time)
                .atZone(ZoneId.systemDefault()).toInstant().toEpochMilli();
            Intent intent = new Intent(Intent.ACTION_INSERT)
                .setData(CalendarContract.Events.CONTENT_URI)
                .putExtra(CalendarContract.Events.TITLE, title == null ? "" : title)
                .putExtra(CalendarContract.Events.DESCRIPTION, body == null ? "" : body)
                .putExtra(CalendarContract.EXTRA_EVENT_BEGIN_TIME, start)
                .putExtra(CalendarContract.EXTRA_EVENT_END_TIME, start + 30 * 60 * 1000);
            activity.startActivity(intent);
        } catch (Exception e) {
            Toast.makeText(activity, "No calendar app could open this event.", Toast.LENGTH_LONG).show();
        }
    }
}
