/*
 * 工具页：违禁词检测（以及后续的素材变笔记、爆款拆解、回复话术等）
 */
(function () {
  'use strict';
  const X = window.XHS;
  const CHK = window.XHSChecker;
  const $ = (id) => document.getElementById(id);
  const esc = X.esc;

  // ---------- 子标签切换 ----------
  function showTool(name) {
    document.querySelectorAll('#toolTabs .subtab').forEach((b) => b.classList.toggle('active', b.dataset.tool === name));
    document.querySelectorAll('[data-toolpanel]').forEach((p) => { p.hidden = p.dataset.toolpanel !== name; });
  }
  $('toolTabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tool]'); if (b) showTool(b.dataset.tool); });
  showTool('check');

  // ================= 违禁词检测 =================
  const chk = { input: $('chkInput'), result: $('chkResult'), custom: $('customWords') };

  function runCheck() {
    const text = chk.input.value;
    if (!text.trim()) { chk.result.innerHTML = '<p class="hint">请先粘贴要检测的文案</p>'; return; }
    const sum = CHK.summarize([text]);
    chk.result.innerHTML = `<div class="label">检测结果（标红=高风险，标橙=容易限流）</div>
      <div class="chk-preview">${CHK.highlight(text, esc)}</div>
      ${CHK.reportHTML(sum, esc, 'tool')}`;
  }
  $('btnChk').addEventListener('click', runCheck);
  $('btnChkClear').addEventListener('click', () => { chk.input.value = ''; chk.result.innerHTML = ''; });
  $('btnChkCopy').addEventListener('click', () => { if (chk.input.value.trim()) X.copyText(chk.input.value); });
  chk.result.addEventListener('click', (e) => {
    const b = e.target.closest('.chk-rep, .chk-rep-all');
    if (!b) return;
    chk.input.value = b.classList.contains('chk-rep-all')
      ? CHK.replaceAll(chk.input.value)
      : CHK.replaceIn(chk.input.value, b.dataset.repId, b.dataset.repText, b.dataset.repAlt);
    runCheck();
    X.toast('✅ 已替换，可以复制使用了');
  });

  // 自定义词库
  chk.custom.value = CHK.customText();
  $('btnSaveCustom').addEventListener('click', () => {
    CHK.setCustomText(chk.custom.value);
    X.toast('✅ 自定义词已保存');
    if (chk.input.value.trim()) runCheck();
    const cur = X.getCurrent();
    if (cur) document.dispatchEvent(new CustomEvent('xhs:rerender'));
  });

  // ================= 公共：AI 调用（带重试） =================
  async function aiJSON({ system, user, schema, maxTokens = 10000 }) {
    const apiKey = X.store.get(X.LS.key);
    const model = X.store.get(X.LS.model, 'claude-opus-5-5');
    let lastErr;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const text = await X.callClaude({
          apiKey, model, system, maxTokens, effort: 'medium',
          messages: [{ role: 'user', content: user }],
          format: { type: 'json_schema', schema },
        });
        try { return JSON.parse(text); } catch {
          const m = text.match(/\{[\s\S]*\}/);
          if (m) return JSON.parse(m[0]);
          throw new X.ApiError('返回内容无法解析', { retryable: true });
        }
      } catch (err) {
        lastErr = err;
        if (!(err instanceof X.ApiError) || !err.retryable || attempt === 2) break;
        await X.sleep(err.retryAfter ? err.retryAfter * 1000 : 2000 * Math.pow(2, attempt));
      }
    }
    throw lastErr;
  }
  /** 当前模式（生成页的“生成模式”是全局开关）；AI 模式没有 Key 时提示去设置 */
  function wantAI() {
    if (X.getMode() !== 'ai') return false;
    if (!X.hasKey()) { X.toast('AI 模式需要先填写 API Key'); X.openSettings(); throw new Error('no-key'); }
    return true;
  }
  function updateModeNotes() {
    const ai = X.getMode() === 'ai';
    document.querySelectorAll('.mode-note').forEach((n) => {
      n.textContent = ai ? '（当前：✨ AI 模式）' : '（当前：🧩 模板模式，可在「生成」页切换为 AI 模式）';
    });
  }
  document.addEventListener('xhs:tab', updateModeNotes);
  document.getElementById('genForm').addEventListener('change', updateModeNotes);
  updateModeNotes();

  function industryOptions(sel, value) {
    sel.innerHTML = Object.entries(X.INDUSTRIES).map(([id, x]) => `<option value="${id}">${x.icon} ${esc(x.name)}</option>`).join('');
    sel.value = value || 'general';
  }
  function subOptions(sel, industry, value, emptyLabel = '不限') {
    const ind = X.INDUSTRIES[industry];
    const subs = ind ? ind.subs : [];
    sel.innerHTML = `<option value="">${emptyLabel}</option>` + subs.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
    sel.value = value || '';
    sel.disabled = !subs.length;
  }
  function profileOptions(sel) {
    const v = sel.value;
    const list = window.XHSLibrary ? window.XHSLibrary.profiles() : [];
    sel.innerHTML = '<option value="">不带入</option>' + list.map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (list.some((p) => p.id === v)) sel.value = v;
  }
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  // ================= 素材变笔记 =================
  const mat = {
    ind: $('matIndustry'), sub: $('matSub'), topic: $('matTopic'), profile: $('matProfile'),
    points: $('matPoints'), photos: $('matPhotos'), tone: $('matTone'), msg: $('matMsg'),
  };
  let matTone = 'tiyan';
  industryOptions(mat.ind, document.getElementById('industry').value);
  subOptions(mat.sub, mat.ind.value);
  mat.ind.addEventListener('change', () => subOptions(mat.sub, mat.ind.value));
  mat.tone.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tone]');
    if (!b) return;
    matTone = b.dataset.tone;
    mat.tone.querySelectorAll('.opt').forEach((x) => x.classList.toggle('active', x === b));
  });
  document.addEventListener('xhs:tab', (e) => { if (e.detail === 'tools') profileOptions(mat.profile); });
  profileOptions(mat.profile);

  const MAT_SCHEMA_EXTRA = {
    type: 'object',
    description: '从素材中提取的案例字段，素材里没有的写空字符串',
    properties: Object.fromEntries(['time', 'city', 'client', 'problem', 'solution', 'cost', 'result'].map((k) => [k, { type: 'string' }])),
    required: ['time', 'city', 'client', 'problem', 'solution', 'cost', 'result'],
    additionalProperties: false,
  };

  $('btnMatGen').addEventListener('click', async () => {
    const points = mat.points.value.trim();
    if (!points) { X.toast('先写几条现场要点'); mat.points.focus(); return; }
    const profile = mat.profile.value && window.XHSLibrary ? window.XHSLibrary.getProfile(mat.profile.value) : null;
    const input = {
      industry: mat.ind.value, sub: mat.sub.value, topic: mat.topic.value.trim(), audience: '', keywords: [],
      tone: matTone, count: 1, profileId: mat.profile.value, caseIds: [], source: 'material',
    };
    let ai;
    try { ai = wantAI(); } catch { return; }
    let post;
    const btn = $('btnMatGen');
    if (ai) {
      btn.disabled = true; btn.textContent = '⏳ AI 整理中…';
      try {
        const schema = JSON.parse(JSON.stringify(X.POST_SCHEMA));
        schema.properties.caseDraft = MAT_SCHEMA_EXTRA;
        schema.required.push('caseDraft');
        const system = X.systemPromptFor(input) + `

【素材变笔记】用户给的是现场随手记的要点和照片描述。请把它整理成一篇真实体验笔记：
- 只能使用素材里的事实（时间、地点、问题、做法、数字、结果），可以组织语言、补充通用的专业解释，但不要编造素材里没有的数字、客户信息或效果；
- 照片描述按顺序对应“图1、图2…”，在正文里自然提到；shots 里先列出已有照片，再补充建议补拍的；
- caseDraft 从素材中提取案例字段，没有的写空字符串。`;
        const user = [
          `行业：${X.INDUSTRIES[input.industry].name}${input.sub ? ' / ' + mat.sub.selectedOptions[0].textContent : ''}`,
          input.topic ? `主题：${input.topic}` : '',
          `语气风格：${X.TONE_NAMES[matTone]}`,
          '', '【现场要点】', points,
          mat.photos.value.trim() ? '\n【照片描述（按顺序为图1、图2…）】\n' + mat.photos.value.trim() : '',
          ...X.libPromptLines({ profile, case: null }),
        ].filter((x) => x !== '').join('\n');
        const obj = await aiJSON({ system, user, schema });
        post = X.parsePost(JSON.stringify(obj));
        post.caseDraft = { industry: input.industry, sub: input.sub, ...(obj.caseDraft || {}), note: mat.photos.value.trim() ? `有 ${mat.photos.value.trim().split(/\n+/).length} 张现场照片` : '' };
        if (!input.topic) input.topic = (post.titles[0] || '素材笔记').slice(0, 20);
      } catch (err) {
        mat.msg.textContent = '❌ ' + (err.message || err);
        return;
      } finally {
        btn.disabled = false; btn.textContent = '✨ 整理成笔记';
      }
    } else {
      post = window.XHSTemplates.fromMaterial({ industry: input.industry, sub: input.sub, topic: input.topic, points, photos: mat.photos.value, tone: matTone, profile });
      input.topic = post.topic;
      delete post.topic;
      if (X.textLen(post.body) < 250) { mat.msg.textContent = '💡 素材比较少，正文偏短；可以多写几条要点，或切换到 AI 模式扩写。'; X.toast('💡 素材偏少，正文较短，可补充要点或用 AI 模式扩写', 3500); }
      else mat.msg.textContent = '';
    }
    X.showBatch({ id: newId(), time: Date.now(), input, mode: ai ? 'ai' : 'template', model: ai ? X.store.get(X.LS.model, 'claude-opus-5-5') : null, posts: [post] });
    X.toast('✅ 已整理成笔记，可在卡片上「存为案例」');
  });

  $('btnMatCase').addEventListener('click', () => {
    if (!mat.points.value.trim()) { X.toast('先写几条现场要点'); return; }
    const d = window.XHSTemplates.parseMaterial(mat.points.value, mat.photos.value, mat.ind.value, mat.sub.value);
    delete d.steps; delete d.context;
    window.XHSLibrary.openCase(d);
  });

  function caseOptions(sel, industry) {
    const v = sel.value;
    const list = window.XHSLibrary ? window.XHSLibrary.cases() : [];
    const sorted = [...list].sort((a, b) => (b.industry === industry) - (a.industry === industry));
    sel.innerHTML = '<option value="">不带入</option>' + sorted.map((c) => `<option value="${esc(c.id)}">${esc(window.XHSLibrary.caseTitle(c))}</option>`).join('');
    if (list.some((c) => c.id === v)) sel.value = v;
  }

  // ================= 爆款拆解 =================
  const PICTO = /\p{Extended_Pictographic}/u;
  const PICTO_G = /\p{Extended_Pictographic}/gu;
  const TITLE_FEATURES = [
    { k: 'number', re: /\d+|[一二三四五六七八九十两]+(个|件|点|种|招|步)/, name: '数字', tip: '用具体数字制造确定感、降低阅读门槛' },
    { k: 'emoji', re: PICTO, name: '表情符号', tip: '用 emoji 在信息流里吸睛' },
    { k: 'question', re: /[？?]|吗|怎么|如何|为什么|哪个|值不值|要不要/, name: '提问', tip: '抛出问题，引发好奇和代入' },
    { k: 'exclaim', re: /[！!]/, name: '感叹', tip: '加强语气和情绪' },
    { k: 'pipe', re: /[｜|]/, name: '竖线分隔', tip: '“主题｜补充卖点”的两段式结构' },
    { k: 'crowd', re: /新手|小白|姐妹|宝妈|业主|房主|学生|留学生|打工人|上班族|华人|新人|学员/, name: '点名人群', tip: '直接喊出目标人群，让对的人停下来' },
    { k: 'avoid', re: /避坑|踩坑|避雷|千万|不要|别再|别买|后悔|劝退|坑/, name: '避坑/警示', tip: '利用损失厌恶，提醒风险' },
    { k: 'emotion', re: /绝了|太.{1,4}了|哭|爱了|惊艳|离谱|崩溃|救命|谁懂|真香/, name: '情绪词', tip: '用口语化情绪拉近距离' },
    { k: 'guide', re: /攻略|指南|清单|教程|讲透|看这篇|收藏|干货|全流程|一篇/, name: '干货承诺', tip: '承诺信息量，引导收藏' },
    { k: 'contrast', re: /vs|VS|还是|对比|区别|前后/, name: '对比', tip: '用对比制造选择题' },
    { k: 'real', re: /亲测|真实|实测|用了.{1,4}(个月|年|天|次)|自费|大实话|不吹不黑/, name: '真实体验', tip: '强调亲身经历，增加信任' },
  ];
  const HOOKS = [
    { k: 'identity', re: /^(作为|我是|身为)/, name: '身份式开头', tip: '先亮身份，建立专业信任' },
    { k: 'conclusion', re: /先说结论|直接说|结论|一句话/, name: '结论先行', tip: '开头先给答案，留住没耐心的读者' },
    { k: 'question', re: /[？?]|是不是|有没有|你是否/, name: '提问式开头', tip: '用问题戳中读者的疑问' },
    { k: 'pain', re: /踩坑|后悔|崩溃|烦|难受|冤枉钱|血泪|焦虑|头疼/, name: '痛点式开头', tip: '先讲痛点，引起共鸣' },
    { k: 'number', re: /^\D{0,6}\d/, name: '数字式开头', tip: '开头就给出数字，显得具体可信' },
    { k: 'story', re: /那天|去年|上周|最近|前段时间|我家|朋友|有一次|记得/, name: '故事式开头', tip: '用一个小故事把人带进场景' },
  ];
  const LIST_RE = /^\s*(\d+[.、)）]|[1-9]️?⃣|[✅❌✔👉•·▪◾🔸🔹\-]|第[一二三四五六七八九十]+)/u;

  function analyzeNote(title, body) {
    const feats = TITLE_FEATURES.filter((f) => f.re.test(title));
    const paras = body.split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
    const linesAll = body.split(/\n/).map((x) => x.trim()).filter(Boolean);
    const first = (paras[0] || '').replace(/#\S+/g, '');
    const hook = HOOKS.find((h) => h.re.test(first)) || { k: 'statement', name: '陈述式开头', tip: '直接进入主题' };
    const listItems = linesAll.filter((l) => LIST_RE.test(l));
    const tags = (body.match(/#[^\s#]+/g) || []);
    const emojis = (body.match(PICTO_G) || []).length;
    const tail = paras.slice(-2).join('');
    const hasCTA = /评论区|收藏|关注|点赞|留言|你们|告诉我/.test(tail);
    const hasSummary = /总结|一句话|最后|总之|综上/.test(paras.slice(-3).join(''));
    const chars = Array.from(body.replace(/#\S+/g, '').replace(/\s/g, '')).length;
    const skeleton = [
      `${hook.name}：${first.slice(0, 30)}${first.length > 30 ? '…' : ''}`,
      listItems.length ? `主体：${listItems.length} 个要点的清单（每点一句结论 + 一两句解释）` : `主体：${Math.max(1, paras.length - 2)} 段叙述`,
      hasSummary ? '收尾：一句话总结' : null,
      hasCTA ? '结尾：互动引导（提问/引导收藏关注）' : null,
      tags.length ? `话题标签：${tags.length} 个` : null,
    ].filter(Boolean);
    let tone = 'ganhuo';
    if (feats.some((f) => f.k === 'avoid')) tone = 'bikeng';
    else if (feats.some((f) => f.k === 'real')) tone = 'tiyan';
    else if (feats.some((f) => f.k === 'emotion')) tone = 'zhongcao';
    return {
      feats, hook, paras: paras.length, listCount: listItems.length, tags: tags.length, emojis, chars, hasCTA, hasSummary, skeleton, tone,
      formula: feats.length ? feats.map((f) => f.name).join(' + ') : '直述主题',
    };
  }

  /** 找出 b 中与 a 连续重复 ≥ n 个字的片段（忽略空格、标点、emoji） */
  function overlaps(a, b, n = 8) {
    const norm = (t) => Array.from(String(t).replace(/[^一-龥A-Za-z0-9]/g, ''));
    const A = norm(a);
    const B = norm(b);
    if (A.length < n || B.length < n) return [];
    const grams = new Set();
    for (let i = 0; i + n <= A.length; i++) grams.add(A.slice(i, i + n).join(''));
    const segs = [];
    let i = 0;
    while (i + n <= B.length) {
      if (grams.has(B.slice(i, i + n).join(''))) {
        let j = i + n;
        while (j < B.length && grams.has(B.slice(j - n + 1, j + 1).join(''))) j++;
        segs.push(B.slice(i, j).join(''));
        i = j;
      } else i++;
    }
    return segs;
  }

  const rm = {
    title: $('rmTitle'), body: $('rmBody'), analysis: $('rmAnalysis'), rewrite: $('rmRewrite'),
    ind: $('rmIndustry'), sub: $('rmSub'), topic: $('rmTopic'), profile: $('rmProfile'), cas: $('rmCase'), msg: $('rmMsg'),
  };
  industryOptions(rm.ind, document.getElementById('industry').value);
  subOptions(rm.sub, rm.ind.value);
  rm.ind.addEventListener('change', () => { subOptions(rm.sub, rm.ind.value); caseOptions(rm.cas, rm.ind.value); });
  let lastAnalysis = null;

  function renderAnalysis(a, extra) {
    rm.analysis.innerHTML = `
      <div class="rm-block"><h4>🏷 标题套路</h4><p class="rm-formula">${esc(a.formula)}</p>
        <ul>${a.feats.map((f) => `<li><b>${esc(f.name)}</b>：${esc(f.tip)}</li>`).join('') || '<li>标题比较直白，没有明显套路</li>'}</ul></div>
      <div class="rm-block"><h4>🪝 开头钩子</h4><p><b>${esc(a.hook.name)}</b>：${esc(a.hook.tip)}</p></div>
      <div class="rm-block"><h4>🧱 结构</h4><ul>${a.skeleton.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="hint">约 ${a.chars} 字 · ${a.paras} 段 · emoji ${a.emojis} 个 · 话题标签 ${a.tags} 个</p></div>
      ${extra || ''}`;
  }

  $('btnRmAnalyze').addEventListener('click', () => {
    const title = rm.title.value.trim();
    const body = rm.body.value.trim();
    if (!title && !body) { X.toast('先粘贴要拆解的笔记'); return; }
    lastAnalysis = analyzeNote(title, body);
    renderAnalysis(lastAnalysis);
    rm.rewrite.hidden = false;
    profileOptions(rm.profile);
    caseOptions(rm.cas, rm.ind.value);
  });

  const HOOK_OPENERS = {
    identity: (c) => (c.profile && c.profile.identity ? `作为${c.profile.identity}，${c.t}是我被问得多的问题之一，今天认真聊聊。` : `作为过来人，关于${c.t}，我有不少心得想分享。`),
    conclusion: (c) => `先说结论：${c.t}，抓住下面这几点就够了👇`,
    question: (c) => `你是不是也在纠结${c.t}？今天把关键点一次说清楚👇`,
    pain: (c) => `说个扎心的事实：${c.t}这件事，很多人都是花了冤枉钱才明白的。`,
    number: (c) => `把${c.t}拆成 ${c.n} 个要点，看完心里就有数了📌`,
    story: (c) => (c.case ? `先讲一个真实的案例：${[c.case.time, c.case.city].filter(Boolean).join('，')}，${c.case.problem || '客户找到我们'}。` : `先说一个很常见的场景：准备${c.t}的时候，网上信息越看越乱，不知道该听谁的。`),
  };

  function templateRemix(a, cfg, original) {
    const T = window.XHSTemplates;
    const input = { industry: cfg.industry, sub: cfg.sub, topic: cfg.topic, audience: '', keywords: [], tone: a.tone, profile: cfg.profile, case: cfg.case };
    const cands = Array.from({ length: 6 }, () => T.generateOne(input));
    const post = cands[0];
    // 要点数量向原文靠拢（2-5 个）
    const target = Math.max(2, Math.min(5, a.listCount || 3));
    const paras = post.body.split('\n\n');
    const numIdx = paras.map((p, i) => (/^[1-6]️⃣/.test(p) ? i : -1)).filter((i) => i >= 0);
    while (numIdx.length > target) paras.splice(numIdx.pop(), 1);
    // 要点不够时，从其他候选里补充不重复的要点
    const strip = (x) => x.replace(/^[1-6]\uFE0F\u20E3\s*/, '');
    const have = new Set(numIdx.map((i) => strip(paras[i])));
    const extra = cands.slice(1).flatMap((c) => c.body.split('\n\n').filter((x) => /^[1-6]\uFE0F\u20E3/.test(x)).map(strip)).filter((x) => !have.has(x) && have.add(x));
    let insertAt = numIdx.length ? numIdx[numIdx.length - 1] + 1 : 1;
    while (numIdx.length < target && extra.length && Array.from(paras.join('')).length < 760) {
      paras.splice(insertAt, 0, extra.shift());
      numIdx.push(insertAt);
      insertAt++;
    }
    numIdx.forEach((idx, j) => { paras[idx] = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'][j] + ' ' + strip(paras[idx]); });
    const count = numIdx.length;
    // 开头换成同类型的钩子（用自己的话）
    const make = HOOK_OPENERS[a.hook.k];
    if (make) paras[0] = make({ t: cfg.topic, n: count, profile: cfg.profile, case: cfg.case });
    post.body = paras.join('\n\n');
    // 标题：从候选里挑和原标题套路最像的 3 个
    const featKeys = new Set(a.feats.map((f) => f.k));
    const scored = [...new Set(cands.flatMap((c) => c.titles))].map((t) => ({ t, s: TITLE_FEATURES.filter((f) => f.re.test(t) && featKeys.has(f.k)).length }));
    scored.sort((x, y) => y.s - x.s);
    post.titles = [...new Set(scored.map((x) => x.t.replace(/(\d+)(?=个|件|点)/, String(count))))].slice(0, 3);
    post.pointsNote = `要点数：原文 ${a.listCount || '—'} 个 / 仿写 ${count} 个`;
    post.covers = post.covers.map((c) => ({ main: c.main, sub: c.sub.replace(/(\d+)(?=个|件|点)/, String(count)) }));
    return post;
  }

  $('btnRmRewrite').addEventListener('click', async () => {
    if (!lastAnalysis) { X.toast('先点「拆解」'); return; }
    const topic = rm.topic.value.trim();
    if (!topic) { X.toast('请填写你的主题'); rm.topic.focus(); return; }
    const L = window.XHSLibrary;
    const cfg = { industry: rm.ind.value, sub: rm.sub.value, topic, profile: rm.profile.value ? L.getProfile(rm.profile.value) : null, case: rm.cas.value ? L.getCase(rm.cas.value) : null };
    const original = rm.title.value + '\n' + rm.body.value;
    let ai;
    try { ai = wantAI(); } catch { return; }
    let post;
    const btn = $('btnRmRewrite');
    if (ai) {
      btn.disabled = true; btn.textContent = '⏳ AI 重写中…';
      try {
        const schema = {
          type: 'object',
          properties: {
            analysis: {
              type: 'object',
              properties: { titleFormula: { type: 'string' }, hook: { type: 'string' }, structure: { type: 'array', items: { type: 'string' } }, why: { type: 'array', items: { type: 'string' } } },
              required: ['titleFormula', 'hook', 'structure', 'why'], additionalProperties: false,
            },
            post: X.POST_SCHEMA,
          },
          required: ['analysis', 'post'], additionalProperties: false,
        };
        const system = X.systemPromptFor({ industry: cfg.industry, sub: cfg.sub }) + `

【爆款拆解与仿写】先拆解用户提供的参考笔记（标题公式、开头钩子、结构、为什么能火），再只借鉴它的“结构和写法”，围绕用户自己的主题、账号档案和真实案例写一篇全新的笔记：
- 严禁照抄：不得出现参考笔记里任何连续 8 个字以上相同的句子或片段，不复用它的具体例子、数字和金句；
- 内容事实只能来自用户的主题、行业常识、账号档案和真实案例，不要把参考笔记里的事实挪过来；
- 结构上保持同样的开头钩子类型、要点数量和结尾互动方式。`;
        const user = [
          '【参考笔记（只学结构，不要抄）】', `标题：${rm.title.value.trim()}`, rm.body.value.trim(),
          '', '【我的笔记】', `行业：${X.INDUSTRIES[cfg.industry].name}`, `主题：${topic}`,
          ...X.libPromptLines({ profile: cfg.profile, case: cfg.case }),
        ].join('\n');
        const obj = await aiJSON({ system, user, schema, maxTokens: 12000 });
        post = X.parsePost(JSON.stringify(obj.post || {}));
        const an = obj.analysis || {};
        renderAnalysis(lastAnalysis, `<div class="rm-block"><h4>✨ AI 拆解补充</h4>
          <p><b>标题公式：</b>${esc(an.titleFormula || '')}</p><p><b>开头钩子：</b>${esc(an.hook || '')}</p>
          <ul>${(an.structure || []).map((x) => `<li>${esc(x)}</li>`).join('')}</ul>
          ${(an.why || []).length ? `<p><b>为什么能火：</b></p><ul>${an.why.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</div>`);
      } catch (err) {
        rm.msg.textContent = '❌ ' + (err.message || err);
        return;
      } finally { btn.disabled = false; btn.textContent = '✍️ 仿结构重写'; }
    } else {
      post = templateRemix(lastAnalysis, cfg, original);
    }
    const segs = overlaps(original, [post.titles.join('\n'), post.body, post.cta].join('\n'));
    post.originality = segs.length
      ? `⚠️ 与原文有 ${segs.length} 处 8 字以上的重复片段：${segs.slice(0, 3).join('、')}，建议修改`
      : '✅ 原创检查：没有和原文连续 8 字以上重复的片段';
    post.remixFrom = lastAnalysis.formula + ' · ' + lastAnalysis.hook.name + (post.pointsNote ? ' · ' + post.pointsNote : '');
    delete post.pointsNote;
    if (cfg.case) { post.caseId = cfg.case.id; post.caseLabel = window.XHSTemplates.caseLabel(cfg.case); }
    rm.msg.textContent = post.originality;
    X.showBatch({
      id: newId(), time: Date.now(), mode: ai ? 'ai' : 'template', model: null, posts: [post],
      input: { industry: cfg.industry, sub: cfg.sub, topic, audience: '', keywords: [], tone: lastAnalysis.tone, count: 1, profileId: rm.profile.value, caseIds: cfg.case ? [cfg.case.id] : [], source: 'remix' },
    });
    X.toast('✅ 已仿结构重写');
  });

  // ================= 回复话术 =================
  const Q_DEFAULT = [
    { k: 'price', label: '多少钱 / 怎么收费', c: [
      '价格要看尺寸、材质和现场情况（比如要不要拆旧、改洞口），不太好直接报一个数～可以在评论区说下大概尺寸和需求，我给你一个参考区间🙏',
      '每家情况不一样，同样的{s}，材质和配置不同价格差别挺大的。方便的话说说你所在的城市和大概需求，我帮你分析一下～'],
      d: '{s}的价格主要看这几点：1）尺寸和数量；2）材质和配置；3）是否需要拆旧、补墙、拉许可。方便的话发一下现场照片和大概尺寸，我先给你一个大概区间；需要的话可以预约上门看现场，再出正式报价，报价单会把每一项列清楚。' },
    { k: 'visit', label: '能不能上门 / 服务范围', c: [
      '我们主要服务{area}，周边城市也可以沟通～评论区说下你在哪个城市，我看下能不能安排🙏'],
      d: '我们主要服务{area}。确认需求后可以预约上门测量或看现场（具体时间看当周排期），之后会出详细方案和报价，你确认了再安排，不用有压力～' },
    { k: 'quality', label: '质量怎么样 / 用什么材料', c: [
      '材料和配置都会在报价单上写明规格，施工{features}，完工后一起验收，有问题可以随时找我们回访～'],
      d: '质量这块我们比较在意：材料、配置都会写进报价单；施工{features}；完工后会一起验收，有问题按合同约定处理。也可以先翻翻我之前分享的真实案例，再做决定～' },
    { k: 'time', label: '工期 / 多久能做好', c: [
      '工期要看是现货还是定制、以及现场情况，常规的从确认方案到完工一般需要几周，具体以确认后的排期为准～'],
      d: '一般流程是：沟通需求 → 上门测量 → 出方案报价 → 下单/备料 → 施工验收。定制类需要生产周期，确认需求后我们会给你一个排期，也会提前告诉你需要配合的事项。' },
    { k: 'warranty', label: '保修 / 售后', c: [
      '保修期限和范围都会写在合同里～完工后有任何问题都可以联系我们回访处理🙏'],
      d: '售后你放心：保修的期限和范围会在合同里写清楚；平时使用有问题（比如需要调整、维修），联系我们会安排回访。' },
    { k: 'discount', label: '能不能便宜点', c: [
      '价格主要看材料和做工，我们不会靠减料来降价～预算有限的话可以说说，我帮你调整方案，在预算里做到合适的效果👍'],
      d: '理解想控制预算～我们不会用减料、偷工的方式压价，但可以根据你的预算调整方案（比如换一种配置或分阶段做），把钱花在重点上。你可以说说大概预算，我帮你配一个方案。' },
    { k: 'contact', label: '怎么联系你', c: [
      '平台上不方便互留站外信息哈～可以直接在评论区留言，或者点我头像给我发消息，看到都会回复🙏'],
      d: '可以直接在这里跟我沟通哦～把你的城市、需求和现场照片发过来，我整理好方案后回复你。' },
    { k: 'stock', label: '有没有现货 / 多久到', c: [
      '常规款有时有现货，定制款需要生产周期～具体看你要的款式和尺寸，评论区说下需求我帮你看看'],
      d: '常规款会备一些现货，定制款需要按尺寸生产，周期确认下单后会告诉你。你可以先说说想要的款式和尺寸，我帮你看看哪种更合适。' },
    { k: 'cases', label: '有没有案例可以看', c: [
      '可以翻翻我之前的笔记，里面有不少真实案例和前后对比～有类似情况的也欢迎评论区问我'],
      d: '可以先翻翻我之前发的案例笔记，里面有改造前后对比和具体做法；如果有和你家情况类似的，我也可以跟你详细说说当时是怎么处理的。' },
  ];
  const Q_SCUBA = [
    { k: 'price', label: '课程多少钱', c: ['费用要看课程级别和包含内容（教材/eLearning、装备租赁、船票、证书费等），每家包含的不一样，比较时一定问清楚“总共包含哪些”～评论区说下想考哪一级，我给你说说大概构成'],
      d: '课程费用一般由几部分组成：理论（eLearning）、泳池训练、开放水域潜水，以及装备租赁、船票、证书费等。不同课程级别和安排包含的内容不同，你可以说说想考哪一级、什么时间方便，我把包含和不包含的项目列清楚给你。' },
    { k: 'visit', label: '在哪里上课', c: ['我们主要在{area}一带上课：泳池训练在泳池进行，开放水域一般安排在拉霍亚或卡特琳娜岛等地，具体按天气和水况安排～'],
      d: '上课地点：泳池训练在{area}附近的泳池；开放水域潜水会根据天气和水况，安排在拉霍亚、卡特琳娜岛等常见的教学潜点。具体日程确认后我会提前发给你。' },
    { k: 'quality', label: '安全吗 / 教练资质', c: ['潜水的安全来自规范的训练和装备检查：课程按 PADI 标准流程进行，装备定期保养，下水前都会做潜伴检查～'],
      d: '安全是第一位的：课程按 PADI 标准流程进行，装备会定期保养，每次下水前都做潜伴检查。报名前需要填一份健康问卷，如果有哮喘、心脏、耳部等方面的情况，需要先请医生评估。' },
    { k: 'time', label: '多久能拿证', c: ['开放水域课程一般包括理论（可用 eLearning 提前学）、泳池训练和 4 次开放水域潜水，常见安排是两个周末左右，具体看你的时间和进度～'],
      d: 'OW 课程一般分三步：在线理论（可以提前在家学）、泳池技能训练、4 次开放水域潜水。常见安排是两个周末左右，具体会按你的时间和学习进度来定，不会为了赶进度压缩练习。' },
    { k: 'warranty', label: '学不会怎么办', c: ['每个人适应速度不一样，没练熟的技能会再安排练习，不会让你带着不熟练的技能下海～'],
      d: '别担心，每个人适应水下的速度不一样。某个技能没练熟，我们会再安排练习，确认掌握了再进行下一步，安全和舒适比进度更重要。' },
    { k: 'discount', label: '有没有优惠', c: ['偶尔会有结伴报名之类的安排，具体以当期为准～比起价格，更建议关注课程包含哪些内容、是不是小班'],
      d: '具体的活动以当期为准哦～选课程时更建议你比较：包含哪些内容、是不是小班、开放水域安排在哪里，这些对学习效果影响更大。' },
    { k: 'contact', label: '怎么报名 / 联系', c: ['平台上不方便互留站外信息哈～可以在评论区留言，或者点我头像给我发消息，说下想学的课程和时间🙏'],
      d: '可以直接在这里跟我说：想学哪个课程、大概什么时间方便、有没有游泳基础，我帮你安排合适的日程。' },
    { k: 'stock', label: '要自己买装备吗', c: ['学 OW 时基础装备一般可以租，建议先自己买一个贴合的面镜，其他的等潜过几次再决定～'],
      d: '刚开始不用急着买全套：学习期间大部分装备可以租，建议先买一个贴合自己脸型的面镜（近视可以配度数），潜过几次、确定自己的潜水习惯后再买其他装备。' },
    { k: 'cases', label: '不会游泳能学吗', c: ['需要有基本的水性：OW 课程里有游泳和踩水的要求，可以先参加一次体验潜水，看看自己适不适合～'],
      d: 'OW 课程对水性有基本要求（游一段距离、踩水一段时间），不需要游得很快。如果不确定，可以先参加体验潜水，在教练陪同下感受一下，再决定要不要报正式课程。' },
  ];
  const Q_FOOD = [
    { k: 'price', label: '人均多少', c: ['人均看点什么，两个人点 2-3 个菜比较合适，具体价格以店内菜单为准～招牌菜可以优先试试😋'], d: '人均主要看点的菜，两个人点 2-3 个菜比较合适；具体价格以店内菜单为准。第一次来可以先试试招牌菜，口味有什么要求可以跟服务员说。' },
    { k: 'visit', label: '有没有外卖 / 外送', c: ['可以在常用的外卖平台下单，也可以到店自取～能送到的范围以平台显示为准'], d: '外卖可以在常用的外卖平台下单，也可以到店自取；能送到的范围以平台显示为准。堂食趁热吃口感会更好哦～' },
    { k: 'quality', label: '食材新不新鲜', c: ['我们每天当天备料，汤底和面团都是当天做的～建议堂食趁热吃，口感更好'], d: '食材都是当天备料，汤底每天熬、面团当天和；有什么忌口（比如不吃辣、海鲜过敏）点菜时跟服务员说一声就好。' },
    { k: 'time', label: '要排队多久', c: ['周末饭点人比较多，建议避开 12 点到 1 点的高峰；工作日中午基本不用等～'], d: '周末中午和晚上是高峰，建议提前订位或者错峰来；工作日中午一般不用等太久。' },
    { k: 'warranty', label: '能不能订位', c: ['可以提前预约订位，人多的话建议提前一两天说，帮你留大桌～'], d: '可以订位的～告诉我们日期、时间和人数就行；8 人以上建议提前一两天，方便帮你安排大桌或包间。' },
    { k: 'discount', label: '有没有优惠', c: ['店里偶尔会有活动，具体以店内公告为准～'], d: '活动会不定期安排，具体以店内公告为准～第一次来可以先试试招牌菜。' },
    { k: 'contact', label: '怎么订位 / 联系', c: ['可以在评论区留言，或者点我头像给我发消息，告诉我日期、时间和人数，我帮你安排～'], d: '直接在这里告诉我日期、时间和人数就可以，我帮你登记好；有特殊需求（生日、忌口）也可以一起说。' },
    { k: 'stock', label: '招牌菜每天都有吗', c: ['部分招牌菜每天限量，晚来可能卖完～想吃的话建议早点来，或者提前预约留一份'], d: '部分招牌菜每天限量，晚上可能会卖完；想吃的话可以提前预约帮你留一份。' },
    { k: 'cases', label: '适合聚餐吗', c: ['适合的～店里有大桌，生日、同学聚会都可以提前沟通菜单，按人数和预算帮你配菜'], d: '适合的～有大桌可以安排，生日、公司聚餐、同学会都可以提前沟通菜单，按人数和预算帮你配好菜。' },
  ];
  const NOUNS = { doors: '门窗', build: '工程', food: '小店', scuba: '课程', general: '产品' };
  const qsetOf = (ind) => (ind === 'scuba' ? Q_SCUBA : ind === 'food' ? Q_FOOD : Q_DEFAULT);

  const rp = { ind: $('rpIndustry'), profile: $('rpProfile'), scene: $('rpScene'), qs: $('rpQuestions'), custom: $('rpCustom'), result: $('rpResult'), msg: $('rpMsg') };
  let rpScene = 'comment';
  industryOptions(rp.ind, document.getElementById('industry').value);
  function renderQs() {
    rp.qs.innerHTML = qsetOf(rp.ind.value).map((q, i) => `<label><input type="checkbox" value="${q.k}" ${i < 4 ? 'checked' : ''} />${esc(q.label)}</label>`).join('');
  }
  renderQs();
  rp.ind.addEventListener('change', renderQs);
  rp.scene.addEventListener('click', (e) => {
    const b = e.target.closest('[data-scene]');
    if (!b) return;
    rpScene = b.dataset.scene;
    rp.scene.querySelectorAll('.opt').forEach((x) => x.classList.toggle('active', x === b));
  });
  document.addEventListener('xhs:tab', (e) => { if (e.detail === 'tools') { profileOptions(rp.profile); profileOptions(rm.profile); caseOptions(rm.cas, rm.ind.value); } });

  function fillReply(t, vars) {
    return t.replace(/\{(s|area|features|years)\}/g, (m, k) => vars[k]);
  }
  let rpData = [];
  function renderReplies() {
    rp.result.innerHTML = rpData.map((q, qi) => `<div class="rp-q"><h4>❓ ${esc(q.question)}</h4>
      ${q.replies.map((r, ri) => {
        const hits = CHK.check(r);
        return `<div class="rp-a"><div class="txt">${CHK.highlight(r, esc)}</div><div class="acts">
          <button type="button" class="mini-copy" data-rp-copy="${qi}:${ri}">复制</button>
          ${hits.length ? `<button type="button" class="mini-copy" data-rp-fix="${qi}:${ri}">修正 ${hits.length} 处</button>` : '<span class="badge ok">✅</span>'}
        </div></div>`;
      }).join('')}</div>`).join('');
  }
  rp.result.addEventListener('click', (e) => {
    const c = e.target.closest('[data-rp-copy]');
    const f = e.target.closest('[data-rp-fix]');
    const [qi, ri] = String((c || f || {}).dataset ? (c ? c.dataset.rpCopy : f ? f.dataset.rpFix : '') : '').split(':').map(Number);
    if (c) X.copyText(rpData[qi].replies[ri]);
    if (f) { rpData[qi].replies[ri] = CHK.replaceAll(rpData[qi].replies[ri]); renderReplies(); }
  });

  $('btnRpGen').addEventListener('click', async () => {
    const set = qsetOf(rp.ind.value);
    const picked = [...rp.qs.querySelectorAll('input:checked')].map((x) => set.find((q) => q.k === x.value)).filter(Boolean);
    const custom = rp.custom.value.split(/\n+/).map((x) => x.trim()).filter(Boolean);
    if (!picked.length && !custom.length) { X.toast('至少选一个问题'); return; }
    const pf = rp.profile.value && window.XHSLibrary ? window.XHSLibrary.getProfile(rp.profile.value) : null;
    let ai;
    try { ai = wantAI(); } catch { return; }
    if (ai) {
      const btn = $('btnRpGen');
      btn.disabled = true; btn.textContent = '⏳ AI 生成中…';
      try {
        const schema = { type: 'object', properties: { replies: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, replies: { type: 'array', items: { type: 'string' } } }, required: ['question', 'replies'], additionalProperties: false } } }, required: ['replies'], additionalProperties: false };
        const system = X.systemPromptFor({ industry: rp.ind.value }) + `

【回复话术】为下面每个常见问题写 2-3 条${rpScene === 'comment' ? '评论区回复（每条 80 字以内，公开可见）' : '私信回复（每条 180 字以内）'}：
- 专业、真诚、有温度，像真人回复；先回应问题，再给出下一步（比如请对方说明城市、尺寸或需求）；
- 不出现电话、微信、邮箱、网址、二维码等站外联系方式，不引导站外交易；不承诺具体价格和效果，不使用绝对化用语；
- question 原样返回问题。`;
        const user = [`场景：${rpScene === 'comment' ? '评论区' : '私信'}`, ...X.libPromptLines({ profile: pf, case: null }), '', '问题：', ...picked.map((q) => '- ' + q.label), ...custom.map((q) => '- ' + q)].join('\n');
        const obj = await aiJSON({ system, user, schema, maxTokens: 8000 });
        rpData = (obj.replies || []).map((x) => ({ question: String(x.question || ''), replies: (x.replies || []).map(String).filter(Boolean) }));
        rp.msg.textContent = '';
      } catch (err) { rp.msg.textContent = '❌ ' + (err.message || err); return; }
      finally { btn.disabled = false; btn.textContent = '💬 生成回复'; }
    } else {
      const vars = {
        s: NOUNS[rp.ind.value] || '产品',
        area: (pf && pf.area) || '洛杉矶周边',
        features: pf && pf.features ? '方面：' + String(pf.features).replace(/[。.]$/, '') : '由我们自己的团队完成',
        years: (pf && pf.years) || '',
      };
      rpData = picked.map((q) => ({
        question: q.label,
        replies: rpScene === 'comment' ? q.c.map((t) => fillReply(t, vars)) : ['你好～谢谢关注！' + fillReply(q.d, vars) + ' 有其他问题随时问我🙏'],
      }));
      custom.forEach((q) => rpData.push({
        question: q,
        replies: [rpScene === 'comment'
          ? `谢谢关注～关于“${q}”，每家情况不太一样，可以在评论区说说你的城市和具体需求，我看到会认真回复🙏`
          : `你好～关于“${q}”，方便的话说一下你的具体情况（城市、需求、时间），我了解清楚后给你一个准确的答复。`],
      }));
      rp.msg.textContent = custom.length ? '💡 自定义问题在模板模式下只能给通用回复，切换到 AI 模式可以针对性回答。' : '';
    }
    renderReplies();
  });

  window.XHSTools = { showTool, aiJSON, wantAI, industryOptions, subOptions, profileOptions, newId, analyzeNote, overlaps, templateRemix };
})();
