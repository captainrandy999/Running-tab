package ca.runningtab.widget;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** A scheduled reminder fires even when the Running Tab WebView is closed. */
public final class ReminderReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (ReminderManager.ACTION_ALERT.equals(action)) {
            String id = intent.getData() == null ? null : intent.getData().getLastPathSegment();
            ReminderManager.deliver(context, id);
        } else if (Intent.ACTION_BOOT_COMPLETED.equals(action)
                || Intent.ACTION_TIME_CHANGED.equals(action)
                || Intent.ACTION_TIMEZONE_CHANGED.equals(action)) {
            ReminderManager.restore(context);
        }
    }
}
