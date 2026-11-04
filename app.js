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
  const MAX_HISTORY = 50;
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
    btnCopyAll: $('btnCopyAll'), btnCsv: $('btnCsv'), btnTxt: $('btnTxt'),
    settingsDlg: $('settingsDlg'), apiKey: $('apiKey'), model: $('model'), concurrency: $('concurrency'),
    settingsMsg: $('settingsMsg'),
    historyDlg: $('historyDlg'), historyList: $('historyList'),
    toast: $('toast'),
    industry: $('industry'), sub: $('sub'), subWrap: $('subWrap'), industryHint: $('industryHint'),
  };
  const INDUSTRIES = window.XHSIndustries.INDUSTRIES;

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
  el.modeHint.addEventListener('click', (e) => {
    if (e.target.closest('[data-open-settings]')) { e.preventDefault(); openSettings(); }
  });

  // ================= 行业选择 =================
  const TOPIC_EXAMPLES = {
    general: '如：潜水面镜怎么选、衣帽间铝制侧拉门',
    doors: '如：衣帽间铝制侧拉门、老房换 Low-E 窗户',
    food: '如：阿罕布拉新开的川菜馆、626 早茶推荐',
    scuba: '如：洛杉矶考 OW 潜水证、卡特琳娜岛岸潜',
    build: '如：后院加建 ADU、买房验房注意事项',
  };
  el.industry.innerHTML = Object.entries(INDUSTRIES).map(([id, x]) => `<option value="${id}">${x.icon} ${esc(x.name)}</option>`).join('');
  function updateSubs(keepSub) {
    const ind = INDUSTRIES[el.industry.value] || INDUSTRIES.general;
    const has = ind.subs.length > 0;
    el.subWrap.hidden = !has;
    el.sub.innerHTML = has ? `<option value="">不限（随机）</option>` + ind.subs.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('') : '';
    if (keepSub && ind.subs.some((x) => x.id === keepSub)) el.sub.value = keepSub;
    el.topic.placeholder = TOPIC_EXAMPLES[el.industry.value] || TOPIC_EXAMPLES.general;
    el.audience.placeholder = ind.defaultAudience ? `默认：${ind.defaultAudience}` : '如：潜水新手、装修中的年轻夫妻';
    el.industryHint.textContent = has
      ? `🏷 已加载「${ind.name}」专业词库、标题公式和段落模板（面向洛杉矶华人）；AI 模式也会带上行业背景。`
      : '';
  }
  el.industry.addEventListener('change', () => updateSubs());

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
      covers: {
        type: 'array',
        description: '2-3 组封面大字',
        items: {
          type: 'object',
          properties: {
            main: { type: 'string', description: '封面主标题，不超过 10 个字' },
            sub: { type: 'string', description: '封面副标题，不超过 14 个字' },
          },
          required: ['main', 'sub'],
          additionalProperties: false,
        },
      },
      shots: { type: 'array', items: { type: 'string' }, description: '3-6 张建议拍摄的真实照片' },
      imagePrompts: {
        type: 'array',
        description: '2-3 组 AI 生图提示词',
        items: {
          type: 'object',
          properties: {
            zh: { type: 'string', description: '中文提示词（即梦/豆包）' },
            en: { type: 'string', description: '英文提示词（Midjourney）' },
          },
          required: ['zh', 'en'],
          additionalProperties: false,
        },
      },
    },
    required: ['titles', 'body', 'cta', 'tags', 'covers', 'shots', 'imagePrompts'],
    additionalProperties: false,
  };

  const SYSTEM_PROMPT = `你是一位资深的小红书爆款文案写手和内容策划，熟悉平台调性、用户阅读习惯和社区规范。
请根据用户给出的行业、主题、目标人群、关键词和语气风格，写一篇小红书笔记，并给出封面和配图方案，按要求的 JSON 结构输出。

要求：
- titles：恰好 3 个备选标题，每个不超过 20 个字（emoji 算 1 个字），风格各不相同（比如数字型、悬念型、情绪型），可以带 1-2 个 emoji，要有点击欲但不夸大、不标题党。标题里出现“N 个”时，要和正文的要点数一致。
- body：正文 300-600 字。口语化、像真人在分享，分 4-7 段，段与段之间空一行；适当使用 emoji（每段 0-2 个，不要堆砌）；可以用 1️⃣2️⃣3️⃣ 或 ✅❌ 做小标题/要点；自然融入关键词。内容要具体、有信息量，多用行业里真实的专业词汇和细节，避免空泛套话。正文里不要写话题标签，也不要写结尾互动引导。
- cta：1-2 句结尾互动引导，引导评论、点赞、收藏或关注，语气自然。
- tags：5-10 个话题标签，每个以 # 开头、不含空格，包含主题词、关键词、行业词、地域词和泛流量词。
- covers：2-3 组封面大字。main 是封面主标题，醒目、有冲击力，不超过 10 个字；sub 是副标题，补充利益点或人群，不超过 14 个字。每组角度不同。
- shots：3-6 条建议拍摄的真实照片，每条写清楚拍什么、什么角度或光线，要和正文内容对应，方便用户自己拿手机拍。
- imagePrompts：2-3 组 AI 生图提示词。zh 是给即梦、豆包用的中文提示词；en 是给 Midjourney 用的英文提示词，结尾加 --ar 3:4。描述主体、场景、光线、风格，竖版 3:4，真实摄影质感，不要出现文字、logo 或真实品牌。
- 遵守小红书社区规范：不使用"最""第一""100%"等绝对化用语，不做医疗/功效承诺，不出现微信号、价格引流、站外链接等内容。
- 不要编造具体的品牌型号、价格、数据，除非用户提供。涉及法规时用“一般 / 通常 / 以当地最新规定为准”的说法。`;

  const ANGLES = [
    '新手入门视角', '常见误区拆解', '选购/决策清单', '使用场景对比', '个人经历故事',
    '预算/性价比角度', '细节与小技巧', '问答形式（Q&A）', '前后对比/改变', '进阶玩家视角',
    '一句话总结+展开', '身边朋友的反馈', '时间线（使用一周/一个月后）', '优缺点直说', '反常识观点',
    '清单体（N 个要点）', '情绪共鸣开场', '踩坑后的复盘', '给不同人群的建议', '收藏向速查表',
  ];

  function industryOf(input) {
    const ind = INDUSTRIES[input.industry] || INDUSTRIES.general;
    const sub = ind.subs.find((x) => x.id === input.sub) || null;
    return { ind, sub };
  }

  function systemPromptFor(input) {
    const { ind, sub } = industryOf(input);
    const base = SYSTEM_PROMPT + '\n\n【违禁词与限流词】\n' + CHK.promptHint();
    if (!ind.ai) return base;
    let extra = `\n\n【行业背景与专业要求】\n${ind.ai}`;
    if (sub) extra += `\n本篇细分方向：${sub.name}。可参考的专业词汇：${sub.terms.join('、')}。`;
    else extra += `\n细分方向不限，可从这些方向中选最贴合主题的：${ind.subs.map((x) => x.name).join('、')}。批量生成时各篇尽量覆盖不同方向。`;
    return base + extra;
  }

  function buildUserPrompt(input, index, total) {
    const { ind, sub } = industryOf(input);
    const lines = [
      `行业：${ind.name}${sub ? ' / ' + sub.name : ''}`,
      `主题/产品：${input.topic}`,
      `目标人群：${input.audience || ind.defaultAudience || '不限'}`,
      `关键词：${input.keywords.length ? input.keywords.join('、') : '（未指定，可自行围绕主题选择）'}`,
      `语气风格：${TONE_NAMES[input.tone]}`,
    ];
    if (total > 1) {
      lines.push(`这是同一主题批量生成的第 ${index + 1}/${total} 篇。为了和其他篇有区分，这篇请侧重「${ANGLES[index % ANGLES.length]}」，开头、结构、标题和封面都要换一种写法。`);
    }
    lines.push(...libPromptLines(libFor(input, index)));
    return lines.join('\n');
  }
  function libPromptLines({ profile: pf, case: cs }) {
    const out = [];
    const f = (label, v) => (v ? `- ${label}：${v}` : null);
    if (pf) {
      out.push('', '【账号档案（用这个身份第一人称写）】', ...[
        f('身份', pf.identity), f('服务区域', pf.area), f('从业年限', pf.years), f('特色/优势', pf.features),
        f('说话风格', pf.style), f('常用结尾（放在互动引导里）', pf.ending),
      ].filter(Boolean));
    }
    if (cs) {
      out.push('', '【真实案例（必须写进正文）】', ...[
        f('时间', cs.time), f('城市', cs.city), f('客户情况', cs.client), f('问题', cs.problem),
        f('解决方案', cs.solution), f('费用', cs.cost), f('结果', cs.result), f('备注', cs.note),
      ].filter(Boolean));
    }
    if (pf || cs) {
      out.push('', '要求：把上面的真实信息自然地写进正文（用自己的话，不要列表照抄）；案例里的时间、城市、问题、做法、费用、结果等具体细节要保留；不要编造资料里没有的数字、客户信息或效果；按档案的说话风格来写，互动引导里融入常用结尾。');
    }
    return out;
  }

  const clip = (str, n) => Array.from(String(str || '').trim()).slice(0, n).join('');

  function parsePost(text) {
    let obj;
    try {
      obj = JSON.parse(text);
    } catch {
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) throw new ApiError('返回内容无法解析，正在重试', { retryable: true });
      obj = JSON.parse(m[0]);
    }
    const arr = (v) => (Array.isArray(v) ? v : []);
    const titles = arr(obj.titles).map((s) => String(s).trim()).filter(Boolean).slice(0, 3);
    const tags = arr(obj.tags)
      .map((s) => String(s).trim().replace(/\s+/g, ''))
      .filter(Boolean)
      .map((s) => (s.startsWith('#') ? s : '#' + s))
      .slice(0, 10);
    const body = String(obj.body || '').trim();
    if (!titles.length || !body) throw new ApiError('返回内容不完整，正在重试', { retryable: true });
    const post = { titles, body, cta: String(obj.cta || '').trim(), tags };
    post.covers = arr(obj.covers).filter((c) => c && c.main).map((c) => ({ main: clip(c.main, 14), sub: clip(c.sub, 18) })).slice(0, 3);
    if (!post.covers.length) post.covers = window.XHSTemplates.coverFallback(post);
    post.shots = arr(obj.shots).map((s) => String(s).trim()).filter(Boolean).slice(0, 6);
    post.imagePrompts = arr(obj.imagePrompts).filter((x) => x && (x.zh || x.en)).map((x) => ({ zh: String(x.zh || '').trim(), en: String(x.en || '').trim() })).slice(0, 3);
    return post;
  }

  async function generateOneAI(input, index, total, signal) {
    const apiKey = store.get(LS.key);
    const model = store.get(LS.model, 'claude-opus-5-5');
    let lastErr;
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const text = await callClaude({
          apiKey, model, signal,
          system: systemPromptFor(input),
          messages: [{ role: 'user', content: buildUserPrompt(input, index, total) }],
          maxTokens: 10000,
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
  const coversOf = (p) => (p.covers && p.covers.length ? p.covers : window.XHSTemplates.coverFallback(p));

  function postToText(p, i) {
    const lines = [
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
      '',
      '封面大字：',
      ...coversOf(p).map((c, j) => `${j + 1}. ${c.main}｜${c.sub}`),
    ];
    if (p.shots?.length) lines.push('', '建议拍摄：', ...p.shots.map((x, j) => `${j + 1}. ${x}`));
    if (p.imagePrompts?.length) {
      lines.push('', 'AI 生图提示词：');
      p.imagePrompts.forEach((x, j) => lines.push(`${j + 1}. 中文：${x.zh}`, `   English: ${x.en}`));
    }
    return lines.join('\n');
  }
  function postCopyText(p) {
    return [p.titles[0] || '', '', p.body, '', p.cta, '', p.tags.join(' ')].join('\n');
  }

  // 封面默认样式：按行业挑配色，按篇序轮换排版，让一批封面有变化
  const INDUSTRY_PALETTE = { general: 'red', doors: 'cream', food: 'red', scuba: 'ocean', build: 'dark' };
  const LAYOUT_ORDER = ['center', 'card', 'magazine', 'top', 'sticker'];
  function coverDefaults(i) {
    const ind = current?.input?.industry || 'general';
    const tag = INDUSTRIES[ind] && ind !== 'general' ? '#' + INDUSTRIES[ind].name.split('/')[0] : '';
    return { palette: INDUSTRY_PALETTE[ind] || 'red', layout: LAYOUT_ORDER[i % LAYOUT_ORDER.length], tag };
  }
  const thumbCache = new WeakMap();
  function coverThumb(p, i) {
    const style = coverStyles.get(p) || coverDefaults(i);
    const c = coversOf(p)[style.set || 0] || coversOf(p)[0];
    const opts = { main: style.main ?? c.main, sub: style.sub ?? c.sub, tag: style.tag ?? coverDefaults(i).tag, palette: style.palette, layout: style.layout, photo: style.photo, zoom: style.zoom, posX: style.posX, posY: style.posY };
    const key = JSON.stringify({ ...opts, photo: opts.photo ? opts.photo.src : null });
    const cached = thumbCache.get(p);
    if (cached && cached.key === key) return cached.url;
    const url = window.XHSCover.toDataURL(opts, 0.3);
    thumbCache.set(p, { key, url });
    return url;
  }

  function extrasHTML(p, i) {
    const shots = p.shots || [];
    const prompts = p.imagePrompts || [];
    if (!shots.length && !prompts.length) return '';
    return `<details class="extras">
      <summary>📷 配图建议（${shots.length} 张拍摄清单${prompts.length ? ` · ${prompts.length} 组生图提示词` : ''}）</summary>
      ${shots.length ? `<div class="label">建议拍摄的真实照片</div><ol class="shots">${shots.map((x) => `<li>${esc(x)}</li>`).join('')}</ol>` : ''}
      ${prompts.length ? `<div class="label">AI 生图提示词（Midjourney / 即梦 / 豆包）</div>
        ${prompts.map((x, j) => `<div class="prompt">
          ${x.zh ? `<div class="prompt-line"><span><em>中</em>${esc(x.zh)}</span><button class="mini-copy" type="button" data-act="copy-prompt" data-i="${i}" data-j="${j}" data-lang="zh">复制</button></div>` : ''}
          ${x.en ? `<div class="prompt-line"><span><em>EN</em>${esc(x.en)}</span><button class="mini-copy" type="button" data-act="copy-prompt" data-i="${i}" data-j="${j}" data-lang="en">复制</button></div>` : ''}
        </div>`).join('')}` : ''}
    </details>`;
  }

  // ---------- 违禁词 / 限流词检测 ----------
  const CHK = window.XHSChecker;
  const hl = (t) => CHK.highlight(t, esc);
  function postTexts(p) {
    return [...p.titles, p.body, p.cta, ...p.tags, ...coversOf(p).flatMap((c) => [c.main, c.sub])];
  }
  function complianceBadge(p) {
    const sum = CHK.summarize(postTexts(p));
    return sum.total
      ? `<span class="badge warn">⚠️ ${sum.total} 处违禁/限流词</span>`
      : '<span class="badge ok">✅ 合规</span>';
  }
  function complianceHTML(p, i) {
    const sum = CHK.summarize(postTexts(p));
    return `<details class="compliance ${sum.total ? '' : 'ok'}" ${sum.total ? 'open' : ''}>
      <summary>🛡 合规检测${sum.total ? `：发现 ${sum.total} 处` : '：通过'}</summary>
      ${CHK.reportHTML(sum, esc, 'post:' + i)}
    </details>`;
  }
  /** 对一篇文案的所有字段做替换（fn 接收原文本，返回新文本） */
  function transformPost(p, fn) {
    p.titles = p.titles.map(fn).map((t) => t.trim()).filter(Boolean);
    p.body = fn(p.body);
    p.cta = fn(p.cta || '');
    p.tags = p.tags.map((t) => fn(t)).map((t) => t.replace(/^#?/, '#')).filter((t) => t.length > 1);
    if (p.covers) p.covers = p.covers.map((c) => ({ main: fn(c.main), sub: fn(c.sub) }));
  }
  function applyFix(i, id, text, alt) {
    const p = current.posts[i];
    if (!p) return;
    if (id === '*') transformPost(p, CHK.replaceAll);
    else transformPost(p, (t) => CHK.replaceIn(t, id, text, alt));
    renderOne(i);
    persistCurrent();
    toast('✅ 已替换');
  }
  /** 当前批次如果已在历史记录里，原位更新 */
  function persistCurrent() {
    if (!current) return;
    const list = loadHistory();
    const idx = list.findIndex((h) => h.id === current.id);
    if (idx < 0) return;
    list[idx] = { ...list[idx], ...current, posts: current.posts.filter((p) => p && !p.error) };
    store.set(LS.history, JSON.stringify(list));
  }

  function postHTML(p, i) {
    if (!p) return `<article class="post pending" data-i="${i}">⏳ 第 ${i + 1} 篇生成中…</article>`;
    if (p.error) return `<article class="post error" data-i="${i}"><div class="post-head"><span class="post-no">#${i + 1}</span></div>❌ ${esc(p.error)}</article>`;
    const titles = p.titles.map((t) => {
      const n = textLen(t);
      return `<li><span>${hl(t)}</span><span><span class="len ${n > 20 ? 'over' : ''}">${n}字</span><button class="mini-copy" type="button" data-copy-title="${esc(t)}">复制</button></span></li>`;
    }).join('');
    let thumb = '';
    try { thumb = coverThumb(p, i); } catch { /* 极少数浏览器不支持 canvas，忽略 */ }
    return `<article class="post" data-i="${i}">
      <div class="post-head">
        <span class="post-no">#${i + 1}${p.sub ? ` <small class="muted">${esc(p.sub)}</small>` : ''}${complianceBadge(p)}</span>
        <div class="post-tools">
          <button class="btn ghost sm" type="button" data-act="copy-body" data-i="${i}">复制正文+标签</button>
          <button class="btn primary sm" type="button" data-act="copy" data-i="${i}">📋 一键复制</button>
        </div>
      </div>
      ${p.caseLabel ? `<div class="case-tag">📍 已带入真实案例：${esc(p.caseLabel)}</div>` : ''}
      <div class="label">备选标题</div>
      <ul class="titles">${titles}</ul>
      <div class="label">正文</div>
      <div class="body">${hl(p.body)}</div>
      ${p.cta ? `<div class="label">互动引导</div><div class="cta">${hl(p.cta)}</div>` : ''}
      <div class="label">话题标签</div>
      <div class="tags">${p.tags.map((t) => `<span>${hl(t)}</span>`).join('')}</div>
      ${complianceHTML(p, i)}
      <div class="label">封面</div>
      <div class="cover-row">
        <button class="cover-thumb" type="button" data-act="cover" data-i="${i}" aria-label="编辑第 ${i + 1} 篇封面">${thumb ? `<img src="${thumb}" alt="封面预览" />` : '🎨'}</button>
        <div class="cover-texts">
          ${coversOf(p).map((c) => `<div class="cover-text"><b>${esc(c.main)}</b><span>${esc(c.sub)}</span></div>`).join('')}
          <div><button class="btn primary sm" type="button" data-act="cover" data-i="${i}">🎨 生成 / 下载封面</button></div>
        </div>
      </div>
      ${extrasHTML(p, i)}
      <div class="post-foot">正文 ${textLen(p.body)} 字</div>
    </article>`;
  }

  function renderResults() {
    if (!current) return;
    el.results.innerHTML = current.posts.map((p, i) => postHTML(p, i)).join('');
    renderMeta();
  }
  function renderMeta() {
    const ok = current.posts.filter((p) => p && !p.error).length;
    const ind = INDUSTRIES[current.input.industry];
    const indName = ind && current.input.industry !== 'general' ? ` · ${ind.name}` : '';
    el.resultMeta.textContent = `· ${current.input.topic}${indName} · ${TONE_NAMES[current.input.tone]} · ${current.mode === 'ai' ? 'AI' : '模板'} · ${ok} 篇`;
    const has = ok > 0;
    [el.btnCopyAll, el.btnCsv, el.btnTxt].forEach((b) => { b.disabled = !has; });
  }
  function renderOne(i) {
    const node = el.results.querySelector(`.post[data-i="${i}"]`);
    if (node) node.outerHTML = postHTML(current.posts[i], i);
  }

  el.results.addEventListener('click', (e) => {
    const rb = e.target.closest('.chk-rep, .chk-rep-all');
    if (rb && current) {
      const i = Number(String(rb.dataset.scope).split(':')[1]);
      if (rb.classList.contains('chk-rep-all')) applyFix(i, '*');
      else applyFix(i, rb.dataset.repId, rb.dataset.repText, rb.dataset.repAlt);
      return;
    }
    const t = e.target.closest('[data-copy-title]');
    if (t) { copyText(t.dataset.copyTitle); return; }
    const b = e.target.closest('button[data-act]');
    if (!b || !current) return;
    const i = Number(b.dataset.i);
    const p = current.posts[i];
    if (!p || p.error) return;
    if (b.dataset.act === 'copy') copyText(postCopyText(p));
    if (b.dataset.act === 'copy-body') copyText([p.body, '', p.cta, '', p.tags.join(' ')].join('\n'));
    if (b.dataset.act === 'copy-prompt') copyText(p.imagePrompts[Number(b.dataset.j)][b.dataset.lang]);
    if (b.dataset.act === 'cover') openCover(i);
  });

  function setProgress(done, total, extra = '') {
    el.progress.hidden = false;
    el.progressFill.style.width = `${total ? (done / total) * 100 : 0}%`;
    el.progressText.textContent = `已完成 ${done}/${total} 篇${extra ? ' · ' + extra : ''}`;
  }

  // ================= 封面编辑器 =================
  // 每篇的封面样式（含本地照片）只放在内存里，不写入 localStorage
  const coverStyles = new WeakMap();
  let coverIdx = -1;
  const cv = {
    dlg: $('coverDlg'), img: $('coverImg'), title: $('coverTitle'), sets: $('coverSets'),
    main: $('coverMain'), sub: $('coverSub'), tag: $('coverTag'),
    palettes: $('coverPalettes'), layouts: $('coverLayouts'),
    file: $('coverFile'), clear: $('btnClearPhoto'), ctrls: $('photoCtrls'),
    zoom: $('photoZoom'), x: $('photoX'), y: $('photoY'),
  };
  cv.palettes.innerHTML = Object.entries(window.XHSCover.PALETTES)
    .map(([id, p]) => `<button type="button" class="swatch" data-palette="${id}"><i style="background:linear-gradient(135deg,${p.bg[0]},${p.bg[1]})"></i>${p.name}</button>`).join('');
  cv.layouts.innerHTML = Object.entries(window.XHSCover.LAYOUTS)
    .map(([id, name]) => `<button type="button" class="opt" data-layout="${id}">${name}</button>`).join('');

  function curStyle() {
    const p = current.posts[coverIdx];
    if (!coverStyles.has(p)) coverStyles.set(p, { ...coverDefaults(coverIdx), set: 0 });
    return coverStyles.get(p);
  }
  function coverOpts() {
    const st = curStyle();
    return {
      main: cv.main.value.trim() || ' ', sub: cv.sub.value.trim(), tag: cv.tag.value.trim(),
      palette: st.palette, layout: st.layout, photo: st.photo, zoom: st.zoom, posX: st.posX, posY: st.posY,
    };
  }
  let renderTimer;
  function drawCover() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const st = curStyle();
      Object.assign(st, { main: cv.main.value, sub: cv.sub.value, tag: cv.tag.value });
      cv.img.src = window.XHSCover.toDataURL(coverOpts(), 1);
      cv.palettes.querySelectorAll('.swatch').forEach((b) => b.classList.toggle('active', b.dataset.palette === st.palette));
      cv.layouts.querySelectorAll('.opt').forEach((b) => b.classList.toggle('active', b.dataset.layout === st.layout));
      cv.sets.querySelectorAll('.cover-set').forEach((b) => b.classList.toggle('active', Number(b.dataset.set) === st.set));
      cv.clear.hidden = !st.photo;
      cv.ctrls.hidden = !st.photo;
    }, 60);
  }
  function openCover(i) {
    coverIdx = i;
    const p = current.posts[i];
    const st = curStyle();
    const covers = coversOf(p);
    const c = covers[st.set] || covers[0];
    cv.title.textContent = `· 第 ${i + 1} 篇`;
    cv.sets.innerHTML = covers.map((x, j) => `<button type="button" class="cover-set" data-set="${j}"><b>${esc(x.main)}</b><small>${esc(x.sub)}</small></button>`).join('');
    cv.main.value = st.main ?? c.main;
    cv.sub.value = st.sub ?? c.sub;
    cv.tag.value = st.tag ?? '';
    cv.zoom.value = Math.round((st.zoom || 1) * 100);
    cv.x.value = Math.round((st.posX ?? 0.5) * 100);
    cv.y.value = Math.round((st.posY ?? 0.5) * 100);
    cv.file.value = '';
    drawCover();
    cv.dlg.showModal();
  }
  cv.sets.addEventListener('click', (e) => {
    const b = e.target.closest('.cover-set');
    if (!b) return;
    const st = curStyle();
    st.set = Number(b.dataset.set);
    const c = coversOf(current.posts[coverIdx])[st.set];
    cv.main.value = c.main; cv.sub.value = c.sub;
    drawCover();
  });
  cv.palettes.addEventListener('click', (e) => { const b = e.target.closest('[data-palette]'); if (b) { curStyle().palette = b.dataset.palette; drawCover(); } });
  cv.layouts.addEventListener('click', (e) => { const b = e.target.closest('[data-layout]'); if (b) { curStyle().layout = b.dataset.layout; drawCover(); } });
  [cv.main, cv.sub, cv.tag].forEach((x) => x.addEventListener('input', drawCover));
  cv.zoom.addEventListener('input', () => { curStyle().zoom = cv.zoom.value / 100; drawCover(); });
  cv.x.addEventListener('input', () => { curStyle().posX = cv.x.value / 100; drawCover(); });
  cv.y.addEventListener('input', () => { curStyle().posY = cv.y.value / 100; drawCover(); });
  cv.file.addEventListener('change', async () => {
    const f = cv.file.files[0];
    if (!f) return;
    try {
      const img = await window.XHSCover.loadImageFile(f);
      Object.assign(curStyle(), { photo: img, zoom: 1, posX: 0.5, posY: 0.5 });
      cv.zoom.value = 100; cv.x.value = 50; cv.y.value = 50;
      drawCover();
    } catch (err) { toast(err.message); }
  });
  cv.clear.addEventListener('click', () => { const st = curStyle(); delete st.photo; cv.file.value = ''; drawCover(); });
  $('btnDownloadCover').addEventListener('click', async () => {
    const blob = await window.XHSCover.toBlob(coverOpts());
    if (!blob) { toast('封面生成失败'); return; }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `xhs-cover_${coverIdx + 1}_${curStyle().layout}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    toast('✅ 封面已下载');
  });
  $('btnCloseCover').addEventListener('click', () => cv.dlg.close());
  cv.dlg.addEventListener('click', (e) => { if (e.target === cv.dlg) cv.dlg.close(); });
  cv.dlg.addEventListener('close', () => { if (current && coverIdx >= 0) renderOne(coverIdx); });

  // ================= 生成 =================
  function readInput() {
    if (el.kwInput.value.trim()) { addKeywords(el.kwInput.value); el.kwInput.value = ''; }
    return {
      industry: el.industry.value,
      sub: el.sub.value,
      topic: el.topic.value.trim(),
      audience: el.audience.value.trim(),
      keywords: keywords.slice(),
      tone: getTone(),
      count: parseInt(el.count.value, 10) || 1,
      ...(window.XHSLibrary ? window.XHSLibrary.selection() : {}),
    };
  }
  /** 第 i 篇要带入的档案和案例 */
  function libFor(input, i) {
    if (!window.XHSLibrary) return { profile: null, case: null };
    const lib = window.XHSLibrary.resolve(input);
    return { profile: lib.profile, case: lib.cases.length ? lib.cases[i % lib.cases.length] : null };
  }

  function setBusy(busy) {
    el.btnGenerate.disabled = busy;
    el.btnGenerate.textContent = busy ? '⏳ 生成中…' : '🚀 开始生成';
    el.btnStop.hidden = !busy;
  }

  el.form.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = readInput();
    if (!input.topic) { toast('请先填写主题/产品'); el.topic.focus(); return; }
    runGenerate(input, getMode());
  });

  /** 按给定输入生成（表单提交、内容日历等都走这里） */
  async function runGenerate(input, mode) {
    if (abortCtrl) { toast('正在生成中，请稍候或先停止'); return; }
    store.set(LS.lastInput, JSON.stringify(input));

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
      current.posts = window.XHSTemplates.generateBatch(input, input.count, window.XHSLibrary ? window.XHSLibrary.resolve(input) : null);
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
          const cs = libFor(input, i).case;
          if (cs) { batch.posts[i].caseId = cs.id; batch.posts[i].caseLabel = window.XHSTemplates.caseLabel(cs); }
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
  }

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
    const rows = [['序号', '标题1', '标题2', '标题3', '正文', '互动引导', '话题标签', '封面大字', '建议拍摄', 'AI生图提示词(中文)', 'AI生图提示词(英文)', '行业', '细分', '主题', '目标人群', '关键词', '语气风格']];
    const ind = INDUSTRIES[current.input.industry] || INDUSTRIES.general;
    validPosts().forEach((p, i) => rows.push([
      i + 1, p.titles[0] || '', p.titles[1] || '', p.titles[2] || '', p.body, p.cta, p.tags.join(' '),
      coversOf(p).map((c) => `${c.main}｜${c.sub}`).join('\n'),
      (p.shots || []).map((x, j) => `${j + 1}. ${x}`).join('\n'),
      (p.imagePrompts || []).map((x) => x.zh).join('\n'),
      (p.imagePrompts || []).map((x) => x.en).join('\n'),
      ind.name, p.sub || '', current.input.topic, current.input.audience, current.input.keywords.join('、'), TONE_NAMES[current.input.tone],
    ]));
    const csv = '﻿' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n'); // BOM：Excel 打开不乱码
    download(fileBase() + '.csv', csv, 'text/csv;charset=utf-8');
  });
  function allText() {
    const head = [
      `行业：${(INDUSTRIES[current.input.industry] || INDUSTRIES.general).name}`,
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
          <div class="h-meta">${fmtTime(h.time)}${h.input.industry && h.input.industry !== 'general' && INDUSTRIES[h.input.industry] ? ' · ' + esc(INDUSTRIES[h.input.industry].name) : ''} · ${TONE_NAMES[h.input.tone] || ''} · ${h.mode === 'ai' ? 'AI' : '模板'} · ${h.posts.length} 篇${h.input.keywords?.length ? ' · ' + esc(h.input.keywords.join('、')) : ''}</div>
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
  [el.historyDlg, el.settingsDlg].forEach((dlg) => dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }));

  function fillForm(input) {
    el.industry.value = INDUSTRIES[input.industry] ? input.industry : 'general';
    updateSubs(input.sub);
    el.topic.value = input.topic || '';
    el.audience.value = input.audience || '';
    keywords = (input.keywords || []).slice();
    renderChips();
    const tone = el.form.querySelector(`input[name=tone][value="${input.tone}"]`);
    if (tone) tone.checked = true;
    setCount(input.count || 5);
    if (window.XHSLibrary) window.XHSLibrary.setSelection(input.profileId, input.caseIds);
  }

  // ================= 分区导航 =================
  function showTab(name) {
    document.querySelectorAll('#tabs .tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    document.querySelectorAll('.panel[data-panel]').forEach((p) => { p.hidden = p.dataset.panel !== name; });
    document.dispatchEvent(new CustomEvent('xhs:tab', { detail: name }));
    window.scrollTo({ top: 0 });
  }
  document.addEventListener('xhs:rerender', () => { if (current) renderResults(); });
  $('tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });

  /** 把一批（单篇或多篇）结果放到“生成”页显示并存入历史 */
  function showBatch(batch, { save = true } = {}) {
    current = batch;
    showTab('gen');
    el.progress.hidden = true;
    renderResults();
    if (save) saveHistory(batch);
    scrollToResults();
  }

  // 供其他模块（工具、资料库、日历、数据）使用
  window.XHS = {
    store, LS, esc, toast, copyText, download, fmtTime, csvCell, textLen,
    INDUSTRIES, TONE_NAMES, getMode, callClaude, ApiError, sleep, MODEL_NAMES,
    hasKey: () => !!store.get(LS.key), libPromptLines, systemPromptFor, parsePost, POST_SCHEMA, openSettings, showTab, showBatch, runGenerate, fillForm,
    loadHistory, saveHistory, persistCurrent, getCurrent: () => current,
    postToText, postCopyText, coversOf,
  };

  // ================= 初始化 =================
  updateSubs();
  const last = store.json(LS.lastInput, null);
  if (last) fillForm(last);
  updateModeHint();
})();
