# DropStack data storage

The admin panel is available at [`admin.html`](../admin.html).

When the first record is saved, the browser asks for the repository's `data/` directory. Grant read/write access once. The existing data manager then writes additions directly to:

- `data/alternatives.js` for projects and ads
- `data/news.js` for news

Use Chrome or Edge on desktop over `http://localhost` (for example, VS Code Live Server or `python -m http.server`). A static website cannot write to a GitHub repository remotely without a server-side GitHub token, so the browser File System Access API is used to write to the local checkout safely.

If the browser does not support direct folder access, the entry is retained in browser storage and the regular data manager's export fallback can be used.
