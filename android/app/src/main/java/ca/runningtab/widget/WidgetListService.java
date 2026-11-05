package ca.runningtab.widget;

import android.appwidget.AppWidgetManager;
import android.content.Context;
import android.content.Intent;
import android.widget.RemoteViews;
import android.widget.RemoteViewsService;
import java.util.ArrayList;
import java.util.List;

public class WidgetListService extends RemoteViewsService {
    @Override public RemoteViewsFactory onGetViewFactory(Intent intent) {
        return new Rows(getApplicationContext(), intent.getStringExtra("tab"), intent.getBooleanExtra("dark", false));
    }

    private static final class Rows implements RemoteViewsFactory {
        private final Context context;
        private final String tab;
        private final boolean dark;
        private List<WidgetData.Row> items = new ArrayList<>();

        Rows(Context context, String tab, boolean dark) {
            this.context = context;
            this.tab = tab == null ? SnapshotStore.MONEY : tab;
            this.dark = dark;
        }
        @Override public void onCreate() { onDataSetChanged(); }
        @Override public void onDataSetChanged() { items = WidgetData.rows(context, tab); }
        @Override public void onDestroy() { items.clear(); }
        @Override public int getCount() { return items.size(); }
        @Override public RemoteViews getViewAt(int position) {
            if (position < 0 || position >= items.size()) return null;
            WidgetData.Row item = items.get(position);
            RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
            row.setInt(R.id.rowRoot, "setBackgroundResource",
                    dark ? R.drawable.widget_tab_dark_idle : R.drawable.widget_tab_idle);
            row.setTextColor(R.id.rowTitle, dark
                    ? android.graphics.Color.rgb(237, 244, 250)
                    : android.graphics.Color.rgb(32, 51, 72));
            row.setTextColor(R.id.rowSubtitle, dark
                    ? android.graphics.Color.rgb(169, 188, 207)
                    : android.graphics.Color.rgb(83, 108, 125));
            row.setTextViewText(R.id.rowTitle, item.title);
            row.setTextViewText(R.id.rowSubtitle, item.subtitle);
            Intent fillIn = new Intent();
            fillIn.putExtra(MainActivity.EXTRA_SECTION, tab);
            row.setOnClickFillInIntent(R.id.rowRoot, fillIn);
            return row;
        }
        @Override public RemoteViews getLoadingView() { return null; }
        @Override public int getViewTypeCount() { return 1; }
        @Override public long getItemId(int position) { return position; }
        @Override public boolean hasStableIds() { return false; }
    }
}
