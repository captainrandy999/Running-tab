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
