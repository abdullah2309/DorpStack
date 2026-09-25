/* DropStack admin enhancements — now integrated directly into admin.html.
 * This file is kept for backward compatibility and does nothing when
 * there is no embedded data manager frame. Admin link fields are handled
 * natively in the professional admin panel (admin.html) for Drops, news
 * and ads — each card opens its link in a new tab via js/card-links.js.
 */
(function () {
  'use strict';
  // If someone still loads an old data.html inside admin, redirect to admin.
  if (location.pathname.endsWith('data.html')) {
    location.replace('admin.html');
    return;
  }
  var frame = document.querySelector('.panel-frame');
  if (!frame) return;
  // Legacy iframe path no longer used — hide frame and suggest admin.
  frame.addEventListener('load', function () {
    var doc = frame.contentDocument;
    if (!doc) return;
    var note = doc.createElement('div');
    note.style.cssText = 'margin:12px;padding:10px;border:1px solid var(--border);border-radius:10px;background:var(--card);color:var(--secondary);font-size:12px';
    note.textContent = 'This embedded manager is deprecated — please use admin.html directly.';
    doc.body.prepend(note);
  });
}());
