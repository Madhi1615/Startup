(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = Boolean(
    cfg.supabaseUrl &&
    cfg.supabaseKey &&
    !cfg.supabaseUrl.includes('PASTE_') &&
    !cfg.supabaseKey.includes('PASTE_')
  );

  const setupNotice = document.getElementById('adminSetupNotice');
  const loginPanel = document.getElementById('loginPanel');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const loginButton = loginForm?.querySelector('button[type="submit"]');
  const settingsMessage = document.getElementById('settingsMessage');

  let sb = null;
  let fieldsCache = [];
  let submissionsCache = [];
  let routing = false;

  const esc = (v = '') => String(v).replace(/[&<>'"]/g, ch => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[ch]));

  function showLogin(message = '') {
    dashboard?.classList.add('hidden');
    loginPanel?.classList.remove('hidden');
    if (loginError) loginError.textContent = message;
  }

  function showDashboard() {
    loginPanel?.classList.add('hidden');
    dashboard?.classList.remove('hidden');
    if (loginError) loginError.textContent = '';
  }

  function setLoginBusy(isBusy) {
    if (!loginButton) return;
    loginButton.disabled = isBusy;
    loginButton.textContent = isBusy ? 'Signing in…' : 'Sign in';
  }

  if (!configured) {
    setupNotice?.classList.remove('hidden');
    loginPanel?.classList.add('hidden');
    return;
  }

  // One Supabase client only. Creating additional clients for the same project in the
  // same browser context can cause GoTrue storage warnings and racey auth state.
  sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });

  async function checkAdmin(userId) {
    if (!userId) return { ok: false, error: 'No authenticated user.' };

    const { data, error } = await sb
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      return { ok: false, error: `Admin check failed: ${error.message}` };
    }

    if (!data) {
      return { ok: false, error: 'This account is not listed in admin_users.' };
    }

    return { ok: true, data };
  }

  async function routeAuth() {
    if (routing) return;
    routing = true;

    try {
      const { data, error } = await sb.auth.getUser();

      if (error || !data?.user) {
        showLogin('');
        return;
      }

      const admin = await checkAdmin(data.user.id);
      if (!admin.ok) {
        showLogin(admin.error || 'Administrator access required.');
        return;
      }

      showDashboard();
      await loadDashboard();
    } catch (err) {
      console.error('Admin auth routing failed:', err);
      showLogin(`Login check failed: ${err?.message || err}`);
    } finally {
      routing = false;
    }
  }

  loginForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (loginError) loginError.textContent = '';
    setLoginBusy(true);

    const email = document.getElementById('loginEmail')?.value.trim();
    const password = document.getElementById('loginPassword')?.value || '';

    try {
      // Important: use the user returned by signInWithPassword immediately.
      // This avoids a second auth lookup racing the newly-written browser session.
      const { data, error } = await sb.auth.signInWithPassword({ email, password });

      if (error) {
        showLogin(error.message);
        return;
      }

      if (!data?.user) {
        showLogin('Signed in, but Supabase did not return a user. Please reload and try again.');
        return;
      }

      const admin = await checkAdmin(data.user.id);
      if (!admin.ok) {
        await sb.auth.signOut();
        showLogin(admin.error || 'Administrator access required.');
        return;
      }

      showDashboard();
      await loadDashboard();
    } catch (err) {
      console.error('Sign in failed:', err);
      showLogin(`Sign in failed: ${err?.message || err}`);
    } finally {
      setLoginBusy(false);
    }
  });

  document.getElementById('logoutBtn')?.addEventListener('click', async () => {
    await sb.auth.signOut();
    showLogin('');
  });

  async function loadDashboard() {
    const [settingsResult, fieldsResult, submissionsResult] = await Promise.all([
      sb.from('app_settings').select('*').eq('id', 'main').maybeSingle(),
      sb.from('form_fields').select('*').order('sort_order'),
      sb.from('submissions').select('*', { count: 'exact' }).order('created_at', { ascending: false }).limit(250)
    ]);

    const errors = [
      ['settings', settingsResult.error],
      ['questions', fieldsResult.error],
      ['submissions', submissionsResult.error]
    ].filter(([, error]) => error);

    if (errors.length) {
      const message = errors.map(([name, error]) => `${name}: ${error.message}`).join(' | ');
      console.error('Dashboard data errors:', errors);
      if (settingsMessage) settingsMessage.textContent = `Dashboard data error: ${message}`;
    }

    const settings = settingsResult.data;
    fieldsCache = fieldsResult.data || [];
    submissionsCache = submissionsResult.data || [];

    document.getElementById('responseCount').textContent = submissionsResult.count ?? submissionsCache.length;
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
    if (!root) return;

    if (!fieldsCache.length) {
      root.innerHTML = '<p class="muted">No questions found. Re-run the SQL migration.</p>';
      return;
    }

    root.innerHTML = fieldsCache.map((q, i) => `
      <article class="schema-row">
        <span class="schema-index">${i + 1}</span>
        <div>
          <strong>${esc(q.label)}</strong>
          <small>${esc(q.field_type)}${q.required ? ' • required' : ' • optional'}${q.options?.length ? ` • ${q.options.length} options` : ''}</small>
        </div>
      </article>
    `).join('');
  }

  function flattenAnswer(answer) {
    if (Array.isArray(answer)) return answer.join(' | ');
    if (answer && typeof answer === 'object') return JSON.stringify(answer);
    return answer ?? '';
  }

  function renderResponses() {
    const body = document.querySelector('#responsesTable tbody');
    if (!body) return;

    if (!submissionsCache.length) {
      body.innerHTML = '<tr><td colspan="2">No submissions yet.</td></tr>';
      return;
    }

    body.innerHTML = submissionsCache.map(row => {
      const summary = Object.entries(row.answers || {})
        .map(([key, value]) => `
          <div class="answer-line">
            <strong>${esc(key)}</strong>
            <span>${esc(flattenAnswer(value))}</span>
          </div>
        `).join('');

      return `<tr><td class="date-cell">${new Date(row.created_at).toLocaleString()}</td><td>${summary}</td></tr>`;
    }).join('');
  }

  document.getElementById('settingsForm')?.addEventListener('submit', async event => {
    event.preventDefault();
    if (settingsMessage) settingsMessage.textContent = 'Saving…';

    const payload = {
      id: 'main',
      brand_name: document.getElementById('settingBrand').value.trim(),
      title: document.getElementById('settingTitle').value.trim(),
      description: document.getElementById('settingDescription').value.trim(),
      active: document.getElementById('settingActive').checked,
      updated_at: new Date().toISOString()
    };

    const { error } = await sb.from('app_settings').upsert(payload);
    if (settingsMessage) settingsMessage.textContent = error ? error.message : 'Saved ✓';
    if (!error) await loadDashboard();
  });

  document.getElementById('refreshBtn')?.addEventListener('click', loadDashboard);

  document.getElementById('exportBtn')?.addEventListener('click', () => {
    if (!submissionsCache.length) return;

    const labels = fieldsCache.map(field => field.label);
    const extraLabels = [...new Set(
      submissionsCache.flatMap(row => Object.keys(row.answers || {}))
    )].filter(label => !labels.includes(label));

    const columns = [...labels, ...extraLabels];
    const rows = [
      ['created_at', ...columns],
      ...submissionsCache.map(row => [
        row.created_at,
        ...columns.map(label => flattenAnswer(row.answers?.[label]))
      ])
    ];

    const csv = rows
      .map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `community-responses-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  });

  // Keep UI synchronized with auth without doing async work inside the callback.
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') {
      showLogin('');
    }
  });

  routeAuth();
})();
