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

/* ─────────────────────────────────────────────
   Mobile TOC enhancement
   Injects a sticky collapsed TOC bar at the top
   of mobile pages (≤720px). The bar shows the
   current section name and expands to a full
   tappable list. Mirrors the desktop TOC's
   active state via MutationObserver — single
   source of truth stays the original scroll-spy.
   ───────────────────────────────────────────── */
(function () {
  'use strict';

  var desktopToc = document.querySelector('.toc');
  if (!desktopToc) return;

  var desktopList = desktopToc.querySelector('ul');
  if (!desktopList) return;

  // Build the mobile TOC element by cloning the desktop list and wrapping it
  // in our trigger + panel structure. Cloning preserves the link order and
  // text so we never duplicate the source of truth.
  var mobile = document.createElement('div');
  mobile.className = 'toc-mobile';
  mobile.setAttribute('aria-expanded', 'false');

  var trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'toc-mobile-trigger';
  trigger.setAttribute('aria-controls', 'toc-mobile-panel');
  trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML =
    '<span class="toc-m-label">On this page</span>' +
    '<span class="toc-m-divider" aria-hidden="true">·</span>' +
    '<span class="toc-m-current">Top of page</span>' +
    '<span class="toc-m-chevron" aria-hidden="true">▾</span>';

  var panel = document.createElement('div');
  panel.className = 'toc-mobile-panel';
  panel.id = 'toc-mobile-panel';

  // Clone the desktop list so structure stays in sync if it ever changes
  var clonedList = desktopList.cloneNode(true);
  panel.appendChild(clonedList);

  mobile.appendChild(trigger);
  mobile.appendChild(panel);

  // Insert at the very top of <main> so it sits below the masthead and above
  // the article content. Falls back to body if there's no <main>.
  var insertHost = document.querySelector('main') || document.body;
  insertHost.insertBefore(mobile, insertHost.firstChild);

  // Map mobile link → matching desktop link, so we can mirror active state.
  var mobileLinks = Array.prototype.slice.call(panel.querySelectorAll('a[href^="#"]'));
  var mobileLinkMap = {};
  mobileLinks.forEach(function (a) {
    mobileLinkMap[a.getAttribute('href')] = a;
  });

  var currentLabel = trigger.querySelector('.toc-m-current');

  function syncFromDesktop() {
    var active = desktopToc.querySelector('a.is-active');
    // Clear mobile active state
    mobileLinks.forEach(function (a) {
      a.classList.remove('is-active');
      a.removeAttribute('aria-current');
    });
    if (!active) {
      currentLabel.textContent = 'Top of page';
      return;
    }
    var href = active.getAttribute('href');
    var mobileMatch = mobileLinkMap[href];
    if (mobileMatch) {
      mobileMatch.classList.add('is-active');
      mobileMatch.setAttribute('aria-current', 'location');
    }
    // Update the collapsed-bar label to the active section's name
    currentLabel.textContent = active.textContent.trim();
  }

  // Initial sync (the original scroll-spy sets a default active link on load)
  syncFromDesktop();

  // Watch for active-link changes on the desktop TOC. MutationObserver fires
  // whenever scroll-spy adds/removes .is-active, keeping mobile in lock-step.
  var mo = new MutationObserver(syncFromDesktop);
  mo.observe(desktopToc, {
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'aria-current']
  });

  // ── Open / close behavior ──
  function setExpanded(open) {
    mobile.setAttribute('aria-expanded', String(open));
    trigger.setAttribute('aria-expanded', String(open));
  }

  trigger.addEventListener('click', function () {
    var isOpen = mobile.getAttribute('aria-expanded') === 'true';
    setExpanded(!isOpen);
  });

  // Tapping a link in the panel jumps to that section and auto-collapses.
  // The browser still handles the actual scroll via the anchor.
  panel.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    setExpanded(false);
    // Return focus to the trigger so keyboard users don't lose their place
    setTimeout(function () { trigger.focus(); }, 0);
  });

  // Close on outside tap
  document.addEventListener('click', function (e) {
    if (mobile.getAttribute('aria-expanded') !== 'true') return;
    if (!mobile.contains(e.target)) setExpanded(false);
  });

  // Close on Escape, returning focus to the trigger
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && mobile.getAttribute('aria-expanded') === 'true') {
      setExpanded(false);
      trigger.focus();
    }
  });
})();
