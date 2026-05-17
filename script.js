
  // ── Haptic feedback (Android only - iOS Safari does not support Vibration API) ──
  const hapticOK = 'vibrate' in navigator;
  window.haptic = function (kind) {
    if (!hapticOK) return;
    // Patterns chosen to feel like iOS UIImpactFeedback equivalents on Android
    const patterns = {
      tap: 8,        // selection / standard tap
      pop: 14,       // button confirm
      success: [10, 40, 10],
      warning: [20, 30, 20],
      heavy: 22      // important action (PTR cross, bingo cell mark)
    };
    try { navigator.vibrate(patterns[kind] || patterns.tap); } catch (_) {}
  };

  // Apply tap haptic globally to interactive elements via a single delegated handler
  document.addEventListener('click', (e) => {
    const el = e.target.closest('.tabbar-item, .btn, .map-chip, .day-jump, .bingo-cell, .day-card-share, .mlr-dir, .bingo-tab, .nav-mobile a');
    if (el) window.haptic(el.classList.contains('bingo-cell') ? 'heavy' : 'tap');
  }, { capture: true });

  // ── App version - keep in sync with VERSION constant at top of sw.js ──
  const APP_VERSION = 'v16';

  // ── Service worker: offline support + auto-update on new deploys ────
  // When a new SW activates we reload the page automatically so users
  // pick up the latest HTML/CSS/JS without having to clear their cache.
  function showUpdateToast(text) {
    let el = document.getElementById('update-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'update-toast';
      el.className = 'update-toast';
      document.body.appendChild(el);
    }
    el.textContent = text || 'New version - refreshing...';
    // Force reflow then add show class so transition runs
    void el.offsetWidth;
    el.classList.add('show');
  }

  async function forceUpdateNow() {
    showUpdateToast('Clearing cache...');
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map(r => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
      }
    } catch (e) { /* best effort */ }
    // Cache-busted reload so the browser also bypasses HTTP cache
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now());
    window.location.replace(url.toString());
  }
  // Expose for manual invocation (e.g. footer pill, devtools)
  window.forceUpdateNow = forceUpdateNow;

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      const inVenues = window.location.pathname.includes('/venues/');
      const swPath = inVenues ? '../sw.js' : 'sw.js';
      const scope = inVenues ? '../' : './';

      // Snapshot controller state BEFORE register so we can tell apart
      // first-time install (no reload) from version bump (reload).
      const hadController = !!navigator.serviceWorker.controller;
      let reloading = false;

      const triggerReload = () => {
        if (reloading) return;
        reloading = true;
        showUpdateToast('New version - refreshing...');
        setTimeout(() => window.location.reload(), 600);
      };

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (!hadController) return; // first-time install - nothing to reload
        triggerReload();
      });

      // Explicit broadcast from the SW activate handler - covers cases where
      // controllerchange might miss (some browsers, slow claim, etc).
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e && e.data && e.data.type === 'sw-activated') {
          if (!hadController) return;
          if (e.data.version === APP_VERSION) return; // already on this version
          triggerReload();
        }
      });

      navigator.serviceWorker.register(swPath, { scope })
        .then((reg) => {
          const checkForUpdate = () => reg.update().catch(() => {});
          // Re-check whenever the tab becomes visible again
          document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') checkForUpdate();
          });
          // Long-open tabs: re-check every 30 min
          setInterval(checkForUpdate, 30 * 60 * 1000);
        })
        .catch((err) => console.warn('[sw] register failed', err));
    });
  }

  // Footer version pill - tap 3x to force a hard refresh (escape hatch
  // for the rare case where the SW lifecycle gets wedged).
  window.addEventListener('load', () => {
    const meta = document.querySelector('footer .meta');
    if (!meta || meta.querySelector('.v-pill')) return;
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'v-pill';
    pill.textContent = APP_VERSION;
    pill.title = 'Tap 3 times to force-refresh';
    pill.setAttribute('aria-label', 'App version ' + APP_VERSION + ' - tap 3 times to force refresh');
    let taps = 0, timer;
    pill.addEventListener('click', () => {
      taps++;
      clearTimeout(timer);
      pill.classList.toggle('tap-warn', taps >= 2);
      if (taps >= 3) {
        taps = 0;
        pill.classList.remove('tap-warn');
        forceUpdateNow();
      } else {
        timer = setTimeout(() => { taps = 0; pill.classList.remove('tap-warn'); }, 600);
      }
    });
    meta.appendChild(document.createTextNode(' · '));
    meta.appendChild(pill);
  });

  // ── Nav: scroll state + active page highlight + mobile menu ─────
  const topNav = document.querySelector('nav.topnav');
  if (topNav) {
    window.addEventListener('scroll', () => {
      topNav.classList.toggle('scrolled', window.scrollY > 20);
    }, { passive: true });

    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    topNav.querySelectorAll('ul a').forEach(a => {
      const href = a.getAttribute('href').split('/').pop();
      if (href === currentPage) a.classList.add('active');
    });

    // Mobile menu: inject slide-down panel (no hamburger - the bottom tab bar Menu opens it)
    const desktopUl = topNav.querySelector('ul');
    const inVenuesFolder = window.location.pathname.includes('/venues/');
    const pathPrefix = inVenuesFolder ? '../' : '';

    if (desktopUl) {
      const panel = document.createElement('div');
      panel.className = 'nav-mobile';
      panel.setAttribute('aria-hidden', 'true');
      const mobileUl = desktopUl.cloneNode(true);
      if (inVenuesFolder) {
        mobileUl.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href');
          if (href && !href.startsWith('/') && !href.startsWith('http') && !href.startsWith('../')) {
            a.setAttribute('href', '../' + href);
          }
        });
      }
      panel.appendChild(mobileUl);
      topNav.appendChild(panel);

      const setOpen = (open) => {
        topNav.classList.toggle('menu-open', open);
        panel.setAttribute('aria-hidden', open ? 'false' : 'true');
      };
      panel.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
      document.addEventListener('click', (e) => {
        if (topNav.classList.contains('menu-open') && !topNav.contains(e.target) && !e.target.closest('.tabbar-item')) {
          setOpen(false);
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && topNav.classList.contains('menu-open')) setOpen(false);
      });
      // Expose toggle so the bottom tab bar can drive it
      window._toggleMobileMenu = (force) => setOpen(force !== undefined ? force : !topNav.classList.contains('menu-open'));
    }

    // Bottom tab bar - mobile only, primary navigation
    const TABS = [
      { id: 'today', label: 'Today', href: pathPrefix + 'day.html', match: ['day.html', 'index.html'], icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>'
      },
      { id: 'days', label: 'Days', href: pathPrefix + 'itinerary.html', match: ['itinerary.html'], icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>'
      },
      { id: 'map', label: 'Map', href: pathPrefix + 'map.html', match: ['map.html'], icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-7.58 8-13a8 8 0 0 0-16 0c0 5.42 8 13 8 13Z"/><circle cx="12" cy="9" r="2.5"/></svg>'
      },
      { id: 'eat', label: 'Eat', href: pathPrefix + 'eat.html', match: ['eat.html'], icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4.5"/></svg>'
      },
      { id: 'menu', label: 'Menu', href: '#', match: [], icon:
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M4 12h16M4 17h16"/></svg>'
      }
    ];

    const currentFile = window.location.pathname.split('/').pop() || 'index.html';
    const tabbar = document.createElement('nav');
    tabbar.className = 'tabbar';
    tabbar.setAttribute('aria-label', 'Primary');
    tabbar.innerHTML = TABS.map(t => {
      const active = t.match.includes(currentFile) ? ' active' : '';
      const isMenu = t.id === 'menu';
      const tag = isMenu ? 'button' : 'a';
      const hrefAttr = isMenu ? '' : ` href="${t.href}"`;
      return `<${tag} class="tabbar-item${active}" data-tab="${t.id}"${hrefAttr}${isMenu ? ' type="button"' : ''}>
        <span class="tabbar-icon">${t.icon}</span>
        <span class="tabbar-label">${t.label}</span>
      </${tag}>`;
    }).join('');
    document.body.appendChild(tabbar);

    const menuBtn = tabbar.querySelector('[data-tab="menu"]');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (window._toggleMobileMenu) window._toggleMobileMenu();
        menuBtn.classList.toggle('active', topNav.classList.contains('menu-open'));
      });
    }
  }

  // ── Lightbox ────────────────────────────────────────────────────
  const lightbox = document.getElementById('lightbox');
  if (lightbox) {
    let currentGallery = [];
    let currentIdx = 0;
    const lbImg = document.getElementById('lbImg');
    const lbCounter = document.getElementById('lbCounter');

    document.querySelectorAll('.venue-gallery').forEach(gallery => {
      const photos = Array.from(gallery.querySelectorAll('.photo'));
      photos.forEach((photo, idx) => {
        photo.addEventListener('click', () => {
          currentGallery = photos.map(p => ({ src: p.dataset.src, caption: p.dataset.caption || '' }));
          currentIdx = idx;
          openLightbox();
        });
      });
    });

    function openLightbox() {
      const item = currentGallery[currentIdx];
      lbImg.src = item.src;
      lbImg.alt = item.caption;
      lbCounter.textContent = (currentIdx + 1) + ' of ' + currentGallery.length + (item.caption ? ' - ' + item.caption : '');
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
    function closeLightbox() {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }
    function nextImg() { currentIdx = (currentIdx + 1) % currentGallery.length; openLightbox(); }
    function prevImg() { currentIdx = (currentIdx - 1 + currentGallery.length) % currentGallery.length; openLightbox(); }

    document.getElementById('lbClose').addEventListener('click', closeLightbox);
    document.getElementById('lbNext').addEventListener('click', nextImg);
    document.getElementById('lbPrev').addEventListener('click', prevImg);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) closeLightbox(); });
    document.addEventListener('keydown', (e) => {
      if (!lightbox.classList.contains('active')) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowRight') nextImg();
      if (e.key === 'ArrowLeft') prevImg();
    });

    // Swipe-down-to-dismiss on the mobile bottom-sheet variant
    const lbSheet = lightbox.querySelector('.lb-content');
    if (lbSheet) {
      let startY = 0, deltaY = 0, dragging = false;
      lbSheet.addEventListener('touchstart', (e) => {
        if (window.innerWidth > 760) return;
        startY = e.touches[0].clientY;
        deltaY = 0;
        dragging = true;
        lbSheet.style.transition = 'none';
      }, { passive: true });
      lbSheet.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        deltaY = e.touches[0].clientY - startY;
        if (deltaY > 0) {
          lbSheet.style.transform = `translateY(${deltaY}px)`;
          lightbox.style.background = `rgba(13, 46, 74, ${Math.max(0.3, 0.95 - deltaY / 600)})`;
        }
      }, { passive: true });
      lbSheet.addEventListener('touchend', () => {
        if (!dragging) return;
        dragging = false;
        lbSheet.style.transition = '';
        lightbox.style.background = '';
        if (deltaY > 120) {
          if (window.haptic) window.haptic('pop');
          closeLightbox();
          setTimeout(() => { lbSheet.style.transform = ''; }, 320);
        } else {
          lbSheet.style.transform = '';
        }
      });
    }
  }

  // ── Pull-to-refresh (mobile, on data-heavy pages) ───────────────
  if (document.getElementById('weather-grid') || document.getElementById('bingo-board')) {
    if (window.matchMedia('(max-width: 920px)').matches && 'ontouchstart' in window) {
      const ind = document.createElement('div');
      ind.className = 'ptr-indicator';
      ind.innerHTML = '<div class="ptr-spinner"></div>';
      document.body.appendChild(ind);

      let startY = 0, pulled = 0, dragging = false, refreshing = false;
      const THRESHOLD = 70;
      const MAX_PULL = 110;

      const onStart = (e) => {
        if (refreshing || window.scrollY > 0) return;
        startY = e.touches[0].clientY;
        pulled = 0;
        dragging = true;
        ind.style.transition = 'none';
      };
      const onMove = (e) => {
        if (!dragging) return;
        if (window.scrollY > 0) { dragging = false; ind.style.transform = ''; return; }
        const delta = e.touches[0].clientY - startY;
        if (delta <= 0) { pulled = 0; ind.style.transform = ''; ind.style.opacity = ''; ind.classList.remove('ready'); return; }
        // Damped translation for natural feel
        const wasReady = ind.classList.contains('ready');
        pulled = Math.min(delta * 0.55, MAX_PULL);
        ind.style.transform = `translateX(-50%) translateY(${pulled}px)`;
        ind.style.opacity = Math.min(pulled / 40, 1);
        const ready = pulled >= THRESHOLD;
        ind.classList.toggle('ready', ready);
        if (ready && !wasReady && window.haptic) window.haptic('heavy');
      };
      const onEnd = () => {
        if (!dragging) return;
        dragging = false;
        ind.style.transition = '';
        if (pulled >= THRESHOLD) {
          refreshing = true;
          ind.classList.add('refreshing');
          ind.classList.remove('ready');
          ind.style.transform = `translateX(-50%) translateY(${THRESHOLD}px)`;
          // Use view transition if available for a smoother reload feel
          if (document.startViewTransition) {
            setTimeout(() => location.reload(), 250);
          } else {
            setTimeout(() => location.reload(), 250);
          }
        } else {
          ind.style.transform = '';
          ind.style.opacity = '';
        }
      };

      document.addEventListener('touchstart', onStart, { passive: true });
      document.addEventListener('touchmove', onMove, { passive: true });
      document.addEventListener('touchend', onEnd);
      document.addEventListener('touchcancel', onEnd);
    }
  }

  // ── Accordion (day dropdowns) ───────────────────────────────────
  document.querySelectorAll('.day-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      btn.closest('.day').classList.toggle('collapsed');
    });
  });

  // Auto-open the day matching today's date; all others stay collapsed
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll('.day[data-date]').forEach(day => {
    if (day.dataset.date === today) {
      day.classList.remove('collapsed');
    }
  });

  // Inject "Share this day" / "Open as standalone view" footer into each day card.
  // Uses Web Share API on mobile, falls back to clipboard.
  const DAY_ALIAS = {
    '2026-05-21': 'thu', '2026-05-22': 'fri', '2026-05-23': 'sat', '2026-05-24': 'sun'
  };
  function dayToast(msg) {
    let el = document.getElementById('toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'toast';
      el.className = 'toast';
      el.setAttribute('role', 'status');
      el.setAttribute('aria-live', 'polite');
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2200);
  }
  document.querySelectorAll('.day[data-date]').forEach(day => {
    const inner = day.querySelector('.day-body-inner');
    if (!inner || inner.querySelector('.day-card-actions')) return;
    const date = day.dataset.date;
    const alias = DAY_ALIAS[date] || date;
    const title = day.querySelector('.day-title')?.textContent.trim() || 'Day';
    const dateLabel = day.querySelector('.day-date')?.textContent.trim() || '';
    const standalone = `day.html?d=${alias}`;
    const wrap = document.createElement('div');
    wrap.className = 'day-card-actions';
    wrap.innerHTML = `
      <a class="day-card-link" href="${standalone}">Open as single-day view &rarr;</a>
      <button class="day-card-share" type="button" aria-label="Share this day">
        <span class="dcs-icon">&#10150;</span><span>Share</span>
      </button>
    `;
    inner.appendChild(wrap);
    wrap.querySelector('.day-card-share').addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      const url = window.location.origin + window.location.pathname.replace(/[^/]*$/, '') + standalone;
      const shareData = {
        title: `Algarve - ${dateLabel}`,
        text: `${title} (${dateLabel})`,
        url
      };
      if (navigator.share) {
        try { await navigator.share(shareData); } catch (_) { /* cancelled */ }
      } else {
        try {
          await navigator.clipboard.writeText(url);
          dayToast('Link copied');
        } catch (_) {
          prompt('Copy this link:', url);
        }
      }
    });
  });

  // ── Translator ──────────────────────────────────────────────────
  const srcText = document.getElementById('srcText');
  if (srcText) {
    let srcLang = 'en', dstLang = 'pt';
    const dstText = document.getElementById('dstText');
    const srcLabel = document.getElementById('srcLabel');
    const dstLabel = document.getElementById('dstLabel');
    const dirFrom = document.getElementById('dirFrom');
    const dirTo = document.getElementById('dirTo');

    const langName = (c) => c === 'en' ? 'English' : 'Português';

    function updateLabels() {
      srcLabel.textContent = langName(srcLang);
      dstLabel.textContent = langName(dstLang);
      dirFrom.textContent = langName(srcLang);
      dirTo.textContent = langName(dstLang);
      srcText.placeholder = srcLang === 'en' ? "Type your phrase here..." : "Escreva a sua frase aqui...";
    }

    document.getElementById('swapBtn').addEventListener('click', () => {
      [srcLang, dstLang] = [dstLang, srcLang];
      updateLabels();
      const oldSrc = srcText.value;
      const oldDst = dstText.classList.contains('empty') ? '' : dstText.textContent;
      srcText.value = oldDst;
      if (oldSrc) { dstText.textContent = oldSrc; dstText.classList.remove('empty'); }
      else { dstText.textContent = "Your translation will appear here."; dstText.classList.add('empty'); }
    });

    async function translate() {
      const text = srcText.value.trim();
      if (!text) { dstText.textContent = "Type something first."; dstText.classList.add('empty'); return; }
      dstText.classList.remove('empty');
      dstText.textContent = "Translating...";
      try {
        const url = 'https://translate.googleapis.com/translate_a/single?client=gtx&sl=' + srcLang + '&tl=' + dstLang + '&dt=t&q=' + encodeURIComponent(text);
        const response = await fetch(url);
        const data = await response.json();
        const translated = data[0].map(seg => seg[0]).join('');
        dstText.textContent = translated;
      } catch (err) {
        dstText.textContent = "Inline translate failed. Tap 'Open in Google Translate'.";
        dstText.classList.add('empty');
      }
    }

    document.getElementById('translateBtn').addEventListener('click', translate);
    srcText.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); translate(); }
    });
    document.getElementById('openGoogle').addEventListener('click', () => {
      const text = srcText.value.trim();
      const url = text
        ? 'https://translate.google.com/?sl=' + srcLang + '&tl=' + dstLang + '&text=' + encodeURIComponent(text) + '&op=translate'
        : 'https://translate.google.com/?sl=' + srcLang + '&tl=' + dstLang + '&op=translate';
      window.open(url, '_blank');
    });
    document.getElementById('speakBtn').addEventListener('click', () => {
      const text = dstText.classList.contains('empty') ? '' : dstText.textContent;
      if (!text || !('speechSynthesis' in window)) return;
      const utter = new SpeechSynthesisUtterance(text);
      utter.lang = dstLang === 'pt' ? 'pt-PT' : 'en-GB';
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utter);
    });
    document.getElementById('clearBtn').addEventListener('click', () => {
      srcText.value = '';
      dstText.textContent = "Your translation will appear here.";
      dstText.classList.add('empty');
    });

    updateLabels();
  }

  // ── Weather forecast ────────────────────────────────────────────
  const weatherGrid = document.getElementById('weather-grid');
  if (weatherGrid) {
    const LAT = 37.07, LON = -8.10;
    const LOCATION_KEY = '273215'; // Quarteira, Portugal
    const ACC_KEY = (typeof CONFIG !== 'undefined' && CONFIG.ACCUWEATHER_KEY) || '';
    const TRIP = new Set(['2026-05-21', '2026-05-22', '2026-05-23', '2026-05-24']);

    function accuFetch(path) {
      return fetch('https://dataservice.accuweather.com' + path, {
        headers: { 'Authorization': 'Bearer ' + ACC_KEY }
      }).then(r => {
        if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + path);
        return r.json();
      });
    }

    // AccuWeather icon code (1-44) to emoji + short description
    function accuIcon(code) {
      if (code === 1 || code === 2)                            return ['☀️', 'Sunny'];
      if (code === 3 || code === 4 || code === 5)              return ['🌤️', 'Partly sunny'];
      if (code === 6 || code === 7 || code === 8)              return ['☁️', 'Cloudy'];
      if (code === 11)                                         return ['🌫️', 'Fog'];
      if (code === 12 || code === 13 || code === 14)           return ['🌦️', 'Showers'];
      if (code === 15 || code === 16 || code === 17)           return ['⛈️', 'Storms'];
      if (code === 18 || code === 26)                          return ['🌧️', 'Rain'];
      if (code === 19 || code === 20 || code === 21 || code === 22 || code === 23) return ['❄️', 'Snow'];
      if (code === 24 || code === 25 || code === 29)           return ['🌨️', 'Sleet'];
      if (code === 30)                                         return ['🥵', 'Hot'];
      if (code === 31)                                         return ['🥶', 'Cold'];
      if (code === 32)                                         return ['💨', 'Windy'];
      if (code === 33 || code === 34)                          return ['🌙', 'Clear'];
      if (code === 35 || code === 36 || code === 37 || code === 38) return ['☁️', 'Cloudy'];
      if (code === 39 || code === 40)                          return ['🌧️', 'Showers'];
      if (code === 41 || code === 42)                          return ['⛈️', 'Storms'];
      if (code === 43 || code === 44)                          return ['❄️', 'Snow'];
      return ['🌤️', '-'];
    }

    function fmtDay(dateStr) {
      const d = new Date(dateStr.slice(0, 10) + 'T12:00:00');
      return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    function kmhToMph(v) { return Math.round((v || 0) * 0.621371); }

    function renderRainWidget(minuteData) {
      const widget = document.createElement('div');
      widget.style.cssText = 'margin-bottom: 40px; padding: 20px; background: var(--bg); border-radius: 8px; border-left: 4px solid var(--bougainvillea);';

      const phrase = (minuteData.Summary && minuteData.Summary.Phrase) || 'No rain data';
      const intervals = (minuteData.Intervals || []).filter(i => i.Minute < 60);
      const hasRain = intervals.some(i => (i.Dbz || 0) > 0);

      if (!hasRain) {
        widget.innerHTML = '<strong>Next 60 minutes:</strong> ' + phrase + ' &#9728;&#65039;';
      } else {
        let bars = '';
        intervals.forEach(i => {
          const intensity = Math.max(0.15, Math.min((i.Dbz || 0) / 40, 1));
          const t = new Date(i.StartDateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
          bars += '<div style="flex:1; height:40px; background:var(--bougainvillea); margin-right:2px; opacity:' + intensity.toFixed(2) + '; border-radius:2px;" title="' + t + ': ' + (i.ShortPhrase || 'Rain') + '"></div>';
        });
        widget.innerHTML = '<strong>Next 60 minutes:</strong> ' + phrase + '<div style="display:flex; gap:0; margin-top:12px; height:40px;">' + bars + '</div>';
      }

      return widget;
    }

    function renderTodaySummary(d) {
      const summary = document.createElement('div');
      summary.style.cssText = 'margin-bottom: 40px; padding: 20px; background: var(--bg); border-radius: 8px; border-left: 4px solid var(--atlantic);';

      const temp = d.Temperature || {};
      const day = d.Day || {};
      const wind = (day.Wind && day.Wind.Speed) || {};
      const uv = (day.UVIndexFloat || {});

      const high = Math.round(temp.Maximum && temp.Maximum.Value);
      const low = Math.round(temp.Minimum && temp.Minimum.Value);
      const condition = day.IconPhrase || 'No data';
      const rain = (day.PrecipitationProbability || 0) + '%';
      const cloud = (day.CloudCover || '-');
      const uvMax = uv.Maximum ? Math.round(uv.Maximum) : '-';
      const humidity = (day.RelativeHumidity && day.RelativeHumidity.Average) ? Math.round(day.RelativeHumidity.Average) : '-';
      const windSpeed = wind.Value ? kmhToMph(wind.Value) : '-';
      const windDir = (wind.Direction && wind.Direction.Localized) || 'variable';

      const text = 'Today will be ' + condition.toLowerCase() + ' with a high of ' + high + '°C and low of ' + low + '°C. '
        + 'Cloud cover ' + cloud + '%, chance of rain ' + rain + '. '
        + 'UV index peaks at ' + uvMax + ', humidity ' + humidity + '%. '
        + 'Winds from ' + windDir + ' at ' + windSpeed + ' mph.';

      summary.innerHTML = '<strong>Today:</strong> ' + text;
      return summary;
    }

    function renderForecast(minuteData, hourlyData, dailyData) {
      document.getElementById('weather-loading').style.display = 'none';
      weatherGrid.style.display = '';

      weatherGrid.appendChild(renderRainWidget(minuteData));

      // Index hourly entries by date
      const byDate = {};
      hourlyData.forEach(h => {
        const date = h.DateTime.slice(0, 10);
        const hour = parseInt(h.DateTime.slice(11, 13));
        if (!byDate[date]) byDate[date] = [];
        byDate[date].push({
          hour,
          temp: h.Temperature.Value,
          iconCode: h.WeatherIcon,
          rain: h.PrecipitationProbability,
          wind: kmhToMph(h.Wind && h.Wind.Speed && h.Wind.Speed.Value)
        });
      });

      const list = document.createElement('div');
      list.className = 'weather-list';

      const todayIso = new Date().toISOString().slice(0, 10);
      const todayForecast = dailyData.DailyForecasts.find(d => d.Date.slice(0, 10) === todayIso);
      if (todayForecast) {
        list.appendChild(renderTodaySummary(todayForecast));
      }

      dailyData.DailyForecasts.forEach(d => {
        const date = d.Date.slice(0, 10);
        const isTrip = TRIP.has(date);
        const isToday = date === todayIso;
        const [icon, desc] = accuIcon(d.Day.Icon);
        const rainPct = d.Day.PrecipitationProbability || 0;
        const rainMm = (d.Day.Rain && d.Day.Rain.Value) || 0;
        const rainLabel = rainPct > 0
          ? rainPct + '% (' + rainMm.toFixed(1) + 'mm)'
          : 'Dry';
        const windMph = kmhToMph(d.Day.Wind && d.Day.Wind.Speed && d.Day.Wind.Speed.Value);
        const windLabel = windMph + ' mph max';

        const row = document.createElement('div');
        row.className = 'weather-day-row' + (isTrip ? ' trip-day' : '') + (isToday ? ' open' : '');

        const summary = document.createElement('div');
        summary.className = 'weather-day-summary';
        summary.innerHTML =
          '<span class="weather-summary-name">' + fmtDay(date) + (isTrip ? ' &#9733;' : '') + '</span>'
          + '<span class="weather-summary-icon">' + icon + '</span>'
          + '<span class="weather-summary-temps">' + Math.round(d.Temperature.Maximum.Value) + '&deg;'
          + '<span class="lo"> / ' + Math.round(d.Temperature.Minimum.Value) + '&deg;</span></span>'
          + '<span class="weather-summary-desc">' + desc + '</span>'
          + '<span class="weather-summary-rain">' + rainLabel + '</span>'
          + '<span class="weather-summary-wind">' + windLabel + '</span>'
          + '<span class="weather-chevron">&#8964;</span>';

        const hourlyWrap = document.createElement('div');
        hourlyWrap.className = 'weather-hourly';
        const hourlyInner = document.createElement('div');
        hourlyInner.className = 'weather-hourly-inner';
        const table = document.createElement('div');
        table.className = 'weather-hourly-table';

        const hours = (byDate[date] || []).filter(e => e.hour >= 6);

        if (hours.length === 0) {
          const note = document.createElement('div');
          note.className = 'weather-hour-row';
          note.style.opacity = '0.7';
          note.innerHTML = '<span>Hourly detail available up to ' + fmtDay(hourlyData[hourlyData.length - 1].DateTime) + '. See daily summary above.</span>';
          table.appendChild(note);
        } else {
          hours.forEach(e => {
            const [hIcon] = accuIcon(e.iconCode);
            const hRow = document.createElement('div');
            hRow.className = 'weather-hour-row';
            hRow.innerHTML =
              '<span class="weather-hour-time">' + String(e.hour).padStart(2, '0') + ':00</span>'
              + '<span class="weather-hour-icon">' + hIcon + '</span>'
              + '<span class="weather-hour-temp">' + Math.round(e.temp) + '&deg;</span>'
              + '<span class="weather-hour-rain">' + (e.rain != null ? e.rain + '% rain chance' : 'No data') + '</span>'
              + '<span class="weather-hour-wind">' + e.wind + ' mph</span>';
            table.appendChild(hRow);
          });
        }

        hourlyInner.appendChild(table);
        hourlyWrap.appendChild(hourlyInner);
        row.appendChild(summary);
        row.appendChild(hourlyWrap);
        row.addEventListener('click', () => row.classList.toggle('open'));
        list.appendChild(row);
      });

      const src = document.createElement('p');
      src.className = 'weather-source';
      src.textContent = 'AccuWeather forecast for Quarteira (MinuteCast, 5-day hourly, 15-day daily) · wind in mph';
      list.appendChild(src);
      weatherGrid.appendChild(list);
    }

    Promise.all([
      accuFetch('/forecasts/v1/minute?q=' + LAT + ',' + LON + '&details=true'),
      accuFetch('/forecasts/v1/hourly/120hour/' + LOCATION_KEY + '?metric=true&details=true'),
      accuFetch('/forecasts/v1/daily/15day/' + LOCATION_KEY + '?metric=true&details=true')
    ]).then(([minute, hourly, daily]) => {
      renderForecast(minute, hourly, daily);
    }).catch(err => {
      console.error('Weather load failed:', err);
      document.getElementById('weather-loading').style.display = 'none';
      document.getElementById('weather-error').style.display = 'block';
    });
  }

  // ── Bingo ───────────────────────────────────────────────────────
  const bingoBoard = document.getElementById('bingo-board');
  if (bingoBoard) {
    const CARDS = {
      realistic: [
        'Someone gets sunburned',
        'Pastel de nata consumed',
        '"Just one more drink" x3',
        'Wrong thing ordered by mistake',
        'Spills a drink',
        '20+ min debate on where to eat',
        'Photo worthy of a postcard',
        '"I\'m not hungry" then eats loads',
        'Gets lost finding a venue',
        'Spots a stray cat',
        'Forgets to apply sunscreen',
        'Ends up somewhere unplanned',
        'The Algarve!',
        'Attempts Portuguese',
        'Catches a sunset or sunrise',
        'Orders something, no idea what it is',
        'Live music we didn\'t plan for',
        'Refuses to leave when it\'s time',
        'Wears the same shirt two days running',
        'Hangover writes off a morning',
        'Sunglasses lost or sat on',
        'Photo of the food before eating it',
        'Asks a local for directions',
        'Buy something we\'d never buy at home',
        'Pre-drinks at the apartment'
      ],
      funny: [
        'Stranger buys us a round',
        'Karaoke happens, by us',
        'Locals invite us to their table',
        'Bird steals food off a plate',
        'Bump into someone from home',
        'Sunrise after staying up (not waking up)',
        'Dolphins spotted',
        'Convince a stranger we\'re famous',
        'Free shot from a bartender',
        'Sea warmer than expected',
        'Bartender remembers our order',
        'Gets hit on at the bar',
        'The Algarve!',
        'Octopus eaten, tentacles and all',
        'Make actual friends with locals',
        'Matching outfits (unplanned)',
        'Spontaneous boat ride',
        'End up in a wedding/parade/festival',
        'Learn a new skill before lunch',
        'Drink something we\'ve never had before',
        'Find a beach with no one else on it',
        'Photo with a stranger, nailed it',
        'Order the entire left side of the menu',
        'A meal that makes the table go quiet',
        'Recommendation from a stranger pays off'
      ]
    };
    const FREE = 12;
    const LS_KEY = 'algarve-bingo-v2';
    const ACTIVE_MS = 1000;
    const IDLE_MS = 15000;
    const ACTIVE_WINDOW_MS = 30000;
    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const SYNC_ENABLED = !!(cfg.JSONBIN_KEY && cfg.JSONBIN_BIN_ID);
    const READ_URL = SYNC_ENABLED ? `https://api.jsonbin.io/v3/b/${cfg.JSONBIN_BIN_ID}/latest` : null;
    const WRITE_URL = SYNC_ENABLED ? `https://api.jsonbin.io/v3/b/${cfg.JSONBIN_BIN_ID}` : null;
    const SYNC_HEADERS = SYNC_ENABLED ? { 'X-Access-Key': cfg.JSONBIN_KEY } : null;

    let active = 'realistic';
    function emptyState() {
      return {
        realistic: Array(25).fill(false),
        funny: Array(25).fill(false),
        ts: {
          realistic: Array(25).fill(0),
          funny: Array(25).fill(0)
        }
      };
    }
    let state = emptyState();
    state.realistic[FREE] = true;
    state.funny[FREE] = true;

    const syncEl = document.getElementById('bingo-sync');
    const banner = document.getElementById('bingo-win-banner');
    const resetBtn = document.getElementById('bingo-reset');
    const refreshBtn = document.getElementById('bingo-refresh');
    const tabs = document.querySelectorAll('.bingo-tab');

    function setSync(text, cls) {
      if (!syncEl) return;
      syncEl.textContent = text;
      syncEl.classList.remove('ok', 'error');
      if (cls) syncEl.classList.add(cls);
    }

    function loadLocal() {
      try {
        const saved = JSON.parse(localStorage.getItem(LS_KEY));
        const norm = normalise(saved);
        if (norm) state = norm;
      } catch (e) {}
      state.realistic[FREE] = true;
      state.funny[FREE] = true;
    }

    function saveLocal() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function normalise(remote) {
      if (!remote || typeof remote !== 'object') return null;
      const out = emptyState();
      ['realistic', 'funny'].forEach(card => {
        if (Array.isArray(remote[card]) && remote[card].length === 25) {
          out[card] = remote[card].map(Boolean);
        }
        if (remote.ts && Array.isArray(remote.ts[card]) && remote.ts[card].length === 25) {
          out.ts[card] = remote.ts[card].map(n => Number(n) || 0);
        }
      });
      out.realistic[FREE] = true;
      out.funny[FREE] = true;
      return out;
    }

    function merge(local, remote) {
      const out = emptyState();
      ['realistic', 'funny'].forEach(card => {
        for (let i = 0; i < 25; i++) {
          if (remote.ts[card][i] > local.ts[card][i]) {
            out[card][i] = remote[card][i];
            out.ts[card][i] = remote.ts[card][i];
          } else {
            out[card][i] = local[card][i];
            out.ts[card][i] = local.ts[card][i];
          }
        }
      });
      out.realistic[FREE] = true;
      out.funny[FREE] = true;
      return out;
    }

    let lastActivity = 0;
    function bump() { lastActivity = Date.now(); }

    async function fetchRemote() {
      const r = await fetch(READ_URL, { cache: 'no-store', headers: SYNC_HEADERS });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const body = await r.json();
      return normalise(body && body.record);
    }

    async function pullState() {
      if (!SYNC_ENABLED) { setSync('This device only', 'error'); return; }
      try {
        const remote = await fetchRemote();
        if (remote) {
          const before = JSON.stringify(state);
          state = merge(state, remote);
          saveLocal();
          render();
          if (JSON.stringify(state) !== before) bump();
          setSync('Synced', 'ok');
        }
      } catch (e) {
        setSync('Offline - this device only', 'error');
      }
    }

    let pushTimer = null;
    let pushing = false;
    function pushState() {
      if (!SYNC_ENABLED) return;
      clearTimeout(pushTimer);
      setSync('Saving...');
      pushTimer = setTimeout(async () => {
        if (pushing) { pushTimer = setTimeout(pushState, 200); return; }
        pushing = true;
        try {
          try {
            const remote = await fetchRemote();
            if (remote) {
              state = merge(state, remote);
              saveLocal();
              render();
            }
          } catch (e) {}
          const r = await fetch(WRITE_URL, {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, SYNC_HEADERS),
            body: JSON.stringify(state)
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          setSync('Synced', 'ok');
        } catch (e) {
          setSync('Offline - this device only', 'error');
        } finally {
          pushing = false;
        }
      }, 250);
    }

    function winLines(s) {
      const lines = [];
      for (let r = 0; r < 5; r++) {
        const row = [r*5, r*5+1, r*5+2, r*5+3, r*5+4];
        if (row.every(i => s[i])) lines.push(row);
      }
      for (let c = 0; c < 5; c++) {
        const col = [c, c+5, c+10, c+15, c+20];
        if (col.every(i => s[i])) lines.push(col);
      }
      if ([0,6,12,18,24].every(i => s[i])) lines.push([0,6,12,18,24]);
      if ([4,8,12,16,20].every(i => s[i])) lines.push([4,8,12,16,20]);
      return lines;
    }

    function buildBoard() {
      bingoBoard.innerHTML = '';
      CARDS[active].forEach((text, i) => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell' + (i === FREE ? ' free' : '');
        cell.textContent = text;
        if (i !== FREE) {
          cell.addEventListener('click', () => {
            state[active][i] = !state[active][i];
            state.ts[active][i] = Date.now();
            saveLocal();
            render();
            bump();
            pushState();
          });
        }
        bingoBoard.appendChild(cell);
      });
    }

    function render() {
      const s = state[active];
      const winning = new Set(winLines(s).flat());
      bingoBoard.querySelectorAll('.bingo-cell').forEach((cell, i) => {
        cell.classList.toggle('marked', s[i] && i !== FREE);
        cell.classList.toggle('winning', winning.has(i));
      });
      if (banner) banner.classList.toggle('visible', winning.size > 0);
    }

    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const card = tab.dataset.card;
        if (card === active) return;
        active = card;
        tabs.forEach(t => t.classList.toggle('active', t.dataset.card === active));
        buildBoard();
        render();
      });
    });

    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        setSync('Syncing...');
        bump();
        pullState();
      });
    }

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        const now = Date.now();
        for (let i = 0; i < 25; i++) {
          state[active][i] = false;
          state.ts[active][i] = now;
        }
        state[active][FREE] = true;
        saveLocal();
        render();
        bump();
        pushState();
      });
    }

    loadLocal();
    buildBoard();
    render();
    bump();
    pullState();

    let pollTimer = null;
    function schedulePoll() {
      clearTimeout(pollTimer);
      const interval = (Date.now() - lastActivity < ACTIVE_WINDOW_MS) ? ACTIVE_MS : IDLE_MS;
      pollTimer = setTimeout(async () => {
        if (document.visibilityState === 'visible' && !pushing) await pullState();
        schedulePoll();
      }, interval);
    }
    schedulePoll();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        bump();
        pullState();
        schedulePoll();
      }
    });
  }

  // Homepage: phase-adaptive hero, countdown, next moment
  const heroImg = document.querySelector('.hero-img');
  if (heroImg) {
    const PHASES = {
      pretrip: { img: 'img/hero/pretrip.jpg', credit: 'Praia da Marinha - Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File:Praia_da_Marinha_-_panoramio.jpg' },
      thu:     { img: 'img/hero/thu.jpg',     credit: 'Quarteira beach - Wikimedia Commons',   creditUrl: 'https://commons.wikimedia.org/wiki/File:Marginal_Este_Quarteira_-_panoramio.jpg' },
      fri:     { img: 'img/hero/fri.jpg',     credit: 'Alvor sunset - Wikimedia Commons',       creditUrl: 'https://commons.wikimedia.org/wiki/File:Portugal_-_Algarve_-_Alvor_-_sunset_-_one_person_on_the_beach_(25732360902).jpg' },
      sat:     { img: 'img/hero/sat.jpg',     credit: 'Vilamoura marina - Wikimedia Commons',    creditUrl: 'https://commons.wikimedia.org/wiki/File:Vilamoura_09_(36679853404).jpg' },
      sun:     { img: 'img/hero/sun.jpg',     credit: 'Falesia cliffs - Wikimedia Commons',      creditUrl: 'https://commons.wikimedia.org/wiki/File:Fal%C3%A9sia_-_cliffs_(13389084795).jpg' },
      post:    { img: 'img/hero/post.jpg',    credit: 'Algarve sunset - Wikimedia Commons',      creditUrl: 'https://commons.wikimedia.org/wiki/File:Portugal_-_Algarve_-_Alvor_-_sunset_-_one_person_on_the_beach_(25732360902).jpg' }
    };

    function dt(y, m, d, hh, mm) { return new Date(y, m - 1, d, hh, mm, 0); }
    const MILESTONES = [
      // Thursday 21 May - Day 1
      { t: dt(2026, 5, 21,  6, 30), label: 'Sahil takes off from Bristol' },
      { t: dt(2026, 5, 21,  9, 10), label: 'Sahil lands at Faro' },
      { t: dt(2026, 5, 21, 10,  0), label: 'Faro to Quarteira (bus or Uber)' },
      { t: dt(2026, 5, 21, 11,  0), label: 'Bag drop, light breakfast at a beach cafe' },
      { t: dt(2026, 5, 21, 11, 30), label: 'Sahil walks the Quarteira promenade' },
      { t: dt(2026, 5, 21, 13,  0), label: "Monty's work wraps, lunch at Sailor's Corner" },
      { t: dt(2026, 5, 21, 14, 30), label: 'Slow afternoon on Quarteira beach' },
      { t: dt(2026, 5, 21, 15,  0), label: 'Check in to SunnyQuarters' },
      { t: dt(2026, 5, 21, 16, 30), label: 'Pingo Doce supermarket run' },
      { t: dt(2026, 5, 21, 18, 30), label: 'Sunset stroll along the promenade' },
      { t: dt(2026, 5, 21, 20,  0), label: 'Dinner at Tico Tico' },
      { t: dt(2026, 5, 21, 22,  0), label: 'Sagres on the balcony' },
      // Friday 22 May - Day 2
      { t: dt(2026, 5, 22,  9, 30), label: 'Breakfast at home - natas and coffee' },
      { t: dt(2026, 5, 22, 10, 30), label: 'Walk to Vilamoura marina' },
      { t: dt(2026, 5, 22, 11,  0), label: 'Cerro da Vila Roman ruins (Friday-only)' },
      { t: dt(2026, 5, 22, 13,  0), label: "Lunch at the marina (Snack-bar Monteiro's)" },
      { t: dt(2026, 5, 22, 14, 30), label: 'Beach, pool, or balcony' },
      { t: dt(2026, 5, 22, 16, 30), label: 'Reset at the apartment' },
      { t: dt(2026, 5, 22, 18,  0), label: 'Calm evening tasting (port or wine)' },
      { t: dt(2026, 5, 22, 20, 30), label: 'Dinner at Casa do Pescador or Akvavit' },
      { t: dt(2026, 5, 22, 23,  0), label: 'Walk home, terrace nightcap' },
      // Saturday 23 May - Day 3
      { t: dt(2026, 5, 23,  8, 30), label: 'Apartment breakfast' },
      { t: dt(2026, 5, 23,  9, 15), label: 'Walk to Quarteira bus station' },
      { t: dt(2026, 5, 23,  9, 30), label: 'Vamus Bus 9 to Loule' },
      { t: dt(2026, 5, 23, 10,  0), label: 'Mercado Municipal de Loule' },
      { t: dt(2026, 5, 23, 11, 30), label: 'Loule Castle and Archaeological Museum' },
      { t: dt(2026, 5, 23, 12, 30), label: 'Petiscos lunch at the market stalls' },
      { t: dt(2026, 5, 23, 14, 30), label: 'Bus 9 back to Quarteira' },
      { t: dt(2026, 5, 23, 15, 30), label: 'Beach, balcony, or proper afternoon nap' },
      { t: dt(2026, 5, 23, 18,  0), label: 'Sunset boat party (wildcard option)' },
      { t: dt(2026, 5, 23, 19, 30), label: 'Dinner at Salmora Live Kitchen' },
      { t: dt(2026, 5, 23, 21, 30), label: 'Atlantic Bar - the reliable opener' },
      { t: dt(2026, 5, 23, 22, 30), label: "Marina bar-hop (O'Neills, Cats, MoTAO)" },
      // Sunday 24 May - Day 4
      { t: dt(2026, 5, 24,  0, 30), label: 'Kadoc Disco escalation (if up for it)' },
      { t: dt(2026, 5, 24,  8, 30), label: 'Apartment breakfast, pack' },
      { t: dt(2026, 5, 24, 10,  0), label: 'Check out, store bags' },
      { t: dt(2026, 5, 24, 10, 30), label: 'Quarteira fish market stroll' },
      { t: dt(2026, 5, 24, 12,  0), label: "Lunch at Sailor's Corner" },
      { t: dt(2026, 5, 24, 14,  0), label: 'Pick up bags, terrace coffee' },
      { t: dt(2026, 5, 24, 15,  0), label: 'Uber to Faro Airport together' },
      { t: dt(2026, 5, 24, 15, 45), label: 'Dinner together inside FAO landside' },
      { t: dt(2026, 5, 24, 17,  0), label: 'Monty through security' },
      { t: dt(2026, 5, 24, 18,  0), label: 'Sahil through security' },
      { t: dt(2026, 5, 24, 18, 55), label: "Monty's flight home (BA2663 to LGW)" },
      { t: dt(2026, 5, 24, 20,  5), label: "Sahil's flight home (U2 8538 to LGW)" }
    ];

    function phaseFor(now) {
      const y = now.getFullYear(), m = now.getMonth(), d = now.getDate();
      if (y < 2026 || (y === 2026 && m < 4)) return 'pretrip';
      if (y === 2026 && m === 4) {
        if (d < 21) return 'pretrip';
        if (d === 21) return 'thu';
        if (d === 22) return 'fri';
        if (d === 23) return 'sat';
        if (d === 24) return 'sun';
      }
      return 'post';
    }

    function eyebrowFor(phase) {
      switch (phase) {
        case 'pretrip': return 'Monty &amp; Sahil &middot; 21&ndash;24 May 2026';
        case 'thu': return 'Day 1 &middot; Quarteira arrival';
        case 'fri': return 'Day 2 &middot; the calm one';
        case 'sat': return 'Day 3 &middot; the big one';
        case 'sun': return 'Day 4 &middot; home today';
        case 'post': return 'May 2026 &middot; that was the trip';
      }
      return '';
    }

    function applyPhase(phase) {
      const p = PHASES[phase] || PHASES.pretrip;
      const bg = document.getElementById('heroBg');
      if (bg) bg.style.backgroundImage = 'url(' + p.img + ')';
      heroImg.dataset.phase = phase;
      const eye = document.getElementById('heroEyebrowText');
      if (eye) eye.innerHTML = eyebrowFor(phase);
    }

    function nextMilestone(now) {
      return MILESTONES.find(m => m.t.getTime() > now.getTime()) || null;
    }

    function pad(n) { return n < 10 ? '0' + n : '' + n; }

    function formatTarget(m) {
      const days = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
      const dn = days[m.t.getDay()];
      return dn + ' ' + m.t.getDate() + ' May &middot; ' + pad(m.t.getHours()) + ':' + pad(m.t.getMinutes()) + ' &middot; ' + m.label;
    }

    function updateCountdown(now, phase) {
      const cd = document.getElementById('countdown');
      const caption = document.getElementById('cdCaption');
      const nDays = document.getElementById('cdDays');
      const nHrs = document.getElementById('cdHours');
      const nMins = document.getElementById('cdMins');
      if (!cd) return;

      if (phase === 'post') {
        cd.classList.add('post');
        return;
      }
      cd.classList.toggle('during', phase !== 'pretrip');

      const m = nextMilestone(now);
      const target = m ? m.t : MILESTONES[MILESTONES.length - 1].t;
      const ms = target.getTime() - now.getTime();
      const total = Math.max(0, ms);
      const d = Math.floor(total / 86400000);
      const h = Math.floor((total % 86400000) / 3600000);
      const mi = Math.floor((total % 3600000) / 60000);
      if (nDays) nDays.textContent = d;
      if (nHrs) nHrs.textContent = h;
      if (nMins) nMins.textContent = mi;

      if (caption) caption.innerHTML = m ? 'until ' + m.label.toLowerCase() : 'home soon';
    }

    function updateNextMoment(now, phase) {
      const link = document.getElementById('nextMoment');
      const txt = document.getElementById('nextMomentText');
      if (!link || !txt) return;

      if (phase === 'post') {
        link.style.display = 'none';
        return;
      }
      link.style.display = '';
      const m = nextMilestone(now);
      if (!m) {
        link.style.display = 'none';
        return;
      }
      txt.innerHTML = formatTarget(m);
    }

    function tick() {
      const now = new Date();
      const phase = phaseFor(now);
      applyPhase(phase);
      updateCountdown(now, phase);
      updateNextMoment(now, phase);
    }

    tick();
    setInterval(tick, 30000);
  }

  // ── Packing list ────────────────────────────────────────────────
  const packContent = document.getElementById('pack-content');
  if (packContent) {
    const PACK_LS_KEY = 'algarve-packing-v1';
    const PACK_ACTIVE_MS = 1000;
    const PACK_IDLE_MS = 15000;
    const PACK_ACTIVE_WINDOW_MS = 30000;
    const pCfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const PACK_BIN_ID = pCfg.JSONBIN_PACKING_BIN_ID;
    const PACK_SYNC_ENABLED = !!(pCfg.JSONBIN_PACKING_KEY && PACK_BIN_ID);
    const PACK_READ_URL = PACK_SYNC_ENABLED ? `https://api.jsonbin.io/v3/b/${PACK_BIN_ID}/latest` : null;
    const PACK_WRITE_URL = PACK_SYNC_ENABLED ? `https://api.jsonbin.io/v3/b/${PACK_BIN_ID}` : null;
    const PACK_HEADERS = PACK_SYNC_ENABLED ? { 'X-Access-Key': pCfg.JSONBIN_PACKING_KEY } : null;

    // Category structure - same for both people
    const CATS = [
      { key: 'clothes', name: 'Clothes' },
      { key: 'toiletries', name: 'Toiletries' },
      { key: 'tech', name: 'Tech' },
      { key: 'documents', name: 'Documents' },
      { key: 'beach', name: 'Beach kit' },
      { key: 'goingout', name: 'Going-out' },
      { key: 'misc', name: 'Misc' }
    ];

    // Default seed items. Each: [text, category]. IDs are deterministic so
    // two devices seeding the same defaults do not create duplicate rows.
    // Monty has 5 nights (Tue-Sat), Sahil 3 nights (Thu-Sat).
    const SEED_MONTY = [
      ['6x t-shirts (5 nights + spare)', 'clothes'],
      ['1x linen shirt (Fri/Sat dinner)', 'clothes'],
      ['2x swim shorts', 'clothes'],
      ['1x smart shorts', 'clothes'],
      ['2x casual shorts', 'clothes'],
      ['1x chinos / light trousers', 'clothes'],
      ['7x underwear', 'clothes'],
      ['5x socks', 'clothes'],
      ['1x light jumper (cool evenings)', 'clothes'],
      ['1x light rain jacket', 'clothes'],
      ['Pyjamas / sleep shorts', 'clothes'],
      ['Trainers', 'clothes'],
      ['Flip-flops / slides', 'clothes'],
      ['Toothbrush + toothpaste', 'toiletries'],
      ['Deodorant', 'toiletries'],
      ['Shampoo / shower gel (mini)', 'toiletries'],
      ['Razor + shaving', 'toiletries'],
      ['Comb / hair stuff', 'toiletries'],
      ['Face wash / moisturiser', 'toiletries'],
      ['Phone + charger', 'tech'],
      ['Laptop + charger (Tue/Wed work)', 'tech'],
      ['Work phone + charger', 'tech'],
      ['Headphones', 'tech'],
      ['Kindle / Switch (maybe)', 'tech'],
      ['Camera (maybe)', 'tech'],
      ['Spare USB-C cable', 'tech'],
      ['Passport', 'documents'],
      ['Boarding passes saved offline', 'documents'],
      ['Travel insurance card', 'documents'],
      ['GHIC / EHIC', 'documents'],
      ['Driving licence', 'documents'],
      ['Sunglasses', 'beach'],
      ['Snorkel set (maybe)', 'beach'],
      ['Beach bag', 'beach'],
      ['Cologne / scent', 'goingout'],
      ['Going-out shoes', 'goingout'],
      ['Smart watch / nice watch', 'goingout'],
      ['Sleep mask', 'misc'],
      ['Earplugs', 'misc']
    ];
    const SEED_SAHIL = [
      ['4x t-shirts (3 nights + spare)', 'clothes'],
      ['1x linen shirt (Fri/Sat dinner)', 'clothes'],
      ['2x swim shorts', 'clothes'],
      ['1x smart shorts', 'clothes'],
      ['2x casual shorts', 'clothes'],
      ['1x chinos / light trousers', 'clothes'],
      ['5x underwear', 'clothes'],
      ['3x socks', 'clothes'],
      ['1x light jumper (cool evenings)', 'clothes'],
      ['Pyjamas / sleep shorts', 'clothes'],
      ['Trainers', 'clothes'],
      ['Flip-flops / slides', 'clothes'],
      ['Toothbrush + toothpaste', 'toiletries'],
      ['Deodorant', 'toiletries'],
      ['Shampoo / shower gel (mini)', 'toiletries'],
      ['Razor + shaving', 'toiletries'],
      ['Face wash / moisturiser', 'toiletries'],
      ['Phone + charger', 'tech'],
      ['Headphones', 'tech'],
      ['Kindle (maybe)', 'tech'],
      ['Camera (maybe)', 'tech'],
      ['Passport', 'documents'],
      ['Boarding passes saved offline', 'documents'],
      ['Travel insurance card', 'documents'],
      ['GHIC / EHIC', 'documents'],
      ['Sunglasses', 'beach'],
      ['Beach bag', 'beach'],
      ['Cologne / scent', 'goingout'],
      ['Going-out shoes', 'goingout'],
      ['Sleep mask', 'misc'],
      ['Earplugs', 'misc']
    ];
    // Shared items - coordinate who brings each
    const SEED_SHARED = [
      'Suncream factor 50',
      'After-sun',
      'UK to EU travel adapter',
      'Spare phone charger cable',
      'Painkillers (paracetamol / ibuprofen)',
      'Antihistamines',
      'Plasters / small first aid',
      'Reusable water bottle',
      'Beach towel',
      'Portable Bluetooth speaker',
      'Pack of cards / backgammon',
      'Snacks for the boat party',
      'Cash - ~€100 each for tips & markets'
    ];

    // ───── State shape ─────
    // {
    //   shared: [ { id, text, state: 'empty'|'packed'|'maybe', owner: 'none'|'monty'|'sahil'|'both'|'skip', ts } ],
    //   monty: { items: [ { id, text, cat, state, ts } ] },
    //   sahil: { items: [ { id, text, cat, state, ts } ] },
    //   deleted: { shared: { key: ts }, monty: { key: ts }, sahil: { key: ts } }
    // }
    function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
    function itemKey(text, cat) {
      return [cat || '', String(text).trim().replace(/\s+/g, ' ').toLowerCase()].join('|');
    }
    function hashString(value) {
      let hash = 0;
      for (let i = 0; i < value.length; i += 1) {
        hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
      }
      return Math.abs(hash).toString(36);
    }
    function seedId(scope, text, cat) {
      return 'seed-' + hashString([scope, cat || '', itemKey(text, cat)].join('|'));
    }
    function emptyDeleted() {
      return { shared: {}, monty: {}, sahil: {} };
    }
    function emptyState() {
      return { shared: [], monty: { items: [] }, sahil: { items: [] }, deleted: emptyDeleted() };
    }
    function seedDefaults() {
      // Fresh default items are not user edits; keep their timestamp low so
      // cloud/local changes from another device win when IDs match.
      const seedTs = 0;
      const s = emptyState();
      s.shared = SEED_SHARED.map(t => ({ id: seedId('shared', t), text: t, state: 'empty', owner: 'none', ts: seedTs }));
      s.monty.items = SEED_MONTY.map(([t, c]) => ({ id: seedId('monty', t, c), text: t, cat: c, state: 'empty', ts: seedTs }));
      s.sahil.items = SEED_SAHIL.map(([t, c]) => ({ id: seedId('sahil', t, c), text: t, cat: c, state: 'empty', ts: seedTs }));
      return s;
    }

    let state = seedDefaults();
    let active = 'monty';
    let seeded = false;

    const syncEl = document.getElementById('pack-sync');
    const summaryCountsEl = document.getElementById('pack-summary-counts');
    const summaryFillEl = document.getElementById('pack-summary-fill');
    const summaryPctEl = document.getElementById('pack-summary-pct');
    const tabs = document.querySelectorAll('.pack-tab');
    const resetBtn = document.getElementById('pack-reset');
    const refreshBtn = document.getElementById('pack-refresh');

    function setSync(text, cls) {
      if (!syncEl) return;
      syncEl.textContent = text;
      syncEl.classList.remove('ok', 'error');
      if (cls) syncEl.classList.add(cls);
    }

    function loadLocal() {
      try {
        const raw = localStorage.getItem(PACK_LS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const norm = normalise(parsed);
          if (norm) { state = norm; seeded = true; saveLocal(); return; }
        }
      } catch (e) {}
    }
    function saveLocal() {
      try { localStorage.setItem(PACK_LS_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function hasDeleted(deleted) {
      return !!(deleted && ['shared', 'monty', 'sahil'].some(scope => Object.keys(deleted[scope] || {}).length));
    }
    function normaliseDeleted(raw) {
      const out = emptyDeleted();
      if (!raw || typeof raw !== 'object') return out;
      ['shared', 'monty', 'sahil'].forEach(scope => {
        if (!raw[scope] || typeof raw[scope] !== 'object') return;
        Object.keys(raw[scope]).forEach(key => {
          const ts = Number(raw[scope][key]) || 0;
          if (ts > 0) out[scope][String(key)] = ts;
        });
      });
      return out;
    }
    function itemDeleteKeys(item, scope) {
      const naturalKey = scope === 'shared'
        ? itemKey(item.text)
        : itemKey(item.text, item.cat || 'misc');
      return ['id:' + String(item.id), 'key:' + naturalKey];
    }
    function deleteTsForItem(deleted, scope, item) {
      const bucket = (deleted && deleted[scope]) || {};
      return itemDeleteKeys(item, scope).reduce((max, key) => Math.max(max, Number(bucket[key]) || 0), 0);
    }
    function filterDeletedItems(items, scope, deleted) {
      return items.filter(item => deleteTsForItem(deleted, scope, item) <= (item.ts || 0));
    }
    function ensureDeletedBucket(targetState, scope) {
      if (!targetState.deleted) targetState.deleted = emptyDeleted();
      if (!targetState.deleted[scope]) targetState.deleted[scope] = {};
      return targetState.deleted[scope];
    }
    function markDeleted(item, scope) {
      const bucket = ensureDeletedBucket(state, scope);
      const ts = Date.now();
      itemDeleteKeys(item, scope).forEach(key => { bucket[key] = ts; });
    }
    function clearDeleteMarkers(item, scope) {
      const bucket = ensureDeletedBucket(state, scope);
      itemDeleteKeys(item, scope).forEach(key => { delete bucket[key]; });
    }
    function mergeDeleted(localDeleted, remoteDeleted) {
      const out = emptyDeleted();
      [normaliseDeleted(localDeleted), normaliseDeleted(remoteDeleted)].forEach(deleted => {
        ['shared', 'monty', 'sahil'].forEach(scope => {
          Object.keys(deleted[scope]).forEach(key => {
            out[scope][key] = Math.max(out[scope][key] || 0, deleted[scope][key]);
          });
        });
      });
      return out;
    }

    function itemStateRank(value) {
      if (value === 'packed') return 2;
      if (value === 'maybe') return 1;
      return 0;
    }
    function pickMergedState(a, b, newer) {
      const older = newer === a ? b : a;
      const newerLooksLikeOldSeed = newer.state === 'empty' &&
        !String(newer.id).startsWith('seed-') &&
        (!('owner' in newer) || newer.owner === 'none');
      if (newerLooksLikeOldSeed && itemStateRank(older.state) > 0) return older.state;
      return newer.state;
    }
    function pickMergedOwner(a, b, newer) {
      const aOwner = a.owner || 'none';
      const bOwner = b.owner || 'none';
      if (aOwner === 'none') return bOwner;
      if (bOwner === 'none') return aOwner;
      return newer.owner || aOwner;
    }
    function pickMergedId(a, b, newer) {
      if (String(a.id).startsWith('seed-')) return a.id;
      if (String(b.id).startsWith('seed-')) return b.id;
      return newer.id;
    }
    function mergeDuplicateItem(a, b, kind) {
      const newer = (b.ts || 0) >= (a.ts || 0) ? b : a;
      const merged = Object.assign({}, newer, {
        id: pickMergedId(a, b, newer),
        state: pickMergedState(a, b, newer),
        ts: Math.max(a.ts || 0, b.ts || 0)
      });
      if (kind === 'shared') {
        merged.owner = pickMergedOwner(a, b, newer);
      } else {
        merged.cat = newer.cat || a.cat || b.cat || 'misc';
      }
      return merged;
    }
    function dedupeItems(items, kind) {
      const byNaturalKey = new Map();
      items.forEach(item => {
        const key = kind === 'shared'
          ? itemKey(item.text)
          : itemKey(item.text, item.cat || 'misc');
        const existing = byNaturalKey.get(key);
        byNaturalKey.set(key, existing ? mergeDuplicateItem(existing, item, kind) : item);
      });
      return Array.from(byNaturalKey.values());
    }

    // Ensure a returned object has the right shape; missing pieces fall back to defaults.
    function normalise(remote) {
      if (!remote || typeof remote !== 'object') return null;
      const valid = (
        Array.isArray(remote.shared) ||
        (remote.monty && Array.isArray(remote.monty.items)) ||
        (remote.sahil && Array.isArray(remote.sahil.items)) ||
        (remote.deleted && typeof remote.deleted === 'object')
      );
      if (!valid) return null;
      const out = emptyState();
      out.deleted = normaliseDeleted(remote.deleted);
      if (Array.isArray(remote.shared)) {
        out.shared = dedupeItems(remote.shared.filter(i => i && i.id && typeof i.text === 'string').map(i => ({
          id: String(i.id),
          text: String(i.text),
          state: ['empty', 'packed', 'maybe'].includes(i.state) ? i.state : 'empty',
          owner: ['none', 'monty', 'sahil', 'both', 'skip'].includes(i.owner) ? i.owner : 'none',
          ts: Number(i.ts) || 0
        })), 'shared');
        out.shared = filterDeletedItems(out.shared, 'shared', out.deleted);
      }
      ['monty', 'sahil'].forEach(p => {
        if (remote[p] && Array.isArray(remote[p].items)) {
          out[p].items = dedupeItems(remote[p].items.filter(i => i && i.id && typeof i.text === 'string').map(i => ({
            id: String(i.id),
            text: String(i.text),
            cat: typeof i.cat === 'string' ? i.cat : 'misc',
            state: ['empty', 'packed', 'maybe'].includes(i.state) ? i.state : 'empty',
            ts: Number(i.ts) || 0
          })), 'personal');
          out[p].items = filterDeletedItems(out[p].items, p, out.deleted);
        }
      });
      return out;
    }

    // Per-item-timestamp merge - higher ts wins. New items in remote get added.
    function mergeItems(local, remote, scope, deleted) {
      const kind = scope === 'shared' ? 'shared' : 'personal';
      const byId = new Map();
      [...local, ...remote].forEach(item => {
        const existing = byId.get(item.id);
        if (!existing || (item.ts || 0) >= (existing.ts || 0)) {
          byId.set(item.id, item);
        }
      });
      return filterDeletedItems(dedupeItems(Array.from(byId.values()), kind), scope, deleted);
    }
    function mergeState(local, remote) {
      const out = emptyState();
      out.deleted = mergeDeleted(local.deleted, remote.deleted);
      out.shared = mergeItems(local.shared || [], remote.shared || [], 'shared', out.deleted);
      out.monty.items = mergeItems(local.monty.items || [], remote.monty.items || [], 'monty', out.deleted);
      out.sahil.items = mergeItems(local.sahil.items || [], remote.sahil.items || [], 'sahil', out.deleted);
      return out;
    }

    let lastActivity = 0;
    function bump() { lastActivity = Date.now(); }

    async function fetchRemoteRecord() {
      const r = await fetch(PACK_READ_URL, { cache: 'no-store', headers: PACK_HEADERS });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const body = await r.json();
      return (body && body.record) || {};
    }

    async function pullState() {
      if (!PACK_SYNC_ENABLED) { setSync('This device only', 'error'); return; }
      if (editingId !== null) return; // don't sync mid-edit - we'd lose typing
      try {
        const record = await fetchRemoteRecord();
        const remote = normalise(record);
        const before = JSON.stringify(state);
        if (remote) {
          state = mergeState(state, remote);
        }
        const remoteHasData = remote && (
          remote.shared.length > 0 ||
          remote.monty.items.length > 0 ||
          remote.sahil.items.length > 0 ||
          hasDeleted(remote.deleted)
        );
        // If both local and remote are empty (first ever load on first device), seed defaults
        if (!seeded && !remoteHasData) {
          state = seedDefaults();
          seeded = true;
          saveLocal();
          render();
          pushState();
        } else {
          seeded = true;
          saveLocal();
          render();
        }
        if (JSON.stringify(state) !== before) bump();
        setSync('Synced', 'ok');
      } catch (e) {
        setSync('Offline - this device only', 'error');
      }
    }

    let pushTimer = null;
    let pushing = false;
    function pushState() {
      if (!PACK_SYNC_ENABLED) return;
      clearTimeout(pushTimer);
      setSync('Saving...');
      pushTimer = setTimeout(async () => {
        if (pushing) { pushTimer = setTimeout(pushState, 200); return; }
        pushing = true;
        try {
          try {
            const record = await fetchRemoteRecord();
            const remote = normalise(record);
            if (remote) {
              state = mergeState(state, remote);
              saveLocal();
              render();
            }
          } catch (e) {}
          const r = await fetch(PACK_WRITE_URL, {
            method: 'PUT',
            headers: Object.assign({ 'Content-Type': 'application/json' }, PACK_HEADERS),
            body: JSON.stringify(state)
          });
          if (!r.ok) throw new Error('HTTP ' + r.status);
          setSync('Synced', 'ok');
        } catch (e) {
          setSync('Offline - this device only', 'error');
        } finally {
          pushing = false;
        }
      }, 250);
    }

    // ───── Rendering ─────
    function nextItemState(s) {
      if (s === 'empty') return 'packed';
      if (s === 'packed') return 'maybe';
      return 'empty';
    }
    function nextOwner(o) {
      const cycle = ['none', 'monty', 'sahil', 'both', 'skip'];
      const i = cycle.indexOf(o);
      return cycle[(i + 1) % cycle.length];
    }
    function ownerLabel(o) {
      if (o === 'monty') return 'Monty';
      if (o === 'sahil') return 'Sahil';
      if (o === 'both') return 'Both';
      if (o === 'skip') return 'Skip';
      return 'Who?';
    }

    function escapeHtml(s) {
      return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
    }

    function renderShared() {
      if (!state.shared.length) return '';
      const rows = state.shared.map(item => `
        <li class="pack-item state-${item.state}" data-id="${item.id}" data-kind="shared">
          <span class="pack-item-box" data-act="toggle">${item.state === 'packed' ? '✓' : item.state === 'maybe' ? '?' : ''}</span>
          <span class="pack-item-text" data-act="edit">${escapeHtml(item.text)}</span>
          <button class="pack-item-owner owner-${item.owner}" data-act="owner" title="Who brings this?">${ownerLabel(item.owner)}</button>
          <span class="pack-item-actions">
            <button class="pack-item-action is-edit" data-act="edit-btn" aria-label="Edit">&#9998;</button>
            <button class="pack-item-action is-delete" data-act="delete" aria-label="Delete">&times;</button>
          </span>
        </li>
      `).join('');
      return `
        <div class="pack-shared-block">
          <div class="pack-shared-head">
            <h3 class="pack-shared-title">Shared</h3>
            <span class="pack-shared-hint">Tap the pill to set who brings each one</span>
          </div>
          <ul class="pack-list" data-cat="shared">${rows}
            <li class="pack-add-row" data-cat="shared">
              <input class="pack-add-input" placeholder="Add a shared item..." aria-label="New shared item">
              <button class="pack-add-btn" type="button">Add</button>
            </li>
          </ul>
        </div>
      `;
    }

    function renderCategory(catKey, catName, items) {
      const catItems = items.filter(i => (i.cat || 'misc') === catKey);
      const packed = catItems.filter(i => i.state === 'packed').length;
      const rows = catItems.map(item => `
        <li class="pack-item state-${item.state}" data-id="${item.id}" data-kind="personal">
          <span class="pack-item-box" data-act="toggle">${item.state === 'packed' ? '✓' : item.state === 'maybe' ? '?' : ''}</span>
          <span class="pack-item-text" data-act="edit">${escapeHtml(item.text)}</span>
          <span class="pack-item-actions">
            <button class="pack-item-action is-edit" data-act="edit-btn" aria-label="Edit">&#9998;</button>
            <button class="pack-item-action is-delete" data-act="delete" aria-label="Delete">&times;</button>
          </span>
        </li>
      `).join('');
      return `
        <section class="pack-cat" data-cat-key="${catKey}">
          <div class="pack-cat-head">
            <h3 class="pack-cat-title">${catName}</h3>
            <span class="pack-cat-meta">${packed} / ${catItems.length}</span>
          </div>
          <ul class="pack-list" data-cat="${catKey}">${rows}
            <li class="pack-add-row" data-cat="${catKey}">
              <input class="pack-add-input" placeholder="Add to ${catName.toLowerCase()}..." aria-label="New ${catName} item">
              <button class="pack-add-btn" type="button">Add</button>
            </li>
          </ul>
        </section>
      `;
    }

    function renderSummary() {
      const items = state[active].items;
      const personalPacked = items.filter(i => i.state === 'packed').length;
      const sharedOwnerMine = state.shared.filter(i => i.owner === active || i.owner === 'both').length;
      const sharedMineDone = state.shared.filter(i => (i.owner === active || i.owner === 'both') && i.state === 'packed').length;
      const totalCount = items.length + sharedOwnerMine;
      const doneCount = personalPacked + sharedMineDone;
      const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
      summaryCountsEl.textContent = doneCount + ' / ' + totalCount + ' packed';
      summaryFillEl.style.width = pct + '%';
      summaryPctEl.textContent = pct + '%';
    }

    function render() {
      // Don't rebuild the DOM while an inline edit input is open - it would
      // wipe out what the user is typing and dismiss the mobile keyboard.
      if (editingId !== null && packContent.querySelector('input.pack-item-edit-input')) {
        renderSummary();
        return;
      }
      // Body tint for active person
      document.body.classList.toggle('pack-monty', active === 'monty');
      document.body.classList.toggle('pack-sahil', active === 'sahil');

      const items = state[active].items;
      let html = renderShared();
      CATS.forEach(c => { html += renderCategory(c.key, c.name, items); });
      packContent.innerHTML = html;
      renderSummary();
      wireItemHandlers();
    }

    let editingId = null; // suppress re-renders that would clobber the open input

    function cycleItemState(li) {
      const id = li.dataset.id;
      const kind = li.dataset.kind;
      const list = kind === 'shared' ? state.shared : state[active].items;
      const item = list.find(i => i.id === id);
      if (!item) return;
      item.state = nextItemState(item.state);
      item.ts = Date.now();
      saveLocal();
      render();
      bump();
      pushState();
      if (window.haptic) window.haptic(item.state === 'packed' ? 'success' : 'tap');
    }

    function wireItemHandlers() {
      // Row click cycles state - EXCEPT when the click target is the text
      // (handled by edit handler), an owner pill, a pencil/× button, or the
      // open edit input. Tapping the checkbox or any empty area cycles.
      const NON_TOGGLE_ACTS = new Set(['edit', 'edit-btn', 'delete', 'owner', 'edit-input']);
      packContent.querySelectorAll('.pack-item').forEach(li => {
        li.addEventListener('click', (e) => {
          const act = e.target.closest('[data-act]')?.dataset.act;
          if (act && NON_TOGGLE_ACTS.has(act)) return;
          cycleItemState(li);
        });
      });

      // Tap the item TEXT to edit (primary mobile-friendly path)
      packContent.querySelectorAll('[data-act="edit"]').forEach(textEl => {
        textEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const li = textEl.closest('.pack-item');
          enterEditMode(textEl, li);
        });
      });

      // Pencil button (alt path - explicit)
      packContent.querySelectorAll('[data-act="edit-btn"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const li = btn.closest('.pack-item');
          const text = li.querySelector('.pack-item-text');
          enterEditMode(text, li);
        });
      });

      // Owner pill toggle (shared only)
      packContent.querySelectorAll('[data-act="owner"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const li = btn.closest('.pack-item');
          const id = li.dataset.id;
          const item = state.shared.find(i => i.id === id);
          if (!item) return;
          item.owner = nextOwner(item.owner);
          item.ts = Date.now();
          saveLocal();
          render();
          bump();
          pushState();
        });
      });

      // Delete
      packContent.querySelectorAll('[data-act="delete"]').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const li = btn.closest('.pack-item');
          const id = li.dataset.id;
          const kind = li.dataset.kind;
          if (!confirm('Delete this item?')) return;
          if (kind === 'shared') {
            const item = state.shared.find(i => i.id === id);
            if (!item) return;
            markDeleted(item, 'shared');
            state.shared = filterDeletedItems(state.shared, 'shared', state.deleted);
          } else {
            const item = state[active].items.find(i => i.id === id);
            if (!item) return;
            markDeleted(item, active);
            state[active].items = filterDeletedItems(state[active].items, active, state.deleted);
          }
          saveLocal();
          render();
          bump();
          pushState();
        });
      });

      // Add new item rows
      packContent.querySelectorAll('.pack-add-row').forEach(row => {
        const input = row.querySelector('.pack-add-input');
        const btn = row.querySelector('.pack-add-btn');
        const cat = row.dataset.cat;
        const commit = () => {
          const text = input.value.trim();
          if (!text) return;
          const newItem = { id: genId(), text, state: 'empty', ts: Date.now() };
          if (cat === 'shared') {
            newItem.owner = 'none';
            clearDeleteMarkers(newItem, 'shared');
            state.shared = dedupeItems([...state.shared, newItem], 'shared');
          } else {
            newItem.cat = cat;
            clearDeleteMarkers(newItem, active);
            state[active].items = dedupeItems([...state[active].items, newItem], 'personal');
          }
          input.value = '';
          saveLocal();
          render();
          bump();
          pushState();
        };
        btn.addEventListener('click', commit);
        input.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
        });
      });
    }

    // Swap the text span for a real <input> - reliable mobile keyboard, native selection.
    function enterEditMode(textEl, li) {
      const id = li.dataset.id;
      const kind = li.dataset.kind;
      const list = kind === 'shared' ? state.shared : state[active].items;
      const item = list.find(i => i.id === id);
      if (!item) return;
      if (editingId === id) return; // already editing this item
      editingId = id;

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'pack-item-edit-input';
      input.value = item.text;
      input.setAttribute('aria-label', 'Edit item text');
      input.setAttribute('autocomplete', 'off');
      input.setAttribute('autocapitalize', 'sentences');
      input.setAttribute('spellcheck', 'true');
      // Keep the same data-act so the row click handler still ignores it
      input.setAttribute('data-act', 'edit-input');
      textEl.replaceWith(input);
      input.focus();
      // setSelectionRange after a tick - some mobile browsers ignore .select() inside
      // the synchronous click handler before the keyboard appears.
      requestAnimationFrame(() => {
        try { input.select(); } catch (_) {}
      });

      let done = false;
      const finish = (save) => {
        if (done) return;
        done = true;
        editingId = null;
        const newText = input.value.trim();
        if (save && newText && newText !== item.text) {
          item.text = newText;
          item.ts = Date.now();
          if (kind === 'shared') {
            clearDeleteMarkers(item, 'shared');
            state.shared = dedupeItems(state.shared, 'shared');
          } else {
            clearDeleteMarkers(item, active);
            state[active].items = dedupeItems(state[active].items, 'personal');
          }
          saveLocal();
          bump();
          pushState();
        }
        // Re-render to restore the span (with new or original text)
        render();
      };

      input.addEventListener('blur', () => finish(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); finish(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finish(false); }
      });
      // Make sure clicks inside the input don't bubble to the row toggle
      input.addEventListener('click', (e) => e.stopPropagation());
    }

    // Tabs
    tabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const t = tab.dataset.tab;
        if (t === active) return;
        active = t;
        tabs.forEach(b => b.classList.toggle('active', b.dataset.tab === active));
        render();
      });
    });

    // Reset current tab
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        if (!confirm('Reset ' + (active === 'monty' ? "Monty's" : "Sahil's") + ' list back to the default items? This will clear your check marks too.')) return;
        const now = Date.now();
        const seed = active === 'monty' ? SEED_MONTY : SEED_SAHIL;
        state[active].items = seed.map(([t, c]) => ({ id: seedId(active, t, c), text: t, cat: c, state: 'empty', ts: now }));
        state[active].items.forEach(item => clearDeleteMarkers(item, active));
        saveLocal();
        render();
        bump();
        pushState();
      });
    }

    // Manual refresh
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        setSync('Syncing...');
        bump();
        pullState();
      });
    }

    loadLocal();
    render();
    bump();
    pullState();

    let packPollTimer = null;
    function schedulePackPoll() {
      clearTimeout(packPollTimer);
      const interval = (Date.now() - lastActivity < PACK_ACTIVE_WINDOW_MS) ? PACK_ACTIVE_MS : PACK_IDLE_MS;
      packPollTimer = setTimeout(async () => {
        if (document.visibilityState === 'visible' && !pushing) await pullState();
        schedulePackPoll();
      }, interval);
    }
    schedulePackPoll();

    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        bump();
        pullState();
        schedulePackPoll();
      }
    });
  }
