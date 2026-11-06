package ca.runningtab.widget;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

final class WidgetData {
    private WidgetData() {}
    static final class Row {
        final String title;
        final String subtitle;
        Row(String title, String subtitle) { this.title = title; this.subtitle = subtitle; }
    }
    static final class Summary {
        final long owedToMe;
        final long iOwe;
        Summary(long owedToMe, long iOwe) { this.owedToMe = owedToMe; this.iOwe = iOwe; }
    }
    private static final class Person {
        String name;
        long toMe, iOwe;
        int count, tbd;
        Person(String name) { this.name = name; }
    }

    static String dollars(long cents) {
        NumberFormat fmt = NumberFormat.getCurrencyInstance(Locale.CANADA);
        return fmt.format(cents / 100.0);
    }

    static Summary moneySummary(Context context) {
        JSONArray records = SnapshotStore.read(context, SnapshotStore.MONEY);
        long to = 0, owe = 0;
        for (int i = 0; i < records.length(); i++) {
            JSONObject rec = records.optJSONObject(i);
            if (rec == null || rec.isNull("cents")) continue;
            long value = rec.optLong("cents", 0);
            if (value <= 0) continue;
            if ("to_me".equals(rec.optString("direction"))) to += value;
            else if ("i_owe".equals(rec.optString("direction"))) owe += value;
        }
        return new Summary(to, owe);
    }

    static List<Row> rows(Context context, String tab) {
        if (SnapshotStore.MONEY.equals(tab)) return moneyRows(context);
        if (SnapshotStore.TODO.equals(tab)) return todoRows(context);
        return shoppingRows(context);
    }

    private static List<Row> moneyRows(Context context) {
        JSONArray records = SnapshotStore.read(context, SnapshotStore.MONEY);
        Map<String, Person> map = new LinkedHashMap<>();
        for (int i = 0; i < records.length(); i++) {
            JSONObject r = records.optJSONObject(i);
            if (r == null) continue;
            String name = r.optString("person", "").trim();
            if (name.isEmpty()) continue;
            String key = name.toLowerCase(Locale.ROOT);
            Person p = map.get(key);
            if (p == null) { p = new Person(name); map.put(key, p); }
            p.count++;
            if (r.isNull("cents")) p.tbd++;
            else {
                long amount = r.optLong("cents", 0);
                if ("to_me".equals(r.optString("direction"))) p.toMe += amount;
                else if ("i_owe".equals(r.optString("direction"))) p.iOwe += amount;
            }
        }
        List<Person> people = new ArrayList<>(map.values());
        people.sort((a, b) -> Long.compare(
                Math.abs(b.toMe - b.iOwe), Math.abs(a.toMe - a.iOwe)));
        List<Row> rows = new ArrayList<>();
        for (Person p : people) {
            long net = p.toMe - p.iOwe;
            String balance = net > 0 ? "Owes you " + dollars(net)
                    : net < 0 ? "You owe " + dollars(-net) : "Settled";
            if (p.tbd > 0) balance += "  ·  " + p.tbd + " price TBD";
            rows.add(new Row(p.name, balance));
        }
        return rows;
    }

    private static final DateTimeFormatter DAY = DateTimeFormatter.ofPattern("MMM d, yyyy", Locale.CANADA);
    private static final DateTimeFormatter MONTH = DateTimeFormatter.ofPattern("MMMM yyyy", Locale.CANADA);

    private static List<Row> todoRows(Context context) {
        JSONArray records = SnapshotStore.read(context, SnapshotStore.TODO);
        List<JSONObject> pending = new ArrayList<>();
        for (int i = 0; i < records.length(); i++) {
            JSONObject record = records.optJSONObject(i);
            if (record != null && !record.optBoolean("done", false)) pending.add(record);
        }
        pending.sort(Comparator.comparing(WidgetData::sortKey));
        List<Row> rows = new ArrayList<>();
        for (JSONObject r : pending) {
            String title = r.optString("title", "Untitled reminder");
            String type = r.optString("dueType", "none");
            String due = r.optString("due", "");
            String detail = "No deadline";
            try {
                if ("day".equals(type) && !due.isEmpty()) {
                    LocalDate d = LocalDate.parse(due);
                    detail = d.format(DAY);
                    if (d.isBefore(LocalDate.now())) detail = "Overdue · " + detail;
                } else if ("month".equals(type) && !due.isEmpty()) {
                    detail = LocalDate.parse(due + "-01").format(MONTH) + " (whole month)";
                }
            } catch (DateTimeParseException ignored) { detail = "Check date"; }
            if ("note".equals(r.optString("kind"))) {
                String body = r.optString("body", "").replaceAll("\\s+", " ").trim();
                String preview = body.length() > 68 ? body.substring(0, 67) + "…" : body;
                detail = "📝 Note · " + detail + (preview.isEmpty() ? "" : " · " + preview);
            }
            rows.add(new Row(title, detail));
        }
        return rows;
    }

    private static String sortKey(JSONObject r) {
        String type = r.optString("dueType", "none"), d = r.optString("due", "");
        if ("day".equals(type) && d.length() == 10) return d;
        if ("month".equals(type) && d.length() == 7) return d + "-32";
        return "9999-12-31";
    }

    private static List<Row> shoppingRows(Context context) {
        JSONArray records = SnapshotStore.read(context, SnapshotStore.SHOPPING);
        List<Row> rows = new ArrayList<>();
        for (int i = 0; i < records.length(); i++) {
            JSONObject item = records.optJSONObject(i);
            if (item != null && !item.optBoolean("done", false)) {
                String name = item.optString("name", "").trim();
                if (!name.isEmpty()) rows.add(new Row(name, "To buy"));
            }
        }
        return rows;
    }
}
