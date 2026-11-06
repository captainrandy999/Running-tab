# Running Tab

An Android-installable web app for **Money**, **To-Do**, and **Shopping**.

[Open Running Tab](https://captainrandy999.github.io/Running-tab/)

## One box, three lists

The header and entry box stay at the top of the page while the three independent lists slide horizontally below. Tap Money, To-Do, or Shopping in the bottom navigation, or swipe sideways over the list.

A small **“💡 How to say it”** disclosure beneath the main entry box shows examples when you need a reminder; it stays collapsed otherwise.

Tap **🎤 Dictate**, use the Samsung keyboard microphone, or type an entry. Then tap **Review** before **Confirm & Save**.

| Spoken entry | Saved in |
| --- | --- |
| “Cody owes me $250 for materials” | Money |
| “I owe Atlas $100 for supplies” | Money |
| “Remind me to call Cody by Saturday” | To-Do |
| “I need to renew insurance by June” | To-Do, June 1 |
| “Remind me to submit receipts by the end of June” | To-Do, June 30 |
| “I need to buy milk and eggs and bread” | Shopping: three separate items |
| “Add bread and coffee to my shopping list” | Shopping: two separate items |

Shopping items can be checked off individually and deleted or restored to the active list; completed items can be cleared together. Shopping has no deadlines; use To-Do for dated tasks.

## Installation

Open the app link in Chrome for Android. Choose **Install app**, or Chrome's **⋮ → Add to Home screen → Install app**. You can launch the app from its phone home-screen icon.

The web interface is cached for offline use, but voice transcription may need connectivity.

## Privacy and local backup

Money uses local storage key `running-tab-simple-v1`, To-Do uses `running-tab-todo-v1`, and Shopping uses `running-tab-shopping-v1`. This preserves the existing Money and To-Do data and keeps all three categories separate. Entries stay in the browser's site storage on this phone, not GitHub. Browser dictation may use an online speech service.

Expand **Data & backup** to export a single JSON file containing all three lists. Restoring a current backup replaces all three lists after confirmation. Older v1 backups are still accepted: they replace Money and To-Do while leaving the current Shopping list untouched.

Reminders are checklists, not scheduled Android notifications. Clearing browser site data may erase local records, so download backups if you start relying on the app.

## Relative reminder dates and calendar

You can dictate **“Add a reminder tomorrow”**, **“Remind me to call Cody in 7 days”**, **“Remind me to renew insurance a week from now”**, or **“Remind me to return equipment for 7 days”**. The app calculates the calendar date on your phone and asks you to review it before saving. A generic request such as “Add a reminder tomorrow” creates an editable reminder titled “Reminder”.

In the To-Do review, tap the **calendar date button** to open a month grid. Tap a numbered day directly or navigate months with the arrows. The same popup includes **No deadline** and **Whole month** alternatives. No stacked deadline dropdowns are needed.

## Android home-screen widget (preview)

A native Android wrapper and **read-only, scrollable home-screen widget** are included under [android/](android/). The widget has Money, To-Do and Shopping tabs, shows full names and amounts, and opens the full app for entry editing. Tapping **🎤 Dictate** opens Android speech recognition in the app.

- [Download the preview APK](https://github.com/captainrandy999/Running-tab/releases/download/widget-preview/running-tab-widget.apk).
- [Build details and Android setup](android/README.md).
- [Latest build status](https://github.com/captainrandy999/Running-tab/actions/workflows/android-widget.yml).

**Important:** The existing Chrome PWA and native Android app use separate browser storage. Export a backup from the old web app and restore it in the new Android app once. Afterward, use the new native app for edits so its widget automatically reflects changes.

## Dictated notes

Say `take a note that …`, `make a note that …`, or `note …`. Running Tab recognizes a Note instead of a reminder, suggests a short topic from the dictated content, then opens the existing editable review. Only **Confirm & save note** saves the entry. In To-Do, a note uses the same completion checkbox as a reminder, and its topic expands to show the full note. An optional date can be chosen. Notes share the existing To-Do storage and backup, keeping older records intact.

## Task completion, deletion and named-note dictation

Active To-Do entries and notes **do not show Delete**. Check the checkbox to move an entry into the collapsible **Completed** section; only there can it be deleted, or unchecked to restore it to active.

In addition to the automatic note-topic command, say **“make a note called Roof Inspection that the shingles need replacing”** or **“record a note called Supplies, buy more 2x4 lumber.”** The specified name becomes the note title and the remaining words go into its body. Named notes still open the editable Review screen and require manual confirmation before saving.

## Edit saved note bodies and voice reminders with upfront dates

Expand a saved To-Do Note, tap **Edit note**, update the full body, then **Save changes** (or **Cancel**). This works for active and completed notes. Editing preserves the title, due date, and completion checkbox. Changes sync to the widget and existing JSON backups.

The date parser supports both **“Remind me in 3 days that I need to check the invoice”** and speech recognition's shortened **“In 3 days that I need to check the invoice”**, plus prior date styles. The editable Review step remains mandatory.

## Web-only Google account login (staged, not yet active)

The browser version has a **Google Identity Services OAuth login gate** prepared in `web-auth.js`. Its public client ID goes in `web-auth-config.js`. The gate remains **disabled** while the ID is empty, so users won't be locked out of any existing local records during setup. The native Android WebView is intentionally unchanged and does not attempt unsupported Google sign-in inside the WebView.

**Configuration:**
1. Create/select a Google Cloud project in [Google Auth Platform](https://console.cloud.google.com/auth/overview), select **External / Testing**, and add the intended Google account as an authorized **Test user** (Google enforces the test-user allowance).
2. Enable **Google Drive API**.
3. Create an OAuth **Web application** client with **Authorized JavaScript origin** exactly `https://captainrandy999.github.io` (no `/Running-tab` path).
4. Put **only the public client ID** in `web-auth-config.js`; do not put an OAuth client secret, password, token, or API key in this public repository.
5. After deployment, verify Google login and offline access on a test browser before relying on it.

The browser requests scopes `openid email https://www.googleapis.com/auth/drive.appdata`; Google returns a short-lived access token. The app calls Google's authenticated userinfo endpoint to verify the selected Google account before unlocking the browser interface and associates that browser's local data with that account's Google subject ID. Google tokens are **memory only**; they are not persisted in local storage.

After an online login, a locally saved trusted-device marker allows that same browser to reopen existing local data offline for 30 days. A sign-out removes that marker but not the records themselves. This trusted-device marker is a **convenience feature, not strong local-device encryption**: do not use it on a shared or untrusted computer.

**Limitations:** The GitHub Pages source is public, so this gate cannot make the site's source code or locally cached storage private against somebody with browser/device access. Real Drive data privacy will rely on Google's user OAuth authorization and appDataFolder permissions. Google Cloud Testing limits authorization to configured test users. Cloud synchronization is a separate implementation step; signing in alone does NOT synchronize the entries, and the Android app still needs a separate supported account-flow for synchronization. Access tokens expire and reconnecting will require Google interaction without a backend.

## Google OAuth login activated (web-only)

The Web OAuth 2.0 client ID in `web-auth-config.js` is for Google Cloud's Running Tab Web client. The client ID is public; no secret is stored in this repository. The browser version now prompts for Google login; access requires a Google account authorized by the project's OAuth consent configuration (test users while in Testing). The native Android WebView does not use this web login and continues to access local records.

**Google Cloud setup:** In Google Auth Platform → Audience, keep External/Testing and add the intended account under Test users. In Google Auth Platform → Clients → Running Tab Web, ensure Authorized JavaScript origins includes `https://captainrandy999.github.io`. Enable Google Drive API to authorize the `drive.appdata` scope. The consent flow may ask for approval.

**Important:** Google Drive data synchronization is NOT implemented yet. This change gates the browser interface and grants a short-lived token for future Drive operations, but all existing entries still live on each device. An approved account on a different device won't see those entries until the synchronization layer is added. Local trusted offline access is permitted for 30 days after a successful login. Sign out removes the trusted offline marker, but not local data.

## Add details to an existing To-Do

Tap any To-Do's title to expand it, choose **Add note** (or **Edit note**), type the details, and **Save changes**. The original task title remains the subject and the record stays a normal To-Do with its existing due date and completion state; no separate note record is created. Existing stand-alone Notes can still be edited. Both active and completed items support attached details, and Delete remains only in Completed.

## Google Drive synchronization (browser/PWA only, offline-first)

Once the Google Cloud Drive API is enabled and Google has authorized the `drive.appdata` scope, the browser version synchronizes Money, To-Dos, Notes and Shopping using `running-tab-cloud-v1.json` in its private Google Drive `appDataFolder`. The Drive app-data folder isn't visible in the normal Google Drive UI. A **Sync now** button and status display connection, offline state and sync errors.

The app still **saves every change locally first**. When signed in, opened, or reconnected, it downloads the Drive file, uses a **three-way per-ID merge** against its last successful synchronized state, and uploads changes. This preserves local offline edits, remote additions and known deletions. When the same entry has incompatible changes on two devices, sync stops and keeps both copies as they are; make manual JSON backups and resolve the conflict before continuing. Version checks reduce risk of overwriting simultaneous modifications, but this is designed for one device at a time, not concurrent multi-user updates.

**Rollout limitation:** Google Drive sync currently works in Google-authenticated **browser/PWA** Running Tab. The separate Android APK bypasses browser Google sign-in and still uses its own local data until we add a supported native Android OAuth flow. Existing APK entries are not silently uploaded or replaced; use the Chrome browser on the phone/tablet and your PC to test cross-device sync safely. Retain JSON backups.

If opened offline after an authorized online visit, browser/PWA data remains accessible; changes wait locally and synchronize after connectivity and Google authorization return. Google tokens remain in memory and are never stored persistently.

## Android APK native Google Drive sync (v1.6, requires Android OAuth client registration)

The existing `web-drive-sync.js` now runs inside **both the browser and the new Android APK**, using exactly the same `running-tab-cloud-v1.json` file in Google Drive `appDataFolder`. The native app gets a Google OAuth access token via Google Play Services `AuthorizationClient`, **not** via Google sign-in embedded in the WebView. `web-auth.js` verifies the token against Google's HTTPS userinfo endpoint before unlocking sync. Browser sign-in and public GitHub Pages remain unchanged.

**Google Cloud Console setup required:** In the same Google Cloud project used for the web OAuth client, create another OAuth client of type **Android**, with package name `ca.runningtab.widget` and the **SHA-1 signing fingerprint of the installed APK**. Retrieve the SHA-1 from the project's GitHub Actions signing-verification log; it is printed as `ANDROID_OAUTH_SHA1=...`. The project's existing Android signing certificate is SHA-256 pinned to prevent accidental signing-key rotation. Do NOT use a different debug.keystore's fingerprint. No Android OAuth client ID needs to be embedded in the app source, and no secret is stored in GitHub.

After Android OAuth registration, install the new APK **over the existing installation** (do not uninstall or delete local data). Open it while online, tap **Connect Google**, grant the same Google account access to its Drive app data, then wait for **Synced with Google Drive**. The APK uses the same three-way per-entry merge used by the working browser sync; existing local APK entries and remote web entries are merged by ID. Google may need time to propagate the newly added Android OAuth credential. Every change still saves locally first, and offline changes wait for reconnection. Native widget snapshots remain based on local saved lists.

The access token is held only in process memory. Google Play Services may silently return an authorized token on later app opens; if consent is needed, tap Connect Google. Disconnect revokes Android app access and stops syncing, without deleting local entries or Drive backups. For safety, take a JSON backup before the first cross-device merge. The Google Cloud OAuth Testing policy may periodically require reconnection.

**Deployment/testing:** A successful GitHub Actions APK build proves the source compiles. The actual Android Google consent screen and API connectivity must still be tested on the user's Samsung after registering the Android OAuth client.

## Cloud To-Do refresh fix

The Drive JSON field is `todos`, but the To-Do UI and Android widget listen to `runningtab:todo-changed` (singular). Previously the sync engine fired `runningtab:todos-changed` after applying downloaded entries. As a result, downloaded reminders could be saved on the device without immediately appearing in the To-Do interface. The shared sync engine now fires the correct event without changing stored records, Google Drive data, the APK signing identity, or the v1.5 rollback.
