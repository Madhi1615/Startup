(() => {
  const cfg = window.APP_CONFIG || {};
  const localSchema = (window.FORM_SCHEMA || []).map((field, index) => ({
    ...field,
    id: field.id || `preview_${index + 1}`,
    options: field.options || [],
    raw_data: field.raw_data || {}
  }));
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

  const state = { fields: [], index: 0, answers: {}, otherText: {}, settings: null, preview: !configured };
  let sb = null;

  const escapeHtml = (value='') => String(value).replace(/[&<>'"]/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));

  function setBrand(settings = {}) {
    const brand = settings.brand_name || cfg.fallbackBrand || "Let's Match";
    const title = settings.title || cfg.fallbackTitle || 'Find your people ✨';
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
      setupNotice.innerHTML = '<strong>Preview mode.</strong> The exact form is ready to try. Connect Supabase in <code>assets/config.js</code> and run the SQL migration to save real responses.';
      setBrand({});
      state.fields = localSchema;
      state.preview = true;
      navRow.classList.remove('hidden');
      renderQuestion();
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

    state.fields = (fields && fields.length) ? fields : localSchema;
    state.preview = false;
    navRow.classList.remove('hidden');
    renderQuestion();
  }

  function currentField() { return state.fields[state.index]; }

  function updateProgress() {
    const total = state.fields.length;
    const position = Math.min(state.index + 1, total);
    const pct = total ? Math.round((position / total) * 100) : 0;
    const field = currentField();
    progressLabel.textContent = `Question ${position} of ${total}`;
    progressPercent.textContent = `${pct}%`;
    progressBar.style.width = `${pct}%`;
    backBtn.disabled = state.index === 0;
    if (state.index === total - 1) nextBtn.textContent = state.preview ? 'Preview finish ♥' : 'Join the community ♥';
    else nextBtn.textContent = field?.required ? 'Next →' : 'Skip / Next →';
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
    const meta = field.raw_data || {};
    const placeholder = escapeHtml(meta.placeholder || 'Type your answer…');

    if (type === 'paragraph') return `<textarea id="answerInput" rows="5" placeholder="${placeholder}">${escapeHtml(answer || '')}</textarea>`;
    if (type === 'email') return `<input id="answerInput" type="email" value="${escapeHtml(answer || '')}" placeholder="${placeholder}" autocomplete="email" inputmode="email" />`;
    if (type === 'tel') return `<input id="answerInput" type="tel" value="${escapeHtml(answer || '')}" placeholder="${placeholder}" autocomplete="tel" inputmode="tel" />`;
    if (type === 'date') return `<input id="answerInput" type="date" value="${escapeHtml(answer || '')}" />`;
    if (type === 'time') return `<input id="answerInput" type="time" value="${escapeHtml(answer || '')}" />`;
    if (type === 'dropdown') {
      const opts = (field.options || []).map(v => `<option value="${escapeHtml(v)}" ${answer === v ? 'selected' : ''}>${escapeHtml(v)}</option>`).join('');
      return `<select id="answerInput"><option value="">Choose one…</option>${opts}</select>`;
    }
    if (type === 'multiple_choice' || type === 'scale') {
      return `<div id="choiceGroup" class="choice-grid">${(field.options || []).map(v => optionMarkup(field, String(v), false)).join('')}</div>`;
    }
    if (type === 'checkboxes') {
      const allowOther = !!meta.allow_other;
      const otherSelected = (state.answers[field.id] || []).includes(meta.other_label || 'Other');
      return `<div id="choiceGroup" class="choice-grid">${(field.options || []).map(v => optionMarkup(field, String(v), true)).join('')}</div>
        ${allowOther && otherSelected ? `<div class="other-wrap"><label for="otherInput">Tell us your other skill</label><input id="otherInput" type="text" value="${escapeHtml(state.otherText[field.id] || '')}" placeholder="e.g. Legal, Finance, Research…" /></div>` : ''}`;
    }
    if (type === 'consent') {
      const value = (field.options || [])[0] || 'Yes, I consent';
      const chosen = state.answers[field.id] === true;
      return `<button type="button" class="consent-choice ${chosen ? 'selected' : ''}" id="consentChoice" aria-pressed="${chosen}">
        <span class="consent-box">${chosen ? '✓' : ''}</span><span>${escapeHtml(value)}</span>
      </button>`;
    }
    return `<input id="answerInput" type="text" value="${escapeHtml(answer || '')}" placeholder="${placeholder}" autocomplete="${escapeHtml(meta.autocomplete || 'off')}" />`;
  }

  function renderQuestion() {
    const field = currentField();
    if (!field) return;
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
      setTimeout(() => input.focus({ preventScroll: true }), 80);
    }

    const otherInput = document.getElementById('otherInput');
    if (otherInput) {
      otherInput.addEventListener('input', () => state.otherText[field.id] = otherInput.value);
      setTimeout(() => otherInput.focus({ preventScroll: true }), 80);
    }

    const consentChoice = document.getElementById('consentChoice');
    if (consentChoice) {
      consentChoice.addEventListener('click', () => {
        state.answers[field.id] = state.answers[field.id] !== true;
        renderQuestion();
      });
    }

    document.querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => {
      const value = btn.dataset.value;
      if (field.field_type === 'checkboxes') {
        const list = new Set(state.answers[field.id] || []);
        list.has(value) ? list.delete(value) : list.add(value);
        state.answers[field.id] = [...list];
        if (value === (field.raw_data?.other_label || 'Other') && !list.has(value)) delete state.otherText[field.id];
      } else {
        state.answers[field.id] = value;
      }
      renderQuestion();
    }));
  }

  function isEmpty(value) {
    return Array.isArray(value) ? value.length === 0 : value == null || value === false || String(value).trim() === '';
  }

  function validCurrent() {
    const field = currentField();
    const value = state.answers[field.id];
    const error = document.getElementById('validationError');

    if (field.required && isEmpty(value)) {
      error.textContent = field.field_type === 'consent' ? 'Please give your consent before submitting ♥' : 'This one needs an answer before you move on ♥';
      return false;
    }

    if (field.field_type === 'email' && value) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value).trim());
      if (!emailOk) { error.textContent = 'Please enter a valid email address.'; return false; }
    }

    return true;
  }

  function normalizedAnswer(field) {
    const value = state.answers[field.id];
    if (field.field_type === 'consent') return value === true ? 'Yes, I consent' : null;
    if (field.field_type === 'checkboxes' && Array.isArray(value)) {
      const otherLabel = field.raw_data?.other_label || 'Other';
      return value.map(item => item === otherLabel && state.otherText[field.id]?.trim()
        ? `${otherLabel}: ${state.otherText[field.id].trim()}`
        : item);
    }
    return value ?? null;
  }

  async function submit() {
    if (!validCurrent()) return;

    if (state.preview || !sb) {
      navRow.classList.add('hidden');
      progressBar.style.width = '100%';
      progressPercent.textContent = '100%';
      progressLabel.textContent = 'Preview complete';
      stage.innerHTML = `<div class="success-card"><div class="success-heart">♥</div><span class="eyebrow">PREVIEW COMPLETE</span><h2>The form flow is ready 🎉</h2><p>Connect Supabase and run the included SQL to start saving real responses.</p><button id="restartBtn" class="btn btn-primary" type="button">Preview again</button></div>`;
      document.getElementById('restartBtn').addEventListener('click', resetForm);
      return;
    }

    nextBtn.disabled = true;
    nextBtn.textContent = 'Saving your profile…';

    const normalized = {};
    const normalizedByField = {};
    state.fields.forEach(field => {
      const value = normalizedAnswer(field);
      normalized[field.label] = value;
      normalizedByField[field.id] = value;
    });

    const payload = {
      answers: normalized,
      answer_by_field: normalizedByField,
      metadata: {
        source: location.href,
        submitted_at_client: new Date().toISOString(),
        consent: state.fields.some(field => field.field_type === 'consent' && normalizedAnswer(field) === 'Yes, I consent')
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
    stage.innerHTML = `<div class="success-card"><div class="success-heart">♥</div><span class="eyebrow">IT'S A MATCH</span><h2>Welcome to the community 🎉</h2><p>Your profile has been saved successfully. Time to connect, share and build.</p><button id="restartBtn" class="btn btn-primary" type="button">Submit another response</button></div>`;
    document.getElementById('restartBtn').addEventListener('click', resetForm);
  }

  function resetForm() {
    state.index = 0;
    state.answers = {};
    state.otherText = {};
    nextBtn.disabled = false;
    navRow.classList.remove('hidden');
    renderQuestion();
  }

  backBtn.addEventListener('click', () => {
    if (state.index > 0) { state.index--; renderQuestion(); }
  });

  nextBtn.addEventListener('click', async () => {
    if (!validCurrent()) return;
    if (state.index < state.fields.length - 1) { state.index++; renderQuestion(); }
    else await submit();
  });

  loadForm();
})();
