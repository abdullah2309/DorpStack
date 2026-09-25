# DropStack data storage

Admin panel (admin-only): [`admin.html`](../admin.html) — login `admin` / `admin_123`.

When the first **Save** is performed, the browser asks for the repository `data/` folder. Grant read/write once; the handle is cached in IndexedDB and future saves write directly to:

- `data/alternatives.js` for **Drops** (`products`) and **Ads** (`ads`)
- `data/news.js` for **News**

All records support a **Link** field — public Drops, news and ad cards open that URL in a new tab (`js/card-links.js`).

Use Chrome or Edge on desktop over `http://localhost` (e.g. VS Code Live Server or `python -m http.server`). A static site cannot push to GitHub without a server-side token, so the File System Access API writes to the local checkout. If unsupported, the panel keeps data in `localStorage` and offers an **Export .js** download to manually replace files in `data/`.

The old public `data.html` has been removed — data is now admin-only.
