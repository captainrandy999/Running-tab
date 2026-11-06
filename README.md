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
