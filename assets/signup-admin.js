(() => {
  'use strict';
  const CFG = {
    url: 'https://jnomktahxycxtwnqmgdw.supabase.co',
    key: 'sb_publishable_Qu12Nz1BaQPIQMN7BgsHkw_etYyTjCX',
    domain: 'members.example.com',
    fn: 'signup-admin',
    loginUrl: 'https://se-connect.vercel.app'
  };

  const $ = s => document.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  const state = { session: null, requests: [] };

  function slug(v) {
    return String(v||'').trim().toLowerCase().replace(/@.*$/,'').replace(/[^a-z0-9._-]/g,'');
  }

  async function parse(r) {
    const text = await r.text();
    let d=null; try{d=text?JSON.parse(text):null}catch{d=text}
    if(!r.ok) throw new Error((d&&typeof d==='object'&&(d.msg||d.message||d.error_description||d.error))||d||`Request failed (${r.status})`);
    return d;
  }

  async function signIn(username,password) {
    const email = `${slug(username)}@${CFG.domain}`;
    const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=password`, {
      method:'POST',
      headers:{apikey:CFG.key,'Content-Type':'application/json'},
      body:JSON.stringify({email,password})
    });
    return parse(r);
  }

  async function callFn(body) {
    if(!state.session?.access_token) throw new Error('Please sign in again.');
    return parse(await fetch(`${CFG.url}/functions/v1/${CFG.fn}`, {
      method:'POST',
      headers:{
        apikey:CFG.key,
        Authorization:`Bearer ${state.session.access_token}`,
        'Content-Type':'application/json'
      },
      body:JSON.stringify(body)
    }));
  }

  function saveSession(s) {
    state.session=s;
    if(s) localStorage.setItem('se_signup_admin_session',JSON.stringify(s));
    else localStorage.removeItem('se_signup_admin_session');
  }

  function readSession() {
    try{return JSON.parse(localStorage.getItem('se_signup_admin_session')||'null')}catch{return null}
  }

  async function refreshSession() {
    if(!state.session?.refresh_token) return false;
    try {
      const r = await fetch(`${CFG.url}/auth/v1/token?grant_type=refresh_token`, {
        method:'POST',
        headers:{apikey:CFG.key,'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:state.session.refresh_token})
      });
      const d=await parse(r); saveSession(d); return true;
    } catch { saveSession(null); return false; }
  }

  async function safeCall(body) {
    try { return await callFn(body); }
    catch(e) {
      if(/jwt|token|unauthor/i.test(String(e.message||'')) && await refreshSession()) return callFn(body);
      throw e;
    }
  }

  function fmtDate(v) {
    try{return new Date(v).toLocaleString()}catch{return v||''}
  }

  function list(v) {
    return Array.isArray(v) ? v.join(', ') : (v || '—');
  }

  function render() {
    $('#pendingCount').textContent=state.requests.length;
    if(!state.requests.length) {
      $('#approvalList').innerHTML='<div class="empty-card"><span>✓</span><h2>No pending applications</h2><p>You are all caught up.</p></div>';
      return;
    }

    $('#approvalList').innerHTML=state.requests.map(r=>`<article class="admin-card approval-card" id="req-${r.id}">
      <div class="approval-top">
        <div>
          <h2>${esc(r.full_name)}</h2>
          <div class="approval-meta">${esc(r.real_email)} · requested username <b>${esc(r.preferred_username)}</b> · ${esc(fmtDate(r.created_at))}</div>
        </div>
        <span class="live-pill"><i></i> Pending</span>
      </div>

      <div class="detail-grid">
        <div class="detail"><strong>WhatsApp</strong><span>${esc(r.whatsapp||'—')}</span></div>
        <div class="detail"><strong>City / Country</strong><span>${esc(r.city_country||'—')}</span></div>
        <div class="detail full"><strong>Who am I</strong><span>${esc(r.who_am_i||'—')}</span></div>
        <div class="detail full"><strong>Building / obsessed with</strong><span>${esc(r.obsessed_building||'—')}</span></div>
        <div class="detail full"><strong>Can help with</strong><span>${esc(r.help_with||'—')}</span></div>
        <div class="detail full"><strong>Looking for</strong><span>${esc(r.looking_for||'—')}</span></div>
        <div class="detail"><strong>Current involvement</strong><span>${esc(r.involvement||'—')}</span></div>
        <div class="detail"><strong>Skills</strong><span>${esc(list(r.primary_skills))}</span></div>
        <div class="detail"><strong>Startup before?</strong><span>${esc(r.startup_before||'—')}</span></div>
        <div class="detail full"><strong>Startup / project details</strong><span>${esc(r.startup_details||'—')}</span></div>
        <div class="detail full"><strong>Remarks</strong><span>${esc(r.remarks||'—')}</span></div>
      </div>

      <div class="button-row">
        <button class="btn btn-primary" data-approve="${r.id}">Approve member</button>
        <button class="btn btn-ghost" data-reject="${r.id}">Reject</button>
      </div>
      <div id="msg-${r.id}"></div>
    </article>`).join('');

    document.querySelectorAll('[data-approve]').forEach(b=>b.addEventListener('click',()=>approve(b.dataset.approve)));
    document.querySelectorAll('[data-reject]').forEach(b=>b.addEventListener('click',()=>reject(b.dataset.reject)));
  }

  async function loadPending() {
    $('#dashboardStatus').textContent='Loading applications…';
    try {
      const d=await safeCall({action:'list_pending'});
      state.requests=d.requests||[];
      $('#dashboardStatus').textContent='';
      render();
    } catch(e) {
      $('#dashboardStatus').textContent=e.message;
    }
  }

  async function approve(id) {
    const r=state.requests.find(x=>x.id===id);
    if(!r) return;
    if(!confirm(`Approve ${r.full_name} as @${r.preferred_username}?`)) return;
    const msg=$(`#msg-${id}`);
    msg.innerHTML='<p class="status-message">Approving…</p>';
    try {
      const d=await safeCall({action:'approve',request_id:id});
      const text=`Your SE Connect application is approved ✅

Login: ${CFG.loginUrl}
Username: ${d.username}
Password: use the same password you created during signup.`;
      msg.innerHTML=`<div class="approval-message"><b>Approved.</b><br>${esc(text).replace(/\n/g,'<br>')}<div class="button-row"><button class="btn btn-ghost" id="copy-${id}">Copy approval message</button></div></div>`;
      $(`#copy-${id}`).addEventListener('click',async()=>{try{await navigator.clipboard.writeText(text);$(`#copy-${id}`).textContent='Copied ✓'}catch{}});
      state.requests=state.requests.filter(x=>x.id!==id);
      $('#pendingCount').textContent=state.requests.length;
    } catch(e) {
      msg.innerHTML=`<p class="error-text">${esc(e.message)}</p>`;
    }
  }

  async function reject(id) {
    const r=state.requests.find(x=>x.id===id);
    if(!r) return;
    const reason=prompt(`Reason for rejecting ${r.full_name}? (optional)`,'');
    if(reason===null) return;
    const msg=$(`#msg-${id}`);
    msg.innerHTML='<p class="status-message">Rejecting…</p>';
    try {
      await safeCall({action:'reject',request_id:id,reason});
      state.requests=state.requests.filter(x=>x.id!==id);
      render();
    } catch(e) {
      msg.innerHTML=`<p class="error-text">${esc(e.message)}</p>`;
    }
  }

  $('#adminLoginForm').addEventListener('submit',async e=>{
    e.preventDefault();
    $('#adminLoginBtn').disabled=true;
    $('#adminLoginStatus').textContent='Signing in…';
    try {
      const s=await signIn($('#adminUsername').value,$('#adminPassword').value);
      saveSession(s);
      $('#loginPanel').classList.add('hidden');
      $('#dashboard').classList.remove('hidden');
      await loadPending();
    } catch(e) {
      $('#adminLoginStatus').textContent=e.message;
    } finally {
      $('#adminLoginBtn').disabled=false;
    }
  });

  $('#refreshBtn').addEventListener('click',loadPending);
  $('#signOutBtn').addEventListener('click',()=>{saveSession(null);location.reload()});

  (async()=>{
    const s=readSession();
    if(!s) return;
    state.session=s;
    try {
      $('#loginPanel').classList.add('hidden');
      $('#dashboard').classList.remove('hidden');
      await loadPending();
    } catch {
      saveSession(null);
      $('#dashboard').classList.add('hidden');
      $('#loginPanel').classList.remove('hidden');
    }
  })();
})();
