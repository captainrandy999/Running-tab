# Running Tab

A small, installable phone app for two separate things:

- **Money:** who owes you, whom you owe, reasons, and running balances by person (including Price TBD).
- **To-Do:** checkable reminders sorted by deadlines; items with no date go last.

## Install on Android

Open **https://captainrandy999.github.io/Running-tab/** in Chrome.

Use **Install app** when available, or tap **⋮ → Add to Home screen → Install app**. Running Tab then opens from a home-screen icon in a standalone window.

The app includes 192×192 and 512×512 icons, a Web App Manifest, and offline caching for its interface.

## One entry field

Dictate with **🎤 Dictate**, use the Samsung keyboard microphone, or type:

- "Cody owes me $250 for materials" → Money
- "I owe Atlas $100 for supplies" → Money
- "Remind me to call Cody by Saturday" → To-Do
- "I need to renew insurance by June" → To-Do, June 1
- "Remind me to file receipts by the end of June" → To-Do, June 30
- "Remind me to call Cody" → To-Do without a date

Tap **Review** to inspect and edit what the app understood, then **Confirm & save**. The app doesn't modify a record merely by reviewing it.

The To-Do section is a checklist, **not an automatic phone notification/alarm service**.

## Storage and backups

Records are kept only in this browser's site storage on this device, **not** uploaded to the GitHub repository. The source code is public. Voice dictation may use an online transcription service even though app data is local.

Open **Money → Backup & settings** and tap **Download backup** to save one JSON file including money and reminders. **Restore backup** replaces both lists after confirmation. Keep backups in a safe place because clearing browser data, changing phones, and some browser storage cleanup can erase your local data.

Offline use works for the app interface after installation/caching; voice dictation may require connectivity.

## Updates

Changes pushed to the `main` branch are automatically republished through GitHub Pages after deployment. The service worker caches app files for offline use and updates the cache when a new version is deployed.
