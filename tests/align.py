# 숫자 정렬 자동 검사: 같은 표·같은 열·같은 슬롯(data-k)의 숫자 오른쪽 끝이 행 간 1px 이내로 일치하는지
JS = r"""() => {
  const bad = []; let n = 0, nd = 0;
  const rr = el => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  document.querySelectorAll('#page table:not(.raw)').forEach((t, ti) => {
    const mobile = getComputedStyle(t.querySelector('thead') || t).display === 'none';
    const groups = {};
    t.querySelectorAll('tbody tr, tfoot tr').forEach(tr => [...tr.children].forEach((td, ci) => {
      if (!td.classList.contains('n')) return;
      const add = (k, x, fs, fw) => (groups[ci + '|' + k] ||= []).push({ x, fs, txt: td.textContent.trim().slice(0, 40) });
      const sv = td.querySelectorAll('.sl');
      if (sv.length) { sv.forEach(s => { const v = s.querySelector('.sv'); const cs = getComputedStyle(v); add('sv:' + s.dataset.k, v.getBoundingClientRect().right, cs.fontSize); });
        td.querySelectorAll('.ar').forEach((a, i) => add('ar' + i, a.getBoundingClientRect().left, ''));
        td.querySelectorAll('.bd').forEach(b => add('bd', b.getBoundingClientRect().left, '')); }
      else if (td.textContent.trim()) add('txt', rr(td).right, getComputedStyle(td).fontSize);
    }));
    // 날짜 슬롯(.dt): 같은 열·같은 형식끼리 왼쪽·오른쪽 끝 ±1px
    t.querySelectorAll('tbody tr, tfoot tr').forEach(tr => [...tr.children].forEach((td, ci) => td.querySelectorAll('.dt').forEach((d, di) => { const r = d.getBoundingClientRect(), cs = getComputedStyle(d); nd++;
      if (cs.fontVariantNumeric.indexOf('tabular-nums') < 0) bad.push({ table: ti, slot: 'date-tnum', sample: [d.textContent] });
      (groups[ci + '|dtL:' + d.dataset.k + ':' + di] ||= []).push({ x: r.left, fs: cs.fontSize, txt: d.textContent });
      (groups[ci + '|dtR:' + d.dataset.k + ':' + di] ||= []).push({ x: r.right, fs: cs.fontSize, txt: d.textContent }); })));
    for (const [k, a] of Object.entries(groups)) { if (a.length < 2) continue; n += a.length;
      const xs = a.map(o => o.x), sp = Math.max(...xs) - Math.min(...xs), fss = new Set(a.map(o => o.fs));
      if (sp > 1 || fss.size > 1) bad.push({ table: ti, slot: k, spread: +sp.toFixed(2), fontSizes: [...fss], sample: a.slice(0, 3).map(o => o.txt) }); }
  });
  // 앱 전체 날짜 형식 검사
  document.querySelectorAll('#page .dt').forEach(d => { if (!/^(\d{4}-\d{2}(-\d{2}( \d{2}:\d{2}:\d{2})?)?)$/.test(d.textContent)) bad.push({ slot: 'date-format', sample: [d.textContent] }); });
  return { checked: n, dates: nd, bad };
}"""
def check(page, label, ok, need_slots=True):
    r = page.evaluate(JS)
    print(f'ALIGN {label}: 슬롯 {r["checked"]}개 날짜 {r["dates"]}개', r['bad'][:3] if r['bad'] else '')
    layout(page, label, ok); controls(page, label, ok)
    ok((r['checked'] > 0 or not need_slots) and not r['bad'], f'숫자·날짜 정렬(숫자 오른쪽 끝, 날짜 좌우 끝 ±1px) — {label}')

# 대비 검사: 화면의 모든 텍스트 ≥4.5:1, 숫자(.sv, td.n, .kpi) ≥7:1
CJS = r"""() => {
  const P = s => { const m = s.match(/[\d.]+/g); return m ? m.map(Number) : [0,0,0,0]; };
  const L = ([r,g,b]) => { const f = c => (c/=255) <= .03928 ? c/12.92 : ((c+.055)/1.055)**2.4; return .2126*f(r)+.7152*f(g)+.0722*f(b); };
  const bg = el => { const st = []; for (let e = el; e; e = e.parentElement) { const c = P(getComputedStyle(e).backgroundColor); if (c.length < 4 || c[3] > 0) { st.push(c); if (c.length < 4 || c[3] >= 1) break; } } let out = [255,255,255]; for (const c of st.reverse()) { const a = c.length < 4 ? 1 : c[3]; out = out.map((v,i) => v*(1-a) + c[i]*a); } return out; };
  const bad = []; let n = 0;
  document.querySelectorAll('#page *').forEach(el => {
    if (!el.offsetParent && el.tagName !== 'BODY') return;
    const own = [...el.childNodes].some(c => c.nodeType === 3 && c.textContent.trim()); if (!own) return;
    const cs = getComputedStyle(el); if (el.closest('input,select,textarea,option')) return;
    const fg = P(cs.color), b = bg(el), l1 = L(fg), l2 = L(b), cr = (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);
    const num = el.closest('.sv, td.n, .kpi') && /\d/.test(el.textContent);
    const need = num ? 7 : 4.5; n++;
    if (cr < need) bad.push({ txt: el.textContent.trim().slice(0, 30), cr: +cr.toFixed(2), need, color: cs.color });
  });
  return { checked: n, bad };
}"""
def contrast(page, label, ok):
    r = page.evaluate(CJS)
    print(f'CONTRAST {label}: 텍스트 {r["checked"]}개', r['bad'][:4] if r['bad'] else '')
    ok((r['checked'] > 0 or not need_slots) and not r['bad'], f'명도 대비(본문 4.5:1, 숫자 7:1) — {label}')

