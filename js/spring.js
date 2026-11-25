/* ============================================================
   spring.js — a tiny, dependency-free spring engine
   Apple-style parameters: response (seconds) + damping ratio
   Shared rAF loop; springs retarget from presentation values.
   ============================================================ */
(function (global) {
  'use strict';

  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  // Apple's momentum projection (exponential decay), decelerationRate ~0.998
  function project(velocity, rate) {
    rate = typeof rate === 'number' ? rate : 0.998;
    return (velocity / 1000) * rate / (1 - rate);
  }

  // Progressive resistance past a boundary
  function rubberband(overshoot, dimension, constant) {
    constant = typeof constant === 'number' ? constant : 0.55;
    return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
  }

  function reduced() {
    return document.documentElement.classList.contains('reduce-motion') ||
      global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  var active = new Set();
  var rafId = 0;
  var lastTime = 0;

  function frame(now) {
    if (!lastTime) lastTime = now;
    var dt = Math.min((now - lastTime) / 1000, 0.064);
    lastTime = now;
    active.forEach(function (s) { s._tick(dt); });
    if (active.size) {
      rafId = requestAnimationFrame(frame);
    } else {
      rafId = 0;
      lastTime = 0;
    }
  }

  function ensureLoop() {
    if (!rafId) {
      lastTime = 0;
      rafId = requestAnimationFrame(frame);
    }
  }

  /**
   * createSpring(initial, { response, damping, onUpdate, onComplete, velocity })
   * controller: .set(v) jump; .to(target, velocity?) retarget; .value; .stop()
   */
  function createSpring(initial, options) {
    options = options || {};
    var response = options.response || 0.4;
    var damping = typeof options.damping === 'number' ? options.damping : 1;
    var w0 = (Math.PI * 2) / Math.max(0.08, response);
    var k = w0 * w0;
    var c = 2 * damping * w0;

    var x = initial;
    var target = initial;
    var v = options.velocity || 0;
    var listeners = options.onUpdate ? [options.onUpdate] : [];
    var completed = false;

    function notify() { for (var i = 0; i < listeners.length; i++) listeners[i](x, v); }

    var controller = {
      get value() { return x; },
      get velocity() { return v; },
      get target() { return target; },
      set: function (value) {
        x = value; target = value; v = 0; completed = false;
        notify();
      },
      to: function (value, velocity, config) {
        target = value;
        if (typeof velocity === 'number') v = velocity;
        if (config && typeof config.response === 'number') {
          w0 = (Math.PI * 2) / Math.max(0.08, config.response);
          k = w0 * w0;
          c = 2 * (typeof config.damping === 'number' ? config.damping : damping) * w0;
        }
        completed = false;
        active.add(controller);
        ensureLoop();
      },
      stop: function () { active.delete(controller); },
      onUpdate: function (fn) { listeners.push(fn); return controller; }
    };

    controller._tick = function (dt) {
      var steps = Math.max(1, Math.ceil(dt / (1 / 240)));
      var h = dt / steps;
      for (var i = 0; i < steps; i++) {
        var a = -k * (x - target) - c * v;
        v += a * h;
        x += v * h;
      }
      notify();
      if (Math.abs(v) < 0.002 && Math.abs(x - target) < 0.002) {
        x = target; v = 0;
        notify();
        active.delete(controller);
        if (!completed) { completed = true; if (options.onComplete) options.onComplete(x); }
      }
    };

    return controller;
  }

  global.MotionSpring = {
    spring: createSpring,
    project: project,
    rubberband: rubberband,
    clamp: clamp,
    lerp: lerp,
    reduced: reduced
  };
})(window);
