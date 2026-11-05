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
        return new Rows(getApplicationContext(), intent.getStringExtra("tab"));
    }

    private static final class Rows implements RemoteViewsFactory {
        private final Context context;
        private final String tab;
        private List<WidgetData.Row> items = new ArrayList<>();

        Rows(Context context, String tab) {
            this.context = context;
            this.tab = tab == null ? SnapshotStore.MONEY : tab;
        }
        @Override public void onCreate() { onDataSetChanged(); }
        @Override public void onDataSetChanged() { items = WidgetData.rows(context, tab); }
        @Override public void onDestroy() { items.clear(); }
        @Override public int getCount() { return items.size(); }
        @Override public RemoteViews getViewAt(int position) {
            if (position < 0 || position >= items.size()) return null;
            WidgetData.Row item = items.get(position);
            RemoteViews row = new RemoteViews(context.getPackageName(), R.layout.widget_row);
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