# 전체 레이아웃 정렬 검사: 표의 모든 열(문자=왼쪽 끝, 숫자=오른쪽 끝), 헤더-열 일치, 행 내 기준선, 열별 여백, 카드 그리드
LJS = r"""() => {
  const bad = []; let n = 0; const T = 1.01;
  const vis = el => el && el.offsetParent !== null && getComputedStyle(el).visibility !== 'hidden';
  const firstText = el => { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, { acceptNode: t => t.textContent.trim() && vis(t.parentElement) && !t.parentElement.closest('option,select') ? 1 : 3 }); return w.nextNode(); };
  const contentBox = el => { const r = document.createRange(); r.selectNodeContents(el); const rs = [...r.getClientRects()].filter(x => x.width > 0 && x.height > 0); if (!rs.length) return null; return { l: Math.min(...rs.map(x => x.left)), r: Math.max(...rs.map(x => x.right)) }; };
  const baseline = el => { const t = firstText(el); if (!t) return null; const m = document.createElement('span'); m.style.cssText = 'display:inline-block;width:0;height:0;padding:0;margin:0;border:0'; t.parentNode.insertBefore(m, t); const y = m.getBoundingClientRect().bottom; m.remove(); return y; };
  const spread = a => a.length < 2 ? 0 : Math.max(...a) - Math.min(...a);
  const push = (kind, where, vals, samp) => { n += vals.length; const s = spread(vals); if (s > T) bad.push({ kind, where, spread: +s.toFixed(2), sample: samp.slice(0, 3) }); };
  document.querySelectorAll('#page table:not(.raw)').forEach((t, ti) => { if (!vis(t)) return;
    const head = t.querySelector('thead'); const desk = head && getComputedStyle(head).display !== 'none';
    const rows = [...t.querySelectorAll('tbody tr, tfoot tr')].filter(vis);
    const cols = {};
    rows.forEach((tr, ri) => { const cells = [...tr.children].filter(c => !c.hasAttribute('colspan') && c.textContent.trim());
      if (desk && cells.length > 1) { const bl = cells.map(baseline).filter(v => v != null); push('행 기준선', `표${ti} 행${ri}`, bl, cells.map(c => c.textContent.trim().slice(0, 15))); }
      [...tr.children].forEach((td, ci) => { if (td.hasAttribute('colspan') || !td.textContent.trim()) return; const cs = getComputedStyle(td); const num = td.classList.contains('n');
        const c = cols[ci] ||= { num, L: [], R: [], P: [], s: [] };
        const ft = firstText(td); if (!ft) return; const r = document.createRange(); r.selectNodeContents(ft); const fr = r.getClientRects()[0]; const cb = td.getBoundingClientRect();
        const pl = parseFloat(cs.paddingLeft), pr = parseFloat(cs.paddingRight);
        if (desk && !num) c.L.push(cb.left + pl - (fr ? fr.left : 0)); // 첫 글자 왼쪽 = 셀 내용 시작
        c.P.push(pl + '/' + pr + '/' + cs.paddingTop); c.s.push(td.textContent.trim().slice(0, 15));
        const af = getComputedStyle(td, '::after').content; if ((num || !desk) && (!af || af === 'none' || af === 'normal')) { const b = contentBox(td); if (b) c.R.push(cb.right - pr - b.r); } }); });
    for (const [ci, c] of Object.entries(cols)) {
      if (!c.num && desk) push('문자 열 왼쪽 끝', `표${ti} 열${ci}`, c.L, c.s);
      if (c.num || !desk) push(desk ? '숫자 열 오른쪽 끝' : '모바일 카드 값 오른쪽 끝', `표${ti} 열${ci}`, c.R, c.s);
      if (new Set(c.P).size > 1) bad.push({ kind: '열 여백 불일치', where: `표${ti} 열${ci}`, sample: [...new Set(c.P)] });
      if (desk) { const th = t.querySelector(`thead tr th:nth-child(${+ci + 1})`); const td = rows.map(r => r.children[ci]).find(x => x && !x.hasAttribute('colspan') && x.textContent.trim());
        if (th && td && !th.hasAttribute('colspan')) { const hb = contentBox(th), hc = th.getBoundingClientRect(), hs = getComputedStyle(th), tc = td.getBoundingClientRect(), tss = getComputedStyle(td); n++;
          if (Math.abs(hc.left - tc.left) > T || Math.abs(hc.right - tc.right) > T) bad.push({ kind: '헤더-열 경계', where: `표${ti} 열${ci}` });
          if (hs.paddingLeft !== tss.paddingLeft || hs.paddingRight !== tss.paddingRight) bad.push({ kind: '헤더-열 여백', where: `표${ti} 열${ci}`, sample: [hs.paddingLeft, tss.paddingLeft] });
          if (hb) { if (c.num ? Math.abs((hc.right - parseFloat(hs.paddingRight)) - hb.r) > T : Math.abs((hc.left + parseFloat(hs.paddingLeft)) - hb.l) > T) bad.push({ kind: c.num ? '헤더 오른쪽 정렬' : '헤더 왼쪽 정렬', where: `표${ti} 열${ci}`, sample: [th.textContent.trim()] }); } } }
    }
  });
  // 카드 그리드: 같은 줄 카드끼리 여백·제목/값 기준선 일치
  document.querySelectorAll('#page .grid').forEach((g, gi) => { const cs = [...g.children].filter(vis); const rows = {};
    cs.forEach(c => { (rows[Math.round(c.getBoundingClientRect().top)] ||= []).push(c); });
    Object.values(rows).forEach(rc => { if (rc.length < 2) return; push('카드 여백', `그리드${gi}`, rc.map(c => parseFloat(getComputedStyle(c).paddingLeft)), []);
      ['.muted', '.kpi'].forEach(sel => { const els = rc.map(c => c.querySelector(sel)).filter(Boolean); if (els.length === rc.length) { push(`카드 ${sel} 기준선`, `그리드${gi}`, els.map(baseline).filter(v => v != null), els.map(e => e.textContent.slice(0, 12)));
        push(`카드 ${sel} 왼쪽 끝`, `그리드${gi}`, els.map((e, i) => { const t = firstText(e); const r = document.createRange(); r.selectNodeContents(t); return r.getClientRects()[0].left - rc[i].getBoundingClientRect().left; }), []); } }); }); });
  // 목록·폼 줄: 같은 줄 라벨 기준선
  document.querySelectorAll('#page form.row').forEach((f, fi) => { const rows = {}; [...f.children].filter(x => x.tagName === 'LABEL' && vis(x) && !x.classList.contains('chk')).forEach(l => (rows[Math.round(l.getBoundingClientRect().top)] ||= []).push(l));
    Object.values(rows).forEach(r => r.length > 1 && push('폼 라벨 기준선', `폼${fi}`, r.map(baseline).filter(v => v != null), r.map(l => l.textContent.trim().slice(0, 8)))); });
  return { checked: n, bad };
}"""
def layout(page, label, ok):
    r = page.evaluate(LJS)
    print(f'LAYOUT {label}: {r["checked"]}개', r['bad'][:4] if r['bad'] else '')
    ok(not r['bad'], f'전체 정렬(문자·숫자·헤더·기준선·여백 ±1px) — {label}')

