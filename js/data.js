/* DropStack Data Manager */
(function () {
            'use strict';

            /* ============================================================
               HELPERS — sabse pehle (TDZ fix: '$' pehle define hota hai)
               ============================================================ */
            const $ = (id) => document.getElementById(id);
            const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
            const fmt = (n) => Number(n || 0).toLocaleString('en-US');
            const pad = (n) => String(n).padStart(2, '0');
            const nowStr = () => { const d = new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };
            const todayStr = () => nowStr().slice(0, 10);
            const genId = () => (Date.now().toString(16) + Math.floor(Math.random() * 256).toString(16).padStart(2, '0')).slice(0, 13);
            const shortDate = (s) => (s || '').slice(0, 10);
            const deep = (v) => JSON.parse(JSON.stringify(v));
            const safeHttpUrl = (value) => {
                try {
                    const url = new URL(String(value || ''));
                    const host = url.hostname.toLowerCase();
                    if (url.protocol !== 'https:' || (host !== 'github.com' && host !== 'www.github.com')) return '';
                    return url.href;
                } catch (e) { return ''; }
            };
            const anyLink = (value) => { try { const u = new URL(String(value || '')); return /^https?:/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } };

            const LS = { alts: 'ds-edit-alternatives', news: 'ds-edit-news' };
            const loadLS = (k) => { try { const s = localStorage.getItem(k); return s ? JSON.parse(s) : null; } catch (e) { return null; } };
            const saveLS = (k, v) => {
                try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; }
            };
            const clearLS = (k) => {
                try { localStorage.removeItem(k); return true; } catch (e) { return false; }
            };

            const state = { tab: 'alternatives', q: '', status: 'all', view: 'table' };
            const requestedTab = new URLSearchParams(window.location.search).get('tab');
            if (['alternatives', 'news', 'ads'].includes(requestedTab)) state.tab = requestedTab;
            const TAB_LABELS = { alternatives: 'Drop', news: 'News', ads: 'Ad' };
            let editingId = null;
            let formTab = 'alternatives';
            let formPreviousFocus = null;
            let toastTimer;

            /* ================= Toast ================= */
            function toast(msg, icon) {
                $('toastMsg').textContent = msg;
                $('toast').firstElementChild.className = (icon || 'fa-solid fa-check') + ' text-[13px]';
                $('toast').firstElementChild.style.color = 'var(--accent)';
                $('toast').classList.add('show');
                clearTimeout(toastTimer);
                toastTimer = setTimeout(() => $('toast').classList.remove('show'), 2400);
            }

            /* ================= Data sources ================= */
            const DATA_LOADED = {
                alts: !!window.ALTERNATIVES_DATA,
                news: !!window.NEWS_DATA
            };
            const FILE = {
                alternatives: deep(window.ALTERNATIVES_DATA || { products: [], ads: [] }),
                news: deep(window.NEWS_DATA || [])
            };
            const localAlternatives = loadLS(LS.alts);
            const localNews = loadLS(LS.news);
            const LOCAL_PENDING = {
                alternatives: !!(localAlternatives && Array.isArray(localAlternatives.products) && Array.isArray(localAlternatives.ads)),
                news: Array.isArray(localNews)
            };
            const REVISIONS = { alternatives: 0, news: 0 };
            let DB = {
                alternatives: (LOCAL_PENDING.alternatives ? localAlternatives : deep(FILE.alternatives)),
                news: (LOCAL_PENDING.news ? localNews : deep(FILE.news))
            };

            const CATS = ['productivity', 'developer-tools', 'analytics', 'marketing', 'design', 'databases', 'cms', 'communication'];

            /* ============================================================
               FILE SYSTEM ACCESS — direct write in data/*.js files
               ============================================================ */
            const FSA_SUPPORTED = 'showDirectoryPicker' in window;
            let dataDirHandle = null;
            let fileHandles = { alternatives: null, news: null };
            let fsState = FSA_SUPPORTED ? 'off' : 'unsupported';
            let fsLastSaved = null;
            let writeChain = Promise.resolve();

            const idb = {
                _db: null,
                open() {
                    if (this._db) return Promise.resolve(this._db);
                    return new Promise((res, rej) => {
                        const r = indexedDB.open('dropstack-data', 1);
                        r.onupgradeneeded = () => r.result.createObjectStore('handles');
                        r.onsuccess = () => { this._db = r.result; res(this._db); };
                        r.onerror = () => rej(r.error);
                    });
                },
                set(k, v) { return this.open().then(db => new Promise((res, rej) => {
                    const t = db.transaction('handles', 'readwrite');
                    t.objectStore('handles').put(v, k);
                    t.oncomplete = res; t.onerror = () => rej(t.error);
                })); },
                get(k) { return this.open().then(db => new Promise((res, rej) => {
                    const t = db.transaction('handles', 'readonly');
                    const rq = t.objectStore('handles').get(k);
                    rq.onsuccess = () => res(rq.result); rq.onerror = () => rej(rq.error);
                })); },
                delete(k) { return this.open().then(db => new Promise((res, rej) => {
                    const t = db.transaction('handles', 'readwrite');
                    t.objectStore('handles').delete(k);
                    t.oncomplete = res; t.onerror = () => rej(t.error);
                })); }
            };

            function buildAlternativesFile() {
                const p = DB.alternatives.products.map(r => JSON.stringify(r));
                const a = DB.alternatives.ads.map(r => JSON.stringify(r));
                return `/* ============================================================\n   DropStack — Alternatives & Ads data (saved ${nowStr()})\n   File: data/alternatives.js\n   Managed via admin.html — one JSON record per line\n   ============================================================ */\n\nwindow.ALTERNATIVES_DATA = {\n\n    "products": [\n        ${p.join(',\n        ')}\n    ],\n\n    "ads": [\n        ${a.join(',\n        ')}\n    ]\n};\n`;
            }
            function buildNewsFile() {
                const lines = DB.news.map(r => JSON.stringify(r));
                return `/* ============================================================\n   DropStack — News data (saved ${nowStr()})\n   File: data/news.js\n   Managed via admin.html — one JSON record per line\n   ============================================================ */\n\nwindow.NEWS_DATA = [\n    ${lines.join(',\n    ')}\n];\n`;
            }

            function parseDataFile(text) {
                if (!String(text || '').trim()) throw new Error('Data file empty hai');
                const fake = {};
                new Function('window', text)(fake);
                return fake;
            }

            async function resolveDirectoryFiles(dir) {
                return {
                    alternatives: await dir.getFileHandle('alternatives.js'),
                    news: await dir.getFileHandle('news.js')
                };
            }

            async function readFromDisk() {
                if (!fileHandles.alternatives || !fileHandles.news) throw new Error('Data file handle missing');
                const [alternativesFile, newsFile] = await Promise.all([
                    fileHandles.alternatives.getFile(),
                    fileHandles.news.getFile()
                ]);
                const [alternativesText, newsText] = await Promise.all([
                    alternativesFile.text(),
                    newsFile.text()
                ]);
                const alternativesParsed = parseDataFile(alternativesText);
                const newsParsed = parseDataFile(newsText);
                const alternatives = alternativesParsed.ALTERNATIVES_DATA;
                const news = newsParsed.NEWS_DATA;

                if (!alternatives || !Array.isArray(alternatives.products) || !Array.isArray(alternatives.ads)) {
                    throw new Error('alternatives.js ka data shape valid nahi hai');
                }
                if (!Array.isArray(news)) throw new Error('news.js ka data shape valid nahi hai');
                return { alternatives: deep(alternatives), news: deep(news) };
            }

            function hasPendingEdits() {
                return LOCAL_PENDING.alternatives || LOCAL_PENDING.news;
            }

            async function activateDiskData(diskData) {
                const pendingAlternatives = LOCAL_PENDING.alternatives;
                const pendingNews = LOCAL_PENDING.news;

                // Reconcile each file independently so an alternatives edit never
                // overwrites unrelated news already present on disk (and vice versa).
                if (!pendingAlternatives) DB.alternatives = diskData.alternatives;
                if (!pendingNews) DB.news = diskData.news;
                fsState = 'on';
                $('dirtyBadge').classList.toggle('hidden', !hasPendingEdits());
                syncModeUI();

                if (hasPendingEdits()) {
                    const target = pendingAlternatives && pendingNews
                        ? 'all'
                        : (pendingAlternatives ? 'alternatives' : 'news');
                    const saved = await writeToDisk(target);
                    if (!saved) return false;
                } else {
                    clearLS(LS.alts); clearLS(LS.news);
                }
                syncModeUI(); renderAll();
                return true;
            }

            async function connectFiles() {
                if (!FSA_SUPPORTED) {
                    toast('Is browser me direct folder write nahi hota — Export .js use karo', 'fa-solid fa-triangle-exclamation');
                    return false;
                }
                const hadPendingEdits = hasPendingEdits();
                fsState = 'loading';
                syncModeUI();
                try {
                    const pickedDir = await window.showDirectoryPicker({
                        id: 'dropstack-data-folder',
                        mode: 'readwrite'
                    });
                    fileHandles = await resolveDirectoryFiles(pickedDir);
                    const diskData = await readFromDisk();

                    dataDirHandle = pickedDir;
                    await idb.set('h-data-dir', dataDirHandle);
                    if (!await activateDiskData(diskData)) return false;
                    toast(hadPendingEdits
                        ? 'Data folder connected — pending data safely write ho gaya'
                        : 'Data folder connected — ab har change seedha file me save hoga');
                    return true;
                } catch (e) {
                    fsState = 'off';
                    dataDirHandle = null;
                    fileHandles = { alternatives: null, news: null };
                    syncModeUI();
                    if (e && e.name === 'NotFoundError') {
                        toast('data folder me alternatives.js aur news.js dono hone chahiye', 'fa-solid fa-triangle-exclamation');
                    } else if (e && e.name !== 'AbortError') {
                        toast('Folder connect fail: ' + e.message, 'fa-solid fa-triangle-exclamation');
                    }
                    return false;
                }
            }

            function isInvalidHandleError(error) {
                return !!error && (error.name === 'NotFoundError' || error.name === 'TypeError');
            }

            async function restoreHandles() {
                if (!FSA_SUPPORTED) { syncModeUI(); return; }
                fsState = 'loading';
                syncModeUI();
                try {
                    dataDirHandle = (await idb.get('h-data-dir')) || null;
                    if (dataDirHandle) {
                        const permission = dataDirHandle.queryPermission
                            ? await dataDirHandle.queryPermission({ mode: 'readwrite' })
                            : 'granted';
                        if (permission !== 'granted') { fsState = 'reconnect'; syncModeUI(); return; }
                        fileHandles = await resolveDirectoryFiles(dataDirHandle);
                    } else {
                        // Backward compatibility with the earlier per-file connection flow.
                        const [legacyAlternatives, legacyNews] = await Promise.all([
                            idb.get('h-alts'), idb.get('h-news')
                        ]);
                        if (!legacyAlternatives || !legacyNews) { fsState = 'off'; syncModeUI(); return; }
                        fileHandles = { alternatives: legacyAlternatives, news: legacyNews };
                        const permissions = await Promise.all([
                            legacyAlternatives.queryPermission ? legacyAlternatives.queryPermission({ mode: 'readwrite' }) : 'granted',
                            legacyNews.queryPermission ? legacyNews.queryPermission({ mode: 'readwrite' }) : 'granted'
                        ]);
                        if (permissions.some(permission => permission !== 'granted')) {
                            fsState = 'reconnect'; syncModeUI(); return;
                        }
                    }

                    const diskData = await readFromDisk();
                    if (!await activateDiskData(diskData)) return;
                } catch (e) {
                    if (isInvalidHandleError(e)) {
                        if (dataDirHandle) {
                            try { await idb.delete('h-data-dir'); } catch (ignored) {}
                        }
                        dataDirHandle = null;
                        fileHandles = { alternatives: null, news: null };
                        fsState = 'off';
                    } else {
                        fsState = 'reconnect';
                    }
                    syncModeUI();
                }
            }

            async function reconnect() {
                try {
                    if (dataDirHandle) {
                        const permission = await dataDirHandle.requestPermission({ mode: 'readwrite' });
                        if (permission !== 'granted') {
                            fsState = 'off';
                            syncModeUI();
                            toast('Permission denied — next Save par data folder dobara select karo', 'fa-solid fa-triangle-exclamation');
                            return false;
                        }
                        fileHandles = await resolveDirectoryFiles(dataDirHandle);
                    } else if (fileHandles.alternatives && fileHandles.news) {
                        const permissions = await Promise.all([
                            fileHandles.alternatives.requestPermission({ mode: 'readwrite' }),
                            fileHandles.news.requestPermission({ mode: 'readwrite' })
                        ]);
                        if (permissions.some(permission => permission !== 'granted')) {
                            fsState = 'off';
                            syncModeUI();
                            toast('Permission denied — next Save par data folder dobara select karo', 'fa-solid fa-triangle-exclamation');
                            return false;
                        }
                    } else {
                        fsState = 'off';
                        syncModeUI();
                        return false;
                    }

                    fsState = 'loading';
                    syncModeUI();
                    const diskData = await readFromDisk();
                    if (!await activateDiskData(diskData)) return false;
                    toast('Folder permission restored — file sync ON');
                    return true;
                } catch (e) {
                    if (isInvalidHandleError(e)) {
                        if (dataDirHandle) {
                            try { await idb.delete('h-data-dir'); } catch (ignored) {}
                        }
                        dataDirHandle = null;
                        fileHandles = { alternatives: null, news: null };
                        fsState = 'off';
                        syncModeUI();
                        toast('Saved folder invalid — next Save par folder dobara select karo', 'fa-solid fa-triangle-exclamation');
                    } else {
                        fsState = 'reconnect';
                        syncModeUI();
                        toast('Folder reconnect fail: ' + e.message, 'fa-solid fa-triangle-exclamation');
                    }
                    return false;
                }
            }

            async function writeFile(handle, content) {
                let writable = null;
                try {
                    writable = await handle.createWritable();
                    await writable.write(content);
                    await writable.close();
                } catch (e) {
                    if (writable) {
                        try { await writable.abort(); } catch (ignored) {}
                    }
                    throw e;
                }
            }

            function writeToDisk(target) {
                if (fsState !== 'on') return Promise.resolve(false);
                const writeAlternatives = target === 'all' || target === 'alternatives' || target === 'ads';
                const writeNews = target === 'all' || target === 'news';

                const job = writeChain.then(async () => {
                    if (fsState !== 'on') return false;
                    if (writeAlternatives && !fileHandles.alternatives) throw new Error('alternatives.js handle missing');
                    if (writeNews && !fileHandles.news) throw new Error('news.js handle missing');

                    // Build both snapshots before the first await so a multi-file write is coherent.
                    const builtRevisions = { alternatives: REVISIONS.alternatives, news: REVISIONS.news };
                    const alternativesContent = writeAlternatives ? buildAlternativesFile() : null;
                    const newsContent = writeNews ? buildNewsFile() : null;
                    if (writeAlternatives) await writeFile(fileHandles.alternatives, alternativesContent);
                    if (writeNews) await writeFile(fileHandles.news, newsContent);

                    if (writeAlternatives && builtRevisions.alternatives === REVISIONS.alternatives) {
                        clearLS(LS.alts);
                        LOCAL_PENDING.alternatives = false;
                    }
                    if (writeNews && builtRevisions.news === REVISIONS.news) {
                        clearLS(LS.news);
                        LOCAL_PENDING.news = false;
                    }
                    fsLastSaved = nowStr().slice(11);
                    $('dirtyBadge').classList.toggle('hidden', !hasPendingEdits());
                    syncModeUI();
                    return true;
                }).catch(() => {
                    fsState = 'reconnect';
                    let backupFailed = false;
                    if (writeAlternatives) {
                        backupFailed = !saveLS(LS.alts, DB.alternatives) || backupFailed;
                        LOCAL_PENDING.alternatives = true;
                    }
                    if (writeNews) {
                        backupFailed = !saveLS(LS.news, DB.news) || backupFailed;
                        LOCAL_PENDING.news = true;
                    }
                    $('dirtyBadge').classList.remove('hidden');
                    syncModeUI();
                    toast(backupFailed
                        ? 'File write fail — browser backup bhi unavailable, page open rakho'
                        : 'File write fail — next Save par folder permission retry hogi', 'fa-solid fa-triangle-exclamation');
                    return false;
                });

                // A failed job must not prevent future writes from running.
                writeChain = job.catch(() => false);
                return job;
            }

            function syncModeUI() {
                const note = $('modeNote');
                if (fsState === 'loading') {
                    note.innerHTML = `
                        <i class="fa-solid fa-spinner fa-spin mt-0.5 text-[14px] text-accent"></i>
                        <p class="leading-relaxed">Data folder validate aur safely load ho raha hai. Is dauran ke changes browser storage me backup rahenge.</p>`;
                } else if (fsState === 'on') {
                    note.innerHTML = `
                        <i class="fa-solid fa-circle-check mt-0.5 text-[14px]" style="color:var(--accent)"></i>
                        <p class="leading-relaxed">
                            <span class="font-semibold text-primary">Direct file write ON</span> — har add/edit/delete
                            <span class="mono text-primary">data/alternatives.js</span> aur <span class="mono text-primary">data/news.js</span> me turant save hota hai
                            (ek line = ek JSON record). ${fsLastSaved ? 'Last write: <span class="mono">' + fsLastSaved + '</span>.' : ''}
                            Homepage <span class="font-medium text-primary">refresh</span> karo to naya data wahan bhi dikhega.
                        </p>`;
                } else if (fsState === 'reconnect') {
                    note.innerHTML = `
                        <i class="fa-solid fa-plug-circle-exclamation mt-0.5 text-[14px]" style="color:#e5a13d"></i>
                        <p class="leading-relaxed">
                            Folder permission dobara chahiye. Agli <span class="font-medium text-primary">Save</span> par permission retry hogi;
                            tab tak change browser storage me safely backup rahega.
                        </p>`;
                } else if (fsState === 'unsupported') {
                    note.innerHTML = `
                        <i class="fa-solid fa-circle-info mt-0.5 text-[14px] text-accent"></i>
                        <p class="leading-relaxed">
                            Ye browser direct file edit support nahi karta. Chrome/Edge desktop use karo, ya
                            <span class="font-medium text-primary">Export .js</span> se downloaded file se <span class="mono">data/</span> folder ki file manually replace karo.
                        </p>`;
                } else {
                    note.innerHTML = `
                        <i class="fa-solid fa-folder-open mt-0.5 text-[14px] text-accent"></i>
                        <p class="leading-relaxed">
                            Pehli <span class="font-medium text-primary">Save</span> par project ka <span class="mono text-primary">data</span> folder select karo.
                            Uske baad har change seedha <span class="mono text-primary">alternatives.js</span> ya
                            <span class="mono text-primary">news.js</span> me likha jayega. Cancel karne par data browser storage me backup rahega.
                        </p>`;
                }
            }

            /* ================= Data access ================= */
            function tabArray(tab) {
                tab = tab || state.tab;
                if (tab === 'news') return DB.news;
                if (tab === 'ads') return DB.alternatives.ads;
                return DB.alternatives.products;
            }
            function cachePendingTarget(target) {
                const writeAlternatives = target === 'all' || target === 'alternatives' || target === 'ads';
                const writeNews = target === 'all' || target === 'news';
                let saved = true;
                if (writeAlternatives) {
                    saved = saveLS(LS.alts, DB.alternatives) && saved;
                    LOCAL_PENDING.alternatives = true;
                    REVISIONS.alternatives++;
                }
                if (writeNews) {
                    saved = saveLS(LS.news, DB.news) && saved;
                    LOCAL_PENDING.news = true;
                    REVISIONS.news++;
                }
                $('dirtyBadge').classList.remove('hidden');
                return saved;
            }

            function persist(silent, target) {
                const writeTarget = target || state.tab;
                const backupSaved = cachePendingTarget(writeTarget);

                if (fsState === 'on') {
                    writeToDisk(writeTarget).then(ok => {
                        if (ok && !silent) toast('Saved to data file ✓');
                    });
                    return;
                }

                if (!FSA_SUPPORTED) {
                    if (!silent) {
                        toast(backupSaved
                            ? 'Saved (browser storage — direct folder sync unavailable)'
                            : 'Browser storage fail — data tab open rakho', 'fa-solid fa-triangle-exclamation');
                    }
                    return;
                }

                if (fsState === 'loading') {
                    if (!silent) toast(backupSaved
                        ? 'Saved locally — folder connection complete hone par disk par likha jayega'
                        : 'Browser storage fail — page open rakho', 'fa-solid fa-triangle-exclamation');
                    return;
                }

                const connection = fsState === 'reconnect' ? reconnect() : connectFiles();
                Promise.resolve(connection).then((connected) => {
                    if (!connected && !silent) {
                        toast(backupSaved
                            ? 'Saved (browser storage — next Save par folder connect hoga)'
                            : 'Browser storage fail — data tab open rakho', 'fa-solid fa-triangle-exclamation');
                    }
                });
            }
            const isLive = (r) => r.status === 'active' || r.status === 'published';
            const liveWord = () => state.tab === 'news' ? 'published' : 'active';

            function rows() {
                const q = state.q.trim().toLowerCase();
                let arr = tabArray().filter(r => {
                    if (state.status === 'live' && !isLive(r)) return false;
                    if (state.status === 'draft' && r.status !== 'draft') return false;
                    if (q) {
                        const hay = [r.name, r.title, r.text, r.description, r.source, r.id, r.license, r.github_url,
                            ...(r.topics || []), ...(r.categories || []),
                            ...((r.altTo || []).map(a => a.name))].filter(Boolean).join(' ').toLowerCase();
                        if (!hay.includes(q)) return false;
                    }
                    return true;
                });
                arr.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
                return arr;
            }

            /* ================= Stats ================= */
            function renderStats() {
                const arr = tabArray();
                $('cntAlts').textContent = DB.alternatives.products.length;
                $('cntNews').textContent = DB.news.length;
                $('cntAds').textContent = DB.alternatives.ads.length;

                $('stTotal').textContent = arr.length;
                $('stLive').textContent = arr.filter(isLive).length;
                $('stDraft').textContent = arr.filter(r => r.status === 'draft').length;
                $('stLiveLabel').textContent = state.tab === 'news' ? 'Published' : 'Live';

                if (state.tab === 'alternatives') {
                    $('stExtra').textContent = fmt(arr.reduce((s, r) => s + (r.votes || 0), 0));
                    $('stExtraLabel').textContent = 'Total votes';
                } else if (state.tab === 'news') {
                    $('stExtra').textContent = new Set(arr.map(r => r.source)).size;
                    $('stExtraLabel').textContent = 'Unique sources';
                } else {
                    $('stExtra').textContent = arr.length;
                    $('stExtraLabel').textContent = 'Ad slots';
                }
            }

            /* ================= Table render ================= */
            const ACTIONS = (id) => `
                <div class="flex items-center justify-end gap-0.5">
                    <button class="row-btn" data-act="edit" data-id="${id}" title="Edit"><i class="fa-solid fa-pen text-[12px]"></i></button>
                    <button class="row-btn" data-act="dup" data-id="${id}" title="Duplicate"><i class="fa-regular fa-copy text-[12px]"></i></button>
                    <button class="row-btn danger" data-act="del" data-id="${id}" title="Delete"><i class="fa-solid fa-trash text-[12px]"></i></button>
                </div>`;

            const statusBadge = (r) => `
                <button class="badge ${isLive(r) ? 'badge-live' : 'badge-draft'}" data-act="toggle" data-id="${r.id}" title="Click to toggle status">
                    <span class="inline-block h-1.5 w-1.5 rounded-full" style="background:currentColor"></span>${r.status}
                </button>`;

            function renderTable() {
                const list = rows();
                const heads = {
                    alternatives: ['Drop', 'ID', 'GitHub URL', 'Pricing', 'Categories', 'Votes', 'Link', 'Status', 'Added', ''],
                    news: ['News', 'ID', 'Source', 'Time', 'Link', 'Status', 'Created', ''],
                    ads: ['Ad', 'ID', 'Text', 'Link', 'Status', '']
                }[state.tab];
                $('tableHead').innerHTML = '<tr>' + heads.map(h =>
                    `<th${h === '' ? ' style="text-align:right"' : ''}>${h}</th>`).join('') + '</tr>';

                if (list.length === 0) {
                    $('tableBody').innerHTML = `
                        <tr><td colspan="${heads.length}">
                            <div class="flex flex-col items-center gap-2 py-14 text-center">
                                <span class="grid h-11 w-11 place-items-center rounded-full border border-border text-secondary">
                                    <i class="fa-solid fa-magnifying-glass text-[16px]"></i>
                                </span>
                                <p class="text-sm font-medium text-primary">No records found</p>
                                <p class="text-[13px] text-secondary">Search/filters clear karo ya naya record add karo.</p>
                            </div>
                        </td></tr>`;
                } else {
                    $('tableBody').innerHTML = list.map(r => {
                        if (state.tab === 'alternatives') {
                            const cats = (r.categories || []).map(c => `<span class="chip !cursor-default !py-0.5 !px-2 !text-[10px]">${esc(c)}</span>`).join(' ');
                            const github = safeHttpUrl(r.github_url);
                            const githubLabel = github ? new URL(github).hostname.replace(/^www\./, '') : '';
                            return `<tr>
                                <td>
                                    <div class="flex items-center gap-3">
                                        <div class="tile" style="background:${esc(r.logo.bg)};color:${esc(r.logo.fg)}"><i class="${esc(r.logo.icon)} text-[14px]"></i></div>
                                        <div class="min-w-0">
                                            <p class="truncate font-medium text-primary" style="max-width:220px">${esc(r.name)}</p>
                                            <p class="truncate text-[11px] text-secondary" style="max-width:220px">alt to ${(r.altTo || []).map(a => esc(a.name)).join(', ')}</p>
                                        </div>
                                    </div>
                                </td>
                                <td class="mono text-[11px] text-secondary">${esc(r.id)}</td>
                                <td>${github
                                    ? `<a href="${esc(github)}" target="_blank" rel="noopener noreferrer" class="inline-flex max-w-[150px] items-center gap-1.5 text-xs text-primary hover:text-accent" title="${esc(r.github_url)}"><i class="fa-brands fa-github text-[13px]"></i><span class="truncate">${esc(githubLabel)}</span></a>`
                                    : '<span class="text-xs text-secondary">—</span>'}</td>
                                <td class="text-secondary">${esc(r.pricing)}</td>
                                <td><div class="flex max-w-[180px] flex-wrap gap-1">${cats}</div></td>
                                <td class="mono font-semibold">${fmt(r.votes)}</td>
                                <td class="link-cell">${anyLink(r.link) ? '<a href="'+esc(anyLink(r.link))+'" target="_blank" rel="noopener" class="text-accent hover:underline">'+esc(anyLink(r.link))+'</a>' : '<span style="color:var(--secondary)">—</span>'}</td>
                                <td>${statusBadge(r)}</td>
                                <td class="mono text-[11px] text-secondary">${shortDate(r.added)}</td>
                                <td>${ACTIONS(r.id)}</td>
                            </tr>`;
                        }
                        if (state.tab === 'news') {
                            return `<tr>
                                <td>
                                    <div class="flex items-center gap-3">
                                        <div class="tile" style="background:${esc(r.bg)};color:${esc(r.fg)}"><i class="${esc(r.icon)} text-[13px]"></i></div>
                                        <p class="truncate font-medium text-primary" style="max-width:300px">${esc(r.title)}</p>
                                    </div>
                                </td>
                                <td class="mono text-[11px] text-secondary">${esc(r.id)}</td>
                                <td class="text-secondary">${esc(r.source)}</td>
                                <td class="mono text-[11px] text-secondary">${esc(r.time)}</td>
                                <td class="link-cell">${anyLink(r.link) ? '<a href="'+esc(anyLink(r.link))+'" target="_blank" rel="noopener" class="text-accent">'+esc(anyLink(r.link))+'</a>' : '<span style="color:var(--secondary)">—</span>'}</td>
                                <td>${statusBadge(r)}</td>
                                <td class="mono text-[11px] text-secondary">${shortDate(r.created_at)}</td>
                                <td>${ACTIONS(r.id)}</td>
                            </tr>`;
                        }
                        return `<tr>
                            <td>
                                <div class="flex items-center gap-3">
                                    <div class="tile" style="background:${esc(r.bg)};color:${esc(r.fg)}"><i class="${esc(r.icon)} text-[13px]"></i></div>
                                    <p class="font-medium text-primary">${esc(r.title)}</p>
                                </div>
                            </td>
                            <td class="mono text-[11px] text-secondary">${esc(r.id)}</td>
                            <td class="text-secondary" style="max-width:340px"><span class="line-clamp-2 block">${esc(r.text)}</span></td>
                            <td class="link-cell">${anyLink(r.link) ? '<a href="'+esc(anyLink(r.link))+'" target="_blank" rel="noopener" class="text-accent">'+esc(anyLink(r.link))+'</a>' : '<span style="color:var(--secondary)">—</span>'}</td>
                            <td>${statusBadge(r)}</td>
                            <td>${ACTIONS(r.id)}</td>
                        </tr>`;
                    }).join('');
                }

                $('rowCount').textContent = 'Showing ' + list.length + ' of ' + tabArray().length + ' records';
            }

            /* ================= Raw view ================= */
            function renderRaw() {
                const list = rows();
                $('rawCount').textContent = list.length;
                $('rawBody').innerHTML = list.map(r =>
                    `<div class="raw-line">${esc(JSON.stringify(r))}</div>`).join('') ||
                    '<p class="py-8 text-center text-sm text-secondary">No records</p>';
            }

            function renderAll() {
                renderStats();
                if (state.view === 'table') renderTable();
                else renderRaw();
                $('tableView').classList.toggle('hidden', state.view !== 'table');
                $('rawView').classList.toggle('hidden', state.view !== 'raw');
            }

            /* ================= Form (add / edit) ================= */
            const label = (txt, req) => `<label class="lbl">${txt}${req ? ' <span class="req">*</span>' : ''}</label>`;
            const inp = (id, val, ph, type) =>
                `<input id="${id}" type="${type || 'text'}" value="${esc(val)}" placeholder="${esc(ph || '')}" class="inp">`;
            const num = (id, val) => `<input id="${id}" type="number" value="${esc(val ?? 0)}" class="inp">`;
            const sel = (id, opts, val) =>
                `<select id="${id}" class="sel">${opts.map(o => `<option value="${esc(o)}"${o === val ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
            const color = (id, val) => `<input id="${id}" type="color" value="${esc(val || '#00a751')}" class="inp-color">`;
            const iconField = (id, val) => `
                <div class="flex gap-2">
                    <input id="${id}" value="${esc(val)}" placeholder="fa-solid fa-bolt" class="inp">
                    <span id="${id}_prev" class="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border text-secondary"><i class="${esc(val)}"></i></span>
                </div>`;
            const ta = (id, val, ph) => `<textarea id="${id}" placeholder="${esc(ph || '')}" class="ta">${esc(val)}</textarea>`;
            const cell = (html, full) => `<div class="${full ? 'sm:col-span-2' : ''}">${html}</div>`;

            function buildForm(rec) {
                rec = rec || {};
                let html = '';
                if (formTab === 'alternatives') {
                    const cats = rec.categories || [];
                    html += cell(label('Name', 1) + inp('f_name', rec.name, 'Supabase'));
                    html += cell(label('GitHub URL') + inp('f_github', rec.github_url, 'https://github.com/username/project', 'url'), true);
                    html += cell(label('Link (opens in new tab)') + inp('f_link', rec.link, 'https://example.com', 'url'), true);
                    html += cell(label('Pricing') + sel('f_pricing', ['Open Source', 'Freemium'], rec.pricing || 'Open Source'));
                    html += cell(label('License') + inp('f_license', rec.license, 'MIT, AGPL-3.0…'));
                    html += cell(label('Level') + num('f_level', rec.level ?? 1));
                    html += cell(label('Categories') + `
                        <div id="f_cats" class="flex flex-wrap gap-1.5">
                            ${CATS.map(c => `<button type="button" class="chip ${cats.includes(c) ? 'chip-on' : ''}" data-catv="${c}">${c}</button>`).join('')}
                        </div>`, true);
                    html += cell(label('Description') + ta('f_desc', rec.description, 'One-two line description…'), true);
                    html += cell(label('Topics (comma separated)') + inp('f_topics', (rec.topics || []).join(', '), 'database, backend, auth'));
                    html += cell(label('Alternative to (one per line: Name|#bg|#fg)') + ta('f_alt', (rec.altTo || []).map(a => `${a.name}|${a.bg}|${a.fg}`).join('\n'), 'Firebase|#ffa000|#ffffff'));
                    html += cell(label('Votes') + num('f_votes', rec.votes ?? 0));
                    html += cell(label('Comments') + num('f_comments', rec.comments ?? 0));
                    html += cell(label('Views') + inp('f_views', rec.views, '0'));
                    html += cell(label('Trending score (0-100)') + num('f_trending', rec.trending ?? 50));
                    html += cell(label('Added date') + inp('f_added', rec.added || todayStr(), '', 'date'));
                    html += cell(label('Status') + sel('f_status', ['active', 'draft'], rec.status || 'active'));
                    html += cell(label('Logo background') + color('f_bg', (rec.logo || {}).bg));
                    html += cell(label('Logo foreground') + color('f_fg', (rec.logo || {}).fg));
                    html += cell(label('Icon (Font Awesome class)') + iconField('f_icon', (rec.logo || {}).icon || 'fa-solid fa-bolt'), true);
                } else if (formTab === 'news') {
                    html += cell(label('Title', 1) + inp('f_title', rec.title, 'Supabase launches…'), true);
                    html += cell(label('Source', 1) + inp('f_source', rec.source, 'Supabase'));
                    html += cell(label('Relative time') + inp('f_time', rec.time, '2d ago'));
                    html += cell(label('Link (opens in new tab)') + inp('f_link', rec.link, 'https://example.com', 'url'), true);
                    html += cell(label('Status') + sel('f_status', ['published', 'draft'], rec.status || 'published'));
                    html += cell(label('Tile background') + color('f_bg', rec.bg));
                    html += cell(label('Tile foreground') + color('f_fg', rec.fg));
                    html += cell(label('Icon (Font Awesome class)') + iconField('f_icon', rec.icon || 'fa-solid fa-bolt'), true);
                    html += cell(label('Created at') + inp('f_created', rec.created_at || nowStr(), 'YYYY-MM-DD HH:MM:SS'));
                } else {
                    html += cell(label('Title', 1) + inp('f_title', rec.title, 'CodeRabbit'));
                    html += cell(label('Status') + sel('f_status', ['active', 'draft'], rec.status || 'active'));
                    html += cell(label('Ad text') + ta('f_text', rec.text, 'Ad copy…'), true);
                    html += cell(label('Link (opens in new tab)') + inp('f_link', rec.link, 'https://example.com', 'url'), true);
                    html += cell(label('Tile background') + color('f_bg', rec.bg));
                    html += cell(label('Tile foreground') + color('f_fg', rec.fg));
                    html += cell(label('Icon (Font Awesome class)') + iconField('f_icon', rec.icon || 'fa-solid fa-bug'), true);
                }
                $('formBody').innerHTML = html;
            }

            function setPageInert(value) {
                document.querySelectorAll('body > header, body > main, body > footer, body > aside').forEach((element) => {
                    element.inert = value;
                });
            }

            function openForm(rec) {
                formPreviousFocus = document.activeElement;
                formTab = state.tab;
                editingId = rec ? rec.id : null;
                const recordLabel = TAB_LABELS[formTab] || 'Record';
                $('formTitle').textContent = (rec ? 'Edit ' : 'Add ') + recordLabel + (rec ? '' : ' record');
                $('formSub').textContent = rec ? 'id: ' + rec.id : 'new id will be auto-generated';
                buildForm(rec);
                setPageInert(true);
                $('formOverlay').classList.add('open');
                setTimeout(() => {
                    const firstField = $('formBody').querySelector('input, select, textarea');
                    if (firstField) firstField.focus();
                }, 30);
            }

            function closeForm() {
                if (!$('formOverlay').classList.contains('open')) return;
                $('formOverlay').classList.remove('open');
                setPageInert(false);
                if (formPreviousFocus && document.contains(formPreviousFocus)) formPreviousFocus.focus();
            }

            $('formBody').addEventListener('click', (e) => {
                const chipBtn = e.target.closest('[data-catv]');
                if (chipBtn) chipBtn.classList.toggle('chip-on');
            });
            $('formBody').addEventListener('input', (e) => {
                if (e.target.id === 'f_icon') {
                    const p = $('f_icon_prev');
                    if (p) p.innerHTML = `<i class="${esc(e.target.value)}"></i>`;
                }
            });

            function findRec(id, tab) {
                return tabArray(tab || state.tab).find(r => r.id === id);
            }
            function errRequired(id) {
                const el = $(id);
                if (el) { el.style.borderColor = '#e5484d'; el.focus(); setTimeout(() => el.style.borderColor = '', 1600); }
                toast('Required field missing', 'fa-solid fa-triangle-exclamation');
            }
            function errUrl(id) {
                const el = $(id);
                if (el) { el.style.borderColor = '#e5484d'; el.focus(); setTimeout(() => el.style.borderColor = '', 1600); }
                toast('Valid https://github.com/... URL daalo', 'fa-solid fa-triangle-exclamation');
            }

            $('recForm').addEventListener('submit', (e) => {
                e.preventDefault();
                const v = (id) => ($(id) ? $(id).value.trim() : '');
                const n = (id, def) => { const x = parseInt(v(id), 10); return isNaN(x) ? (def || 0) : x; };
                let rec;

                if (formTab === 'alternatives') {
                    if (!v('f_name')) return errRequired('f_name');
                    if (v('f_github') && !safeHttpUrl(v('f_github'))) return errUrl('f_github');
                    rec = {
                        id: editingId || genId(),
                        name: v('f_name'),
                        github_url: v('f_github') ? safeHttpUrl(v('f_github')) : '',
                        link: v('f_link') ? (function(v){ try{ var u=new URL(String(v||'')); return /^https?:/.test(u.protocol)?u.href:'';}catch(e){return ''}})(v('f_link')) : '',
                        status: v('f_status') || 'active',
                        level: n('f_level', 1),
                        pricing: v('f_pricing') || 'Open Source',
                        license: v('f_license') || 'MIT',
                        categories: [...document.querySelectorAll('#f_cats .chip-on')].map(b => b.dataset.catv),
                        description: v('f_desc'),
                        topics: v('f_topics') ? v('f_topics').split(',').map(s => s.trim()).filter(Boolean) : [],
                        votes: n('f_votes'),
                        comments: n('f_comments'),
                        views: v('f_views') || '0',
                        trending: n('f_trending', 50),
                        added: v('f_added') || todayStr(),
                        created_at: (editingId && findRec(editingId, formTab) && findRec(editingId, formTab).created_at) || nowStr(),
                        logo: { bg: v('f_bg') || '#00a751', fg: v('f_fg') || '#ffffff', icon: v('f_icon') || 'fa-solid fa-bolt' },
                        altTo: v('f_alt') ? v('f_alt').split('\n').map(line => {
                            const parts = line.split('|').map(s => s.trim());
                            return parts[0] ? { name: parts[0], bg: parts[1] || '#888888', fg: parts[2] || '#ffffff' } : null;
                        }).filter(Boolean) : []
                    };
                } else if (formTab === 'news') {
                    if (!v('f_title')) return errRequired('f_title');
                    rec = {
                        id: editingId || genId(),
                        title: v('f_title'),
                        source: v('f_source') || 'DropStack',
                        time: v('f_time') || 'just now',
                        link: v('f_link') ? (function(v){ try{ var u=new URL(String(v||'')); return /^https?:/.test(u.protocol)?u.href:'';}catch(e){return ''}})(v('f_link')) : '',
                        created_at: v('f_created') || nowStr(),
                        status: v('f_status') || 'published',
                        icon: v('f_icon') || 'fa-solid fa-bolt',
                        bg: v('f_bg') || '#00a751',
                        fg: v('f_fg') || '#ffffff'
                    };
                } else {
                    if (!v('f_title')) return errRequired('f_title');
                    rec = {
                        id: editingId || genId(),
                        status: v('f_status') || 'active',
                        title: v('f_title'),
                        bg: v('f_bg') || '#00a751',
                        fg: v('f_fg') || '#ffffff',
                        icon: v('f_icon') || 'fa-solid fa-bug',
                        text: v('f_text'),
                        link: v('f_link') ? (function(v){ try{ var u=new URL(String(v||'')); return /^https?:/.test(u.protocol)?u.href:'';}catch(e){return ''}})(v('f_link')) : '',
                        created_at: (editingId && findRec(editingId, formTab) && findRec(editingId, formTab).created_at) || nowStr()
                    };
                }

                const arr = tabArray(formTab);
                if (editingId) {
                    const i = arr.findIndex(r => r.id === editingId);
                    if (i > -1) arr[i] = rec;
                } else {
                    arr.unshift(rec);
                }
                persist(false, formTab);
                closeForm();
                renderAll();
            });

            /* ================= Row actions ================= */
            $('tableBody').addEventListener('click', (e) => {
                const btn = e.target.closest('[data-act]');
                if (!btn) return;
                const id = btn.dataset.id, act = btn.dataset.act;
                const arr = tabArray();
                const idx = arr.findIndex(r => r.id === id);
                if (idx < 0) return;
                const rec = arr[idx];

                if (act === 'edit') openForm(rec);

                if (act === 'toggle') {
                    rec.status = rec.status === 'draft' ? liveWord() : 'draft';
                    persist(); renderAll();
                    toast('Status → ' + rec.status);
                }

                if (act === 'dup') {
                    const copy = JSON.parse(JSON.stringify(rec));
                    copy.id = genId();
                    copy.created_at = nowStr();
                    copy.status = 'draft';
                    if (copy.name) copy.name += ' (copy)';
                    if (copy.title) copy.title += ' (copy)';
                    arr.splice(idx + 1, 0, copy);
                    persist(); renderAll();
                    toast('Duplicated as draft — ' + copy.id);
                }

                if (act === 'del') {
                    askConfirm('Delete record?', `"${rec.name || rec.title}" (id: ${id}) data file se permanently delete ho jayega.`, () => {
                        arr.splice(idx, 1);
                        persist(); renderAll();
                        toast('Deleted from data file', 'fa-solid fa-trash');
                    });
                }
            });

            /* ================= Confirm modal ================= */
            let confirmCb = null;
            function askConfirm(title, msg, cb) {
                $('confirmTitle').textContent = title;
                $('confirmMsg').textContent = msg;
                confirmCb = cb;
                $('confirmOverlay').classList.add('open');
            }
            const closeConfirm = () => $('confirmOverlay').classList.remove('open');
            $('confirmNo').addEventListener('click', closeConfirm);
            $('confirmYes').addEventListener('click', () => { closeConfirm(); if (confirmCb) confirmCb(); confirmCb = null; });
            $('confirmOverlay').addEventListener('click', (e) => { if (e.target === $('confirmOverlay')) closeConfirm(); });

            /* ================= Export (fallback) ================= */
            $('exportBtn').addEventListener('click', () => {
                const isNews = state.tab === 'news';
                const content = isNews ? buildNewsFile() : buildAlternativesFile();
                const blob = new Blob([content], { type: 'text/javascript' });
                const a = document.createElement('a');
                a.href = URL.createObjectURL(blob);
                a.download = isNews ? 'news.js' : 'alternatives.js';
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(() => URL.revokeObjectURL(a.href), 4000);
                toast((isNews ? 'news.js' : 'alternatives.js') + ' downloaded', 'fa-solid fa-download');
            });

            /* ================= Raw copy ================= */
            $('copyRawBtn').addEventListener('click', async () => {
                const text = rows().map(r => JSON.stringify(r)).join('\n');
                if (!text) return toast('Nothing to copy', 'fa-solid fa-triangle-exclamation');
                try {
                    await navigator.clipboard.writeText(text);
                    toast('Copied ' + rows().length + ' lines', 'fa-regular fa-copy');
                } catch (e) {
                    const taEl = document.createElement('textarea');
                    taEl.value = text; document.body.appendChild(taEl);
                    taEl.select(); document.execCommand('copy'); taEl.remove();
                    toast('Copied ' + rows().length + ' lines', 'fa-regular fa-copy');
                }
            });

            /* ================= Reset ================= */
            $('resetBtn').addEventListener('click', () => {
                askConfirm('Restore file data?', 'Original data par wapas jaoge. Agar files connected hain to disk files bhi overwrite ho jayengi.', () => {
                    DB = { alternatives: deep(FILE.alternatives), news: deep(FILE.news) };
                    persist(true, 'all'); renderAll();
                    toast('Restored', 'fa-solid fa-rotate-left');
                });
            });

            /* ================= Controls ================= */
            function syncTabUI() {
                document.querySelectorAll('.tab[data-tab]').forEach((tab) => {
                    tab.classList.toggle('active', tab.dataset.tab === state.tab);
                });
                const addLabel = $('addBtn').querySelector('span');
                if (addLabel) addLabel.textContent = 'Add ' + (TAB_LABELS[state.tab] || 'Data');
            }
            document.querySelectorAll('.tab[data-tab]').forEach(b => b.addEventListener('click', () => {
                state.tab = b.dataset.tab;
                syncTabUI();
                renderAll();
            }));

            const searchInput = $('searchInput');
            let sTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(sTimer);
                sTimer = setTimeout(() => { state.q = searchInput.value; renderAll(); }, 160);
            });
            $('statusFilter').addEventListener('change', (e) => { state.status = e.target.value; renderAll(); });

            $('viewTable').addEventListener('click', () => { state.view = 'table'; syncView(); });
            $('viewRaw').addEventListener('click', () => { state.view = 'raw'; syncView(); });
            function syncView() {
                $('viewTable').classList.toggle('on', state.view === 'table');
                $('viewRaw').classList.toggle('on', state.view === 'raw');
                renderAll();
            }

            $('addBtn').addEventListener('click', () => openForm(null));
            $('formClose').addEventListener('click', closeForm);
            $('formCancel').addEventListener('click', closeForm);
            $('formOverlay').addEventListener('click', (e) => { if (e.target === $('formOverlay')) closeForm(); });
            $('formOverlay').addEventListener('keydown', (e) => {
                if (e.key !== 'Tab') return;
                const focusable = [...$('formOverlay').querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])')]
                    .filter((element) => element.offsetParent !== null);
                if (!focusable.length) return;
                const first = focusable[0];
                const last = focusable[focusable.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                    e.preventDefault();
                    last.focus();
                } else if (!e.shiftKey && document.activeElement === last) {
                    e.preventDefault();
                    first.focus();
                }
            });

            /* ================= Keyboard ================= */
            document.addEventListener('keydown', (e) => {
                const typing = document.activeElement && ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName);
                if (e.key === 'Escape') { DropStackUI.closeMenu(); closeForm(); closeConfirm(); }
                if (e.key === '/' && !typing) { e.preventDefault(); searchInput.focus(); }
            });

            /* ================= Boot ================= */
            syncTabUI();
            syncModeUI();
            renderAll();
            if (!DATA_LOADED.alts || !DATA_LOADED.news) {
                const missing = [];
                if (!DATA_LOADED.alts) missing.push('data/alternatives.js');
                if (!DATA_LOADED.news) missing.push('data/news.js');
                const warn = document.createElement('div');
                warn.className = 'mt-4 flex items-start gap-3 rounded-xl border p-4 text-[13px]';
                warn.style.borderColor = 'color-mix(in srgb, #e5a13d 45%, var(--border))';
                warn.style.background = 'color-mix(in srgb, #e5a13d 8%, transparent)';
                warn.innerHTML = `
                    <i class="fa-solid fa-triangle-exclamation mt-0.5 text-[14px]" style="color:#e5a13d"></i>
                    <p class="leading-relaxed text-secondary">
                        <span class="font-semibold text-primary">${missing.join(' aur ')} load nahi hua.</span>
                        file:// protocol ki wajah se ho sakta hai — project folder ko local server se kholo
                        (<span class="mono">VS Code Live Server</span> ya <span class="mono">python -m http.server</span>, phir
                        <span class="mono">http://localhost:8000/admin.html</span>). Ya check karo ki files sahi path par hain.
                    </p>`;
                document.querySelector('main .mx-auto').insertBefore(warn, $('modeNote'));
            }
            if (!LOCAL_PENDING.alternatives) clearLS(LS.alts);
            if (!LOCAL_PENDING.news) clearLS(LS.news);
            if (fsState !== 'on' && hasPendingEdits()) $('dirtyBadge').classList.remove('hidden');
            restoreHandles();
        })();
