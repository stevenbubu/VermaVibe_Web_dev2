
function initContact(){
  const stage = document.getElementById('stage');
  stage.classList.add('scroll'); stage.style.touchAction='auto';
  const form = document.getElementById('contactForm'); if (!form) return;
  const nameEl=form.querySelector('#name'); const emailEl=form.querySelector('#email'); const countryEl=form.querySelector('#country'); const cropEl=form.querySelector('#crop'); const topicEl=form.querySelector('#topic'); const messageEl=form.querySelector('#message'); const replyTo=form.querySelector('input[name="_replyto"]'); const honeypot=form.querySelector('input[name="_hp"]'); const sendBtn=form.querySelector('#sendBtn');
  const statusEl = document.getElementById('status');
  function setStatus(msg){ if (!statusEl) return; if (!msg){ statusEl.classList.remove('show'); statusEl.textContent=''; return; } statusEl.innerHTML=msg; statusEl.classList.add('show'); clearTimeout(setStatus._t); setStatus._t=setTimeout(()=>setStatus(''),2400); }
  emailEl.addEventListener('input', ()=>{ replyTo.value = emailEl.value.trim(); });
  form.addEventListener('input', (e)=>{ const t=e.target; if (t.matches('input, select, textarea')){ t.setCustomValidity(''); t.checkValidity(); } });
  form.addEventListener('submit', async (e)=>{
    e.preventDefault(); if (honeypot.value) return;
    const name=nameEl.value.trim(); const email=emailEl.value.trim(); const country=countryEl.value.trim(); const crop=cropEl.value.trim(); const topic=topicEl.value.trim(); const message=messageEl.value.trim();
    const errors=[]; if (!name) errors.push('請填寫姓名'); if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push('Email 格式不正確'); if (!country) errors.push('請選擇國家'); if (!crop) errors.push('請填寫作物'); if (!topic) errors.push('請選擇主題'); if (!message) errors.push('請填寫訊息');
    if (errors.length){ setStatus(`<b>表單錯誤：</b> ${errors.join('、')}`); (function(){ let el=nameEl; if (!name) el=nameEl; else if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) el=emailEl; else if (!country) el=countryEl; else if (!crop) el=cropEl; else if (!topic) el=topicEl; else if (!message) el=messageEl; el.scrollIntoView({block:'start', inline:'nearest'}); el.focus({preventScroll:true}); })(); return; }
    const payload = new FormData(form); const subject = `VermaVibe Contact — [${topic}] ${name} (${country}, ${crop})`; payload.set('_subject', subject);
    sendBtn.disabled=true; sendBtn.style.opacity='0.7';
    try{
      const res = await fetch(form.action, { method:'POST', body:payload, headers:{Accept:'application/json'} });
      if (res.ok){ const msg='我們將盡快回覆您。'; location.hash = `#/result?status=success&msg=${encodeURIComponent(msg)}`; form.reset(); }
      else { let reason=res.statusText; try{ const err=await res.json(); if (err?.errors?.[0]?.message) reason=err.errors[0].message; }catch{} location.hash = `#/result?status=error&msg=${encodeURIComponent(reason)}`; }
    } catch(err){ location.hash = `#/result?status=error&msg=${encodeURIComponent(String(err))}`; }
    finally{ sendBtn.disabled=false; sendBtn.style.opacity='1'; }
  });
}
