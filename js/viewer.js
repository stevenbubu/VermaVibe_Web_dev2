
(function(){
  const MIN_SCALE = 1, MAX_SCALE = 6;
  const DOUBLE_TAP_MS = 300;
  const DOUBLE_TAP_TARGET_SCALE = 2.5;
  const ZOOM_ANIM_MS = 220;
  const WHEEL_ZOOM_FACTOR = 1.1;
  const EPS = 0.2;
  const isTouchDevice = navigator.maxTouchPoints > 0;
  const CLICK_THRESHOLD_PX = isTouchDevice ? 22 : 10;
  const CLICK_THRESHOLD_PY = isTouchDevice ? 22 : 10;
  const TAP_DURATION_MS = 250;
  const SWIPE_MIN_PX = isTouchDevice ? 48 : 36;
  const SWIPE_MIN_VELOCITY = 0.35;
  const INERTIA_MIN_SPEED = 0.02;
  const INERTIA_FRICTION = 0.5;
  const BOUNCE_COEFF = 0.1;
  const PAN_HISTORY_MS = 120;

  let images = [];
  let idx = 0;
  let scale = 1;
  let tx = 0, ty = 0;
  let rafId = null;
  let viewportW = 0, viewportH = 0;
  let baseW = 0, baseH = 0;
  let baseLx = 0, baseLy = 0;
  const pointers = new Map();
  let dragStart = null;
  let stageDragStart = null;
  let tapStartX = null, tapStartY = null, tapStartTime = 0;
  let lastMoveX = null, lastMoveY = null, lastMoveTime = 0;
  let recomputeTimer = null;
  let viewportDirty = false;
  let panAnimId = null; let panHistory = [];
  let zoomAnimId = null; let lastTap = 0; let tapTimer = null;
  const albumCache = new Map();

  let viewer, stage, statusEl;

  function setStatus(msg, keep=false){
    if (!statusEl) return;
    if (!msg) { statusEl.classList.remove('show'); statusEl.textContent=''; return; }
    statusEl.innerHTML = msg; statusEl.classList.add('show');
    if (!keep) { clearTimeout(setStatus._t); setStatus._t = setTimeout(()=>setStatus(''), 2400); }
  }
  const clamp = (v,min,max)=>Math.min(max, Math.max(min, v));
  const nowMs = ()=>performance.now();
  function cancelSingleTap(){ if (tapTimer){ clearTimeout(tapTimer); tapTimer=null; } }
  function scheduleSingleTap(clientX){ cancelSingleTap(); tapTimer = setTimeout(()=>{ tapTimer=null; handlePositionalClick(clientX); }, DOUBLE_TAP_MS+30); }
  function stopPanInertia(){ if (panAnimId) cancelAnimationFrame(panAnimId); panAnimId=null; }
  function stopZoomAnim(){ if (zoomAnimId) cancelAnimationFrame(zoomAnimId); zoomAnimId=null; }
  function updateViewport(){ const vv = window.visualViewport; if (vv && vv.width && vv.height){ viewportW = vv.width; viewportH = vv.height; } else { const r = stage.getBoundingClientRect(); viewportW = r.width; viewportH = r.height; } }
  function computeContain(nw, nh){ const imgRatio=nw/nh, stageRatio=viewportW/viewportH; if (imgRatio>stageRatio) return {w:viewportW, h: viewportW/imgRatio}; return {h:viewportH, w: viewportH*imgRatio}; }
  function computeBaseTopLeft(){ baseLx=(viewportW-baseW)/2; baseLy=(viewportH-baseH)/2; }
  function clientToImagePoint(clientX, clientY){ const ix=(clientX - baseLx - tx)/scale; const iy=(clientY - baseLy - ty)/scale; return { x: clamp(ix,0,baseW), y: clamp(iy,0,baseH) }; }
  function getPanBounds(){ const contentW=baseW*scale, contentH=baseH*scale; let minTx, maxTx, minTy, maxTy; if (contentW>viewportW){ minTx=viewportW - baseLx - contentW - EPS; maxTx=-baseLx + EPS; } else { const txCenter=(-baseW*(scale-1))/2; minTx=maxTx=txCenter; } if (contentH>viewportH){ minTy=viewportH - baseLy - contentH - EPS; maxTy=-baseLy + EPS; } else { const tyCenter=(-baseH*(scale-1))/2; minTy=maxTy=tyCenter; } return {minTx,maxTx,minTy,maxTy}; }
  function commit(needsClamp=true){ if (needsClamp){ const {minTx,maxTx,minTy,maxTy} = getPanBounds(); tx=clamp(tx, minTx, maxTx); ty=clamp(ty, minTy, maxTy); } if (rafId) return; rafId = requestAnimationFrame(()=>{ viewer.style.transform = `translate3d(${tx}px, ${ty}px, 0) scale(${scale})`; const ta = scale===1 ? 'pan-y' : 'none'; viewer.style.touchAction = ta; stage.style.touchAction = ta; rafId=null; }); }
  function preventNativeIfZooming(e){ if (scale>1) e.preventDefault?.(); }
  function recomputeBaseSize(){ updateViewport(); const nw = viewer.naturalWidth || viewer.width || viewer.offsetWidth; const nh = viewer.naturalHeight || viewer.height || viewer.offsetHeight; if (!nw || !nh || !viewportW || !viewportH) return; const s = computeContain(nw, nh); baseW=s.w; baseH=s.h; viewer.style.width=`${baseW}px`; viewer.style.height=`${baseH}px`; computeBaseTopLeft(); commit(true); }
  function isInteracting(){ return pointers.size>0 || !!stageDragStart || scale>1 || !!panAnimId || !!zoomAnimId; }
  function scheduleRecompute(delay=480){ clearTimeout(recomputeTimer); if (isInteracting()){ viewportDirty=true; return; } viewportDirty=false; recomputeTimer=setTimeout(recomputeBaseSize, delay); }
  function tryRecomputeAfterInteraction(){ if (viewportDirty && !isInteracting()) scheduleRecompute(200); }
  function padNumber(n,pad){ return pad ? String(n).padStart(pad,'0') : String(n); }
  function buildFallbackList(album){ const { folder, count, ext, pad=0 } = album; return Array.from({length:count}, (_,i)=>`${folder}/${padNumber(i+1,pad)}.${ext}`); }
  function canFetchManifest(){ return location.protocol==='http:' || location.protocol==='https:'; }
  async function loadAlbumList(key){ const album = window.ALBUMS?.[key]; if (!album) throw new Error('Unknown album: '+key); if (album.type==='form') return []; if (albumCache.has(key)) return albumCache.get(key);
    if (album.manifest && canFetchManifest()){ const url = `${album.folder}/${album.manifest}?v=${Date.now()}`; try{ const res = await fetch(url, {cache:'no-store'}); if (res.ok){ const data = await res.json(); const files = Array.isArray(data) ? data : (data && Array.isArray(data.files) ? data.files : null); if (files && files.length){ const list = files.map((name)=>`${album.folder}/${name}`); albumCache.set(key, list); return list; } } else { setStatus(`manifest 讀取失敗（HTTP ${res.status}），改用 fallback`, false); } } catch { setStatus('manifest fetch 失敗，改用 fallback', false); } } else if (album.manifest && !canFetchManifest()) { setStatus('目前是 file:// 開啟，跳過 manifest，使用 count fallback（建議用本機伺服器）', false); }
    const fallback = buildFallbackList(album); albumCache.set(key, fallback); return fallback;
  }
  function show(i){ stopPanInertia(); stopZoomAnim(); cancelSingleTap(); if (!images.length) return; idx = (i + images.length) % images.length; scale=1; tx=0; ty=0; const url = images[idx]; viewer.style.opacity='0'; viewer.style.transition='opacity 260ms ease'; viewer.src=url; viewer.alt = `VermaVibe 技術展示圖片 ${idx+1}`; viewer.onload = ()=>{ const waitNatural = ()=>{ if (!viewer.naturalWidth || !viewer.naturalHeight){ requestAnimationFrame(waitNatural); return; } recomputeBaseSize(); requestAnimationFrame(()=>{ viewer.style.opacity='1'; }); }; waitNatural(); }; viewer.onerror = ()=>{ setStatus(`Image failed to load：<span class=\"muted\">${url}</span>`, true); viewer.style.opacity='1'; };
    const pre = new Image(); pre.decoding='async'; pre.loading='lazy'; pre.src = images[(idx+1)%images.length];
  }
  function handlePositionalClick(clientX){ if (scale!==1) return; const leftHalf = clientX < viewportW/2; show(leftHalf ? idx-1 : idx+1); }
  function zoomAtPoint(targetScale, clientX, clientY){ const s1 = clamp(targetScale, MIN_SCALE, MAX_SCALE); const p = clientToImagePoint(clientX, clientY); tx = clientX - baseLx - p.x * s1; ty = clientY - baseLy - p.y * s1; scale = s1; commit(true); }
  function zoomAtCenter(targetScale){ updateViewport(); zoomAtPoint(targetScale, viewportW/2, viewportH/2); }
  function easeOutCubic(t){ return 1 - Math.pow(1 - t, 3); }
  function animateZoomAtCenter(targetScale, duration=ZOOM_ANIM_MS){ stopZoomAnim(); updateViewport(); const startScale=scale, cX=viewportW/2, cY=viewportH/2; const p=clientToImagePoint(cX,cY); const sTarget = clamp(targetScale, MIN_SCALE, MAX_SCALE); const t0=nowMs(); const step=()=>{ const dt = Math.min(1, (nowMs()-t0)/duration); const s = startScale + (sTarget-startScale) * easeOutCubic(dt); tx = cX - baseLx - p.x * s; ty = cY - baseLy - p.y * s; scale=s; commit(true); if (dt<1) zoomAnimId = requestAnimationFrame(step); else { stopZoomAnim(); commit(true);} }; step(); }
  function recordPanHistory(px,py){ const t=nowMs(); panHistory.push({x:px,y:py,t}); const cutoff=t-PAN_HISTORY_MS; while (panHistory.length && panHistory[0].t < cutoff) panHistory.shift(); }
  function computePanVelocity(){ if (panHistory.length<2) return {vx:0, vy:0}; const a=panHistory[0], b=panHistory[panHistory.length-1]; const dt=Math.max(1, b.t-a.t); return { vx:(b.x-a.x)/dt, vy:(b.y-a.y)/dt }; }
  function startPanInertia(vx,vy){ stopPanInertia(); let lastTs=nowMs(); const step=()=>{ const ts=nowMs(); const dt=Math.max(1, ts-lastTs); lastTs=ts; const decay=Math.pow(INERTIA_FRICTION, dt/16); vx*=decay; vy*=decay; tx+=vx*dt; ty+=vy*dt; const {minTx,maxTx,minTy,maxTy} = getPanBounds(); if (tx<minTx && vx<0){ tx=minTx; vx*=-BOUNCE_COEFF; } if (tx>maxTx && vx>0){ tx=maxTx; vx*=-BOUNCE_COEFF; } if (ty<minTy && vy<0){ ty=minTy; vy*=-BOUNCE_COEFF; } if (ty>maxTy && vy>0){ ty=maxTy; vy*=-BOUNCE_COEFF; } commit(false); const small = Math.abs(vx)<INERTIA_MIN_SPEED && Math.abs(vy)<INERTIA_MIN_SPEED; const inside = tx>=minTx && tx<=maxTx && ty>=minTy; if (small && inside){ stopPanInertia(); commit(true); return; } panAnimId = requestAnimationFrame(step); }; panAnimId = requestAnimationFrame(step); }

  function bindEvents(){
    const stageEl = stage;
    viewer.addEventListener('pointerdown', (e)=>{
      stopPanInertia(); pointers.set(e.pointerId, {x:e.clientX, y:e.clientY, type:e.pointerType}); try{ viewer.setPointerCapture(e.pointerId);}catch{}
      const tNow=nowMs(); if (e.pointerType==='touch' && tNow - lastTap < DOUBLE_TAP_MS){ cancelSingleTap(); animateZoomAtCenter(scale>1?1:DOUBLE_TAP_TARGET_SCALE); lastTap=0; e.preventDefault?.(); e.stopPropagation?.(); return; } lastTap = e.pointerType==='touch' ? tNow : 0;
      if (scale>1){ dragStart = {x:e.clientX, y:e.clientY, tx0:tx, ty0:ty}; panHistory.length=0; recordPanHistory(e.clientX, e.clientY); }
    }, {passive:false});
    viewer.addEventListener('pointermove', (e)=>{
      if (!pointers.has(e.pointerId)) return; preventNativeIfZooming(e); pointers.set(e.pointerId, {x:e.clientX,y:e.clientY,type:e.pointerType}); if (scale>1 && dragStart){ tx = dragStart.tx0 + (e.clientX - dragStart.x); ty = dragStart.ty0 + (e.clientY - dragStart.y); recordPanHistory(e.clientX, e.clientY); commit(true); }
    }, {passive:false});
    viewer.addEventListener('pointerup', (e)=>{
      pointers.delete(e.pointerId); try{ viewer.releasePointerCapture(e.pointerId);}catch{} if (scale>1 && dragStart){ const {vx,vy}=computePanVelocity(); if (Math.abs(vx)>=INERTIA_MIN_SPEED || Math.abs(vy)>=INERTIA_MIN_SPEED) startPanInertia(vx,vy); } dragStart=null; commit(true); scheduleRecompute(); tryRecomputeAfterInteraction();
    });
    viewer.addEventListener('pointercancel', ()=>{ pointers.clear(); dragStart=null; commit(true); scheduleRecompute(); tryRecomputeAfterInteraction(); });
    stageEl.addEventListener('pointerdown', (e)=>{
      stopPanInertia(); pointers.set(e.pointerId, {x:e.clientX, y:e.clientY, type:e.pointerType}); if (scale>1){ stageDragStart = {x:e.clientX,y:e.clientY, tx0:tx, ty0:ty}; panHistory.length=0; recordPanHistory(e.clientX, e.clientY); try{ stageEl.setPointerCapture(e.pointerId);}catch{} return; } if (e.buttons && e.buttons!==1) return; tapStartX=e.clientX; tapStartY=e.clientY; tapStartTime=nowMs(); lastMoveX=tapStartX; lastMoveY=tapStartY; lastMoveTime=tapStartTime; }, {passive:false});
    stageEl.addEventListener('pointermove', (e)=>{ preventNativeIfZooming(e); if (scale>1 && stageDragStart){ tx = stageDragStart.tx0 + (e.clientX - stageDragStart.x); ty = stageDragStart.ty0 + (e.clientY - stageDragStart.y); recordPanHistory(e.clientX, e.clientY); commit(true); return; } lastMoveX=e.clientX; lastMoveY=e.clientY; lastMoveTime=nowMs(); }, {passive:false});
    stageEl.addEventListener('pointerup', (e)=>{ pointers.delete(e.pointerId); if (scale>1){ const {vx,vy}=computePanVelocity(); if (Math.abs(vx)>=INERTIA_MIN_SPEED || Math.abs(vy)>=INERTIA_MIN_SPEED) startPanInertia(vx,vy); stageDragStart=null; try{ stageEl.releasePointerCapture(e.pointerId);}catch{} scheduleRecompute(); tryRecomputeAfterInteraction(); return; } const endX=e.clientX, endY=e.clientY, endTime=nowMs(); const dx = endX - (tapStartX ?? endX); const dy = endY - (tapStartY ?? endY); const dt = endTime - (tapStartTime || endTime); const mvDt=Math.max(1, endTime-(lastMoveTime || endTime)); const mvDx=endX - (lastMoveX ?? endX); const velocityX=Math.abs(mvDx)/mvDt; const absDx=Math.abs(dx), absDy=Math.abs(dy); const isSwipe = absDx>SWIPE_MIN_PX && absDx>absDy*1.5 && velocityX>=SWIPE_MIN_VELOCITY; if (isSwipe){ cancelSingleTap(); show(dx<0 ? idx+1 : idx-1); } else { const isTap = absDx<=CLICK_THRESHOLD_PX && absDy<=CLICK_THRESHOLD_PY && dt<=TAP_DURATION_MS; if (isTap){ if (e.pointerType==='touch') scheduleSingleTap(endX); else handlePositionalClick(endX); } } tapStartX=tapStartY=null; tapStartTime=0; lastMoveX=lastMoveY=null; lastMoveTime=0; });
    stageEl.addEventListener('pointercancel', ()=>{ pointers.clear(); stageDragStart=null; tapStartX=tapStartY=null; tapStartTime=0; lastMoveX=lastMoveY=null; lastMoveTime=0; cancelSingleTap(); scheduleRecompute(); tryRecomputeAfterInteraction(); });
    stageEl.addEventListener('contextmenu', (e)=>e.preventDefault());
    stageEl.addEventListener('wheel', (e)=>{ if (e.ctrlKey){ e.preventDefault(); const factor = Math.sign(e.deltaY)>0 ? 1/WHEEL_ZOOM_FACTOR : WHEEL_ZOOM_FACTOR; zoomAtCenter(clamp(scale*factor, MIN_SCALE, MAX_SCALE)); } }, {passive:false});
    document.addEventListener('keydown', (e)=>{ const k=e.key; if (k==='ArrowLeft'){ e.preventDefault(); show(idx-1);} else if (k==='ArrowRight'){ e.preventDefault(); show(idx+1);} else if (k==='Home'){ e.preventDefault(); show(0);} else if (k==='End'){ e.preventDefault(); show(images.length-1);} else if (k===' '){ e.preventDefault(); show(idx+1);} else if (k.toLowerCase()==='r'){ e.preventDefault(); scale=1; tx=0; ty=0; commit(true);} else if (k==='+' || k==='='){ e.preventDefault(); zoomAtCenter(clamp(scale*WHEEL_ZOOM_FACTOR, MIN_SCALE, MAX_SCALE)); } else if (k==='-' || k==='_'){ e.preventDefault(); zoomAtCenter(clamp(scale/WHEEL_ZOOM_FACTOR, MIN_SCALE, MAX_SCALE)); } });
    function onViewportChange(){ viewportDirty=true; scheduleRecompute(); }
    window.addEventListener('resize', onViewportChange);
    window.addEventListener('orientationchange', onViewportChange);
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onViewportChange);
  }

  async function initViewer(albumKey){
    stage = document.getElementById('stage');
    statusEl = document.getElementById('status');
    stage.classList.remove('scroll'); stage.style.touchAction='pan-y';
    const current = document.getElementById('viewer');
    if (!current){ stage.innerHTML = '<img id="viewer" class="slide" alt="VermaVibe 圖片檢視器" decoding="async" fetchpriority="high" />'; }
    viewer = document.getElementById('viewer');
    const album = window.ALBUMS?.[albumKey];
    images = await (async ()=>{
      if (!album) return [];
      if (album.manifest){ try{ const res = await fetch(`${album.folder}/${album.manifest}?v=${Date.now()}`, {cache:'no-store'}); if (res.ok){ const data = await res.json(); const files = Array.isArray(data) ? data : (data && Array.isArray(data.files) ? data.files : null); if (files && files.length) return files.map(n=>`${album.folder}/${n}`); } }catch{} }
      return Array.from({length: album?.count || 0}, (_,i)=>`${album.folder}/${i+1}.${album.ext}`);
    })();
    bindEvents();
    show(0);
  }

  window.initViewer = initViewer;
})();
