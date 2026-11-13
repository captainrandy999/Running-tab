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
import org.json.JSONArray;
import org.json.JSONObject;

/** Schedules To-Do alarms on the phone, independently of the Running Tab WebView.
 *  Calendar events are only opened as editable drafts; the user saves them.
 */
public final class ReminderManager {
    private static final String PREFS = "running_tab_reminders";
    private static final String KEY = "todo_json";
    private static final String CHANNEL = "running_tab_due_alerts";
    static final String ACTION_ALERT = "ca.runningtab.widget.REMIND_TODO";
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
        restore(context);
    }

    static void restore(Context context) {
        if (!canNotify(context)) return;
        String value = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]");
        try {
            JSONArray items = new JSONArray(value);
            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.optJSONObject(i);
                if (eligible(item)) schedule(context, item);
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

    private static void schedule(Context context, JSONObject item) {
        long at = scheduledTime(item);
        if (at <= System.currentTimeMillis()) return;
        AlarmManager alarms = (AlarmManager) context.getSystemService(Context.ALARM_SERVICE);
        if (alarms == null) return;
        PendingIntent intent = pending(context, item.optString("id"), PendingIntent.FLAG_UPDATE_CURRENT);
        try {
            // Exact alarms require special access on recent Android versions.
            // Fall back to a battery-friendly inexact alert if not granted.
            if (Build.VERSION.SDK_INT >= 31 && !alarms.canScheduleExactAlarms())
                alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
            else
                alarms.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        } catch (SecurityException e) {
            alarms.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, intent);
        }
    }

    static void deliver(Context context, String id) {
        if (!canNotify(context) || id == null) return;
        try {
            String raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                .getString(KEY, "[]");
            JSONArray items = new JSONArray(raw);
            for (int i = 0; i < items.length(); i++) {
                JSONObject task = items.optJSONObject(i);
                if (!eligible(task) || !id.equals(task.optString("id"))) continue;
                long due = scheduledTime(task);
                long now = System.currentTimeMillis();
                if (due < 0 || due > now + 60000 || due < now - 24L * 60 * 60 * 1000) return;
                createChannel(context);
                String title = task.optString("title", "To-Do reminder");
                if (title.length() > 200) title = title.substring(0, 200);
                Intent open = new Intent(context, MainActivity.class);
                open.putExtra(MainActivity.EXTRA_SECTION, "todo");
                open.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                PendingIntent tap = PendingIntent.getActivity(context, 1, open,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                Notification notification = new Notification.Builder(context, CHANNEL)
                    .setSmallIcon(android.R.drawable.ic_popup_reminder)
                    .setContentTitle(title)
                    .setContentText("Running Tab · To-Do reminder")
                    .setContentIntent(tap)
                    .setCategory(Notification.CATEGORY_REMINDER)
                    .setAutoCancel(true).build();
                NotificationManager manager = (NotificationManager)
                    context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (manager != null) manager.notify(id.hashCode(), notification);
                return;
            }
        } catch (Exception ignored) {}
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
