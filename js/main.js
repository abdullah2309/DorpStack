/* DropStack shared UI and directory-page behavior */
(function () {
    'use strict';

    const $ = (id) => document.getElementById(id);
    const store = {
        get(key, fallback) {
            try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; }
        },
        set(key, value) {
            try { localStorage.setItem(key, value); } catch (e) {}
        }
    };
    const esc = (value) => String(value ?? '').replace(/&/g, '&amp;')
        .replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    const safeUrl = (value) => {
        try {
            const url = new URL(String(value || ''));
            const host = url.hostname.toLowerCase();
            if (url.protocol !== 'https:' || (host !== 'github.com' && host !== 'www.github.com')) return '';
            return url.href;
        } catch (e) {
            return '';
        }
    };

    /* Shared appearance menu */
    const themeWrap = $('themeWrap');
    const themeBtn = $('themeBtn');
    const metaTheme = $('metaTheme');
    const tiSun = $('tiSun');
    const tiMoon = $('tiMoon');
    const tiMonitor = $('tiMonitor');
    let themeMode = store.get('oa-theme', 'dark');
    let animTimer;

    if (!['light', 'dark', 'system'].includes(themeMode)) themeMode = 'dark';

    const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

    function syncThemeButton() {
        if (tiSun) tiSun.classList.toggle('hidden', themeMode !== 'light');
        if (tiMoon) tiMoon.classList.toggle('hidden', themeMode !== 'dark');
        if (tiMonitor) tiMonitor.classList.toggle('hidden', themeMode !== 'system');
    }

    function applyTheme(animate) {
        const dark = themeMode === 'dark' || (themeMode === 'system' && prefersDark());
        const root = document.documentElement;
        if (animate !== false) {
            root.classList.add('theme-anim');
            clearTimeout(animTimer);
            animTimer = setTimeout(() => root.classList.remove('theme-anim'), 400);
        }
        root.classList.toggle('dark', dark);
        if (metaTheme) metaTheme.setAttribute('content', dark ? '#0a1310' : '#ffffff');
        syncThemeButton();
        document.querySelectorAll('[data-set-theme]').forEach((button) => {
            button.setAttribute('aria-selected', String(button.dataset.setTheme === themeMode));
        });
    }

    function closeMenu() {
        if (!themeWrap || !themeBtn) return;
        themeWrap.classList.remove('menu-open');
        themeBtn.setAttribute('aria-expanded', 'false');
    }

    if (themeWrap && themeBtn) {
        themeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const open = themeWrap.classList.toggle('menu-open');
            themeBtn.setAttribute('aria-expanded', String(open));
        });
        document.addEventListener('click', (event) => {
            if (!themeWrap.contains(event.target)) closeMenu();
        });
    }

    document.querySelectorAll('[data-set-theme]').forEach((button) => {
        button.addEventListener('click', () => {
            themeMode = button.dataset.setTheme;
            store.set('oa-theme', themeMode);
            applyTheme();
            closeMenu();
        });
    });

    const mql = window.matchMedia('(prefers-color-scheme: dark)');
    const onSystemTheme = () => {
        if (themeMode === 'system') applyTheme();
    };
    if (mql.addEventListener) mql.addEventListener('change', onSystemTheme);
    else if (mql.addListener) mql.addListener(onSystemTheme);
    applyTheme(false);

    window.DropStackUI = { applyTheme, closeMenu, esc, safeUrl };

    /* Shared mobile menu for the directory pages */
    const mobileMenu = document.querySelector('[data-shared-mobile-menu]');
    const mobileMenuButton = $('menuBtn');
    const miMenu = $('miMenu');
    const miClose = $('miClose');
    if (mobileMenu && mobileMenuButton) {
        const closeMobileMenu = () => {
            mobileMenu.classList.add('hidden');
            if (miMenu) miMenu.classList.remove('hidden');
            if (miClose) miClose.classList.add('hidden');
        };
        mobileMenuButton.addEventListener('click', () => {
            const open = !mobileMenu.classList.toggle('hidden');
            if (miMenu) miMenu.classList.toggle('hidden', open);
            if (miClose) miClose.classList.toggle('hidden', !open);
        });
        mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', closeMobileMenu));
    }

    /* Current year */
    document.querySelectorAll('[data-current-year]').forEach((node) => {
        node.textContent = String(new Date().getFullYear());
    });

    /* Projects page */
    const projectsList = $('projectsList');
    if (projectsList) {
        const products = ((window.ALTERNATIVES_DATA && window.ALTERNATIVES_DATA.products) || [])
            .filter((item) => item.status === 'active');
        const projectSearch = $('projectSearch');
        const projectCount = $('projectCount');

        const renderProjects = () => {
            const query = (projectSearch ? projectSearch.value : '').trim().toLowerCase();
            const items = products.filter((item) => !query || [
                item.name, item.description, item.license, ...(item.topics || []), ...(item.categories || [])
            ].join(' ').toLowerCase().includes(query));

            projectsList.innerHTML = items.length ? items.map((item, index) => {
                const github = safeUrl(item.github_url);
                const alternatives = (item.altTo || []).map((alt) => esc(alt.name)).join(', ') || 'Independent software';
                return `
                    <article class="card-item page-card" style="animation-delay:${Math.min(index * 30, 240)}ms">
                        <div class="tile" style="background:${esc(item.logo && item.logo.bg)};color:${esc(item.logo && item.logo.fg)}">
                            <i class="${esc(item.logo && item.logo.icon)} text-[20px]"></i>
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                    <h2 class="text-[16px] font-semibold text-primary">${esc(item.name)}</h2>
                                    <p class="mt-1 text-xs text-secondary">Alternative to ${alternatives}</p>
                                </div>
                                ${github ? `<a href="${esc(github)}" target="_blank" rel="noopener noreferrer" class="btn btn-outline !h-8"><i class="fa-brands fa-github text-[13px]"></i> GitHub</a>` : ''}
                            </div>
                            <p class="mt-3 text-sm leading-relaxed text-secondary">${esc(item.description)}</p>
                            <div class="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-secondary">
                                <span class="pricing-badge">${esc(item.pricing)}</span>
                                <span class="license-chip"><i class="fa-solid fa-scale-balanced text-[10px]"></i>${esc(item.license)}</span>
                                <span class="font-mono">${Number(item.votes || 0).toLocaleString('en-US')} votes</span>
                            </div>
                        </div>
                    </article>`;
            }).join('') : '<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>No projects found.</p></div>';

            if (projectCount) projectCount.textContent = items.length + (items.length === 1 ? ' project' : ' projects');
        };

        if (projectSearch) projectSearch.addEventListener('input', renderProjects);
        renderProjects();
    }

    /* News page */
    const newsPageList = $('newsPageList');
    if (newsPageList) {
        const news = (window.NEWS_DATA || []).filter((item) => item.status === 'published');
        const newsCount = $('newsPageCount');
        newsPageList.innerHTML = news.length ? news.map((item, index) => `
            <article class="card-item page-card" style="animation-delay:${Math.min(index * 35, 240)}ms">
                <div class="news-tile" style="background:${esc(item.bg)};color:${esc(item.fg)}">
                    <i class="${esc(item.icon)} text-[17px]"></i>
                </div>
                <div class="min-w-0 flex-1">
                    <div class="flex flex-wrap items-center gap-2 text-[11px] text-secondary">
                        <span class="font-semibold text-primary">${esc(item.source)}</span>
                        <span>·</span>
                        <span class="font-mono">${esc(item.time)}</span>
                    </div>
                    <h2 class="mt-2 text-[15px] font-semibold leading-snug text-primary">${esc(item.title)}</h2>
                    <p class="mt-2 font-mono text-[10.5px] text-secondary">${esc(String(item.created_at || '').slice(0, 10))}</p>
                </div>
            </article>`).join('') : '<div class="empty-state"><i class="fa-solid fa-newspaper"></i><p>No news published yet.</p></div>';
        if (newsCount) newsCount.textContent = news.length + (news.length === 1 ? ' story' : ' stories');
    }
})();
