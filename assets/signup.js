(() => {
  'use strict';

  const CFG = {
    url: 'https://jnomktahxycxtwnqmgdw.supabase.co',
    key: 'sb_publishable_Qu12Nz1BaQPIQMN7BgsHkw_etYyTjCX',
    loginUrl: 'https://se-connect.vercel.app'
  };

  const $ = (s) => document.querySelector(s);
  const esc = (v='') => String(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));

  const localSchema = (window.FORM_SCHEMA || []).map((field, index) => ({
    ...field,
    id: field.id || `field_${index+1}`,
    options: field.options || [],
    raw_data: field.raw_data || {}
  }));

  const accountFields = [
    {
      id: '_username',
      label: 'Choose your SE Connect username',
      description: 'After approval, you will use this username to sign in.',
      field_type: 'account_username',
      required: true,
      options: [],
      raw_data: {}
    },
    {
      id: '_password',
      label: 'Create your SE Connect password',
      description: 'Keep this password safe. It is stored securely in Supabase Auth and is never saved in the application form.',
      field_type: 'account_password',
      required: true,
      options: [],
      raw_data: {}
    }
  ];

  const state = {
    email: '',
    session: null,
    verified: false,
    fields: [],
    index: 0,
    answers: {},
    otherText: {},
    confirmPassword: ''
  };

  function headers(auth=false, extra={}) {
    const h = { apikey: CFG.key, ...extra };
    if (auth && state.session?.access_token) h.Authorization = `Bearer ${state.session.access_token}`;
    return h;
  }

  async function parse(r) {
    const text = await r.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    if (!r.ok) {
      const msg = data && typeof data === 'object'
        ? (data.msg || data.message || data.error_description || data.error || `Request failed (${r.status})`)
        : (data || `Request failed (${r.status})`);
      throw new Error(String(msg));
    }
    return data;
  }

  async function auth(path, options={}) {
    return parse(await fetch(`${CFG.url}/auth/v1${path}`, {
      ...options,
      headers: headers(false, {'Content-Type':'application/json', ...(options.headers || {})})
    }));
  }

  async function rest(path, options={}) {
    return parse(await fetch(`${CFG.url}/rest/v1/${path}`, {
      ...options,
      headers: headers(true, {'Content-Type':'application/json', ...(options.headers || {})})
    }));
  }

  function normalizeUsername(v) {
    return String(v || '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 40);
  }

  function passwordValid(p) {
    return typeof p === 'string'
      && p.length >= 12
      && /[a-z]/.test(p)
      && /[A-Z]/.test(p)
      && /\d/.test(p)
      && /[^A-Za-z0-9]/.test(p);
  }

  function niceError(err) {
    const m = String(err?.message || err || '');
    if (m.includes('USERNAME_TAKEN') || m.includes('signup_requests_username_uq')) return 'That username is already taken. Please choose another one.';
    if (m.includes('USERNAME_INVALID')) return 'Use 3–40 characters: lowercase letters, numbers, dot, underscore or hyphen.';
    if (m.includes('EMAIL_ALREADY_MEMBER')) return 'This email is already connected to an active SE Connect member.';
    if (m.includes('signup_requests_email_uq')) return 'An application already exists for this email.';
    if (m.toLowerCase().includes('rate limit')) return 'Too many OTP requests. Please wait a little and try again.';
    return m || 'Something went wrong.';
  }

  async function sendOtp() {
    const email = $('#signupEmail').value.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      $('#otpStatus').textContent = 'Please enter a valid email address.';
      return;
    }

    $('#sendOtpBtn').disabled = true;
    $('#otpStatus').textContent = 'Sending OTP…';
    try {
      await auth('/otp', {
        method: 'POST',
        body: JSON.stringify({ email, create_user: true })
      });
      state.email = email;
      $('#otpStatus').textContent = 'OTP sent. Check your email.';
      $('#codeStep').classList.remove('hidden');
      $('#otpCode').focus();
    } catch (e) {
      $('#otpStatus').textContent = niceError(e);
    } finally {
      $('#sendOtpBtn').disabled = false;
    }
  }

  async function verifyOtp() {
    const token = $('#otpCode').value.trim();
    if (!token) {
      $('#verifyStatus').textContent = 'Enter the OTP from your email.';
      return;
    }

    $('#verifyOtpBtn').disabled = true;
    $('#verifyStatus').textContent = 'Verifying…';
    try {
      const data = await auth('/verify', {
        method: 'POST',
        body: JSON.stringify({ email: state.email, token, type: 'email' })
      });

      if (!data?.access_token || !data?.user?.id) throw new Error('Email verification did not return a valid session.');
      state.session = data;
      state.verified = true;
      state.answers.email = state.email;

      $('#emailStep').classList.add('hidden');
      $('#codeStep').classList.add('hidden');
      $('#verifiedStep').classList.remove('hidden');
      $('#verifiedEmailText').textContent = state.email;
      $('#verifyStatus').textContent = '';
    } catch (e) {
      $('#verifyStatus').textContent = niceError(e);
    } finally {
      $('#verifyOtpBtn').disabled = false;
    }
  }

  async function resendOtp() {
    $('#verifyStatus').textContent = '';
    $('#signupEmail').value = state.email;
    await sendOtp();
  }

  function startForm() {
    if (!state.verified || !state.session) return;
    state.fields = [...localSchema, ...accountFields];
    state.index = 0;
    state.answers.email = state.email;
    $('#otpShell').classList.add('hidden');
    $('#formSection').classList.remove('hidden');
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function field() { return state.fields[state.index]; }

  function updateProgress() {
    const total = state.fields.length;
    const pos = state.index + 1;
    const pct = Math.round(pos / total * 100);
    $('#progressLabel').textContent = `Question ${pos} of ${total}`;
    $('#progressPercent').textContent = `${pct}%`;
    $('#progressBar').style.width = `${pct}%`;
    $('#backBtn').disabled = state.index === 0;
    $('#nextBtn').textContent = state.index === total - 1 ? 'Submit for approval ♥' : (field()?.required ? 'Next →' : 'Skip / Next →');
  }

  function optionMarkup(f, value, multi=false) {
    const chosen = multi ? (state.answers[f.id] || []).includes(value) : state.answers[f.id] === value;
    return `<button type="button" class="choice ${chosen ? 'selected' : ''}" data-value="${esc(value)}">
      <span class="choice-indicator">${chosen ? '♥' : (multi ? '＋' : '○')}</span><span>${esc(value)}</span>
    </button>`;
  }

  function inputMarkup(f) {
    const answer = state.answers[f.id];
    const type = f.field_type;
    const meta = f.raw_data || {};
    const placeholder = esc(meta.placeholder || 'Type your answer…');

    if (f.id === 'email') {
      return `<input class="read-only-email" type="email" value="${esc(state.email)}" readonly aria-readonly="true" />
        <p class="helper">✓ Verified by email OTP</p>`;
    }

    if (type === 'account_username') {
      if (!state.answers[f.id]) state.answers[f.id] = normalizeUsername(state.answers.name || '');
      return `<input id="answerInput" class="account-input" type="text" value="${esc(state.answers[f.id] || '')}" placeholder="e.g. priya.sharma" autocomplete="username" />
        <p class="helper">3–40 characters. Lowercase letters, numbers, dot, underscore and hyphen are allowed.</p>`;
    }

    if (type === 'account_password') {
      return `<input id="answerInput" class="account-input" type="password" value="${esc(answer || '')}" placeholder="Create a strong password" autocomplete="new-password" />
        <div style="height:10px"></div>
        <input id="confirmPasswordInput" class="account-input" type="password" value="${esc(state.confirmPassword || '')}" placeholder="Confirm password" autocomplete="new-password" />
        <div class="password-rules">
          <span>• At least 12 characters</span><span>• Include uppercase + lowercase</span><span>• Include a number + symbol</span>
        </div>`;
    }

    if (type === 'paragraph') return `<textarea id="answerInput" rows="5" placeholder="${placeholder}">${esc(answer || '')}</textarea>`;
    if (type === 'email') return `<input id="answerInput" type="email" value="${esc(answer || '')}" placeholder="${placeholder}" autocomplete="email" />`;
    if (type === 'tel') return `<input id="answerInput" type="tel" value="${esc(answer || '')}" placeholder="${placeholder}" autocomplete="tel" inputmode="tel" />`;

    if (type === 'multiple_choice' || type === 'scale') {
      return `<div id="choiceGroup" class="choice-grid">${(f.options || []).map(v => optionMarkup(f, String(v), false)).join('')}</div>`;
    }

    if (type === 'checkboxes') {
      const allowOther = !!meta.allow_other;
      const otherSelected = (state.answers[f.id] || []).includes(meta.other_label || 'Other');
      return `<div id="choiceGroup" class="choice-grid">${(f.options || []).map(v => optionMarkup(f, String(v), true)).join('')}</div>
        ${allowOther && otherSelected ? `<div class="other-wrap"><label for="otherInput">Tell us your other skill</label><input id="otherInput" type="text" value="${esc(state.otherText[f.id] || '')}" placeholder="e.g. Legal, Finance, Research…" /></div>` : ''}`;
    }

    if (type === 'consent') {
      const value = (f.options || [])[0] || 'Yes, I consent';
      const chosen = state.answers[f.id] === true;
      return `<button type="button" class="consent-choice ${chosen ? 'selected' : ''}" id="consentChoice" aria-pressed="${chosen}">
        <span class="consent-box">${chosen ? '✓' : ''}</span><span>${esc(value)}</span>
      </button>`;
    }

    return `<input id="answerInput" type="text" value="${esc(answer || '')}" placeholder="${placeholder}" autocomplete="${esc(meta.autocomplete || 'off')}" />`;
  }

  function renderQuestion() {
    const f = field();
    if (!f) return;
    updateProgress();

    $('#questionStage').innerHTML = `<article class="question-card">
      <div class="question-no">${String(state.index + 1).padStart(2,'0')}</div>
      <div class="question-kicker">${f.required ? 'REQUIRED' : 'OPTIONAL'} • ${esc(f.field_type.replaceAll('_',' ').toUpperCase())}</div>
      <h2>${esc(f.label)}</h2>
      ${f.description ? `<p class="question-description">${esc(f.description)}</p>` : ''}
      <div class="answer-area">${inputMarkup(f)}</div>
      <p id="validationError" class="error-text"></p>
    </article>`;

    const input = $('#answerInput');
    if (input) {
      input.addEventListener('input', () => {
        state.answers[f.id] = f.field_type === 'account_username' ? normalizeUsername(input.value) : input.value;
        if (f.field_type === 'account_username' && input.value !== state.answers[f.id]) input.value = state.answers[f.id];
      });
      input.addEventListener('change', () => state.answers[f.id] = f.field_type === 'account_username' ? normalizeUsername(input.value) : input.value);
      setTimeout(() => input.focus({preventScroll:true}), 60);
    }

    const confirm = $('#confirmPasswordInput');
    if (confirm) confirm.addEventListener('input', () => state.confirmPassword = confirm.value);

    const other = $('#otherInput');
    if (other) other.addEventListener('input', () => state.otherText[f.id] = other.value);

    const consent = $('#consentChoice');
    if (consent) consent.addEventListener('click', () => {
      state.answers[f.id] = state.answers[f.id] !== true;
      renderQuestion();
    });

    document.querySelectorAll('.choice').forEach(btn => btn.addEventListener('click', () => {
      const value = btn.dataset.value;
      if (f.field_type === 'checkboxes') {
        const list = new Set(state.answers[f.id] || []);
        list.has(value) ? list.delete(value) : list.add(value);
        state.answers[f.id] = [...list];
        if (value === (f.raw_data?.other_label || 'Other') && !list.has(value)) delete state.otherText[f.id];
      } else {
        state.answers[f.id] = value;
      }
      renderQuestion();
    }));
  }

  function empty(v) {
    return Array.isArray(v) ? v.length === 0 : v == null || v === false || String(v).trim() === '';
  }

  function validCurrent() {
    const f = field();
    const value = state.answers[f.id];
    const err = $('#validationError');

    if (f.required && empty(value)) {
      err.textContent = f.field_type === 'consent' ? 'Please give your consent before submitting.' : 'This field is required.';
      return false;
    }

    if (f.field_type === 'account_username') {
      const u = normalizeUsername(value);
      if (!/^[a-z0-9][a-z0-9._-]{2,39}$/.test(u)) {
        err.textContent = 'Choose a username with 3–40 valid characters.';
        return false;
      }
      state.answers[f.id] = u;
    }

    if (f.field_type === 'account_password') {
      if (!passwordValid(String(value || ''))) {
        err.textContent = 'Use at least 12 characters with uppercase, lowercase, a number and a symbol.';
        return false;
      }
      if (String(value) !== state.confirmPassword) {
        err.textContent = 'The two passwords do not match.';
        return false;
      }
    }

    return true;
  }

  function primarySkills() {
    const values = state.answers.primary_skills || [];
    return Array.isArray(values)
      ? values.map(item => item === 'Other' && state.otherText.primary_skills?.trim()
          ? `Other: ${state.otherText.primary_skills.trim()}`
          : item)
      : [];
  }

  async function setPassword() {
    await parse(await fetch(`${CFG.url}/auth/v1/user`, {
      method: 'PUT',
      headers: headers(true, {'Content-Type':'application/json'}),
      body: JSON.stringify({ password: state.answers._password })
    }));
  }

  async function submit() {
    if (!validCurrent()) return;
    $('#nextBtn').disabled = true;
    $('#nextBtn').textContent = 'Submitting securely…';

    try {
      if (!state.session?.access_token || !state.session?.user?.id) throw new Error('Your verified session expired. Please verify your email again.');

      await setPassword();

      const payload = {
        auth_user_id: state.session.user.id,
        real_email: state.email,
        preferred_username: normalizeUsername(state.answers._username),
        full_name: String(state.answers.name || '').trim(),
        whatsapp: state.answers.whatsapp || null,
        city_country: state.answers.city_country || null,
        who_am_i: state.answers.who_am_i || '',
        obsessed_building: state.answers.obsessed_building || '',
        help_with: state.answers.help_with || '',
        looking_for: state.answers.looking_for || '',
        involvement: state.answers.involvement || null,
        primary_skills: primarySkills(),
        startup_before: state.answers.startup_before || null,
        startup_details: state.answers.startup_details || null,
        remarks: state.answers.remarks || null,
        consent: state.answers.consent === true,
        status: 'pending'
      };

      const existing = await rest(`signup_requests?select=id,status&auth_user_id=eq.${encodeURIComponent(state.session.user.id)}`);
      let row;

      if (Array.isArray(existing) && existing.length) {
        if (existing[0].status !== 'pending') throw new Error(`Your application is already ${existing[0].status}.`);
        const editable = {...payload};
        delete editable.auth_user_id;
        delete editable.real_email;
        delete editable.status;
        const updated = await rest(`signup_requests?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(editable)
        });
        row = updated?.[0];
      } else {
        const inserted = await rest('signup_requests', {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify(payload)
        });
        row = inserted?.[0];
      }

      try {
        await fetch(`${CFG.url}/auth/v1/logout`, {
          method:'POST',
          headers: headers(true, {'Content-Type':'application/json'})
        });
      } catch {}

      state.session = null;
      $('#navRow').classList.add('hidden');
      $('#progressBar').style.width = '100%';
      $('#progressPercent').textContent = '100%';
      $('#progressLabel').textContent = 'Application submitted';
      $('#questionStage').innerHTML = `<div class="success-card">
        <div class="success-heart">♥</div>
        <span class="eyebrow">EMAIL VERIFIED • PENDING APPROVAL</span>
        <h2>Your application is with the admin 🎉</h2>
        <p>Your requested username is <strong>${esc(payload.preferred_username)}</strong>.</p>
        <div class="pending-box">Your account is <strong>not active yet</strong>. After the admin approves you, sign in at <strong>${esc(CFG.loginUrl)}</strong> using this username and the <strong>same password you just created</strong>.</div>
      </div>`;
    } catch (e) {
      $('#nextBtn').disabled = false;
      $('#nextBtn').textContent = 'Submit for approval ♥';
      $('#validationError').textContent = niceError(e);
    }
  }

  $('#sendOtpBtn').addEventListener('click', sendOtp);
  $('#resendOtpBtn').addEventListener('click', resendOtp);
  $('#verifyOtpBtn').addEventListener('click', verifyOtp);
  $('#startFormBtn').addEventListener('click', startForm);

  $('#backBtn').addEventListener('click', () => {
    if (state.index > 0) {
      state.index--;
      renderQuestion();
    }
  });

  $('#nextBtn').addEventListener('click', async () => {
    if (!validCurrent()) return;
    if (state.index < state.fields.length - 1) {
      state.index++;
      renderQuestion();
    } else {
      await submit();
    }
  });
})();
