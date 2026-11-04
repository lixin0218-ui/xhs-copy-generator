/*
 * 违禁词 / 限流词检测引擎：词库见 banned-words.js，自定义词保存在浏览器 localStorage。
 */
(function () {
  'use strict';

  const CUSTOM_KEY = 'xhs_custom_words';
  const LIB = window.XHSBannedWords;
  const isLatin = (ch) => !!ch && /[A-Za-z0-9]/.test(ch);

  /** 解析自定义词：每行一个，格式“词=替换1/替换2”，替换可省略 */
  function parseCustom(text) {
    return String(text || '').split(/\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#')).map((l) => {
      const [w, alt] = l.split(/[=＝]/);
      return [w.trim(), 'custom', alt ? alt.split(/[/／]/).map((s) => s.trim()) : ['']];
    }).filter((x) => x[0]);
  }
  function customText() {
    try { return localStorage.getItem(CUSTOM_KEY) || ''; } catch { return ''; }
  }
  function setCustomText(t) {
    try { localStorage.setItem(CUSTOM_KEY, t); } catch { /* ignore */ }
    rules = null;
  }

  let rules = null;
  function buildRules() {
    const list = [];
    [...LIB.words, ...parseCustom(customText())].forEach(([w, cat, alts, level], idx) => {
      if (!w) return;
      list.push({
        id: 'w' + idx + ':' + w, word: w, cat, alts: alts || [''],
        level: level || (LIB.categories[cat] || {}).level || 'high',
        latin: /[A-Za-z]/.test(w), lower: w.toLowerCase(),
      });
    });
    // 长词优先，保证“全网最低价”不会被拆成“最低”
    list.sort((a, b) => b.word.length - a.word.length);
    const pats = LIB.patterns.map((p, idx) => ({
      id: 'p' + idx, name: p.name, re: new RegExp(p.re, 'g' + (p.flags || '')), cat: p.cat, alts: p.alts || [''],
      level: p.level || (LIB.categories[p.cat] || {}).level || 'high', generic: !!p.generic,
    }));
    return { list, pats };
  }

  /**
   * 检测文本，返回不重叠的命中列表
   * @returns {{start:number,end:number,text:string,id:string,cat:string,catName:string,level:string,alts:string[],name:string}[]}
   */
  function check(text) {
    text = String(text || '');
    if (!text) return [];
    if (!rules) rules = buildRules();
    const lower = text.toLowerCase();
    const found = [];
    for (const r of rules.list) {
      const hay = r.latin ? lower : text;
      const needle = r.latin ? r.lower : r.word;
      let from = 0;
      for (;;) {
        const i = hay.indexOf(needle, from);
        if (i < 0) break;
        from = i + needle.length;
        // 英文词要求前后不是字母数字，避免把“wx”匹配进英文单词里
        if (r.latin && (isLatin(text[i - 1]) && isLatin(r.word[0]) || isLatin(text[from]) && isLatin(r.word[r.word.length - 1]))) continue;
        found.push({ start: i, end: from, rule: r });
      }
    }
    for (const p of rules.pats) {
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(text))) {
        if (!m[0]) { p.re.lastIndex++; continue; }
        if (p.generic && LIB.superWhitelist.includes(text.substr(m.index, 2))) continue;
        found.push({ start: m.index, end: m.index + m[0].length, rule: p, generic: p.generic });
      }
    }
    // 短语白名单：落在白名单短语里的命中不算
    const safe = [];
    (LIB.phraseWhitelist || []).forEach((ph) => {
      let from = 0;
      for (;;) { const i = text.indexOf(ph, from); if (i < 0) break; safe.push([i, i + ph.length]); from = i + 1; }
    });
    if (safe.length) {
      for (let i = found.length - 1; i >= 0; i--) {
        const f = found[i];
        if (safe.some(([a, b]) => f.start >= a && f.end <= b)) found.splice(i, 1);
      }
    }
    // 排序：起点优先，同起点取更长；泛匹配排最后
    found.sort((a, b) => a.start - b.start || (a.generic ? 1 : 0) - (b.generic ? 1 : 0) || (b.end - b.start) - (a.end - a.start));
    const out = [];
    let lastEnd = -1;
    for (const f of found) {
      if (f.start < lastEnd) continue;
      lastEnd = f.end;
      const cat = LIB.categories[f.rule.cat] || {};
      out.push({
        start: f.start, end: f.end, text: text.slice(f.start, f.end), id: f.rule.id,
        cat: f.rule.cat, catName: cat.name || f.rule.cat, level: f.rule.level, alts: f.rule.alts,
        name: f.rule.name || f.rule.word,
      });
    }
    return out;
  }

  /** 把命中词用 <mark> 包起来（输入为原始文本，输出为安全 HTML） */
  function highlight(text, esc) {
    text = String(text || '');
    const hits = check(text);
    if (!hits.length) return esc(text);
    let html = '';
    let pos = 0;
    for (const h of hits) {
      html += esc(text.slice(pos, h.start));
      const tip = `${h.catName}：${h.name}${h.alts.filter(Boolean).length ? '，建议改为：' + h.alts.filter(Boolean).join(' / ') : '，建议删除'}`;
      html += `<mark class="vio vio-${h.level}" title="${esc(tip)}">${esc(h.text)}</mark>`;
      pos = h.end;
    }
    return html + esc(text.slice(pos));
  }

  /** 替换：对 rule id 和命中文本相同的位置做替换（从后往前，位置不乱） */
  function replaceIn(text, id, matched, alt) {
    text = String(text || '');
    const hits = check(text).filter((h) => h.id === id && h.text === matched);
    for (let i = hits.length - 1; i >= 0; i--) text = text.slice(0, hits[i].start) + alt + text.slice(hits[i].end);
    return tidy(text);
  }
  /** 全部替换为各自的第一个建议 */
  function replaceAll(text) {
    text = String(text || '');
    const hits = check(text);
    for (let i = hits.length - 1; i >= 0; i--) text = text.slice(0, hits[i].start) + (hits[i].alts[0] || '') + text.slice(hits[i].end);
    return tidy(text);
  }
  // 删除词后清理多余的空格和重复标点
  function tidy(t) {
    return t.replace(/[ \t]+([，。！？、；：])/g, '$1').replace(/[ \t]{2,}/g, ' ').replace(/([，。！？、])\1+/g, '$1').replace(/，([。！？])/g, '$1').replace(/^[，、]\s*/gm, '');
  }

  /** 汇总：按“分类 + 词”分组，统计次数 */
  function summarize(texts) {
    const groups = new Map();
    let total = 0;
    let high = 0;
    texts.forEach((t) => check(t).forEach((h) => {
      total++;
      if (h.level === 'high') high++;
      const key = h.id + '|' + h.text;
      if (!groups.has(key)) groups.set(key, { key, id: h.id, text: h.text, cat: h.cat, catName: h.catName, level: h.level, alts: h.alts, name: h.name, count: 0 });
      groups.get(key).count++;
    }));
    const order = Object.keys(LIB.categories);
    const list = [...groups.values()].sort((a, b) => order.indexOf(a.cat) - order.indexOf(b.cat) || (a.level === 'high' ? -1 : 1));
    return { total, high, groups: list };
  }

  /** 一段简短的“避免使用”说明，放进 AI 提示词 */
  function promptHint() {
    const pick = (cat, n) => LIB.words.filter((w) => w[1] === cat && (w[3] || 'high') === 'high').slice(0, n).map((w) => w[0]).join('、');
    return `严禁出现以下类型的词（违反广告法或会被平台限流）：
- 极限词：${pick('extreme', 18)}，以及任何“最+形容词”
- 夸大承诺：${pick('efficacy', 12)}
- 导流：${pick('traffic', 14)}、任何电话号码/邮箱/网址/微信号
- 价格诱导：${pick('price', 10)}
需要表达优势时，用具体事实和细节代替绝对化形容词；需要引导咨询时，只引导到评论区留言。`;
  }

  /**
   * 检测报告 HTML：按分类列出命中的词、次数和替换建议。
   * 按钮带 data-rep-id / data-rep-text / data-rep-alt，由调用方做事件委托；scope 用来区分是哪篇文案。
   */
  function reportHTML(sum, esc, scope) {
    if (!sum.total) return `<p class="chk-ok">✅ 没有发现违禁词或限流词</p>`;
    const byCat = {};
    sum.groups.forEach((g) => { (byCat[g.cat] = byCat[g.cat] || []).push(g); });
    const parts = Object.entries(byCat).map(([cat, gs]) => {
      const c = LIB.categories[cat] || { name: cat, desc: '' };
      return `<div class="chk-cat"><div class="chk-cat-name">${esc(c.name)} <small>${esc(c.desc)}</small></div>
        ${gs.map((g) => {
          const alts = [...new Set(g.alts)].slice(0, 3);
          return `<div class="chk-item">
            <span class="chk-word vio vio-${g.level}">${esc(g.text)}</span><span class="chk-count">×${g.count}</span>
            ${g.name !== g.text ? `<span class="muted">${esc(g.name)}</span>` : ''}
            <span class="chk-alts">→ ${alts.map((a) => `<button type="button" class="chk-rep" data-scope="${esc(scope)}" data-rep-id="${esc(g.id)}" data-rep-text="${esc(g.text)}" data-rep-alt="${esc(a)}">${a ? esc(a) : '删除'}</button>`).join('')}</span>
          </div>`;
        }).join('')}
      </div>`;
    }).join('');
    return `<div class="chk-summary">共 <b>${sum.total}</b> 处${sum.high ? `，其中 <b class="red">${sum.high}</b> 处高风险` : ''}
      <button type="button" class="btn primary sm chk-rep-all" data-scope="${esc(scope)}">一键全部替换</button></div>${parts}
      <p class="hint">点建议词即可替换（同一个词会全部替换）；“一键全部替换”使用每个词的第一个建议。替换后请再通读一遍，确认语句通顺。</p>`;
  }

  window.XHSChecker = { check, highlight, replaceIn, replaceAll, summarize, reportHTML, promptHint, customText, setCustomText, categories: LIB.categories };
})();
