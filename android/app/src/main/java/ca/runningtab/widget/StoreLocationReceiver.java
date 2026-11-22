package ca.runningtab.widget;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
public class StoreLocationReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context,Intent intent){
        if(intent!=null&&StoreGeofenceManager.ACTION.equals(intent.getAction()))
            StoreGeofenceManager.arrived(context,intent);
    }
}
