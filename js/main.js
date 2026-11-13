/* =========================================================
   人龙舞数字文创馆
   Interaction layer — vanilla JS, no dependencies
   ========================================================= */
(() => {
  'use strict';

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasIO = 'IntersectionObserver' in window;

  const body = document.body;
  const header = $('#siteHeader');
  const pageProgress = $('#pageProgress');
  const railProgress = $('#railProgress');
  const sections = $$('[data-section]');
  const chapterRail = $('#chapterRail');
  let activeSection = 'hero';
  let loadStartedAt = performance.now();

  /* -------------------------------------------------------
     Preloader
     ------------------------------------------------------- */
  const loader = $('#loader');
  const loaderBar = $('#loaderBar');
  const loaderPercent = $('#loaderPercent');
  let loaderValue = 0;
  let loaderDone = false;

  function paintLoader(value) {
    loaderValue = clamp(value, 0, 100);
    if (loaderBar) loaderBar.style.width = `${loaderValue}%`;
    if (loaderPercent) loaderPercent.textContent = String(Math.round(loaderValue)).padStart(2, '0');
  }

  const loaderTick = window.setInterval(() => {
    if (loaderDone) return;
    const remaining = 92 - loaderValue;
    paintLoader(loaderValue + Math.max(0.35, remaining * 0.045));
  }, 42);

  function finishLoading() {
    if (loaderDone) return;
    loaderDone = true;
    window.clearInterval(loaderTick);
    paintLoader(100);
    window.setTimeout(() => {
      body.classList.remove('is-loading');
      body.classList.add('is-loaded');
      if (loader) loader.setAttribute('aria-hidden', 'true');
      loadStartedAt = performance.now();
      window.setTimeout(() => {
        if (loader) loader.style.display = 'none';
      }, 1200);
      updateActiveSection();
      startHeroCanvas();
    }, reducedMotion ? 40 : 430);
  }

  if (document.readyState === 'complete') {
    window.setTimeout(finishLoading, 900);
  } else {
    window.addEventListener('load', () => window.setTimeout(finishLoading, 900), { once: true });
  }
  // Fail-safe: never trap the page behind the loader.
  window.setTimeout(finishLoading, 3600);
  paintLoader(4);

  /* -------------------------------------------------------
     Cursor
     ------------------------------------------------------- */
  const cursorDot = $('#cursorDot');
  const cursorRing = $('#cursorRing');
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let ringX = pointerX;
  let ringY = pointerY;
  let pointerActive = false;

  if (finePointer && cursorDot && cursorRing) {
    window.addEventListener('pointermove', e => {
      pointerX = e.clientX;
      pointerY = e.clientY;
      if (!pointerActive) {
        pointerActive = true;
        body.classList.add('has-cursor');
        ringX = pointerX;
        ringY = pointerY;
      }
      cursorDot.style.transform = `translate(${pointerX}px, ${pointerY}px) translate(-50%, -50%)`;
    }, { passive: true });

    window.addEventListener('pointerover', e => {
      const target = e.target.closest('a, button, input, label, [data-cursor]');
      cursorRing.classList.toggle('is-hover', Boolean(target));
    }, { passive: true });
    window.addEventListener('pointerdown', () => cursorRing.classList.add('is-press'), { passive: true });
    window.addEventListener('pointerup', () => cursorRing.classList.remove('is-press'), { passive: true });
    document.addEventListener('mouseleave', () => {
      body.classList.remove('has-cursor');
      pointerActive = false;
    });

    const cursorLoop = () => {
      ringX = lerp(ringX, pointerX, 0.18);
      ringY = lerp(ringY, pointerY, 0.18);
      cursorRing.style.transform = `translate(${ringX}px, ${ringY}px) translate(-50%, -50%)`;
      requestAnimationFrame(cursorLoop);
    };
    requestAnimationFrame(cursorLoop);
  }

  /* -------------------------------------------------------
     Toast
     ------------------------------------------------------- */
  const toast = $('#toast');
  let toastTimer = 0;
  function showToast(message) {
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('is-show');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-show'), 2200);
  }

  /* -------------------------------------------------------
     Menu
     ------------------------------------------------------- */
  const menu = $('#chapterMenu');
  const menuBtn = $('#menuBtn');
  const menuClose = $('#menuClose');
  const menuPreviewImg = $('#menuPreviewImg');
  const menuLinks = $$('[data-menu-link]');
  let menuOpen = false;
  let lastFocus = null;

  function setPageInert(inert) {
    [document.getElementById('main'), document.querySelector('.site-footer'), header, chapterRail].forEach(el => {
      if (el) el.inert = inert;
    });
  }

  function syncMenuCurrent() {
    menuLinks.forEach(link => {
      const active = link.getAttribute('href') === `#${activeSection}`;
      link.classList.toggle('is-current', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
  }

  function openMenu() {
    if (!menu || menuOpen) return;
    if (demoActive) stopDemo();
    syncMenuCurrent();
    menuOpen = true;
    lastFocus = document.activeElement;
    menu.classList.add('is-open');
    menu.setAttribute('aria-hidden', 'false');
    menuBtn.setAttribute('aria-expanded', 'true');
    setPageInert(true);
    body.classList.add('is-locked');
    window.setTimeout(() => menuClose && menuClose.focus({ preventScroll: true }), 180);
  }

  function closeMenu(restoreFocus = true) {
    if (!menu || !menuOpen) return;
    menuOpen = false;
    menu.classList.remove('is-open');
    menu.setAttribute('aria-hidden', 'true');
    menuBtn.setAttribute('aria-expanded', 'false');
    setPageInert(false);
    if (!body.classList.contains('lightbox-open')) body.classList.remove('is-locked');
    if (restoreFocus && lastFocus && typeof lastFocus.focus === 'function') {
      lastFocus.focus({ preventScroll: true });
    }
  }

  if (menuBtn) menuBtn.addEventListener('click', () => (menuOpen ? closeMenu() : openMenu()));
  if (menuClose) menuClose.addEventListener('click', () => closeMenu());
  if (menu) {
    menu.addEventListener('click', e => {
      if (e.target === menu || e.target.classList.contains('menu__glow')) closeMenu();
    });
  }
  menuLinks.forEach(link => {
    link.addEventListener('mouseenter', () => {
      const src = link.dataset.preview;
      if (!src || !menuPreviewImg) return;
      menuPreviewImg.style.opacity = '0';
      window.setTimeout(() => {
        menuPreviewImg.src = src;
        menuPreviewImg.style.opacity = '1';
      }, 150);
    });
    link.addEventListener('focus', () => {
      const src = link.dataset.preview;
      if (src && menuPreviewImg) menuPreviewImg.src = src;
    });
    link.addEventListener('click', () => closeMenu(false));
  });

  /* Anchor smooth scroll + close overlays */
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const id = link.getAttribute('href');
      if (!id || id === '#') return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      if (menuOpen) closeMenu(false);
      const top = target.getBoundingClientRect().top + window.scrollY - (id === '#hero' ? 0 : 66);
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', id);
    });
  });

  /* -------------------------------------------------------
     Scroll progress / active chapter
     ------------------------------------------------------- */
  const navLinks = $$('[data-nav]');
  const railButtons = $$('[data-rail]');
  let scrollRaf = 0;

  function getActiveSection() {
    const marker = window.innerHeight * 0.34;
    let current = sections[0];
    sections.forEach(section => {
      const rect = section.getBoundingClientRect();
      if (rect.top <= marker) current = section;
    });
    return current;
  }

  function updateActiveSection() {
    if (!sections.length) return;
    const current = getActiveSection();
    if (!current) return;
    const previous = activeSection;
    activeSection = current.id;
    if (previous !== activeSection) {
      railButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.rail === activeSection));
      navLinks.forEach(link => link.classList.toggle('is-active', link.getAttribute('href') === `#${activeSection}`));
      body.dataset.activeTheme = current.dataset.theme || 'dark';
    } else if (!body.dataset.activeTheme) {
      body.dataset.activeTheme = current.dataset.theme || 'dark';
    }
    updateProgress();
  }

  function updateProgress() {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const progress = clamp(window.scrollY / max, 0, 1);
    if (pageProgress) pageProgress.style.width = `${progress * 100}%`;
    if (railProgress) railProgress.style.height = `${progress * 100}%`;
    header.classList.toggle('is-scrolled', window.scrollY > 32);
  }

  function onScroll() {
    if (scrollRaf) return;
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0;
      updateActiveSection();
    });
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });

  if (chapterRail) {
    railButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const target = document.getElementById(btn.dataset.rail);
        if (target) target.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
      });
    });
  }

  /* -------------------------------------------------------
     Reveal on scroll
     ------------------------------------------------------- */
  const revealItems = $$('[data-reveal]');
  if (reducedMotion || !hasIO) {
    revealItems.forEach(el => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08, rootMargin: '0px 0px -7% 0px' });
    revealItems.forEach(el => revealObserver.observe(el));
  }

  /* -------------------------------------------------------
     Hero canvas: a human chain becoming a dragon
     ------------------------------------------------------- */
  const hero = $('#hero');
  const heroCanvas = $('#heroCanvas');
  let heroAnimationId = 0;
  let heroVisible = true;
  let heroStarted = false;
  let heroPoints = [];
  let heroCtx = null;
  let heroW = 0;
  let heroH = 0;
  let dpr = 1;
  let heroMouseX = 0.5;
  let heroMouseY = 0.5;
  let heroPulse = 0;

  const heroControl = [
    [-0.05, 0.76], [0.08, 0.71], [0.18, 0.62], [0.29, 0.66],
    [0.38, 0.55], [0.49, 0.59], [0.58, 0.47], [0.68, 0.51],
    [0.77, 0.38], [0.87, 0.4], [0.97, 0.27], [1.06, 0.25]
  ];

  function catmullRom(points, t) {
    const n = points.length - 1;
    const p = clamp(t, 0, 0.9999) * n;
    const i = Math.floor(p);
    const f = p - i;
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[Math.min(n, i + 1)];
    const p3 = points[Math.min(n, i + 2)];
    const f2 = f * f;
    const f3 = f2 * f;
    return {
      x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * f + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * f2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * f3),
      y: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * f + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * f2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * f3)
    };
  }

  function resizeHeroCanvas() {
    if (!heroCanvas || !hero) return;
    const rect = hero.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    heroW = Math.max(1, rect.width);
    heroH = Math.max(1, rect.height);
    heroCanvas.width = Math.round(heroW * dpr);
    heroCanvas.height = Math.round(heroH * dpr);
    heroCanvas.style.width = `${heroW}px`;
    heroCanvas.style.height = `${heroH}px`;
    heroCtx = heroCanvas.getContext('2d');
    if (heroCtx) heroCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    heroPoints = Array.from({ length: 82 }, (_, i) => ({
      t: i / 81,
      offset: Math.sin(i * 2.17) * 18,
      speed: 0.00006 + (i % 7) * 0.000007,
      phase: i * 0.72,
      size: 1.2 + (i % 5) * 0.34
    }));
    if (reducedMotion) drawHero(0, true);
  }

  function drawHumanMark(ctx, x, y, scale, alpha, color) {
    // a tiny node = a head + a body, read as "one dancer" at small scale
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(0, -2.6 * scale, 1.35 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -1.1 * scale);
    ctx.lineTo(0, 2.6 * scale);
    ctx.moveTo(-2 * scale, 0.4 * scale);
    ctx.lineTo(2 * scale, 0.4 * scale);
    ctx.moveTo(0, 2.6 * scale);
    ctx.lineTo(-1.7 * scale, 4.8 * scale);
    ctx.moveTo(0, 2.6 * scale);
    ctx.lineTo(1.7 * scale, 4.8 * scale);
    ctx.stroke();
    ctx.restore();
  }

  function drawHero(time, staticFrame = false) {
    if (!heroCtx) return;
    const ctx = heroCtx;
    ctx.clearRect(0, 0, heroW, heroH);
    const isSmall = heroW < 760;
    const baseY = heroH * 0.18;
    const spanX = heroW * 0.95;
    const spanY = heroH * 0.42;
    const mouseInfluence = finePointer && !reducedMotion ? (heroMouseX - 0.5) * 24 : 0;

    // faint trailing curve
    ctx.save();
    for (let layer = 0; layer < 2; layer++) {
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const t = i / 80;
        const p = catmullRom(heroControl, t);
        const x = p.x * spanX + heroW * 0.03 + (layer ? Math.sin(t * 17 + time * 0.00018) * 11 : 0) + mouseInfluence * (layer ? 0.5 : 0.25);
        const y = p.y * spanY + baseY + (layer ? Math.cos(t * 13 + time * 0.00014) * 8 : 0);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = layer ? 'rgba(232,182,90,0.055)' : 'rgba(207,80,51,0.07)';
      ctx.lineWidth = layer ? 1 : 0.8;
      ctx.stroke();
    }
    ctx.restore();

    const pulse = heroPulse > 0 ? heroPulse : 0;
    heroPoints.forEach((node, i) => {
      const drift = Math.sin(time * 0.00035 + node.phase) * (isSmall ? 2 : 4);
      const p = catmullRom(heroControl, node.t);
      let x = p.x * spanX + heroW * 0.03 + drift + mouseInfluence;
      let y = p.y * spanY + baseY + Math.cos(time * 0.0003 + node.phase * 0.9) * (isSmall ? 2 : 3.5) + node.offset * 0.22;
      const nearMouse = Math.hypot(x - pointerX * (heroW / window.innerWidth), y - (pointerY + window.scrollY) * (heroH / hero.offsetHeight)) < 130;
      const alpha = 0.12 + (i % 9 === 0 ? 0.22 : 0.1) + pulse * 0.25 + (nearMouse ? 0.16 : 0);
      const color = i % 6 === 0 ? `rgba(232,182,90,${alpha + 0.12})` : `rgba(250,236,217,${alpha * 0.8})`;
      drawHumanMark(ctx, x, y, 0.85 + (i % 4) * 0.14, alpha, color);
      if (i % 5 === 0) {
        for (let j = i + 1; j <= Math.min(i + 4, heroPoints.length - 1); j++) {
          const p2 = catmullRom(heroControl, heroPoints[j].t);
          const x2 = p2.x * spanX + heroW * 0.03 + Math.sin(time * 0.00035 + heroPoints[j].phase) * (isSmall ? 2 : 4) + mouseInfluence;
          const y2 = p2.y * spanY + baseY + Math.cos(time * 0.0003 + heroPoints[j].phase * 0.9) * (isSmall ? 2 : 3.5);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = `rgba(232,182,90,${0.018 + pulse * 0.035})`;
          ctx.lineWidth = 0.55;
          ctx.stroke();
        }
      }
    });

    // red pulse ring on click
    if (pulse > 0) {
      const head = catmullRom(heroControl, 0.94);
      const x = head.x * spanX + heroW * 0.03;
      const y = head.y * spanY + baseY;
      ctx.beginPath();
      ctx.arc(x, y, 35 + (1 - pulse) * 150, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(207,80,51,${pulse * 0.22})`;
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    if (!staticFrame) {
      heroPulse = Math.max(0, heroPulse - 0.012);
      heroAnimationId = requestAnimationFrame(drawHero);
    }
  }

  function startHeroCanvas() {
    if (!heroCanvas || heroStarted) return;
    heroStarted = true;
    resizeHeroCanvas();
    if (reducedMotion) {
      drawHero(0, true);
      return;
    }
    if (hasIO) {
      const io = new IntersectionObserver(entries => {
        heroVisible = entries[0].isIntersecting;
        if (heroVisible) {
          cancelAnimationFrame(heroAnimationId);
          heroAnimationId = requestAnimationFrame(drawHero);
        } else {
          cancelAnimationFrame(heroAnimationId);
        }
      }, { threshold: 0.01 });
      io.observe(hero);
    }
    heroAnimationId = requestAnimationFrame(drawHero);
    hero.addEventListener('pointermove', e => {
      const rect = hero.getBoundingClientRect();
      heroMouseX = clamp((e.clientX - rect.left) / rect.width, 0, 1);
      heroMouseY = clamp((e.clientY - rect.top) / rect.height, 0, 1);
    }, { passive: true });
    hero.addEventListener('click', () => { if (!reducedMotion) heroPulse = 1; });
    const resizeObserver = 'ResizeObserver' in window ? new ResizeObserver(() => resizeHeroCanvas()) : null;
    if (resizeObserver) resizeObserver.observe(hero);
    else window.addEventListener('resize', resizeHeroCanvas);
  }

  /* -------------------------------------------------------
     Parallax / board tilt
     ------------------------------------------------------- */
  const parallaxItems = $$('[data-parallax]');
  if (finePointer && !reducedMotion) {
    let px = 0, py = 0, targetPx = 0, targetPy = 0;
    window.addEventListener('pointermove', e => {
      targetPx = (e.clientX / window.innerWidth - 0.5) * 2;
      targetPy = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });

    const moveParallax = () => {
      px = lerp(px, targetPx, 0.06);
      py = lerp(py, targetPy, 0.06);
      const now = performance.now();
      if (now - loadStartedAt > 1500) {
        parallaxItems.forEach(el => {
          const depth = parseFloat(el.dataset.depth || '8');
          const rect = el.getBoundingClientRect();
          if (rect.bottom < -100 || rect.top > window.innerHeight + 100) return;
          el.style.transform = `translate3d(${px * depth}px, ${py * depth * 0.72}px, 0) rotateX(${py * -1.4}deg) rotateY(${px * 1.4}deg)`;
        });
      }
      requestAnimationFrame(moveParallax);
    };
    requestAnimationFrame(moveParallax);

    $$('.board-card').forEach(card => {
      const frame = card.querySelector('.board-card__frame');
      if (!frame) return;
      card.addEventListener('pointermove', e => {
        const r = card.getBoundingClientRect();
        const mx = (e.clientX - r.left) / r.width - 0.5;
        const my = (e.clientY - r.top) / r.height - 0.5;
        frame.style.transform = `translateY(-8px) rotateX(${my * -4}deg) rotateY(${mx * 4}deg)`;
      });
      card.addEventListener('pointerleave', () => { frame.style.transform = ''; });
    });
  }

  /* -------------------------------------------------------
     Concept chain canvas
     ------------------------------------------------------- */
  const chainStage = $('#chainStage');
  const chainCanvas = $('#chainCanvas');
  const chainRange = $('#chainRange');
  const chainDesc = $('#chainDesc');
  const chainReplay = $('#chainReplay');
  const chainTabs = $$('[data-chain-step]');
  let chainCtx = null;
  let chainW = 0;
  let chainH = 0;
  let chainDpr = 1;
  let chainProgress = 0;
  let chainTarget = 0;
  let chainAnimating = false;
  let chainAutoStarted = false;
  let chainVisible = false;
  let chainTouched = false;
  let chainStageIndex = 0;

  const chainTexts = [
    '个体是独立的点，尚未发生关系。每一个舞者都是可识别的“人”，也是龙身最小的计量单位。',
    '弧线把手、肩、背连接在一起。身体开始成为龙骨，连接线不是装饰，而是结构成立的条件。',
    '当单元开始重复、错位、起伏，结构就有了动势。一个人变成一节，许多人变成一条龙。'
  ];

  const chainControl = [
    [0.1, 0.72], [0.17, 0.54], [0.3, 0.38], [0.42, 0.54],
    [0.53, 0.69], [0.63, 0.53], [0.71, 0.34], [0.82, 0.44],
    [0.9, 0.58], [0.96, 0.44]
  ];

  function chainCurve(t) {
    return catmullRom(chainControl, t);
  }

  function resizeChainCanvas() {
    if (!chainCanvas || !chainStage) return;
    const rect = chainCanvas.getBoundingClientRect();
    chainDpr = Math.min(window.devicePixelRatio || 1, 2);
    chainW = Math.max(1, rect.width);
    chainH = Math.max(1, rect.height);
    chainCanvas.width = Math.round(chainW * chainDpr);
    chainCanvas.height = Math.round(chainH * chainDpr);
    chainCtx = chainCanvas.getContext('2d');
    if (chainCtx) chainCtx.setTransform(chainDpr, 0, 0, chainDpr, 0, 0);
    drawChain(performance.now(), true);
  }

  function humanFigure(ctx, x, y, angle, scale, alpha, accent = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    const color = accent ? `rgba(207,80,51,${alpha})` : `rgba(232,182,90,${alpha})`;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.arc(0, -7.5 * scale, 4.2 * scale, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(0, -3 * scale);
    ctx.lineTo(0, 8.5 * scale);
    ctx.moveTo(-5.7 * scale, 1 * scale);
    ctx.lineTo(5.7 * scale, 1 * scale);
    ctx.moveTo(0, 8.5 * scale);
    ctx.lineTo(-4.8 * scale, 16 * scale);
    ctx.moveTo(0, 8.5 * scale);
    ctx.lineTo(4.8 * scale, 16 * scale);
    ctx.stroke();
    // a faint circular field around each body
    ctx.beginPath();
    ctx.arc(0, 4 * scale, 11.5 * scale, 0, Math.PI * 2);
    ctx.strokeStyle = accent ? `rgba(207,80,51,${alpha * 0.12})` : `rgba(250,236,217,${alpha * 0.08})`;
    ctx.stroke();
    ctx.restore();
  }

  function drawChain(time, staticFrame = false) {
    if (!chainCtx) return;
    const ctx = chainCtx;
    const p = clamp(chainProgress, 0, 1);
    const eased = p * p * (3 - 2 * p);
    ctx.clearRect(0, 0, chainW, chainH);

    const padX = Math.max(46, chainW * 0.09);
    const padY = Math.max(40, chainH * 0.1);
    const usableW = chainW - padX * 2;
    const usableH = chainH - padY * 2;
    const count = 27;

    // guide rings that grow with the assembly
    ctx.save();
    ctx.globalAlpha = 0.2 + eased * 0.5;
    ctx.strokeStyle = 'rgba(232,182,90,0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(chainW * 0.5, chainH * 0.52, Math.min(chainW, chainH) * (0.22 + eased * 0.22), 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(chainW * 0.5, chainH * 0.52, Math.min(chainW, chainH) * (0.31 + eased * 0.15), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // scattered grid positions (a crowd) and assembled dragon positions
    const scattered = [];
    for (let i = 0; i < count; i++) {
      const col = i % 9;
      const row = Math.floor(i / 9);
      scattered.push({
        x: padX + usableW * (0.06 + col * 0.105) + ((row % 2) * 16 - 8),
        y: padY + usableH * (0.38 + row * 0.22) + Math.sin(i * 1.8) * 9,
        angle: Math.sin(i * 1.4) * 0.1
      });
    }

    const assembled = [];
    for (let i = 0; i < count; i++) {
      const t = 0.03 + (i / count) * 0.88;
      const point = chainCurve(t);
      const pointNext = chainCurve(Math.min(0.999, t + 0.01));
      const x = padX + point.x * usableW;
      const y = padY + point.y * usableH;
      const x2 = padX + pointNext.x * usableW;
      const y2 = padY + pointNext.y * usableH;
      assembled.push({ x, y, angle: Math.atan2(y2 - y, x2 - x) - Math.PI / 2 });
    }

    // connecting line behind the bodies
    if (eased > 0.08) {
      ctx.beginPath();
      assembled.forEach((point, i) => {
        if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      });
      const grad = ctx.createLinearGradient(padX, 0, chainW - padX, 0);
      grad.addColorStop(0, `rgba(207,80,51,${eased * 0.22})`);
      grad.addColorStop(0.6, `rgba(232,182,90,${eased * 0.45})`);
      grad.addColorStop(1, `rgba(232,182,90,${eased * 0.12})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }

    // human nodes
    scattered.forEach((start, i) => {
      const end = assembled[i];
      const delayed = clamp((eased - i / count * 0.16) / 0.84, 0, 1);
      const ease = delayed * delayed * (3 - 2 * delayed);
      const x = lerp(start.x, end.x, ease);
      const y = lerp(start.y, end.y, ease);
      const angle = lerp(start.angle, end.angle, ease);
      const pulse = 0.72 + Math.sin(time * 0.0018 + i * 0.7) * 0.08;
      const scale = i === count - 1 ? 1.42 : 1;
      const alpha = (0.45 + ease * 0.5) * pulse;
      humanFigure(ctx, x, y, angle, scale, alpha, i === count - 1 && eased > 0.8);
    });

    // dragon head appears at the front
    if (eased > 0.6) {
      const headProgress = clamp((eased - 0.6) / 0.4, 0, 1);
      const head = assembled[count - 1];
      ctx.save();
      ctx.translate(head.x, head.y);
      ctx.rotate(head.angle + Math.PI / 2);
      ctx.globalAlpha = headProgress;
      ctx.strokeStyle = 'rgba(232,182,90,0.85)';
      ctx.fillStyle = 'rgba(207,80,51,0.12)';
      ctx.lineWidth = 1.25;
      // stylized head contour
      ctx.beginPath();
      ctx.moveTo(0, -3);
      ctx.bezierCurveTo(18, -22, 39, -12, 42, 7);
      ctx.bezierCurveTo(44, 24, 25, 31, 12, 20);
      ctx.lineTo(0, 9);
      ctx.bezierCurveTo(-10, 16, -23, 12, -22, 1);
      ctx.bezierCurveTo(-21, -9, -11, -9, 0, -3);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(16, 1, 4, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(232,182,90,0.9)';
      ctx.fill();
      // horns and whiskers
      ctx.beginPath();
      ctx.moveTo(25, -13); ctx.quadraticCurveTo(37, -29, 50, -20);
      ctx.moveTo(33, -7); ctx.quadraticCurveTo(51, -16, 61, -1);
      ctx.moveTo(-8, 10); ctx.quadraticCurveTo(-27, 28, -46, 13);
      ctx.strokeStyle = 'rgba(232,182,90,0.55)';
      ctx.stroke();
      ctx.restore();
    }

    // label dots & line at bottom
    ctx.save();
    ctx.globalAlpha = 0.32 + eased * 0.2;
    ctx.fillStyle = 'rgba(250,236,217,0.7)';
    ctx.font = '8px Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('UNIT', padX, chainH - 16);
    ctx.fillText('CONNECTION', chainW / 2, chainH - 16);
    ctx.fillText('DRAGON', chainW - padX, chainH - 16);
    ctx.restore();

    if (!staticFrame && chainVisible) {
      const diff = chainTarget - chainProgress;
      if (Math.abs(diff) > 0.0005) {
        chainProgress += diff * 0.065;
      } else {
        chainProgress = chainTarget;
      }
      requestAnimationFrame(drawChain);
    }
  }

  function updateChainUI() {
    const p = chainProgress;
    let newStage = 0;
    if (p >= 82) newStage = 2;
    else if (p >= 24) newStage = 1;
    if (newStage !== chainStageIndex) {
      chainStageIndex = newStage;
      if (chainDesc) {
        chainDesc.style.opacity = '0';
        window.setTimeout(() => {
          chainDesc.textContent = chainTexts[newStage];
          chainDesc.style.opacity = '1';
        }, 140);
      }
      chainTabs.forEach((tab, i) => {
        const isActive = i === newStage;
        tab.classList.toggle('is-active', isActive);
        tab.setAttribute('aria-selected', String(isActive));
      });
    }
    if (chainRange) chainRange.value = Math.round(p);
    if (chainTarget === chainProgress && chainRange) chainRange.setAttribute('aria-valuenow', String(Math.round(p)));
  }

  function animateChainTo(value, instant = false) {
    chainTarget = clamp(value, 0, 100);
    if (instant || reducedMotion) {
      chainProgress = chainTarget;
      drawChain(performance.now(), true);
      updateChainUI();
      return;
    }
    if (!chainVisible) {
      chainProgress = chainTarget;
      return;
    }
    if (!chainAnimating) {
      chainAnimating = true;
      const loop = () => {
        const diff = chainTarget - chainProgress;
        if (Math.abs(diff) > 0.12) {
          chainProgress += diff * 0.07;
          requestAnimationFrame(loop);
        } else {
          chainProgress = chainTarget;
          chainAnimating = false;
        }
        drawChain(performance.now());
        updateChainUI();
      };
      requestAnimationFrame(loop);
    }
  }

  if (chainCanvas && chainStage) {
    resizeChainCanvas();
    if (reducedMotion) {
      chainProgress = 100; chainTarget = 100;
      updateChainUI();
      drawChain(0, true);
    }
    if (hasIO) {
      const io = new IntersectionObserver(entries => {
        chainVisible = entries[0].isIntersecting;
        if (chainVisible) {
          resizeChainCanvas();
          drawChain(performance.now());
          if (!chainAutoStarted && !reducedMotion && !chainTouched) {
            chainAutoStarted = true;
            window.setTimeout(() => animateChainTo(100), 500);
          }
        }
      }, { threshold: 0.28 });
      io.observe(chainStage);
    } else {
      chainVisible = true;
      resizeChainCanvas();
    }
    if (chainRange) {
      chainRange.addEventListener('input', () => {
        chainTouched = true;
        chainAutoStarted = true;
        animateChainTo(Number(chainRange.value));
      });
    }
    chainTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        chainTouched = true;
        chainAutoStarted = true;
        animateChainTo(Number(tab.dataset.chainStep));
        chainTabs.forEach(t => t.setAttribute('aria-selected', String(t === tab)));
      });
    });
    if (chainReplay) {
      chainReplay.addEventListener('click', () => {
        chainTouched = true;
        chainAutoStarted = true;
        chainProgress = 0;
        drawChain(performance.now(), true);
        updateChainUI();
        animateChainTo(100);
      });
    }
    const ro = 'ResizeObserver' in window ? new ResizeObserver(() => resizeChainCanvas()) : null;
    if (ro) ro.observe(chainStage); else window.addEventListener('resize', resizeChainCanvas);
  }

  /* -------------------------------------------------------
     IP three-view switch
     ------------------------------------------------------- */
  $$('[data-ip-viewer]').forEach(card => {
    const imgs = $$('.ip-img', card);
    const buttons = $$('[data-view-btn]', card);
    const caption = $('.ip-view-caption', card);
    const labels = { front: '正面 / FRONT', side: '侧面 / SIDE', back: '背面 / BACK' };
    function setView(view) {
      imgs.forEach(img => img.classList.toggle('is-active', img.dataset.view === view));
      buttons.forEach(btn => {
        const active = btn.dataset.viewBtn === view;
        btn.classList.toggle('is-active', active);
        btn.setAttribute('aria-pressed', String(active));
      });
      if (caption) caption.textContent = labels[view] || labels.front;
    }
    buttons.forEach(btn => btn.addEventListener('click', () => setView(btn.dataset.viewBtn)));
    card.addEventListener('click', e => {
      if (e.target.closest('[data-view-btn]')) return;
      if (e.target.closest('.ip-figure')) {
        const current = buttons.findIndex(btn => btn.classList.contains('is-active'));
        const next = (current + 1) % buttons.length;
        setView(buttons[next].dataset.viewBtn);
      }
    });
  });

  /* -------------------------------------------------------
     Evolution of the mark
     ------------------------------------------------------- */
  const evoSteps = $$('[data-evo]');
  const evoDesc = $('#evoDesc');
  const evoTexts = [
    '圆形徽记把龙首、人链与海浪收进一个完整的圆。三个人形，是这条龙最小的结构单位。',
    '让徽记沿鳞片与盘旋的走势展开，得到可无限拼接的龙纹。它可以在袋面横向铺满，也可以缩成徽章上的一个角标。',
    '把龙纹反向收束成一朵龙云。曲率与收笔保持一致，因此无论在 1.5 cm 还是 50 cm 的载体上，都能辨认同源。'
  ];
  evoSteps.forEach((step, index) => {
    step.addEventListener('click', () => {
      evoSteps.forEach(s => s.classList.toggle('is-active', s === step));
      if (evoDesc) {
        evoDesc.style.opacity = '0';
        window.setTimeout(() => {
          evoDesc.textContent = evoTexts[index];
          evoDesc.style.opacity = '1';
        }, 130);
      }
    });
  });
  if (evoDesc) evoDesc.style.transition = 'opacity .2s';

  /* -------------------------------------------------------
     Palette
     ------------------------------------------------------- */
  const swatches = $$('.swatch');
  const palettePreview = $('#palettePreview');
  const paletteGlyph = $('#paletteGlyph');
  const paletteName = $('#paletteName');
  const paletteHex = $('#paletteHex');
  const paletteRole = $('#paletteRole');
  let activeSwatch = swatches[0];

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    }
    return Promise.resolve(fallbackCopy(text));
  }
  function fallbackCopy(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;left:-9999px;top:0;';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } catch (err) { /* no-op */ }
    ta.remove();
  }
  function setPalette(swatch, shouldCopy = false) {
    if (!swatch) return;
    const hex = swatch.dataset.hex;
    const name = swatch.dataset.name;
    const role = swatch.dataset.role;
    activeSwatch = swatch;
    swatches.forEach(s => s.classList.toggle('is-active', s === swatch));
    if (palettePreview) palettePreview.style.setProperty('--preview-color', hex);
    if (paletteGlyph) paletteGlyph.style.color = hex;
    if (paletteName) paletteName.textContent = name;
    if (paletteHex) paletteHex.textContent = hex;
    if (paletteRole) paletteRole.textContent = role;
    if (shouldCopy) {
      copyText(`${name} ${hex}`).then(() => showToast(`已复制 ${name} ${hex}`));
    }
  }
  swatches.forEach(swatch => {
    swatch.setAttribute('aria-pressed', String(swatch === activeSwatch));
    swatch.addEventListener('click', () => {
      swatches.forEach(s => s.setAttribute('aria-pressed', String(s === swatch)));
      setPalette(swatch, true);
    });
    swatch.addEventListener('mouseenter', () => setPalette(swatch, false));
  });
  const paletteHint = $('#paletteCopyHint');
  if (paletteHint) paletteHint.addEventListener('click', () => setPalette(activeSwatch, true));
  if (swatches.length) setPalette(swatches[0], false);

  /* -------------------------------------------------------
     Products
     ------------------------------------------------------- */
  const PRODUCTS = [
    {
      id: 'badges', num: '01', name: '双 IP 徽章系列', en: 'ENAMEL BADGES',
      category: '收藏', categoryKey: 'collect', position: '收藏 · 引流',
      img: 'assets/products/badges.webp', alt: '双 IP 徽章系列，八枚圆形徽章',
      accent: '#a63a28', stamp: '收藏<br>COLLECT',
      story: '八枚徽章按“单体—组合—场景”三种构图组织：单体看角色，组合看关系，场景看故事。同一色系下用底纹变化区分，既成系列，又不至于雷同。',
      specs: [['材质', '马口铁 0.5 mm / 锌合金'], ['工艺', '金属冲压 + 覆膜（哑光）'], ['规格', '直径 44 / 58 mm'], ['定位', '低决策 · 盲盒集换']]
    },
    {
      id: 'tickets', num: '02', name: '门票与体验券', en: 'TICKETS & PASSES',
      category: '纸品', categoryKey: 'paper', position: '纸品 · 场景',
      img: 'assets/products/tickets.webp', alt: '湛江人龙舞 VIP 门票与体验券',
      accent: '#d66934', stamp: '纸品<br>PAPER',
      story: '这套系统里唯一“带编号”的载体。VIP 与体验券共用同一套底纹与票头，背面预留活动信息与二维码位，可按场次快速改版而不破坏整体。',
      specs: [['材质', '250 g 白卡 / 双面覆膜'], ['工艺', '柯式四色 + 局部光油'], ['规格', '85 × 54 mm'], ['场景', '年例 / 庙会 / 景区']]
    },
    {
      id: 'bag-pvc', num: '03', name: 'PVC 透明手提袋', en: 'PVC TOTE',
      category: '携带', categoryKey: 'carry', position: '携带 · 礼赠',
      img: 'assets/products/bag-pvc.webp', alt: '印有人龙舞群像的透明 PVC 手提袋',
      accent: '#3e7a52', stamp: '携带<br>CARRY',
      story: '把“人龙”图景置于袋内，商品与画面互为背景。高清 UV 彩印兼顾通透与耐用，是展陈现场最轻、最容易被带走的一件。',
      specs: [['材质', 'PVC 0.3 mm'], ['工艺', '高清 UV 彩印'], ['规格', '280 × 340 × 90 mm'], ['特色', '透明袋内衬图景']]
    },
    {
      id: 'bag-canvas', num: '04', name: '帆布袋', en: 'CANVAS TOTE',
      category: '携带', categoryKey: 'carry', position: '携带 · 主力',
      img: 'assets/products/bag-canvas.webp', alt: '印有小湛龙竖构图的米白帆布袋',
      accent: '#b9853c', stamp: '携带<br>CARRY',
      story: '角色被放进竖构图，与袋型比例贴合。12 安本色棉保留布面的粗粝感，与 PVC 的“轻”形成一实一虚的价位覆盖。',
      specs: [['材质', '12 安本色棉'], ['工艺', '丝网印刷'], ['规格', '380 × 420 mm'], ['版式', '角色竖构图']]
    },
    {
      id: 'tee', num: '05', name: '双色 T 恤', en: 'TEE / TWO VERSIONS',
      category: '穿戴', categoryKey: 'wear', position: '穿戴 · 主力',
      img: 'assets/products/tee-green.webp', alt: '印有小湛龙人形图案的白色 T 恤',
      gallery: [
        { src: 'assets/products/tee-green.webp', caption: '双色 T 恤 · 人形版 / 小湛龙' },
        { src: 'assets/products/tee-dragon.webp', caption: '双色 T 恤 · 龙纹版 / 人龙舞' }
      ],
      accent: '#3e7a52', stamp: '穿戴<br>WEAR',
      story: 'T 恤分“人形版”与“龙纹版”：前者以角色为主角，后者让主图形横向铺满，对应“我喜欢”与“我们喜欢”两种购买动机。',
      specs: [['材质', '精梳棉 200 g'], ['工艺', '数码直喷'], ['尺码', 'S — XXL'], ['版式', '人形版 / 龙纹版']]
    },
    {
      id: 'phone', num: '06', name: '手机壳', en: 'PHONE CASE',
      category: '穿戴', categoryKey: 'wear', position: '穿戴 · 高频',
      img: 'assets/products/phone.webp', alt: '印有小湛龙与小玲珑的手机壳',
      accent: '#a63a28', stamp: '穿戴<br>WEAR',
      story: '每天都会看到的物件，承担高频曝光。图形被特别压缩为竖向构图，避开镜头孔后仍能读全“人龙”的走势。',
      specs: [['材质', 'TPU 软边 + PC 硬背'], ['工艺', 'IMD 覆膜'], ['适配', '主流机型开孔'], ['结构', '镜头孔全包']]
    },
    {
      id: 'keyring', num: '07', name: '钥匙扣', en: 'KEYRING',
      category: '携带', categoryKey: 'carry', position: '携带 · 引流',
      img: 'assets/products/keyring.webp', alt: '金色龙纹与双 IP 亚克力钥匙扣',
      accent: '#d66934', stamp: '携带<br>CARRY',
      story: '轻巧、便携、低门槛。双面异图让一枚小物拥有两种观看方式，也让主图形有机会被缩到 1.5 cm 仍然成立。',
      specs: [['材质', '锌合金 + 亚克力'], ['工艺', '双面滴胶'], ['规格', '65 × 45 mm'], ['结构', '双面异图']]
    },
    {
      id: 'cups', num: '08', name: '奶茶杯', en: 'PAPER CUP',
      category: '桌面', categoryKey: 'desk', position: '桌面 · 快消',
      img: 'assets/products/cups.webp', alt: '印有双 IP 形象的奶茶纸杯',
      accent: '#b9853c', stamp: '桌面<br>DAILY',
      story: '纸杯是最容易进入日常的载体。与本地茶饮联名即可快速铺开，让非遗出现在年轻人每天都会拿起的地方。',
      specs: [['材质', '食品级淋膜纸'], ['工艺', '八色柔印'], ['规格', '16 oz / 9 oz'], ['场景', '茶饮联名']]
    },
    {
      id: 'postcards', num: '09', name: '明信片', en: 'POSTCARD',
      category: '纸品', categoryKey: 'paper', position: '纸品 · 传播',
      img: 'assets/products/postcards.webp', alt: '人龙舞主题明信片与小湛龙明信片',
      accent: '#a63a28', stamp: '纸品<br>PAPER',
      story: '承担“寄得出”的传播功能。背面预留手写区与邮资位，正面用足主图形；一张卡片可以让一次观看变成一次寄送。',
      specs: [['材质', '300 g 特种纸'], ['工艺', '柯式四色'], ['规格', 'A6'], ['场景', '现场寄递']]
    },
    {
      id: 'stickers', num: '10', name: '贴纸套装', en: 'STICKER SET',
      category: '收藏', categoryKey: 'collect', position: '收藏 · 引流',
      img: 'assets/products/stickers.webp', alt: '人龙舞角色贴纸与亚克力挂件展示',
      accent: '#d66934', stamp: '收藏<br>COLLECT',
      story: '最低单价、最高自由度。贴纸的模切轮廓直接复用主图形外轮廓，撕下来就是一条小龙，是展会现场的“随手带走”。',
      specs: [['材质', 'PVC 不干胶'], ['工艺', '模切成型'], ['规格', '100 × 150 mm 整版'], ['定位', '展会随手带走']]
    },
    {
      id: 'acrylic', num: '11', name: '亚克力挂件', en: 'ACRYLIC CHARM',
      category: '收藏', categoryKey: 'collect', position: '收藏 · 礼赠',
      img: 'assets/products/acrylic.webp', alt: '小湛龙与小玲珑圆形亚克力挂件',
      accent: '#3e7a52', stamp: '收藏<br>COLLECT',
      story: '3 mm 透明亚克力双面 UV 印刷，低单价、高完成度。小批量即可开模，适合作为展会的最后一枚“带走物”。',
      specs: [['材质', '3 mm 透明亚克力'], ['工艺', '双面 UV 印刷'], ['规格', '60 × 80 mm'], ['定位', '低单价 · 高完成度']]
    }
  ];

  const productIndex = $('#productIndex');
  const productThumbs = $('#productThumbs');
  const productImg = $('#productImg');
  const productNum = $('#productNum');
  const productStamp = $('#productStamp');
  const productCategory = $('#productCategory');
  const productOrder = $('#productOrder');
  const productName = $('#productName');
  const productEn = $('#productEn');
  const productStory = $('#productStory');
  const productSpecs = $('#productSpecs');
  const productStage = $('#productStage');
  const productVisibleCount = $('#productVisibleCount');
  const productNext = $('#productNext');
  const productZoom = $('#productZoom');
  const autoTour = $('#autoTour');
  const filterButtons = $$('[data-filter]');
  let currentProduct = 0;
  let visibleProducts = PRODUCTS.map((_, i) => i);
  let activeFilter = 'all';
  let autoTourTimer = 0;
  let autoTourActive = false;
  let productSwitchTimer = 0;
  let productVisible = false;

  function buildProductList() {
    if (!productIndex || !productThumbs) return;
    productIndex.innerHTML = '';
    productThumbs.innerHTML = '';
    PRODUCTS.forEach((product, index) => {
      const item = document.createElement('button');
      item.type = 'button';
      item.className = 'product-index__item';
      item.dataset.productIndex = String(index);
      item.setAttribute('aria-label', `查看第 ${product.num} 件周边：${product.name}`);
      item.innerHTML = `<span>${product.num}</span><strong>${product.name}</strong><em>${product.category}</em>`;
      item.addEventListener('click', () => selectProduct(index));

      const thumb = document.createElement('button');
      thumb.type = 'button';
      thumb.className = 'product-thumb';
      thumb.dataset.productIndex = String(index);
      thumb.setAttribute('aria-label', `选择${product.name}`);
      thumb.innerHTML = `<img src="${product.img}" alt="" loading="lazy" decoding="async"><span>${product.name}<em>${product.num}</em></span>`;
      thumb.addEventListener('click', () => selectProduct(index));

      productIndex.appendChild(item);
      productThumbs.appendChild(thumb);
    });
  }

  function applyFilter(filter) {
    activeFilter = filter;
    visibleProducts = PRODUCTS.map((p, i) => ({ p, i })).filter(({ p }) => filter === 'all' || p.categoryKey === filter).map(({ i }) => i);
    if (!visibleProducts.length) visibleProducts = PRODUCTS.map((_, i) => i);
    filterButtons.forEach(btn => btn.classList.toggle('is-active', btn.dataset.filter === filter));
    $$('.product-index__item').forEach(item => {
      const isVisible = visibleProducts.includes(Number(item.dataset.productIndex));
      item.classList.toggle('is-hidden', !isVisible);
    });
    $$('.product-thumb').forEach(thumb => {
      const isVisible = visibleProducts.includes(Number(thumb.dataset.productIndex));
      thumb.classList.toggle('is-hidden', !isVisible);
    });
    if (productVisibleCount) productVisibleCount.textContent = `${visibleProducts.length} PIECE${visibleProducts.length > 1 ? 'S' : ''}`;
    if (!visibleProducts.includes(currentProduct)) selectProduct(visibleProducts[0]);
    if (autoTourActive) restartAutoTour();
  }

  function selectProduct(index, options = {}) {
    if (!PRODUCTS[index]) return;
    currentProduct = index;
    const product = PRODUCTS[index];
    $$('.product-index__item').forEach(item => item.classList.toggle('is-active', Number(item.dataset.productIndex) === index));
    $$('.product-thumb').forEach(thumb => thumb.classList.toggle('is-active', Number(thumb.dataset.productIndex) === index));

    if (productStage) {
      productStage.style.setProperty('--accent', product.accent);
      productStage.dataset.accent = product.accent;
    }
    if (productNum) productNum.textContent = product.num;
    if (productStamp) productStamp.innerHTML = product.stamp;
    if (productCategory) productCategory.textContent = product.position;
    if (productOrder) productOrder.textContent = `NO. ${product.num} / 11`;
    if (productName) productName.textContent = product.name;
    if (productEn) productEn.textContent = product.en;
    if (productStory) productStory.textContent = product.story;
    if (productSpecs) {
      productSpecs.innerHTML = product.specs.map(([key, value]) => `<div><dt>${key}</dt><dd>${value}</dd></div>`).join('');
    }
    if (productImg) {
      window.clearTimeout(productSwitchTimer);
      productImg.classList.add('is-switching');
      productSwitchTimer = window.setTimeout(() => {
        productImg.src = product.img;
        productImg.alt = product.alt;
        const reveal = () => {
          productImg.classList.remove('is-switching');
          productImg.classList.add('is-loaded');
        };
        if (productImg.complete) reveal();
        else productImg.addEventListener('load', reveal, { once: true });
      }, reducedMotion ? 0 : 180);
    }
    if (options.scrollIntoView) {
      const activeThumb = $$('.product-thumb').find(thumb => Number(thumb.dataset.productIndex) === index);
      if (activeThumb) activeThumb.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'nearest', inline: 'center' });
    }
  }

  function nextProduct() {
    if (!visibleProducts.length) return;
    const pos = visibleProducts.indexOf(currentProduct);
    const next = visibleProducts[(pos + 1) % visibleProducts.length];
    selectProduct(next, { scrollIntoView: true });
  }

  function prevProduct() {
    if (!visibleProducts.length) return;
    const pos = visibleProducts.indexOf(currentProduct);
    const next = visibleProducts[(pos - 1 + visibleProducts.length) % visibleProducts.length];
    selectProduct(next, { scrollIntoView: true });
  }

  function restartAutoTour() {
    window.clearInterval(autoTourTimer);
    if (!autoTourActive) return;
    autoTourTimer = window.setInterval(nextProduct, 4300);
  }

  function toggleAutoTour() {
    autoTourActive = !autoTourActive;
    if (autoTour) {
      autoTour.setAttribute('aria-pressed', String(autoTourActive));
      autoTour.querySelector('em').textContent = autoTourActive ? 'ON' : 'OFF';
    }
    if (autoTourActive) restartAutoTour(); else window.clearInterval(autoTourTimer);
  }

  buildProductList();
  selectProduct(0);
  filterButtons.forEach(btn => btn.addEventListener('click', () => applyFilter(btn.dataset.filter)));
  if (productNext) productNext.addEventListener('click', nextProduct);
  if (autoTour) autoTour.addEventListener('click', toggleAutoTour);

  function openProductLightbox() {
    const p = PRODUCTS[currentProduct];
    const items = p.gallery && p.gallery.length
      ? p.gallery
      : [{ src: p.img, caption: `${p.name} / ${p.en}` }];
    openLightbox(items, 0, 'product');
  }
  if (productZoom) productZoom.addEventListener('click', openProductLightbox);
  if (productImg) {
    productImg.addEventListener('click', openProductLightbox);
    productImg.style.cursor = 'zoom-in';
  }

  if (hasIO && productStage) {
    const prodIO = new IntersectionObserver(entries => {
      productVisible = entries[0].isIntersecting;
      if (!productVisible && autoTourActive) {
        window.clearInterval(autoTourTimer);
      } else if (productVisible && autoTourActive) {
        restartAutoTour();
      }
    }, { threshold: 0.15 });
    prodIO.observe(productStage);
  }

  // Preload product images once the page is idle.
  window.addEventListener('load', () => {
    PRODUCTS.forEach(p => { const img = new Image(); img.src = p.img; });
  });

  /* -------------------------------------------------------
     Prepress checklist
     ------------------------------------------------------- */
  const prepress = $('.prepress');
  const prepressList = $('#prepressList');
  const prepressCount = $('#prepressCount');
  const prepressBar = $('#prepressBar');
  if (prepressList) {
    const checks = $$('input[type="checkbox"]', prepressList);
    const updateChecklist = () => {
      const done = checks.filter(c => c.checked).length;
      if (prepressCount) prepressCount.textContent = `${done} / ${checks.length}`;
      if (prepressBar) prepressBar.style.width = `${(done / checks.length) * 100}%`;
      if (prepress) prepress.classList.toggle('is-ready', done === checks.length);
      if (done === checks.length) showToast('五项核查完成，方案可进入打样');
    };
    checks.forEach(check => check.addEventListener('change', updateChecklist));
    updateChecklist();
  }

  /* -------------------------------------------------------
     Process tabs
     ------------------------------------------------------- */
  const PROCESS_STEPS = [
    {
      kicker: 'PHASE 01 / RESEARCH', title: '先确认“人链”是真的结构，不是修辞。',
      text: '以文献与影像为主，梳理源流、表演程式与身体结构。把“人链”拆成单元、连接、重复三个变量，把“龙头”拆成冠、角、须、目四个特征，把“海浪”拆成一条有节奏的波线。',
      meta: '文献 · 影像 · 口述', img: 'assets/hero/origin-scene.webp', alt: '东海岛海岸的人龙舞场景', tag: 'FIELD NOTE / 01'
    },
    {
      kicker: 'PHASE 02 / EXTRACT', title: '把身体关系，翻译成可以复用的图形语法。',
      text: '圆形代表人，弧线代表连接，重复与错位代表生长。标志、辅助图形与主图形从同一套曲率与收笔方式里长出来，保证任何尺寸下都能辨认同源。',
      meta: '人链 · 龙头 · 海浪', img: 'assets/system/logo-sketch.webp', alt: '标志与辅助图形线稿推演', tag: 'SYMBOL / 02'
    },
    {
      kicker: 'PHASE 03 / CHARACTER', title: '先铅笔稿，再三视图，让角色可以被做出来。',
      text: '小湛龙与小玲珑共享 2.5 头身、描边粗细与高光位置，差异只落在色相、发型与道具上。正面用于平面与印花，侧面服务开模，背面用于服装延展。',
      meta: '小湛龙 / 小玲珑', img: 'assets/process/sketch-views.webp', alt: '双 IP 三视图结构线稿', tag: 'CHARACTER / 03'
    },
    {
      kicker: 'PHASE 04 / SYSTEM', title: '标志、色彩、字体、网格，同步推进。',
      text: '朱砂红、暖橘、藤黄、米白、墨褐构成海洋暖调；毛笔字负责非遗的笔锋，无衬线负责信息层的可用。双展板承载“品牌视觉”与“工艺落地”两条叙事线。',
      meta: '标志 · 色彩 · 版式', img: 'assets/system/logo-sketch.webp', alt: '标志与辅助图形推演线稿', tag: 'SYSTEM / 04'
    },
    {
      kicker: 'PHASE 05 / EXPAND', title: '从 4 类到 11 类，用产品检验图形的兼容性。',
      text: '穿戴、携带、桌面、纸品与收藏四个场景，要求同一图形在 1.5 cm 的钥匙扣与 50 cm 的帆布袋上同样成立。扩品不是加法，而是对系统的一次压力测试。',
      meta: '11 类周边 · 4 个场景', img: 'assets/products/overview.webp', alt: '人龙舞周边产品总览', tag: 'PRODUCTS / 05'
    },
    {
      kicker: 'PHASE 06 / FINAL', title: '最后两稿，把“好看的图”变成“能开口说话的牌子”。',
      text: '统一主标题为“岭南人龙舞”，把长段落压缩成短语式说明，把工艺参数逐项标注到产品旁。定稿不是收尾，而是让文化、工艺、传播与商业同时到位。',
      meta: '双语锁定 · 工艺标注 · 定稿', img: 'assets/products/craft-detail.webp', alt: '产品印花、徽章与手提袋工艺细节', tag: 'FINAL / 06'
    }
  ];
  const processImg = $('#processImg');
  const processImgTag = $('#processImgTag');
  const processKicker = $('#processKicker');
  const processTitleSmall = $('#processTitleSmall');
  const processText = $('#processText');
  const processMeta = $('#processMeta');
  const processIndex = $('#processIndex');
  const processSteps = $$('[data-process]');
  let processSwitchTimer = 0;

  processSteps.forEach((step, index) => {
    step.addEventListener('click', () => {
      const data = PROCESS_STEPS[index];
      processSteps.forEach(s => {
        const active = s === step;
        s.classList.toggle('is-active', active);
        s.setAttribute('aria-selected', String(active));
      });
      if (!data) return;
      if (processKicker) processKicker.textContent = data.kicker;
      if (processTitleSmall) processTitleSmall.textContent = data.title;
      if (processText) processText.textContent = data.text;
      if (processMeta) processMeta.textContent = data.meta;
      if (processIndex) processIndex.textContent = `0${index + 1} / 06`;
      if (processImgTag) processImgTag.textContent = data.tag;
      if (processImg) {
        window.clearTimeout(processSwitchTimer);
        processImg.classList.add('is-switching');
        processSwitchTimer = window.setTimeout(() => {
          processImg.src = data.img;
          processImg.alt = data.alt;
          const done = () => processImg.classList.remove('is-switching');
          if (processImg.complete) requestAnimationFrame(done); else processImg.addEventListener('load', done, { once: true });
        }, reducedMotion ? 0 : 180);
      }
    });
  });

  /* -------------------------------------------------------
     Compare slider
     ------------------------------------------------------- */
  const compare = $('#compare');
  const compareAfter = compare ? $('.compare__after', compare) : null;
  const compareHandle = $('#compareHandle');
  let compareValue = 50;
  let compareDragging = false;

  function setCompare(value) {
    compareValue = clamp(value, 0, 100);
    if (compareAfter) compareAfter.style.clipPath = `inset(0 0 0 ${compareValue}%)`;
    if (compareHandle) {
      compareHandle.style.left = `${compareValue}%`;
      compareHandle.setAttribute('aria-valuenow', String(Math.round(compareValue)));
    }
  }
  if (compare && compareHandle) {
    const updateFromEvent = e => {
      const rect = compare.getBoundingClientRect();
      setCompare(((e.clientX - rect.left) / rect.width) * 100);
    };
    compare.addEventListener('pointerdown', e => {
      compareDragging = true;
      compare.setPointerCapture?.(e.pointerId);
      compare.classList.add('is-dragging');
      updateFromEvent(e);
    });
    compare.addEventListener('pointermove', e => { if (compareDragging) updateFromEvent(e); });
    compare.addEventListener('pointerup', e => {
      compareDragging = false;
      compare.classList.remove('is-dragging');
      compare.releasePointerCapture?.(e.pointerId);
    });
    compare.addEventListener('pointercancel', () => { compareDragging = false; compare.classList.remove('is-dragging'); });
    compareHandle.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); setCompare(compareValue - 4); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); setCompare(compareValue + 4); }
      if (e.key === 'Home') { e.preventDefault(); setCompare(0); }
      if (e.key === 'End') { e.preventDefault(); setCompare(100); }
    });
    setCompare(50);
  }

  /* -------------------------------------------------------
     Counters
     ------------------------------------------------------- */
  const counters = $$('[data-count]');
  const counterObserver = hasIO && !reducedMotion ? new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = Number(el.dataset.count || 0);
      const start = performance.now();
      const duration = 1500;
      const tick = now => {
        const t = clamp((now - start) / duration, 0, 1);
        const eased = easeOut(t);
        el.textContent = String(Math.round(target * eased));
        if (t < 1) requestAnimationFrame(tick); else el.textContent = String(target);
      };
      requestAnimationFrame(tick);
      counterObserver.unobserve(el);
    });
  }, { threshold: 0.6 }) : null;
  counters.forEach(el => {
    if (counterObserver) {
      el.textContent = '0';
      counterObserver.observe(el);
    } else {
      el.textContent = String(el.dataset.count);
    }
  });

  /* -------------------------------------------------------
     Lightbox
     ------------------------------------------------------- */
  const lightbox = $('#lightbox');
  const lightboxImg = $('#lightboxImg');
  const lightboxCaption = $('#lightboxCaption');
  const lightboxCounter = $('#lightboxCounter');
  const lightboxThumbs = $('#lightboxThumbs');
  const lightboxPrev = $('#lightboxPrev');
  const lightboxNext = $('#lightboxNext');
  const lightboxImageWrap = $('#lightboxImageWrap');
  const lightboxCloseBtns = $$('[data-lightbox-close]');
  let lightboxItems = [];
  let lightboxIndex = 0;
  let lightboxOpen = false;
  let lightboxPreviousFocus = null;

  function renderLightbox() {
    const item = lightboxItems[lightboxIndex];
    if (!item || !lightboxImg) return;
    lightboxImg.classList.add('is-switching');
    window.setTimeout(() => {
      lightboxImg.src = item.src;
      lightboxImg.alt = item.caption || '作品大图';
      if (lightboxCaption) lightboxCaption.textContent = item.caption || '作品大图';
      if (lightboxCounter) lightboxCounter.textContent = `${lightboxIndex + 1} / ${lightboxItems.length}`;
      window.setTimeout(() => lightboxImg.classList.remove('is-switching'), 40);
    }, reducedMotion ? 0 : 120);
    const hasMultiple = lightboxItems.length > 1;
    if (lightboxPrev) lightboxPrev.disabled = !hasMultiple;
    if (lightboxNext) lightboxNext.disabled = !hasMultiple;
    if (lightboxThumbs) {
      lightboxThumbs.innerHTML = '';
      if (hasMultiple) {
        lightboxItems.forEach((entry, i) => {
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = `lightbox__thumb${i === lightboxIndex ? ' is-active' : ''}`;
          btn.setAttribute('aria-label', `查看第 ${i + 1} 张`);
          btn.innerHTML = `<img src="${entry.src}" alt="">`;
          btn.addEventListener('click', () => { lightboxIndex = i; renderLightbox(); });
          lightboxThumbs.appendChild(btn);
        });
      }
    }
    if (lightboxImageWrap) lightboxImageWrap.scrollTop = 0;
  }

  function openLightbox(items, index = 0, kind = '') {
    if (!lightbox || !items || !items.length) return;
    if (menuOpen) closeMenu(false);
    if (demoActive && !demoPaused) pauseDemo();
    lightboxItems = items;
    lightboxIndex = clamp(index, 0, items.length - 1);
    lightboxPreviousFocus = document.activeElement;
    lightboxOpen = true;
    lightbox.classList.add('is-open');
    lightbox.classList.remove('is-zoomed');
    lightbox.classList.toggle('is-product', kind === 'product');
    lightbox.setAttribute('aria-hidden', 'false');
    body.classList.add('is-locked', 'lightbox-open');
    setPageInert(true);
    renderLightbox();
    window.setTimeout(() => {
      const close = $('.lightbox__close', lightbox);
      if (close) close.focus({ preventScroll: true });
    }, 160);
  }

  function closeLightbox() {
    if (!lightbox || !lightboxOpen) return;
    lightboxOpen = false;
    lightbox.classList.remove('is-open', 'is-zoomed', 'is-product');
    lightbox.setAttribute('aria-hidden', 'true');
    body.classList.remove('is-locked', 'lightbox-open');
    setPageInert(false);
    if (lightboxPreviousFocus && typeof lightboxPreviousFocus.focus === 'function') {
      lightboxPreviousFocus.focus({ preventScroll: true });
    }
  }

  function navigateLightbox(direction) {
    if (!lightboxOpen || lightboxItems.length < 2) return;
    lightboxIndex = (lightboxIndex + direction + lightboxItems.length) % lightboxItems.length;
    lightbox.classList.remove('is-zoomed');
    renderLightbox();
  }

  lightboxCloseBtns.forEach(btn => btn.addEventListener('click', closeLightbox));
  if (lightboxPrev) lightboxPrev.addEventListener('click', () => navigateLightbox(-1));
  if (lightboxNext) lightboxNext.addEventListener('click', () => navigateLightbox(1));
  if (lightboxImg) {
    lightboxImg.addEventListener('click', () => {
      if (!lightbox) return;
      lightbox.classList.toggle('is-zoomed');
      if (lightboxImageWrap) lightboxImageWrap.scrollTop = 0;
    });
  }

  const archiveCards = $$('.archive-card');
  const archiveItems = archiveCards.map(card => ({
    src: card.dataset.lightboxSrc,
    caption: card.dataset.lightboxCaption || '创作档案'
  }));
  archiveCards.forEach((card, index) => {
    card.addEventListener('click', () => openLightbox(archiveItems, index));
  });

  const boardItems = [
    { src: 'assets/boards/board1.webp', caption: '展板一 · 品牌视觉设计 / IP 形象 / 海报与周边' },
    { src: 'assets/boards/board2.webp', caption: '展板二 · 产品细节与工艺 / 总结与价值' }
  ];
  $$('.board-card').forEach(card => {
    card.addEventListener('click', () => openLightbox(boardItems, Number(card.dataset.boardIndex) || 0));
  });
  $$('[data-open-boards]').forEach(btn => btn.addEventListener('click', () => openLightbox(boardItems, 0)));

  /* -------------------------------------------------------
     Presentation / demo mode
     ------------------------------------------------------- */
  const demoBar = $('#demoBar');
  const demoChapter = $('#demoChapter');
  const demoCount = $('#demoCount');
  const demoTicks = $('#demoTicks');
  const demoPrev = $('#demoPrev');
  const demoNext = $('#demoNext');
  const demoPause = $('#demoPause');
  const demoClose = $('#demoClose');
  const demoProgress = $('#demoProgress');
  const demoStops = [];
  sections.forEach(section => {
    demoStops.push({
      id: section.id,
      label: section.dataset.chapter || section.id,
      el: section,
      offset: section.id === 'hero' ? 0 : 62
    });
    const extras = {
      system: [['品牌色彩', '.palette-block', 100]],
      products: [['周边矩阵', '.product-console', 100]],
      craft: [['印前核查', '.prepress', 100]],
      process: [['前后对照', '.compare-block', 100], ['创作档案', '.archive-head', 100]],
      value: [['结语', '.closing', 100]]
    }[section.id];
    if (extras) {
      extras.forEach(([label, selector, offset]) => {
        const el = $(selector, section);
        if (el) demoStops.push({ id: section.id, label, el, offset });
      });
    }
  });
  const DEMO_DURATION = 8000;
  let demoActive = false;
  let demoPaused = false;
  let demoIndex = 0;
  let demoStart = 0;
  let demoElapsed = 0;
  let demoRaf = 0;

  function buildDemoTicks() {
    if (!demoTicks) return;
    demoTicks.innerHTML = demoStops.map((_, i) => `<i data-tick="${i}"></i>`).join('');
  }
  buildDemoTicks();

  function updateDemoUI() {
    if (demoChapter) demoChapter.textContent = demoStops[demoIndex]?.label || '';
    if (demoCount) demoCount.textContent = `${String(demoIndex + 1).padStart(2, '0')} / ${String(demoStops.length).padStart(2, '0')}`;
    $$('#demoTicks i').forEach((tick, i) => {
      tick.classList.toggle('is-now', i === demoIndex);
      tick.classList.toggle('is-done', i < demoIndex);
    });
    if (demoPause) {
      demoPause.classList.toggle('is-paused', demoPaused);
      const em = demoPause.querySelector('em');
      if (em) em.textContent = demoPaused ? '继续' : '暂停';
      demoPause.setAttribute('aria-label', demoPaused ? '继续演示' : '暂停演示');
    }
  }

  function setDemoProgress(ratio) {
    if (demoProgress) demoProgress.style.width = `${clamp(ratio, 0, 1) * 100}%`;
  }

  function demoLoop(now) {
    if (!demoActive || demoPaused) return;
    if (!demoStart) demoStart = now;
    const elapsed = demoElapsed + (now - demoStart);
    const ratio = clamp(elapsed / DEMO_DURATION, 0, 1);
    setDemoProgress(ratio);
    if (ratio >= 1) {
      if (demoIndex < demoStops.length - 1) {
        goToDemoStop(demoIndex + 1);
      } else {
        demoPaused = true;
        setDemoProgress(1);
        updateDemoUI();
        showToast('演示结束 · 按 → 回到序章，或按 × 退出');
        return;
      }
    } else {
      demoRaf = requestAnimationFrame(demoLoop);
    }
  }

  function startDemoTimer() {
    cancelAnimationFrame(demoRaf);
    demoStart = 0;
    demoElapsed = 0;
    setDemoProgress(0);
    if (!demoPaused) demoRaf = requestAnimationFrame(demoLoop);
  }

  function goToDemoStop(index) {
    if (!demoStops.length) return;
    if (index < 0) index = demoStops.length - 1;
    if (index >= demoStops.length) index = 0;
    demoIndex = clamp(index, 0, demoStops.length - 1);
    updateDemoUI();
    const stop = demoStops[demoIndex];
    if (stop) {
      const top = stop.el.getBoundingClientRect().top + window.scrollY - (stop.offset || 62);
      window.scrollTo({ top: Math.max(0, top), behavior: reducedMotion ? 'auto' : 'smooth' });
      history.replaceState(null, '', `#${stop.id}`);
    }
    demoPaused = false;
    startDemoTimer();
    updateDemoUI();
  }

  function startDemo(fromCurrent = true) {
    if (!demoStops.length) return;
    if (menuOpen) closeMenu(false);
    if (lightboxOpen) closeLightbox();
    demoActive = true;
    demoPaused = false;
    body.classList.add('is-demo');
    if (demoBar) {
      demoBar.classList.add('is-active');
      demoBar.setAttribute('aria-hidden', 'false');
    }
    setPageInert(false);
    let startIndex = 0;
    if (fromCurrent) {
      const current = getActiveSection();
      const found = demoStops.findIndex(stop => stop.el === current);
      startIndex = found >= 0 ? found : 0;
    }
    goToDemoStop(startIndex);
    showToast('演示模式：每 8 秒自动巡览，空格暂停');
  }

  function stopDemo() {
    if (!demoActive) return;
    demoActive = false;
    demoPaused = false;
    cancelAnimationFrame(demoRaf);
    body.classList.remove('is-demo');
    if (demoBar) {
      demoBar.classList.remove('is-active');
      demoBar.setAttribute('aria-hidden', 'true');
    }
    setDemoProgress(0);
    const current = getActiveSection();
    if (current) history.replaceState(null, '', `#${current.id}`);
  }

  function pauseDemo() {
    if (!demoActive) return;
    demoPaused = !demoPaused;
    if (demoPaused) {
      if (demoStart) demoElapsed += performance.now() - demoStart;
      demoStart = 0;
      cancelAnimationFrame(demoRaf);
    } else {
      if (demoElapsed >= DEMO_DURATION) demoElapsed = 0;
      demoStart = 0;
      demoRaf = requestAnimationFrame(demoLoop);
    }
    updateDemoUI();
  }

  $$('[data-demo-open]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.hasAttribute('data-demo-from-menu')) {
        closeMenu(false);
        window.setTimeout(() => startDemo(true), 360);
      } else {
        startDemo(true);
      }
    });
  });
  if (demoClose) demoClose.addEventListener('click', stopDemo);
  if (demoPrev) demoPrev.addEventListener('click', () => goToDemoStop(demoIndex - 1));
  if (demoNext) demoNext.addEventListener('click', () => goToDemoStop(demoIndex + 1));
  if (demoPause) demoPause.addEventListener('click', pauseDemo);

  /* -------------------------------------------------------
     Keyboard
     ------------------------------------------------------- */
  function trapFocus(container, e) {
    if (!container || e.key !== 'Tab') return;
    const focusable = $$('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])', container).filter(el => el.offsetParent !== null);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  document.addEventListener('keydown', e => {
    const tag = (e.target.tagName || '').toLowerCase();
    const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable;

    if (e.key === 'Escape') {
      if (lightboxOpen) { closeLightbox(); return; }
      if (menuOpen) { closeMenu(); return; }
      if (demoActive) { stopDemo(); return; }
    }

    if (lightboxOpen) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); navigateLightbox(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); navigateLightbox(1); }
      trapFocus(lightbox, e);
      return;
    }

    if (menuOpen) {
      trapFocus(menu, e);
      return;
    }

    if (demoActive) {
      if (e.code === 'Space') { e.preventDefault(); pauseDemo(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); goToDemoStop(demoIndex + 1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goToDemoStop(demoIndex - 1); return; }
    }

    if (isTyping) return;

    if (e.key === 'p' || e.key === 'P') {
      e.preventDefault();
      if (demoActive) stopDemo(); else startDemo(true);
      return;
    }

    if (activeSection === 'products' && !demoActive) {
      if (e.key === 'ArrowRight') { e.preventDefault(); nextProduct(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); prevProduct(); }
    }
  });

  /* -------------------------------------------------------
     Small observability + initial state
     ------------------------------------------------------- */

  /* -------------------------------------------------------
     Optional section-preview mode (used for design QA)
     ------------------------------------------------------- */
  const previewId = new URLSearchParams(window.location.search).get('preview');
  if (previewId) {
    const target = document.getElementById(previewId);
    if (target) {
      document.documentElement.classList.add('preview-mode');
      $$('main > section').forEach(section => {
        if (section !== target) section.style.display = 'none';
      });
      $$('.site-header, .chapter-rail, .page-progress, .hero__marquee').forEach(el => el.style.display = 'none');
      window.scrollTo(0, 0);
      window.setTimeout(() => {
        $$('[data-reveal]', target).forEach(el => el.classList.add('is-visible'));
        window.scrollTo(0, 0);
      }, 350);
    }
  }

  body.dataset.activeTheme = 'dark';
  updateProgress();

  // Cursor state reset for screenshots / reduced motion
  if (reducedMotion) body.classList.add('reduced-motion');

  // If a visitor lands on a hash, make sure active chapter syncs after layout.
  window.addEventListener('hashchange', () => {
    if (demoActive) stopDemo();
    updateActiveSection();
  });

  // Avoid initial reveal gaps if the browser restores scroll before IntersectionObserver.
  window.setTimeout(updateActiveSection, 300);
  window.setTimeout(updateActiveSection, 1200);
})();
