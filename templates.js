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
      '被问爆了！{t}💖', '{p}闭眼入！{k}太香了', '后悔没早点知道{k}😭', '挖到宝了！{t}✨',
      '{k}天花板｜真的爱了', '谁懂啊！{k}也太好用了', '{t}，按头安利🔥', '私藏分享｜{k}回购{n}次',
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
      '最近后台好多{p}私信问我{t}，今天干脆一次性整理清楚，建议先收藏再看📌',
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
      '关于「{k}」，最常见的误区是“越贵越好”。其实适合自己的才是最好的，{p}按预算和频率来选，性价比反而更高。',
      '「{k}」和「{k2}」要一起看！单独看哪一个都容易片面，两个结合起来考虑，才能选到真正合适的。',
      '记住一个小口诀：先看「{k}」，再看细节，最后看颜值。顺序别反，很多人就是被外观带偏了😂',
      '「{k}」的使用和保养也很关键。买回来不是终点，正确使用能让寿命和效果都翻倍，具体方法可以看说明书或者问客服要。',
      '预算有限的话，「{k}」上别省，其他地方可以适当妥协。把钱花在刀刃上，体验提升最明显。',
      '如果你是{p}，建议优先关注「{k}」，这一点对新手最友好，能大大降低上手难度。',
    ],
    zhongcao: [
      '最打动我的就是「{k}」！第一次体验的时候真的惊到了，跟之前的完全不是一个level✨',
      '「{k}」这点必须夸！细节处理得很用心，看得出来是认真做产品的，用起来特别安心💕',
      '还有「{k}」，日常用下来非常省心，几乎没什么需要操心的地方，懒人福音了属于是😆',
      '颜值方面也很在线，搭配「{k}」，拍照随手一拍都好看📸 身边朋友看到都来问。',
      '性价比也很能打！同样的预算，「{k}」这块的体验明显更好，感觉每一分钱都花在了点子上💰',
      '我身边已经安利了好几个{p}，大家的反馈都是“早该入了”，尤其是「{k}」，好评率超高🙌',
      '用了之后最大的感受：生活幸福感真的提升了！「{k}」带来的改变是实实在在的。',
      '「{k}」+「{k2}」的组合简直绝配，强烈建议一起安排上，体验直接拉满🔥',
    ],
    bikeng: [
      '坑一：只看价格不看「{k}」。便宜的往往在这上面偷工减料，短期看省了钱，后面要花更多去补救。',
      '坑二：盲目跟风网红款。别人说好的不一定适合你，尤其是「{k}」这种因人而异的点，一定要结合自身情况判断。',
      '坑三：忽略「{k}」的细节。很多问题都是用了一段时间才暴露，下单前多问一句、多看几条差评，能避开大部分雷⚡',
      '坑四：被话术带节奏。“限时”“最后一件”听听就好，冷静下来对比一下「{k}」，你会发现没那么急。',
      '坑五：没算清总成本。除了买的钱，「{k}」相关的后续维护、配件、售后也要考虑进去，别被低价引流款坑了。',
      '❗特别提醒{p}：「{k}」一定要亲自确认，不要只看图片，有条件尽量实地看或者试用。',
      '「{k}」和「{k2}」很多人分不清，商家也常常混着说，买之前一定问清楚，避免收到货才发现不对。',
      '售后也是大坑！问清楚「{k}」出问题怎么处理、保修多久，最好留好聊天记录和凭证📝',
    ],
    tiyan: [
      '先说优点：「{k}」确实做得不错，日常使用下来很稳定，没出现过让我闹心的情况👍',
      '再说缺点：「{k}」方面还有提升空间，刚开始需要适应一段时间，介意的朋友要考虑一下。',
      '使用感受上，「{k}」比我预期的要好，尤其是用久了之后，越来越能体会到它的好。',
      '关于「{k}」，身边也有朋友有不同看法，我觉得主要看个人需求，没有绝对的好坏。',
      '如果让我重新选，我依然会选，但会在「{k}」上多做点功课，这样能少一些纠结。',
      '作为{p}，我最在意的就是「{k}」，这一点它基本满足了我的期待，给个8分吧🙋',
      '一段时间用下来，「{k}」和「{k2}」是我觉得最值的两个点，其他属于锦上添花。',
      '小建议：买之前先想清楚自己最看重什么，比如「{k}」，抓大放小，不容易后悔。',
    ],
  };

  const SUMMARIES = {
    ganhuo: [
      '📝总结一下：先明确需求，再抓「{k}」等关键点，最后结合预算做决定，就不会选错啦！',
      '以上就是关于{t}的全部干货，看完的姐妹应该心里有数了吧～',
      '总之一句话：适合自己最重要。希望这篇能帮到正在纠结的{p}！',
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
      '还想看哪方面的干货？评论区留言，呼声最高的下篇安排📌',
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
    zhongcao: ['好物分享', '种草', '宝藏好物', '真心推荐', '提升幸福感', '闭眼入'],
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
    return tpl
      .replace(/\{t\}/g, ctx.t)
      .replace(/\{p\}/g, ctx.p)
      .replace(/\{k2\}/g, ctx.k2)
      .replace(/\{k\}/g, ctx.k)
      .replace(/\{n\}/g, ctx.n);
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
      const title = fill(f, { ...ctx, k, n: pick([3, 5, 6, 7, 8, 10]) });
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

  function makeBody(tone, ctx, keywords) {
    const kws = keywords.length ? shuffle(keywords) : [ctx.t];
    const points = shuffle(POINTS[tone]);
    const opener = fill(pick(OPENERS[tone]), ctx);
    const summary = fill(pick(SUMMARIES[tone]), { ...ctx, k: kws[0] });

    const paras = [];
    let i = 0;
    const build = () => [opener, ...paras, summary].join('\n\n');
    // 先放 3 段，长度不足 300 继续加，最多 6 段
    while (i < points.length && (paras.length < 3 || len(build()) < 320) && paras.length < 6) {
      const k = kws[i % kws.length];
      const k2 = kws.length > 1 ? kws[(i + 1) % kws.length] : ctx.t;
      paras.push(`${EMOJI_NUMS[paras.length]} ${fill(points[i], { ...ctx, k, k2 })}`);
      i++;
    }
    // 超过 600 字就去掉末尾的段落（至少保留 2 段）
    while (len(build()) > 600 && paras.length > 2) paras.pop();
    // 重新编号
    for (let j = 0; j < paras.length; j++) paras[j] = paras[j].replace(/^\S+\s/, `${EMOJI_NUMS[j]} `);
    return build();
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

  /**
   * 生成一篇文案
   * @param {{topic:string, audience:string, keywords:string[], tone:string}} input
   */
  function generateOne(input) {
    const tone = TITLE_FORMULAS[input.tone] ? input.tone : 'ganhuo';
    const ctx = {
      t: input.topic.trim(),
      p: (input.audience || '').trim() || '大家',
      rawP: (input.audience || '').trim(),
      k: '', k2: '', n: 3,
    };
    const keywords = (input.keywords || []).map((k) => k.trim()).filter(Boolean);
    return {
      titles: makeTitles(tone, ctx, keywords),
      body: makeBody(tone, ctx, keywords),
      cta: fill(pick(CTAS[tone]), { ...ctx, k: keywords[0] || ctx.t }),
      tags: makeTags(tone, ctx, keywords),
    };
  }

  /** 批量生成，尽量让每篇的标题不重复 */
  function generateBatch(input, count) {
    const posts = [];
    const usedTitles = new Set();
    for (let i = 0; i < count; i++) {
      let post = generateOne(input);
      for (let tries = 0; tries < 5 && post.titles.some((t) => usedTitles.has(t)); tries++) {
        post = generateOne(input);
      }
      post.titles.forEach((t) => usedTitles.add(t));
      posts.push(post);
    }
    return posts;
  }

  window.XHSTemplates = { generateOne, generateBatch, textLength: len };
})();
