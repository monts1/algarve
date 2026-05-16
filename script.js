
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
    const SQUARES = [
      'Someone gets sunburned',
      'Pastel de nata consumed',
      '"Just one more drink" x3',
      'Wrong thing ordered by mistake',
      'Falls asleep on the beach',
      'Spills a drink',
      '20+ min debate on where to eat',
      'Photo worthy of a postcard',
      '"I\'m not hungry" then eats loads',
      'Gets lost finding a venue',
      'Still out past 3am',
      'Spots a stray cat',
      'The Algarve!',
      'Forgets to apply sunscreen',
      'Ends up somewhere unplanned',
      'Genuine "wow" at the view',
      'Attempts Portuguese',
      'Loses track of whose round it is',
      'Catches a sunset or sunrise',
      'Orders something, no idea what it is',
      '"We should do this every year"',
      'Gets hit on at the bar',
      'Refuses to leave when it\'s time',
      'Mentions prices back home',
      'Ugly-cries at a banger'
    ];
    const FREE = 12;
    const KEY = 'algarve-bingo-v1';

    let state = Array(25).fill(false);
    state[FREE] = true;

    try {
      const saved = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(saved) && saved.length === 25) { state = saved; state[FREE] = true; }
    } catch (e) {}

    function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }

    function winLines() {
      const lines = [];
      for (let r = 0; r < 5; r++) {
        const row = [r*5, r*5+1, r*5+2, r*5+3, r*5+4];
        if (row.every(i => state[i])) lines.push(row);
      }
      for (let c = 0; c < 5; c++) {
        const col = [c, c+5, c+10, c+15, c+20];
        if (col.every(i => state[i])) lines.push(col);
      }
      if ([0,6,12,18,24].every(i => state[i])) lines.push([0,6,12,18,24]);
      if ([4,8,12,16,20].every(i => state[i])) lines.push([4,8,12,16,20]);
      return lines;
    }

    function render() {
      const winning = new Set(winLines().flat());
      bingoBoard.querySelectorAll('.bingo-cell').forEach((cell, i) => {
        cell.classList.toggle('marked', state[i] && i !== FREE);
        cell.classList.toggle('winning', winning.has(i));
      });
      const banner = document.getElementById('bingo-win-banner');
      if (banner) banner.classList.toggle('visible', winning.size > 0);
    }

    SQUARES.forEach((text, i) => {
      const cell = document.createElement('div');
      cell.className = 'bingo-cell' + (i === FREE ? ' free' : '');
      cell.textContent = text;
      if (i !== FREE) {
        cell.addEventListener('click', () => { state[i] = !state[i]; save(); render(); });
      }
      bingoBoard.appendChild(cell);
    });
    render();

    const resetBtn = document.getElementById('bingo-reset');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        state = Array(25).fill(false);
        state[FREE] = true;
        save();
        render();
      });
    }
  }
