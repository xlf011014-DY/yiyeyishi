/* ============================================================
   app.js — worlds router, theme, scroll orchestration, sheet, nav
   ============================================================ */
(function () {
  'use strict';

  var MS = window.MotionSpring;
  var clamp = MS.clamp;

  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  var root = document.documentElement;
  var body = document.body;
  var stage = $('#stage');
  var topbar = $('#topbar');
  var progressBar = $('#progress-bar');
  var toastEl = $('#toast');
  var toastTimer = 0;

  var screens = {
    home: $('#screen-home'),
    lingcha: $('#screen-lingcha'),
    shanxiafeng: $('#screen-shanxiafeng')
  };
  var scrollers = {
    home: $('[data-scroll]', screens.home),
    lingcha: $('[data-scroll]', screens.lingcha),
    shanxiafeng: $('[data-scroll]', screens.shanxiafeng)
  };

  var state = {
    world: 'home',
    themeMode: body.dataset.themeMode || 'auto',
    reduce: root.classList.contains('reduce-motion'),
    sheetOpen: false
  };

  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  var vtActive = false;

  // Guarded View Transition: never stack transitions (browsers skip and warn).
  function viewTransition(update, enabled) {
    if (enabled && document.startViewTransition && !vtActive && !document.hidden) {
      vtActive = true;
      var vt = document.startViewTransition(update);
      vt.finished.finally(function () { vtActive = false; });
      vt.ready.catch(function () { /* transition skipped */ });
      vt.updateCallbackDone.catch(function () { /* noop */ });
    } else {
      update();
    }
  }

  /* ------------------------------------------------------------
     utilities
     ------------------------------------------------------------ */
  function safeStore(key, value) {
    try {
      if (typeof value === 'undefined') return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* file:// or privacy mode */ }
    return null;
  }

  function toast(message, duration) {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.classList.add('is-show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('is-show'); }, duration || 1900);
  }

  function prefersFinePointer() {
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  }

  function motionOK() {
    return !state.reduce && !MS.reduced();
  }

  /* ------------------------------------------------------------
     theme
     ------------------------------------------------------------ */
  function resolveTheme(mode) {
    if (mode === 'auto') return systemDark.matches ? 'dark' : 'light';
    return mode === 'dark' ? 'dark' : 'light';
  }

  function updateThemeUI() {
    $$('[data-theme-btn]').forEach(function (btn) {
      var active = btn.dataset.themeBtn === state.themeMode;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    var meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = body.dataset.theme === 'dark' ? '#131211' : '#F6F2E8';
    // segmented pill for theme control
    updateSegPill($('#theme-seg'));
  }

  function applyTheme(mode, options) {
    options = options || {};
    state.themeMode = mode;
    safeStore('site-theme', mode);
    var next = resolveTheme(mode);
    updateThemeUI();
    if (next === body.dataset.theme) return;

    var commit = function () { body.dataset.theme = next; updateThemeUI(); };

    if (options.animate !== false && motionOK()) {
      var origin = options.origin;
      var x = 50, y = 10;
      if (origin && origin.getBoundingClientRect) {
        var r = origin.getBoundingClientRect();
        x = ((r.left + r.width / 2) / window.innerWidth) * 100;
        y = ((r.top + r.height / 2) / window.innerHeight) * 100;
      }
      root.style.setProperty('--vt-x', x + '%');
      root.style.setProperty('--vt-y', y + '%');
      viewTransition(function () {
        root.classList.add('theme-vt');
        commit();
      }, true);
      setTimeout(function () { root.classList.remove('theme-vt'); }, 900);
    } else {
      commit();
    }
  }

  systemDark.addEventListener('change', function () {
    if (state.themeMode === 'auto') applyTheme('auto');
  });

  /* ------------------------------------------------------------
     segmented controls
     ------------------------------------------------------------ */
  function updateSegPill(seg) {
    if (!seg) return;
    var pill = $('.segmented__pill', seg);
    if (!pill) return;
    var active = $('.segmented__btn.is-active', seg);
    if (!active) return;
    var isTiny = seg.classList.contains('segmented--tiny');
    var offset = isTiny ? 3 : 4;
    pill.style.setProperty('--pill-w', active.offsetWidth + 'px');
    pill.style.setProperty('--pill-x', active.offsetLeft + 'px');
  }

  function initSegmented(seg, onChange) {
    if (!seg) return;
    var buttons = $$('.segmented__btn', seg);

    function activate(btn, fromUser) {
      buttons.forEach(function (b) {
        var active = b === btn;
        b.classList.toggle('is-active', active);
        b.setAttribute('aria-selected', active ? 'true' : 'false');
      });
      updateSegPill(seg);
      if (fromUser && onChange) onChange(btn);
    }

    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () { activate(btn, true); });
      btn.addEventListener('keydown', function (e) {
        var i = buttons.indexOf(btn);
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); activate(buttons[(i + 1) % buttons.length], true); buttons[(i + 1) % buttons.length].focus(); }
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); activate(buttons[(i - 1 + buttons.length) % buttons.length], true); buttons[(i - 1 + buttons.length) % buttons.length].focus(); }
      });
    });

    window.addEventListener('resize', function () { updateSegPill(seg); });
    return { activate: activate, update: function () { updateSegPill(seg); } };
  }

  /* ------------------------------------------------------------
     worlds router
     ------------------------------------------------------------ */
  function updateNavState() {
    $$('[data-world-btn]').forEach(function (btn) {
      var active = btn.dataset.worldBtn === state.world;
      btn.classList.toggle('is-active', active);
      btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    updateSegPill($('#world-switch'));
    updateTabPill();
  }

  function updateTabPill() {
    var tabbar = $('#tabbar');
    if (!tabbar) return;
    var pill = $('.tabbar__pill', tabbar);
    var active = $('.tabbar__btn.is-active', tabbar);
    if (!pill || !active) return;
    pill.style.setProperty('--tab-w', active.offsetWidth + 'px');
    pill.style.setProperty('--tab-x', active.offsetLeft + 'px');
  }

  function scanReveals(screen) {
    if (!screen) return;
    var scroller = $('[data-scroll]', screen);
    if (!scroller) return;
    var sRect = scroller.getBoundingClientRect();
    $$('.reveal', screen).forEach(function (el) {
      if (el.classList.contains('is-in')) return;
      var r = el.getBoundingClientRect();
      if (r.top < sRect.bottom - 40 && r.bottom > sRect.top + 20) {
        var delay = el.dataset.delay ? parseInt(el.dataset.delay, 10) : 0;
        el.style.setProperty('--delay', delay);
        el.classList.add('is-in');
        startCounters(el);
      }
    });
  }

  function commitWorld(world) {
    state.world = world;
    body.dataset.world = world;
    Object.keys(screens).forEach(function (key) {
      var screen = screens[key];
      var active = key === world;
      screen.classList.toggle('is-active', active);
      screen.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) screen.removeAttribute('inert'); else screen.setAttribute('inert', '');
    });
    updateNavState();
    requestAnimationFrame(function () {
      scanReveals(screens[world]);
      updateScrollChrome(screens[world], scrollers[world], true);
      measureSheet();
    });
  }

  function switchWorld(world, options) {
    options = options || {};
    if (!screens[world] || world === state.world) return;
    closeSheet();
    var run = function () { commitWorld(world); };
    if (!options.instant && motionOK()) {
      viewTransition(run, true);
    } else {
      run();
    }
    if (options.push !== false) {
      try { history.pushState({ world: world }, '', '#/' + world); } catch (e) { /* file:// */ }
    }
  }

  function readWorldFromHash() {
    var hash = (location.hash || '').replace(/^#\/?/, '');
    if (screens[hash]) return hash;
    return 'home';
  }

  window.addEventListener('hashchange', function () {
    var world = readWorldFromHash();
    if (world !== state.world) switchWorld(world, { push: false });
  });
  window.addEventListener('popstate', function () {
    var world = readWorldFromHash();
    if (world !== state.world) switchWorld(world, { push: false });
  });

  /* ------------------------------------------------------------
     scroll orchestration
     ------------------------------------------------------------ */
  var scrollTicking = false;

  function updateScrollChrome(screen, scroller, force) {
    if (!screen || !scroller) return;
    var top = scroller.scrollTop;
    var max = Math.max(1, scroller.scrollHeight - scroller.clientHeight);
    var progress = clamp(top / max, 0, 1);
    if (screen === screens[state.world]) {
      progressBar.style.transform = 'scaleX(' + progress + ')';
      topbar.classList.toggle('is-compact', top > 48);
    }
    updateHeroFade(screen, scroller);
    updateParallax(screen, scroller);
    updateStickyQuote(screen, scroller);
    updateRoad(screen, scroller);
  }

  function updateHeroFade(screen, scroller) {
    var hero = screen.querySelector('.hero');
    if (!hero) return;
    if (state.reduce) {
      hero.style.opacity = '';
      hero.style.transform = '';
      return;
    }
    var vh = window.innerHeight || 800;
    var p = clamp(scroller.scrollTop / (vh * 0.78), 0, 1);
    hero.style.opacity = (1 - p * 0.92).toFixed(3);
    hero.style.transform = 'translate3d(0,' + (p * 56).toFixed(1) + 'px,0)';
  }

  function updateParallax(screen, scroller) {
    if (state.reduce) return;
    var sRect = scroller.getBoundingClientRect();
    var middle = sRect.top + sRect.height / 2;
    $$('[data-parallax]', screen).forEach(function (el) {
      var r = el.getBoundingClientRect();
      var speed = parseFloat(el.dataset.parallax) || 0;
      var delta = (r.top + r.height / 2 - middle) * speed;
      el.style.transform = 'translate3d(0,' + delta.toFixed(1) + 'px,0)';
    });
  }

  // sticky quote scrubbing
  var quoteEl = $('#lc-quote');
  var quoteText = $('[data-quote-scrub]');
  function updateStickyQuote(screen, scroller) {
    if (!quoteEl || !quoteText || screen !== screens.lingcha) return;
    if (state.reduce) {
      quoteText.style.opacity = '1';
      quoteText.style.transform = 'none';
      quoteText.style.filter = 'none';
      return;
    }
    var r = quoteEl.getBoundingClientRect();
    var vh = window.innerHeight;
    var q = clamp((vh * 0.86 - r.top) / (vh * 0.72), 0, 1);
    quoteText.style.opacity = (0.18 + 0.82 * q).toFixed(3);
    quoteText.style.transform = 'translate3d(0,' + ((1 - q) * 46).toFixed(1) + 'px,0) scale(' + (0.965 + 0.035 * q).toFixed(3) + ')';
    quoteText.style.filter = 'blur(' + ((1 - q) * 7).toFixed(2) + 'px)';
  }

  // 山下夆 three-step road
  var roadEl = $('#road-progress');
  function updateRoad(screen, scroller) {
    if (!roadEl || screen !== screens.shanxiafeng) return;
    var road = roadEl.closest('.road');
    if (!road) return;
    var r = road.getBoundingClientRect();
    var vh = window.innerHeight;
    var q = state.reduce ? 1 : clamp((vh * 0.68 - r.top) / (r.height * 0.9), 0.08, 1);
    road.style.setProperty('--road', q.toFixed(3));
  }

  Object.keys(scrollers).forEach(function (key) {
    var scroller = scrollers[key];
    scroller.addEventListener('scroll', function () {
      if (scrollTicking) return;
      scrollTicking = true;
      requestAnimationFrame(function () {
        scrollTicking = false;
        updateScrollChrome(screens[key], scroller);
      });
    }, { passive: true });
  });

  /* ------------------------------------------------------------
     reveals & counters
     ------------------------------------------------------------ */
  var revealObserver = null;
  function initReveals() {
    if (!('IntersectionObserver' in window)) {
      $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
      return;
    }
    revealObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var screen = el.closest('.screen');
        if (!screen || !screen.classList.contains('is-active')) return;
        var delay = el.dataset.delay ? parseInt(el.dataset.delay, 10) : 0;
        el.style.setProperty('--delay', delay);
        el.classList.add('is-in');
        startCounters(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });

    $$('.reveal').forEach(function (el) { revealObserver.observe(el); });
  }

  function startCounters(scope) {
    $$('.count', scope).forEach(function (el) {
      if (el.dataset.counted) return;
      el.dataset.counted = '1';
      var target = parseFloat(el.dataset.count) || 0;
      var suffix = el.dataset.suffix || '';
      if (state.reduce) { el.textContent = String(target) + suffix; return; }
      var spring = MS.spring(0, {
        response: 0.9,
        damping: 1,
        onUpdate: function (v) {
          el.textContent = String(Math.round(v)) + (v >= target - 0.4 ? suffix : '');
        }
      });
      spring.to(target);
    });
  }

  /* ------------------------------------------------------------
     sheet
     ------------------------------------------------------------ */
  var sheetRoot = $('#sheet-root');
  var sheet = $('#sheet');
  var scrim = $('#scrim');
  var sheetGrab = $('#sheet-grab');
  var sheetHead = $('.sheet__head');
  var sheetClose = $('#sheet-close');
  var lastFocus = null;
  var sheetTop = 0;
  var closedY = 0;
  var sheetSpring = null;
  var dragging = false;
  var dragStartY = 0;
  var dragStartSheet = 0;
  var sheetHeight = 0;
  var sheetHistory = [];
  var sheetMomentum = 0;

  function measureSheet() {
    if (!sheet) return;
    sheetHeight = sheet.offsetHeight || 620;
    closedY = sheetHeight + 80;
    if (!state.sheetOpen) {
      sheet.style.transform = 'translate3d(-50%,' + closedY + 'px,0)';
    }
  }

  function setSheetY(y) {
    sheetTop = y;
    sheet.style.transform = 'translate3d(-50%,' + y + 'px,0)';
    var open = 1 - clamp(y / Math.max(1, closedY), 0, 1);
    scrim.style.opacity = String(open);
    if (open > 0.02) {
      document.body.classList.add('sheet-open');
    } else {
      document.body.classList.remove('sheet-open');
    }
  }

  function animateSheetTo(y, velocity) {
    if (sheetSpring) sheetSpring.stop();
    sheetSpring = MS.spring(sheetTop, {
      response: 0.32,
      damping: 0.86,
      onUpdate: function (v) { setSheetY(v); }
    });
    sheetSpring.to(y, velocity || 0);
  }

  function openSheet(origin) {
    if (state.sheetOpen) return;
    measureSheet();
    lastFocus = document.activeElement;
    state.sheetOpen = true;
    sheetRoot.classList.add('is-open');
    sheetRoot.setAttribute('aria-hidden', 'false');
    setSheetY(closedY);
    scrim.style.opacity = '0';
    animateSheetTo(0);
    ['#stage', '#topbar', '#tabbar'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.setAttribute('inert', '');
    });
    setTimeout(function () { if (sheetClose) sheetClose.focus({ preventScroll: true }); }, 120);
    if (state.reduce) { setSheetY(0); }
  }

  function closeSheet() {
    if (!state.sheetOpen) return;
    state.sheetOpen = false;
    animateSheetTo(closedY);
    scrim.style.opacity = '0';
    document.body.classList.remove('sheet-open');
    ['#stage', '#topbar', '#tabbar'].forEach(function (sel) {
      var el = document.querySelector(sel);
      if (el) el.removeAttribute('inert');
    });
    setTimeout(function () {
      if (!state.sheetOpen) {
        sheetRoot.classList.remove('is-open');
        sheetRoot.setAttribute('aria-hidden', 'true');
      }
    }, 420);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  }

  function initSheet() {
    if (!sheet) return;
    measureSheet();
    window.addEventListener('resize', measureSheet);
    $('#btn-info').addEventListener('click', function (e) { openSheet(e.currentTarget); });
    sheetClose.addEventListener('click', closeSheet);
    scrim.addEventListener('click', closeSheet);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && state.sheetOpen) closeSheet();
      if (e.key === 'Tab' && state.sheetOpen) {
        var focusables = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', sheet)
          .filter(function (el) { return el.offsetParent !== null; });
        if (!focusables.length) return;
        var first = focusables[0];
        var last = focusables[focusables.length - 1];
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) { e.preventDefault(); last.focus(); }
      }
    });

    var dragHandles = [sheetGrab, sheetHead];
    dragHandles.forEach(function (handle) {
      if (!handle) return;
      handle.addEventListener('pointerdown', function (e) {
        if (e.button !== undefined && e.button !== 0) return;
        dragging = true;
        dragStartY = e.clientY;
        dragStartSheet = sheetTop;
        sheetHistory = [{ t: performance.now(), y: e.clientY }];
        sheetMomentum = 0;
        if (sheetSpring) sheetSpring.stop();
        try { handle.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        e.preventDefault();
      });
      handle.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        var dy = e.clientY - dragStartY;
        var y = dragStartSheet + dy;
        var minY = -32;
        if (y < minY) y = minY + MS.rubberband(y - minY, 420);
        if (y > closedY) y = closedY + MS.rubberband(y - closedY, 420);
        setSheetY(y);
        var now = performance.now();
        sheetHistory.push({ t: now, y: e.clientY });
        while (sheetHistory.length > 2 && now - sheetHistory[0].t > 100) sheetHistory.shift();
      });
      var end = function () {
        if (!dragging) return;
        dragging = false;
        if (sheetHistory.length > 1) {
          var first = sheetHistory[0], last = sheetHistory[sheetHistory.length - 1];
          var dt = Math.max(1, last.t - first.t);
          sheetMomentum = ((last.y - first.y) / dt) * 1000;
        }
        var projected = sheetTop + MS.project(sheetMomentum);
        var openTarget = projected < sheetHeight * 0.42 ? 0 : closedY;
        animateSheetTo(openTarget, sheetMomentum);
        if (openTarget === closedY) {
          state.sheetOpen = false;
          document.body.classList.remove('sheet-open');
          setTimeout(function () {
            if (!state.sheetOpen) {
              sheetRoot.classList.remove('is-open');
              sheetRoot.setAttribute('aria-hidden', 'true');
            }
          }, 420);
        } else {
          state.sheetOpen = true;
          sheetRoot.classList.add('is-open');
          sheetRoot.setAttribute('aria-hidden', 'false');
        }
      };
      handle.addEventListener('pointerup', end);
      handle.addEventListener('pointercancel', end);
    });

    // theme segmented inside the sheet
    var themeSeg = $('#theme-seg');
    initSegmented(themeSeg, function (btn) { applyTheme(btn.dataset.themeBtn, { origin: btn }); });
    // reflect persisted mode
    updateThemeUI();

    // reduce motion switch
    var reduceSwitch = $('#switch-reduce');
    if (reduceSwitch) {
      reduceSwitch.setAttribute('aria-checked', state.reduce ? 'true' : 'false');
      reduceSwitch.addEventListener('click', function () {
        state.reduce = !state.reduce;
        root.classList.toggle('reduce-motion', state.reduce);
        reduceSwitch.setAttribute('aria-checked', state.reduce ? 'true' : 'false');
        safeStore('site-reduce', state.reduce ? '1' : '0');
        if (state.reduce) {
          if (sheetSpring) sheetSpring.stop();
          setSheetY(state.sheetOpen ? 0 : closedY);
        } else {
          setSheetY(state.sheetOpen ? 0 : closedY);
        }
        toast(state.reduce ? '已减少动态效果' : '已恢复动态效果');
      });
    }
  }

  /* ------------------------------------------------------------
     appearance button + nav
     ------------------------------------------------------------ */
  function initChrome() {
    var appearanceBtn = $('#btn-appearance');
    if (appearanceBtn) {
      appearanceBtn.addEventListener('click', function () {
        var next = body.dataset.theme === 'dark' ? 'light' : 'dark';
        applyTheme(next, { origin: appearanceBtn });
        toast(next === 'dark' ? '外观：深色' : '外观：浅色');
      });
    }

    $$('[data-world-btn]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        switchWorld(btn.dataset.worldBtn);
      });
    });

    $('#world-switch').addEventListener('keydown', function (e) {
      var buttons = $$('.segmented__btn', $('#world-switch'));
      var index = buttons.findIndex(function (b) { return b.classList.contains('is-active'); });
      if (e.key === 'ArrowRight') { e.preventDefault(); switchWorld(buttons[(index + 1) % buttons.length].dataset.worldBtn); buttons[(index + 1) % buttons.length].focus(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); switchWorld(buttons[(index - 1 + buttons.length) % buttons.length].dataset.worldBtn); buttons[(index - 1 + buttons.length) % buttons.length].focus(); }
    });

    // delegated world navigation
    document.addEventListener('click', function (e) {
      var goto = e.target.closest('[data-goto]');
      if (goto) {
        var world = goto.dataset.goto;
        if (screens[world]) {
          e.preventDefault();
          switchWorld(world);
          return;
        }
      }
      var scrollBtn = e.target.closest('[data-scroll-to]');
      if (scrollBtn) {
        var id = scrollBtn.dataset.scrollTo;
        var screen = screens[state.world];
        var target = screen && $('#' + id, screen);
        var scroller = scrollers[state.world];
        if (target && scroller) {
          var top = target.offsetTop - 28;
          scroller.scrollTo({ top: top, behavior: motionOK() ? 'smooth' : 'auto' });
        }
      }
    });

    window.addEventListener('resize', function () {
      updateSegPill($('#world-switch'));
      updateTabPill();
    });

    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) updateSegPill($('#world-switch'));
    });
  }

  /* ------------------------------------------------------------
     boot
     ------------------------------------------------------------ */
  function boot() {
    // sync state from early-boot script
    state.themeMode = body.dataset.themeMode || 'auto';
    state.reduce = root.classList.contains('reduce-motion');
    if (!body.dataset.theme) body.dataset.theme = resolveTheme(state.themeMode);

    initReveals();
    initChrome();
    initSheet();

    var initial = readWorldFromHash();
    state.world = initial;
    body.dataset.world = initial;
    Object.keys(screens).forEach(function (key) {
      var screen = screens[key];
      var active = key === initial;
      screen.classList.toggle('is-active', active);
      screen.setAttribute('aria-hidden', active ? 'false' : 'true');
      if (active) screen.removeAttribute('inert'); else screen.setAttribute('inert', '');
    });
    updateNavState();
    updateThemeUI();
    scanReveals(screens[initial]);
    measureSheet();
    updateScrollChrome(screens[initial], scrollers[initial], true);

    // fonts can change metrics
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () {
        updateSegPill($('#world-switch'));
        updateSegPill($('#theme-seg'));
        updateSegPill($('#mp-seg'));
        updateTabPill();
        measureSheet();
        Object.keys(scrollers).forEach(function (key) {
          updateScrollChrome(screens[key], scrollers[key], true);
        });
      });
    }

    setTimeout(function () {
      scanReveals(screens[initial]);
      measureSheet();
    }, 420);
  }

  document.addEventListener('DOMContentLoaded', boot);

  // expose a tiny API for interactions.js
  window.Site = {
    toast: toast,
    toastEl: toastEl,
    motionOK: motionOK,
    prefersFinePointer: prefersFinePointer,
    state: state,
    screens: screens,
    scrollers: scrollers,
    switchWorld: switchWorld,
    initSegmented: initSegmented,
    updateSegPill: updateSegPill,
    scanReveals: scanReveals
  };
})();
