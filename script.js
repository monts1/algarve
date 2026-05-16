
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
        'Gets hit on at the bar',
        'Refuses to leave when it\'s time',
        'Wears the same shirt two days running',
        'Hangover writes off a morning',
        'Sunglasses lost or sat on',
        'Photo of the food before eating it',
        'Asks a local for directions',
        'Buy something we\'d never buy at home',
        'Pre-drinks at the apartment'
      ],
      fun: [
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
        'Live music we didn\'t plan for',
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
    const POLL_MS = 8000;
    const cfg = (typeof CONFIG !== 'undefined') ? CONFIG : {};
    const SYNC_ENABLED = !!(cfg.JSONBIN_KEY && cfg.JSONBIN_BIN_ID);
    const READ_URL = SYNC_ENABLED ? `https://api.jsonbin.io/v3/b/${cfg.JSONBIN_BIN_ID}/latest` : null;
    const WRITE_URL = SYNC_ENABLED ? `https://api.jsonbin.io/v3/b/${cfg.JSONBIN_BIN_ID}` : null;
    const SYNC_HEADERS = SYNC_ENABLED ? { 'X-Access-Key': cfg.JSONBIN_KEY } : null;

    let active = 'realistic';
    let state = {
      realistic: Array(25).fill(false),
      fun: Array(25).fill(false)
    };
    state.realistic[FREE] = true;
    state.fun[FREE] = true;

    const syncEl = document.getElementById('bingo-sync');
    const banner = document.getElementById('bingo-win-banner');
    const resetBtn = document.getElementById('bingo-reset');
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
        if (saved && Array.isArray(saved.realistic) && Array.isArray(saved.fun)
          && saved.realistic.length === 25 && saved.fun.length === 25) {
          state = saved;
        }
      } catch (e) {}
      state.realistic[FREE] = true;
      state.fun[FREE] = true;
    }

    function saveLocal() {
      try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch (e) {}
    }

    function normalise(remote) {
      if (!remote || typeof remote !== 'object') return null;
      const out = { realistic: Array(25).fill(false), fun: Array(25).fill(false) };
      ['realistic', 'fun'].forEach(card => {
        if (Array.isArray(remote[card]) && remote[card].length === 25) {
          out[card] = remote[card].map(Boolean);
        }
      });
      out.realistic[FREE] = true;
      out.fun[FREE] = true;
      return out;
    }

    async function pullState() {
      if (!SYNC_ENABLED) { setSync('This device only', 'error'); return; }
      try {
        const r = await fetch(READ_URL, { cache: 'no-store', headers: SYNC_HEADERS });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const body = await r.json();
        const remote = normalise(body && body.record);
        if (remote) {
          state = remote;
          saveLocal();
          render();
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
            saveLocal();
            render();
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

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state[active] = Array(25).fill(false);
        state[active][FREE] = true;
        saveLocal();
        render();
        pushState();
      });
    }

    loadLocal();
    buildBoard();
    render();
    pullState();

    setInterval(() => {
      if (document.visibilityState === 'visible' && !pushing) pullState();
    }, POLL_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') pullState();
    });
  }

  // Homepage: phase-adaptive hero, countdown, next moment
  const heroImg = document.querySelector('.hero-img');
  if (heroImg) {
    const PHASES = {
      pretrip: { img: 'img/hero/pretrip.jpg', credit: 'Quarteira promenade - Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File:Quarteira_Panor%C3%A2mica_-_Marginal_Este_-_panoramio.jpg' },
      thu:     { img: 'img/hero/thu.jpg',     credit: 'Quarteira beach - Wikimedia Commons',     creditUrl: 'https://commons.wikimedia.org/wiki/File:Marginal_Este_Quarteira_-_panoramio.jpg' },
      fri:     { img: 'img/hero/fri.jpg',     credit: 'Cerro da Vila ruins - Wikimedia Commons', creditUrl: 'https://commons.wikimedia.org/wiki/File:Cerro_da_Vila_Roman_Ruins_Saturday_20_November_2010.JPG' },
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
