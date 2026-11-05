package ca.runningtab.widget;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.view.View;
import android.widget.RemoteViews;
import java.util.List;

public class RunningTabWidget extends AppWidgetProvider {
    private static final String SWITCH = "ca.runningtab.widget.SWITCH_TAB";
    private static final String TOGGLE_NIGHT = "ca.runningtab.widget.TOGGLE_NIGHT";
    private static final String[] TABS = {
        SnapshotStore.MONEY, SnapshotStore.TODO, SnapshotStore.SHOPPING
    };
    private static final int[] BUTTONS = {R.id.widgetMoney, R.id.widgetTodo, R.id.widgetShopping};

    @Override public void onUpdate(Context context, AppWidgetManager manager, int[] ids) {
        for (int id : ids) update(context, manager, id);
    }

    @Override public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        if (TOGGLE_NIGHT.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID,
                    AppWidgetManager.INVALID_APPWIDGET_ID);
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID) {
                SnapshotStore.toggleDark(context, id);
                update(context, AppWidgetManager.getInstance(context), id);
            }
        } else if (SWITCH.equals(intent.getAction())) {
            int id = intent.getIntExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, AppWidgetManager.INVALID_APPWIDGET_ID);
            String tab = intent.getStringExtra("tab");
            if (id != AppWidgetManager.INVALID_APPWIDGET_ID
                    && (SnapshotStore.MONEY.equals(tab) || SnapshotStore.TODO.equals(tab) || SnapshotStore.SHOPPING.equals(tab))) {
                SnapshotStore.setTab(context, id, tab);
                update(context, AppWidgetManager.getInstance(context), id);
            }
        }
    }

    @Override public void onAppWidgetOptionsChanged(Context context, AppWidgetManager manager,
                                                      int widgetId, android.os.Bundle options) {
        update(context, manager, widgetId);
    }

    @Override public void onDeleted(Context context, int[] ids) {
        for (int id : ids) SnapshotStore.forgetTab(context, id);
    }

    static void refreshAll(Context context) {
        AppWidgetManager manager = AppWidgetManager.getInstance(context);
        int[] ids = manager.getAppWidgetIds(new ComponentName(context, RunningTabWidget.class));
        for (int id : ids) update(context, manager, id);
    }

    private static PendingIntent toggleThemeIntent(Context context, int widgetId) {
        Intent intent = new Intent(context, RunningTabWidget.class);
        intent.setAction(TOGGLE_NIGHT);
        intent.setData(Uri.parse("runningtab://widget/night/" + widgetId));
        intent.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        return PendingIntent.getBroadcast(context, widgetId * 10 + 7, intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent switchIntent(Context context, int widgetId, int index) {
        Intent i = new Intent(context, RunningTabWidget.class);
        i.setAction(SWITCH);
        i.setData(Uri.parse("runningtab://widget/tab/" + widgetId + "/" + index));
        i.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        i.putExtra("tab", TABS[index]);
        return PendingIntent.getBroadcast(context, widgetId * 10 + index, i,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    private static PendingIntent activityIntent(Context context, int widgetId, String tab,
                                                boolean dictate, boolean collectionTemplate) {
        Intent i = new Intent(context, MainActivity.class);
        i.setAction("ca.runningtab.widget.OPEN");
        i.setData(Uri.parse("runningtab://widget/open/" + widgetId + "/" + tab + "/" + dictate));
        i.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        i.putExtra(MainActivity.EXTRA_SECTION, tab);
        if (dictate) i.putExtra(MainActivity.EXTRA_DICTATE, true);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT
                | (collectionTemplate ? PendingIntent.FLAG_MUTABLE : PendingIntent.FLAG_IMMUTABLE);
        return PendingIntent.getActivity(context, widgetId * 10 + (dictate ? 9 : 8), i, flags);
    }

    static void update(Context context, AppWidgetManager manager, int widgetId) {
        String selected = SnapshotStore.tab(context, widgetId);
        boolean dark = SnapshotStore.dark(context, widgetId);
        RemoteViews view = new RemoteViews(context.getPackageName(), R.layout.widget_running_tab);
        int text = dark ? Color.rgb(237, 244, 250) : Color.rgb(22, 59, 89);
        int muted = dark ? Color.rgb(169, 188, 207) : Color.rgb(100, 122, 138);
        int secondary = dark ? Color.rgb(208, 224, 237) : Color.rgb(72, 101, 122);
        int idleBackground = dark ? R.drawable.widget_tab_dark_idle : R.drawable.widget_tab_idle;
        int activeBackground = dark ? R.drawable.widget_tab_dark_active : R.drawable.widget_tab_active;
        view.setInt(R.id.widgetRoot, "setBackgroundResource",
                dark ? R.drawable.widget_background_dark : R.drawable.widget_background);
        view.setTextColor(R.id.widgetTitle, text);
        view.setTextColor(R.id.widgetMic, text);
        view.setInt(R.id.widgetMic, "setBackgroundResource", idleBackground);
        view.setTextViewText(R.id.widgetTheme, dark ? "☀" : "☾");
        view.setTextColor(R.id.widgetTheme, text);
        view.setInt(R.id.widgetTheme, "setBackgroundResource", idleBackground);
        view.setContentDescription(R.id.widgetTheme,
                dark ? "Switch to daytime mode" : "Switch to night mode");
        view.setOnClickPendingIntent(R.id.widgetTheme, toggleThemeIntent(context, widgetId));
        view.setTextColor(R.id.widgetCount, muted);
        view.setTextColor(R.id.widgetEmpty, muted);
        view.setTextColor(R.id.widgetFooter, muted);
        view.setTextColor(R.id.widgetOwed,
                dark ? Color.rgb(98, 232, 182) : Color.rgb(10, 118, 95));
        view.setTextColor(R.id.widgetIOwe,
                dark ? Color.rgb(255, 157, 170) : Color.rgb(163, 59, 67));
        for (int n = 0; n < BUTTONS.length; n++) {
            boolean active = TABS[n].equals(selected);
            view.setInt(BUTTONS[n], "setBackgroundResource",
                    active ? activeBackground : idleBackground);
            view.setTextColor(BUTTONS[n], active ? Color.WHITE : secondary);
            view.setOnClickPendingIntent(BUTTONS[n], switchIntent(context, widgetId, n));
        }
        view.setOnClickPendingIntent(R.id.widgetMic, activityIntent(context, widgetId, selected, true, false));
        view.setOnClickPendingIntent(R.id.widgetTitle, activityIntent(context, widgetId, selected, false, false));

        WidgetData.Summary money = WidgetData.moneySummary(context);
        view.setViewVisibility(R.id.widgetTotals,
                SnapshotStore.MONEY.equals(selected) ? View.VISIBLE : View.GONE);
        view.setTextViewText(R.id.widgetOwed, "Owed to you\n" + WidgetData.dollars(money.owedToMe));
        view.setTextViewText(R.id.widgetIOwe, "You owe\n" + WidgetData.dollars(money.iOwe));
        List<WidgetData.Row> rows = WidgetData.rows(context, selected);
        String count = SnapshotStore.MONEY.equals(selected)
                ? rows.size() + " people"
                : rows.size() + (SnapshotStore.TODO.equals(selected) ? " remaining" : " to buy");
        view.setTextViewText(R.id.widgetCount, count);
        view.setTextViewText(R.id.widgetEmpty,
                "No " + (SnapshotStore.MONEY.equals(selected) ? "money entries"
                    : SnapshotStore.TODO.equals(selected) ? "reminders" : "shopping items") + " yet");

        Intent service = new Intent(context, WidgetListService.class);
        service.putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId);
        service.putExtra("tab", selected);
        service.putExtra("dark", dark);
        service.setData(Uri.parse("runningtab://widget/list/" + widgetId + "/" + selected
                + "/" + (dark ? "night" : "day")));
        view.setRemoteAdapter(R.id.widgetList, service);
        view.setEmptyView(R.id.widgetList, R.id.widgetEmpty);
        view.setPendingIntentTemplate(R.id.widgetList,
                activityIntent(context, widgetId, selected, false, true));
        manager.updateAppWidget(widgetId, view);
        manager.notifyAppWidgetViewDataChanged(widgetId, R.id.widgetList);
    }
}
