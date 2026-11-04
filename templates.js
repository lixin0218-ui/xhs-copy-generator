/*
 * 模板模式：内置标题公式 + 段落模板，随机组合生成文案，无需 API Key。
 * 占位符：{t}=主题  {p}=目标人群  {k}=关键词  {k2}=另一个关键词  {n}=随机数字
 */
(function () {
  'use strict';

  const TITLE_FORMULAS = {
    ganhuo: [
      '{t}｜一篇讲透📚', '{t}，看这篇就够了✅', '{p}必看！{t}', '关于{k}，90%的人不知道',
      '{n}个{k}知识点，建议收藏', '保姆级教程｜{t}', '{k}怎么选？一张图看懂', '干货！{k}全攻略💡',
      '小白也能懂的{k}科普', '{t}，建议先码住📌', '{k}的{n}个真相', '搞懂{k}，少花冤枉钱💰',
      '{k}入门指南🔍', '内行人才知道的{k}', '{p}请收下这份{k}清单',
    ],
    zhongcao: [
      '被问爆了！{t}💖', '{p}冲！{k}太香了', '后悔没早点知道{k}😭', '挖到宝了！{t}✨',
      '{k}太能打｜真的爱了', '谁懂啊！{k}也太好用了', '{t}，按头安利🔥', '私藏分享｜{k}回购{n}次',
      '{p}快冲！{k}绝绝子', '自从有了{k}，幸福感翻倍', '{k}｜一用就回不去了', '无限回购的{k}🛒',
      '颜值实力都在线的{k}', '{t}｜我的心头好💕',
    ],
    bikeng: [
      '⚠️{t}千万别踩坑', '{k}避坑指南｜血泪教训', '别再乱买了！{k}避雷⚡', '{t}，这{n}个坑别踩',
      '{p}注意！{k}不要这样选', '花钱买的教训：{k}', '{k}踩坑实录😤', '劝退还是入？{k}说实话',
      '买{k}前一定要看❗', '{n}个{k}误区，你中了几个', '商家不会告诉你的{k}', '{k}别盲目跟风！',
      '{t}｜避雷清单🚫',
    ],
    tiyan: [
      '真实体验｜{t}', '用了{n}个月，说说{k}', '说点大实话：{k}值不值', '{k}亲测｜优缺点都说',
      '不吹不黑｜{t}', '{p}视角：{k}真实感受', '{k}使用{n}个月后的感受', '自费分享｜{t}',
      '{t}，我的真实答案🙋', '实测{k}｜结果有点意外', '{k}长期使用报告📝', '以过来人身份聊聊{k}',
    ],
  };

  const OPENERS = {
    ganhuo: [
      '最近后台好多{p}来问我{t}，今天干脆一次性整理清楚，建议先收藏再看📌',
      '关于{t}，网上说法五花八门，很多人越看越懵😵 今天用大白话帮大家把重点理一理。',
      '作为踩过不少坑的过来人，{t}这件事真的有讲究！整理了一份{p}也能秒懂的攻略👇',
      '{t}其实没那么复杂，抓住几个关键点就够了。下面是我反复对比后总结的干货✍️',
    ],
    zhongcao: [
      '姐妹们！今天必须给你们安利我的心头好💖 关于{t}，我真的是越用越喜欢！',
      '最近被朋友追着问链接的宝藏来了✨ {t}，{p}真的可以冲！',
      '本来没抱太大期待，结果一用就爱上了😍 来跟大家唠唠{t}～',
      '挖到宝了挖到宝了！{t}这件事，我要按头安利给每一个{p}🔥',
    ],
    bikeng: [
      '⚠️先说结论：{t}，选错了真的很闹心！把我和身边朋友踩过的坑都整理出来了。',
      '说出来你可能不信，我在{t}上前前后后多花了不少冤枉钱💸 {p}一定要看完再决定！',
      '最近看到好多{p}在问{t}，忍不住出来提醒一下，这几个坑真的别再踩了🚫',
      '血泪教训分享😭 {t}，看似简单其实门道很多，避开下面这些能省不少钱和心。',
    ],
    tiyan: [
      '不是广，纯自费分享🙋 {t}，我用了一段时间，今天说说真实感受。',
      '先交代一下背景：我是{p}，之前也纠结过很久{t}，现在有了自己的答案。',
      '这篇不吹不黑，就把我关于{t}的真实体验摊开讲，优点缺点都有👇',
      '很多人问我{t}到底怎么样，干脆写一篇长期体验，给还在犹豫的{p}参考～',
    ],
  };

  const POINTS = {
    ganhuo: [
      '先搞清楚「{k}」到底是什么：它决定的是使用体验的下限。很多人只盯着价格，其实先明确自己的需求和使用场景，再去看{k}，会少走很多弯路。',
      '「{k}」怎么判断好坏？别只听商家宣传，看三点就够：参数是不是真实可查、有没有真实买家反馈、售后能不能兜底。这三点都过关，基本不会差。',
      '关于「{k}」，常见的误区是“越贵越好”。其实适合自己的才是真的好，{p}按预算和频率来选，性价比反而更高。',
      '「{k}」和「{k2}」要一起看！单独看哪一个都容易片面，两个结合起来考虑，才能选到真正合适的。',
      '记住一个小口诀：先看「{k}」，再看细节，最后看颜值。顺序别反，很多人就是被外观带偏了😂',
      '「{k}」的使用和保养也很关键。买回来不是终点，正确使用能让寿命和效果都翻倍，具体方法可以看说明书或者问客服要。',
      '预算有限的话，「{k}」上别省，其他地方可以适当妥协。把钱花在刀刃上，体验提升很明显。',
      '如果你是{p}，建议优先关注「{k}」，这一点对新手很友好，能大大降低上手难度。',
    ],
    zhongcao: [
      '真正打动我的是「{k}」！第一次体验的时候真的惊到了，跟之前的完全不是一个level✨',
      '「{k}」这点必须夸！细节处理得很用心，看得出来是认真做产品的，用起来特别安心💕',
      '还有「{k}」，日常用下来非常省心，几乎没什么需要操心的地方，懒人福音了属于是😆',
      '颜值方面也很在线，搭配「{k}」，拍照随手一拍都好看📸 身边朋友看到都来问。',
      '性价比也很能打！同样的预算，「{k}」这块的体验明显更好，感觉每一分钱都花在了点子上💰',
      '我身边已经安利了好几个{p}，大家的反馈都是“早该入了”，尤其是「{k}」，好评率超高🙌',
      '用了之后很大的感受：生活幸福感真的提升了！「{k}」带来的改变是实实在在的。',
      '「{k}」+「{k2}」的组合简直绝配，强烈建议一起安排上，体验直接拉满🔥',
    ],
    bikeng: [
      '坑一：只看价格不看「{k}」。便宜的往往在这上面偷工减料，短期看省了钱，后面要花更多去补救。',
      '坑二：盲目跟风网红款。别人说好的不一定适合你，尤其是「{k}」这种因人而异的点，一定要结合自身情况判断。',
      '坑三：忽略「{k}」的细节。很多问题都是用了一段时间才暴露，下单前多问一句、多看几条差评，能避开大部分雷⚡',
      '坑四：被话术带节奏。“马上涨价”“只剩几件”听听就好，冷静下来对比一下「{k}」，你会发现没那么急。',
      '坑五：没算清总成本。除了买的钱，「{k}」相关的后续维护、配件、售后也要考虑进去，别被低价引流款坑了。',
      '❗特别提醒{p}：「{k}」一定要亲自确认，不要只看图片，有条件尽量实地看或者试用。',
      '「{k}」和「{k2}」很多人分不清，商家也常常混着说，买之前一定问清楚，避免收到货才发现不对。',
      '售后也是大坑！问清楚「{k}」出问题怎么处理、保修多久，建议留好聊天记录和凭证📝',
    ],
    tiyan: [
      '先说优点：「{k}」确实做得不错，日常使用下来很稳定，没出现过让我闹心的情况👍',
      '再说缺点：「{k}」方面还有提升空间，刚开始需要适应一段时间，介意的朋友要考虑一下。',
      '使用感受上，「{k}」比我预期的要好，尤其是用久了之后，越来越能体会到它的好。',
      '关于「{k}」，身边也有朋友有不同看法，我觉得主要看个人需求，没有标准答案。',
      '如果让我重新选，我依然会选，但会在「{k}」上多做点功课，这样能少一些纠结。',
      '作为{p}，我很在意的就是「{k}」，这一点它基本满足了我的期待，给个8分吧🙋',
      '一段时间用下来，「{k}」和「{k2}」是我觉得很值的两个点，其他属于锦上添花。',
      '小建议：买之前先想清楚自己更看重什么，比如「{k}」，抓大放小，不容易后悔。',
    ],
  };

  const SUMMARIES = {
    ganhuo: [
      '📝总结一下：先明确需求，再抓「{k}」等关键点，最后结合预算做决定，就不会选错啦！',
      '以上就是关于{t}的全部干货，看完的姐妹应该心里有数了吧～',
      '总之一句话：适合自己才重要。希望这篇能帮到正在纠结的{p}！',
    ],
    zhongcao: [
      '总之真心推荐！{p}可以放心冲，入了不亏💖',
      '这篇纯纯真心分享，希望大家都能找到自己的心头好✨',
      '用过的都说好，没用过的赶紧试试，你会回来感谢我的😉',
    ],
    bikeng: [
      '🚫总结：避开以上这些坑，基本就稳了。转给身边需要的朋友吧！',
      '花钱买的教训分享给大家，希望{p}都能少走弯路、少花冤枉钱💰',
      '记住：冷静、对比、问清楚，这三步做到了，就很难踩坑了。',
    ],
    tiyan: [
      '总的来说，我的体验是满意的，但每个人情况不同，仅供参考🙋',
      '以上都是个人真实感受，不吹不黑，希望能给犹豫中的{p}一点参考。',
      '如果你也在纠结{t}，希望我的经历能帮你做决定～',
    ],
  };

  const CTAS = {
    ganhuo: [
      '你们还有哪些关于{k}的问题？评论区告诉我，下期继续整理👇',
      '觉得有用记得点赞收藏⭐ 有问题直接评论区问我，看到都会回！',
      '还想看哪方面的干货？评论区留言，呼声高的下篇安排📌',
    ],
    zhongcao: [
      '你们最近有什么心头好？评论区一起交流呀💬',
      '想要同款的姐妹评论区扣1，我看看大家需不需要详细测评～',
      '有没有一样喜欢{k}的姐妹？评论区举个手🙋‍♀️',
    ],
    bikeng: [
      '你还踩过哪些坑？评论区说出来，帮更多人避雷⚡',
      '觉得有用就收藏起来，买之前翻出来对照一下📌 也欢迎补充！',
      '身边有正在纠结的朋友，快转给TA看看👇',
    ],
    tiyan: [
      '你们用过吗？感受怎么样？评论区聊聊～',
      '有什么想问的直接评论区问我，知无不言🙋',
      '如果你也有类似经历，欢迎评论区分享你的看法💬',
    ],
  };

  const GENERIC_TAGS = {
    ganhuo: ['干货分享', '涨知识', '新手攻略', '实用技巧', '建议收藏', '科普'],
    zhongcao: ['好物分享', '种草', '宝藏好物', '真心推荐', '提升幸福感', '回购清单'],
    bikeng: ['避坑指南', '避雷', '踩坑经验', '消费避坑', '血泪教训', '理性消费'],
    tiyan: ['真实测评', '使用感受', '亲测分享', '自费分享', '不吹不黑', '经验分享'],
  };

  const EMOJI_NUMS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣'];

  // ---------- 工具函数 ----------
  const len = (s) => Array.from(s).length;
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  function fill(tpl, ctx) {
    return tpl.replace(/\{(t|p|k2|k|n|s|c|term)\}/g, (m, key) => (ctx[key] !== undefined && ctx[key] !== '' ? String(ctx[key]) : m === '{k}' || m === '{k2}' ? ctx.t : ''));
  }
  function cleanTag(s) {
    return String(s).replace(/[#\s，,。.!！?？、|｜]/g, '').slice(0, 20);
  }

  function makeTitles(tone, ctx, keywords) {
    const out = [];
    const seen = new Set();
    const formulas = shuffle(TITLE_FORMULAS[tone]);
    for (const f of formulas) {
      if (out.length >= 3) break;
      const k = keywords.length ? pick(keywords) : ctx.t;
      const title = fill(f, { ...ctx, k, n: ctx.n || pick([3, 5, 6, 7, 8, 10]) });
      if (len(title) <= 20 && !seen.has(title)) { seen.add(title); out.push(title); }
    }
    // 主题太长时兜底：截短主题再套简单公式
    const shortT = Array.from(ctx.t).slice(0, 12).join('');
    const fallbacks = [`${shortT}｜干货📌`, `${shortT}真实分享✨`, `聊聊${shortT}🙋`, `${shortT}必看❗`];
    for (const f of fallbacks) {
      if (out.length >= 3) break;
      if (!seen.has(f)) { seen.add(f); out.push(Array.from(f).slice(0, 20).join('')); }
    }
    return out;
  }

  function makeBody(tone, ctx, keywords, ins = {}) {
    const kws = keywords.length ? shuffle(keywords) : [ctx.t];
    const points = shuffle(POINTS[tone]);
    const opener = fill(ins.opener || pick(OPENERS[tone]), ctx);
    const summary = ins.summary || fill(pick(SUMMARIES[tone]), { ...ctx, k: kws[0] });

    const paras = [];
    let i = 0;
    const build = () => [opener, ins.intro, ...paras, ins.casePara, summary].filter(Boolean).join('\n\n');
    // 先放 3 段，长度不足 300 继续加，最多 6 段
    while (i < points.length && (paras.length < (ins.casePara ? 2 : 3) || len(build()) < 320) && paras.length < 6) {
      const k = kws[i % kws.length];
      const k2 = kws.length > 1 ? kws[(i + 1) % kws.length] : ctx.t;
      paras.push(`${EMOJI_NUMS[paras.length]} ${fill(points[i], { ...ctx, k, k2 })}`);
      i++;
    }
    // 超过 600 字就去掉末尾的段落（至少保留 2 段）
    while (len(build()) > 600 && paras.length > 2) paras.pop();
    // 重新编号
    for (let j = 0; j < paras.length; j++) paras[j] = paras[j].replace(/^\S+\s/, `${EMOJI_NUMS[j]} `);
    return { text: build(), count: paras.length };
  }

  function makeTags(tone, ctx, keywords) {
    const tags = [];
    const add = (s) => {
      const c = cleanTag(s);
      if (c && !tags.includes(c)) tags.push(c);
    };
    add(ctx.t);
    keywords.forEach(add);
    if (ctx.rawP) add(ctx.rawP);
    shuffle(GENERIC_TAGS[tone]).forEach((t) => { if (tags.length < 8) add(t); });
    return tags.slice(0, 10).map((t) => '#' + t);
  }

  // ======================= 通用（原有模板） =======================
  const GENERAL_COVER_MAIN = ['{k}怎么选', '{k}避坑指南', '关于{k}', '{k}全攻略', '{k}真实体验', '{k}必看'];
  const GENERAL_COVER_SUB = {
    ganhuo: ['{n}个要点一次讲清', '新手也能看懂', '建议先收藏'],
    zhongcao: ['用了就回不去', '真心推荐不踩雷', '值得入的理由'],
    bikeng: ['{n}个坑千万别踩', '花钱买来的教训', '看完再下单'],
    tiyan: ['真实体验不吹不黑', '用了几个月的感受', '优缺点都说'],
  };
  const GENERAL_SHOTS = [
    '主体正面清晰照（靠窗自然光，干净背景）', '真实使用场景照（真人上手，可不露脸）', '细节特写（材质、做工、纹理）',
    '使用前后对比图（同角度）', '多款对比平铺图', '手写笔记 / 清单图（适合干货篇）', '包装或配件全家福',
  ];

  function generateGeneral(input) {
    const tone = TITLE_FORMULAS[input.tone] ? input.tone : 'ganhuo';
    const ctx = {
      t: input.topic.trim(),
      p: (input.audience || '').trim() || '大家',
      rawP: (input.audience || '').trim(),
      k: '', k2: '', n: 3,
    };
    const keywords = (input.keywords || []).map((k) => k.trim()).filter(Boolean);
    const shortT = Array.from(ctx.t).slice(0, 8).join('');
    const ins = libInserts(input, tone, Array.from(ctx.t).slice(0, 8).join(''));
    const body = makeBody(tone, ctx, keywords, ins);
    ctx.n = body.count; // 标题里的“N 个”与正文要点数一致
    const covers = makeCovers(GENERAL_COVER_MAIN, GENERAL_COVER_SUB[tone], () => ({ ...ctx, k: keywords.length && Math.random() < 0.4 ? pick(keywords) : shortT }));
    const kwText = keywords.length ? keywords.join('、') : '';
    return {
      titles: withCaseTitle(makeTitles(tone, ctx, keywords), ins),
      body: body.text,
      cta: withEnding(fill(pick(CTAS[tone]), { ...ctx, k: keywords[0] || ctx.t }), ins),
      tags: withCityTag(makeTags(tone, ctx, keywords), ins),
      covers,
      shots: shuffle(GENERAL_SHOTS).slice(0, 5),
      imagePrompts: [
        {
          zh: `${ctx.t}主题的生活方式照片${kwText ? '，突出' + kwText : ''}，干净明亮的居家场景` + PROMPT_SUFFIX().zh,
          en: `lifestyle photo for a social media post about "${ctx.t}"${kwText ? ' (' + kwText + ')' : ''}, clean bright home setting, aesthetic styling` + PROMPT_SUFFIX().en,
        },
        {
          zh: `${ctx.t}相关物品的俯拍平铺构图，浅色桌面，留白，简约高级` + PROMPT_SUFFIX().zh,
          en: `flat lay of items related to "${ctx.t}", light tabletop, negative space, minimal premium look` + PROMPT_SUFFIX().en,
        },
      ],
    };
  }

  // ======================= 行业模板 =======================
  const IND = () => (window.XHSIndustries || {}).INDUSTRIES || {};
  const PROMPT_SUFFIX = () => (window.XHSIndustries || {}).PROMPT_SUFFIX || { zh: '', en: '' };
  const CITIES = () => (window.XHSIndustries || {}).LA_CITIES || ['洛杉矶'];

  /** 从主公式和副公式组合 2-3 组封面大字：主标题 ≤10 字、副标题 ≤14 字 */
  function makeCovers(mainF, subF, ctxFn) {
    const out = [];
    const seen = new Set();
    const mains = shuffle(mainF);
    const subs = shuffle(subF);
    for (let i = 0; i < mains.length && out.length < 3; i++) {
      const ctx = ctxFn();
      const main = fill(mains[i], ctx);
      const sub = fill(subs[i % subs.length], ctx);
      if (len(main) <= 10 && len(sub) <= 14 && !seen.has(main)) { seen.add(main); out.push({ main, sub }); }
    }
    if (out.length < 2) out.push({ main: Array.from(ctxFn().t).slice(0, 10).join(''), sub: '一篇讲清楚' });
    return out;
  }

  function industryTitles(ind, sub, tone, ctxFn) {
    const formulas = shuffle([...(sub.titles || []), ...(ind.titles[tone] || [])]);
    const out = [];
    const seen = new Set();
    for (const f of formulas) {
      if (out.length >= 3) break;
      const title = fill(f, ctxFn());
      if (len(title) <= 20 && !seen.has(title)) { seen.add(title); out.push(title); }
    }
    return out;
  }

  /** 按语气挑段落：干货=知识点，种草=亮点+知识，避坑=坑点，体验=亮点+坑点+知识 */
  function paragraphPool(ind, sub, tone) {
    const c = ind.common || {};
    const S = (a) => shuffle(a || []);
    let main;
    switch (tone) {
      case 'zhongcao': main = [...S(sub.highlights).slice(0, 2), ...S(sub.facts), ...S(c.highlights)]; break;
      case 'bikeng': main = [...S(sub.pitfalls), ...S(c.pitfalls), ...S(sub.facts).slice(0, 1)]; break;
      case 'tiyan': main = [...S(sub.highlights).slice(0, 1), ...S(sub.pitfalls).slice(0, 1), ...S(sub.facts), ...S(c.facts).slice(0, 1)]; break;
      default: main = [...S(sub.facts), ...S(c.facts)];
    }
    // 素材不够长时，用本细分的其他段落补足
    const rest = [...S(sub.facts), ...S(sub.pitfalls), ...S(sub.highlights), ...S(c.facts)].filter((p) => !main.includes(p));
    return [...main, ...rest];
  }

  function industryBody(ind, sub, tone, ctx, userKws, ins = {}) {
    const openers = (sub.openers && sub.openers[tone]) || ind.openers[tone];
    const opener = fill(ins.opener || pick(openers), ctx);
    const summary = ins.summary || fill(pick(ind.summaries[tone]), ctx);
    const kwLine = userKws.length ? `🔑 本篇关键词：${userKws.join(' / ')}，咨询或下单时可以直接拿这些词去问。` : '';
    const pool = paragraphPool(ind, sub, tone);
    const paras = [];
    const build = () => [opener, ins.intro, ...paras.map((p, i) => `${EMOJI_NUMS[i]} ${p}`), kwLine, ins.casePara, summary].filter(Boolean).join('\n\n');
    for (const raw of pool) {
      const p = fill(raw, ctx);
      if (paras.includes(p)) continue;
      paras.push(p);
      if (paras.length >= 2 && len(build()) >= 340) break;
      if (paras.length >= 5) break;
    }
    while (len(build()) > 600 && paras.length > 2) paras.pop();
    return { text: build(), count: paras.length };
  }

  function generateIndustry(input, ind) {
    const tone = ind.titles[input.tone] ? input.tone : 'ganhuo';
    // 细分不限时，如果带入的案例属于本行业某个细分，就按案例的细分来写
    const subId = input.sub || (input.case && input.case.industry === input.industry ? input.case.sub : '');
    const sub = (subId && ind.subs.find((s) => s.id === subId)) || pick(ind.subs);
    const userKws = (input.keywords || []).map((k) => k.trim()).filter(Boolean);
    const shortTerms = sub.terms.filter((t) => len(t) <= 6);
    const city = (input.case && input.case.city) || pick(CITIES());
    const base = {
      t: input.topic.trim(),
      p: (input.audience || '').trim() || ind.defaultAudience || '大家',
      s: sub.short || sub.name,
      c: city,
    };
    const ctxFn = () => {
      const term = pick(shortTerms.length ? shortTerms : sub.terms);
      const k = userKws.length && Math.random() < 0.5 ? pick(userKws) : term;
      return { ...base, term, k, k2: pick(sub.terms), n: base.n || 3 };
    };
    const ctx = ctxFn();
    const ins = libInserts(input, tone, base.s);
    const body = industryBody(ind, sub, tone, ctx, userKws, ins);
    base.n = body.count; // 标题/封面里的“N 个”与正文要点数一致

    let titles = industryTitles(ind, sub, tone, ctxFn);
    if (titles.length < 3) {
      const extra = makeTitles(tone, base, userKws.length ? userKws : shortTerms).filter((t) => !titles.includes(t));
      titles = titles.concat(extra).slice(0, 3);
    }
    titles = withCaseTitle(titles, ins);

    const tags = [];
    const addTag = (s) => { const c = cleanTag(s); if (c && !tags.includes(c)) tags.push(c); };
    if (len(base.t) <= 12) addTag(base.t);
    userKws.forEach(addTag);
    shuffle(sub.tags || []).slice(0, 3).forEach(addTag);
    shuffle(ind.tags || []).slice(0, 3).forEach(addTag);
    shuffle(GENERIC_TAGS[tone]).forEach((t) => { if (tags.length < 9) addTag(t); });

    const sfx = PROMPT_SUFFIX();
    return {
      titles,
      body: body.text,
      cta: withEnding(fill(pick(ind.ctas), ctx), ins),
      tags: withCityTag(tags.slice(0, 10).map((t) => '#' + t), ins),
      covers: makeCovers(sub.coverMain || ind.coverMain, sub.coverSub || ind.coverSub, ctxFn),
      shots: shuffle(sub.shots).slice(0, Math.min(sub.shots.length, 5)),
      imagePrompts: (sub.scenes || []).map((sc) => ({ zh: sc.zh + sfx.zh, en: sc.en + sfx.en })),
      sub: sub.name,
    };
  }

  // ======================= 资料库：档案 + 真实案例 =======================
  const PRO_OPENERS = {
    ganhuo: '做这一行这些年，被问得多的就是{t}。今天把要点一次讲清楚，建议先收藏📌',
    zhongcao: '最近刚完成的一个案例效果特别好，关于{t}，忍不住来分享💖',
    bikeng: '做这一行这些年，见过太多人在{t}上踩坑，今天把常见的坑一次说清楚🚫',
    tiyan: '做这一行这些年，经手过不少真实案例。关于{t}，今天挑一个说说我的真实感受🙋',
  };
  const trimEnd = (v) => String(v || '').trim().replace(/[。.!！;；，,]+$/, '');
  /** 根据档案和案例生成要插入正文的段落 */
  function libInserts(input, tone, shortName) {
    const pf = input.profile;
    const cs = input.case;
    const ins = {};
    if (pf && (pf.identity || pf.area || pf.years || pf.features)) {
      const years = trimEnd(pf.years).replace(/年$/, '');
      let t = `🙋 先介绍一下：我是${trimEnd(pf.identity) || '一名从业者'}`;
      if (years) t += `，在${trimEnd(pf.area) || '洛杉矶'}做了 ${years} 年`;
      else if (pf.area) t += `，主要服务${trimEnd(pf.area)}`;
      if (pf.features) t += `，${trimEnd(pf.features)}`;
      ins.intro = t + '。';
    }
    if (pf && pf.ending) ins.ending = String(pf.ending).trim();
    if (ins.intro) {
      // 带入了从业者档案：开头和体验类总结换成“从业者”口吻，避免和“自家装修”的口吻冲突
      ins.opener = PRO_OPENERS[tone] || PRO_OPENERS.ganhuo;
      if (tone === 'tiyan') ins.summary = '以上是我们的真实案例和经验，每家情况不同，欢迎带着你的问题来评论区交流🙋';
    }
    if (cs && (cs.problem || cs.solution || cs.result)) {
      const label = { bikeng: '真实案例（踩坑复盘）', ganhuo: '举个真实案例', zhongcao: '真实案例分享', tiyan: '我们的真实案例' }[tone] || '真实案例';
      let t = `📍 ${label}：`;
      const where = [trimEnd(cs.time), cs.city ? '在' + trimEnd(cs.city) : ''].filter(Boolean).join('，');
      if (where) t += where + '，';
      if (cs.client) t += `客户是${trimEnd(cs.client)}。`;
      if (cs.problem) t += `遇到的问题：${trimEnd(cs.problem)}。`;
      if (cs.solution) t += `我们的做法：${trimEnd(cs.solution)}。`;
      if (cs.cost) t += `费用：${trimEnd(cs.cost)}。`;
      if (cs.result) t += `结果：${trimEnd(cs.result)}。`;
      if (cs.note) t += trimEnd(cs.note) + '。';
      ins.casePara = t.replace(/，。/g, '。');
      const city = trimEnd(cs.city);
      ins.caseTitles = [
        city && `${city}${shortName}真实案例📍`,
        city && `${shortName}案例｜${city}`,
        cs.client && `真实案例：${trimEnd(cs.client)}`,
        `${shortName}真实案例复盘📝`,
      ].filter((x) => x && len(x) <= 20);
      if (city) ins.cityTag = city;
    }
    return ins;
  }
  function withCaseTitle(titles, ins) {
    if (!ins.caseTitles || !ins.caseTitles.length) return titles;
    const t = ins.caseTitles[0];
    return titles.includes(t) ? titles : [titles[0], titles[1], t].filter(Boolean);
  }
  const withEnding = (cta, ins) => (ins.ending ? `${cta}\n${ins.ending}` : cta);
  function withCityTag(tags, ins) {
    if (!ins.cityTag) return tags;
    const t = '#' + cleanTag(ins.cityTag);
    return tags.includes(t) ? tags : [...tags.slice(0, 9), t];
  }

  /**
   * 生成一篇文案
   * @param {{topic:string, audience:string, keywords:string[], tone:string, industry?:string, sub?:string}} input
   */
  function generateOne(input) {
    const ind = IND()[input.industry];
    if (ind && ind.subs && ind.subs.length) return generateIndustry(input, ind);
    return generateGeneral(input);
  }

  /**
   * 批量生成，尽量让每篇的标题不重复
   * @param lib 可选 { profile, cases: [] }：每篇带入同一档案，案例按顺序轮流带入
   */
  function generateBatch(input, count, lib) {
    const posts = [];
    const usedTitles = new Set();
    const cases = (lib && lib.cases) || [];
    for (let i = 0; i < count; i++) {
      const one = { ...input, profile: lib && lib.profile, case: cases.length ? cases[i % cases.length] : null };
      let post = generateOne(one);
      for (let tries = 0; tries < 6 && post.titles.some((t) => usedTitles.has(t)); tries++) {
        post = generateOne(one);
      }
      post.titles.forEach((t) => usedTitles.add(t));
      if (one.case) { post.caseId = one.case.id; post.caseLabel = caseLabel(one.case); }
      posts.push(post);
    }
    return posts;
  }
  function caseLabel(c) {
    return [trimEnd(c.time), trimEnd(c.city), trimEnd(c.client) || trimEnd(c.problem).slice(0, 12)].filter(Boolean).join(' · ');
  }

  /** 旧历史记录没有封面大字时，用标题兜底 */
  function coverFallback(post) {
    const t = (post.titles && post.titles[0]) || '小红书笔记';
    const clean = t.replace(/[｜|].*$/, '');
    return [{ main: Array.from(clean).slice(0, 10).join(''), sub: Array.from((post.titles && post.titles[1]) || '').slice(0, 14).join('') }];
  }

  // ======================= 素材变笔记 =======================
  const RE_TIME = /(\d{4}\s*年\s*\d{1,2}\s*月(?:\s*\d{1,2}\s*[日号])?|\d{1,2}\s*月\s*\d{1,2}\s*[日号]|\d{1,2}\s*月(?:初|中|底)?|(?:上|这)周[一二三四五六日天末]?|周末|昨天|今天|前几天|上个月|这个月)/;
  const RE_COST = /(\$\s*[\d,.]+[kK]?|[\d,.]+\s*(?:美金|美元|刀|块)|费用|总价|报价|预算|花了)/;
  const RE_RESULT = /(满意|顺利|完工|装完|搞定|效果|结果|好评|安静|解决|做完|完成|开心|放心|没问题)/;
  const RE_PROBLEM = /(问题|坏|脱轨|漏|裂|吵|噪音|卡住|卡顿|老化|不平|渗|生锈|变形|太旧|太吵|太热|太冷|晒|下垂|松|困扰|麻烦|担心|有点慢|太慢|不顺)/;
  const PLACES = ['卡特琳娜岛', '拉霍亚', '海峡群岛', '拉古纳海滩', '拉古纳', '马里布', '圣地亚哥', '长滩', '圣莫尼卡', '韩国城', 'DTLA', '圣佩德罗'];
  // 不同行业的“素材变笔记”口吻：装修类写“项目/做法”，潜水写“潜水日记”，美食写“探店”
  const FRAMES = {
    reno: { noun: '项目', proIntro: '做的一个', ctx: '📍 现场情况', how: '🔧 具体是这么做的',
      titles: ['{city}{s}改造实录📝', '{s}现场记录｜{city}', '{s}真实案例｜全过程📝', '{problem}，这样解决✅', '{s}改造前后对比', '{s}施工全记录📝'],
      covers: ['{s}改造实录', '{s}现场记录', '{city}真实案例', '{s}真实案例'] },
    scuba: { noun: '潜水', proIntro: '带的一次', ctx: '📍 基本情况', how: '🤿 这次的过程',
      titles: ['{city}潜水日记🤿', '这次潜水的真实记录', '{s}实潜记录📝', '潜完这一趟的真实感受', '{city}实潜｜真实记录'],
      covers: ['潜水日记', '{city}实潜', '这次潜水', '真实潜水记录'] },
    food: { noun: '探店', proIntro: '的一次', ctx: '📍 基本情况', how: '🍽 这次吃了什么',
      titles: ['{city}探店记录📝', '{city}这家店真实体验', '自费探店｜真实记录', '吃完这家的真实感受', '探店日记｜{city}'],
      covers: ['探店记录', '{city}探店', '自费探店', '真实探店'] },
    general: { noun: '经历', proIntro: '的一次', ctx: '📍 基本情况', how: '📝 过程记录',
      titles: ['{s}真实体验📝', '关于{s}的真实感受', '{s}使用记录', '{s}真实记录'],
      covers: ['{s}真实体验', '{s}记录', '真实感受'] },
  };
  const frameOf = (industry) => (industry === 'doors' || industry === 'build' ? FRAMES.reno : FRAMES[industry] || FRAMES.general);
  /** 填充 {city}{s}{problem}，有占位符但值为空的公式直接丢弃 */
  function fillFrame(list, vars) {
    return list.map((f) => {
      let ok = true;
      const out = f.replace(/\{(city|s|problem)\}/g, (m, k) => { if (!vars[k]) ok = false; return vars[k] || ''; });
      return ok ? out : '';
    }).filter((x) => x && len(x) <= 20);
  }

  // 去掉行首的列表符号（“- ”“1.”“2、”），但保留“11月2日”这类日期
  const lines = (t) => String(t || '').split(/\n+/).map((x) => x.trim().replace(/^(?:[-*•·]\s*|\d{1,2}[.、)）]\s+|\d{1,2}[、)）])/, '').trim()).filter(Boolean);
  const stripEnd = (x) => x.replace(/[。.!！;；，,]+$/, '');
  const RE_ACTION = /^(换|装|拆|加|做|修|调|改|用|安装|更换|重新|先|再|然后|最后|上门|测量|量)/;

  /** 从随手记的要点里粗略提取案例字段（时间、城市、背景、问题、做法、费用、结果） */
  function parseMaterial(points, photos, industry, sub) {
    const L = lines(points);
    const all = L.join('，');
    const cities = [...CITIES().filter((c) => c !== '626'), ...PLACES];
    const city = cities.find((c) => all.includes(c)) || '';
    const tm = all.match(RE_TIME);
    const out = { industry: industry || 'general', sub: sub || '', time: tm ? tm[1].replace(/\s+/g, '') : '', city, client: '', context: [], problem: [], solution: [], cost: '', result: [], note: '' };
    L.forEach((l) => {
      if (RE_COST.test(l) && /[\d$]/.test(l)) { out.cost = out.cost ? out.cost + '；' + stripEnd(l) : stripEnd(l); return; }
      if (/(客户|业主|房主|学员|一家|夫妻|阿姨|叔叔|老人|留学生)/.test(l) && !out.client) { out.client = stripEnd(l); return; }
      if (RE_RESULT.test(l) && !RE_ACTION.test(l)) { out.result.push(stripEnd(l)); return; }
      if (RE_PROBLEM.test(l) && !RE_ACTION.test(l)) { out.problem.push(stripEnd(l)); return; }
      // 只有时间、城市、房子情况的行，算作背景
      const rest = l.replace(RE_TIME, '').replace(city, '').trim();
      if ((tm && l.includes(tm[1])) || (city && l.includes(city)) || /(老房|房子|年建|townhouse|公寓|独栋)/i.test(l)) {
        if (rest) out.context.push(stripEnd(rest));
        return;
      }
      out.solution.push(stripEnd(l));
    });
    const ph = lines(photos);
    if (ph.length) out.note = `有 ${ph.length} 张现场照片`;
    return {
      ...out,
      steps: out.solution.slice(),
      client: [out.context.join('，'), out.client].filter(Boolean).join('，'),
      problem: out.problem.join('，'),
      solution: out.solution.join('；'),
      result: out.result.join('，'),
    };
  }

  /**
   * 把现场要点 + 照片描述整理成一篇真实体验笔记（模板模式）
   * @param {{industry, sub, topic, points, photos, tone, profile}} o
   */
  function fromMaterial(o) {
    const ind = IND()[o.industry];
    const hasInd = ind && ind.subs && ind.subs.length;
    const sub = hasInd ? ((o.sub && ind.subs.find((x) => x.id === o.sub)) || ind.subs[0]) : null;
    const tone = o.tone || 'tiyan';
    const draft = parseMaterial(o.points, o.photos, o.industry, sub ? sub.id : '');
    const L = lines(o.points);
    const photos = lines(o.photos);
    const sName = sub ? (sub.short || sub.name) : (Array.from(String(o.topic || '这次的项目')).slice(0, 8).join(''));
    const topic = String(o.topic || '').trim() || (draft.city ? `${draft.city}${sName}现场记录` : `${sName}现场记录`);
    const ins = libInserts({ profile: o.profile }, tone, sName);

    const fr = frameOf(o.industry);
    const where = [draft.time, draft.city ? '在' + draft.city : ''].filter(Boolean).join('');
    const what = fr === FRAMES.reno ? `${sName}${fr.noun}` : fr.noun;
    const opener = `记录一下${where || '最近'}${ins.intro ? fr.proIntro : '的'}${what}，情况和过程都写下来了，给有类似需求的朋友参考🙋`;
    const parts = [opener];
    if (ins.intro) parts.push(ins.intro);
    if (draft.client || draft.problem) parts.push(`${fr.ctx}：${[draft.client, draft.problem].filter(Boolean).join('，')}。`);
    const steps = draft.steps.length ? draft.steps : L.filter((l) => !RE_RESULT.test(l));
    if (steps.length) parts.push(fr.how + '：\n' + steps.slice(0, 6).map((x, i) => `${EMOJI_NUMS[i]} ${x}`).join('\n'));
    const res = [draft.result, draft.cost ? '费用：' + draft.cost : ''].filter(Boolean).join('；');
    if (res) parts.push(`✅ 结果：${res}。`);
    if (photos.length) parts.push('📷 图片说明：' + photos.slice(0, 9).map((x, i) => `图${i + 1} ${stripEnd(x)}`).join('；') + '。');

    // 素材太少时，补 1-2 段本细分的专业知识，让笔记更有干货
    const summary = { bikeng: '🚫以上是这次的真实复盘，希望能帮你少踩坑。', ganhuo: '📝以上是这次的完整记录，建议收藏备用。', zhongcao: '整个过程下来真的很满意，推荐给有同样需求的朋友💖', tiyan: '以上都是这次的真实情况，每家情况不同，仅供参考🙋' }[tone];
    const build = (extra) => [...parts, ...extra, summary].join('\n\n');
    const extra = [];
    if (sub) {
      const pool = shuffle([...(sub.facts || []), ...(tone === 'bikeng' ? sub.pitfalls || [] : [])]);
      for (const f of pool) {
        if (len(build(extra)) >= 320 || extra.length >= 2) break;
        if (len(build([...extra, '💡 ' + f])) <= 640) extra.push('💡 补充一点：' + f);
      }
    }
    const body = build(extra);

    const ctx = { t: topic, p: '大家', s: sName, c: draft.city || pick(CITIES()), k: sName, k2: sName, term: sName, n: steps.length };
    const vars = { city: draft.city, s: sName, problem: draft.problem ? stripEnd(draft.problem.split('，')[0]).slice(0, 10) : '' };
    const titles = [...new Set(fillFrame(shuffle(fr.titles), vars))].slice(0, 3);
    while (titles.length < 3) titles.push(`${sName}真实记录${titles.length + 1}`);

    const tags = [];
    const addTag = (x) => { const c = cleanTag(x); if (c && !tags.includes(c)) tags.push(c); };
    if (o.topic && len(o.topic) <= 12) addTag(o.topic);
    if (sub) (sub.tags || []).slice(0, 3).forEach(addTag);
    if (hasInd) shuffle(ind.tags || []).slice(0, 3).forEach(addTag);
    if (draft.city) addTag(draft.city);
    ['真实案例', '现场记录', '经验分享'].forEach((x) => { if (tags.length < 8) addTag(x); });

    const sfx = PROMPT_SUFFIX();
    const shots = [...photos.map((x) => '（已拍）' + stripEnd(x)), ...(sub ? shuffle(sub.shots) : GENERAL_SHOTS).map((x) => '（建议补拍）' + x)].slice(0, Math.max(3, Math.min(6, photos.length + 2)));
    const ctaBase = hasInd ? fill(pick(ind.ctas), ctx) : '有类似情况的朋友，评论区聊聊～';
    return {
      titles,
      body,
      cta: withEnding(ctaBase, ins),
      tags: tags.slice(0, 10).map((x) => '#' + x),
      covers: makeCovers(fillFrame(fr.covers, vars), [draft.result ? stripEnd(draft.result).slice(0, 14) : '全过程记录', '真实案例分享', draft.city ? `${draft.city}现场实拍` : '现场实拍'], () => ctx),
      shots,
      imagePrompts: sub ? (sub.scenes || []).map((sc) => ({ zh: sc.zh + sfx.zh, en: sc.en + sfx.en })) : [],
      sub: sub ? sub.name : '',
      caseDraft: (({ steps, context, ...rest }) => rest)(draft),
      topic,
    };
  }

  window.XHSTemplates = { generateOne, generateBatch, coverFallback, caseLabel, libInserts, fromMaterial, parseMaterial, textLength: len };
})();
