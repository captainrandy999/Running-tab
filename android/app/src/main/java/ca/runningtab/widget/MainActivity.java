package ca.runningtab.widget;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.speech.RecognizerIntent;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Locale;

public class MainActivity extends Activity {
    public static final String EXTRA_SECTION = "section";
    public static final String EXTRA_DICTATE = "dictate";
    private static final int FILE_PICKER = 2001;
    private static final int SPEECH_PICKER = 2002;
    private static final String APP_URL = "https://captainrandy999.github.io/Running-tab/index.html";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private boolean loaded = false;
    private boolean dictateOnLoad = false;

    @Override protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().setStatusBarColor(Color.rgb(22, 59, 89));
        getWindow().setNavigationBarColor(Color.rgb(245, 248, 250));

        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(245, 248, 250));
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSafeBrowsingEnabled(true);
        web.addJavascriptInterface(new BrowserBridge(), "RunningTabAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (!request.isForMainFrame()) return false;
                Uri url = request.getUrl();
                if (isTrusted(url)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, url)); }
                catch (Exception ex) { Toast.makeText(MainActivity.this, "Cannot open link.", Toast.LENGTH_SHORT).show(); }
                return true;
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!isTrusted(Uri.parse(url))) return;
                loaded = true;
                injectBridge();
                if (dictateOnLoad) {
                    dictateOnLoad = false;
                    web.postDelayed(MainActivity.this::startDictation, 400);
                }
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onShowFileChooser(WebView view,
                    ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                pick.setType("*/*");
                pick.addCategory(Intent.CATEGORY_OPENABLE);
                try { startActivityForResult(pick, FILE_PICKER); }
                catch (Exception ex) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    Toast.makeText(MainActivity.this, "No file picker available.", Toast.LENGTH_LONG).show();
                }
                return true;
            }
        });

        handleLaunchIntent(getIntent(), false);
        String section = getSection(getIntent());
        web.loadUrl(APP_URL + ("money".equals(section) ? "" : "#" + section));

        if (!getPreferences(MODE_PRIVATE).getBoolean("intro_seen", false)) {
            getPreferences(MODE_PRIVATE).edit().putBoolean("intro_seen", true).apply();
            new AlertDialog.Builder(this)
                .setTitle("Welcome to Running Tab")
                .setMessage("To bring over your current entries, open the old Running Tab in Chrome, choose Data & backup → Download backup. Then open Data & backup → Restore backup here and select that file. After importing, this Android version keeps the home-screen widget updated.")
                .setPositiveButton("Got it", (dialog, which) -> {})
                .show();
        }
    }

    private boolean isTrusted(Uri url) {
        return url != null && "https".equalsIgnoreCase(url.getScheme())
                && "captainrandy999.github.io".equalsIgnoreCase(url.getHost())
                && url.getPath() != null && url.getPath().startsWith("/Running-tab/");
    }

    private String getSection(Intent i) {
        String tab = i == null ? null : i.getStringExtra(EXTRA_SECTION);
        return "todo".equals(tab) || "shopping".equals(tab) ? tab : "money";
    }

    private void handleLaunchIntent(Intent i, boolean existingPage) {
        if (i == null) return;
        if (i.getBooleanExtra(EXTRA_DICTATE, false)) {
            if (existingPage && loaded) startDictation();
            else dictateOnLoad = true;
        }
        if (existingPage && loaded) {
            String section = getSection(i);
            web.evaluateJavascript("window.RunningTabView?.show(" + JSONObject.quote(section) + ");", null);
        }
    }

    @Override protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleLaunchIntent(intent, true);
    }

    @Override protected void onResume() {
        super.onResume();
        if (loaded && web != null) web.evaluateJavascript("window.__rtWidgetSnapshot?.();", null);
    }

    private final class BrowserBridge {
        @JavascriptInterface public void snapshot(String money, String todo, String shopping) {
            runOnUiThread(() -> SnapshotStore.save(MainActivity.this, money, todo, shopping));
        }
        @JavascriptInterface public void dictate() {
            runOnUiThread(MainActivity.this::startDictation);
        }
    }

    private void injectBridge() {
        // Running Tab stays a regular, updatable GitHub Pages app in this WebView.
        // Only the three existing storage keys are read; no account or server is added.
        String script = """
            (function(){
             if (!window.RunningTabAndroid || window.__rtBridgeReady) {
               window.__rtWidgetSnapshot?.(); return;
             }
             window.__rtBridgeReady=true;
             const keys=['running-tab-simple-v1','running-tab-todo-v1','running-tab-shopping-v1'];
             const sync=()=>{
               try {
                 window.RunningTabAndroid.snapshot(
                   localStorage.getItem(keys[0])||'[]',
                   localStorage.getItem(keys[1])||'[]',
                   localStorage.getItem(keys[2])||'[]');
               } catch(e){}
             };
             window.__rtWidgetSnapshot=sync;
             const set=Storage.prototype.setItem;
             Storage.prototype.setItem=function(k,v){
               const result=set.call(this,k,v);
               if(keys.includes(k))queueMicrotask(sync);
               return result;
             };
             const remove=Storage.prototype.removeItem;
             Storage.prototype.removeItem=function(k){
               const result=remove.call(this,k);
               if(keys.includes(k))queueMicrotask(sync);
               return result;
             };
             window.addEventListener('runningtab:todo-changed',sync);
             window.addEventListener('runningtab:shopping-changed',sync);
             window.addEventListener('pageshow',sync);
             document.addEventListener('visibilitychange',()=>{
               if(!document.hidden)sync();
             });
             setInterval(sync,5000);
             const mic=document.getElementById('mic');
             if(mic){
               mic.disabled=false;
               mic.textContent='🎤 Dictate';
               const status=document.getElementById('micStatus');
               if(status)status.textContent='';
               mic.addEventListener('click',function(e){
                 e.preventDefault();
                 e.stopImmediatePropagation();
                 window.RunningTabAndroid.dictate();
               },true);
             }
             sync();
            })();
            """;
        web.evaluateJavascript(script, null);
    }

    private void startDictation() {
        try {
            Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
            intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, "en-CA");
            intent.putExtra(RecognizerIntent.EXTRA_PROMPT, "Tell Running Tab");
            intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
            startActivityForResult(intent, SPEECH_PICKER);
        } catch (ActivityNotFoundException ex) {
            Toast.makeText(this, "No speech recognizer found. Use your Samsung keyboard microphone.", Toast.LENGTH_LONG).show();
        }
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent result) {
        super.onActivityResult(requestCode, resultCode, result);
        if (requestCode == FILE_PICKER) {
            if (fileCallback != null) {
                Uri[] picked = resultCode == RESULT_OK && result != null && result.getData() != null
                        ? new Uri[]{result.getData()} : null;
                fileCallback.onReceiveValue(picked);
                fileCallback = null;
            }
        } else if (requestCode == SPEECH_PICKER && resultCode == RESULT_OK && result != null) {
            ArrayList<String> words = result.getStringArrayListExtra(RecognizerIntent.EXTRA_RESULTS);
            if (words != null && !words.isEmpty() && web != null) {
                String safe = JSONObject.quote(words.get(0));
                web.evaluateJavascript(
                        "window.RunningTabFlow?.acceptDictation(" + safe + ");", null);
            }
        }
    }

    @Override public void onBackPressed() {
        if (web != null && web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override protected void onDestroy() {
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (web != null) {
            web.removeJavascriptInterface("RunningTabAndroid");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
