/* DropStack public card links. Record links are entered in the admin panel. */
(function(){'use strict';
  var esc=window.DropStackUI&&DropStackUI.esc||function(v){return String(v||'')};
  function url(v){try{var u=new URL(String(v||''));return /^https?:$/.test(u.protocol)?u.href:''}catch(e){return ''}}
  function open(link){var u=url(link);if(u)window.open(u,'_blank','noopener,noreferrer')}
  function enhance(){
    var products=(window.ALTERNATIVES_DATA&&window.ALTERNATIVES_DATA.products)||[], news=window.NEWS_DATA||[], ads=(window.ALTERNATIVES_DATA&&window.ALTERNATIVES_DATA.ads)||[];
    document.querySelectorAll('[data-project-id]').forEach(function(card){var p=products.find(function(x){return x.id===card.dataset.projectId});if(p&&p.link)card.dataset.externalLink=p.link});
    var projectCards=[].slice.call(document.querySelectorAll('#projectsList .card-item'));projectCards.forEach(function(card,i){if(products[i]&&products[i].link)card.dataset.externalLink=products[i].link});
    var newsCards=[].slice.call(document.querySelectorAll('#newsPageList .card-item'));newsCards.forEach(function(card,i){if(news[i]&&news[i].link)card.dataset.externalLink=news[i].link});
    var sideNews=[].slice.call(document.querySelectorAll('#newsList .news-item'));sideNews.forEach(function(card,i){if(news[i]&&news[i].link){card.href=news[i].link;card.target='_blank';card.rel='noopener noreferrer'}});
    var adCards=[].slice.call(document.querySelectorAll('#list .card-item')).filter(function(c){return c.querySelector('.ad-pill')});adCards.forEach(function(card,i){if(ads[i]&&ads[i].link)card.dataset.externalLink=ads[i].link});
    document.querySelectorAll('[data-external-link]').forEach(function(card){if(card.dataset.linkBound)return;card.dataset.linkBound='1';card.style.cursor='pointer';card.addEventListener('click',function(e){if(e.target.closest('a,button,input,textarea,select'))return;open(card.dataset.externalLink)})});
  }
  new MutationObserver(enhance).observe(document.body,{childList:true,subtree:true});enhance();
})();
