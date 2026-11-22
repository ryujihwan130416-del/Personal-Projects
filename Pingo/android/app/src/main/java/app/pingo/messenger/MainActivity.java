package app.pingo.messenger;

import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    static final String EXTRA_URL = "pingo_url";
    static final String EXTRA_CALL = "pingo_call";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PingoNativePlugin.class);
        super.onCreate(savedInstanceState);
        handleCallIntent(getIntent());
        // Keep the WebView renderer at high priority so JS listeners keep running in the background.
        WebView wv = getBridge() != null ? getBridge().getWebView() : null;
        if (wv != null) {
            wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
            if (Build.VERSION.SDK_INT >= 26) wv.setRendererPriorityPolicy(WebView.RENDERER_PRIORITY_IMPORTANT, false);
        }
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleCallIntent(intent);
    }

    private void handleCallIntent(Intent i) {
        if (i != null && i.getBooleanExtra(EXTRA_CALL, false)) setCallMode(true);
    }

    /** Incoming call: show over the lock screen and turn the screen on. */
    void setCallMode(boolean on) {
        if (Build.VERSION.SDK_INT >= 27) { setShowWhenLocked(on); setTurnScreenOn(on); }
        else if (on) getWindow().addFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED | WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON);
    }
}
