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

  window.XHSTools = { showTool };
})();
