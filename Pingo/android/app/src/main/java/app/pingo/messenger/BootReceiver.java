package app.pingo.messenger;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import androidx.core.content.ContextCompat;

/** After a reboot / app update, restart the background service if you were signed in with it on. */
public class BootReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context c, Intent i) {
        if (c.getSharedPreferences(PushStream.PREFS, Context.MODE_PRIVATE).getString("uid", "").isEmpty()) return;
        boolean ko = c.getResources().getConfiguration().getLocales().get(0).getLanguage().equals("ko");
        Intent s = new Intent(c, PingoService.class).putExtra("title", "Pingo").putExtra("text", ko ? "전화와 메시지를 받을 수 있도록 Pingo가 실행 중이에요" : "Pingo is running so calls and messages reach you");
        try { ContextCompat.startForegroundService(c, s); } catch (Exception ignored) { }
    }
}
