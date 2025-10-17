(function () {
  const $ = id => document.getElementById(id);
  const nowEl = $("now");
  const lastUpdateEl = $("lastUpdate");
  const tempEl = $("tempC");
  const tempBar = $("tempBar");
  const tempComfort = $("tempComfort");
  const heaterTempEl = $("heaterTemp");
  const heaterStatusEl = $("heaterStatus");
  const runTimeEl = $("runTime");
  const runDistanceEl = $("runDistance");
  const runDistanceUnitEl = $("runDistanceUnit");
  const runSpeedEl = $("runSpeed");
  const runSpeedUnitEl = $("runSpeedUnit");
  const drinkTotalEl = $("drinkTotal");
  const drinkChartEl = $("drinkChart");
  const activeTimeEl = $("activeTime");
  const sleepTimeEl = $("sleepTime");
  const currentStateEl = $("currentState");
  const runChartEl = $("runChart");
  const heaterSetpointInput = $("heaterSetpointInput");
  const heaterModeAutoBtn = $("heaterModeAutoBtn");
  const heaterModeManualBtn = $("heaterModeManualBtn");

  const MOCK_TEMP_START = 24;
  const MOCK_HT_START = 30;
  const MOCK_SETPOINT = 28.0;
  const MOCK_SPEED_MS = 1.2;


  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function setBar(el, pct) { if (el) { el.style.width = clamp(pct, 0, 100).toFixed(0) + "%"; } }
  function pad(n) { return n < 10 ? "0" + n : "" + n }
  function fmtNow(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()) + " " + pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds()) }
  function fmtTime(sec) { sec = Math.max(0, Math.floor(sec)); const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60; return pad(h) + ":" + pad(m) + ":" + pad(s) }
  function comfortForTemp(c) { if (c < 18) return "Cold"; if (c > 28) return "Hot"; return "Comfort" }
  function setHeaterStatus(on) {
    if (!heaterStatusEl) return;
    heaterStatusEl.textContent = on ? "ON" : "OFF";
    heaterStatusEl.classList.remove("on", "off");
    heaterStatusEl.classList.add(on ? "on" : "off");
  }

  function secondsOfDay(d) {
    return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  }

  function resizeCanvas(canvas, minHeight) {
    if (!canvas || !canvas.parentElement) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.parentElement.getBoundingClientRect();
    const cssW = Math.max(320, Math.floor(rect.width));
    const cssH = Math.max(minHeight || 220, Math.floor(cssW * 0.28));
    canvas.style.width = cssW + "px";
    canvas.style.height = cssH + "px";
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
  }

  function resizeCharts() {
    if (drinkChartEl) resizeCanvas(drinkChartEl, 220);
    if (runChartEl) resizeCanvas(runChartEl, 220);
    drawDrinkChart();
    drawRunChart();
  }

  function debounce(fn, ms) {
    let t;
    return function () {
      const ctx = this, args = arguments;
      clearTimeout(t);
      t = setTimeout(function () { fn.apply(ctx, args); }, ms);
    }
  }

  function commitSetpointFromInput() {
    if (!heaterSetpointInput) return;
    const min = parseFloat(heaterSetpointInput.min);
    const max = parseFloat(heaterSetpointInput.max);
    let v = parseFloat(heaterSetpointInput.value);
    if (!Number.isFinite(v)) {
      const prev = Number.isFinite(heaterSetpointInput._prev) ? heaterSetpointInput._prev : state.heaterSetpoint;
      if (Number.isFinite(prev)) {
        heaterSetpointInput.value = prev.toFixed(1);
        updateUI({ heaterSetpoint: prev, _ts: Date.now() });
      }
      return;
    }
    if (Number.isFinite(max)) v = Math.min(max, v);
    if (Number.isFinite(min)) v = Math.max(min, v);
    heaterSetpointInput.value = v.toFixed(1);
    updateUI({ heaterSetpoint: v, _ts: Date.now() });
  }

  // Initial sizing and responsive redraw
  window.addEventListener('resize', debounce(resizeCharts, 150));
  // Defer initial sizing to next tick to ensure layout is ready
  setTimeout(resizeCharts, 0);

  function drawRunChart() {
    if (!runChartEl) return;
    const pts = state.runSeries || [];
    const ctx = runChartEl.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, runChartEl.width, runChartEl.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = Math.max(0, Math.floor(runChartEl.width / dpr));
    const H = Math.max(0, Math.floor(runChartEl.height / dpr));
    const padding = { l: 50, b: 24, t: 10, r: 10 };
    const chartW = Math.max(0, W - padding.l - padding.r);
    const chartH = Math.max(0, H - padding.t - padding.b);
    // axes
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.l, padding.t);
    ctx.lineTo(padding.l, padding.t + chartH);
    ctx.lineTo(padding.l + chartW, padding.t + chartH);
    ctx.stroke();
    // domain and range
    const xMax = 24 * 3600; // seconds in day
    const yMax = Math.max(10, ...pts.map(p => p.distM || 0));
    // grid + labels
    ctx.fillStyle = "#666";
    ctx.font = "12px sans-serif";
    for (let h = 0; h <= 24; h += 6) {
      const x = padding.l + (h * 3600) / xMax * chartW;
      ctx.strokeStyle = h === 24 ? "#999" : "#eee";
      ctx.beginPath();
      ctx.moveTo(x, padding.t);
      ctx.lineTo(x, padding.t + chartH);
      ctx.stroke();
      const lbl = ("00" + h).slice(-2) + ":00";
      ctx.fillText(lbl, Math.max(padding.l, x - 12), padding.t + chartH + 16);
    }
    for (let i = 0; i <= 4; i++) {
      const v = yMax * i / 4;
      const y = padding.t + chartH - (v / yMax) * chartH;
      ctx.strokeStyle = i === 0 ? "#999" : "#eee";
      ctx.beginPath();
      ctx.moveTo(padding.l, y);
      ctx.lineTo(padding.l + chartW, y);
      ctx.stroke();
      ctx.fillStyle = "#666";
      ctx.fillText(v.toFixed(0), 6, y + 4);
    }
    if (pts.length < 2) return;
    // polyline
    ctx.strokeStyle = "#22aa88";
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const x = padding.l + (Math.min(xMax, Math.max(0, p.tSecOfDay)) / xMax) * chartW;
      const y = padding.t + chartH - ((Math.max(0, p.distM)) / yMax) * chartH;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  let state = {
    tempC: NaN,
    waterCc: NaN,
    heaterTemp: NaN,
    heaterOn: false,
    heaterSetpoint: NaN,
    heaterMode: "Auto",
    runTimeSec: 0,
    runDistanceM: 0,
    speedMS: 0,
    _ts: Date.now(),
    drinkHourly: new Array(24).fill(0),
    lastWaterCc: 0,
    dayKey: "",
    activeSec: 0,
    sleepSec: 0,
    currentActive: false,
    runSeries: [] // [{tSecOfDay:number, distM:number}]
  };

  function todayKey(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  function drawDrinkChart() {
    if (!drinkChartEl) return;
    const ctx = drinkChartEl.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    // clear and set transform so drawing uses CSS pixels
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, drinkChartEl.width, drinkChartEl.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const W = Math.max(0, Math.floor(drinkChartEl.width / dpr));
    const H = Math.max(0, Math.floor(drinkChartEl.height / dpr));
    const padding = { l: 40, b: 24, t: 10, r: 10 };
    const chartW = Math.max(0, W - padding.l - padding.r);
    const chartH = Math.max(0, H - padding.t - padding.b);
    const data = state.drinkHourly || [];
    const maxV = Math.max(5, ...data);
    // axes
    ctx.strokeStyle = "#999";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.l, padding.t);
    ctx.lineTo(padding.l, padding.t + chartH);
    ctx.lineTo(padding.l + chartW, padding.t + chartH);
    ctx.stroke();
    // y ticks
    ctx.fillStyle = "#666";
    ctx.font = "12px sans-serif";
    for (let i = 0; i <= 4; i++) {
      const v = maxV * i / 4;
      const y = padding.t + chartH - (v / maxV) * chartH;
      ctx.fillText(v.toFixed(0), 4, y + 4);
      ctx.strokeStyle = i === 0 ? "#999" : "#eee";
      ctx.beginPath();
      ctx.moveTo(padding.l, y);
      ctx.lineTo(padding.l + chartW, y);
      ctx.stroke();
    }
    // bars (24 hours)
    const n = 24;
    const gap = 2;
    const barW = Math.max(2, Math.floor((chartW - (n - 1) * gap) / n));
    for (let h = 0; h < n; h++) {
      const v = data[h] || 0;
      const hFrac = v / maxV;
      const x = padding.l + h * (barW + gap);
      const y = padding.t + chartH - hFrac * chartH;
      ctx.fillStyle = "#4f8cff";
      ctx.fillRect(x, y, barW, Math.max(0, hFrac * chartH));
      // x labels every 3h
      if (h % 3 === 0) {
        ctx.fillStyle = "#666";
        const label = ("00" + h).slice(-2);
        ctx.fillText(label, x, padding.t + chartH + 16);
      }
    }
  }

  function updateUI(d) {
    const prev = state;
    state = Object.assign({}, state, d);
    const ts = d._ts || Date.now();
    const now = new Date(ts);
    const key = todayKey(now);
    if (!state.dayKey) state.dayKey = key;
    if (state.dayKey !== key) {
      state.dayKey = key;
      state.drinkHourly = new Array(24).fill(0);
      state.lastWaterCc = 0;
      state.activeSec = 0;
      state.sleepSec = 0;
      state.runSeries = [];
    }
    const t = state.tempC;
    if (Number.isFinite(t)) {
      tempEl && (tempEl.textContent = t.toFixed(1));
      const pct = (t - 10) / (35 - 10) * 100;
      setBar(tempBar, pct);
      tempComfort && (tempComfort.textContent = comfortForTemp(t));
    }
    const w = state.waterCc;
    if (Number.isFinite(w)) {
      // bin incremental drinking into current hour
      const prevW = Number.isFinite(prev.lastWaterCc) ? prev.lastWaterCc : 0;
      const delta = Math.max(0, w - prevW);
      const hour = now.getHours();
      if (Number.isFinite(delta) && delta > 0) {
        state.drinkHourly[hour] = (state.drinkHourly[hour] || 0) + delta;
      }
      state.lastWaterCc = w;
    }
    // update total from hourly bins when available
    if (drinkTotalEl && Array.isArray(state.drinkHourly)) {
      const total = state.drinkHourly.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
      drinkTotalEl.textContent = Math.max(0, total).toFixed(0);
    }
    const ht = state.heaterTemp;
    if (Number.isFinite(ht)) heaterTempEl && (heaterTempEl.textContent = ht.toFixed(1));
    setHeaterStatus(!!state.heaterOn);
    // sync mode buttons visual state
    if (heaterModeAutoBtn) {
      heaterModeAutoBtn.classList.toggle('on', state.heaterMode === 'Auto');
      heaterModeAutoBtn.setAttribute('aria-pressed', String(state.heaterMode === 'Auto'));
      if (!heaterModeAutoBtn._wired) {
        heaterModeAutoBtn._wired = true;
        heaterModeAutoBtn.addEventListener('click', function(){
          updateUI({ heaterMode: 'Auto', _ts: Date.now() });
        });
      }
    }
    if (heaterModeManualBtn) {
      heaterModeManualBtn.classList.toggle('on', state.heaterMode === 'Manual');
      heaterModeManualBtn.setAttribute('aria-pressed', String(state.heaterMode === 'Manual'));
      if (!heaterModeManualBtn._wired) {
        heaterModeManualBtn._wired = true;
        heaterModeManualBtn.addEventListener('click', function(){
          updateUI({ heaterMode: 'Manual', _ts: Date.now() });
        });
      }
    }
    // heaterStatus acts as toggle only in Manual mode
    if (heaterStatusEl) {
      const manual = state.heaterMode === 'Manual';
      heaterStatusEl.disabled = !manual;
      heaterStatusEl.setAttribute('aria-disabled', String(!manual));
      heaterStatusEl.title = manual ? 'Toggle heater ON/OFF' : 'Toggle available in Manual mode';
      if (!heaterStatusEl._wired) {
        heaterStatusEl._wired = true;
        heaterStatusEl.addEventListener('click', function(){
          if (state.heaterMode === 'Manual') {
            updateUI({ heaterOn: !state.heaterOn, _ts: Date.now() });
          }
        });
      }
    }
    // sync setpoint input value and enabled state
    if (heaterSetpointInput) {
      if (Number.isFinite(state.heaterSetpoint)) {
        if (document.activeElement !== heaterSetpointInput) {
          heaterSetpointInput.value = state.heaterSetpoint.toFixed(1);
        }
      }
      heaterSetpointInput.disabled = state.heaterMode !== 'Auto';
      if (!heaterSetpointInput._wired) {
        heaterSetpointInput._wired = true;
        heaterSetpointInput.addEventListener('focus', function(){
          const v = Number.isFinite(state.heaterSetpoint) ? state.heaterSetpoint : parseFloat(heaterSetpointInput.value);
          heaterSetpointInput._prev = Number.isFinite(v) ? v : undefined;
        });
        heaterSetpointInput.addEventListener('input', function(){
          /* no-op while typing; commit on Enter/blur */
        });
        heaterSetpointInput.addEventListener('keydown', function(e){
          if (heaterSetpointInput.disabled) return;
          const step = parseFloat(heaterSetpointInput.step) || 0.1;
          const min = parseFloat(heaterSetpointInput.min);
          const max = parseFloat(heaterSetpointInput.max);
          let v = parseFloat(heaterSetpointInput.value);
          if (!Number.isFinite(v)) v = Number.isFinite(min) ? min : 0;
          if (e.key === 'ArrowUp') {
            v = v + step;
            if (Number.isFinite(max)) v = Math.min(max, v);
            if (Number.isFinite(min)) v = Math.max(min, v);
            heaterSetpointInput.value = v.toFixed(1);
            updateUI({ heaterSetpoint: v, _ts: Date.now() });
            e.preventDefault();
          } else if (e.key === 'ArrowDown') {
            v = v - step;
            if (Number.isFinite(max)) v = Math.min(max, v);
            if (Number.isFinite(min)) v = Math.max(min, v);
            heaterSetpointInput.value = v.toFixed(1);
            updateUI({ heaterSetpoint: v, _ts: Date.now() });
            e.preventDefault();
          } else if (e.key === 'Enter') {
            e.preventDefault();
            commitSetpointFromInput();
            heaterSetpointInput.blur();
          }
        });
        heaterSetpointInput.addEventListener('blur', function(){
          commitSetpointFromInput();
        });
      }
    }

    const secs = state.runTimeSec;
    Number.isFinite(secs) && runTimeEl && (runTimeEl.textContent = fmtTime(secs));
    const dist = state.runDistanceM;
    if (Number.isFinite(dist)) {
      if (dist >= 1000) {
        runDistanceEl && (runDistanceEl.textContent = (dist / 1000).toFixed(2));
        runDistanceUnitEl && (runDistanceUnitEl.textContent = "km");
      } else {
        runDistanceEl && (runDistanceEl.textContent = Math.max(0, dist).toFixed(0));
        runDistanceUnitEl && (runDistanceUnitEl.textContent = "m");
      }
      // append time-distance point (bounded)
      const tSec = secondsOfDay(now);
      if (Number.isFinite(tSec)) {
        const last = state.runSeries[state.runSeries.length - 1];
        if (!last || last.tSecOfDay !== tSec) {
          state.runSeries.push({ tSecOfDay: tSec, distM: Math.max(0, dist) });
          if (state.runSeries.length > 3600) state.runSeries.shift();
        } else {
          last.distM = Math.max(0, dist);
        }
      }
    }
    const spd = state.speedMS;
    Number.isFinite(spd) && runSpeedEl && (runSpeedEl.textContent = spd.toFixed(1));
    runSpeedUnitEl && (runSpeedUnitEl.textContent = "m/s");

    // activity classification
    const dtSec = Math.max(0, Math.min(10, Math.round(((d._ts || Date.now()) - (prev._ts || Date.now())) / 1000)) || 1);
    const isActive = Number.isFinite(spd) ? spd > 0.1 : false;
    state.currentActive = isActive;
    if (isActive) state.activeSec += dtSec; else state.sleepSec += dtSec;
    activeTimeEl && (activeTimeEl.textContent = fmtTime(state.activeSec));
    sleepTimeEl && (sleepTimeEl.textContent = fmtTime(state.sleepSec));
    if (currentStateEl) {
      currentStateEl.textContent = isActive ? "Active" : "Sleeping";
      currentStateEl.classList.remove("on", "off");
      currentStateEl.classList.add(isActive ? "on" : "off");
    }

    // render chart
    drawDrinkChart();
    drawRunChart();

    lastUpdateEl && (lastUpdateEl.textContent = "Last update: " + fmtNow(new Date(ts)));
  }

  window.hamsterUpdate = function (data) {
    updateUI(Object.assign({}, data, { _ts: Date.now() }));
  }

  setInterval(function () { nowEl && (nowEl.textContent = fmtNow(new Date())); }, 1000);

  function startMock() {
    let t = MOCK_TEMP_START;
    let ht = MOCK_HT_START;
    let on = false;
    let setp = MOCK_SETPOINT;
    let mode = "Auto";
    // Fixed mock values
    const fixedDrinkHourly = [0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 1, 0, 0, 0, 0, 1, 2, 3, 2, 1, 1, 0, 0, 0];
    const water = fixedDrinkHourly.reduce((a, b) => a + b, 0);
    let runSec = 2 * 3600; // fixed 2 hours active
    // Fixed cumulative distance points every 2 hours
    const fixedRunKm = [0, 0.2, 0.5, 0.9, 1.3, 1.6, 2.0, 2.4, 2.7, 3.1, 3.4, 3.8, 4.2];
    // Convert to meters and spread across day (every 2h)
    const fixedRunSeries = [];
    for (let i = 0; i < fixedRunKm.length; i++) {
      const tSecOfDay = i * 2 * 3600; // 0h,2h,...,24h
      const distM = Math.floor(fixedRunKm[i] * 1000);
      fixedRunSeries.push({ tSecOfDay, distM });
    }
    let dist = fixedRunSeries[fixedRunSeries.length - 1].distM;
    let speed = MOCK_SPEED_MS;
    // Set fixed values once; also pre-populate fixed chart data
    updateUI({ tempC: t, waterCc: water, heaterTemp: ht, heaterOn: on, heaterSetpoint: setp, heaterMode: mode, runTimeSec: runSec, runDistanceM: dist, speedMS: speed, _ts: Date.now() });
    // Populate state for charts and render once
    const now = new Date();
    state.dayKey = todayKey(now);
    state.drinkHourly = fixedDrinkHourly.slice(0, 24);
    state.runSeries = fixedRunSeries;
    drawDrinkChart();
    drawRunChart();
  }

  const qp = new URLSearchParams(location.search);
  if (qp.get("nomock") !== "1") startMock();
})();
