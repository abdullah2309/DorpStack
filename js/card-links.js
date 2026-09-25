/* DropStack public card links. Record links are entered in the admin panel and open in a new tab. */
(function(){
  'use strict';
  var esc = window.DropStackUI && DropStackUI.esc || function(v){ return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;'); };
  function url(v){ try{ var u=new URL(String(v||'')); return /^https?:$/.test(u.protocol)?u.href:'';}catch(e){ return '';} }
  function open(link){ var u=url(link); if(u) window.open(u, '_blank', 'noopener,noreferrer'); }

  function enhance(){
    var products=(window.ALTERNATIVES_DATA&&window.ALTERNATIVES_DATA.products)||[];
    var news=window.NEWS_DATA||[];
    var ads=(window.ALTERNATIVES_DATA&&window.ALTERNATIVES_DATA.ads)||[];

    // Home page Drops (data-drop-id or data-project-id)
    document.querySelectorAll('[data-drop-id], [data-project-id]').forEach(function(card){
      var id = card.getAttribute('data-drop-id') || card.getAttribute('data-project-id');
      var p = products.find(function(x){ return String(x.id)===String(id); });
      if(p && p.link && url(p.link)) card.setAttribute('data-external-link', url(p.link));
    });

    // Drops page fallback (projectsList) - already has data-external-link from main.js, but ensure
    var projectCards=[].slice.call(document.querySelectorAll('#projectsList .card-item'));
    projectCards.forEach(function(card,i){
      if(!card.getAttribute('data-external-link') && products[i] && products[i].link) {
        var u=url(products[i].link);
        if(u) card.setAttribute('data-external-link', u);
      }
    });

    // News page cards
    document.querySelectorAll('[data-news-id]').forEach(function(card){
      var id=card.getAttribute('data-news-id');
      var n=news.find(function(x){ return String(x.id)===String(id); });
      if(n && n.link && url(n.link)) card.setAttribute('data-external-link', url(n.link));
    });
    var newsCards=[].slice.call(document.querySelectorAll('#newsPageList .card-item'));
    newsCards.forEach(function(card,i){
      if(!card.getAttribute('data-external-link') && news[i] && news[i].link){
        var u=url(news[i].link); if(u) card.setAttribute('data-external-link', u);
      }
    });

    // Sidebar news (home)
    var sideNews=[].slice.call(document.querySelectorAll('#newsList .news-item'));
    sideNews.forEach(function(card,i){
      var n=news[i];
      if(n && n.link && url(n.link)){
        card.href=url(n.link);
        card.target='_blank';
        card.rel='noopener noreferrer';
      } else if(n) {
        // keep as # if no link, prevent navigation
        card.removeAttribute('target');
      }
    });

    // Ads on homepage (#list)
    var adCards=[].slice.call(document.querySelectorAll('#list .card-item')).filter(function(c){ return c.querySelector('.ad-pill'); });
    adCards.forEach(function(card,i){
      if(!card.getAttribute('data-external-link') && ads[i] && ads[i].link){
        var u=url(ads[i].link); if(u) card.setAttribute('data-external-link', u);
      }
    });
    // Ads data array index mapping for ads not in homepage list but on other pages could be indexed differently - also check by title fallback
    document.querySelectorAll('.card-item').forEach(function(card){
      if(card.hasAttribute('data-external-link')) return;
      var titleEl=card.querySelector('h3');
      if(!titleEl) return;
      var title=titleEl.textContent.trim();
      var found=ads.find(function(a){ return a.title===title && a.link; });
      if(found) {
        var u=url(found.link); if(u) card.setAttribute('data-external-link', u);
      }
    });

    // Bind click handlers
    document.querySelectorAll('[data-external-link]').forEach(function(card){
      if(card.dataset.linkBound==='1') return;
      card.dataset.linkBound='1';
      card.style.cursor='pointer';
      // visual hint
      if(!card.querySelector('.link-hint')){
        // no extra hint needed, already styled
      }
      card.addEventListener('click', function(e){
        if(e.target.closest('a,button,input,textarea,select')) return;
        open(card.getAttribute('data-external-link'));
      });
      // keyboard accessibility
      if(!card.hasAttribute('tabindex')){
        card.setAttribute('tabindex','0');
        card.setAttribute('role','link');
        card.addEventListener('keydown', function(e){
          if(e.key==='Enter' || e.key===' '){
            e.preventDefault();
            open(card.getAttribute('data-external-link'));
          }
        });
      }
    });
  }

  // Run on load and on DOM changes (for filtered lists)
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', enhance);
  else enhance();
  new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});
  // also re-run after a short delay to catch async renders
  setTimeout(enhance, 300);
  setTimeout(enhance, 1000);
})();