CTL_JS = r"""() => {
  const vis = el => { const r = el.getBoundingClientRect(), cs = getComputedStyle(el); return r.width > 2 && r.height > 2 && cs.visibility !== 'hidden' && cs.display !== 'none' && cs.opacity !== '0'; };
  const els = [...document.querySelectorAll('#page button, #page .btn, #page input, #page select')].filter(el => !['checkbox', 'radio', 'file', 'hidden'].includes(el.type) && !el.classList.contains('dnat') && vis(el));
  const box = el => el.closest('.row, form, .chips, .card') || el.parentElement; const groups = new Map();
  for (const el of els) { const k = box(el); (groups.get(k) || groups.set(k, []).get(k)).push(el); }
  const bad = []; let n = 0;
  for (const g of groups.values()) { const rs = g.map(el => ({ el, r: el.getBoundingClientRect() })); const used = new Set();
    for (const a of rs) { if (used.has(a)) continue; const line = rs.filter(b => !used.has(b) && Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top) > Math.min(a.r.height, b.r.height) / 2); line.forEach(b => used.add(b));
      if (line.length < 2) continue; n += line.length;
      const H = line.map(x => x.r.height), T = line.map(x => x.r.top), B = line.map(x => x.r.bottom); const sp = a => Math.max(...a) - Math.min(...a);
      if (sp(H) > 1 || sp(T) > 1 || sp(B) > 1) bad.push({ h: H.map(Math.round), top: T.map(Math.round), sample: line.map(x => (x.el.textContent || x.el.name || x.el.id || x.el.tagName).trim().slice(0, 14)) }); } }
  return { checked: n, bad };
}"""
def controls(page, label, ok):
    r = page.evaluate(CTL_JS)
    print(f'CONTROLS {label}: {r["checked"]}개', r['bad'][:4] if r['bad'] else '')
    ok(not r['bad'], f'버튼·입력 행 높이/위아래 끝 일치(±1px) — {label}')
