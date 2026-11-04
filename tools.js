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

  window.XHSTools = { showTool, aiJSON, wantAI, industryOptions, subOptions, profileOptions, newId };
})();
