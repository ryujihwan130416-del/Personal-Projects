package app.pingo.messenger;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

/** JS bridge: background service, permissions, message + incoming-call notifications. See src/lib/native.ts. */
@CapacitorPlugin(name = "PingoNative", permissions = { @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "notifications") })
public class PingoNativePlugin extends Plugin {
    static volatile boolean foreground = false;

    @Override
    public void load() {
        Notifications.ensureChannels(getContext());
        foreground = true;
        Intent i = getActivity().getIntent();
        if (i != null && i.getStringExtra(MainActivity.EXTRA_URL) != null) emitOpen(i);
    }

    private void emitOpen(Intent i) {
        String url = i.getStringExtra(MainActivity.EXTRA_URL);
        if (url == null) return;
        JSObject d = new JSObject(); d.put("url", url);
        notifyListeners("open", d, true);
        i.removeExtra(MainActivity.EXTRA_URL);
    }

    @Override protected void handleOnNewIntent(Intent intent) { emitOpen(intent); }
    @Override protected void handleOnResume() { foreground = true; if (Notifications.shownCall != null) Notifications.cancelCall(getContext(), null); /* the in-app call screen + ringtone take over */ JSObject d = new JSObject(); d.put("active", true); notifyListeners("appState", d); }
    @Override protected void handleOnPause() { foreground = false; JSObject d = new JSObject(); d.put("active", false); notifyListeners("appState", d); }

    @PluginMethod
    public void startBackground(PluginCall call) {
        Intent s = new Intent(getContext(), PingoService.class);
        s.putExtra("title", call.getString("title", "Pingo"));
        s.putExtra("text", call.getString("text", ""));
        try { ContextCompat.startForegroundService(getContext(), s); call.resolve(); }
        catch (Exception e) { call.reject("could not start service: " + e.getMessage()); }
    }

    @PluginMethod
    public void stopBackground(PluginCall call) {
        getContext().stopService(new Intent(getContext(), PingoService.class));
        call.resolve();
    }

    @PluginMethod
    public void status(PluginCall call) {
        Context c = getContext();
        JSObject r = new JSObject();
        r.put("notifications", NotificationManagerCompat.from(c).areNotificationsEnabled());
        PowerManager pm = (PowerManager) c.getSystemService(Context.POWER_SERVICE);
        r.put("batteryExempt", pm.isIgnoringBatteryOptimizations(c.getPackageName()));
        boolean fs = true;
        if (Build.VERSION.SDK_INT >= 34) fs = c.getSystemService(NotificationManager.class).canUseFullScreenIntent();
        r.put("fullScreen", fs);
        r.put("foreground", foreground);
        r.put("service", PingoService.running);
        r.put("sdk", Build.VERSION.SDK_INT);
        call.resolve(r);
    }

    @PluginMethod
    public void requestNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject r = new JSObject(); r.put("granted", NotificationManagerCompat.from(getContext()).areNotificationsEnabled()); call.resolve(r); return;
        }
        requestPermissionForAlias("notifications", call, "notifCallback");
    }

    @PermissionCallback
    private void notifCallback(PluginCall call) {
        JSObject r = new JSObject(); r.put("granted", getPermissionState("notifications") == PermissionState.GRANTED); call.resolve(r);
    }

    @PluginMethod
    public void requestBatteryExemption(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(i);
        } catch (Exception e) {
            try { getActivity().startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)); } catch (Exception ignored) { }
        }
        call.resolve();
    }

    @PluginMethod
    public void requestFullScreen(PluginCall call) {
        if (Build.VERSION.SDK_INT >= 34) {
            try { getActivity().startActivity(new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:" + getContext().getPackageName()))); }
            catch (Exception ignored) { }
        }
        call.resolve();
    }

    /** Credentials for the service's own Realtime Database stream (see PushStream). Empty uid = signed out. */
    @PluginMethod
    public void setPushAuth(PluginCall call) {
        String uid = call.getString("uid", "");
        android.content.SharedPreferences.Editor e = getContext().getSharedPreferences(PushStream.PREFS, Context.MODE_PRIVATE).edit();
        StringBuilder bl = new StringBuilder();
        try { com.getcapacitor.JSArray a = call.getArray("blocked"); if (a != null) for (int k = 0; k < a.length(); k++) { if (bl.length() > 0) bl.append(','); bl.append(a.getString(k)); } } catch (Exception ignored) { }
        if (uid == null || uid.isEmpty()) { e.remove("uid").remove("refreshToken").apply(); PushStream.stop(); call.resolve(); return; }
        android.content.SharedPreferences cur = getContext().getSharedPreferences(PushStream.PREFS, Context.MODE_PRIVATE);
        boolean same = uid.equals(cur.getString("uid", "")) && call.getString("dbUrl", "").equals(cur.getString("dbUrl", ""));
        e.putString("uid", uid).putString("refreshToken", call.getString("refreshToken", "")).putString("apiKey", call.getString("apiKey", ""))
            .putString("dbUrl", call.getString("dbUrl", "")).putString("blocked", bl.toString()).apply();
        if (PingoService.running) { if (same) PushStream.start(getContext()); else PushStream.restart(getContext()); }
        call.resolve();
    }

    @PluginMethod
    public void notify(PluginCall call) {
        Notifications.postMessage(getContext(), call.getInt("id", 1000), call.getString("title", "Pingo"), call.getString("body", ""), call.getString("url", "/"));
        call.resolve();
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        NotificationManagerCompat.from(getContext()).cancel(call.getInt("id", 0));
        call.resolve();
    }

    @PluginMethod
    public void incomingCall(PluginCall call) {
        if (foreground) { call.resolve(); return; } // in the app the web ringtone + call screen handle it
        Notifications.postCall(getContext(), call.getString("key", null), call.getString("title", "Pingo"), call.getString("body", ""), call.getString("url", "/"));
        call.resolve();
    }

    @PluginMethod
    public void cancelCall(PluginCall call) {
        Notifications.cancelCall(getContext(), null);
        Activity a = getActivity();
        if (a instanceof MainActivity) a.runOnUiThread(() -> ((MainActivity) a).setCallMode(false));
        call.resolve();
    }
}
