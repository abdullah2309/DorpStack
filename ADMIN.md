# Admin access — DropStack

Professional admin panel at **`admin.html`** is the **only** place to add or edit data.

- **Username:** `admin`
- **Password:** `admin_123`

The previous public `data.html` file has been removed. All Drops, news and ads are managed exclusively through the authenticated admin panel. Public pages (`index.html`, `projects.html`, `news.html`) no longer expose any “Manage data” action to visitors.

## What the panel manages
- **Drops** → `data/alternatives.js` (`products` array)
- **Ads** → `data/alternatives.js` (`ads` array)
- **News** → `data/news.js`

Each record has a **Link (opens in new tab)** field. When a link is set, the corresponding public card (Drops, news, ad) opens that URL in a new tab on click — implemented via `js/card-links.js` and server-rendered `data-external-link` attributes.

## Saving
1. Open `admin.html` over `http://localhost` (VS Code Live Server or `python -m http.server`).
2. First **Save** asks for the repository `data/` folder. Grant read/write once.
3. The handle is cached in IndexedDB — future saves write directly to `alternatives.js` / `news.js` without prompting.
4. If the browser doesn’t support direct writes (or permission is denied) the data is kept in `localStorage` and an **Export .js** fallback downloads a replacement file to place into `data/` manually.

Use Chrome or Edge on desktop for direct folder writes.

> Never treat these static HTML credentials as production security — anyone who can download the site can view them. Use server-side auth before public deployment.
