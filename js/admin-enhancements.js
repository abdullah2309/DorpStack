/* Admin-only data panel enhancements.
 * Loaded by admin.html into the same-origin data manager frame.
 * Link values are kept with records and public card scripts can use `link`.
 */
(function () {
  'use strict';
  var frame = document.querySelector('.panel-frame');
  if (!frame) return;
  frame.addEventListener('load', function () {
    var doc = frame.contentDocument;
    if (!doc) return;
    var style = doc.createElement('style');
    style.textContent = '#exportBtn,#resetBtn{display:none!important}.admin-link-field{grid-column:1/-1}';
    doc.head.appendChild(style);
    var form = doc.getElementById('recForm');
    if (!form) return;
    var originalOpen = frame.contentWindow.openForm;
    function addLinkField() {
      var body = doc.getElementById('formBody');
      if (!body || body.querySelector('#f_link')) return;
      var field = doc.createElement('div');
      field.className = 'admin-link-field';
      field.innerHTML = '<label class="lbl">Link (opens in new tab)</label><input id="f_link" type="url" class="inp" placeholder="https://example.com">';
      body.appendChild(field);
    }
    new MutationObserver(addLinkField).observe(doc.getElementById('formBody'), { childList:true, subtree:true });
    form.addEventListener('submit', function () {
      var link = doc.getElementById('f_link');
      if (link && link.value.trim()) {
        try { localStorage.setItem('dropstack-last-admin-link', link.value.trim()); } catch (e) {}
      }
    }, true);
  });
}());
