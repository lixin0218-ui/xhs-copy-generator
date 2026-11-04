/*
 * 一稿多用：把一篇小红书笔记改写成抖音/视频号口播脚本，以及英文版（Instagram / Facebook 洛杉矶本地社区）。
 */
(function () {
  'use strict';
  const X = window.XHS;
  const $ = (id) => document.getElementById(id);
  const el = { dlg: $('repDlg'), title: $('repTitle'), tabs: $('repTabs'), hint: $('repHint'), out: $('repOut') };
  let idx = -1;
  let kind = 'script';

  const PICTO = /[\p{Extended_Pictographic}️⃣]/gu;
  const clean = (t) => String(t || '').replace(PICTO, '').replace(/#\S+/g, '').replace(/[｜|]/g, '，').replace(/[ \t]+/g, ' ').trim();
  const firstSentences = (t, max = 60) => {
    const parts = String(t).match(/[^。！？!?]+[。！？!?]?/g) || [String(t)];
    let out = '';
    for (const p of parts) { if ((out + p).length > max && out) break; out += p; }
    return out || String(t).slice(0, max);
  };
  const NUMS = ['第一', '第二', '第三', '第四', '第五', '第六'];

  /** 模板模式：根据笔记结构拼口播脚本 */
  function templateScript(p) {
    const raw = p.body.split('\n\n');
    const isNum = (x) => /^[1-6]️⃣/.test(x);
    const points = raw.filter(isNum).map((x) => clean(x).replace(/^\d\s*/, ''));
    const caseP = raw.find((x) => x.startsWith('📍'));
    const intro = raw.find((x) => !isNum(x) && !x.startsWith('📍') && !x.startsWith('🙋')) || '';
    const who = raw.find((x) => x.startsWith('🙋'));
    const title = clean(p.titles[0] || '');
    const hook = /[？?]/.test(title) ? title : `${title}，这条一定要看完。`;
    const shots = (p.shots || []).map((x) => x.replace(/^（[^）]+）/, ''));
    const cover = (p.covers && p.covers[0]) || { main: title, sub: '' };
    const seg = [];
    const spoken = [];
    const say = (t) => { spoken.push(t); return '🎤 ' + t; };
    seg.push('—— 0-3 秒 · 开场钩子 ——', say(hook), `🎥 画面：人物近景看镜头，屏幕大字“${clean(cover.main)}”`);
    seg.push('', '—— 交代背景 ——', say(firstSentences(clean(intro), 60)));
    if (who) seg.push(say(clean(who).replace(/^先介绍一下：/, '')));
    seg.push(`🎥 画面：${shots[0] || '现场全景'}`);
    if (points.length) {
      seg.push('', '—— 正文（每点配一个画面） ——');
      points.forEach((pt, i) => {
        seg.push(say(`${NUMS[i]}，${firstSentences(pt, 56)}`), `🎥 画面：${shots[i + 1] || '对应的细节特写'}`);
      });
    }
    if (caseP) seg.push('', '—— 真实案例 ——', say(firstSentences(clean(caseP).replace(/^[^：]*：/, ''), 90)), '🎥 画面：案例前后对比');
    seg.push('', '—— 结尾 ——', say(`${clean(p.cta).split('\n')[0] || '觉得有用就点个关注'}，收藏起来慢慢看。`), '🎥 画面：回到人物近景，字幕：关注 + 收藏');
    const secs = Math.round(spoken.join('').length / 4);
    return [
      `【口播脚本】预计约 ${secs} 秒（按每秒 4 个字估算，可按需删减）`, '',
      ...seg, '',
      `📝 字幕标题：${clean(cover.main)}${cover.sub ? ' ｜ ' + clean(cover.sub) : ''}`,
      `🏷 话题：${p.tags.join(' ')}`,
    ].join('\n');
  }

  async function aiText(kindName, p) {
    const T = window.XHSTools;
    const schema = { type: 'object', properties: { text: { type: 'string' } }, required: ['text'], additionalProperties: false };
    const note = `标题：${p.titles[0]}\n\n${p.body}\n\n${p.cta}\n\n${p.tags.join(' ')}`;
    const input = X.getCurrent() ? X.getCurrent().input : {};
    if (kindName === 'script') {
      const system = X.systemPromptFor(input) + `

【一稿多用：口播脚本】把用户的小红书笔记改写成抖音/视频号的口播脚本（60-90 秒）：
- 前 3 秒必须是强钩子；口语化、短句，适合对着镜头说；
- 按段落标注“🎤 口播”和“🎥 画面”，画面要具体可拍；
- 结尾引导关注和评论；不出现站外联系方式和违禁词；
- 只用笔记里已有的事实，不要编造。输出纯文本放在 text 字段。`;
      return (await T.aiJSON({ system, user: note, schema, maxTokens: 6000 })).text;
    }
    const system = `You are a bilingual social media copywriter for small businesses serving the Los Angeles community.
Rewrite the user's Chinese Xiaohongshu note as an English post for Instagram / Facebook local community groups (Los Angeles, San Gabriel Valley, Orange County).
- Natural, friendly American English; a strong first line hook; short paragraphs with line breaks; a few emojis (not too many).
- Keep all facts (prices, dates, cities, specs) exactly; do not invent new facts, claims or guarantees.
- Adapt Chinese-platform phrasing (e.g. 收藏, 评论区) to IG/FB norms (save this post, comment below, send us a message).
- No superlatives like "best" or "#1"; no misleading claims.
- End with a soft call to action and 6-12 relevant hashtags (local + topic, e.g. #LosAngeles #SanGabrielValley).
Return plain text in the "text" field.`;
    return (await T.aiJSON({ system, user: note, schema, maxTokens: 6000 })).text;
  }

  function show() {
    const p = X.getCurrent() && X.getCurrent().posts[idx];
    if (!p) return;
    el.tabs.querySelectorAll('.opt').forEach((b) => b.classList.toggle('active', b.dataset.rep === kind));
    const saved = p.repurpose && p.repurpose[kind];
    if (saved) { el.out.textContent = saved; el.hint.textContent = '已保存的版本，可以点「重新生成」'; return; }
    generate();
  }

  async function generate() {
    const cur = X.getCurrent();
    const p = cur && cur.posts[idx];
    if (!p) return;
    const useAI = kind === 'en' ? X.hasKey() : X.getMode() === 'ai' && X.hasKey();
    if (kind === 'en' && !X.hasKey()) {
      el.hint.textContent = '';
      el.out.textContent = '🌐 英文版需要用 AI 改写（不是逐字翻译，而是按 IG / Facebook 本地社区的习惯重写）。\n\n请先在右上角「⚙️ 设置」里填写 Anthropic API Key，然后再点「重新生成」。';
      return;
    }
    el.hint.textContent = useAI ? '⏳ AI 生成中…' : '🧩 模板模式：根据笔记结构自动拆成口播脚本（AI 模式效果更自然）';
    el.out.textContent = '';
    try {
      const text = useAI ? await aiText(kind, p) : templateScript(p);
      p.repurpose = { ...(p.repurpose || {}), [kind]: text };
      X.persistCurrent();
      el.out.textContent = text;
      if (useAI) el.hint.textContent = '✨ AI 生成，发布前请再通读一遍';
    } catch (err) {
      el.hint.textContent = '❌ ' + (err.message || err);
    }
  }

  document.addEventListener('xhs:repurpose', (e) => {
    idx = e.detail;
    kind = 'script';
    el.title.textContent = `· 第 ${idx + 1} 篇`;
    el.dlg.showModal();
    show();
  });
  el.tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-rep]'); if (b) { kind = b.dataset.rep; show(); } });
  $('btnRepRegen').addEventListener('click', generate);
  $('btnRepCopy').addEventListener('click', () => { if (el.out.textContent.trim()) X.copyText(el.out.textContent); });
  $('btnCloseRep').addEventListener('click', () => el.dlg.close());
  el.dlg.addEventListener('click', (e) => { if (e.target === el.dlg) el.dlg.close(); });

  window.XHSRepurpose = { templateScript };
})();
