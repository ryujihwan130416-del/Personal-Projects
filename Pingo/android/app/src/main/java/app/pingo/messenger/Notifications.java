package app.pingo.messenger;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.PendingIntent;
import android.content.Intent;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

final class Notifications {
    static final String CH_BG = "pingo_bg";
    static final String CH_MSG = "pingo_messages";
    static final String CH_CALL = "pingo_calls";

    static void ensureChannels(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = c.getSystemService(NotificationManager.class);
        boolean ko = c.getResources().getConfiguration().getLocales().get(0).getLanguage().equals("ko");
        if (nm.getNotificationChannel(CH_BG) == null) {
            NotificationChannel bg = new NotificationChannel(CH_BG, ko ? "백그라운드 실행" : "Running in background", NotificationManager.IMPORTANCE_MIN);
            bg.setShowBadge(false);
            nm.createNotificationChannel(bg);
        }
        if (nm.getNotificationChannel(CH_MSG) == null) {
            NotificationChannel msg = new NotificationChannel(CH_MSG, ko ? "메시지" : "Messages", NotificationManager.IMPORTANCE_HIGH);
            msg.enableVibration(true);
            nm.createNotificationChannel(msg);
        }
        if (nm.getNotificationChannel(CH_CALL) == null) {
            NotificationChannel call = new NotificationChannel(CH_CALL, ko ? "전화 수신" : "Incoming calls", NotificationManager.IMPORTANCE_HIGH);
            Uri ring = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            call.setSound(ring, new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION).build());
            call.enableVibration(true);
            call.setVibrationPattern(new long[] { 0, 800, 400, 800, 400, 800 });
            call.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
            call.setBypassDnd(false);
            nm.createNotificationChannel(call);
        }
    }
    static final int CALL_ID = 2;
    /** Id of the call currently shown (so the same call never rings twice). */
    static volatile String shownCall = null;

    static int chatNotifId(String chatId) { int h = 0; for (int i = 0; i < chatId.length(); i++) h = h * 31 + chatId.charAt(i); return Math.abs(h) % 100000 + 1000; }

    static PendingIntent openIntent(Context c, String url, int req, boolean isCall) {
        Intent i = new Intent(c, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(MainActivity.EXTRA_URL, url)
            .putExtra(MainActivity.EXTRA_CALL, isCall);
        return PendingIntent.getActivity(c, req, i, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
    }

    /** One message notification per chat (a newer message replaces it and alerts once). */
    static void postMessage(Context c, int id, String title, String body, String url) {
        ensureChannels(c);
        Notification n = new NotificationCompat.Builder(c, CH_MSG)
            .setSmallIcon(R.drawable.ic_stat_pingo)
            .setColor(0xFFFF70AD)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setWhen(System.currentTimeMillis())
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setContentIntent(openIntent(c, url, id, false))
            .build();
        try { NotificationManagerCompat.from(c).notify(id, n); } catch (SecurityException ignored) { }
    }

    static void postCall(Context c, String key, String title, String body, String url) {
        if (key != null && key.equals(shownCall)) return;
        ensureChannels(c);
        shownCall = key;
        PendingIntent pi = openIntent(c, url, CALL_ID, true);
        Notification n = new NotificationCompat.Builder(c, CH_CALL)
            .setSmallIcon(R.drawable.ic_stat_pingo)
            .setColor(0xFFFF70AD)
            .setContentTitle(title)
            .setContentText(body)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setOngoing(true)
            .setAutoCancel(true)
            .setOnlyAlertOnce(true)
            .setTimeoutAfter(45000)
            .setContentIntent(pi)
            .setFullScreenIntent(pi, true)
            .build();
        n.flags |= Notification.FLAG_INSISTENT; // keep ringing until answered / cancelled
        try { NotificationManagerCompat.from(c).notify(CALL_ID, n); } catch (SecurityException ignored) { }
    }

    static void cancelCall(Context c, String key) {
        if (key != null && shownCall != null && !key.equals(shownCall)) return;
        shownCall = null;
        NotificationManagerCompat.from(c).cancel(CALL_ID);
    }

    private Notifications() { }
}
