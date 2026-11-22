package ca.runningtab.widget;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import com.google.android.gms.location.LocationServices;
import org.json.JSONArray;
import org.json.JSONObject;

/** One-time upgrade cleanup. Never requests or reads device location. */
final class LegacyStoreLocationCleanup {
    private static final String PREFS="myday_store_geofences";
    private static final String CHANNEL="myday_store_arrivals";
    private LegacyStoreLocationCleanup(){}

    static void disable(Context context){
        Context app=context.getApplicationContext();
        SharedPreferences pref=app.getSharedPreferences(PREFS,Context.MODE_PRIVATE);
        if(pref.getBoolean("v32_cleared",false))return;
        String previousStores=pref.getString("stores","[]");
        pref.edit().putBoolean("enabled",false).apply();
        // Match the exact PendingIntent registered by older app versions.
        Intent legacy=new Intent().setClassName(app,app.getPackageName()+".StoreLocationReceiver");
        legacy.setAction("ca.runningtab.widget.STORE_ARRIVAL");
        legacy.setData(Uri.parse("runningtab://shopping/geofences"));
        int flags=PendingIntent.FLAG_UPDATE_CURRENT|
            (Build.VERSION.SDK_INT>=31?PendingIntent.FLAG_MUTABLE:0);
        try{
            PendingIntent pending=PendingIntent.getBroadcast(app,0,legacy,flags);
            LocationServices.getGeofencingClient(app).removeGeofences(pending)
                .addOnCompleteListener(task->{
                    pending.cancel();
                    cancelOldNotifications(app,previousStores);
                    pref.edit().clear().putBoolean("v32_cleared",task.isSuccessful()).apply();
                });
        }catch(Exception ignored){
            // No old receiver exists in the new manifest. Retry on next launch.
            cancelOldNotifications(app,previousStores);
        }
    }

    private static void cancelOldNotifications(Context app,String stored){
        NotificationManager manager=(NotificationManager)app.getSystemService(Context.NOTIFICATION_SERVICE);
        if(manager==null)return;
        try{
            JSONArray stores=new JSONArray(stored);
            for(int i=0;i<stores.length();i++){
                JSONObject store=stores.optJSONObject(i);
                if(store==null)continue;
                String id=store.optString("id","");
                if(!id.isEmpty())manager.cancel(("shop:"+id).hashCode());
            }
        }catch(Exception ignored){}
        if(Build.VERSION.SDK_INT>=26)manager.deleteNotificationChannel(CHANNEL);
    }
}
