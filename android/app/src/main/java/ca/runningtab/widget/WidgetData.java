package ca.runningtab.widget;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.Instant;
import java.time.ZoneId;
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
        final String itemKey;
        final int dateGroup; // -1: no heading; 0: urgent; 1: upcoming; 2: undated
        Row(String title, String subtitle, String itemKey) {
            this(title, subtitle, itemKey, -1);
        }
        Row(String title, String subtitle, String itemKey, int dateGroup) {
            this.title = title;
            this.subtitle = subtitle;
            this.itemKey = itemKey;
            this.dateGroup = dateGroup;
        }
    }
    static final class Summary {
        final long owedToMe;
        final long iOwe;
        Summary(long owedToMe, long iOwe) { this.owedToMe = owedToMe; this.iOwe = iOwe; }
    }
    private static final class Person {
        String name;
        long toMe, iOwe;
        int count, tbd, settled, active;
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
            if (rec == null || rec.optBoolean("settled", false) || rec.isNull("cents")) continue;
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
            if (r.optBoolean("settled", false)) { p.settled++; continue; }
            p.active++;
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
                    : net < 0 ? "You owe " + dollars(-net)
                    : p.tbd > 0 ? "$ TBD"
                    : p.active == 0 && p.settled > 0 ? "Settled" : "No balance";
            if (p.tbd > 0 && net != 0) balance += "  ·  " + p.tbd + " × $ TBD";
            else if (p.tbd > 1) balance += "  ·  " + p.tbd + " entries";
            if (p.settled > 0) balance += "  ·  " + p.settled + " settled";
            rows.add(new Row(p.name, balance, p.name));
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
        long now = System.currentTimeMillis();
        String today = LocalDate.ofInstant(Instant.ofEpochMilli(now), ZoneId.systemDefault()).toString();
        Map<JSONObject, String> keys = new HashMap<>();
        for (JSONObject r : pending) keys.put(r, sortKey(r, now));
        pending.sort(Comparator.comparingInt((JSONObject r) -> dateGroup(r, keys.get(r), today))
                .thenComparing(r -> keys.get(r))
                .thenComparing(r -> r.optString("created", "")));
        List<Row> rows = new ArrayList<>();
        int previousGroup = -1;
        for (JSONObject r : pending) {
            int group = dateGroup(r, keys.get(r), today);
            int heading = group == previousGroup ? -1 : group;
            previousGroup = group;
            String title = r.optString("title", "Untitled reminder");
            String type = r.optString("dueType", "none");
            String due = r.optString("due", "");
            JSONObject recurrence = r.optJSONObject("repeat");
            boolean shortRepeat = recurrence != null && "minutes".equals(recurrence.optString("type"));
            if ("day".equals(type) && !"9999-12-31".equals(keys.get(r))) due = keys.get(r);
            String detail = "No deadline";
            try {
                if (shortRepeat) {
                    detail = "Automatic alerts";
                } else if ("day".equals(type) && !due.isEmpty()) {
                    LocalDate d = LocalDate.parse(due);
                    detail = d.format(DAY);
                    if (due.compareTo(today) < 0) detail = "Overdue · " + detail;
                    else if (due.equals(today)) detail = "Today · " + detail;
                } else if ("month".equals(type) && !due.isEmpty()) {
                    detail = LocalDate.parse(due + "-01").format(MONTH) + " (whole month)";
                    if (group == 0) detail = "Overdue · " + detail;
                }
            } catch (DateTimeParseException ignored) { detail = "Check date"; }
            if (r.optJSONObject("repeat") != null) {
                detail += r.optBoolean("repeatPaused", false) ? " · 🔁 Paused" : " · 🔁 Repeats";
            }
            if ("note".equals(r.optString("kind"))) {
                String body = r.optString("body", "").replaceAll("\\s+", " ").trim();
                String preview = body.length() > 68 ? body.substring(0, 67) + "…" : body;
                detail = "📝 Note · " + detail + (preview.isEmpty() ? "" : " · " + preview);
            }
            rows.add(new Row(title, detail, r.optString("id", ""), heading));
        }
        return rows;
    }

    private static int dateGroup(JSONObject r, String key, String today) {
        String type = r.optString("dueType", "none");
        if ("none".equals(type) || "9999-12-31".equals(key)) return 2;
        if ("month".equals(type)) return r.optString("due", "").compareTo(today.substring(0, 7)) < 0 ? 0 : 1;
        JSONObject recurrence = r.optJSONObject("repeat");
        boolean activeShortRepeat = recurrence != null && "minutes".equals(recurrence.optString("type"))
                && !r.optBoolean("repeatPaused", false);
        return activeShortRepeat || key.compareTo(today) <= 0 ? 0 : 1;
    }

    private static String sortKey(JSONObject r, long now) {
        String type = r.optString("dueType", "none"), d = r.optString("due", "");
        if ("day".equals(type) && d.length() == 10) {
            JSONObject recurrence = r.optJSONObject("repeat");
            if (recurrence != null && !"minutes".equals(recurrence.optString("type"))) {
                long next = ReminderManager.nextCalendarAlarm(r, now);
                if (next > 0) return LocalDate.ofInstant(Instant.ofEpochMilli(next), ZoneId.systemDefault()).toString();
            }
            return d;
        }
        if ("month".equals(type) && d.length() == 7) return d + "-32";
        return "9999-12-31";
    }

    // Flat master list; each shopping item appears once, no matter how many tags.
    private static List<Row> shoppingRows(Context context) {
        JSONArray items=SnapshotStore.read(context,SnapshotStore.SHOPPING);
        JSONArray stores=SnapshotStore.read(context,SnapshotStore.STORES);
        Map<String,String> names=new LinkedHashMap<>();
        for(int i=0;i<stores.length();i++){
            JSONObject s=stores.optJSONObject(i);
            if(s!=null){
                String id=s.optString("id",""),name=s.optString("name","");
                if(!id.isEmpty()&&!name.isEmpty())names.put(id,name);
            }
        }
        List<Row> out=new ArrayList<>();
        for(int i=0;i<items.length();i++){
            JSONObject item=items.optJSONObject(i);
            if(item==null||item.optBoolean("done",false))continue;
            String name=item.optString("name","").trim();
            if(name.isEmpty())continue;
            JSONArray ids=item.optJSONArray("storeIds");
            List<String> labels=new ArrayList<>();
            if(ids!=null){
                for(int j=0;j<ids.length();j++){
                    String label=names.get(ids.optString(j,""));
                    if(label!=null&&!labels.contains(label))labels.add(label);
                }
            }else{
                String label=names.get(item.optString("storeId",""));
                if(label!=null)labels.add(label);
            }
            String detail=labels.isEmpty()?"Any store":"🏷 "+String.join(" · ",labels);
            out.add(new Row(name,detail,item.optString("id","")));
        }
        return out;
    }
}
