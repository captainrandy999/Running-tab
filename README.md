# Running Tab — Simple

Running Tab has **two separate sections**:

- **Money:** track who owes you money, whom you owe, reasons, and running totals per person.
- **To-Do:** dictate or type reminders, review and confirm them, check tasks off, and see remaining tasks ordered by due date. To-Do data is **separate** from Money and doesn't affect any balances.

## Publish the app

In the GitHub repository, open **Settings → Pages**, set **Source** to **Deploy from a branch**, select **main** and **/(root)**, then save.

After GitHub Pages deploys, open:

https://captainrandy999.github.io/Running-tab/

The To-Do page is:

https://captainrandy999.github.io/Running-tab/todo.html

## Voice entry

In Chrome on your Samsung, tap **🎤 Dictate**, allow microphone permission if requested, speak, tap **Review**, then **Confirm & save**. You can also type or use the Samsung keyboard microphone. Speech recognition availability varies by browser; it may require an internet connection or online speech processing.

Examples:
- "Cody owes me $200 for materials"
- "I owe Atlas $100 for gas"
- "Remind me to call Cody by Saturday"
- "I need to buy supplies by June" (June 1)
- "Remind me to send receipts by the end of June" (June 30)
- "Remind me to call the plumber" (no date — bottom of open list)
- "Remind me to do yard work in June" (June, no specific day)

## Privacy

This is a **test app**. The app code is public on GitHub Pages, but money entries and To-Dos are stored in different keys in the browser's localStorage on your phone, not in your GitHub repository.

Clearing Chrome site storage or switching browsers can erase your entries; keep using test data for now. A future version should add export/backup before you rely on it for important financial records or reminders.

This is a To-Do list, **not a background notification service**. It will not send scheduled phone alerts.
