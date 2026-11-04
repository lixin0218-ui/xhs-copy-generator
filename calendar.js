/*
 * 内容日历：一次规划 7/14/30 天选题，按比例搭配干货/案例/避坑/互动，可导出 CSV，可一键生成某天的笔记。
 */
(function () {
  'use strict';
  const X = window.XHS;
  const T = window.XHSTools;
  const esc = X.esc;
  const $ = (id) => document.getElementById(id);
  const KEY = 'xhs_calendar';
  const TYPES = {
    ganhuo: { name: '干货', icon: '📚', tone: 'ganhuo' },
    case: { name: '案例', icon: '📍', tone: 'tiyan' },
    bikeng: { name: '避坑', icon: '⚠️', tone: 'bikeng' },
    interact: { name: '互动', icon: '💬', tone: 'zhongcao' },
  };
  const WEEK = ['日', '一', '二', '三', '四', '五', '六'];
  const INTERACT = [
    '你家{s}用了几年了？评论区报个数👇', '{term}和{term2}，你会选哪个？', '换{s}前你纠结过什么？评论区聊聊',
    '晒晒你家的{s}，我来帮你看看', '关于{s}，你想问什么？评论区见', '{s}这些说法，你听过几个？', '你在{s}上踩过坑吗？说说你的经历',
  ];
  const GENERAL_TITLES = {
    ganhuo: ['{t}，看这篇就够了✅', '关于{t}，新手必看的{n}点', '{t}入门指南🔍', '{t}选购清单｜建议收藏'],
    bikeng: ['{t}别踩这{n}个坑⚠️', '{t}避雷指南', '买{t}前一定要看❗'],
    case: ['{t}真实案例分享📝', '{t}使用{n}个月的真实感受'],
  };

  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const len = (s) => Array.from(String(s)).length;
  function fill(tpl, ctx) {
    return tpl.replace(/\{(t|p|s|c|k|k2|term|term2|n)\}/g, (m, k) => (ctx[k] !== undefined && ctx[k] !== '' ? String(ctx[k]) : ''));
  }
  const firstSentence = (t) => String(t || '').split(/[。！？]/)[0].slice(0, 46);

  const el = {
    ind: $('calIndustry'), sub: $('calSub'), topic: $('calTopic'), profile: $('calProfile'), start: $('calStart'), days: $('calDays'),
    list: $('calList'), card: $('calPlanCard'), meta: $('calMeta'), msg: $('calMsg'),
  };
  T.industryOptions(el.ind, document.getElementById('industry').value);
  T.subOptions(el.sub, el.ind.value, '', '不限（轮换）');
  el.ind.addEventListener('change', () => T.subOptions(el.sub, el.ind.value, '', '不限（轮换）'));
  const tomorrow = new Date(Date.now() + 86400000);
  el.start.value = isoDate(tomorrow);
  document.addEventListener('xhs:tab', (e) => { if (e.detail === 'calendar') T.profileOptions(el.profile); });
  T.profileOptions(el.profile);

  function isoDate(d) {
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }
  function addDays(iso, n) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d + n);
  }

  /** 按比例分配类型，并穿插排列（尽量不连续两天同类型） */
  function typeSequence(days, ratios) {
    const keys = Object.keys(TYPES);
    const sum = keys.reduce((a, k) => a + Math.max(0, ratios[k] || 0), 0) || 1;
    const exact = keys.map((k) => ({ k, v: (Math.max(0, ratios[k] || 0) / sum) * days }));
    const counts = Object.fromEntries(exact.map((x) => [x.k, Math.floor(x.v)]));
    let left = days - Object.values(counts).reduce((a, b) => a + b, 0);
    exact.sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v))).forEach((x) => { if (left > 0 && x.v > 0) { counts[x.k]++; left--; } });
    const total = { ...counts };
    const seq = [];
    let prev = '';
    for (let i = 0; i < days; i++) {
      const cand = keys.filter((k) => counts[k] > 0);
      if (!cand.length) break;
      // 剩余比例最高、且不和前一天相同的类型优先
      cand.sort((a, b) => counts[b] / (total[b] || 1) - counts[a] / (total[a] || 1));
      const k = cand.find((x) => x !== prev) || cand[0];
      seq.push(k); counts[k]--; prev = k;
    }
    return seq;
  }

  function templatePlan(cfg, seq) {
    const ind = X.INDUSTRIES[cfg.industry];
    const subs = ind && ind.subs.length ? (cfg.sub ? ind.subs.filter((s) => s.id === cfg.sub) : shuffle(ind.subs)) : [];
    const cases = (window.XHSLibrary ? window.XHSLibrary.cases() : []).filter((c) => c.industry === cfg.industry && (!cfg.sub || !c.sub || c.sub === cfg.sub));
    const topic = cfg.topic || (ind && ind.subs.length ? '' : '我的主题');
    let si = 0;
    let ci = 0;
    const usedTitles = new Set();
    return seq.map((type, i) => {
      // 案例日：细分跟着案例走
      const caseObj = type === 'case' && cases.length ? cases[ci % cases.length] : null;
      const caseSub = caseObj && caseObj.sub && ind ? ind.subs.find((x) => x.id === caseObj.sub) : null;
      const sub = caseSub || (subs.length ? subs[si++ % subs.length] : null);
      const sName = sub ? (sub.short || sub.name) : topic;
      const terms = sub ? sub.terms.filter((t) => len(t) <= 6) : [topic];
      const ctx = { t: cfg.topic || sName, s: sName, c: pick(window.XHSIndustries.LA_CITIES), term: pick(terms), term2: pick(terms), k: pick(terms), n: pick([3, 4, 5]), p: '' };
      const day = { date: isoDate(addDays(cfg.start, i)), type, sub: sub ? sub.id : '', title: '', angle: '', caseId: '', status: '' };
      let title = '';
      for (let tries = 0; tries < 8 && (!title || usedTitles.has(title) || len(title) > 20); tries++) {
        if (type === 'interact') title = fill(pick(INTERACT), ctx);
        else if (type === 'case') {
          const c = caseObj;
          if (c) { title = `${c.city || ctx.c}${sName}真实案例📍`; day.caseId = c.id; day.angle = '带入案例：' + window.XHSLibrary.caseTitle(c); }
          else title = fill(pick(ind && ind.subs.length ? ind.titles.tiyan : GENERAL_TITLES.case), ctx);
        } else {
          const pool = ind && ind.subs.length ? ind.titles[type] : GENERAL_TITLES[type];
          title = fill(pick(pool), ctx);
        }
      }
      if (type === 'case') ci++;
      usedTitles.add(title);
      day.title = title;
      if (!day.angle) {
        if (type === 'ganhuo' && sub) day.angle = '要点：' + firstSentence(pick(sub.facts));
        else if (type === 'bikeng' && sub) day.angle = '重点讲：' + firstSentence(pick(sub.pitfalls));
        else if (type === 'interact') day.angle = '短一点、多提问，置顶一条自己的回答，带动评论';
        else if (type === 'case') day.angle = '还没有本行业的案例：先去「📚 资料库」录入，或用「素材变笔记」整理一个';
        else day.angle = '';
      }
      return day;
    });
  }

  async function aiPlan(cfg, seq, base) {
    const ind = X.INDUSTRIES[cfg.industry];
    const profile = cfg.profileId && window.XHSLibrary ? window.XHSLibrary.getProfile(cfg.profileId) : null;
    const schema = {
      type: 'object',
      properties: {
        days: {
          type: 'array',
          items: {
            type: 'object',
            properties: { title: { type: 'string', description: '选题标题，20 字以内' }, angle: { type: 'string', description: '这篇写什么、怎么写，40 字以内' } },
            required: ['title', 'angle'], additionalProperties: false,
          },
        },
      },
      required: ['days'], additionalProperties: false,
    };
    const lines = base.map((d, i) => {
      const c = d.caseId && window.XHSLibrary.getCase(d.caseId);
      const sub = ind && ind.subs.find((x) => x.id === d.sub);
      return `${i + 1}. ${d.date} · 类型：${TYPES[d.type].name}${sub ? ' · 细分：' + sub.name : ''}${c ? ' · 案例：' + [c.time, c.city, c.client, c.problem, c.solution, c.result].filter(Boolean).join('，') : ''}`;
    });
    const system = X.systemPromptFor({ industry: cfg.industry, sub: cfg.sub }) + `

【内容日历】你现在是账号的内容策划。按给定的日期、类型和细分方向，为每一天写一个小红书选题标题和一句写作角度。
- 干货：讲清一个具体知识点；案例：围绕给定案例写真实经历；避坑：讲一个具体的坑和怎么避；互动：提问、投票、晒图征集，带动评论。
- 选题之间不要重复，要覆盖不同的细分和角度；标题 20 字以内，不用违禁词。
- 输出的 days 数量必须和给定的天数完全一致，按顺序对应。`;
    const user = [
      `行业：${ind ? ind.name : '通用'}`, cfg.topic ? `主题方向：${cfg.topic}` : '',
      ...X.libPromptLines({ profile, case: null }),
      '', `请为下面 ${base.length} 天规划选题：`, ...lines,
    ].filter(Boolean).join('\n');
    const obj = await T.aiJSON({ system, user, schema, maxTokens: 12000 });
    const out = Array.isArray(obj.days) ? obj.days : [];
    return base.map((d, i) => ({ ...d, title: String((out[i] || {}).title || d.title).trim(), angle: String((out[i] || {}).angle || d.angle).trim() }));
  }

  // ================= 渲染 / 存储 =================
  const loadPlan = () => X.store.json(KEY, null);
  const savePlan = (plan) => { X.store.set(KEY, JSON.stringify(plan)); render(); };

  function render() {
    const plan = loadPlan();
    $('btnCalCsv').disabled = !plan;
    $('btnCalClear').disabled = !plan;
    el.card.hidden = !plan;
    if (!plan) return;
    const ind = X.INDUSTRIES[plan.industry] || X.INDUSTRIES.general;
    const done = plan.days.filter((d) => d.status === 'done').length;
    el.meta.textContent = `· ${ind.name} · ${plan.days.length} 天 · 已生成 ${done} 篇`;
    el.list.innerHTML = plan.days.map((d, i) => {
      const dt = addDays(d.date, 0);
      const sub = ind.subs.find((x) => x.id === d.sub);
      const t = TYPES[d.type];
      return `<div class="cal-day ${d.status === 'done' ? 'done' : ''}">
        <div class="cal-date"><b>${dt.getMonth() + 1}月${dt.getDate()}日</b><small>周${WEEK[dt.getDay()]}</small></div>
        <div>
          <div class="cal-title"><span class="type-chip type-${d.type}">${t.icon} ${t.name}</span>${X.esc(d.title)}</div>
          <div class="cal-angle">${sub ? esc(sub.name) + ' · ' : ''}${esc(d.angle || '')}</div>
        </div>
        <div class="cal-actions">
          <button type="button" class="btn ${d.status === 'done' ? 'ghost' : 'primary'} sm" data-cal-gen="${i}">${d.status === 'done' ? '再生成' : '✍️ 生成'}</button>
          ${d.batchId ? `<button type="button" class="btn ghost sm" data-cal-view="${i}">查看</button>` : ''}
        </div>
      </div>`;
    }).join('');
  }

  $('btnCalPlan').addEventListener('click', async () => {
    const ratios = Object.fromEntries(Object.keys(TYPES).map((k) => [k, Number($('calR_' + k).value) || 0]));
    if (!Object.values(ratios).some((v) => v > 0)) { X.toast('比例不能全部为 0'); return; }
    const cfg = {
      industry: el.ind.value, sub: el.sub.value, topic: el.topic.value.trim(), profileId: el.profile.value,
      start: el.start.value || isoDate(tomorrow), days: Number(el.days.value) || 14, ratios,
    };
    if (!(X.INDUSTRIES[cfg.industry] || {}).subs?.length && !cfg.topic) { X.toast('通用行业请先填写主题方向'); el.topic.focus(); return; }
    const old = loadPlan();
    if (old && old.days.some((d) => d.status === 'done') && !confirm('重新规划会覆盖当前日历（已生成的笔记仍在历史记录里），继续吗？')) return;
    let ai;
    try { ai = T.wantAI(); } catch { return; }
    const seq = typeSequence(cfg.days, ratios);
    let days = templatePlan(cfg, seq);
    if (ai) {
      const btn = $('btnCalPlan');
      btn.disabled = true; btn.textContent = '⏳ AI 规划中…';
      try { days = await aiPlan(cfg, seq, days); el.msg.textContent = ''; } catch (err) { el.msg.textContent = '❌ AI 规划失败，已使用模板规划：' + (err.message || err); }
      finally { btn.disabled = false; btn.textContent = '🗓 生成规划'; }
    }
    const caseDays = days.filter((d) => d.type === 'case');
    if (caseDays.length && !caseDays.some((d) => d.caseId)) el.msg.textContent = '💡 案例类选题还没有带入真实案例，建议先在「📚 资料库」录入案例后重新规划。';
    savePlan({ ...cfg, created: Date.now(), days });
    X.toast(`✅ 已规划 ${days.length} 天`);
  });

  el.list.addEventListener('click', async (e) => {
    const g = e.target.closest('[data-cal-gen]');
    const v = e.target.closest('[data-cal-view]');
    const plan = loadPlan();
    if (!plan) return;
    if (v) {
      const d = plan.days[Number(v.dataset.calView)];
      const h = X.loadHistory().find((x) => x.id === d.batchId);
      if (h) X.showBatch(h, { save: false }); else X.toast('这条历史记录已被删除');
      return;
    }
    if (!g) return;
    const i = Number(g.dataset.calGen);
    const d = plan.days[i];
    const input = {
      industry: plan.industry, sub: d.sub || plan.sub || '', topic: d.title.replace(/[📍📚⚠️💬👇✅❗🔍📌📝🙋]/gu, '').trim().slice(0, 30),
      audience: '', keywords: [], tone: TYPES[d.type].tone, count: 1,
      profileId: plan.profileId || '', caseIds: d.caseId ? [d.caseId] : [], source: 'calendar',
    };
    X.fillForm(input);
    X.showTab('gen');
    const before = X.getCurrent();
    await X.runGenerate(input, X.getMode());
    const cur = X.getCurrent();
    if (cur && cur !== before && cur.posts.some((p) => p && !p.error)) {
      const fresh = loadPlan();
      if (fresh && fresh.days[i]) { fresh.days[i].status = 'done'; fresh.days[i].batchId = cur.id; X.store.set(KEY, JSON.stringify(fresh)); render(); }
    }
  });

  $('btnCalCsv').addEventListener('click', () => {
    const plan = loadPlan();
    if (!plan) return;
    const ind = X.INDUSTRIES[plan.industry] || X.INDUSTRIES.general;
    const rows = [['日期', '星期', '类型', '细分', '选题标题', '写作角度', '带入案例', '状态']];
    plan.days.forEach((d) => {
      const dt = addDays(d.date, 0);
      const c = d.caseId && window.XHSLibrary && window.XHSLibrary.getCase(d.caseId);
      rows.push([d.date, '周' + WEEK[dt.getDay()], TYPES[d.type].name, (ind.subs.find((x) => x.id === d.sub) || {}).name || '', d.title, d.angle, c ? window.XHSLibrary.caseTitle(c) : '', d.status === 'done' ? '已生成' : '未生成']);
    });
    X.download(`xhs-calendar_${plan.days[0].date}.csv`, '﻿' + rows.map((r) => r.map(X.csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  });
  $('btnCalClear').addEventListener('click', () => { if (confirm('清空当前内容日历？')) { X.store.del(KEY); render(); } });

  render();
  window.XHSCalendar = { typeSequence, KEY, render };
})();
