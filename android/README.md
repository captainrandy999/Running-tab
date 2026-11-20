# MyDay for Android — read-only home-screen widget

This is a small native Android wrapper around the **same GitHub Pages MyDay** interface, plus a large, scrollable **read-only** home-screen widget. The widget shows Money (full names and dollar amounts), To-Do reminders and deadlines, or Shopping (unchecked items). Tab buttons switch the widget list; none of the list items can be checked off on the widget.

Tapping an item opens MyDay to its specific Money person, To-Do/Note, or Shopping item, with a brief highlight for orientation. Tapping the **🎤 microphone icon** opens MyDay and launches Android's speech recognition, placing the result in the existing entry field for review. Editing, checking off and saving still happen in the full app.

## Download / install directly on Samsung

The GitHub Actions workflow builds a **test APK** and makes it available in:
- [Preview release](https://github.com/captainrandy999/Running-tab/releases/tag/widget-preview)
- [Workflow builds](https://github.com/captainrandy999/Running-tab/actions/workflows/android-widget.yml)

When the build succeeds, tap the `myday.apk` file from the preview release on your phone, allow installation from Chrome/Files if Android prompts, and install. This is a test version signed by a GitHub Actions debug key. It's not an official Play Store release. The signing key is pinned to avoid accidental certificate rotation.

Next, press and hold a blank section of your Samsung home screen → **Widgets** → **MyDay** → add the large widget. Resize it to fit most of a home-screen page.

## Important: one-time data transfer

Your old installed Chrome PWA and this new Android WebView have **separate local storage**, so existing entries won't appear until you import them.

1. Open the *older Running Tab web app* in Chrome or via your existing shortcut.
2. Expand **Data & backup**, choose **Download backup** and save the JSON file on your phone.
3. Open the **new native MyDay app**.
4. Expand **Data & backup → Restore backup**, choose your JSON file, and confirm.
5. The widget should update with all Money, To-Do and Shopping records.

After importing, use the *new native app* for changes to keep the widget updated. Editing the old Chrome PWA will not sync automatically to the new app. Neither the widget nor the wrapper uploads your records to a server; they remain on your phone. Keep regular JSON backups.

The native app loads the latest web interface from GitHub Pages, so most interface changes can arrive without replacing the APK. The widget can show recently saved records when offline, but the web interface requires a first successful load for caching. Dictation may require internet.

## Build

Requires JDK 17, Android SDK Platform 35, Gradle 8.9 and Android Gradle Plugin 8.7.3. From `android/`, run `gradle :app:assembleDebug`. The APK is at `app/build/outputs/apk/debug/app-debug.apk`.

### Limitations

Android home-screen widgets cannot embed a live WebView. Therefore this widget is a native **summary/list representation** of the Day2Day interface, not an exact live webpage. The list is scrollable; its rows are read-only. Tap the moon icon (☾) in the widget header to enable night mode; tap the sun icon (☀) to switch back. The choice is remembered for each widget and also changes the list-row colors. Button and tab taps are deliberate. The app must open for edits, confirmation, dictation and full Money transaction details.

The preview APK is intended for personal testing, not Play Store deployment.

## Automatic speech review and suggested red action

Day2Day's built-in **Dictate** button automatically opens the translated Review form when speech recognition finishes; you then review and tap **Confirm & save**. The Android native speech popup uses the same behavior as of v1.2, including when launched from the widget.

The **next recommended button** is highlighted in red: Dictate when empty, Review for entered text, or Confirm & save once details are on screen. Typing in the text box is still supported. Samsung's separate keyboard microphone does not send a reliable "finished speaking" event to websites, so it may still require tapping Review.

## Notes in To-Do (v1.3)

Say **“take a note that…”**, **“make a note that…”**, or **“note…”** using the same Dictate control. After speech ends, Day2Day suggests a short topic and shows the **complete note** for correction. Tap **Confirm & save note** to save it. Notes appear alongside reminders in To-Do as expandable/collapsible entries with ordinary completion checkboxes. You may set an optional due date during review. The widget displays the note's heading and a short preview; tap it to open the full note in the app.

All existing reminders remain stored under the original `running-tab-todo-v1` key. Backups include notes automatically. Topic guessing is an on-device, first-phrase heuristic, so check the suggested topic before saving; it does not send dictated text to an external AI service.

## Reliable Android backup and restore (v1.4)

In the Android wrapper, **Data & backup → Download backup** now calls a native Android document picker. Choose a folder and tap Save; the app writes the real JSON file and confirms **only after the file is successfully written**. Cancelling or a failed write shows an error. The web-only version still requests a browser download and reminds you to verify the file in Downloads.

**Copy backup text** is an independent fallback available without installing an APK: copy and save the complete text somewhere safe, such as Samsung Notes. **Restore a copied backup** accepts this JSON later and validates it before asking permission to replace lists.

## Signing safety (v1.4)

The old workflow cached `~/.android/debug.keystore`, but the build logs showed **no file existed at that path at cache-save time**. Every build could therefore use a different debug signature, and Android would refuse installing the update over an earlier version.

The new workflow explicitly generates and uses `~/.android/running-tab-preview.keystore`, persists that same file via GitHub Actions cache, and verifies its certificate's SHA-256 fingerprint against `android/preview-signing.sha256`. After fingerprint pinning, **a missing cache or changed key fails the build instead of publishing a silently incompatible APK**.

This is test-build signing, not a permanent production signing setup: GitHub caches may expire or be evicted. For indefinite updates, move the private keystore into a repository Actions secret or a secure release-signing setup without publishing the private key. The cert fingerprint is public and safe to commit; **never commit the private .keystore**.

**One-time migration warning:** v1.4 intentionally uses a stable new certificate that differs from previously shipped debug-signed APKs. Android may require one final uninstall. Before doing that, use **Copy backup text** in the still-installed app, paste it into Samsung Notes, verify the note contains your JSON, and then restore it in v1.4 after installation. Future update builds will reuse this same identity or fail safely rather than rotating silently.

## Native Restore backup (v1.5)

Android's **Restore JSON backup file** button now uses `ACTION_OPEN_DOCUMENT` and reads the selected `.json` through Android's `ContentResolver`, instead of relying on the embedded WebView's file picker and `File.text()`. Backup data is validated, transferred to the web interface in ordered chunks, and shown in an explicit confirmation dialog before replacing any local entries. No broad storage permission is requested: Android's file picker grants access to the one selected file. The same JSON format remains compatible with existing backups, and the copy/paste fallback still works.

**Front-loaded deadlines:** `In 2 days, remind me to follow up with Henry about payment` now creates an editable To-Do with a due date two days from the local date. Old trailing-deadline speech examples continue to work.

## v1.6 — Android Google Drive authorization

The Android APK now uses Play Services `AuthorizationClient` to request `openid`, `email`, and `drive.appdata` scopes outside WebView. The native chooser handles approval; the short-lived token is delivered to the verified Day2Day webpage without saving it on disk. The existing Drive sync code then shares the same private Google Drive file with Chrome. Local lists and the home-screen widget continue working without internet.

Before using Connect Google, create an OAuth client of type **Android** in the existing Google Cloud project. The package is `ca.runningtab.widget`; obtain the required **SHA-1 fingerprint** from the GitHub Actions Android build log marked `ANDROID_OAUTH_SHA1`. This SHA-1 corresponds to the pinned Android signer, not a computer's unrelated debug key. Do not put any OAuth secret in the app.

The native app attempts silent reconnection on later opens after the user approves it once; a disconnect revokes access while leaving local entries intact. Android v1.6 uses versionCode 7 and unchanged stable signing identity. The original v1.5 APK is separately preserved at `running-tab-v1.5-stable`. Before installing, verify a JSON backup. Install **over** v1.5, never uninstall to update.

## v1.7 — Calendar and notifications

**Update the installed APK over v1.6** using the same signed preview release; do not uninstall. The version code is 8. The web portion gains a time selector on dated To-Dos, a **📅 Add to calendar** button, and a **🔔 Date & alert** editor.

- **Calendar:** Tapping Add to calendar opens an editable event in your installed calendar app. You confirm which calendar/account to use and tap Save there. It is a one-way export; editing a calendar event later does not change Day2Day.
- **Notifications:** Enable permissions under Day2Day **Settings → Reminders & calendar**. A To-Do with a specific day, time, and Phone notification enabled is scheduled on-device. The receiver can notify when the app is closed and restores upcoming alarms after restart. Completing, editing, or deleting a To-Do removes or adjusts its alarm.
- **Timing:** When Android does not permit exact alarms, the app uses an inexact battery-friendly alarm. Some reminders can arrive later than selected, particularly under battery restrictions. Use your calendar's own alerts for time-critical events.
- **Privacy:** There is no calendar OAuth scope, no read access to personal calendar events, no server-based reminder queue, and no new paid service. The Android wrapper keeps To-Do reminder data in its private preferences to restore alarms after reboot.
- **Browser:** Google Calendar event drafts work from Chrome/PWA, but background phone alerts require the installed v1.7 APK.

All existing To-Dos without a Phone notification option enabled remain unchanged and do not start sending alerts automatically.


## v1.9 — Removed saved-pin experiment

Removes the Android location permission, WebView geolocation handling, and the experimental **Drop a pin here** feature added in v1.8. Regular Google Maps navigation remains. Version code 10 allows a direct upgrade over v1.8 (code 9) without uninstalling or clearing local app data.


## v1.10 — Remind me again notification actions

When a scheduled To-Do alert arrives, its expanded Android notification offers **15 min**, **1 hour**, and **4 hours** quick actions. These send explicit immutable broadcast PendingIntents to ReminderReceiver. ReminderManager persists a per-task snooze time and original due timestamp in app-private preferences, schedules a separate snooze alarm, and restores pending snoozes after restart or clock changes. Tapping a choice clears the current notification without altering the saved To-Do. Another alert offers the same three choices again. Completing/deleting the To-Do, changing its due time, or turning off its notification cancels the pending snooze. No new permissions or paid services are needed beyond existing notifications. If exact alarms are unavailable, Android may deliver the snoozed alert later than the selected interval.

Version code 11 supports an in-place upgrade from v1.9 and retains all existing Day2Day entries.


## v2.0 — Day2Day rebrand and launcher shortcut on the widget

The visible app and widget name is **Day2Day**. The same native APK application ID (`ca.runningtab.widget`), stable signing certificate, and local data stores are retained so users can install directly over Running Tab without clearing or migrating data. A 32dp Day2Day icon at the **top-left of the widget** launches the full app to its currently selected section. The title retains the same action. The microphone action is shown as a compact **🎤** icon to make room for the title and new launch button. The full Day2Day icon is also used by Android's launcher. The separate app shortcut can be removed from the home screen without uninstalling the app.

## v2.1 — MyDay firefighter branding

MyDay uses a cream firefighter helmet with checkmark, crossed teal fire axe and Halligan, and the chosen Halligan silhouette showing an adz, pike and fork. Both Android launcher and widget shortcut display the updated icon. Install `myday.apk` over the existing Day2Day app; the stable package ID, signing certificate, data, reminders and Google Drive sync settings are unchanged. The prior `day2day.apk` download filename remains as a compatibility alias.

## v2.2 — Dictation inside existing notes

The **🎤 Dictate** button now sits to the left of **Save changes** in the editor for To-Do/Note details and Money notes. It closes the keyboard and invokes Android's existing speech recognizer. The transcript is appended to the editable field, leaving the record unchanged until the user taps Save changes. Cancelling recognition keeps the current typed text intact. Browser/PWA users can use the same button if their browser supports speech recognition.

## v2.3 — Open individual widget items

The collection widget passes a stable item key through its row click's fill-in Intent. When MyDay opens, the web view selects the correct section, expands the relevant Money person or To-Do/Note, or scrolls to the matching Shopping item. The selected entry is outlined briefly. This works whether MyDay is already open or is cold-started from the widget. The inline editor buttons are also compact enough to occupy one row on narrow screens.

## v2.4 — Mark Money transactions settled

Each expanded Money record has a **Mark settled** checkbox. Checked records remain visible in history, but no longer contribute to the person's outstanding balance, the app's overall totals, or the native widget's Money totals. Unchecking the box reopens the record. An active price-TBD account now shows **Price TBD**, not **Settled**. No storage migration is required; older money JSON records without a `settled` property are treated as outstanding.
