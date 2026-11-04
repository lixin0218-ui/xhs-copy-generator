/*
 * 小红书封面生成：纯浏览器 Canvas 绘制，3:4 竖版 1080×1440，不依赖任何外部服务。
 * 用户上传的照片只在本地内存中处理（URL.createObjectURL），不会上传。
 */
(function () {
  'use strict';

  const W = 1080;
  const H = 1440;
  const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC","Source Han Sans SC","WenQuanYi Zen Hei",sans-serif';

  const PALETTES = {
    red: { name: '小红书红', bg: ['#ff2442', '#ff6b7f'], text: '#ffffff', accent: '#ffe14d', accentText: '#e01e3a', card: '#ffffff', cardText: '#222222', deco: 'rgba(255,255,255,.13)', swatch: '#ff2442' },
    cream: { name: '奶油白', bg: ['#fff8ee', '#ffe8cf'], text: '#3b2a1a', accent: '#ff2442', accentText: '#ffffff', card: '#ffffff', cardText: '#3b2a1a', deco: 'rgba(255,36,66,.08)', swatch: '#ffe8cf' },
    dark: { name: '黑金', bg: ['#151515', '#2c2c2c'], text: '#ffffff', accent: '#f5c542', accentText: '#151515', card: '#1d1d1d', cardText: '#ffffff', deco: 'rgba(245,197,66,.12)', swatch: '#1d1d1d' },
    ocean: { name: '海洋蓝', bg: ['#0a5aa0', '#38c3d6'], text: '#ffffff', accent: '#ffe66d', accentText: '#0a4f8c', card: '#ffffff', cardText: '#0b3b66', deco: 'rgba(255,255,255,.14)', swatch: '#1b86c0' },
    mint: { name: '森系绿', bg: ['#edf7ef', '#cde8d3'], text: '#1f4d2b', accent: '#ff7a45', accentText: '#ffffff', card: '#ffffff', cardText: '#1f4d2b', deco: 'rgba(31,77,43,.08)', swatch: '#cde8d3' },
  };

  const LAYOUTS = {
    center: '居中大字',
    card: '底部卡片',
    magazine: '杂志风',
    top: '顶部标题',
    sticker: '贴纸风',
  };

  // ---------- 文字工具 ----------
  const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter('zh', { granularity: 'grapheme' }) : null;
  const graphemes = (s) => (seg ? Array.from(seg.segment(s), (x) => x.segment) : Array.from(s));
  const font = (size, weight = 900) => `${weight} ${size}px ${FONT}`;

  function wrap(ctx, text, maxW) {
    const lines = [];
    for (const para of String(text).split(/\n/)) {
      let line = '';
      for (const g of graphemes(para)) {
        if (line && ctx.measureText(line + g).width > maxW) { lines.push(line); line = g; } else line += g;
      }
      if (line) lines.push(line);
    }
    return lines;
  }

  /** 找到能在 maxLines 行内放下的最大字号；两行时尽量均分，避免最后一行只剩一两个字 */
  function fit(ctx, text, maxW, maxLines, maxSize, minSize, weight = 900) {
    text = String(text || '').trim();
    for (let size = maxSize; size >= minSize; size -= 4) {
      ctx.font = font(size, weight);
      let lines = wrap(ctx, text, maxW);
      if (lines.length <= maxLines) {
        if (lines.length >= 2 && !text.includes('\n')) {
          // 多行时按字数均分，避免最后一行只剩一两个字
          const g = graphemes(text);
          const per = Math.ceil(g.length / lines.length);
          const balanced = [];
          for (let i = 0; i < g.length; i += per) balanced.push(g.slice(i, i + per).join(''));
          if (balanced.length === lines.length && balanced.every((l) => ctx.measureText(l).width <= maxW)) lines = balanced;
        }
        return { lines, size };
      }
    }
    ctx.font = font(minSize, weight);
    return { lines: wrap(ctx, text, maxW).slice(0, maxLines), size: minSize };
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function pill(ctx, text, x, y, size, bg, fg, align = 'left', padX = 28, padY = 14) {
    ctx.font = font(size, 700);
    const tw = ctx.measureText(text).width;
    const w = tw + padX * 2;
    const h = size + padY * 2;
    const left = align === 'center' ? x - w / 2 : x;
    ctx.fillStyle = bg;
    roundRect(ctx, left, y, w, h, h / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(text, left + padX, y + h / 2 + 2);
    return { w, h };
  }

  /** 画多行大字；marker=true 时在每行下半部分画荧光笔高亮 */
  function drawLines(ctx, lines, size, x, y, { color, align = 'left', lineGap = 1.18, marker, shadow }) {
    ctx.font = font(size);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = align;
    const lh = size * lineGap;
    lines.forEach((line, i) => {
      const baseY = y + size + i * lh;
      if (marker) {
        const w = ctx.measureText(line).width;
        const left = align === 'center' ? x - w / 2 : x;
        ctx.save();
        ctx.fillStyle = marker;
        ctx.globalAlpha = 0.9;
        roundRect(ctx, left - 10, baseY - size * 0.36, w + 20, size * 0.42, 10);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 4; }
      ctx.fillStyle = color;
      ctx.fillText(line, x, baseY);
      ctx.restore();
    });
    return lines.length * lh;
  }

  // ---------- 背景 ----------
  function drawBackground(ctx, o, p) {
    if (o.photo) {
      const img = o.photo;
      const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight) * (o.zoom || 1);
      const dw = img.naturalWidth * scale;
      const dh = img.naturalHeight * scale;
      const px = o.posX === undefined ? 0.5 : o.posX;
      const py = o.posY === undefined ? 0.5 : o.posY;
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, W, H);
      ctx.drawImage(img, (W - dw) * px, (H - dh) * py, dw, dh);
      return;
    }
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, p.bg[0]);
    g.addColorStop(1, p.bg[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // 装饰：大圆 + 点阵
    ctx.fillStyle = p.deco;
    ctx.beginPath(); ctx.arc(W - 120, 180, 260, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(80, H - 120, 200, 0, Math.PI * 2); ctx.fill();
    for (let yy = 0; yy < 5; yy++) {
      for (let xx = 0; xx < 6; xx++) {
        ctx.beginPath(); ctx.arc(110 + xx * 34, 120 + yy * 34, 5, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  function overlay(ctx, from, to, a1, a2) {
    const g = ctx.createLinearGradient(0, from, 0, to);
    g.addColorStop(0, `rgba(0,0,0,${a1})`);
    g.addColorStop(1, `rgba(0,0,0,${a2})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- 排版 ----------
  const LAYOUT_FN = {
    center(ctx, o, p) {
      const hasPhoto = !!o.photo;
      if (hasPhoto) overlay(ctx, 0, H, 0.25, 0.55);
      const color = hasPhoto ? '#ffffff' : p.text;
      const { lines, size } = fit(ctx, o.main, W - 180, 3, 210, 96);
      const blockH = lines.length * size * 1.18;
      const subH = o.sub ? 110 : 0;
      let y = (H - blockH - subH) / 2 - 30;
      drawLines(ctx, lines, size, W / 2, y, { color, align: 'center', marker: hasPhoto ? null : p.accent, shadow: hasPhoto });
      y += blockH + 50;
      if (o.sub) {
        const s = fit(ctx, o.sub, W - 260, 1, 60, 36, 700);
        pill(ctx, s.lines[0], W / 2, y, s.size, hasPhoto ? p.accent : p.accent, hasPhoto ? p.accentText : p.accentText, 'center', 36, 18);
      }
      if (o.tag) pill(ctx, o.tag, 80, 80, 40, hasPhoto ? 'rgba(255,255,255,.9)' : p.card, hasPhoto ? '#222' : p.cardText);
    },

    card(ctx, o, p) {
      const hasPhoto = !!o.photo;
      if (!hasPhoto) {
        // 无照片时在上半部分放一个大号引号装饰
        ctx.fillStyle = p.deco;
        ctx.font = font(520, 900);
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic';
        ctx.fillText('“', 70, 600);
      }
      const cardX = 60;
      const cardW = W - 120;
      const m = fit(ctx, o.main, cardW - 120, 3, 150, 80);
      const mainH = m.lines.length * m.size * 1.18;
      const s = o.sub ? fit(ctx, o.sub, cardW - 120, 2, 58, 36, 700) : null;
      const subH = s ? s.lines.length * s.size * 1.3 + 30 : 0;
      const cardH = mainH + subH + 150;
      const cardY = hasPhoto ? H - cardH - 70 : Math.min(H - cardH - 70, Math.max(560, (H - cardH) / 2 + 120));
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.18)';
      ctx.shadowBlur = 40;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = p.card;
      roundRect(ctx, cardX, cardY, cardW, cardH, 44);
      ctx.fill();
      ctx.restore();
      // 卡片顶部色条
      ctx.fillStyle = p.accent === '#ffffff' ? p.bg[0] : p.accent;
      roundRect(ctx, cardX + 60, cardY + 50, 120, 14, 7);
      ctx.fill();
      drawLines(ctx, m.lines, m.size, cardX + 60, cardY + 80, { color: p.cardText, marker: p.card === '#1d1d1d' ? null : hexA(p.accent, 0.45) });
      if (s) {
        ctx.font = font(s.size, 700);
        ctx.fillStyle = p.card === '#1d1d1d' ? p.accent : (p.accent === '#ffe14d' || p.accent === '#ffe66d' ? p.bg[0] : p.accent);
        ctx.textAlign = 'left';
        s.lines.forEach((l, i) => ctx.fillText(l, cardX + 60, cardY + 80 + mainH + 40 + s.size + i * s.size * 1.3));
      }
      if (o.tag) pill(ctx, o.tag, 80, 80, 40, hasPhoto ? 'rgba(255,255,255,.92)' : p.card, hasPhoto ? '#222' : p.cardText);
    },

    magazine(ctx, o, p) {
      const hasPhoto = !!o.photo;
      if (hasPhoto) overlay(ctx, 0, H, 0.35, 0.65);
      const color = hasPhoto ? '#ffffff' : p.text;
      const accent = p.accent;
      // 顶部刊头
      ctx.fillStyle = color;
      ctx.font = font(44, 800);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';
      ctx.fillText('NOTE', 90, 140);
      ctx.font = font(30, 500);
      ctx.globalAlpha = 0.8;
      ctx.fillText(o.tag || 'XIAOHONGSHU', 230, 138);
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.fillRect(90, 170, W - 180, 4);
      // 竖向色条 + 大字
      const m = fit(ctx, o.main, W - 260, 4, 190, 90);
      const mainH = m.lines.length * m.size * 1.12;
      const y = Math.max(260, (H - mainH) / 2 - 60);
      ctx.fillStyle = accent;
      ctx.fillRect(90, y + 10, 22, mainH);
      drawLines(ctx, m.lines, m.size, 150, y, { color, lineGap: 1.12, shadow: hasPhoto });
      if (o.sub) {
        const s = fit(ctx, o.sub, W - 260, 2, 60, 36, 600);
        ctx.font = font(s.size, 600);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.92;
        s.lines.forEach((l, i) => ctx.fillText(l, 150, y + mainH + 70 + s.size + i * s.size * 1.3));
        ctx.globalAlpha = 1;
      }
      // 底部
      ctx.fillStyle = color;
      ctx.fillRect(90, H - 170, W - 180, 2);
      ctx.font = font(36, 700);
      ctx.textAlign = 'right';
      ctx.fillText('点开看全文 →', W - 90, H - 100);
    },

    top(ctx, o, p) {
      const hasPhoto = !!o.photo;
      if (hasPhoto) {
        const g = ctx.createLinearGradient(0, 0, 0, H * 0.62);
        g.addColorStop(0, 'rgba(0,0,0,.7)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, W, H);
      }
      const color = hasPhoto ? '#ffffff' : p.text;
      let y = 110;
      if (o.tag) { pill(ctx, o.tag, 90, y, 38, p.accent, p.accentText); y += 110; }
      const m = fit(ctx, o.main, W - 180, 3, 170, 90);
      const mh = drawLines(ctx, m.lines, m.size, 90, y, { color, shadow: hasPhoto, marker: hasPhoto ? null : hexA(p.accent, 0.5) });
      if (o.sub) {
        const s = fit(ctx, o.sub, W - 180, 2, 62, 36, 700);
        ctx.font = font(s.size, 700);
        ctx.fillStyle = color;
        ctx.textAlign = 'left';
        s.lines.forEach((l, i) => ctx.fillText(l, 90, y + mh + 40 + s.size + i * s.size * 1.3));
      }
      if (!hasPhoto) {
        // 底部放一个“照片位”装饰框，提示可上传照片
        ctx.strokeStyle = p.deco.replace(/[\d.]+\)$/, '0.5)');
        ctx.lineWidth = 6;
        ctx.setLineDash([24, 18]);
        roundRect(ctx, 90, H - 560, W - 180, 460, 40);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.font = font(120, 900);
        ctx.textAlign = 'center';
        ctx.fillStyle = p.deco.replace(/[\d.]+\)$/, '0.6)');
        ctx.fillText('📷', W / 2, H - 290);
      }
    },

    sticker(ctx, o, p) {
      const hasPhoto = !!o.photo;
      if (hasPhoto) overlay(ctx, 0, H, 0.05, 0.25);
      const m = fit(ctx, o.main, W - 260, 3, 160, 84);
      const lh = m.size * 1.5;
      const total = m.lines.length * lh + (o.sub ? 150 : 0);
      let y = (H - total) / 2;
      m.lines.forEach((line, i) => {
        ctx.font = font(m.size);
        const w = ctx.measureText(line).width;
        const bw = w + 70;
        const bh = m.size * 1.3;
        ctx.save();
        ctx.translate(W / 2, y + bh / 2);
        ctx.rotate(((i % 2 ? 2.2 : -2.6) * Math.PI) / 180);
        ctx.shadowColor = 'rgba(0,0,0,.22)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 8;
        ctx.fillStyle = i % 2 ? p.card : p.accent;
        roundRect(ctx, -bw / 2, -bh / 2, bw, bh, 22);
        ctx.fill();
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = i % 2 ? p.cardText : p.accentText;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(line, 0, 6);
        ctx.restore();
        y += lh;
      });
      if (o.sub) {
        const s = fit(ctx, o.sub, W - 300, 1, 58, 34, 800);
        ctx.save();
        ctx.translate(W / 2, y + 70);
        ctx.rotate((1.5 * Math.PI) / 180);
        ctx.font = font(s.size, 800);
        const w = ctx.measureText(s.lines[0]).width + 60;
        ctx.fillStyle = '#222';
        roundRect(ctx, -w / 2, -s.size, w, s.size * 2, 16);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(s.lines[0], 0, 4);
        ctx.restore();
      }
      if (o.tag) pill(ctx, o.tag, 80, 80, 40, hasPhoto ? 'rgba(255,255,255,.92)' : p.card, hasPhoto ? '#222' : p.cardText);
    },
  };

  function hexA(hex, a) {
    const m = /^#([0-9a-f]{6})$/i.exec(hex);
    if (!m) return hex;
    const n = parseInt(m[1], 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  }

  /**
   * 绘制封面
   * @param {HTMLCanvasElement} canvas
   * @param {{main:string, sub?:string, tag?:string, palette?:string, layout?:string, photo?:HTMLImageElement, zoom?:number, posX?:number, posY?:number}} o
   * @param {number} scale 1 = 1080×1440
   */
  function render(canvas, o, scale = 1) {
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const p = PALETTES[o.palette] || PALETTES.red;
    drawBackground(ctx, o, p);
    (LAYOUT_FN[o.layout] || LAYOUT_FN.center)(ctx, o, p);
    return canvas;
  }

  function toDataURL(o, scale = 1) {
    return render(document.createElement('canvas'), o, scale).toDataURL('image/png');
  }

  function toBlob(o) {
    return new Promise((resolve) => render(document.createElement('canvas'), o, 1).toBlob(resolve, 'image/png'));
  }

  /** 读取本地图片文件（只在浏览器内存中处理，不上传） */
  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      if (!file || !/^image\//.test(file.type)) { reject(new Error('请选择图片文件')); return; }
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片读取失败，换一张试试')); };
      img.src = url;
    });
  }

  window.XHSCover = { render, toDataURL, toBlob, loadImageFile, PALETTES, LAYOUTS, WIDTH: W, HEIGHT: H };
})();
