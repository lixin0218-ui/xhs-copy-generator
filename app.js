(function () {
  'use strict';

  // ================= 常量 & 存储 =================
  const LS = {
    key: 'xhs_api_key',
    model: 'xhs_model',
    conc: 'xhs_concurrency',
    history: 'xhs_history',
    lastInput: 'xhs_last_input',
  };
  const PRESETS = window.XHSPresets || { general: { name: '通用', desc: '', system: '', audience: '', keywords: [], tags: [], checks: [] } };
  const presetOf = (id) => PRESETS[id] || PRESETS.general;
  const MAX_HISTORY = 50;
  const MODE_NAMES = { ai: 'AI', template: '模板', import: '导入' };
  const TONE_NAMES = { ganhuo: '干货科普', zhongcao: '种草分享', bikeng: '避坑提醒', tiyan: '真实体验' };
  const MODEL_NAMES = {
    'claude-opus-5-5': 'Claude Opus 5.5',
    'claude-sonnet-5-5': 'Claude Sonnet 5.5',
    'claude-haiku-5-5': 'Claude Haiku 5.5',
  };
  const API_URL = 'https://api.anthropic.com/v1/messages';

  const store = {
    get(k, def = null) {
      try { const v = localStorage.getItem(k); return v === null ? def : v; } catch { return def; }
    },
    set(k, v) {
      try { localStorage.setItem(k, v); return true; } catch { return false; }
    },
    del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
    json(k, def) {
      try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : def; } catch { return def; }
    },
  };

  // ================= DOM =================
  const $ = (id) => document.getElementById(id);
  const el = {
    form: $('genForm'), topic: $('topic'), audience: $('audience'),
    kwBox: $('kwBox'), kwChips: $('kwChips'), kwInput: $('kwInput'),
    count: $('count'), countNum: $('countNum'), countVal: $('countVal'),
    modeHint: $('modeHint'), btnGenerate: $('btnGenerate'), btnStop: $('btnStop'),
    results: $('results'), resultMeta: $('resultMeta'),
    progress: $('progress'), progressFill: $('progressFill'), progressText: $('progressText'),
    btnCopyAll: $('btnCopyAll'), btnCsv: $('btnCsv'), btnTxt: $('btnTxt'), btnJson: $('btnJson'),
    presetHint: $('presetHint'),
    settingsDlg: $('settingsDlg'), apiKey: $('apiKey'), model: $('model'), concurrency: $('concurrency'),
    settingsMsg: $('settingsMsg'),
    historyDlg: $('historyDlg'), historyList: $('historyList'),
    toast: $('toast'),
  };

  let keywords = [];
  let current = null; // { id, time, input, mode, model, posts: [] }
  let abortCtrl = null;

  // ================= 工具 =================
  const textLen = (s) => Array.from(String(s || '')).length;
  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  let toastTimer;
  function toast(msg, ms = 1800) {
    el.toast.textContent = msg;
    el.toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove('show'), ms);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.style.cssText = 'position:fixed;top:-1000px;opacity:0';
      document.body.appendChild(ta);
      ta.select();
      ta.setSelectionRange(0, text.length);
      try { document.execCommand('copy'); } catch { /* ignore */ }
      ta.remove();
    }
    toast('✅ 已复制');
  }
  function fmtTime(ts) {
    const d = new Date(ts);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const sleep = (ms, signal) => new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => { clearTimeout(t); reject(new DOMException('Aborted', 'AbortError')); }, { once: true });
  });

  // ================= 关键词输入 =================
  function renderChips() {
    el.kwChips.innerHTML = keywords.map((k, i) =>
      `<span class="chip">${esc(k)}<button type="button" data-i="${i}" aria-label="删除 ${esc(k)}">×</button></span>`).join('');
  }
  function addKeywords(raw) {
    raw.split(/[,，、;；\n]/).map((s) => s.trim()).filter(Boolean).forEach((k) => {
      if (!keywords.includes(k) && keywords.length < 15) keywords.push(k.slice(0, 20));
    });
    renderChips();
  }
  el.kwInput.addEventListener('keydown', (e) => {
    if ((e.key === 'Enter' || e.key === ',' || e.key === '，') && !e.isComposing) {
      e.preventDefault();
      if (el.kwInput.value.trim()) { addKeywords(el.kwInput.value); el.kwInput.value = ''; }
    } else if (e.key === 'Backspace' && !el.kwInput.value && keywords.length) {
      keywords.pop(); renderChips();
    }
  });
  el.kwInput.addEventListener('input', () => {
    if (/[,，、;；]/.test(el.kwInput.value)) { addKeywords(el.kwInput.value); el.kwInput.value = ''; }
  });
  el.kwInput.addEventListener('blur', () => {
    if (el.kwInput.value.trim()) { addKeywords(el.kwInput.value); el.kwInput.value = ''; }
  });
  el.kwChips.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (b) { keywords.splice(Number(b.dataset.i), 1); renderChips(); }
  });
  el.kwBox.addEventListener('click', (e) => { if (e.target === el.kwBox) el.kwInput.focus(); });

  // ================= 数量 & 模式 =================
  function setCount(v) {
    const n = Math.max(1, Math.min(20, parseInt(v, 10) || 1));
    el.count.value = n; el.countNum.value = n; el.countVal.textContent = n;
  }
  el.count.addEventListener('input', () => setCount(el.count.value));
  el.countNum.addEventListener('change', () => setCount(el.countNum.value));

  const getMode = () => el.form.querySelector('input[name=mode]:checked').value;
  const getTone = () => el.form.querySelector('input[name=tone]:checked').value;
  function updateModeHint() {
    if (getMode() === 'ai') {
      const hasKey = !!store.get(LS.key);
      const model = MODEL_NAMES[store.get(LS.model, 'claude-opus-5-5')] || '';
      el.modeHint.innerHTML = hasKey
        ? `已配置 API Key ✅ 当前模型：${esc(model)}（<a href="#" data-open-settings>修改</a>）`
        : '⚠️ 还没有填写 API Key，<a href="#" data-open-settings>点这里去设置</a>';
    } else {
      el.modeHint.textContent = '用内置标题公式和段落模板随机组合，秒出结果，适合找灵感后再手动润色。';
    }
  }
  el.form.addEventListener('change', (e) => { if (e.target.name === 'mode') updateModeHint(); });

  // ================= 账号人设 =================
  const getPreset = () => el.form.querySelector('input[name=preset]:checked')?.value || 'general';
  function updatePresetHint() {
    el.presetHint.textContent = presetOf(getPreset()).desc || '';
  }
  let lastPreset = 'general';
  el.form.addEventListener('change', (e) => {
    if (e.target.name !== 'preset') return;
    const prev = presetOf(lastPreset);
    const p = presetOf(e.target.value);
    lastPreset = e.target.value;
    // 空着的、或者还是上一个人设默认值的输入框才替换；用户自己写的内容不动
    const aud = el.audience.value.trim();
    if (!aud || aud === prev.audience) el.audience.value = p.audience || '';
    if (!keywords.length || keywords.join('|') === prev.keywords.join('|')) { keywords = p.keywords.slice(); renderChips(); }
    updatePresetHint();
  });
  el.modeHint.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-settings]')) { e.preventDefault(); openSettings(); }
  });

  // ================= 设置 =================
  function openSettings() {
    el.apiKey.value = store.get(LS.key, '');
    el.apiKey.type = 'password';
    $('btnToggleKey').textContent = '显示';
    el.model.value = store.get(LS.model, 'claude-opus-5-5');
    el.concurrency.value = store.get(LS.conc, '2');
    el.settingsMsg.textContent = '';
    el.settingsDlg.showModal();
  }
  $('btnSettings').addEventListener('click', openSettings);
  $('btnToggleKey').addEventListener('click', () => {
    const show = el.apiKey.type === 'password';
    el.apiKey.type = show ? 'text' : 'password';
    $('btnToggleKey').textContent = show ? '隐藏' : '显示';
  });
  function saveSettings() {
    const k = el.apiKey.value.trim();
    if (k) store.set(LS.key, k); else store.del(LS.key);
    store.set(LS.model, el.model.value);
    store.set(LS.conc, el.concurrency.value);
    updateModeHint();
  }
  $('btnSaveSettings').addEventListener('click', () => {
    const k = el.apiKey.value.trim();
    if (k && !k.startsWith('sk-ant-')) {
      el.settingsMsg.textContent = '⚠️ Key 一般以 sk-ant- 开头，请确认是否复制完整。已先保存。';
      saveSettings();
      return;
    }
    saveSettings();
    el.settingsDlg.close();
    toast(k ? '✅ 设置已保存（仅存于本机浏览器）' : '设置已保存');
  });
  $('btnClearKey').addEventListener('click', () => {
    store.del(LS.key);
    el.apiKey.value = '';
    updateModeHint();
    el.settingsMsg.textContent = '🗑 已从本机浏览器清除 API Key。';
  });
  $('btnTestKey').addEventListener('click', async () => {
    const k = el.apiKey.value.trim();
    if (!k) { el.settingsMsg.textContent = '请先填写 API Key'; return; }
    el.settingsMsg.textContent = '⏳ 正在测试连接…';
    try {
      await callClaude({
        apiKey: k, model: el.model.value, maxTokens: 64, effort: 'low',
        messages: [{ role: 'user', content: '只回复两个字：成功' }],
      });
      el.settingsMsg.textContent = '✅ 连接成功，可以使用 AI 模式了！记得点「保存」。';
    } catch (err) {
      el.settingsMsg.textContent = '❌ ' + err.message;
    }
  });

  // ================= Claude API =================
  class ApiError extends Error {
    constructor(message, { status = 0, retryable = false, retryAfter = 0 } = {}) {
      super(message);
      this.status = status; this.retryable = retryable; this.retryAfter = retryAfter;
    }
  }

  /** 浏览器直接调用 Anthropic Messages API（Key 只发往 api.anthropic.com） */
  async function callClaude({ apiKey, model, messages, system, maxTokens = 8000, effort = 'medium', format, signal }) {
    const body = {
      model,
      max_tokens: maxTokens,
      messages,
      output_config: { effort },
    };
    if (system) body.system = system;
    if (format) body.output_config.format = format;

    const headers = {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2026-10-21',
      // 允许浏览器直接跨域调用（Key 由用户自己提供、只存本地）
      'anthropic-dangerous-direct-browser-access': 'true',
    };
    // Opus / Sonnet：开启服务端拒答兜底（被安全分类器拒绝时自动换模型重试）
    if (model !== 'claude-haiku-5-5') {
      body.fallbacks = 'default';
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
    }

    let res;
    try {
      res = await fetch(API_URL, { method: 'POST', headers, body: JSON.stringify(body), signal });
    } catch (err) {
      if (err.name === 'AbortError') throw err;
      throw new ApiError('网络连接失败，请检查网络（国内网络可能需要代理才能访问 api.anthropic.com）', { retryable: true });
    }

    let data = null;
    try { data = await res.json(); } catch { /* ignore */ }

    if (!res.ok) {
      const apiMsg = data?.error?.message || '';
      const retryAfter = parseFloat(res.headers.get('retry-after')) || 0;
      const map = {
        400: '请求参数有误：' + apiMsg,
        401: 'API Key 无效或已失效，请在设置中检查',
        403: '这个 Key 没有权限访问该模型：' + apiMsg,
        404: '模型不存在或不可用，请在设置中换一个模型',
        413: '请求内容过长',
        429: '请求太频繁或额度不足（限流），稍后自动重试',
        500: 'Anthropic 服务器错误，稍后自动重试',
        529: 'Anthropic 服务繁忙（过载），稍后自动重试',
      };
      const msg = map[res.status] || `请求失败（HTTP ${res.status}）${apiMsg ? '：' + apiMsg : ''}`;
      if (res.status === 400 && /credit balance/i.test(apiMsg)) {
        throw new ApiError('账户余额不足，请到 Anthropic Console 充值', { status: 400 });
      }
      throw new ApiError(msg, {
        status: res.status,
        retryable: res.status === 429 || res.status >= 500,
        retryAfter,
      });
    }

    if (data?.stop_reason === 'refusal') {
      throw new ApiError('模型拒绝了这次请求（可能触发了安全策略），请调整主题或关键词后再试');
    }
    const text = (data?.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
    if (data?.stop_reason === 'max_tokens' && !text) {
      throw new ApiError('输出被截断，请重试', { retryable: true });
    }
    return text;
  }

  const POST_SCHEMA = {
    type: 'object',
    properties: {
      titles: { type: 'array', items: { type: 'string' }, description: '3 个备选标题' },
      body: { type: 'string', description: '正文' },
      cta: { type: 'string', description: '结尾互动引导' },
      tags: { type: 'array', items: { type: 'string' }, description: '5-10 个话题标签，以 # 开头' },
      cover_title: { type: 'string', description: '封面主标题，不超过 10 个字' },
      cover_subtitle: { type: 'string', description: '封面副标题，不超过 15 个字' },
      cover_layout: { type: 'string', description: '封面构图建议，一句话' },
      images: { type: 'array', items: { type: 'string' }, description: '6-9 张配图，每张写清拍什么、角度、图上加什么字' },
      pinned_comment: { type: 'string', description: '评论区置顶回复' },
    },
    required: ['titles', 'body', 'cta', 'tags', 'cover_title', 'cover_subtitle', 'cover_layout', 'images', 'pinned_comment'],
    additionalProperties: false,
  };

  const SYSTEM_PROMPT = `你是一位资深的小红书爆款文案写手，熟悉平台调性、用户阅读习惯和社区规范。
请根据用户给出的主题、目标人群、关键词和语气风格，写一篇小红书笔记，按要求的 JSON 结构输出。

要求：
- titles：恰好 3 个备选标题，每个不超过 20 个字（emoji 算 1 个字），风格各不相同（比如数字型、悬念型、情绪型），可以带 1-2 个 emoji，要有点击欲但不夸大、不标题党。
- body：正文 300-600 字。口语化、像真人在分享，分 4-7 段，段与段之间空一行；适当使用 emoji（每段 0-2 个，不要堆砌）；可以用 1️⃣2️⃣3️⃣ 或 ✅❌ 做小标题/要点；自然融入关键词。正文里不要写话题标签，也不要写结尾互动引导。
- cta：1-2 句结尾互动引导，引导评论、点赞、收藏或关注，语气自然。
- tags：5-10 个话题标签，每个以 # 开头、不含空格，包含主题词、关键词词、人群词和泛流量词。
- cover_title / cover_subtitle：封面大字，主标题不超过 10 个字，副标题不超过 15 个字；cover_layout：一句话封面构图建议（比如“左右对比图：改造前 / 改造后”）。
- images：6-9 条配图建议，每条写清楚拍什么、什么角度、图上加什么字，优先真人实拍，不要依赖网图。
- pinned_comment：1-2 句评论区置顶回复，引导私信或评论，不留站外联系方式。
- 遵守小红书社区规范：不使用"最""第一""100%"等绝对化用语，不做医疗/功效承诺，不出现微信号、价格引流、站外链接等内容。
- 不要编造具体的品牌型号、价格、数据，除非用户提供。`;

  const ANGLES = [
    '新手入门视角', '常见误区拆解', '选购/决策清单', '使用场景对比', '个人经历故事',
    '预算/性价比角度', '细节与小技巧', '问答形式（Q&A）', '前后对比/改变', '进阶玩家视角',
    '一句话总结+展开', '身边朋友的反馈', '时间线（使用一周/一个月后）', '优缺点直说', '反常识观点',
    '清单体（N 个要点）', '情绪共鸣开场', '踩坑后的复盘', '给不同人群的建议', '收藏向速查表',
  ];

  function buildUserPrompt(input, index, total) {
    const lines = [
      `主题/产品：${input.topic}`,
      `目标人群：${input.audience || '不限'}`,
      `关键词：${input.keywords.length ? input.keywords.join('、') : '（未指定，可自行围绕主题选择）'}`,
      `语气风格：${TONE_NAMES[input.tone]}`,
    ];
    if (total > 1) {
      lines.push(`这是同一主题批量生成的第 ${index + 1}/${total} 篇。为了和其他篇有区分，这篇请侧重「${ANGLES[index % ANGLES.length]}」，开头、结构和标题都要换一种写法。`);
    }
    return lines.join('\n');
  }

  function parsePost(text) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new ApiError('返回内容无法解析，正在重试', { retryable: true });
      obj = JSON.parse(m[0]);
    }
    const titles = (Array.isArray(obj.titles) ? obj.titles : []).map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
    const tags = (Array.isArray(obj.tags) ? obj.tags : [])
      .map((s) => String(s).trim().replace(/\s+/g, ''))
      .filter(Boolean)
      .map((s) => (s.startsWith('#') ? s : '#' + s))
      .slice(0, 10);
    const body = String(obj.body || '').trim();
    if (!titles.length || !body) throw new ApiError('返回内容不完整，正在重试', { retryable: true });
    const str = (v) => String(v || '').trim();
    return {
      titles, body, cta: str(obj.cta), tags,
      coverTitle: str(obj.cover_title),
      coverSubtitle: str(obj.cover_subtitle),
      coverLayout: str(obj.cover_layout),
      images: (Array.isArray(obj.images) ? obj.images : []).map(str).filter(Boolean).slice(0, 9),
      pinned: str(obj.pinned_comment),
    };
  }

  function buildSystemPrompt(presetId) {
    const add = presetOf(presetId).system;
    return add ? `${SYSTEM_PROMPT}\n\n${add}` : SYSTEM_PROMPT;
  }

  // ================= 合规自检（本地规则，不调用 API） =================
  const CHECK_RULES = {
    base: [
      { re: /最好|最佳|最强|最低价|最便宜|最优|最高级|最安全|第一(?![次步眼天篇个时周批件])|唯一|100%|百分之百|百分百|国家级|顶级|绝对|首选|万能|永久/g,
        msg: (w) => `极限词「${w}」：《广告法》禁用，可换成“我个人更推荐”“用下来很稳”` },
      { re: /微信|威信|[vV][xX]|\b[wW][xX]\b|加我|手机号|电话号码|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b|https?:\/\/\S+|www\.\S+|[\w.-]+@[\w-]+\.[a-z]{2,}|\b[\w-]+\.(?:com|net|org|cn)\b/gi,
        msg: (w) => `站外联系方式「${w}」：容易被判定导流限流，改成“私信我”` },
    ],
    license: [
      { re: /持牌|有牌照|有执照|执照承包商|licensed(?:\s*contractor)?/gi,
        msg: (w) => `「${w}」：目前没有加州承包商执照，不能写或暗示持牌` },
    ],
    install: [
      { re: /我来装|我亲自(?:上门)?安装|我上门安装|我帮你装|我给你装/g,
        msg: (w) => `「${w}」：改成“安排量尺和安装”，除非已确认安装方有 CSLB 执照` },
    ],
    partner: [
      { re: /door\s*father|门教父/gi,
        msg: (w) => `出现合作方品牌「${w}」：只推广自己的账号，改成“我们的合作伙伴”` },
    ],
    diving: [
      { re: /不用考证|无需证书|不用证书|没证也能|无证潜水/g,
        msg: (w) => `「${w}」：不符合 PADI 安全标准，不能鼓励无证或超资质潜水` },
    ],
  };

  function checkPost(p, presetId) {
    const text = [
      ...(p.titles || []), p.body, p.cta, p.coverTitle, p.coverSubtitle, p.pinned,
    ].filter(Boolean).join('\n');
    const groups = ['base', ...(presetOf(presetId).checks || [])];
    const out = new Set();
    groups.forEach((g) => (CHECK_RULES[g] || []).forEach((rule) => {
      (text.match(rule.re) || []).forEach((w) => out.add(rule.msg(w)));
    }));
    if (/\$\s?\d|\d+\s?(?:刀|美元|美金)/.test(text) && !/仅供参考/.test(text)) {
      out.add('写了价格但没有“仅供参考，以实际报价为准”');
    }
    (p.titles || []).forEach((t) => { if (textLen(t) > 20) out.add(`标题超过 20 字：「${t}」`); });
    if (p.coverTitle && textLen(p.coverTitle) > 10) out.add('封面主标题超过 10 个字');
    return Array.from(out);
  }

  async function generateOneAI(input, index, total, signal) {
    const apiKey = store.get(LS.key);
    const model = store.get(LS.model, 'claude-opus-5-5');
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const text = await callClaude({
          apiKey, model, signal,
          system: buildSystemPrompt(input.preset),
          messages: [{ role: 'user', content: buildUserPrompt(input, index, total) }],
          maxTokens: 8000,
          effort: 'medium',
          format: { type: 'json_schema', schema: POST_SCHEMA },
        });
        return parsePost(text);
      } catch (err) {
        if (err.name === 'AbortError') throw err;
        lastErr = err;
        const retryable = err instanceof ApiError ? err.retryable : true;
        if (!retryable || attempt === 3) break;
        const wait = err.retryAfter ? err.retryAfter * 1000 : 2000 * Math.pow(2, attempt);
        await sleep(Math.min(wait, 30000), signal);
      }
    }
    throw lastErr;
  }

  // ================= 渲染 =================
  function postToText(p, i) {
    return [
      `【第 ${i + 1} 篇】`,
      '备选标题：',
      ...p.titles.map((t, j) => `${j + 1}. ${t}`),
      '',
      '正文：',
      p.body,
      '',
      p.cta,
      '',
      p.tags.join(' '),
      ...(p.coverTitle ? ['', `封面：${p.coverTitle}${p.coverSubtitle ? ' / ' + p.coverSubtitle : ''}`] : []),
      ...(p.coverLayout ? [`封面构图：${p.coverLayout}`] : []),
      ...(p.images?.length ? ['', '配图清单：', ...p.images.map((s, j) => `${j + 1}. ${s}`)] : []),
      ...(p.pinned ? ['', `置顶评论：${p.pinned}`] : []),
    ].join('\n');
  }
  function postCopyText(p) {
    return [p.titles[0] || '', '', p.body, '', p.cta, '', p.tags.join(' ')].join('\n');
  }

  function postHTML(p, i) {
    if (!p) return `<article class="post pending" data-i="${i}">⏳ 第 ${i + 1} 篇生成中…</article>`;
    if (p.error) return `<article class="post error" data-i="${i}"><div class="post-head"><span class="post-no">#${i + 1}</span></div>❌ ${esc(p.error)}</article>`;
    const titles = p.titles.map((t) => {
      const n = textLen(t);
      return `<li><span>${esc(t)}</span><span><span class="len ${n > 20 ? 'over' : ''}">${n}字</span><button class="mini-copy" type="button" data-copy-title="${esc(t)}">复制</button></span></li>`;
    }).join('');
    return `<article class="post" data-i="${i}">
      <div class="post-head">
        <span class="post-no">#${i + 1}</span>
        <div class="post-tools">
          <button class="btn ghost sm" type="button" data-act="copy-body" data-i="${i}">复制正文+标签</button>
          <button class="btn primary sm" type="button" data-act="copy" data-i="${i}">📋 一键复制</button>
        </div>
      </div>
      <div class="label">备选标题</div>
      <ul class="titles">${titles}</ul>
      <div class="label">正文</div>
      <div class="body">${esc(p.body)}</div>
      ${p.cta ? `<div class="label">互动引导</div><div class="cta">${esc(p.cta)}</div>` : ''}
      <div class="label">话题标签</div>
      <div class="tags">${p.tags.map((t) => `<span>${esc(t)}</span>`).join('')}</div>
      ${p.coverTitle ? `<div class="label">封面文案</div>
      <div class="cover"><b>${esc(p.coverTitle)}</b>${p.coverSubtitle ? ` <span class="cover-sub">｜${esc(p.coverSubtitle)}</span>` : ''}
        ${p.coverLayout ? `<div class="cover-layout">📐 ${esc(p.coverLayout)}</div>` : ''}</div>` : ''}
      ${p.images?.length ? `<div class="label">配图清单（${p.images.length} 张）</div>
      <ol class="images">${p.images.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
      ${p.pinned ? `<div class="label">置顶评论</div>
      <div class="pinned"><span>${esc(p.pinned)}</span><button class="mini-copy" type="button" data-copy-title="${esc(p.pinned)}">复制</button></div>` : ''}
      ${warnHTML(checkPost(p, current?.input?.preset))}
      <div class="post-foot">正文 ${textLen(p.body)} 字</div>
    </article>`;
  }

  function warnHTML(warns) {
    if (!warns.length) return '<div class="warns ok">✅ 合规自检：没发现问题（发布前仍建议自己读一遍）</div>';
    return `<div class="warns">⚠️ 合规自检发现 ${warns.length} 处需要改：<ul>${warns.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
  }

  function renderResults() {
    if (!current) return;
    el.results.innerHTML = current.posts.map((p, i) => postHTML(p, i)).join('');
    renderMeta();
  }
  function renderMeta() {
    const ok = current.posts.filter((p) => p && !p.error).length;
    el.resultMeta.textContent = `· ${presetOf(current.input.preset).name} · ${current.input.topic} · ${TONE_NAMES[current.input.tone]} · ${MODE_NAMES[current.mode] || '模板'} · ${ok} 篇`;
    const has = ok > 0;
    [el.btnCopyAll, el.btnCsv, el.btnTxt, el.btnJson].forEach((b) => { b.disabled = !has; });
  }
  function renderOne(i) {
    const node = el.results.querySelector(`.post[data-i="${i}"]`);
    if (node) node.outerHTML = postHTML(current.posts[i], i);
  }

  el.results.addEventListener('click', (e) => {
    const t = e.target.closest('[data-copy-title]');
    if (t) { copyText(t.dataset.copyTitle); return; }
    const b = e.target.closest('button[data-act]');
    if (!b || !current) return;
    const p = current.posts[Number(b.dataset.i)];
    if (!p || p.error) return;
    if (b.dataset.act === 'copy') copyText(postCopyText(p));
    if (b.dataset.act === 'copy-body') copyText([p.body, '', p.cta, '', p.tags.join(' ')].join('\n'));
  });

  function setProgress(done, total, extra = '') {
    el.progress.hidden = false;
    el.progressFill.style.width = `${total ? (done / total) * 100 : 0}%`;
    el.progressText.textContent = `已完成 ${done}/${total} 篇${extra ? ' · ' + extra : ''}`;
  }

  // ================= 生成 =================
  function readInput() {
    if (el.kwInput.value.trim()) { addKeywords(el.kwInput.value); el.kwInput.value = ''; }
    return {
      topic: el.topic.value.trim(),
      audience: el.audience.value.trim(),
      keywords: keywords.slice(),
      tone: getTone(),
      count: parseInt(el.count.value, 10) || 1,
      preset: getPreset(),
    };
  }

  /** 模板模式：把人设的话题标签合并进去（最多 10 个） */
  function withPresetTags(post, presetId) {
    const extra = (presetOf(presetId).tags || []).map((t) => '#' + t);
    const tags = [];
    [...post.tags.slice(0, 4), ...extra, ...post.tags.slice(4)].forEach((t) => {
      if (!tags.includes(t) && tags.length < 10) tags.push(t);
    });
    return { ...post, tags };
  }

  function setBusy(busy) {
    el.btnGenerate.disabled = busy;
    el.btnGenerate.textContent = busy ? '⏳ 生成中…' : '🚀 开始生成';
    el.btnStop.hidden = !busy;
  }

  el.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = readInput();
    if (!input.topic) { toast('请先填写主题/产品'); el.topic.focus(); return; }
    store.set(LS.lastInput, JSON.stringify(input));
    const mode = getMode();

    if (mode === 'ai' && !store.get(LS.key)) {
      toast('AI 模式需要先填写 API Key');
      openSettings();
      return;
    }

    current = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      time: Date.now(),
      input, mode,
      model: mode === 'ai' ? store.get(LS.model, 'claude-opus-5-5') : null,
      posts: new Array(input.count).fill(null),
    };

    if (mode === 'template') {
      current.posts = window.XHSTemplates.generateBatch(input, input.count).map((p) => withPresetTags(p, input.preset));
      el.progress.hidden = true;
      renderResults();
      saveHistory(current);
      toast(`✅ 已生成 ${input.count} 篇`);
      scrollToResults();
      return;
    }

    // ---- AI 模式：并发队列 ----
    renderResults();
    scrollToResults();
    setBusy(true);
    abortCtrl = new AbortController();
    const signal = abortCtrl.signal;
    const total = input.count;
    let next = 0, done = 0, failed = 0;
    setProgress(0, total, `正在调用 ${MODEL_NAMES[current.model] || current.model}…`);
    const conc = Math.max(1, Math.min(4, parseInt(store.get(LS.conc, '2'), 10) || 2));
    const batch = current;

    async function worker() {
      while (next < total && !signal.aborted) {
        const i = next++;
        try {
          batch.posts[i] = await generateOneAI(input, i, total, signal);
        } catch (err) {
          if (err.name === 'AbortError') { batch.posts[i] = { error: '已停止' }; }
          else {
            batch.posts[i] = { error: err.message || String(err) };
            failed++;
            // Key 无效 / 余额不足等不可恢复错误：停止后续请求
            if (err.status === 401 || err.status === 403 || /余额/.test(err.message)) abortCtrl.abort();
          }
        }
        done++;
        if (current === batch) {
          renderOne(i);
          renderMeta();
          setProgress(done, total, failed ? `${failed} 篇失败` : '');
        }
      }
    }

    await Promise.all(Array.from({ length: Math.min(conc, total) }, worker));
    // 被停止时，未开始的篇目标记为已停止
    batch.posts = batch.posts.map((p) => p || { error: '已停止' });
    setBusy(false);
    abortCtrl = null;
    if (current === batch) {
      renderResults();
      const ok = batch.posts.filter((p) => !p.error).length;
      setProgress(done, total, `完成：成功 ${ok} 篇${ok < total ? `，失败/停止 ${total - ok} 篇` : ''}`);
      toast(ok ? `✅ 生成完成：${ok} 篇` : '❌ 生成失败，请查看错误信息', 2500);
    }
    if (batch.posts.some((p) => !p.error)) saveHistory(batch);
  });

  el.btnStop.addEventListener('click', () => {
    if (abortCtrl) { abortCtrl.abort(); toast('已停止生成'); }
  });

  function scrollToResults() {
    if (window.matchMedia('(max-width: 900px)').matches) {
      el.results.closest('.card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  // ================= 导出 =================
  function validPosts() { return current ? current.posts.filter((p) => p && !p.error) : []; }
  function fileBase() {
    // 文件名只用 ASCII，避免部分浏览器（尤其手机端）忽略中文文件名
    const d = new Date(current?.time || Date.now());
    const p = (n) => String(n).padStart(2, '0');
    return `xhs-copy_${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }
  function csvCell(v) {
    let s = String(v ?? '');
    if (/^[=+\-@]/.test(s)) s = "'" + s; // 防止 Excel 公式注入
    return '"' + s.replace(/"/g, '""') + '"';
  }
  el.btnCsv.addEventListener('click', () => {
    const rows = [['序号', '标题1', '标题2', '标题3', '正文', '互动引导', '话题标签', '封面主标题', '封面副标题', '封面构图', '配图清单', '置顶评论', '合规提醒', '账号人设', '主题', '目标人群', '关键词', '语气风格']];
    validPosts().forEach((p, i) => rows.push([
      i + 1, p.titles[0] || '', p.titles[1] || '', p.titles[2] || '', p.body, p.cta, p.tags.join(' '),
      p.coverTitle || '', p.coverSubtitle || '', p.coverLayout || '',
      (p.images || []).map((s, j) => `${j + 1}. ${s}`).join('\n'), p.pinned || '',
      checkPost(p, current.input.preset).join('\n'),
      presetOf(current.input.preset).name,
      current.input.topic, current.input.audience, current.input.keywords.join('、'), TONE_NAMES[current.input.tone],
    ]));
    const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'); // BOM：Excel 打开不乱码
    download(fileBase() + '.csv', csv, 'text/csv;charset=utf-8');
  });
  // JSON：和「小红书内容助手」Skill 的批量模式字段一致
  el.btnJson.addEventListener('click', () => {
    const data = validPosts().map((p) => ({
      industry: presetOf(current.input.preset).name,
      title: p.titles[0] || '',
      alt_titles: p.titles.slice(1),
      cover_text: [p.coverTitle, p.coverSubtitle].filter(Boolean).join(' / '),
      cover_layout: p.coverLayout || '',
      body: p.body,
      cta: p.cta,
      hashtags: p.tags,
      image_notes: p.images || [],
      pinned_comment: p.pinned || '',
      warnings: checkPost(p, current.input.preset),
    }));
    download(fileBase() + '.json', JSON.stringify(data, null, 2), 'application/json;charset=utf-8');
  });
  function allText() {
    const head = [
      `账号人设：${presetOf(current.input.preset).name}`,
      `主题：${current.input.topic}`,
      `目标人群：${current.input.audience || '不限'}`,
      `关键词：${current.input.keywords.join('、') || '无'}`,
      `语气风格：${TONE_NAMES[current.input.tone]}`,
      `生成时间：${fmtTime(current.time)}`,
      '',
    ].join('\n');
    return head + '\n' + validPosts().map(postToText).join('\n\n' + '─'.repeat(20) + '\n\n');
  }
  el.btnTxt.addEventListener('click', () => download(fileBase() + '.txt', '﻿' + allText(), 'text/plain;charset=utf-8'));
  el.btnCopyAll.addEventListener('click', () => copyText(allText()));

  // ================= 导入（Claude 对话里生成的 JSON，不需要 API Key） =================
  const PRESET_BY_NAME = Object.fromEntries(Object.entries(PRESETS).map(([id, p]) => [p.name, id]));
  function normTags(v) {
    const arr = Array.isArray(v) ? v : String(v || '').split(/[\s,，]+/);
    return arr.map((t) => String(t).trim().replace(/\s+/g, '')).filter(Boolean)
      .map((t) => (t.startsWith('#') ? t : '#' + t)).slice(0, 10);
  }
  function importItem(o) {
    const str = (v) => String(v ?? '').trim();
    const titles = [o.title, ...(Array.isArray(o.alt_titles) ? o.alt_titles : []), ...(Array.isArray(o.titles) ? o.titles : [])]
      .map(str).filter(Boolean);
    const uniq = [...new Set(titles)].slice(0, 3);
    const body = str(o.body);
    if (!uniq.length || !body) return null;
    let coverTitle = str(o.cover_title), coverSubtitle = str(o.cover_subtitle);
    if (!coverTitle && o.cover_text) [coverTitle, coverSubtitle = ''] = str(o.cover_text).split(/\s*[\/｜|]\s*/);
    const images = Array.isArray(o.image_notes) ? o.image_notes : (Array.isArray(o.images) ? o.images : []);
    return {
      titles: uniq, body, cta: str(o.cta), tags: normTags(o.hashtags || o.tags),
      coverTitle: str(coverTitle), coverSubtitle: str(coverSubtitle), coverLayout: str(o.cover_layout),
      images: images.map(str).filter(Boolean).slice(0, 9), pinned: str(o.pinned_comment || o.pinned),
    };
  }
  function doImport(raw) {
    let data;
    try {
      const txt = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      data = JSON.parse(txt);
    } catch { throw new Error('不是有效的 JSON，请整段复制（从 [ 到 ]）再粘贴'); }
    if (!Array.isArray(data)) data = Array.isArray(data?.posts) ? data.posts : [data];
    const posts = data.map(importItem).filter(Boolean);
    if (!posts.length) throw new Error('没有找到可用的笔记（每篇至少要有 title 和 body）');
    const presetId = PRESET_BY_NAME[String(data[0]?.industry || '').trim()] || getPreset();
    current = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      time: Date.now(), mode: 'import', model: null,
      input: { topic: String(data[0]?.topic || posts[0].titles[0]).slice(0, 60), audience: '', keywords: [], tone: getTone(), count: posts.length, preset: presetId },
      posts,
    };
    el.progress.hidden = true;
    renderResults();
    saveHistory(current);
    return posts.length;
  }
  $('btnImport').addEventListener('click', () => { $('importMsg').textContent = ''; $('importDlg').showModal(); });
  $('btnCloseImport').addEventListener('click', () => $('importDlg').close());
  $('importFile').addEventListener('change', async (e) => {
    const f = e.target.files?.[0];
    if (f) $('importText').value = await f.text();
    e.target.value = '';
  });
  $('btnDoImport').addEventListener('click', () => {
    if (abortCtrl) { toast('请先停止当前生成'); return; }
    try {
      const n = doImport($('importText').value);
      $('importDlg').close();
      $('importText').value = '';
      toast(`✅ 已导入 ${n} 篇`);
      scrollToResults();
    } catch (err) {
      $('importMsg').textContent = '❌ ' + err.message;
    }
  });

  // ================= 历史记录 =================
  function loadHistory() { return store.json(LS.history, []); }
  function saveHistory(batch) {
    const list = loadHistory().filter((h) => h.id !== batch.id);
    list.unshift({
      id: batch.id, time: batch.time, input: batch.input, mode: batch.mode, model: batch.model,
      posts: batch.posts.filter((p) => p && !p.error),
    });
    let trimmed = list.slice(0, MAX_HISTORY);
    // 空间不足时逐条删除最旧的记录
    while (trimmed.length && !store.set(LS.history, JSON.stringify(trimmed))) trimmed.pop();
  }
  function renderHistory() {
    const list = loadHistory();
    if (!list.length) {
      el.historyList.innerHTML = '<p class="muted" style="text-align:center;padding:30px 0">暂无历史记录</p>';
      return;
    }
    el.historyList.innerHTML = list.map((h) => `
      <div class="h-item">
        <div class="h-info">
          <div class="h-title">${esc(h.input.topic)}</div>
          <div class="h-meta">${fmtTime(h.time)} · ${esc(presetOf(h.input.preset).name)} · ${TONE_NAMES[h.input.tone] || ''} · ${MODE_NAMES[h.mode] || '模板'} · ${h.posts.length} 篇${h.input.keywords?.length ? ' · ' + esc(h.input.keywords.join('、')) : ''}</div>
        </div>
        <div class="h-actions">
          <button class="btn primary sm" type="button" data-h-view="${esc(h.id)}">查看</button>
          <button class="btn ghost sm" type="button" data-h-del="${esc(h.id)}">删除</button>
        </div>
      </div>`).join('');
  }
  $('btnHistory').addEventListener('click', () => { renderHistory(); el.historyDlg.showModal(); });
  $('btnCloseHistory').addEventListener('click', () => el.historyDlg.close());
  $('btnClearHistory').addEventListener('click', () => {
    if (!loadHistory().length) return;
    if (confirm('确定清空全部历史记录吗？此操作不可恢复。')) { store.del(LS.history); renderHistory(); toast('已清空'); }
  });
  el.historyList.addEventListener('click', (e) => {
    const v = e.target.closest('[data-h-view]');
    const d = e.target.closest('[data-h-del]');
    if (v) {
      const h = loadHistory().find((x) => x.id === v.dataset.hView);
      if (!h) return;
      if (abortCtrl) { toast('请先停止当前生成'); return; }
      current = h;
      el.progress.hidden = true;
      renderResults();
      fillForm(h.input);
      el.historyDlg.close();
      scrollToResults();
    } else if (d) {
      if (!confirm('删除这条历史记录？')) return;
      store.set(LS.history, JSON.stringify(loadHistory().filter((x) => x.id !== d.dataset.hDel)));
      renderHistory();
    }
  });
  // 点击弹窗外部关闭
  [el.historyDlg, el.settingsDlg, $('importDlg')].forEach((dlg) => dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }));

  function fillForm(input) {
    el.topic.value = input.topic || '';
    el.audience.value = input.audience || '';
    keywords = (input.keywords || []).slice();
    renderChips();
    const tone = el.form.querySelector(`input[name=tone][value="${input.tone}"]`);
    if (tone) tone.checked = true;
    const preset = el.form.querySelector(`input[name=preset][value="${input.preset || 'general'}"]`);
    if (preset) { preset.checked = true; lastPreset = preset.value; }
    setCount(input.count || 5);
    updatePresetHint();
  }

  // ================= 初始化 =================
  const last = store.json(LS.lastInput, null);
  if (last) fillForm(last);
  updateModeHint();
  updatePresetHint();
})();
