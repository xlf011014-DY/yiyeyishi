/* ============================================================
   interactions.js — gestures, tilt, specular, carousels, accordion
   ============================================================ */
(function () {
  'use strict';

  var MS = window.MotionSpring;
  var Site = window.Site;
  var clamp = MS.clamp;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  function finePointer() { return Site.prefersFinePointer(); }
  function motionOK() { return Site.motionOK(); }

  /* ------------------------------------------------------------
     specular highlight — glass catches the light near the pointer
     ------------------------------------------------------------ */
  function initSpecular() {
    if (!finePointer()) return;
    $$('.glass').forEach(function (el) {
      el.addEventListener('pointermove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.setProperty('--mx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        el.style.setProperty('--my', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function () {
        el.style.setProperty('--mx', '50%');
        el.style.setProperty('--my', '-10%');
      });
    });
  }

  /* ------------------------------------------------------------
     tilt — subtle 3D on glass cards (pointer fine only)
     ------------------------------------------------------------ */
  function initTilt() {
    if (!finePointer()) return;
    $$('.tilt').forEach(function (el) {
      if (el.id === 'recipe') return; // recipe has its own tilt + drag
      var rx = MS.spring(0, { response: 0.5, damping: 1, onUpdate: apply });
      var ry = MS.spring(0, { response: 0.5, damping: 1, onUpdate: apply });
      function apply() {
        el.style.transform = 'perspective(1100px) rotateX(' + rx.value.toFixed(2) + 'deg) rotateY(' + ry.value.toFixed(2) + 'deg)';
      }
      el.addEventListener('pointermove', function (e) {
        if (!motionOK() || Site.state.sheetOpen) return;
        var r = el.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        rx.to(-ny * 5);
        ry.to(nx * 7);
      });
      el.addEventListener('pointerleave', function () {
        rx.to(0);
        ry.to(0);
      });
    });
  }

  /* ------------------------------------------------------------
     recipe card — drag through 3 panels, tilt + glare
     ------------------------------------------------------------ */
  function initRecipe() {
    var recipe = $('#recipe');
    if (!recipe) return;
    var track = $('.recipe__track', recipe);
    var pages = $$('.recipe__page', recipe);
    var dots = $$('.dot-btn', recipe);
    var index = 0;
    var width = 0;
    var pos = 0;
    var dragging = false;
    var moved = false;
    var startX = 0;
    var basePos = 0;
    var history = [];
    var suppressClick = false;

    var tx = MS.spring(0, {
      response: 0.42,
      damping: 0.9,
      onUpdate: function (v) {
        pos = v;
        track.style.transform = 'translate3d(' + v.toFixed(2) + 'px,0,0)';
      }
    });

    var rx = MS.spring(0, { response: 0.55, damping: 1, onUpdate: applyTilt });
    var ry = MS.spring(0, { response: 0.55, damping: 1, onUpdate: applyTilt });
    function applyTilt() {
      recipe.style.transform = 'perspective(1200px) rotateX(' + rx.value.toFixed(2) + 'deg) rotateY(' + ry.value.toFixed(2) + 'deg)';
    }
    function resetTilt() { rx.to(0); ry.to(0); }

    function measure() {
      width = track.clientWidth || recipe.clientWidth;
      pos = -index * width;
      tx.set(pos);
    }

    function go(target, velocity) {
      index = clamp(target, 0, pages.length - 1);
      pages.forEach(function (p, i) { p.classList.toggle('is-active', i === index); });
      dots.forEach(function (d, i) { d.classList.toggle('is-active', i === index); });
      if (motionOK()) tx.to(-index * width, velocity || 0);
      else { tx.set(-index * width); }
    }

    function applyDrag(dx) {
      var raw = -index * width + dx;
      var min = -width * (pages.length - 1);
      if (raw > 0) raw = MS.rubberband(raw, width * 0.9);
      if (raw < min) raw = min + MS.rubberband(raw - min, width * 0.9);
      pos = raw;
      track.style.transform = 'translate3d(' + raw.toFixed(2) + 'px,0,0)';
    }

    recipe.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      // let dots / links receive their own clicks (pointer capture would swallow them)
      if (e.target.closest('.dot-btn, a, button')) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      basePos = pos;
      history = [{ t: performance.now(), x: e.clientX }];
      if (tx) tx.stop();
      try { recipe.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });

    recipe.addEventListener('pointermove', function (e) {
      var r = recipe.getBoundingClientRect();
      if (!dragging) {
        if (!finePointer() || !motionOK()) return;
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        rx.to(-ny * 4.5);
        ry.to(nx * 6);
        recipe.style.setProperty('--gx', (((e.clientX - r.left) / r.width) * 100).toFixed(1) + '%');
        recipe.style.setProperty('--gy', (((e.clientY - r.top) / r.height) * 100).toFixed(1) + '%');
        return;
      }
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 6) moved = true;
      if (!moved) return;
      applyDrag(dx);
      var now = performance.now();
      history.push({ t: now, x: e.clientX });
      while (history.length > 2 && now - history[0].t > 100) history.shift();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      var velocity = 0;
      if (history.length > 1) {
        var first = history[0], last = history[history.length - 1];
        var dt = Math.max(1, last.t - first.t);
        velocity = ((last.x - first.x) / dt) * 1000;
      }
      var projected = pos + MS.project(velocity) * -1;
      var target = Math.round(-projected / width);
      go(target, -velocity);
      if (moved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 60);
      }
      if (moved) resetTilt();
    }
    recipe.addEventListener('pointerup', endDrag);
    recipe.addEventListener('pointercancel', endDrag);
    recipe.addEventListener('pointerleave', function () {
      if (!dragging) resetTilt();
    });

    dots.forEach(function (dot) {
      dot.addEventListener('click', function () {
        go(parseInt(dot.dataset.recipe, 10) || 0);
      });
    });
    recipe.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });

    window.addEventListener('resize', measure);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { measure(); });
    }
    setTimeout(measure, 120);
    measure();
    go(0);
  }

  /* ------------------------------------------------------------
     horizontal carousels — momentum drag + snap
     ------------------------------------------------------------ */
  function initCarousel(carousel) {
    if (!carousel) return;
    var track = $('.carousel__track', carousel);
    if (!track) return;
    var dragging = false;
    var startX = 0;
    var startScroll = 0;
    var history = [];
    var moved = false;
    var suppressClick = false;
    var spring = null;

    function nearestTarget(projected) {
      var children = Array.prototype.slice.call(track.children);
      var base = track.offsetLeft;
      var max = track.scrollWidth - track.clientWidth;
      var best = 0;
      var bestDist = Infinity;
      children.forEach(function (child) {
        var x = child.offsetLeft - base;
        var d = Math.abs(x - projected);
        if (d < bestDist) { bestDist = d; best = x; }
      });
      return Math.max(0, Math.min(max, best));
    }

    track.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button !== 0) return;
      dragging = true;
      moved = false;
      startX = e.clientX;
      startScroll = track.scrollLeft;
      history = [{ t: performance.now(), x: e.clientX }];
      if (spring) spring.stop();
      track.classList.add('is-dragging');
      try { track.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
    });

    track.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (Math.abs(dx) > 4) moved = true;
      if (!moved) return;
      var raw = startScroll - dx;
      var max = track.scrollWidth - track.clientWidth;
      if (raw < 0) raw = MS.rubberband(raw, 380) * -1;
      if (raw > max) raw = max + MS.rubberband(raw - max, 380);
      track.scrollLeft = raw;
      var now = performance.now();
      history.push({ t: now, x: e.clientX });
      while (history.length > 2 && now - history[0].t > 100) history.shift();
    });

    function endDrag() {
      if (!dragging) return;
      dragging = false;
      track.classList.remove('is-dragging');
      var velocity = 0;
      if (history.length > 1) {
        var first = history[0], last = history[history.length - 1];
        var dt = Math.max(1, last.t - first.t);
        velocity = ((last.x - first.x) / dt) * 1000;
      }
      var projected = track.scrollLeft + MS.project(-velocity);
      var target = nearestTarget(projected);
      if (!motionOK()) { track.scrollLeft = target; return; }
      if (spring) spring.stop();
      spring = MS.spring(track.scrollLeft, {
        response: 0.45,
        damping: 0.9,
        velocity: -velocity,
        onUpdate: function (v) { track.scrollLeft = v; }
      });
      spring.to(target, -velocity);
      if (moved) {
        suppressClick = true;
        setTimeout(function () { suppressClick = false; }, 80);
      }
    }
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    track.addEventListener('click', function (e) {
      if (suppressClick) { e.preventDefault(); e.stopPropagation(); }
    }, true);

    track.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        e.preventDefault();
        var step = track.clientWidth * 0.7;
        track.scrollBy({ left: e.key === 'ArrowRight' ? step : -step, behavior: motionOK() ? 'smooth' : 'auto' });
      }
    });
    track.setAttribute('tabindex', '0');
  }

  /* ------------------------------------------------------------
     mini program — screens + dynamic island
     ------------------------------------------------------------ */
  function initMini() {
    var seg = $('#mp-seg');
    var shots = $$('.mp-shot');
    var caption = $('#mp-caption');
    var island = $('#dynamic-island');
    var islandLabel = $('#island-label');
    if (!seg) return;

    var captions = {
      home: '首页 / 品牌、门店与当季主推',
      order: '点单 · 拼茶 / 基底与变量',
      draw: '抽茶签 / 活动型玩法，概率公示',
      community: '社区 / 茶谱与配方卡'
    };
    var labels = { home: 'LIM TÊ · 首页', order: 'LIM TÊ · 点单', draw: 'LIM TÊ · 抽签', community: 'LIM TÊ · 社区' };
    var islandTimer = 0;
    var first = true;

    Site.initSegmented(seg, function (btn) {
      var key = btn.dataset.mp;
      shots.forEach(function (shot) { shot.classList.toggle('is-active', shot.dataset.mp === key); });
      if (caption) caption.textContent = captions[key] || '';
      if (island && islandLabel) {
        island.classList.add('is-expanded');
        islandLabel.textContent = labels[key] || 'LIM TÊ';
        clearTimeout(islandTimer);
        islandTimer = setTimeout(function () {
          island.classList.remove('is-expanded');
          islandLabel.textContent = 'LIM TÊ';
        }, 1200);
      }
      Site.toast(captions[key] || '');
    });
    // measure pill after boot
    setTimeout(function () { Site.updateSegPill(seg); }, 260);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { Site.updateSegPill(seg); });
    first = false;
  }

  /* ------------------------------------------------------------
     accordion — one open at a time
     ------------------------------------------------------------ */
  function initAccordion() {
    var root = $('#lc-accordion');
    if (!root) return;
    var items = $$('.acc-item', root);
    items.forEach(function (item) {
      item.addEventListener('click', function () {
        var willOpen = item.getAttribute('aria-expanded') !== 'true';
        items.forEach(function (other) {
          if (other !== item) other.setAttribute('aria-expanded', 'false');
        });
        item.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
      });
    });
  }

  /* ------------------------------------------------------------
     passport — flip
     ------------------------------------------------------------ */
  function initPassport() {
    var passport = $('#passport');
    if (!passport) return;
    passport.addEventListener('click', function () {
      var flipped = passport.classList.toggle('is-flipped');
      passport.setAttribute('aria-pressed', flipped ? 'true' : 'false');
      Site.toast(flipped ? '石料身世卡 · 背面' : '石料身世卡 · 正面');
    });
  }

  /* ------------------------------------------------------------
     swatches — copy hex
     ------------------------------------------------------------ */
  function initSwatches() {
    $$('.swatch').forEach(function (swatch) {
      swatch.addEventListener('click', function () {
        var hex = swatch.dataset.hex || '';
        var done = function () { Site.toast('已复制 ' + hex); };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(hex).then(done).catch(function () { fallbackCopy(hex); done(); });
        } else {
          fallbackCopy(hex); done();
        }
      });
    });
    function fallbackCopy(text) {
      try {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      } catch (e) { /* noop */ }
    }
  }

  /* ------------------------------------------------------------
     boot
     ------------------------------------------------------------ */
  /* ------------------------------------------------------------
     magnetic — editorial hover weight (pointer devices only)
     ------------------------------------------------------------ */
  function initMagnetic() {
    if (typeof MotionSpring === 'undefined') return;
    if (!Site.prefersFinePointer || !Site.prefersFinePointer()) return;
    $$('[data-magnetic]').forEach(function (el) {
      var mx = MotionSpring.spring(0, {
        response: .38, damping: 1,
        onUpdate: apply
      });
      var my = MotionSpring.spring(0, {
        response: .32, damping: 1,
        onUpdate: apply
      });
      function apply() {
        el.style.transform = 'translate3d(' + mx.value.toFixed(2) + 'px,' + my.value.toFixed(2) + 'px,0)';
      }
      el.addEventListener('pointermove', function (e) {
        if (!Site.motionOK()) return;
        var r = el.getBoundingClientRect();
        mx.to((e.clientX - r.left - r.width / 2) * 0.13);
        my.to((e.clientY - r.top - r.height / 2) * 0.24);
      });
      el.addEventListener('pointerleave', function () { mx.to(0); my.to(0); });
      el.addEventListener('blur', function () { mx.to(0); my.to(0); });
    });
  }

  function boot() {
    initSpecular();
    initTilt();
    initMagnetic();
    initRecipe();
    initCarousel($('#lc-carousel'));
    initCarousel($('#sxf-carousel'));
    initMini();
    initAccordion();
    initPassport();
    initSwatches();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
