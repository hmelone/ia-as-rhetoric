/* ─────────────────────────────────────────────
   scroll-spy.js
   Highlights the corresponding link in the
   "On this page" TOC as the user scrolls
   through the article. Pure vanilla JS with
   IntersectionObserver — no dependencies.
   Degrades gracefully: if JS is off or the
   browser doesn't support IntersectionObserver,
   the anchor links still work as anchor jumps.
   ───────────────────────────────────────────── */
(function () {
  'use strict';

  if (!('IntersectionObserver' in window)) return;

  var toc = document.querySelector('.toc');
  if (!toc) return;

  var tocLinks = Array.prototype.slice.call(toc.querySelectorAll('a[href^="#"]'));
  if (!tocLinks.length) return;

  // Build a map from heading id → TOC link element
  var linkMap = {};
  var headings = [];
  tocLinks.forEach(function (link) {
    var id = link.getAttribute('href').slice(1);
    var heading = document.getElementById(id);
    if (heading) {
      linkMap[id] = link;
      headings.push(heading);
    }
  });

  if (!headings.length) return;

  // Track which headings are currently in view; the topmost one wins.
  var visible = new Set();

  function updateActive() {
    if (!visible.size) return;
    // Find the visible heading that's highest on the page
    var topId = null;
    var topY = Infinity;
    visible.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var rect = el.getBoundingClientRect();
      if (rect.top < topY) {
        topY = rect.top;
        topId = id;
      }
    });
    tocLinks.forEach(function (link) {
      link.classList.remove('is-active');
      link.removeAttribute('aria-current');
    });
    if (topId && linkMap[topId]) {
      linkMap[topId].classList.add('is-active');
      // aria-current="location" tells screen readers that this is the
      // section the user is currently positioned in. Updates as they scroll.
      linkMap[topId].setAttribute('aria-current', 'location');
    }
  }

  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      var id = entry.target.id;
      if (entry.isIntersecting) {
        visible.add(id);
      } else {
        visible.delete(id);
      }
    });
    updateActive();
  }, {
    // A heading "counts as in view" when it crosses into the top
    // 35% of the viewport. This avoids flicker between adjacent
    // sections and matches where readers' attention typically sits.
    rootMargin: '0px 0px -65% 0px',
    threshold: 0
  });

  headings.forEach(function (h) { observer.observe(h); });

  // On initial load, set the active link to the first heading
  // if no other has been activated yet (e.g. user lands at top of page).
  if (!toc.querySelector('a.is-active') && headings.length) {
    var first = headings[0].id;
    if (linkMap[first]) {
      linkMap[first].classList.add('is-active');
      linkMap[first].setAttribute('aria-current', 'location');
    }
  }
})();
