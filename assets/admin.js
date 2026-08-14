(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabaseKey && !cfg.supabaseUrl.includes('PASTE_') && !cfg.supabaseKey.includes('PASTE_');
  const setupNotice = document.getElementById('adminSetupNotice');
  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('dashboard');
  let sb = null;
  let fieldsCache = [];
  let submissionsCache = [];

  if (!configured) {
    setupNotice.classList.remove('hidden');
    loginPanel.classList.add('hidden');
    return;
  }
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  const esc = (v='') => String(v).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
  const loginError = document.getElementById('loginError');
  const settingsMessage = document.getElementById('settingsMessage');

  async function isAdmin() {
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return false;
    const { data, error } = await sb.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle();
    return !error && !!data;
  }

  async function routeAuth() {
    if (await isAdmin()) {
      loginPanel.classList.add('hidden');
      dashboard.classList.remove('hidden');
      await loadDashboard();
    } else {
      dashboard.classList.add('hidden');
      loginPanel.classList.remove('hidden');
    }
  }

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault(); loginError.textContent = '';
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) { loginError.textContent = error.message; return; }
    if (!(await isAdmin())) {
      await sb.auth.signOut();
      loginError.textContent = 'This account is not listed in admin_users.';
      return;
    }
    await routeAuth();
  });

  document.getElementById('logoutBtn').addEventListener('click', async () => { await sb.auth.signOut(); await routeAuth(); });

  async function loadDashboard() {
    const [{ data: settings }, { data: fields }, { data: submissions, count }] = await Promise.all([
      sb.from('app_settings').select('*').eq('id','main').maybeSingle(),
      sb.from('form_fields').select('*').order('sort_order'),
      sb.from('submissions').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(250)
    ]);

    fieldsCache = fields || [];
    submissionsCache = submissions || [];
    document.getElementById('responseCount').textContent = count ?? submissionsCache.length;
    document.getElementById('questionCount').textContent = fieldsCache.length;
    document.getElementById('statusText').textContent = settings?.active === false ? 'Paused' : 'Open';
    document.getElementById('settingBrand').value = settings?.brand_name || "Let's Match";
    document.getElementById('settingTitle').value = settings?.title || '';
    document.getElementById('settingDescription').value = settings?.description || '';
    document.getElementById('settingActive').checked = settings?.active !== false;
    renderQuestions();
    renderResponses();
  }

  function renderQuestions() {
    const root = document.getElementById('questionList');
    if (!fieldsCache.length) { root.innerHTML = '<p class="muted">No questions found. Re-run the SQL migration.</p>'; return; }
    root.innerHTML = fieldsCache.map((q,i) => `<article class="schema-row"><span class="schema-index">${i+1}</span><div><strong>${esc(q.label)}</strong><small>${esc(q.field_type)}${q.required ? ' • required' : ' • optional'}${q.options?.length ? ` • ${q.options.length} options` : ''}</small></div></article>`).join('');
  }

  function flattenAnswer(answer) {
    if (Array.isArray(answer)) return answer.join(' | ');
    if (answer && typeof answer === 'object') return JSON.stringify(answer);
    return answer ?? '';
  }

  function renderResponses() {
    const body = document.querySelector('#responsesTable tbody');
    if (!submissionsCache.length) { body.innerHTML = '<tr><td colspan="2">No submissions yet.</td></tr>'; return; }
    body.innerHTML = submissionsCache.map(row => {
      const summary = Object.entries(row.answers || {}).map(([k,v]) => `<div class="answer-line"><strong>${esc(k)}</strong><span>${esc(flattenAnswer(v))}</span></div>`).join('');
      return `<tr><td class="date-cell">${new Date(row.created_at).toLocaleString()}</td><td>${summary}</td></tr>`;
    }).join('');
  }

  document.getElementById('settingsForm').addEventListener('submit', async e => {
    e.preventDefault(); settingsMessage.textContent = 'Saving…';
    const payload = {
      id: 'main',
      brand_name: document.getElementById('settingBrand').value.trim(),
      title: document.getElementById('settingTitle').value.trim(),
      description: document.getElementById('settingDescription').value.trim(),
      active: document.getElementById('settingActive').checked,
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from('app_settings').upsert(payload);
    settingsMessage.textContent = error ? error.message : 'Saved ✓';
    if (!error) await loadDashboard();
  });

  document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

  document.getElementById('exportBtn').addEventListener('click', () => {
    if (!submissionsCache.length) return;
    const labels = fieldsCache.map(f => f.label);
    const extraLabels = [...new Set(submissionsCache.flatMap(r => Object.keys(r.answers || {})))].filter(l => !labels.includes(l));
    const columns = [...labels, ...extraLabels];
    const rows = [['created_at', ...columns], ...submissionsCache.map(r => [r.created_at, ...columns.map(l => flattenAnswer(r.answers?.[l]))])];
    const csv = rows.map(row => row.map(v => `"${String(v ?? '').replaceAll('"','""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `community-responses-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  routeAuth();
})();
