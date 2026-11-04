/*
 * 我的资料库：身份/账号档案 + 真实案例库（只保存在本机浏览器 localStorage）
 */
(function () {
  'use strict';
  const X = window.XHS;
  const esc = X.esc;
  const $ = (id) => document.getElementById(id);
  const KEY = { profiles: 'xhs_profiles', cases: 'xhs_cases' };
  const INDUSTRIES = X.INDUSTRIES;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const load = (k) => X.store.json(KEY[k], []);
  const save = (k, list) => {
    if (!X.store.set(KEY[k], JSON.stringify(list))) X.toast('⚠️ 浏览器存储空间不足，保存失败');
    refreshAll();
  };
  const profiles = () => load('profiles');
  const cases = () => load('cases');
  const getProfile = (id) => profiles().find((p) => p.id === id) || null;
  const getCase = (id) => cases().find((c) => c.id === id) || null;

  function upsert(k, obj) {
    const list = load(k);
    const i = list.findIndex((x) => x.id === obj.id);
    if (i >= 0) list[i] = { ...list[i], ...obj, updatedAt: Date.now() };
    else list.unshift({ ...obj, id: obj.id || uid(), createdAt: Date.now() });
    save(k, list);
    return obj.id || list[0].id;
  }
  function remove(k, id) { save(k, load(k).filter((x) => x.id !== id)); }

  const indName = (id) => (INDUSTRIES[id] ? INDUSTRIES[id].name : '通用');
  const subName = (ind, sub) => ((INDUSTRIES[ind] && INDUSTRIES[ind].subs.find((s) => s.id === sub)) || {}).name || '';
  function caseTitle(c) {
    return [c.time, c.city, c.client].filter(Boolean).join(' · ') || (c.problem || '未命名案例').slice(0, 20);
  }

  // ================= 列表渲染 =================
  const el = {
    profileList: $('profileList'), caseList: $('caseList'), caseFilter: $('caseFilter'),
    genProfile: $('genProfile'), genCasesBtn: $('genCasesBtn'), genCasesBox: $('genCasesBox'),
    profileDlg: $('profileDlg'), profileForm: $('profileForm'), caseDlg: $('caseDlg'), caseForm: $('caseForm'),
  };
  el.caseFilter.innerHTML += Object.entries(INDUSTRIES).map(([id, x]) => `<option value="${id}">${x.icon} ${esc(x.name)}</option>`).join('');

  function renderProfiles() {
    const list = profiles();
    el.profileList.innerHTML = list.length ? list.map((p) => `
      <div class="lib-item">
        <h4>${esc(p.name)}</h4>
        <p>${esc([p.identity, p.area, p.years ? String(p.years).replace(/年$/, '') + ' 年' : ''].filter(Boolean).join(' · '))}</p>
        ${p.features ? `<p>✨ ${esc(p.features)}</p>` : ''}
        ${p.style ? `<p>🗣 ${esc(p.style)}</p>` : ''}
        ${p.ending ? `<p>🔚 ${esc(p.ending)}</p>` : ''}
        <div class="row-actions">
          <button type="button" class="btn primary sm" data-p-use="${esc(p.id)}">用这个档案写笔记</button>
          <button type="button" class="btn ghost sm" data-p-edit="${esc(p.id)}">编辑</button>
          <button type="button" class="btn ghost sm" data-p-del="${esc(p.id)}">删除</button>
        </div>
      </div>`).join('') : '<div class="lib-empty">还没有档案，点右上角「＋ 新建档案」</div>';
  }

  function renderCases() {
    const f = el.caseFilter.value;
    const list = cases().filter((c) => !f || c.industry === f);
    el.caseList.innerHTML = list.length ? list.map((c) => `
      <div class="lib-item">
        <h4>${esc(caseTitle(c))}</h4>
        <p class="meta">${esc(indName(c.industry))}${c.sub ? ' / ' + esc(subName(c.industry, c.sub)) : ''}</p>
        ${c.problem ? `<p>❓ ${esc(c.problem)}</p>` : ''}
        ${c.solution ? `<p>🔧 ${esc(c.solution)}</p>` : ''}
        ${c.cost || c.result ? `<p>${c.cost ? '💵 ' + esc(c.cost) + '　' : ''}${c.result ? '✅ ' + esc(c.result) : ''}</p>` : ''}
        ${c.note ? `<p class="meta">📝 ${esc(c.note)}</p>` : ''}
        <div class="row-actions">
          <button type="button" class="btn primary sm" data-c-use="${esc(c.id)}">用这个案例写笔记</button>
          <button type="button" class="btn ghost sm" data-c-edit="${esc(c.id)}">编辑</button>
          <button type="button" class="btn ghost sm" data-c-del="${esc(c.id)}">删除</button>
        </div>
      </div>`).join('') : `<div class="lib-empty">${f ? '这个行业还没有案例' : '还没有案例，点右上角「＋ 新增案例」'}</div>`;
  }

  // ================= 生成页上的选择器 =================
  let selectedCases = [];
  function renderPicker() {
    const pid = el.genProfile.value;
    el.genProfile.innerHTML = '<option value="">不带入</option>' + profiles().map((p) => `<option value="${esc(p.id)}">${esc(p.name)}</option>`).join('');
    if (getProfile(pid)) el.genProfile.value = pid;
    const all = cases();
    selectedCases = selectedCases.filter((id) => all.some((c) => c.id === id));
    const ind = document.getElementById('industry').value;
    // 当前行业的案例排在前面
    const sorted = [...all].sort((a, b) => (b.industry === ind) - (a.industry === ind));
    el.genCasesBox.innerHTML = sorted.length ? sorted.map((c) => `
      <label><input type="checkbox" value="${esc(c.id)}" ${selectedCases.includes(c.id) ? 'checked' : ''} />
      <span>${esc(caseTitle(c))}<br><small class="muted">${esc(indName(c.industry))}${c.problem ? ' · ' + esc(c.problem.slice(0, 24)) : ''}</small></span></label>`).join('')
      : '<div class="lib-empty">还没有案例，先去「📚 资料库」添加</div>';
    el.genCasesBtn.textContent = selectedCases.length ? `已选 ${selectedCases.length} 个案例 ▾` : '选择案例（0） ▾';
  }
  el.genCasesBtn.addEventListener('click', () => { el.genCasesBox.hidden = !el.genCasesBox.hidden; });
  el.genCasesBox.addEventListener('change', () => {
    selectedCases = [...el.genCasesBox.querySelectorAll('input:checked')].map((x) => x.value);
    el.genCasesBtn.textContent = selectedCases.length ? `已选 ${selectedCases.length} 个案例 ▾` : '选择案例（0） ▾';
  });
  document.getElementById('industry').addEventListener('change', renderPicker);

  /** 生成页读取当前选择 */
  function selection() {
    return { profileId: el.genProfile.value || '', caseIds: selectedCases.slice() };
  }
  function setSelection(profileId, caseIds) {
    selectedCases = (caseIds || []).slice();
    renderPicker();
    el.genProfile.value = getProfile(profileId) ? profileId : '';
  }
  /** 把输入里的 id 解析成对象 */
  function resolve(input) {
    return {
      profile: input.profileId ? getProfile(input.profileId) : null,
      cases: (input.caseIds || []).map(getCase).filter(Boolean),
    };
  }

  // ================= 编辑弹窗 =================
  function fillForm(form, obj) {
    [...form.elements].forEach((f) => { if (f.name) f.value = obj[f.name] ?? ''; });
  }
  function formData(form) {
    const o = {};
    [...form.elements].forEach((f) => { if (f.name) o[f.name] = String(f.value || '').trim(); });
    return o;
  }

  function openProfile(p = {}) {
    fillForm(el.profileForm, p);
    el.profileDlg.showModal();
  }
  el.profileForm.addEventListener('submit', (e) => {
    const d = formData(el.profileForm);
    if (e.submitter && e.submitter.value === 'cancel') return;
    if (!d.name) { e.preventDefault(); X.toast('请填写档案名称'); return; }
    upsert('profiles', d);
    X.toast('✅ 档案已保存');
  });

  const caseInd = el.caseForm.elements.industry;
  const caseSub = el.caseForm.elements.sub;
  caseInd.innerHTML = Object.entries(INDUSTRIES).map(([id, x]) => `<option value="${id}">${x.icon} ${esc(x.name)}</option>`).join('');
  function fillCaseSubs(sel) {
    const ind = INDUSTRIES[caseInd.value];
    caseSub.innerHTML = '<option value="">不限</option>' + (ind ? ind.subs.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('') : '');
    caseSub.value = sel || '';
  }
  caseInd.addEventListener('change', () => fillCaseSubs());

  function openCase(c = {}) {
    fillForm(el.caseForm, c);
    caseInd.value = c.industry || document.getElementById('industry').value || 'general';
    fillCaseSubs(c.sub);
    el.caseDlg.showModal();
  }
  el.caseForm.addEventListener('submit', (e) => {
    if (e.submitter && e.submitter.value === 'cancel') return;
    const d = formData(el.caseForm);
    if (!d.problem && !d.solution && !d.result) { e.preventDefault(); X.toast('至少填写问题、解决方案或结果中的一项'); return; }
    upsert('cases', d);
    X.toast('✅ 案例已保存');
  });
  [el.profileDlg, el.caseDlg].forEach((dlg) => dlg.addEventListener('click', (e) => { if (e.target === dlg) dlg.close(); }));

  $('btnNewProfile').addEventListener('click', () => openProfile());
  $('btnNewCase').addEventListener('click', () => openCase({ industry: el.caseFilter.value || undefined }));
  el.caseFilter.addEventListener('change', renderCases);

  el.profileList.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.pEdit) openProfile(getProfile(t.dataset.pEdit));
    if (t.dataset.pDel && confirm('删除这个档案？')) remove('profiles', t.dataset.pDel);
    if (t.dataset.pUse) {
      setSelection(t.dataset.pUse, selectedCases);
      X.showTab('gen');
      X.toast('已选中档案，填写主题后点「开始生成」');
    }
  });
  el.caseList.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.cEdit) openCase(getCase(t.dataset.cEdit));
    if (t.dataset.cDel && confirm('删除这个案例？')) remove('cases', t.dataset.cDel);
    if (t.dataset.cUse) {
      const c = getCase(t.dataset.cUse);
      if (!c) return;
      const ind = document.getElementById('industry');
      ind.value = INDUSTRIES[c.industry] ? c.industry : 'general';
      ind.dispatchEvent(new Event('change'));
      if (c.sub) document.getElementById('sub').value = c.sub;
      setSelection(el.genProfile.value, [c.id]);
      const topic = document.getElementById('topic');
      if (!topic.value.trim()) topic.value = subName(c.industry, c.sub) || (c.problem || '').slice(0, 20);
      X.showTab('gen');
      X.toast('已带入案例，确认主题后点「开始生成」');
    }
  });

  function refreshAll() { renderProfiles(); renderCases(); renderPicker(); }
  refreshAll();
  // 恢复上次生成时选择的档案和案例
  const last = X.store.json(X.LS.lastInput, null);
  if (last) setSelection(last.profileId, last.caseIds);

  window.XHSLibrary = {
    profiles, cases, getProfile, getCase, upsertCase: (c) => upsert('cases', c), openCase,
    selection, setSelection, resolve, caseTitle, refresh: refreshAll,
    KEYS: KEY,
  };
})();
