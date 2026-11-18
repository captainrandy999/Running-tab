package ca.runningtab.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import java.util.List;

/** A scheduled reminder fires even when the MyDay WebView is closed. */
public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (ReminderManager.ACTION_ALERT.equals(action)) {
            String id = intent.getData() == null ? null : intent.getData().getLastPathSegment();
            ReminderManager.deliver(context, id);
        } else if (ReminderManager.ACTION_SNOOZE_ALERT.equals(action)) {
            String id = intent.getData() == null ? null : intent.getData().getLastPathSegment();
            ReminderManager.deliverSnoozed(context, id);
        } else if (ReminderManager.ACTION_SNOOZE.equals(action)) {
            Uri uri = intent.getData();
            if (uri == null || !"runningtab".equals(uri.getScheme())
                    || !"snooze".equals(uri.getHost())) return;
            List<String> parts = uri.getPathSegments();
            if (parts.size() != 3) return;
            try {
                int minutes = Integer.parseInt(parts.get(1));
                long source = Long.parseLong(parts.get(2));
                ReminderManager.snooze(context, parts.get(0), minutes, source);
            } catch (NumberFormatException ignored) {}
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            ReminderManager.restore(context);
        }
    }
}
