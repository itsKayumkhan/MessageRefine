/* ═══════════════════════════════════════════════════════════════════════════
   MessageRefine — popup.js
   Multi-provider: OpenAI | Gemini | Claude
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

// ─── Provider model catalogue ──────────────────────────────────────────────────
const PROVIDER_MODELS = {
  openai: [
    { value: 'gpt-4o-mini',    label: 'GPT-4o Mini (Fast)'    },
    { value: 'gpt-4o',         label: 'GPT-4o (Best)'         },
    { value: 'gpt-3.5-turbo',  label: 'GPT-3.5 Turbo (Economy)' },
  ],
  gemini: [
    { value: 'gemini-2.0-flash',      label: 'Gemini 2.0 Flash (Fast)'    },
    { value: 'gemini-1.5-flash',      label: 'Gemini 1.5 Flash (Economy)' },
    { value: 'gemini-1.5-flash-8b',   label: 'Gemini 1.5 Flash 8B (Lite)' },
  ],
  claude: [
    { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (Fast)'    },
    { value: 'claude-sonnet-4-6',         label: 'Claude Sonnet 4.6 (Best)'   },
    { value: 'claude-opus-4-6',           label: 'Claude Opus 4.6 (Powerful)' },
  ],
  groq: [
    { value: 'llama-3.1-8b-instant',    label: 'Llama 3.1 8B (Fast)'    },
    { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Best)'   },
    { value: 'mixtral-8x7b-32768',      label: 'Mixtral 8x7B (Economy)' },
  ],
  hf: [
    { value: 'mistralai/Mistral-7B-Instruct-v0.3',     label: 'Mistral 7B (Fast)'    },
    { value: 'meta-llama/Meta-Llama-3-8B-Instruct',    label: 'Llama 3 8B (Best)'    },
    { value: 'microsoft/Phi-3-mini-4k-instruct',       label: 'Phi-3 Mini (Economy)' },
  ],
};

const PROVIDER_LABELS = { openai: 'OpenAI', gemini: 'Gemini', claude: 'Claude', groq: 'Groq', hf: 'HuggingFace' };

// ─── Element refs ─────────────────────────────────────────────────────────────
const els = {
  // Settings
  settingsToggleBtn:    document.getElementById('settings-toggle-btn'),
  settingsPanel:        document.getElementById('settings-panel'),
  providerBtns:         document.querySelectorAll('.provider-btn'),
  openaiKeyInput:       document.getElementById('openai-key-input'),
  geminiKeyInput:       document.getElementById('gemini-key-input'),
  claudeKeyInput:       document.getElementById('claude-key-input'),
  groqKeyInput:         document.getElementById('groq-key-input'),
  hfKeyInput:           document.getElementById('hf-key-input'),
  modelSelect:          document.getElementById('model-select'),
  saveSettingsBtn:      document.getElementById('save-settings-btn'),
  clearKeyBtn:          document.getElementById('clear-key-btn'),
  settingsStatus:       document.getElementById('settings-status'),
  // Screens
  noKeyScreen:          document.getElementById('no-key-screen'),
  noKeyOpenSettingsBtn: document.getElementById('no-key-open-settings-btn'),
  mainApp:              document.getElementById('main-app'),
  // Tabs
  tabReply:             document.getElementById('tab-reply'),
  tabEnhance:           document.getElementById('tab-enhance'),
  panelReply:           document.getElementById('panel-reply'),
  panelEnhance:         document.getElementById('panel-enhance'),
  // Tool 1 – Smart Reply
  clientMessage:        document.getElementById('client-message'),
  replyContext:         document.getElementById('reply-context'),
  generateReplyBtn:     document.getElementById('generate-reply-btn'),
  generateReplyLabel:   document.getElementById('generate-reply-label'),
  replyIcon:            document.getElementById('reply-icon'),
  replySpinner:         document.getElementById('reply-spinner'),
  replyOutputWrap:      document.getElementById('reply-output-wrap'),
  replyOutput:          document.getElementById('reply-output'),
  copyReplyBtn:         document.getElementById('copy-reply-btn'),
  replyError:           document.getElementById('reply-error'),
  // Tool 2 – Message Enhancer
  roughDraft:           document.getElementById('rough-draft'),
  toneSelect:           document.getElementById('tone-select'),
  enhanceBtn:           document.getElementById('enhance-btn'),
  enhanceLabel:         document.getElementById('enhance-label'),
  enhanceIcon:          document.getElementById('enhance-icon'),
  enhanceSpinner:       document.getElementById('enhance-spinner'),
  enhanceOutputWrap:    document.getElementById('enhance-output-wrap'),
  enhanceOutput:        document.getElementById('enhance-output'),
  copyEnhanceBtn:       document.getElementById('copy-enhance-btn'),
  enhanceError:         document.getElementById('enhance-error'),
};

// ─── State ────────────────────────────────────────────────────────────────────
let state = {
  activeProvider: 'openai',
  model:          'gpt-4o-mini',
  openaiKey:      '',
  geminiKey:      '',
  claudeKey:      '',
  groqKey:        '',
  hfKey:          '',
  replyTokens:    250,
  enhanceTokens:  250,
};

// ─── Word limit helpers ───────────────────────────────────────────────────────
const WORD_LIMITS = { clientMessage: 150, replyContext: 40, roughDraft: 150 };

function countWords(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
}

function applyWordLimit(el, counterId, maxWords) {
  const counter = document.getElementById(counterId);
  const words   = countWords(el.value);

  if (words > maxWords) {
    el.value = el.value.trim().split(/\s+/).slice(0, maxWords).join(' ');
  }

  const current = countWords(el.value);
  counter.textContent = `${current} / ${maxWords} words`;
  counter.className   = 'word-counter' +
    (current >= maxWords        ? ' at-limit'   :
     current >= maxWords * 0.85 ? ' near-limit' : '');
}

// ─── Draft persistence ────────────────────────────────────────────────────────
const DRAFT_KEYS = ['draftClientMessage', 'draftReplyContext', 'draftRoughDraft', 'draftTone'];
const draftTimers = {};

function saveDraft(key, value) {
  chrome.storage.local.set({ [key]: value });
}

function debouncedSave(key, value) {
  clearTimeout(draftTimers[key]);
  draftTimers[key] = setTimeout(() => saveDraft(key, value), 400);
}

function loadDrafts() {
  chrome.storage.local.get(DRAFT_KEYS, (result) => {
    if (result.draftClientMessage) els.clientMessage.value = result.draftClientMessage;
    if (result.draftReplyContext)  els.replyContext.value  = result.draftReplyContext;
    if (result.draftRoughDraft)    els.roughDraft.value    = result.draftRoughDraft;
    if (result.draftTone)          els.toneSelect.value    = result.draftTone;
    // Sync counters after restore
    applyWordLimit(els.clientMessage, 'counter-client-message', WORD_LIMITS.clientMessage);
    applyWordLimit(els.replyContext,  'counter-reply-context',  WORD_LIMITS.replyContext);
    applyWordLimit(els.roughDraft,    'counter-rough-draft',    WORD_LIMITS.roughDraft);
  });
}

function clearDraft(key, el) {
  el.value = '';
  chrome.storage.local.remove(key);
  el.focus();
}

// ─── Init ─────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  bindEvents();
});

// ─── Storage: load ────────────────────────────────────────────────────────────
function loadSettings() {
  chrome.storage.local.get(
    ['activeProvider', 'model', 'openaiKey', 'geminiKey', 'claudeKey', 'groqKey', 'hfKey'],
    (result) => {
      state.activeProvider = result.activeProvider || 'openai';
      state.openaiKey      = result.openaiKey      || '';
      state.geminiKey      = result.geminiKey      || '';
      state.claudeKey      = result.claudeKey      || '';
      state.groqKey        = result.groqKey        || '';
      state.hfKey          = result.hfKey          || '';

      // Pre-fill key inputs
      els.openaiKeyInput.value = state.openaiKey;
      els.geminiKeyInput.value = state.geminiKey;
      els.claudeKeyInput.value = state.claudeKey;
      els.groqKeyInput.value   = state.groqKey;
      els.hfKeyInput.value     = state.hfKey;

      // Render provider buttons + model dropdown
      renderProviderButtons(state.activeProvider);
      populateModelDropdown(state.activeProvider);

      // Restore saved model selection (if valid for provider)
      const validValues = PROVIDER_MODELS[state.activeProvider].map(m => m.value);
      const savedModel  = result.model || PROVIDER_MODELS[state.activeProvider][0].value;
      els.modelSelect.value = validValues.includes(savedModel)
        ? savedModel
        : PROVIDER_MODELS[state.activeProvider][0].value;
      state.model = els.modelSelect.value;

      // Route to correct screen
      if (getActiveKey()) {
        showMainApp();
      } else {
        showNoKeyScreen();
      }
      loadDrafts();
    }
  );
}

// ─── Storage: save ────────────────────────────────────────────────────────────
function saveSettings() {
  const openaiKey = els.openaiKeyInput.value.trim();
  const geminiKey = els.geminiKeyInput.value.trim();
  const claudeKey = els.claudeKeyInput.value.trim();
  const groqKey   = els.groqKeyInput.value.trim();
  const hfKey     = els.hfKeyInput.value.trim();
  const provider  = state.activeProvider;
  const model     = els.modelSelect.value;

  // Validate the active provider has a key
  const activeKey = { openai: openaiKey, gemini: geminiKey, claude: claudeKey, groq: groqKey, hf: hfKey }[provider];
  if (!activeKey) {
    showSettingsStatus(
      `Enter a ${PROVIDER_LABELS[provider]} API key, or switch to a provider with a key.`,
      'error'
    );
    return;
  }

  const payload = { activeProvider: provider, model, openaiKey, geminiKey, claudeKey, groqKey, hfKey };
  chrome.storage.local.set(payload, () => {
    Object.assign(state, { activeProvider: provider, model, openaiKey, geminiKey, claudeKey, groqKey, hfKey });
    showSettingsStatus('Saved!', 'success');
    setTimeout(() => {
      els.settingsPanel.classList.add('hidden');
      showMainApp();
    }, 700);
  });
}

// ─── Storage: clear ───────────────────────────────────────────────────────────
function clearSettings() {
  chrome.storage.local.remove(
    ['activeProvider', 'model', 'openaiKey', 'geminiKey', 'claudeKey', 'groqKey', 'hfKey'],
    () => {
      state = { activeProvider: 'openai', model: 'gpt-4o-mini', openaiKey: '', geminiKey: '', claudeKey: '', groqKey: '', hfKey: '' };
      els.openaiKeyInput.value = '';
      els.geminiKeyInput.value = '';
      els.claudeKeyInput.value = '';
      els.groqKeyInput.value   = '';
      els.hfKeyInput.value     = '';
      renderProviderButtons('openai');
      populateModelDropdown('openai');
      showSettingsStatus('All keys cleared.', 'success');
      setTimeout(() => {
        els.settingsPanel.classList.add('hidden');
        showNoKeyScreen();
      }, 700);
    }
  );
}

// ─── Provider UI helpers ──────────────────────────────────────────────────────
function renderProviderButtons(active) {
  els.providerBtns.forEach((btn) => {
    const isActive = btn.dataset.provider === active;
    btn.className = isActive
      ? 'provider-btn provider-active'
      : 'provider-btn provider-inactive';
  });
}

function populateModelDropdown(provider) {
  const models = PROVIDER_MODELS[provider];
  els.modelSelect.innerHTML = models
    .map(m => `<option value="${m.value}">${m.label}</option>`)
    .join('');
}

// ─── Active key helper ────────────────────────────────────────────────────────
function getActiveKey() {
  return { openai: state.openaiKey, gemini: state.geminiKey, claude: state.claudeKey, groq: state.groqKey, hf: state.hfKey }[state.activeProvider] || '';
}

// ─── Screen helpers ───────────────────────────────────────────────────────────
function showMainApp() {
  els.noKeyScreen.classList.add('hidden');
  els.mainApp.classList.remove('hidden');
}

function showNoKeyScreen() {
  els.mainApp.classList.add('hidden');
  els.noKeyScreen.classList.remove('hidden');
}

function showSettingsStatus(msg, type) {
  els.settingsStatus.textContent = msg;
  els.settingsStatus.className = [
    'text-xs mt-2 text-center',
    type === 'success' ? 'text-green-400' : 'text-red-400',
  ].join(' ');
  els.settingsStatus.classList.remove('hidden');
  setTimeout(() => els.settingsStatus.classList.add('hidden'), 3000);
}

// ─── Tab switching ────────────────────────────────────────────────────────────
function switchTab(active) {
  const isReply = active === 'reply';
  els.tabReply.className   = `tab-btn ${isReply ? 'tab-active' : 'tab-inactive'}`;
  els.tabEnhance.className = `tab-btn ${!isReply ? 'tab-active' : 'tab-inactive'}`;
  els.panelReply.classList.toggle('hidden', !isReply);
  els.panelEnhance.classList.toggle('hidden', isReply);
}

// ─── LLM API router ───────────────────────────────────────────────────────────
async function callLLM(systemPrompt, userContent, maxTokens = 250) {
  const provider = state.activeProvider;
  const model    = state.model;
  const apiKey   = getActiveKey();

  if (!apiKey) throw new Error('No API key found for the active provider. Open Settings to add one.');

  if (provider === 'openai')  return callOpenAI(apiKey, model, systemPrompt, userContent, maxTokens);
  if (provider === 'gemini')  return callGemini(apiKey, model, systemPrompt, userContent, maxTokens);
  if (provider === 'claude')  return callClaude(apiKey, model, systemPrompt, userContent, maxTokens);
  if (provider === 'groq')    return callGroq(apiKey, model, systemPrompt, userContent, maxTokens);
  if (provider === 'hf')      return callHuggingFace(apiKey, model, systemPrompt, userContent, maxTokens);

  throw new Error('Unknown provider.');
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────
async function callOpenAI(apiKey, model, systemPrompt, userContent, maxTokens) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      temperature: 0.6,
      max_tokens:  maxTokens,
    }),
  });
  await assertOk(res, 'OpenAI');
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function callGemini(apiKey, model, systemPrompt, userContent, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: userContent }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: maxTokens },
    }),
  });
  await assertOk(res, 'Gemini');
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? '';
}

// ─── Groq ─────────────────────────────────────────────────────────────────────
async function callGroq(apiKey, model, systemPrompt, userContent, maxTokens) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      temperature: 0.6,
      max_tokens:  maxTokens,
    }),
  });
  await assertOk(res, 'Groq');
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ─── HuggingFace ──────────────────────────────────────────────────────────────
async function callHuggingFace(apiKey, model, systemPrompt, userContent, maxTokens) {
  const res = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      temperature: 0.6,
      max_tokens:  maxTokens,
    }),
  });
  await assertOk(res, 'HuggingFace');
  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() ?? '';
}

// ─── Claude ───────────────────────────────────────────────────────────────────
async function callClaude(apiKey, model, systemPrompt, userContent, maxTokens) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':                          'application/json',
      'x-api-key':                             apiKey,
      'anthropic-version':                     '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system:     systemPrompt,
      messages:   [{ role: 'user', content: userContent }],
    }),
  });
  await assertOk(res, 'Claude');
  const data = await res.json();
  return data.content?.[0]?.text?.trim() ?? '';
}

// ─── Shared error checker ─────────────────────────────────────────────────────
async function assertOk(res, provider) {
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const msg = err?.error?.message
      || err?.error?.status
      || `${provider} API error ${res.status}`;
    throw new Error(msg);
  }
}

// ─── Tool 1: Smart Reply ──────────────────────────────────────────────────────
async function handleGenerateReply() {
  const clientMsg = els.clientMessage.value.trim();
  const userCtx   = els.replyContext.value.trim();

  if (!clientMsg) {
    showError(els.replyError, "Please paste the client's message first.");
    return;
  }

  setReplyLoading(true);
  hideError(els.replyError);
  els.replyOutputWrap.classList.add('hidden');

  const maxWords = Math.round(state.replyTokens * 0.7);
  const systemPrompt = `Freelance web developer assistant. Write natural, polite replies to client messages — clear and conversational, never stiff or corporate. No subject line, no labels, no explanation. Max ${maxWords} words.`;

  const userContent = `Client: "${clientMsg}"${userCtx ? `\nKey points: ${userCtx}` : ''}`;

  try {
    const result = await callLLM(systemPrompt, userContent, state.replyTokens);
    els.replyOutput.textContent = result;
    els.replyOutputWrap.classList.remove('hidden');
  } catch (err) {
    showError(els.replyError, err.message);
  } finally {
    setReplyLoading(false);
  }
}

function setReplyLoading(loading) {
  els.generateReplyBtn.disabled      = loading;
  els.generateReplyLabel.textContent = loading ? 'Generating...' : 'Generate Reply';
  els.replyIcon.classList.toggle('hidden', loading);
  els.replySpinner.classList.toggle('hidden', !loading);
}

// ─── Tool 2: Message Enhancer ─────────────────────────────────────────────────
async function handleEnhanceMessage() {
  const draft = els.roughDraft.value.trim();
  const tone  = els.toneSelect.value;

  if (!draft) {
    showError(els.enhanceError, 'Please enter your rough draft first.');
    return;
  }

  setEnhanceLoading(true);
  hideError(els.enhanceError);
  els.enhanceOutputWrap.classList.add('hidden');

  const maxWords = Math.round(state.enhanceTokens * 0.7);
  const systemPrompt = `Rewrite rough drafts from a freelance developer into clear, polite, natural professional messages. Keep the full meaning. Output rewritten text only — no labels, no explanation. Max ${maxWords} words.`;

  const userContent = `Tone: ${tone}\nDraft: "${draft}"`;

  try {
    const result = await callLLM(systemPrompt, userContent, state.enhanceTokens);
    els.enhanceOutput.textContent = result;
    els.enhanceOutputWrap.classList.remove('hidden');
  } catch (err) {
    showError(els.enhanceError, err.message);
  } finally {
    setEnhanceLoading(false);
  }
}

function setEnhanceLoading(loading) {
  els.enhanceBtn.disabled        = loading;
  els.enhanceLabel.textContent   = loading ? 'Enhancing...' : 'Enhance Message';
  els.enhanceIcon.classList.toggle('hidden', loading);
  els.enhanceSpinner.classList.toggle('hidden', !loading);
}

// ─── Copy to clipboard ────────────────────────────────────────────────────────
async function copyText(text, btn) {
  const originalHTML = btn.innerHTML;
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // execCommand fallback
    const ta = Object.assign(document.createElement('textarea'), {
      value: text,
      style: 'position:fixed;opacity:0',
    });
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
  btn.textContent = 'Copied!';
  btn.classList.add('copy-flash');
  setTimeout(() => {
    btn.innerHTML = originalHTML;
    btn.classList.remove('copy-flash');
  }, 1500);
}

// ─── Error helpers ────────────────────────────────────────────────────────────
function showError(el, msg) { el.textContent = msg; el.classList.remove('hidden'); }
function hideError(el)       { el.classList.add('hidden'); el.textContent = ''; }

// ─── Event bindings ───────────────────────────────────────────────────────────
function bindEvents() {
  // Settings panel toggle
  els.settingsToggleBtn.addEventListener('click', () => {
    els.settingsPanel.classList.toggle('hidden');
  });

  // "Open Settings" from no-key screen
  els.noKeyOpenSettingsBtn.addEventListener('click', () => {
    els.settingsPanel.classList.remove('hidden');
  });

  // Provider selector buttons
  els.providerBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const provider = btn.dataset.provider;
      state.activeProvider = provider;
      renderProviderButtons(provider);
      populateModelDropdown(provider);
    });
  });

  // Model dropdown — keep state in sync
  els.modelSelect.addEventListener('change', () => {
    state.model = els.modelSelect.value;
  });

  // Save / clear
  els.saveSettingsBtn.addEventListener('click', saveSettings);
  els.clearKeyBtn.addEventListener('click', clearSettings);

  // Tabs
  els.tabReply.addEventListener('click',   () => switchTab('reply'));
  els.tabEnhance.addEventListener('click', () => switchTab('enhance'));

  // Generate / Enhance
  els.generateReplyBtn.addEventListener('click', handleGenerateReply);
  els.enhanceBtn.addEventListener('click', handleEnhanceMessage);

  // Enter in context input triggers generation
  els.replyContext.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleGenerateReply();
  });

  // Copy buttons
  els.copyReplyBtn.addEventListener('click', () => {
    copyText(els.replyOutput.textContent, els.copyReplyBtn);
  });
  els.copyEnhanceBtn.addEventListener('click', () => {
    copyText(els.enhanceOutput.textContent, els.copyEnhanceBtn);
  });

  // Word limits + save drafts on input
  els.clientMessage.addEventListener('input', () => {
    applyWordLimit(els.clientMessage, 'counter-client-message', WORD_LIMITS.clientMessage);
    debouncedSave('draftClientMessage', els.clientMessage.value);
  });
  els.replyContext.addEventListener('input', () => {
    applyWordLimit(els.replyContext, 'counter-reply-context', WORD_LIMITS.replyContext);
    debouncedSave('draftReplyContext', els.replyContext.value);
  });
  els.roughDraft.addEventListener('input', () => {
    applyWordLimit(els.roughDraft, 'counter-rough-draft', WORD_LIMITS.roughDraft);
    debouncedSave('draftRoughDraft', els.roughDraft.value);
  });
  els.toneSelect.addEventListener('change',   () => saveDraft('draftTone', els.toneSelect.value));

  // Output length selectors
  document.getElementById('reply-length-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('.length-btn');
    if (!btn) return;
    document.querySelectorAll('#reply-length-btns .length-btn').forEach(b => b.classList.remove('length-active'));
    btn.classList.add('length-active');
    state.replyTokens = Number(btn.dataset.tokens);
  });
  document.getElementById('enhance-length-btns').addEventListener('click', (e) => {
    const btn = e.target.closest('.length-btn');
    if (!btn) return;
    document.querySelectorAll('#enhance-length-btns .length-btn').forEach(b => b.classList.remove('length-active'));
    btn.classList.add('length-active');
    state.enhanceTokens = Number(btn.dataset.tokens);
  });

  // Clear (×) buttons
  document.getElementById('clear-client-message').addEventListener('click', () => clearDraft('draftClientMessage', els.clientMessage));
  document.getElementById('clear-reply-context').addEventListener('click',  () => clearDraft('draftReplyContext',  els.replyContext));
  document.getElementById('clear-rough-draft').addEventListener('click',    () => clearDraft('draftRoughDraft',    els.roughDraft));
}
