(() => {
  const cfg = window.APP_CONFIG || {};
  const configured = cfg.supabaseUrl && cfg.supabaseKey && !cfg.supabaseUrl.includes('PASTE_') && !cfg.supabaseKey.includes('PASTE_');
  const setupNotice = document.getElementById('setupNotice');
  const closedNotice = document.getElementById('closedNotice');
  const stage = document.getElementById('questionStage');
  const navRow = document.getElementById('navRow');
  const backBtn = document.getElementById('backBtn');
  const nextBtn = document.getElementById('nextBtn');
  const progressBar = document.getElementById('progressBar');
  const progressLabel = document.getElementById('progressLabel');
  const progressPercent = document.getElementById('progressPercent');

  const state = { fields: [], index: 0, answers: {}, settings: null };
  let sb = null;

  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function setBrand(settings) {
    const brand = settings.brand_name || cfg.fallbackBrand || "Let's Match";
    const title = settings.title || cfg.fallbackTitle || 'Find your vibe ✨';
    const description = settings.description || cfg.fallbackDescription || '';
    document.getElementById('brandText').textContent = brand;
    document.getElementById('footerBrand').textContent = brand;
    document.getElementById('formTitle').textContent = title;
    document.getElementById('formDescription').textContent = description;
    document.title = title;
  }

  async function loadForm() {
    if (!configured) {
      setupNotice.classList.remove('hidden');
      setBrand({});
      stage.innerHTML = `<div class="empty-card"><span>⚙️</span><h2>Connect Supabase to activate the custom form</h2><p>The project is ready. Follow README.md, then import your Google Form from the Admin page.</p></div>`;
      return;
    }

    sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);
    const [{ data: settings, error: settingsError }, { data: fields, error: fieldsError }] = await Promise.all([
      sb.from('app_settings').select('*').eq('id', 'main').maybeSingle(),
      sb.from('form_fields').select('*').order('sort_order', { ascending: true })
    ]);

    if (settingsError || fieldsError) {
      stage.innerHTML = `<div class="empty-card"><span>⚠️</span><h2>Database setup isn't complete</h2><p>${escapeHtml(settingsError?.message || fieldsError?.message || 'Run the migration in Supabase.')}</p></div>`;
      return;
    }

    state.settings = settings || {};
    setBrand(state.settings);
    if (settings && settings.active === false) {
      closedNotice.classList.remove('hidden');
      stage.innerHTML = `<div class="empty-card"><span>💤</span><h2>Responses are paused</h2><p>Please check back later.</p></div>`;
      return;
    }

    state.fields = fields || [];
    if (!state.fields.length) {
      stage.innerHTML = `<div class="empty-card"><span>✨</span><h2>Almost ready</h2><p>Sign in to <a href="admin.html">Admin</a> and click <strong>Import / refresh questions</strong>.</p></div>`;
      return;
    }

    navRow.classList.remove('hidden');
    renderQuestion();
  }

  function currentField() { return state.fields[state.index]; }

  function updateProgress() {
    const total = state.fields.length;
    const position = Math.min(state.index + 1, total);
    const pct = total ? Math.round((position / total) * 100) : 0;
    progressLabel.textContent = `Question ${position} of ${total}`;
    progressPercent.textContent = `${pct}%`;
    progressBar.style.width = `${pct}%`;
    backBtn.disabled = state.index === 0;
    nextBtn.textContent = state.index === total - 1 ? 'Send it ♥' : 'Next →';
  }

  function optionMarkup(field, value, multi=false) {
    const chosen = multi ? (state.answers[field.id] || []).includes(value) : state.answers[field.id] === value;
    return `<button type="button" class="choice ${chosen ? 'selected' : ''}" data-value="${escapeHtml(value)}">
      <span class="choice-indicator">${chosen ? '♥' : (multi ? '＋' : '○')}</span><span>${escapeHtml(value)}</span>
    </button>`;
  }

  function inputMarkup(field) {
    const answer = state.answers[field.id];
    const type = field.field_type;
    if (type === 'paragraph') return `<textarea id="answerInput" rows="5" placeholder="Type your answer…">${escapeHtml(answer || '')}</textarea>`;
    if (type === 'date') return `<input id="answerInput" type="date" value="${escapeHtml(answer || '')}" />`;
    if (type === 'time') return `<input id="answerInput" type="time" value="${escapeHtml(answer || '')}" />`;
    if (type === 'dropdown') {
      const opts = (field.options || []).map(v => `<option value="${escapeHtml(v)}" ${answer === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
      return `<select id="answerInput"><option value="">Choose one…</option>${opts}</select>`;
    }
    if (type === 'multiple_choice' || type === 'scale') return `<div id="choiceGroup" class="choice-grid">${(field.options || []).map(v => optionMarkup(field, String(v), false)).join('')}</div>`;
    if (type === 'checkboxes') return `<div id="choiceGroup" class="choice-grid">${(field.options || []).map(v => optionMarkup(field, String(v), true)).join('')}</div>`;
    if (type === 'file_upload') return `<div class="unsupported-box">📎 This question was a Google Forms file-upload field. File uploads are not enabled in this static version. You can change the question in Supabase or add Supabase Storage later.</div>`;
    if (type === 'grid') return `<div class="unsupported-box">▦ A Google Forms grid question was detected. The imported raw options are preserved, but this starter renders grid questions as an administrator-review item. See README for extending grid rendering.</div>`;
    return `<input id="answerInput" type="text" value="${escapeHtml(answer || '')}" placeholder="Type your answer…" autocomplete="off" />`;
  }

  function renderQuestion() {
    const field = currentField();
    updateProgress();
    stage.innerHTML = `<article class="question-card" data-index="${state.index}">
      <div class="question-no">${String(state.index + 1).padStart(2,'0')}</div>
      <div class="question-kicker">${field.required ? 'REQUIRED' : 'OPTIONAL'} • ${escapeHtml(field.field_type.replaceAll('_',' ').toUpperCase())}</div>
      <h2>${escapeHtml(field.label)}</h2>
      ${field.description ? `<p class="question-description">${escapeHtml(field.description)}</p>` : ''}
      <div class="answer-area">${inputMarkup(field)}</div>
      <p id="validationError" class="error-text"></p>
    </article>`;

    const input = document.getElementById('answerInput');
    if (input) {
      input.addEventListener('input', () => state.answers[field.id] = input.value);
      input.addEventListener('change', () => state.answers[field.id] = input.value);
      setTimeout(() => input.focus({ preventScroll: true }), 100);
    }

    document.querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => {
      const value = btn.dataset.value;
      if (field.field_type === 'checkboxes') {
        const list = new Set(state.answers[field.id] || []);
        list.has(value) ? list.delete(value) : list.add(value);
        state.answers[field.id] = [...list];
      } else {
        state.answers[field.id] = value;
      }
      renderQuestion();
    }));
  }

  function validCurrent() {
    const field = currentField();
    const value = state.answers[field.id];
    const empty = Array.isArray(value) ? value.length === 0 : value == null || String(value).trim() === '';
    if (field.required && empty) {
      document.getElementById('validationError').textContent = 'This one needs an answer before you move on ♥';
      return false;
    }
    return true;
  }

  async function submit() {
    if (!validCurrent()) return;
    nextBtn.disabled = true;
    nextBtn.textContent = 'Sending…';

    const normalized = {};
    state.fields.forEach(field => {
      normalized[field.label] = state.answers[field.id] ?? null;
    });

    const payload = {
      answers: normalized,
      answer_by_field: state.answers,
      metadata: {
        user_agent: navigator.userAgent,
        source: location.href,
        submitted_at_client: new Date().toISOString()
      }
    };

    const { error } = await sb.from('submissions').insert(payload);
    if (error) {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Try again';
      stage.insertAdjacentHTML('beforeend', `<p class="error-text submit-error">${escapeHtml(error.message)}</p>`);
      return;
    }

    navRow.classList.add('hidden');
    progressBar.style.width = '100%';
    progressPercent.textContent = '100%';
    progressLabel.textContent = 'Complete';
    stage.innerHTML = `<div class="success-card"><div class="success-heart">♥</div><span class="eyebrow">IT'S A MATCH</span><h2>You're in! 🎉</h2><p>Your response has been saved successfully.</p><button id="restartBtn" class="btn btn-primary" type="button">Submit another response</button></div>`;
    document.getElementById('restartBtn').addEventListener('click', () => {
      state.index = 0; state.answers = {}; navRow.classList.remove('hidden'); renderQuestion();
    });
  }

  backBtn.addEventListener('click', () => { if (state.index > 0) { state.index--; renderQuestion(); } });
  nextBtn.addEventListener('click', async () => {
    if (!validCurrent()) return;
    if (state.index < state.fields.length - 1) { state.index++; renderQuestion(); }
    else await submit();
  });

  loadForm();
})();
