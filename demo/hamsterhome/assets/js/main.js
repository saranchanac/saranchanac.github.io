 (function(){
   const $ = id => document.getElementById(id);
   const nowEl = $("now");
   const lastUpdateEl = $("lastUpdate");
   const tempEl = $("tempC");
   const tempBar = $("tempBar");
   const tempComfort = $("tempComfort");
   const waterEl = $("waterCc");
   const waterBar = $("waterBar");
   const heaterTempEl = $("heaterTemp");
   const heaterStatusEl = $("heaterStatus");
   const heaterSetpointEl = $("heaterSetpoint");
   const heaterModeEl = $("heaterMode");
   const runTimeEl = $("runTime");
   const runDistanceEl = $("runDistance");
   const runDistanceUnitEl = $("runDistanceUnit");
   const runSpeedEl = $("runSpeed");
   const runSpeedUnitEl = $("runSpeedUnit");

   function clamp(n,min,max){return Math.max(min,Math.min(max,n));}
   function setBar(el, pct){ if(el){ el.style.width = clamp(pct,0,100).toFixed(0)+"%"; } }
   function pad(n){return n<10?"0"+n:""+n}
   function fmtNow(d){return d.getFullYear()+"-"+pad(d.getMonth()+1)+"-"+pad(d.getDate())+" "+pad(d.getHours())+":"+pad(d.getMinutes())+":"+pad(d.getSeconds())}
   function fmtTime(sec){sec=Math.max(0,Math.floor(sec));const h=Math.floor(sec/3600), m=Math.floor((sec%3600)/60), s=sec%60;return pad(h)+":"+pad(m)+":"+pad(s)}
   function comfortForTemp(c){ if(c<18) return "Cold"; if(c>28) return "Hot"; return "Comfort" }
   function setHeaterStatus(on){
     if(!heaterStatusEl) return;
     heaterStatusEl.textContent = on?"ON":"OFF";
     heaterStatusEl.classList.remove("on","off");
     heaterStatusEl.classList.add(on?"on":"off");
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
     _ts: Date.now()
   };

   function updateUI(d){
     state = Object.assign({}, state, d);
     const t = state.tempC;
     if(Number.isFinite(t)){
       tempEl && (tempEl.textContent = t.toFixed(1));
       const pct = (t-10)/(35-10)*100;
       setBar(tempBar, pct);
       tempComfort && (tempComfort.textContent = comfortForTemp(t));
     }
     const w = state.waterCc;
     if(Number.isFinite(w)){
       waterEl && (waterEl.textContent = Math.max(0,w).toFixed(0));
       setBar(waterBar, (w/20)*100);
     }
     const ht = state.heaterTemp;
     if(Number.isFinite(ht)) heaterTempEl && (heaterTempEl.textContent = ht.toFixed(1));
     if(Number.isFinite(state.heaterSetpoint)) heaterSetpointEl && (heaterSetpointEl.textContent = state.heaterSetpoint.toFixed(1)+" °C");
     if(typeof state.heaterMode === "string") heaterModeEl && (heaterModeEl.textContent = state.heaterMode);
     setHeaterStatus(!!state.heaterOn);

     const secs = state.runTimeSec;
     Number.isFinite(secs) && runTimeEl && (runTimeEl.textContent = fmtTime(secs));
     const dist = state.runDistanceM;
     if(Number.isFinite(dist)){
       if(dist>=1000){
         runDistanceEl && (runDistanceEl.textContent = (dist/1000).toFixed(2));
         runDistanceUnitEl && (runDistanceUnitEl.textContent = "km");
       } else {
         runDistanceEl && (runDistanceEl.textContent = Math.max(0,dist).toFixed(0));
         runDistanceUnitEl && (runDistanceUnitEl.textContent = "m");
       }
     }
     const spd = state.speedMS;
     Number.isFinite(spd) && runSpeedEl && (runSpeedEl.textContent = spd.toFixed(1));
     runSpeedUnitEl && (runSpeedUnitEl.textContent = "m/s");

     const ts = d._ts || Date.now();
     lastUpdateEl && (lastUpdateEl.textContent = "Last update: "+fmtNow(new Date(ts)));
   }

   window.hamsterUpdate = function(data){
     updateUI(Object.assign({}, data, {_ts: Date.now()}));
   }

   setInterval(function(){ nowEl && (nowEl.textContent = fmtNow(new Date())); }, 1000);

   function startMock(){
     let t = 24 + (Math.random()*2-1);
     let ht = 30 + (Math.random()*2-1);
     let on = false;
     let setp = 28.0;
     let mode = "Auto";
     let water = 0;
     let runSec = 0;
     let dist = 0;
     let speed = 0;
     updateUI({tempC:t, waterCc:water, heaterTemp:ht, heaterOn:on, heaterSetpoint:setp, heaterMode:mode, runTimeSec:runSec, runDistanceM:dist, speedMS:speed, _ts: Date.now()});
     setInterval(function(){
       const dt = 1;
       const ambientDrift = (Math.random()*0.06-0.03);
       t += ambientDrift + (on?0.04:-0.02);
       if(t<setp-0.8) on = true; else if(t>setp+0.5) on = false;
       ht += (on?0.08:-0.05) + (Math.random()*0.1-0.05);
       water += Math.random()<0.2 ? (Math.random()*0.8) : 0;
       const running = Math.random()<0.6;
       speed = running ? Math.max(0, Math.min(2.5, speed + (Math.random()*0.6-0.3))) : Math.max(0, speed - 0.4);
       if(running || speed>0.1){
         runSec += dt;
         dist += speed*dt;
       }
       updateUI({tempC:t, waterCc:water, heaterTemp:ht, heaterOn:on, heaterSetpoint:setp, heaterMode:mode, runTimeSec:runSec, runDistanceM:dist, speedMS:speed, _ts: Date.now()});
     }, 1000);
   }

   const qp = new URLSearchParams(location.search);
   if(qp.get("nomock") !== "1") startMock();
 })();
