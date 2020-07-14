# Server Backup

What's the deal?
- can be configured to back up multiple folders separately
- Here's what will be created in the cloud storage bucket:

// Keep one per week for the past N weeks
- tree-notes_weekly_a.gz
- tree-notes_weekly_b.gz
- tree-notes_weekly_c.gz
- tree-notes_weekly_d.gz
// Keep one per day for the past N days
- tree-notes_daily_a.gz
- tree-notes_daily_b.gz
- tree-notes_daily_c.gz
- tree-notes_daily_d.gz

// Buut if the backup is going to be the same as the previous onw, hold off.
// So it won't be strictly "the past n days", it will be "the past N unique daily backups"
// we can get the remote md5hash to compare
