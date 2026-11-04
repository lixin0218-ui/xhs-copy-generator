/*
 * 数据页：效果回填（已发布状态 + 点赞/收藏/评论/咨询）、简单统计。
 */
(function () {
  'use strict';
  const X = window.XHS;
  const esc = X.esc;
  const $ = (id) => document.getElementById(id);
  const LS = X.LS;
  const FIELDS = [['likes', '点赞'], ['saves', '收藏'], ['comments', '评论'], ['leads', '咨询']];
  const el = { summary: $('statsSummary'), breakdown: $('statsBreakdown'), list: $('pubList'), filter: $('pubFilter'), search: $('pubSearch'), msg: $('backupMsg') };

  // ================= 数据读取 =================
  function allPosts() {
    const out = [];
    X.loadHistory().forEach((h) => (h.posts || []).forEach((p, i) => {
      if (p && !p.error) out.push({ h, p, i, key: h.id + ':' + i, stats: p.stats || {} });
    }));
    return out;
  }
  const num = (v) => Math.max(0, Number(v) || 0);

  function updateStats(key, patch) {
    const [hid, iStr] = key.split(':');
    const i = Number(iStr);
    const list = X.loadHistory();
    const h = list.find((x) => x.id === hid);
    if (!h || !h.posts[i]) return;
    h.posts[i].stats = { ...(h.posts[i].stats || {}), ...patch };
    X.store.set(LS.history, JSON.stringify(list));
    // 当前显示的批次也同步一下，避免之后保存时覆盖
    const cur = X.getCurrent();
    if (cur && cur.id === hid) {
      const valid = cur.posts.filter((p) => p && !p.error);
      if (valid[i]) valid[i].stats = h.posts[i].stats;
    }
  }

  // ================= 统计 =================
  function renderStats() {
    const posts = allPosts();
    const pub = posts.filter((x) => x.stats.published);
    const sum = (k) => pub.reduce((a, x) => a + num(x.stats[k]), 0);
    const avg = (k) => (pub.length ? (sum(k) / pub.length).toFixed(1) : '0');
    const tiles = [
      [posts.length, '生成的笔记'], [pub.length, '已发布'],
      [sum('likes'), `点赞（均 ${avg('likes')}）`], [sum('saves'), `收藏（均 ${avg('saves')}）`],
      [sum('comments'), `评论（均 ${avg('comments')}）`], [sum('leads'), `咨询（均 ${avg('leads')}）`],
    ];
    el.summary.innerHTML = tiles.map(([v, l]) => `<div class="stat"><b>${v}</b><span>${esc(l)}</span></div>`).join('');
    if (!pub.length) {
      el.breakdown.innerHTML = '<p class="hint">还没有已发布的笔记。在下方把发过的笔记标记为“已发布”并填写数据，这里会按行业、语气和内容来源统计效果。</p>';
      return;
    }
    const group = (keyFn, nameFn) => {
      const m = new Map();
      pub.forEach((x) => { const k = keyFn(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); });
      return [...m.entries()].map(([k, xs]) => ({
        name: nameFn(k), n: xs.length,
        ...Object.fromEntries(FIELDS.map(([f]) => [f, (xs.reduce((a, x) => a + num(x.stats[f]), 0) / xs.length).toFixed(1)])),
      })).sort((a, b) => b.saves - a.saves);
    };
    const SOURCE = { material: '素材变笔记', remix: '爆款仿写', calendar: '内容日历' };
    const table = (title, rows) => `<div class="bd-title">${esc(title)}</div><div class="bd-wrap"><table class="bd-table">
      <tr><th>分组</th><th>篇数</th>${FIELDS.map(([, n]) => `<th>平均${n}</th>`).join('')}</tr>
      ${rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${r.n}</td>${FIELDS.map(([f]) => `<td>${r[f]}</td>`).join('')}</tr>`).join('')}
    </table></div>`;
    const score = (x) => num(x.stats.saves) * 2 + num(x.stats.comments) * 2 + num(x.stats.leads) * 5 + num(x.stats.likes);
    const top = [...pub].sort((a, b) => score(b) - score(a)).slice(0, 5);
    el.breakdown.innerHTML =
      table('按行业', group((x) => x.h.input.industry || 'general', (k) => (X.INDUSTRIES[k] || X.INDUSTRIES.general).name)) +
      table('按语气风格', group((x) => x.h.input.tone, (k) => X.TONE_NAMES[k] || k)) +
      table('按内容来源', group((x) => x.h.input.source || 'gen', (k) => SOURCE[k] || '批量生成')) +
      table('带入真实案例 vs 没带', group((x) => (x.p.caseId ? 'y' : 'n'), (k) => (k === 'y' ? '带入真实案例' : '未带入案例'))) +
      `<div class="bd-title">🏆 效果最好的 5 篇（收藏、评论、咨询加权）</div><ol class="top-list">${top.map((x) => `<li>${esc(x.p.titles[0] || '')} <span class="muted">· 赞 ${num(x.stats.likes)} · 藏 ${num(x.stats.saves)} · 评 ${num(x.stats.comments)} · 咨询 ${num(x.stats.leads)}</span></li>`).join('')}</ol>`;
  }

  // ================= 效果回填列表 =================
  function renderList() {
    const f = el.filter.value;
    const q = el.search.value.trim();
    let posts = allPosts();
    if (f === 'pub') posts = posts.filter((x) => x.stats.published);
    if (f === 'unpub') posts = posts.filter((x) => !x.stats.published);
    if (q) posts = posts.filter((x) => (x.p.titles || []).join(' ').includes(q) || (x.h.input.topic || '').includes(q));
    const shown = posts.slice(0, 120);
    el.list.innerHTML = shown.length ? shown.map((x) => {
      const s = x.stats;
      return `<div class="pub-item ${s.published ? 'on' : ''}" data-key="${esc(x.key)}">
        <div class="pub-head">
          <div><div class="pub-title">${esc(x.p.titles[0] || '(无标题)')}</div>
          <div class="pub-meta">${X.fmtTime(x.h.time)} · ${esc((X.INDUSTRIES[x.h.input.industry] || X.INDUSTRIES.general).name)} · ${esc(X.TONE_NAMES[x.h.input.tone] || '')}${x.p.caseLabel ? ' · 📍案例' : ''}</div></div>
          <button type="button" class="btn ghost sm" data-view="${esc(x.h.id)}">查看</button>
        </div>
        <div class="pub-fields">
          <label class="pub-toggle"><input type="checkbox" data-f="published" ${s.published ? 'checked' : ''} />已发布</label>
          <label>发布日期<input type="date" data-f="date" value="${esc(s.date || '')}" /></label>
          ${FIELDS.map(([k, n]) => `<label>${n}<input type="number" min="0" inputmode="numeric" data-f="${k}" value="${s[k] ?? ''}" /></label>`).join('')}
        </div>
      </div>`;
    }).join('') + (posts.length > shown.length ? `<p class="hint">只显示最近 ${shown.length} 篇，可以用搜索找更早的。</p>` : '')
      : '<div class="lib-empty">没有符合条件的笔记</div>';
  }

  el.list.addEventListener('change', (e) => {
    const inp = e.target.closest('[data-f]');
    if (!inp) return;
    const item = inp.closest('[data-key]');
    const f = inp.dataset.f;
    let v = inp.type === 'checkbox' ? inp.checked : inp.value;
    if (inp.type === 'number') v = v === '' ? '' : num(v);
    const patch = { [f]: v };
    if (f === 'published' && v && !item.querySelector('[data-f=date]').value) {
      patch.date = new Date().toISOString().slice(0, 10);
      item.querySelector('[data-f=date]').value = patch.date;
    }
    updateStats(item.dataset.key, patch);
    item.classList.toggle('on', !!item.querySelector('[data-f=published]').checked);
    renderStats();
  });
  el.list.addEventListener('click', (e) => {
    const v = e.target.closest('[data-view]');
    if (!v) return;
    const h = X.loadHistory().find((x) => x.id === v.dataset.view);
    if (h) { X.showBatch(h, { save: false }); X.fillForm(h.input); }
  });
  el.filter.addEventListener('change', renderList);
  el.search.addEventListener('input', renderList);
  document.addEventListener('xhs:tab', (e) => { if (e.detail === 'data') { renderStats(); renderList(); } });

  $('btnStatsCsv').addEventListener('click', () => {
    const rows = [['生成时间', '行业', '语气', '标题', '是否发布', '发布日期', '点赞', '收藏', '评论', '咨询', '带入案例']];
    allPosts().forEach((x) => rows.push([
      X.fmtTime(x.h.time), (X.INDUSTRIES[x.h.input.industry] || X.INDUSTRIES.general).name, X.TONE_NAMES[x.h.input.tone] || '',
      x.p.titles[0] || '', x.stats.published ? '是' : '否', x.stats.date || '', ...FIELDS.map(([k]) => x.stats[k] ?? ''), x.p.caseLabel || '',
    ]));
    X.download(`xhs-stats_${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + rows.map((r) => r.map(X.csvCell).join(',')).join('\r\n'), 'text/csv;charset=utf-8');
  });

  window.XHSData = { renderStats, renderList, allPosts };
})();
