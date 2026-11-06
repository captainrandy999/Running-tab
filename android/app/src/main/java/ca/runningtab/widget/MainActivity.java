package ca.runningtab.widget;

import android.app.Activity;
import android.content.IntentSender;
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
import com.google.android.gms.auth.api.identity.AuthorizationRequest;
import com.google.android.gms.auth.api.identity.AuthorizationResult;
import com.google.android.gms.auth.api.identity.Identity;
import com.google.android.gms.auth.api.identity.RevokeAccessRequest;
import com.google.android.gms.common.api.Scope;
import com.google.android.gms.common.api.ApiException;
import java.util.Arrays;
import java.util.List;
import android.widget.Toast;
import org.json.JSONObject;
import java.util.ArrayList;
import java.util.Locale;
import java.io.OutputStream;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {
    public static final String EXTRA_SECTION = "section";
    public static final String EXTRA_DICTATE = "dictate";
    private static final int FILE_PICKER = 2001;
    private static final int SPEECH_PICKER = 2002;
    private static final int BACKUP_PICKER = 2003;
    private static final int RESTORE_PICKER = 2004;
    private static final int GOOGLE_AUTH_PICKER = 2005;
    private static final String GOOGLE_AUTH_PREF = "google_drive_connected";
    private static final List<Scope> GOOGLE_SCOPES = Arrays.asList(
        new Scope("openid"), new Scope("email"),
        new Scope("https://www.googleapis.com/auth/drive.appdata")
    );
    private static final int MAX_BACKUP_BYTES = 15000000;
    private static final String APP_URL = "https://captainrandy999.github.io/Running-tab/index.html";

    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private boolean loaded = false;
    private boolean dictateOnLoad = false;
    private boolean googleAuthBusy = false;
    private boolean googleConsentPending = false;
    private String backupToSave = null;
    private String backupName = null;

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
                if (getPreferences(MODE_PRIVATE).getBoolean(GOOGLE_AUTH_PREF, false)) {
                    web.postDelayed(() -> authorizeGoogle(false), 350);
                }
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
        if (loaded && web != null) {
            web.evaluateJavascript("window.__rtWidgetSnapshot?.();", null);
            if (getPreferences(MODE_PRIVATE).getBoolean(GOOGLE_AUTH_PREF, false))
                web.postDelayed(() -> authorizeGoogle(false), 400);
        }
    }

    private final class BrowserBridge {
        @JavascriptInterface public void snapshot(String money, String todo, String shopping) {
            runOnUiThread(() -> SnapshotStore.save(MainActivity.this, money, todo, shopping));
        }
        @JavascriptInterface public void dictate() {
            runOnUiThread(MainActivity.this::startDictation);
        }
        @JavascriptInterface public void exportBackup(String json, String filename) {
            runOnUiThread(() -> beginBackupExport(json, filename));
        }
        @JavascriptInterface public void importBackup() {
            runOnUiThread(MainActivity.this::beginBackupImport);
        }
        @JavascriptInterface public void connectGoogle() {
            runOnUiThread(() -> authorizeGoogle(true));
        }
        @JavascriptInterface public void refreshGoogle() {
            runOnUiThread(() -> authorizeGoogle(false));
        }
        @JavascriptInterface public void disconnectGoogle() {
            runOnUiThread(MainActivity.this::disconnectGoogle);
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
               window.RunningTabFlow?.updateNextAction();
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

    // Android WebView cannot reliably download blob: URLs. Instead use Android's
    // document picker so the user chooses a file location and the app writes JSON.
    private void beginBackupExport(String json, String filename) {
        if (backupToSave != null) {
            notifyBackup(false, "A backup save is already in progress.");
            return;
        }
        if (json == null || json.isEmpty() || json.length() > 15000000) {
            notifyBackup(false, "Backup is empty or too large.");
            return;
        }
        try {
            JSONObject parsed = new JSONObject(json);
            if (!"running-tab-backup".equals(parsed.optString("format"))) {
                notifyBackup(false, "Invalid Running Tab backup format.");
                return;
            }
            backupToSave = json;
            String cleanName = filename == null ? "running-tab-backup.json"
                    : filename.replaceAll("[^A-Za-z0-9._-]", "_");
            backupName = cleanName.endsWith(".json") ? cleanName : cleanName + ".json";
            Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("application/json");
            intent.putExtra(Intent.EXTRA_TITLE, backupName);
            startActivityForResult(intent, BACKUP_PICKER);
        } catch (Exception ex) {
            backupToSave = null;
            backupName = null;
            notifyBackup(false, "Could not open the Android Save As picker.");
        }
    }

    private void finishBackupExport(int resultCode, Intent data) {
        String payload = backupToSave;
        String name = backupName;
        backupToSave = null;
        backupName = null;
        if (payload == null) return;
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            notifyBackup(false, "Save cancelled. No backup file was created.");
            return;
        }
        Uri uri = data.getData();
        try {
            byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
            try (OutputStream output = getContentResolver().openOutputStream(uri, "wt")) {
                if (output == null) throw new IllegalStateException("No output stream available");
                output.write(bytes);
                output.flush();
            }
            notifyBackup(true, name == null ? "JSON backup file" : name);
        } catch (Exception ex) {
            notifyBackup(false, "Android couldn't write the selected file: " + ex.getMessage());
        }
    }

    private void notifyBackup(boolean success, String message) {
        if (web != null) {
            web.evaluateJavascript(
                    "window.RunningTabBackup?.onNativeExportResult("
                    + success + "," + JSONObject.quote(message) + ");", null);
        }
        Toast.makeText(this, success ? "Backup saved to selected folder." : message,
                Toast.LENGTH_LONG).show();
    }

    // Read the chosen JSON with Android's Storage Access Framework. This avoids
    // WebView's file-input/provider restrictions and needs no broad storage access.
    private void beginBackupImport() {
        try {
            Intent pick = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            pick.addCategory(Intent.CATEGORY_OPENABLE);
            // Samsung and Drive providers may report JSON as application/octet-stream.
            pick.setType("*/*");
            startActivityForResult(pick, RESTORE_PICKER);
        } catch (Exception ex) {
            notifyImportError("Could not open the Android document picker.");
        }
    }

    private void finishBackupImport(int resultCode, Intent data) {
        if (resultCode != RESULT_OK || data == null || data.getData() == null) {
            notifyImportError("File selection cancelled; no entries changed.");
            return;
        }
        final Uri uri = data.getData();
        // Cloud-provider reads can be slow; never block the main Android UI thread.
        new Thread(() -> {
            try (InputStream stream = getContentResolver().openInputStream(uri);
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                if (stream == null) throw new IllegalStateException("Cannot open selected file.");
                byte[] buffer = new byte[8192];
                int n;
                while ((n = stream.read(buffer)) != -1) {
                    if (output.size() + n > MAX_BACKUP_BYTES)
                        throw new IllegalArgumentException("File is too large (15 MB maximum).");
                    output.write(buffer, 0, n);
                }
                byte[] bytes = output.toByteArray();
                if (bytes.length >= 2 && bytes[0] == 0x50 && bytes[1] == 0x4b)
                    throw new IllegalArgumentException("That's an APK or ZIP, not a Running Tab JSON backup.");
                String json = new String(bytes, StandardCharsets.UTF_8);
                if (!json.isEmpty() && json.charAt(0) == '\uFEFF') json = json.substring(1);
                JSONObject parsed;
                try { parsed = new JSONObject(json); }
                catch (Exception e) { throw new IllegalArgumentException("The selected file is not valid JSON."); }
                if (!"running-tab-backup".equals(parsed.optString("format")))
                    throw new IllegalArgumentException("This file isn't a Running Tab data backup.");
                final String contents = json;
                runOnUiThread(() -> sendImportToWeb(contents, 0, true));
            } catch (Exception ex) {
                String error = ex.getMessage() == null ? "Cannot read the selected backup." : ex.getMessage();
                runOnUiThread(() -> notifyImportError(error));
            }
        }, "RunningTabRestore").start();
    }

    private void sendImportToWeb(String json, int offset, boolean begin) {
        if (web == null) return;
        if (begin) {
            web.evaluateJavascript("window.RunningTabBackup?.onNativeImportBegin();",
                    ignored -> sendImportToWeb(json, offset, false));
            return;
        }
        if (offset >= json.length()) {
            web.evaluateJavascript("window.RunningTabBackup?.onNativeImportEnd();", null);
            return;
        }
        // Bridge the data in ordered, acknowledged chunks to avoid WebView's
        // JavaScript/IPC payload limits for lengthy notes and many entries.
        int end = Math.min(offset + 16384, json.length());
        String js = "window.RunningTabBackup?.onNativeImportChunk("
                + JSONObject.quote(json.substring(offset, end)) + ");";
        web.evaluateJavascript(js, ignored -> sendImportToWeb(json, end, false));
    }

    private void notifyImportError(String message) {
        if (web != null) {
            web.evaluateJavascript("window.RunningTabBackup?.onNativeImportError("
                    + JSONObject.quote(message) + ");", null);
        }
        Toast.makeText(this, "Restore failed: " + message, Toast.LENGTH_LONG).show();
    }

    // Native account selection, authorization, and consent happen in Play
    // Services, outside the embedded browser. No token is stored on disk.
    private void authorizeGoogle(boolean userInitiated) {
        if (web == null || !loaded || !isTrusted(Uri.parse(web.getUrl()))) return;
        if (googleAuthBusy || googleConsentPending) return;
        if (!userInitiated && !getPreferences(MODE_PRIVATE)
                .getBoolean(GOOGLE_AUTH_PREF, false)) return;
        googleAuthBusy = true;
        notifyGoogleStatus("Connecting to Google Drive…");
        try {
            AuthorizationRequest request = AuthorizationRequest.builder()
                .setRequestedScopes(GOOGLE_SCOPES)
                .build();
            Identity.getAuthorizationClient(this).authorize(request)
                .addOnSuccessListener(auth -> {
                    googleAuthBusy = false;
                    if (auth.hasResolution()) {
                        if (!userInitiated) {
                            notifyGoogleStatus("Google permission needs renewal. Tap Connect Google.");
                            return;
                        }
                        try {
                            googleConsentPending = true;
                            startIntentSenderForResult(
                                auth.getPendingIntent().getIntentSender(),
                                GOOGLE_AUTH_PICKER, null, 0, 0, 0);
                        } catch (IntentSender.SendIntentException e) {
                            googleConsentPending = false;
                            notifyGoogleStatus("Could not open Google consent. Try again.");
                        }
                    } else {
                        acceptGoogleAuthorization(auth);
                    }
                })
                .addOnFailureListener(error -> {
                    googleAuthBusy = false;
                    notifyGoogleStatus("Google sign-in unavailable: "
                        + (error.getMessage() == null ? "Try again online." : error.getMessage()));
                });
        } catch (Exception e) {
            googleAuthBusy = false;
            notifyGoogleStatus("Google authorization could not start: " + e.getMessage());
        }
    }

    private void acceptGoogleAuthorization(AuthorizationResult result) {
        String token = result == null ? null : result.getAccessToken();
        List<String> scopes = result == null ? null : result.getGrantedScopes();
        if (token == null || token.isEmpty() || scopes == null
                || !scopes.contains("https://www.googleapis.com/auth/drive.appdata")
                || !scopes.contains("openid")
                || !scopes.contains("email")) {
            notifyGoogleStatus("Google did not grant all needed permissions. Tap Connect Google.");
            return;
        }
        getPreferences(MODE_PRIVATE).edit().putBoolean(GOOGLE_AUTH_PREF, true).apply();
        if (web != null && isTrusted(Uri.parse(web.getUrl()))) {
            web.evaluateJavascript(
                "window.RunningTabNativeAuth?.onToken(" + JSONObject.quote(token) + ");", null);
        }
    }

    private void notifyGoogleStatus(String message) {
        if (web != null && isTrusted(Uri.parse(web.getUrl()))) {
            web.evaluateJavascript("window.RunningTabNativeAuth?.onStatus("
                    + JSONObject.quote(message) + ");", null);
        }
    }

    private void disconnectGoogle() {
        // Disconnect never erases locally saved entries or sync baselines.
        getPreferences(MODE_PRIVATE).edit().putBoolean(GOOGLE_AUTH_PREF, false).apply();
        googleAuthBusy = false;
        googleConsentPending = false;
        if (web != null && isTrusted(Uri.parse(web.getUrl()))) {
            web.evaluateJavascript(
                "window.RunningTabNativeAuth?.onDisconnected('Google disconnected; local data kept.');",
                null);
        }
        try {
            RevokeAccessRequest revoke = RevokeAccessRequest.builder()
                .setScopes(GOOGLE_SCOPES)
                .build();
            Identity.getAuthorizationClient(this).revokeAccess(revoke)
                .addOnFailureListener(error ->
                    notifyGoogleStatus("Disconnected locally. Google permission revocation may need retry."));
        } catch (Exception e) {
            notifyGoogleStatus("Disconnected locally. Google permission revocation may need retry.");
        }
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
        if (requestCode == BACKUP_PICKER) {
            finishBackupExport(resultCode, result);
        } else if (requestCode == RESTORE_PICKER) {
            finishBackupImport(resultCode, result);
        } else if (requestCode == GOOGLE_AUTH_PICKER) {
            googleConsentPending = false;
            if (resultCode == RESULT_OK && result != null) {
                try {
                    AuthorizationResult authorization =
                        Identity.getAuthorizationClient(this).getAuthorizationResultFromIntent(result);
                    acceptGoogleAuthorization(authorization);
                } catch (ApiException error) {
                    notifyGoogleStatus("Google authorization failed: " + error.getStatusCode());
                }
            } else {
                notifyGoogleStatus("Google permission not granted. Local data remains available.");
            }
        } else if (requestCode == FILE_PICKER) {
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
        backupToSave = null;
        backupName = null;
        if (fileCallback != null) { fileCallback.onReceiveValue(null); fileCallback = null; }
        if (web != null) {
            web.removeJavascriptInterface("RunningTabAndroid");
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
