/* DropStack shared UI and directory-page behavior */
(function () {
    'use strict';
    const $ = (id) => document.getElementById(id);
    const store = { get(key, fallback) { try { return localStorage.getItem(key) ?? fallback; } catch (e) { return fallback; } }, set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} } };
    const esc = (value) => String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
    const safeUrl = (value) => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' && ['github.com','www.github.com'].includes(url.hostname.toLowerCase()) ? url.href : ''; } catch (e) { return ''; } };
    const anyLink = (value) => { try { const u = new URL(String(value || '')); return /^https?:$/.test(u.protocol) ? u.href : ''; } catch (e) { return ''; } };
    const themeWrap = $('themeWrap'), themeBtn = $('themeBtn'), metaTheme = $('metaTheme'), tiSun = $('tiSun'), tiMoon = $('tiMoon'), tiMonitor = $('tiMonitor');
    let themeMode = store.get('oa-theme', 'dark'), animTimer; if (!['light','dark','system'].includes(themeMode)) themeMode = 'dark';
    const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    function applyTheme(animate) { const dark = themeMode === 'dark' || (themeMode === 'system' && prefersDark()); const root = document.documentElement; if (animate !== false) { root.classList.add('theme-anim'); clearTimeout(animTimer); animTimer = setTimeout(() => root.classList.remove('theme-anim'), 400); } root.classList.toggle('dark', dark); if (metaTheme) metaTheme.setAttribute('content', dark ? '#0a1310' : '#ffffff'); if (tiSun) tiSun.classList.toggle('hidden', themeMode !== 'light'); if (tiMoon) tiMoon.classList.toggle('hidden', themeMode !== 'dark'); if (tiMonitor) tiMonitor.classList.toggle('hidden', themeMode !== 'system'); document.querySelectorAll('[data-set-theme]').forEach(b => b.setAttribute('aria-selected', String(b.dataset.setTheme === themeMode))); }
    function closeMenu() { if (!themeWrap || !themeBtn) return; themeWrap.classList.remove('menu-open'); themeBtn.setAttribute('aria-expanded','false'); }
    if (themeWrap && themeBtn) { themeBtn.addEventListener('click', e => { e.stopPropagation(); const open = themeWrap.classList.toggle('menu-open'); themeBtn.setAttribute('aria-expanded',String(open)); }); document.addEventListener('click', e => { if (!themeWrap.contains(e.target)) closeMenu(); }); }
    document.querySelectorAll('[data-set-theme]').forEach(b => b.addEventListener('click', () => { themeMode=b.dataset.setTheme; store.set('oa-theme',themeMode); applyTheme(); closeMenu(); })); applyTheme(false);
    window.DropStackUI = { applyTheme, closeMenu, esc, safeUrl, anyLink };
    const mobileMenu=document.querySelector('[data-shared-mobile-menu]')||$('mobileMenu'), mobileButton=$('menuBtn'), miMenu=$('miMenu'), miClose=$('miClose'); if(mobileMenu&&mobileButton){const closeMobile=()=>{mobileMenu.classList.add('hidden');if(miMenu)miMenu.classList.remove('hidden');if(miClose)miClose.classList.add('hidden')};mobileButton.addEventListener('click',()=>{const open=!mobileMenu.classList.toggle('hidden');if(miMenu)miMenu.classList.toggle('hidden',open);if(miClose)miClose.classList.toggle('hidden',!open)});mobileMenu.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMobile))}
    document.querySelectorAll('[data-current-year]').forEach(n=>n.textContent=String(new Date().getFullYear()));
    const projectsList=$('projectsList');
    if(projectsList){
        const products=((window.ALTERNATIVES_DATA&&window.ALTERNATIVES_DATA.products)||[]).filter(i=>i.status==='active');
        const search=$('projectSearch'), count=$('projectCount');
        const render=()=>{
            const q=(search?search.value:'').trim().toLowerCase();
            const items=products.filter(i=>!q||[i.name,i.description,i.license,...(i.topics||[]),...(i.categories||[])].join(' ').toLowerCase().includes(q));
            projectsList.innerHTML=items.length?items.map(i=>{
                const link=anyLink(i.link);
                const linkAttr=link?` data-external-link="${esc(link)}" style="cursor:pointer"`: '';
                return `<article class="card-item page-card" data-drop-id="${esc(i.id)}" data-project-id="${esc(i.id)}"`+linkAttr+`><div class="tile" style="background:${esc(i.logo&&i.logo.bg)};color:${esc(i.logo&&i.logo.fg)}"><i class="${esc(i.logo&&i.logo.icon)} text-[20px]"></i></div><div class="min-w-0 flex-1"><h2 class="text-[16px] font-semibold text-primary">${esc(i.name)}</h2><p class="mt-1 text-xs text-secondary">Drop alternative to ${(i.altTo||[]).map(a=>esc(a.name)).join(', ')||'Independent software'}</p><p class="mt-3 text-sm leading-relaxed text-secondary">${esc(i.description)}</p><div class="mt-4 flex gap-2"><span class="pricing-badge">${esc(i.pricing)}</span><span class="license-chip">${esc(i.license)}</span></div>`+(link?`<p class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-accent">Visit <i class="fa-solid fa-arrow-right text-[10px]"></i></p>`:'')+`</div></article>`;
            }).join(''):'<div class="empty-state"><i class="fa-solid fa-magnifying-glass"></i><p>No Drops found.</p></div>';
            if(count)count.textContent=items.length+(items.length===1?' Drop':' Drops');
        };
        if(search)search.addEventListener('input',render);render();
    }
    const newsList=$('newsPageList');
    if(newsList){
        const items=(window.NEWS_DATA||[]).filter(i=>i.status==='published');
        newsList.innerHTML=items.length?items.map(i=>{
            const link=anyLink(i.link);
            const attr=link?` data-external-link="${esc(link)}" data-news-id="${esc(i.id)}" style="cursor:pointer"`:` data-news-id="${esc(i.id)}"`;
            return `<article class="card-item page-card"`+attr+`><div class="news-tile" style="background:${esc(i.bg)};color:${esc(i.fg)}"><i class="${esc(i.icon)}"></i></div><div><div class="text-xs text-secondary">${esc(i.source)} · ${esc(i.time)}</div><h2 class="mt-2 text-[15px] font-semibold">${esc(i.title)}</h2><p class="mt-2 font-mono text-[10px] text-secondary">${esc(i.created_at||'')}</p>`+(link?`<p class="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent">Read more <i class="fa-solid fa-arrow-right text-[10px]"></i></p>`:'')+`</div></article>`;
        }).join(''):'<div class="empty-state"><p>No news published yet.</p></div>';
        const c=$('newsPageCount');if(c)c.textContent=items.length+(items.length===1?' story':' stories');
    }
    const linkScript=document.createElement('script');linkScript.src='js/card-links.js';document.body.appendChild(linkScript);
})();
