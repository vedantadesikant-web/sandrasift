/* SANDRASIFT 360 camera module
 * Browser-only: camera frames stay on this device. Requires HTTPS or localhost.
 * The canvas is a preview composition, not calibrated automotive AVM stitching.
 */
(() => {
  'use strict';
  if (window.__SANDRASIFT_360__) return;
  window.__SANDRASIFT_360__ = true;

  const directions = [
    { key: 'front', label: 'FRONT', icon: '↑' },
    { key: 'rear', label: 'REAR', icon: '↓' },
    { key: 'left', label: 'LEFT', icon: '←' },
    { key: 'right', label: 'RIGHT', icon: '→' }
  ];
  const state = { devices: [], streams: new Map(), animation: 0, mirror: false, stopped: false };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  function build() {
    if (document.getElementById('ss360')) return;
    // Mount inside the existing tracker grid when available. Otherwise, mount
    // into a sensible page location instead of silently doing nothing.
    const app = document.getElementById('trackerApp');
    const grid = app && app.querySelector('.grid');
    const section = document.createElement('section');
    section.id = 'ss360';
    section.innerHTML = `
      <div class="ss360-card">
        <div class="ss360-head">
          <h2>360° SURROUND CAMERA SYSTEM</h2>
          <div class="ss360-actions">
            <button class="ss360-btn" id="ss360Refresh">FIND CAMERAS</button>
            <button class="ss360-btn" id="ss360Stop">STOP ALL</button>
            <button class="ss360-btn primary" id="ss360Connect">CONNECT SELECTED</button>
          </div>
        </div>
        <div class="ss360-body">
          <p class="ss360-notice">Prototype mode: connect up to four USB webcams. The top-view panel is a visual composite preview; true seamless 360° bird's-eye stitching requires camera calibration and perspective correction.</p>
          <div class="ss360-layout">
            <div class="ss360-cams">
              ${directions.map(d => `<article class="ss360-feed" data-cam="${d.key}">
                <div class="ss360-feedtop"><label><span>${d.icon}</span> ${d.label} CAMERA</label><span class="ss360-live" id="ss360State-${d.key}">OFFLINE</span></div>
                <div class="ss360-video-wrap"><video id="ss360Video-${d.key}" autoplay muted playsinline></video><div class="ss360-placeholder" id="ss360Placeholder-${d.key}"><b>${d.label} CAMERA</b><span>Choose a camera below, then connect</span></div></div>
                <div class="ss360-feedtop"><select id="ss360Select-${d.key}" aria-label="Select ${d.label.toLowerCase()} camera"><option value="">No camera selected</option></select><button class="ss360-btn" data-connect="${d.key}">CONNECT</button></div>
              </article>`).join('')}
            </div>
            <div class="ss360-side">
              <div class="ss360-preview"><div class="ss360-previewhead">SURROUND PREVIEW · TOP-DOWN COMPOSITE</div><canvas id="ss360Canvas" width="640" height="640" aria-label="Approximate composite preview from the four cameras"></canvas><div class="ss360-footnote">Live camera images are arranged around a schematic vehicle. This is not a calibrated or safety-certified surround-view system.</div></div>
              <div class="ss360-status">
                <div class="ss360-stat"><span>Available cameras</span><b id="ss360Count">Not scanned</b></div>
                <div class="ss360-stat"><span>Active feeds</span><b id="ss360Active">0 / 4</b></div>
                <div class="ss360-stat"><span>Permission</span><b id="ss360Permission">Not requested</b></div>
                <div class="ss360-stat"><span>Preview rate</span><b id="ss360Fps">-- FPS</b></div>
              </div>
              <label style="display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted,#7d898e)"><input type="checkbox" id="ss360Mirror"> Mirror left/right camera feeds</label>
              <div class="ss360-error" id="ss360Error" role="status" aria-live="polite"></div>
            </div>
          </div>
        </div>
      </div>`;
    if (grid && grid.parentNode) {
      grid.parentNode.insertBefore(section, grid);
    } else {
      const main = document.querySelector('main, #app, .app, .container, .wrap');
      const header = document.querySelector('header');
      if (main) {
        main.prepend(section);
      } else if (header && header.parentNode) {
        header.insertAdjacentElement('afterend', section);
      } else {
        document.body.prepend(section);
      }
    }
    $('ss360Refresh').addEventListener('click', scanCameras);
    $('ss360Connect').addEventListener('click', connectSelected);
    $('ss360Stop').addEventListener('click', stopAll);
    $('ss360Mirror').addEventListener('change', e => { state.mirror = e.target.checked; applyMirror(); });
    directions.forEach(d => $( `ss360Select-${d.key}`).addEventListener('change', () => {
      // Do not silently switch a live stream. User presses CONNECT explicitly.
    }));
    section.querySelectorAll('[data-connect]').forEach(btn => btn.addEventListener('click', () => connectOne(btn.dataset.connect)));
    drawIdleCanvas();
    scanCameras(false);
    state.animation = requestAnimationFrame(drawComposite);
  }
  function $(id) { return document.getElementById(id); }
  function setError(message = '') { $('ss360Error').textContent = message; }
  function secureContextOK() {
    return window.isSecureContext && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function';
  }
  async function scanCameras(showErrors = true) {
    setError('');
    if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
      $('ss360Count').textContent = 'Unsupported';
      if (showErrors) setError('This browser does not expose webcam devices. Try the latest Chrome or Edge over HTTPS.');
      return;
    }
    try {
      state.devices = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      $('ss360Count').textContent = String(state.devices.length);
      directions.forEach(dir => {
        const select = $(`ss360Select-${dir.key}`);
        const previous = select.value;
        select.innerHTML = '<option value="">No camera selected</option>' + state.devices.map((device, i) => `<option value="${esc(device.deviceId)}">${esc(device.label || `Camera ${i + 1}`)}</option>`).join('');
        if (state.devices.some(d => d.deviceId === previous)) select.value = previous;
        else if (state.devices[ directions.indexOf(dir) ]) select.value = state.devices[directions.indexOf(dir)].deviceId;
      });
      $('ss360Permission').textContent = state.devices.some(d => d.label) ? 'Granted' : 'Not granted';
      if (!state.devices.length && showErrors) setError('No webcams found. Connect a webcam and press FIND CAMERAS again.');
    } catch (err) {
      $('ss360Count').textContent = 'Unavailable';
      if (showErrors) setError(friendlyError(err));
    }
  }
  function friendlyError(err) {
    if (!window.isSecureContext) return 'Camera access requires HTTPS or localhost. GitHub Pages is supported.';
    if (err && err.name === 'NotAllowedError') return 'Camera permission was denied. Allow camera access in the browser address-bar settings, then retry.';
    if (err && err.name === 'NotFoundError') return 'No camera matched this selection. Re-scan the available devices.';
    if (err && err.name === 'NotReadableError') return 'The camera may be in use by another app. Close other camera apps and retry.';
    if (err && err.name === 'OverconstrainedError') return 'The selected camera cannot satisfy the requested settings. Try another camera.';
    return (err && err.message) ? `Camera error: ${err.message}` : 'Could not access the selected camera.';
  }
  async function connectSelected() {
    setError('');
    if (!secureContextOK()) { setError('Camera access requires HTTPS or localhost, plus a browser that supports getUserMedia.'); return; }
    let connected = 0;
    for (const d of directions) {
      if ($(`ss360Select-${d.key}`).value) {
        try { await connectOne(d.key, true); connected++; }
        catch (_) { /* connectOne displays the useful error */ }
      }
    }
    await scanCameras(false);
    updateCounts();
    if (!connected && !state.streams.size) setError('Choose at least one camera before connecting.');
  }
  async function connectOne(key, quiet = false) {
    const select = $(`ss360Select-${key}`);
    const deviceId = select.value;
    if (!deviceId) { if (!quiet) setError(`Select a device for the ${key} camera first.`); return false; }
    setError('');
    try {
      const old = state.streams.get(key);
      if (old) stopStream(key);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } } });
      const video = $(`ss360Video-${key}`);
      video.srcObject = stream;
      await video.play();
      state.streams.set(key, stream);
      $(`ss360Placeholder-${key}`).hidden = true;
      $(`ss360State-${key}`).textContent = 'LIVE';
      $(`ss360State-${key}`).classList.add('on');
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => { stopStream(key); setError(`${key.toUpperCase()} camera disconnected.`); }));
      $('ss360Permission').textContent = 'Granted';
      applyMirror(); updateCounts();
      return true;
    } catch (err) {
      if (!quiet) setError(`${key.toUpperCase()}: ${friendlyError(err)}`);
      throw err;
    }
  }
  function stopStream(key) {
    const stream = state.streams.get(key);
    if (stream) stream.getTracks().forEach(track => track.stop());
    state.streams.delete(key);
    const video = $(`ss360Video-${key}`);
    if (video) video.srcObject = null;
    const placeholder = $(`ss360Placeholder-${key}`);
    if (placeholder) placeholder.hidden = false;
    const status = $(`ss360State-${key}`);
    if (status) { status.textContent = 'OFFLINE'; status.classList.remove('on'); }
    updateCounts();
  }
  function stopAll() { directions.forEach(d => stopStream(d.key)); setError('All camera streams stopped.'); }
  function updateCounts() { $('ss360Active').textContent = `${state.streams.size} / 4`; }
  function applyMirror() {
    directions.forEach(d => { $(`ss360Video-${d.key}`).style.setProperty('--ss360-mirror', state.mirror && (d.key === 'left' || d.key === 'right') ? '-1' : '1'); });
  }
  function drawIdleCanvas() {
    const c = $('ss360Canvas'); if (!c) return;
    const x = c.getContext('2d'); x.fillStyle = '#070b0d'; x.fillRect(0,0,c.width,c.height);
    x.strokeStyle = '#1c2a30'; x.lineWidth = 1;
    for (let i=0;i<=640;i+=40) { x.beginPath(); x.moveTo(i,0); x.lineTo(i,640); x.stroke(); x.beginPath(); x.moveTo(0,i); x.lineTo(640,i); x.stroke(); }
    x.fillStyle = '#111c21'; x.strokeStyle = '#4a626c'; x.lineWidth = 3; x.beginPath(); x.roundRect(245,185,150,270,25); x.fill(); x.stroke();
    x.fillStyle = '#d8ed63'; x.font = 'bold 17px system-ui'; x.textAlign='center'; x.fillText('SANDRASIFT',320,315);
    x.fillStyle='#7d898e'; x.font='12px system-ui'; x.fillText('Connect cameras to preview',320,342);
    $('ss360Fps').textContent='-- FPS';
  }
  let lastFrameTime = 0, frameCount = 0, fpsTime = 0;
  function drawComposite(now = 0) {
    const canvas = $('ss360Canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W=canvas.width,H=canvas.height;
    ctx.fillStyle='#070b0d'; ctx.fillRect(0,0,W,H);
    // Approximate surround mosaic: front/rear occupy far/near strips; sides are narrow vertical strips.
    const panels = [
      { key:'front', x:150,y:0,w:340,h:180, label:'FRONT' },
      { key:'rear', x:150,y:460,w:340,h:180, label:'REAR' },
      { key:'left', x:0,y:180,w:150,h:280, label:'LEFT' },
      { key:'right', x:490,y:180,w:150,h:280, label:'RIGHT' }
    ];
    panels.forEach(p => {
      const v=$(`ss360Video-${p.key}`);
      ctx.save();
      ctx.beginPath(); ctx.rect(p.x,p.y,p.w,p.h); ctx.clip();
      if (v && v.readyState >= 2 && v.videoWidth) {
        const scale=Math.max(p.w/v.videoWidth,p.h/v.videoHeight);
        const sw=p.w/scale, sh=p.h/scale;
        const sx=(v.videoWidth-sw)/2, sy=(v.videoHeight-sh)/2;
        if (state.mirror && (p.key==='left'||p.key==='right')) { ctx.translate(p.x+p.w,p.y); ctx.scale(-1,1); ctx.drawImage(v,sx,sy,sw,sh,0,0,p.w,p.h); }
        else ctx.drawImage(v,sx,sy,sw,sh,p.x,p.y,p.w,p.h);
      } else {
        ctx.fillStyle='#10191d'; ctx.fillRect(p.x,p.y,p.w,p.h);
        ctx.fillStyle='#71848b'; ctx.font='bold 13px system-ui'; ctx.textAlign='center'; ctx.fillText(`${p.label} CAMERA`,p.x+p.w/2,p.y+p.h/2);
        ctx.font='11px system-ui'; ctx.fillText('OFFLINE',p.x+p.w/2,p.y+p.h/2+19);
      }
      ctx.restore();
      ctx.strokeStyle='#43bfff'; ctx.lineWidth=2; ctx.strokeRect(p.x+1,p.y+1,p.w-2,p.h-2);
    });
    // Vehicle silhouette is intentionally schematic; do not present it as a calibrated AVM.
    ctx.fillStyle='rgba(5,10,13,.94)'; ctx.strokeStyle='#d8ed63'; ctx.lineWidth=3;
    ctx.beginPath(); ctx.roundRect(245,185,150,270,22); ctx.fill(); ctx.stroke();
    ctx.fillStyle='#27353b'; ctx.fillRect(263,204,114,232);
    ctx.fillStyle='#d8ed63'; ctx.font='bold 16px system-ui'; ctx.textAlign='center'; ctx.fillText('SANDRASIFT',320,320);
    ctx.fillStyle='#9aabb1'; ctx.font='11px system-ui'; ctx.fillText('TOP VIEW',320,340);
    ctx.fillStyle='#d8ed63'; ctx.beginPath(); ctx.moveTo(320,194); ctx.lineTo(309,214); ctx.lineTo(331,214); ctx.closePath(); ctx.fill();
    ctx.strokeStyle='#1e343d'; ctx.lineWidth=2; ctx.strokeRect(0,0,W,H);
    if (now-lastFrameTime >= 1000) { $('ss360Fps').textContent = `${frameCount} FPS`; frameCount=0; lastFrameTime=now; }
    frameCount++;
    state.animation = requestAnimationFrame(drawComposite);
  }
  function teardown() { cancelAnimationFrame(state.animation); stopAll(); }
  window.addEventListener('pagehide', teardown, { once: true });
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', build, { once: true });
  } else {
    build();
  }
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', () => {
      if (document.getElementById('ss360')) scanCameras(false);
    });
  }
})();
