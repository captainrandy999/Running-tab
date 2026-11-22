package ca.runningtab.widget;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import com.google.android.gms.location.Geofence;
import com.google.android.gms.location.GeofencingEvent;
import com.google.android.gms.location.GeofencingRequest;
import com.google.android.gms.location.LocationServices;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.json.JSONArray;
import org.json.JSONObject;

/** Optional geofences: no polling service, no continuously running GPS. */
final class StoreGeofenceManager {
    private StoreGeofenceManager() {}
    private static final String PREF="myday_store_geofences";
    private static final String CHANNEL="myday_store_arrivals";
    static final String ACTION="ca.runningtab.widget.STORE_ARRIVAL";
    private static int generation=0;

    static SharedPreferences prefs(Context c){return c.getSharedPreferences(PREF,Context.MODE_PRIVATE);}
    static boolean hasForeground(Context c){
        return c.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
    }
    static boolean hasBackground(Context c){
        return hasForeground(c)&&(Build.VERSION.SDK_INT<29||
            c.checkSelfPermission(Manifest.permission.ACCESS_BACKGROUND_LOCATION)==PackageManager.PERMISSION_GRANTED);
    }
    static void snapshot(Context c,String stores,String shopping,boolean enabled){
        try{new JSONArray(stores);new JSONArray(shopping);}catch(Exception ex){return;}
        SharedPreferences p=prefs(c);
        if(stores.equals(p.getString("stores","[]"))&&shopping.equals(p.getString("shopping","[]"))&&
           enabled==p.getBoolean("enabled",false))return;
        p.edit().putString("stores",stores).putString("shopping",shopping).putBoolean("enabled",enabled).apply();
        refresh(c);
    }
    static JSONArray read(Context c,String key){
        try{return new JSONArray(prefs(c).getString(key,"[]"));}catch(Exception e){return new JSONArray();}
    }
    private static PendingIntent pending(Context c){
        Intent intent=new Intent(c,StoreLocationReceiver.class);
        intent.setAction(ACTION);
        intent.setData(Uri.parse("runningtab://shopping/geofences"));
        int flags=PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0);
        return PendingIntent.getBroadcast(c,0,intent,flags);
    }
    static void refresh(Context c){
        final int seq=++generation;
        final Context app=c.getApplicationContext();
        final PendingIntent intent=pending(app);
        // Remove stale geofences first; these also stop when a store list is cleared.
        LocationServices.getGeofencingClient(app).removeGeofences(intent).addOnCompleteListener(result->{
            if(seq!=generation || !prefs(app).getBoolean("enabled",false)||!hasBackground(app))return;
            JSONArray stores=read(app,"stores"),shopping=read(app,"shopping");
            Map<String,Integer> remaining=new HashMap<>();
            for(int i=0;i<shopping.length();i++){
                JSONObject x=shopping.optJSONObject(i);if(x==null||x.optBoolean("done",false))continue;
                String id=x.optString("storeId","");
                if(!id.isEmpty())remaining.put(id,remaining.getOrDefault(id,0)+1);
            }
            List<Geofence> fences=new ArrayList<>();
            for(int i=0;i<stores.length()&&fences.size()<90;i++){
                JSONObject store=stores.optJSONObject(i);
                if(store==null||!store.optBoolean("enabled",false))continue;
                String id=store.optString("id","");
                if(id.isEmpty()||remaining.getOrDefault(id,0)<1||
                   !store.has("lat")||!store.has("lon"))continue;
                double lat=store.optDouble("lat",1000),lon=store.optDouble("lon",1000);
                if(!Double.isFinite(lat)||!Double.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)continue;
                float radius=Math.max(150,Math.min(1000,store.optInt("radius",200)));
                boolean dwell="dwell".equals(store.optString("arrivalMode"));
                Geofence.Builder builder=new Geofence.Builder().setRequestId(id)
                    .setCircularRegion(lat,lon,radius).setExpirationDuration(Geofence.NEVER_EXPIRE)
                    .setTransitionTypes(dwell?Geofence.GEOFENCE_TRANSITION_DWELL:Geofence.GEOFENCE_TRANSITION_ENTER);
                if(dwell)builder.setLoiteringDelay(120000);
                fences.add(builder.build());
            }
            if(fences.isEmpty())return;
            GeofencingRequest request=new GeofencingRequest.Builder()
                .setInitialTrigger(GeofencingRequest.INITIAL_TRIGGER_ENTER|GeofencingRequest.INITIAL_TRIGGER_DWELL)
                .addGeofences(fences).build();
            if(!hasBackground(app))return;
            try{LocationServices.getGeofencingClient(app).addGeofences(request,intent);}
            catch(SecurityException ignored){}
        });
    }
    static void arrived(Context c,Intent intent){
        if(!prefs(c).getBoolean("enabled",false)||!hasBackground(c))return;
        GeofencingEvent event=GeofencingEvent.fromIntent(intent);
        if(event==null||event.hasError()||event.getTriggeringGeofences()==null)return;
        int transition=event.getGeofenceTransition();
        if(transition!=Geofence.GEOFENCE_TRANSITION_ENTER&&transition!=Geofence.GEOFENCE_TRANSITION_DWELL)return;
        JSONArray stores=read(c,"stores"),shopping=read(c,"shopping");
        for(Geofence fence:event.getTriggeringGeofences()){
            String id=fence.getRequestId();JSONObject store=null;
            for(int i=0;i<stores.length();i++){
                JSONObject x=stores.optJSONObject(i);if(x!=null&&id.equals(x.optString("id"))){store=x;break;}
            }
            if(store==null||!store.optBoolean("enabled",false))continue;
            boolean dwell="dwell".equals(store.optString("arrivalMode"));
            if(dwell!=(transition==Geofence.GEOFENCE_TRANSITION_DWELL))continue;
            int count=0;
            for(int i=0;i<shopping.length();i++){
                JSONObject x=shopping.optJSONObject(i);
                if(x!=null&&!x.optBoolean("done",false)&&id.equals(x.optString("storeId")))count++;
            }
            if(count==0)continue;
            long now=System.currentTimeMillis(),last=prefs(c).getLong("last_"+id,0);
            if(now-last<2*60*60*1000L)continue; // avoid repeated GPS boundary alerts
            NotificationManager nm=(NotificationManager)c.getSystemService(Context.NOTIFICATION_SERVICE);
            if(nm==null||!nm.areNotificationsEnabled()||
                (Build.VERSION.SDK_INT>=33&&c.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)!=PackageManager.PERMISSION_GRANTED))continue;
            nm.createNotificationChannel(new NotificationChannel(CHANNEL,"MyDay shopping arrivals",NotificationManager.IMPORTANCE_HIGH));
            Intent open=new Intent(c,MainActivity.class);
            open.setAction("ca.runningtab.widget.OPEN_STORE");
            open.setData(Uri.parse("runningtab://shopping/store/"+Uri.encode(id)));
            open.putExtra(MainActivity.EXTRA_SECTION,"shopping");
            open.putExtra(MainActivity.EXTRA_ITEM_KEY,"store:"+id);
            open.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK|Intent.FLAG_ACTIVITY_CLEAR_TOP|Intent.FLAG_ACTIVITY_SINGLE_TOP);
            PendingIntent tap=PendingIntent.getActivity(c,0,open,PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
            String name=store.optString("name","Store");
            Notification note=new Notification.Builder(c,CHANNEL)
                .setSmallIcon(android.R.drawable.ic_menu_mylocation)
                .setContentTitle("Shopping at "+name)
                .setContentText("You have "+count+" item"+(count==1?"":"s")+" to buy here. Tap to open the list.")
                .setCategory(Notification.CATEGORY_REMINDER).setAutoCancel(true)
                .setContentIntent(tap).build();
            nm.notify(("shop:"+id).hashCode(),note);
            prefs(c).edit().putLong("last_"+id,now).apply();
        }
    }
}
