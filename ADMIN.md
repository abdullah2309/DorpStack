# Admin access

Use `admin.html` for all data entry.

- Username: `admin`
- Password: `admin_123`

The old data manager is opened inside the authenticated admin area. Project records use the existing `data/alternatives.js` storage and news records use `data/news.js`. Use Chrome or Edge over a local server so the browser can write to the selected `data/` folder.

Never treat these client-side credentials as production security: static HTML credentials can be viewed by anyone who downloads the site. Use a server-side authentication system before deploying private administration to the public internet.
