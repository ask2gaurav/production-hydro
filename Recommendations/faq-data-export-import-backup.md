# Data Backup & Restore — Frequently Asked Questions

This guide explains the **Data Export / Import** screen in the app, and how to keep your patient and therapy data safe using backups.

---

### Q: What is a "backup" and why should I make one?

**A:** A backup is a saved copy of all your data — patients, therapists, and session records — stored in a single file. If something ever happens to the tablet (it breaks, is lost, or the app needs to be reinstalled), you can use a backup to bring all your data back instead of losing it. It's like a safety net for your records.

---

### Q: How do I create a backup manually?

**A:**
1. Open **Data Export / Import** from the Settings screen.
2. On the **Backups** tab, tap **Export Backup (.zip)**.
3. Wait for the "Backup file ready" message.
4. A sharing menu will open — choose where to send or save it (for example, Google Drive, email, or a USB drive).

Do this regularly, especially before any major change like updating the app or replacing the tablet.

---

### Q: What's the difference between "Export to Excel" and "Export Backup"?

**A:**
- **Export to Excel** creates a spreadsheet you can open, read, and print. It's useful for reports, but it **cannot** be used to restore your data.
- **Export Backup (.zip)** creates a special file made specifically for restoring your data later. This is the one to use for safekeeping.

---

### Q: How do I restore a backup (on this tablet or a new one)?

**A:**
1. Open **Data Export / Import** → **Backups** tab.
2. Tap **Import Backup** and choose the backup file.
3. You'll be asked to choose how to bring the data in:
   - **Merge** — keeps everything already on the tablet and adds/updates records from the backup. Use this if you just want to add missing information.
   - **Overwrite** — replaces everything currently on the tablet with what's in the backup. Use this only if you want to start fresh from the backup (for example, setting up a brand-new tablet).
4. If the backup was made on a **different machine**, you'll also be asked:
   - **Discard Mismatched Records** — skip the records that belong to the other machine.
   - **Reassign to This Machine** — bring those records in and treat them as belonging to this tablet.
   If you're not sure, **Discard Mismatched Records** is the safer choice.
5. Wait for the "Import complete" message before closing the screen.

---

### Q: How do I see or delete backups already saved on this tablet?

**A:** From **Data Export / Import**, tap **View Saved Backups**. There you can see every backup saved on this tablet, restore one, download a copy, or delete old ones you no longer need.

---

### Q: What is "Auto Backup" and should I turn it on?

**A:** Yes — it's strongly recommended. When **Auto Backup** is turned on (Settings tab), the app automatically saves a fresh backup after every therapy session and whenever reminders change. You don't have to remember to do it yourself.

To turn it on: **Data Export / Import** → **Settings** tab → switch on **Auto Backup**.

---

### Q: How many backups does the app keep?

**A:** You choose this number in the **Number of old backups to keep** field on the Settings tab. Once that many backups exist, the oldest ones are automatically removed to make room for new ones — so the tablet doesn't fill up with old files. A setting of 5, for example, keeps only the 5 most recent backups.

---

### Q: What is the "Backup Folder" and why do I need to set it?

**A:** The **Backup Folder** is a folder you choose (for example, a folder in Downloads, or on an SD card) where the app will also save a copy of every backup. This matters because:

- Copies saved inside the app itself can be lost if the app is ever uninstalled.
- A copy saved in your chosen **Backup Folder** stays safe even if the app is removed and reinstalled later.

**To set it up (only needs to be done once):**
1. Go to **Data Export / Import** → **Settings** tab.
2. Under **Backup Folder**, tap **Choose Folder**.
3. Pick (or create) a folder to use, then confirm.

If you ever see the message **"This folder is no longer accessible"**, it means the tablet lost permission to that folder (this can happen if the folder was moved, deleted, or if a lot of time passed). Simply tap **Change** and choose the folder again — your existing backups are not affected.

---

### Q: Where do my backups actually get saved?

**A:** To keep your data as safe as possible, the app tries to save each backup in more than one place automatically:

1. **On the tablet itself** — always happens, for quick access from **View Saved Backups**.
2. **In the Downloads folder** — happens automatically on tablets that support it.
3. **In your chosen Backup Folder** — happens automatically once you've set one up (see above), and survives even if the app is uninstalled.

You don't need to choose between these — the app handles saving to all available locations for you.

---

### Q: What should I do if I see an error message, or something doesn't seem to work?

**A:**
1. Read the message carefully — it usually explains what went wrong (for example, a file that couldn't be read).
2. Try the action again — a second attempt often succeeds, especially for temporary issues.
3. If setting up the **Backup Folder** fails or a backup won't restore, make sure you selected the correct file and folder.
4. If the problem continues, note down the exact message shown and contact support for help.
