# Running Tab for Android — read-only home-screen widget

This is a small native Android wrapper around the **same GitHub Pages Running Tab** interface, plus a large, scrollable **read-only** home-screen widget. The widget shows Money (full names and dollar amounts), To-Do reminders and deadlines, or Shopping (unchecked items). Tab buttons switch the widget list; none of the list items can be checked off on the widget.

Tapping an item opens Running Tab to its section. Tapping **🎤 Dictate** opens Running Tab and launches Android's speech recognition, placing the result in the existing entry field for review. Editing, checking off and saving still happen in the full app.

## Download / install directly on Samsung

The GitHub Actions workflow builds a **test APK** and makes it available in:
- [Preview release](https://github.com/captainrandy999/Running-tab/releases/tag/widget-preview)
- [Workflow builds](https://github.com/captainrandy999/Running-tab/actions/workflows/android-widget.yml)

When the build succeeds, tap the `running-tab-widget.apk` file from the preview release on your phone, allow installation from Chrome/Files if Android prompts, and install. This is a test version signed by a GitHub Actions debug key. It's not an official Play Store release. The build caches the test signing key for updates, but if that cache is ever evicted, a later APK may require uninstall/reinstall.

Next, press and hold a blank section of your Samsung home screen → **Widgets** → **Running Tab** → add the large widget. Resize it to fit most of a home-screen page.

## Important: one-time data transfer

Your old installed Chrome PWA and this new Android WebView have **separate local storage**, so existing entries won't appear until you import them.

1. Open the *old Running Tab* in Chrome or via your existing shortcut.
2. Expand **Data & backup**, choose **Download backup** and save the JSON file on your phone.
3. Open the **new native Running Tab app**.
4. Expand **Data & backup → Restore backup**, choose your JSON file, and confirm.
5. The widget should update with all Money, To-Do and Shopping records.

After importing, use the *new native app* for changes to keep the widget updated. Editing the old Chrome PWA will not sync automatically to the new app. Neither the widget nor the wrapper uploads your records to a server; they remain on your phone. Keep regular JSON backups.

The native app loads the latest web interface from GitHub Pages, so most interface changes can arrive without replacing the APK. The widget can show recently saved records when offline, but the web interface requires a first successful load for caching. Dictation may require internet.

## Build

Requires JDK 17, Android SDK Platform 35, Gradle 8.9 and Android Gradle Plugin 8.7.3. From `android/`, run `gradle :app:assembleDebug`. The APK is at `app/build/outputs/apk/debug/app-debug.apk`.

### Limitations

Android home-screen widgets cannot embed a live WebView. Therefore this widget is a native **summary/list representation** of the Running Tab interface, not an exact live webpage. The list is scrollable; its rows are read-only. Tap the moon icon (☾) in the widget header to enable night mode; tap the sun icon (☀) to switch back. The choice is remembered for each widget and also changes the list-row colors. Button and tab taps are deliberate. The app must open for edits, confirmation, dictation and full Money transaction details.

The preview APK is intended for personal testing, not Play Store deployment.

## Automatic speech review and suggested red action

Running Tab's built-in **Dictate** button automatically opens the translated Review form when speech recognition finishes; you then review and tap **Confirm & save**. The Android native speech popup uses the same behavior as of v1.2, including when launched from the widget.

The **next recommended button** is highlighted in red: Dictate when empty, Review for entered text, or Confirm & save once details are on screen. Typing in the text box is still supported. Samsung's separate keyboard microphone does not send a reliable "finished speaking" event to websites, so it may still require tapping Review.

## Notes in To-Do (v1.3)

Say **“take a note that…”**, **“make a note that…”**, or **“note…”** using the same Dictate control. After speech ends, Running Tab suggests a short topic and shows the **complete note** for correction. Tap **Confirm & save note** to save it. Notes appear alongside reminders in To-Do as expandable/collapsible entries with ordinary completion checkboxes. You may set an optional due date during review. The widget displays the note's heading and a short preview; tap it to open the full note in the app.

All existing reminders remain stored under the original `running-tab-todo-v1` key. Backups include notes automatically. Topic guessing is an on-device, first-phrase heuristic, so check the suggested topic before saving; it does not send dictated text to an external AI service.
