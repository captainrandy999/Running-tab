# Running Tab

A lightweight Android-installable web app for **Money** and **To-Do** records, with one shared entry field.

## Open or install

[Open Running Tab](https://captainrandy999.github.io/Running-tab/)

In Chrome on Android, choose **Install app** (or **⋮ → Add to Home screen → Install app**). Existing installations use the same app URL and will receive updates after the Pages deploy and browser cache refresh.

## One entry, two separate lists

The header and **Tell Running Tab** entry box stay on the screen when switching sections; tapping the **Money** or **To-Do** control slides the corresponding list left or right. You can also swipe horizontally over the list. It does not navigate to another web page.

Speak with **Dictate**, use the Samsung keyboard microphone, or type:
- “Cody owes me $250 for materials” → Money
- “I owe Atlas $100 for supplies” → Money
- “Remind me to call Cody by Saturday” → To-Do
- “I need to renew insurance by June” → To-Do, June 1
- “Remind me to file receipts by the end of June” → To-Do, June 30
- “Remind me to call Cody” → To-Do, no deadline

Tap **Review**, inspect or edit the details, then **Confirm & save**. Reviewing does not modify records.

The To-Do section is a **checklist**, not scheduled Android notifications.

## Storage and backup

Money records use the same local key `running-tab-simple-v1` and To-Do records use `running-tab-todo-v1` as previous versions, so upgrading doesn't intentionally reset entries.

All records stay in your phone's browser site storage. They are not posted to GitHub. Browser speech recognition may send spoken words to an online transcription service.

Expand the small **Data & backup** section below the lists to download a JSON backup containing both lists or restore one (restoring replaces both lists after confirmation). You can also clear each list independently.

Offline app screens work after initial installation/caching; voice dictation may need connectivity.

Old links to `todo.html` redirect to the To-Do panel in the single-page app.
