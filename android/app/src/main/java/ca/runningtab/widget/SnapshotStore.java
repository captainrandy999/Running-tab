package ca.runningtab.widget;

import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.SharedPreferences;
import org.json.JSONArray;
import org.json.JSONException;

final class SnapshotStore {
    static final String PREFS = "running_tab_widget_data";
    static final String MONEY = "money";
    static final String TODO = "todo";
    static final String SHOPPING = "shopping";
    private SnapshotStore() {}

    static SharedPreferences prefs(Context context) {
        return context.getApplicationContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static JSONArray read(Context context, String key) {
        try { return new JSONArray(prefs(context).getString(key, "[]")); }
        catch (JSONException ex) { return new JSONArray(); }
    }

    static void save(Context context, String money, String todo, String shopping) {
        try {
            // Reject malformed snapshots rather than blanking a list.
            new JSONArray(money); new JSONArray(todo); new JSONArray(shopping);
        } catch (Exception ex) { return; }
        SharedPreferences p = prefs(context);
        if (money.equals(p.getString(MONEY, "[]"))
                && todo.equals(p.getString(TODO, "[]"))
                && shopping.equals(p.getString(SHOPPING, "[]"))) return;
        p.edit().putString(MONEY, money).putString(TODO, todo)
                .putString(SHOPPING, shopping).apply();
        RunningTabWidget.refreshAll(context);
    }

    static String tab(Context context, int widgetId) {
        String saved = prefs(context).getString("tab_" + widgetId, MONEY);
        return MONEY.equals(saved) || TODO.equals(saved) || SHOPPING.equals(saved) ? saved : MONEY;
    }

    static void setTab(Context context, int widgetId, String tab) {
        if (MONEY.equals(tab) || TODO.equals(tab) || SHOPPING.equals(tab))
            prefs(context).edit().putString("tab_" + widgetId, tab).apply();
    }

    static void forgetTab(Context context, int widgetId) {
        prefs(context).edit().remove("tab_" + widgetId).apply();
    }
}
