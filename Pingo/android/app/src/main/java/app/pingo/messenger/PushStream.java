package app.pingo.messenger;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONObject;

/**
 * Instant notifications without a push server: the foreground service keeps one streaming (Server-Sent Events)
 * connection to the Realtime Database node /dmly/notify/{uid}. Senders write one small entry per message/call
 * there (src/lib/pushPing.ts). Each entry id is shown at most once (ids are remembered on disk), then deleted.
 * Runs on its own thread, independent of the WebView, so it keeps working with the screen off.
 */
final class PushStream implements Runnable {
    private static final String TAG = "PingoPush";
    static final String PREFS = "pingo_push";
    private static PushStream current;

    private final Context ctx;
    private final SharedPreferences sp;
    private volatile boolean stopped = false;
    private volatile HttpURLConnection conn;
    private final ExecutorService io = Executors.newSingleThreadExecutor();
    private String idToken = null;
    private long idTokenExp = 0;

    private PushStream(Context c) { ctx = c.getApplicationContext(); sp = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE); }

    static synchronized void start(Context c) {
        if (current != null) return;
        SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
        if (sp.getString("uid", "").isEmpty()) return;
        current = new PushStream(c);
        Thread t = new Thread(current, "pingo-push");
        t.setDaemon(true);
        t.start();
    }
    static synchronized void stop() { if (current != null) { current.stopped = true; HttpURLConnection h = current.conn; if (h != null) h.disconnect(); current.io.shutdownNow(); current = null; } }
    /** New credentials: restart the stream. */
    static void restart(Context c) { stop(); start(c); }

    @Override public void run() {
        long backoff = 1000;
        while (!stopped) {
            try {
                ensureToken(false);
                listen();
                backoff = 1000;
            } catch (Exception e) {
                Log.w(TAG, "stream: " + e);
                if (stopped) break;
                try { Thread.sleep(backoff); } catch (InterruptedException ie) { break; }
                backoff = Math.min(backoff * 2, 15000);
            }
        }
    }

    private String db() { String u = sp.getString("dbUrl", ""); return u.endsWith("/") ? u.substring(0, u.length() - 1) : u; }
    private String uid() { return sp.getString("uid", ""); }

    private synchronized void ensureToken(boolean force) throws Exception {
        if (!force && idToken != null && System.currentTimeMillis() < idTokenExp - 120_000) return;
        URL u = new URL("https://securetoken.googleapis.com/v1/token?key=" + URLEncoder.encode(sp.getString("apiKey", ""), "UTF-8"));
        HttpURLConnection h = (HttpURLConnection) u.openConnection();
        h.setConnectTimeout(15000); h.setReadTimeout(15000);
        h.setRequestMethod("POST"); h.setDoOutput(true);
        h.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        byte[] body = ("grant_type=refresh_token&refresh_token=" + URLEncoder.encode(sp.getString("refreshToken", ""), "UTF-8")).getBytes(StandardCharsets.UTF_8);
        try (OutputStream os = h.getOutputStream()) { os.write(body); }
        int code = h.getResponseCode();
        if (code != 200) { h.disconnect(); throw new Exception("token refresh " + code); }
        JSONObject j = new JSONObject(readAll(h));
        idToken = j.getString("id_token");
        idTokenExp = System.currentTimeMillis() + j.optLong("expires_in", 3600) * 1000;
        String rt = j.optString("refresh_token", "");
        if (!rt.isEmpty()) sp.edit().putString("refreshToken", rt).apply();
    }

    private void listen() throws Exception {
        URL u = new URL(db() + "/dmly/notify/" + uid() + ".json?auth=" + idToken);
        HttpURLConnection h = (HttpURLConnection) u.openConnection();
        conn = h;
        h.setConnectTimeout(15000);
        h.setReadTimeout(75000); // RTDB sends keep-alive every ~30 s
        h.setRequestProperty("Accept", "text/event-stream");
        h.setInstanceFollowRedirects(true);
        if (h.getResponseCode() != 200) { int c = h.getResponseCode(); h.disconnect(); if (c == 401) ensureToken(true); throw new Exception("stream http " + c); }
        try (BufferedReader r = new BufferedReader(new InputStreamReader(h.getInputStream(), StandardCharsets.UTF_8))) {
            String event = null; StringBuilder data = new StringBuilder(); String line;
            while (!stopped && (line = r.readLine()) != null) {
                if (line.startsWith("event:")) event = line.substring(6).trim();
                else if (line.startsWith("data:")) data.append(line.substring(5).trim());
                else if (line.isEmpty()) {
                    if (event != null) {
                        if (event.equals("auth_revoked")) { ensureToken(true); return; }
                        if (event.equals("cancel")) { ensureToken(true); throw new Exception("cancelled"); }
                        if ((event.equals("put") || event.equals("patch")) && data.length() > 0) onData(new JSONObject(data.toString()));
                        // token about to expire: reconnect with a fresh one
                        if (System.currentTimeMillis() > idTokenExp - 120_000) { ensureToken(true); return; }
                    }
                    event = null; data.setLength(0);
                }
            }
        } finally { h.disconnect(); conn = null; }
    }

    private void onData(JSONObject msg) throws Exception {
        String path = msg.optString("path", "/");
        Object d = msg.opt("data");
        if (path.equals("/")) {
            if (!(d instanceof JSONObject)) return;
            JSONObject all = (JSONObject) d;
            for (Iterator<String> it = all.keys(); it.hasNext(); ) { String id = it.next(); Object e = all.opt(id); if (e instanceof JSONObject) handle(id, (JSONObject) e); }
        } else {
            String[] parts = path.substring(1).split("/");
            if (parts.length == 1 && d instanceof JSONObject) handle(parts[0], (JSONObject) d);
        }
    }

    private void handle(String id, JSONObject e) {
        boolean fresh = markSeen(id);
        deleteLater(id);
        if (!fresh) return;
        String from = e.optString("from", "");
        if (from.equals(uid()) || blocked().contains(from)) return;
        long at = e.optLong("at", 0);
        boolean recent = at == 0 || System.currentTimeMillis() - at < 10 * 60_000;
        String kind = e.optString("kind", "msg");
        String chatId = e.optString("chatId", "");
        boolean fg = PingoNativePlugin.foreground;
        Log.i(TAG, "ping " + kind + " " + id + " fg=" + fg + " age=" + (System.currentTimeMillis() - at) + "ms");
        if (kind.equals("call-end")) { Notifications.cancelCall(ctx, id.replaceAll("-end$", "")); return; }
        if (fg || !recent) return; // in the foreground the app itself rings / dings
        if (kind.equals("msg")) {
            Notifications.postMessage(ctx, Notifications.chatNotifId(chatId), e.optString("title", "Pingo"), e.optString("body", ""), "/chat/" + chatId);
        } else if (kind.equals("call") && System.currentTimeMillis() - at < 45_000) {
            boolean ko = ctx.getResources().getConfiguration().getLocales().get(0).getLanguage().equals("ko");
            String name = e.optString("title", "Pingo");
            boolean video = e.optBoolean("video", false);
            String title = ko ? (video ? "📹 " + name + "님의 영상 통화…" : "📞 " + name + "님의 전화…") : (video ? "📹 " + name + " is video calling…" : "📞 " + name + " is calling…");
            Notifications.postCall(ctx, id, title, ko ? "눌러서 Pingo에서 받기" : "Tap to answer in Pingo", "/chat/" + chatId);
        }
    }

    private Set<String> blocked() { return new HashSet<>(Arrays.asList(sp.getString("blocked", "").split(","))); }

    /** Remembers the last 400 ids on disk; returns false if this id was already handled. */
    private synchronized boolean markSeen(String id) {
        LinkedHashSet<String> seen = new LinkedHashSet<>(Arrays.asList(sp.getString("seen", "").split("\n")));
        if (seen.contains(id)) return false;
        seen.add(id);
        List<String> l = new ArrayList<>(seen);
        if (l.size() > 400) l = l.subList(l.size() - 400, l.size());
        sp.edit().putString("seen", String.join("\n", l)).apply();
        return true;
    }

    private void deleteLater(String id) {
        try {
            io.execute(() -> {
                try {
                    URL u = new URL(db() + "/dmly/notify/" + uid() + "/" + id + ".json?auth=" + idToken);
                    HttpURLConnection h = (HttpURLConnection) u.openConnection();
                    h.setConnectTimeout(10000); h.setReadTimeout(10000); h.setRequestMethod("DELETE");
                    h.getResponseCode(); h.disconnect();
                } catch (Exception ignored) { }
            });
        } catch (Exception ignored) { }
    }

    private static String readAll(HttpURLConnection h) throws Exception {
        StringBuilder b = new StringBuilder();
        try (BufferedReader r = new BufferedReader(new InputStreamReader(h.getInputStream(), StandardCharsets.UTF_8))) { String l; while ((l = r.readLine()) != null) b.append(l); }
        h.disconnect();
        return b.toString();
    }
}
