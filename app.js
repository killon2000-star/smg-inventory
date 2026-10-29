/* SMG 재고관리 — 앱 본체 (미리보기 모드와 Firebase 모드가 같은 화면을 씁니다) */
(function () {
'use strict';

/* ───────── 기본 설정 ───────── */
const OWNER_EMAIL = 'killon2000@gmail.com';
const STORES = [
  { id: 'suwon', name: 'SMG STORE_수원' },
  { id: 'boxcafe', name: 'BOX CAFE' },
  { id: 'museum', name: 'SMG MUSEUM_홍대' },
  { id: 'omake', name: 'CAFE 오마케' },
  { id: 'limission', name: '리밋션_홍대' },
];
const COMPANIES = ['SMG 홀딩스', 'SMG 크리에이티브', '온인터내셔널', 'SMG STORE_수원', 'BOX CAFE', 'SMG MUSEUM_홍대', 'CAFE 오마케', '리밋션_홍대', '기타(직접 입력)'];
const POSITIONS = ['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '대리', '수석팀장', '팀장', '부팀장', '매니저', '사원'];
const SALES_REC = new Set(['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '수석팀장', '팀장']);     // 팀장 이상 → 매출 보기 추천
const COUNT_REC = new Set(['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '대리', '수석팀장', '팀장', '부팀장', '매니저']); // 매장 책임자 → 실재고 추천
const WORK_PLACES = STORES.map(s => s.name).concat(['본사', '창고']);
const TYPES = [
  { id: '입고', sign: +1, d: '상품이 매장에 들어옴' },
  { id: '판매', sign: -1, d: 'POS 밖에서 판매한 수량 (POS 판매는 매출 파일로 자동 차감)' },
  { id: '매장 이동', sign: -1, d: '다른 매장으로 보냄 — 받는 매장이 확인하면 그 매장 재고에 더해짐', to: true },
  { id: '창고 보관', sign: -1, d: '판매 종료 후 창고로 보냄' },
  { id: '창고에서 가져옴', sign: +1, d: '창고에 보관하던 상품을 다시 매장으로' },
  { id: '외부에서 돌아옴', sign: +1, d: '행사장·팝업 등 외부 장소에 보냈던 상품이 매장으로 돌아옴', from: true },
  { id: '타 업체 이동', sign: -1, d: '다른 회사로 보냄', partner: true },
  { id: '반품', sign: -1, d: '공급처로 돌려보냄', partner: true },
  { id: '폐기', sign: -1, d: '파손·불량으로 폐기' },
];
const COUNT_TYPE = '실사 조정';
const PLACE_KINDS = ['행사장', '팝업', '창고', '거래처', '기타'];
const PERM_DEF = [
  { k: 'move', t: '입출고 등록', s: '입고·이동·창고·폐기 등록, 파일·링크로 올리기' },
  { k: 'count', t: '실재고 입력·수정', s: '매장 책임자. 실사 수량 반영' },
  { k: 'sales', t: '매출 보기', s: '팀장 이상. 매출 화면, 토스포스 파일 올리기' },
  { k: 'approve', t: '사용자 승인', s: '가입 승인, 권한 변경, 퇴사 처리' },
];

const DEFAULT_ORDER = STORES.map(s => s.id);
/* ───────── 작은 도구 ───────── */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = n => (n == null || isNaN(n)) ? '-' : Math.round(n).toLocaleString('ko-KR');
const won = n => fmt(n) + '원';
const man = n => { if (n == null) return '-'; const a = Math.abs(n); if (a >= 1e8) return (n / 1e8).toFixed(a >= 1e9 ? 1 : 2).replace(/\.?0+$/, '') + '억'; if (a >= 1e4) return (n / 1e4).toFixed(a >= 1e6 ? 0 : 1).replace(/\.0$/, '') + '만'; return fmt(n); };
const pct = (a, b) => b ? ((a / b - 1) * 100) : null;
const today = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);
const WD = ['일', '월', '화', '수', '목', '금', '토'];
const wd = d => WD[new Date(d + 'T00:00:00Z').getUTCDay()];
const md = d => d.slice(5).replace('-', '/');
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const norm = s => String(s || '').toLowerCase().replace(/^에바30주년팝업_/, '').replace(/[\s\[\]()!_\-.,~·&]/g, '');
const storeName = id => (STORES.find(s => s.id === id) || {}).name || id;
const storeColor = id => `var(--s-${id})`;
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  check: '<path d="M4 5h16v14H4z"/><path d="M8 12l3 3 5-6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><path d="M7 9v6M10 9v6M13 9v6M17 9v6"/>',
};
const ic = (n, s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICON[n]}</svg>`;

/* ───────── 상태 ───────── */
const S = {
  mode: 'demo', ready: false,
  user: null,              // 로그인 사용자 (권한 포함)
  view: 'home',
  stores: ['suwon'],       // 보고 있는 매장 (2개 이상이면 여러 매장 보기)
  sumStores: null,         // 매출 합산에 넣을 매장
  products: [], P: {}, byCode: {}, byName: {},
  stock: {},               // stock[store][pid]
  warehouse: {},           // 창고 보관 수량 pid → qty
  moves: [], transfers: [],
  sales: {},               // sales[store][YYYY-MM].days[DD]
  settle: [], users: [], asof: '',
  places: [],
  inbounds: [],            // 입고 예정: {id, store, date, title, ip, from, items:[{key,pid,name,code,plan,price,actual}], extra:[], status, ...}              // 외부 장소 (행사장·팝업 등): {id, name, kind, start, end, addr, person, memo, q:{pid:qty}}
  zipPw: { suwon: '0000' },
  ui: { q: '', f: 'all', ip: '', salesUnit: 'day', range: null, recType: '', recQ: '', counts: {}, countQ: '', countIp: '', entry: null, imp: null, adminTab: 'pending', showApply: false, posPreview: null, storeMenu: false },
};

/* ───────── 데이터 계층 ───────── */
const DemoBackend = {
  async load() {
    const r = await fetch('demo-data.json'); const d = await r.json();
    S.asof = d.asof;
    S.products = d.products;
    S.stock = { suwon: d.stock.suwon, boxcafe: {}, museum: {}, omake: {}, limission: {} };
    S.moves = d.moves;
    S.incoming = [];
    if (d.incoming && d.incoming.length) S.inbounds.push({ id: 'IB-261112-AOT', store: 'suwon', date: d.incoming[0].date, title: '진격의 거인 팝업 입고 예정 (SMG 상품리스트)', ip: '진격의 거인', from: 'SMG 홀딩스', status: 'planned', by: '', at: '2026-10-29',
      items: d.incoming.map(x => { const p = d.products.find(q => q.id === x.pid) || {}; return { key: 'p:' + x.pid, pid: x.pid, name: p.name || x.pid, code: p.barcode || p.sku || x.pid, plan: x.qty, price: p.price || null, actual: null }; }), extra: [] });
    S.sales = { suwon: d.sales.suwon, boxcafe: {}, museum: {}, omake: {}, limission: {} };
    S.settle = d.settle;
    S.users = demoUsers();
  },
  async saveMoves(list) { /* 미리보기: 화면 안에서만 반영 */ return true; },
  async saveSalesDay() { return true; },
  async saveUser() { return true; },
};
function demoUsers() {
  const all = STORES.map(s => s.id);
  return [
    { uid: 'u-owner', name: 'Anthony', email: OWNER_EMAIL, company: '온인터내셔널', position: '대표', places: ['본사'], status: 'active', perms: { stores: all, move: true, count: true, sales: true, approve: true }, owner: true, approvedAt: '2026-10-30' },
    { uid: 'u-yu', name: '유명훈', email: '(구글 계정)', company: '온인터내셔널', position: '본부장', places: ['본사'], status: 'active', perms: { stores: all, move: true, count: true, sales: true, approve: true }, approvedAt: '2026-10-30' },
    { uid: 'u-lead', name: '예시 팀장', email: 'example-lead@gmail.com', company: 'SMG STORE_수원', position: '팀장', places: ['SMG STORE_수원'], status: 'active', perms: { stores: ['suwon'], move: true, count: true, sales: true, approve: false }, approvedAt: '2026-10-30', sample: true },
    { uid: 'u-mgr', name: '예시 매니저', email: 'example-manager@gmail.com', company: 'SMG STORE_수원', position: '매니저', places: ['SMG STORE_수원'], status: 'active', perms: { stores: ['suwon'], move: true, count: true, sales: false, approve: false }, approvedAt: '2026-10-30', sample: true },
    { uid: 'u-staff', name: '예시 사원', email: 'example-staff@gmail.com', company: 'SMG STORE_수원', position: '사원', places: ['SMG STORE_수원'], status: 'active', perms: { stores: ['suwon'], move: true, count: false, sales: false, approve: false }, approvedAt: '2026-10-30', sample: true },
    { uid: 'u-ext', name: '예시 외부 인원', email: 'example-partner@gmail.com', company: '기타(직접 입력)', companyOther: '협력 물류사', position: '사원', places: ['SMG STORE_수원'], status: 'active', limited: true, perms: { stores: ['suwon'], move: false, count: false, sales: false, approve: false }, approvedAt: '2026-10-30', sample: true },
    { uid: 'u-p1', name: '예시 신청자 1', email: 'applicant1@gmail.com', company: 'SMG MUSEUM_홍대', position: '매니저', places: ['SMG MUSEUM_홍대'], phone: '', memo: '홍대 재고 담당', status: 'pending', perms: null, createdAt: '2026-10-30 09:12', sample: true },
    { uid: 'u-p2', name: '예시 신청자 2', email: 'applicant2@gmail.com', company: 'SMG 홀딩스', position: '수석팀장', places: ['본사'], phone: '', memo: '', status: 'pending', perms: null, createdAt: '2026-10-30 09:40', sample: true },
    { uid: 'u-p3', name: '예시 신청자 3', email: 'applicant3@gmail.com', company: '기타(직접 입력)', companyOther: '행사 대행사', position: '사원', places: ['SMG STORE_수원'], phone: '', memo: '코믹월드 행사 지원', status: 'pending', perms: null, createdAt: '2026-10-30 10:05', sample: true },
  ];
}
const DEMO_ROLES = [
  { uid: 'u-owner', label: '대표 (Anthony)' },
  { uid: 'u-yu', label: '본부장 (유명훈)' },
  { uid: 'u-lead', label: '팀장 · 수원' },
  { uid: 'u-mgr', label: '매니저 · 수원' },
  { uid: 'u-staff', label: '사원 · 수원' },
  { uid: 'u-ext', label: '기타 소속 (수량만)' },
];
let DB = DemoBackend;

/* ───────── 색인 ───────── */
function indexProducts() {
  S.P = {}; S.byCode = {}; S.byName = {};
  for (const p of S.products) {
    S.P[p.id] = p;
    if (p.barcode) (S.byCode[p.barcode] ||= []).push(p);
    if (p.sku) (S.byCode[p.sku.toLowerCase()] ||= []).push(p);
    (S.byName[norm(p.name)] ||= []).push(p);
  }
}
function findProduct(code) {
  code = String(code || '').trim().replace(/^'/, '');
  if (!code) return [];
  return S.byCode[code] || S.byCode[code.toLowerCase()] || [];
}
function stockOf(store, pid) { return (S.stock[store] || {})[pid] || 0; }

/* 권한 */
const can = k => !!(S.user && !S.user.limited && S.user.perms && S.user.perms[k]);
const isOwner = () => !!(S.user && S.user.owner);
const myStores = () => (S.user && S.user.owner ? STORES.map(s => s.id) : S.user && S.user.perms ? S.user.perms.stores : []);
const limited = () => !!(S.user && S.user.limited);

/* ───────── 경고·오류 찾기 ───────── */
function alerts(stores) {
  const out = [];
  for (const st of stores) {
    const neg = Object.entries(S.stock[st] || {}).filter(([, q]) => q < 0);
    if (neg.length) out.push({ lv: 'bad', st, t: `<b>마이너스 재고 ${neg.length}종</b> · ${esc(storeName(st))} — 판매가 입고보다 많습니다. 실사로 맞춰 주세요.`, go: () => { S.view = 'products'; S.ui.f = 'neg'; } });
  }
  const dupBar = Object.entries(S.byCode).filter(([k, v]) => v.length > 1 && /^\d{8,14}$/.test(k));
  if (dupBar.length) out.push({ lv: 'bad', t: `<b>바코드 중복 ${dupBar.length}건</b> — 같은 바코드가 상품 2개 이상에 등록돼 있습니다.`, go: () => { S.view = 'admin'; S.ui.adminTab = 'products'; } });
  const dupName = Object.values(S.byName).filter(v => v.length > 1);
  if (dupName.length) out.push({ lv: 'warn', t: `<b>같은 이름, 다른 품번 ${dupName.length}건</b> — 예: ${esc(dupName[0][0].name)}`, go: () => { S.view = 'admin'; S.ui.adminTab = 'products'; } });
  const pend = S.transfers.filter(t => t.status === 'sent' && stores.includes(t.to));
  if (pend.length) out.push({ lv: 'warn', t: `<b>받기 확인 안 한 이동 ${pend.length}건</b> — 다른 매장에서 보낸 상품을 확인해 주세요.`, go: () => { S.view = 'transfer'; } });
  for (const ib of S.inbounds.filter(x => x.status === 'planned' && stores.includes(x.store))) {
    out.push({ lv: 'info', t: `<b>입고 예정 ${ib.items.length}종 ${fmt(ib.items.reduce((a, b) => a + (b.plan || 0), 0))}개</b> · ${esc(ib.title)} ${ib.date ? md(ib.date) : ''} — 실제 입고 후 수량을 확인해 주세요.`, go: () => { S.view = 'inbound'; S.ui.ib = ib.id; } });
  }
  if (can('approve')) {
    const p = S.users.filter(u => u.status === 'pending').length;
    if (p) out.push({ lv: 'warn', t: `<b>승인 대기 ${p}명</b>`, go: () => { S.view = 'admin'; S.ui.adminTab = 'pending'; } });
  }
  return out;
}

/* ───────── 렌더 뼈대 ───────── */
const NAV = [
  { id: 'home', t: '홈', i: 'home', show: () => true },
  { id: 'products', t: '상품·재고', i: 'box', show: () => true },
  { id: 'entry', t: '입출고 등록', i: 'plus', show: () => can('move') },
  { id: 'count', t: '실사', i: 'check', show: () => can('count') },
  { id: 'inbound', t: '입고 확인', show: () => can('move') },
  { id: 'transfer', t: '매장 이동', show: () => can('move') },
  { id: 'records', t: '기록', show: () => !limited() },
  { id: 'sales', t: '매출', grp: '관리자', show: () => can('sales') },
  { id: 'settle', t: '정산', show: () => isOwner() },
  { id: 'admin', t: '관리', show: () => can('approve') || isOwner() },
];
function render() {
  const app = $('#app');
  if (!S.user || S.ui.showApply) { app.innerHTML = loginView(); bindLogin(); return; }
  const nav = NAV.filter(n => n.show());
  if (!nav.find(n => n.id === S.view)) S.view = 'home';
  const pendingN = S.users.filter(u => u.status === 'pending').length;
  const sv = S.stores.length === 1 ? storeName(S.stores[0]) : `${S.stores.length}개 매장`;
  app.innerHTML = `
  <header class="top">
    <button class="store-btn" id="storeBtn" aria-haspopup="true" aria-expanded="${S.ui.storeMenu}">
      <img src="logo-w.png" alt="SMG STORE"><span class="nm">${esc(sv)}</span><span class="car"></span>
    </button>
    <span class="sp"></span>
    ${S.mode === 'demo' ? '' : `<div class="who"><span class="nmx">${esc(S.user.name)} · ${esc(S.user.position)}</span><button class="btn sm" id="logout">로그아웃</button></div>`}
  </header>
  ${S.mode === 'demo' ? `<div class="demobar"><span class="demo-tag">미리보기</span><label for="roleSel">권한별로 보기</label><select id="roleSel">${DEMO_ROLES.map(r => `<option value="${r.uid}" ${S.user.uid === r.uid ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select><span class="muted hide-s">수원 실제 자료 · 저장한 내용은 새로고침하면 처음 상태로 돌아갑니다</span></div>` : ''}
  ${S.ui.storeMenu ? storeMenu() : ''}
  <div class="shell">
    <nav class="side" aria-label="메뉴">
      ${nav.map(n => `${n.grp ? `<div class="grp">${n.grp}</div>` : ''}<button data-nav="${n.id}" class="${S.view === n.id ? 'on' : ''}">${esc(n.t)}${n.id === 'admin' && pendingN && can('approve') ? `<span class="cnt">${pendingN}</span>` : ''}</button>`).join('')}
    </nav>
    <main><div class="page" id="page">${pageView()}</div></main>
  </div>
  <nav class="tabbar" aria-label="아래 메뉴">${tabbar(nav)}</nav>
  ${S.ui.drawer ? `<div class="ov" id="ov"><div class="dr" role="dialog" aria-modal="true">${S.ui.drawer()}</div></div>` : ''}
  ${S.ui.toast ? `<div class="toast" role="status">${esc(S.ui.toast)}</div>` : ''}`;
  bind();
}
function tabbar(nav) {
  const main = [{ id: 'home', t: '홈', i: 'home' }, { id: 'products', t: '상품', i: 'box' }];
  if (can('move')) main.push({ id: 'entry', t: '등록', i: 'plus' });
  if (can('count')) main.push({ id: 'count', t: '실사', i: 'check' });
  const rest = nav.filter(n => !main.find(m => m.id === n.id));
  const out = main.slice(0, 4);
  if (rest.length) out.push({ id: 'more', t: '더보기', i: 'more' });
  while (out.length < 5) out.push(null);
  return out.map(n => n ? `<button data-nav="${n.id}" class="${S.view === n.id || (n.id === 'more' && rest.find(r => r.id === S.view)) ? 'on' : ''}">${ic(n.i, 22)}<span>${n.t}</span></button>` : '<span></span>').join('');
}
function applyStoreOrder(order) {
  if (!Array.isArray(order) || !order.length) return;
  const pos = id => { const i = order.indexOf(id); return i < 0 ? 999 : i; };
  STORES.sort((a, b) => pos(a.id) - pos(b.id));
  S.stores = STORES.map(x => x.id).filter(x => S.stores.includes(x));
}
function moveStore(id, dir) {
  const i = STORES.findIndex(s => s.id === id), j = i + dir;
  if (j < 0 || j >= STORES.length) return;
  [STORES[i], STORES[j]] = [STORES[j], STORES[i]];
  S.stores = STORES.map(x => x.id).filter(x => S.stores.includes(x));
}
async function saveStoreOrder() {
  const order = STORES.map(s => s.id);
  try { localStorage.setItem('smg-store-order:' + (S.user ? S.user.uid : ''), JSON.stringify(order)); } catch (e) { }
  if (S.user) S.user.storeOrder = order;
  if (DB.saveStoreOrder) await DB.saveStoreOrder(order).catch(() => { });
}
function storeMenu() {
  const mine = myStores();
  if (S.ui.storeEdit) return `<div class="scrim" id="scrim"></div><div class="pop" role="dialog" aria-label="매장 순서 바꾸기">
    <h4>▲ ▼ 로 내 화면의 매장 순서를 바꿉니다 · 다른 사람에게는 영향 없음</h4>
    ${STORES.map((s, i) => `<div class="srow"><span class="num muted" style="width:18px;text-align:right">${i + 1}</span><span class="go" style="cursor:default"><span class="dot" style="background:${storeColor(s.id)}"></span>${esc(s.name)}</span>
      <button class="btn sm" data-mv="${s.id}:-1" ${i === 0 ? 'disabled' : ''} aria-label="${esc(s.name)} 위로">▲</button><button class="btn sm" data-mv="${s.id}:1" ${i === STORES.length - 1 ? 'disabled' : ''} aria-label="${esc(s.name)} 아래로">▼</button></div>`).join('')}
    <div class="foot"><button class="btn sm pri" id="smOrderDone">순서 저장</button></div></div>`;
  return `<div class="scrim" id="scrim"></div><div class="pop" role="dialog" aria-label="매장 선택">
    <h4>매장 이름을 누르면 그 매장으로 이동 · 체크하면 여러 매장 함께 보기</h4>
    ${STORES.map(s => {
      const ok = mine.includes(s.id);
      return `<div class="srow"${ok ? '' : ' style="opacity:.45"'}>
        <input type="checkbox" data-sc="${s.id}" ${S.stores.includes(s.id) ? 'checked' : ''} ${ok ? '' : 'disabled'} aria-label="${esc(s.name)} 함께 보기">
        <button class="go" data-sg="${s.id}" ${ok ? '' : 'disabled'}><span class="dot" style="background:${storeColor(s.id)}"></span>${esc(s.name)}</button>
        ${ok ? '' : '<span class="pill p-mute">권한 없음</span>'}</div>`;
    }).join('')}
    <div class="foot"><button class="btn sm" id="smOrder">순서 바꾸기</button><span style="flex:1"></span><button class="btn sm" id="smAll">권한 있는 매장 모두</button><button class="btn sm pri" id="smClose">닫기</button></div></div>`;
}
function pageView() {
  switch (S.view) {
    case 'home': return homeView();
    case 'products': return productsView();
    case 'entry': return entryView();
    case 'count': return countView();
    case 'transfer': return transferView();
    case 'records': return recordsView();
    case 'inbound': return inboundView();
    case 'sales': return salesView();
    case 'settle': return settleView();
    case 'admin': return adminView();
    case 'more': return moreView();
  }
  return '';
}
function head(t, sub, right = '') { return `<div class="ph"><div><h1>${esc(t)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="sp"></span>${right}</div>`; }
function toast(t) { S.ui.toast = t; render(); clearTimeout(toast._t); toast._t = setTimeout(() => { S.ui.toast = null; render(); }, 2600); }

/* ───────── 홈 ───────── */
function storeStats(st) {
  const m = S.stock[st] || {};
  let qty = 0, kinds = 0, out = 0, neg = 0;
  for (const [, q] of Object.entries(m)) { if (q > 0) { qty += q; kinds++; } else if (q === 0) out++; else neg++; }
  return { qty, kinds, out, neg };
}
function homeView() {
  const st = S.stores;
  const al = alerts(st);
  const tot = st.map(storeStats).reduce((a, b) => ({ qty: a.qty + b.qty, kinds: a.kinds + b.kinds, out: a.out + b.out, neg: a.neg + b.neg }), { qty: 0, kinds: 0, out: 0, neg: 0 });
  const recent = S.moves.filter(m => st.includes(m.store)).slice(-8).reverse();
  const multi = st.length > 1;
  let salesBlock = '';
  if (can('sales')) {
    const last = latestSalesDate(st);
    if (last) {
      const d = st.map(s => dayRec(s, last)).filter(Boolean);
      const s = d.reduce((a, b) => a + b.s, 0), p = d.reduce((a, b) => a + b.p, 0);
      const wk = st.map(x => dayRec(x, addDays(last, -7))).filter(Boolean).reduce((a, b) => a + b.s, 0);
      const ch = pct(s, wk);
      salesBlock = `<div class="tile"><span class="lb">매출 · ${md(last)}(${wd(last)})</span><span class="v big${String(fmt(s)).length>9?' long':''}">${fmt(s)}<small>원</small></span><span class="d ${ch == null ? 'muted' : ch >= 0 ? '' : ''}">${ch == null ? '지난주 같은 요일 자료 없음' : `${ch >= 0 ? '✔' : '🔺'} 지난주 같은 요일 대비 ${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%`} · ${fmt(p)}건</span></div>`;
    }
  }
  return `${head(multi ? `${st.length}개 매장 요약` : storeName(st[0]), `${S.asof} 마감 기준 · ${limited() ? '재고 수량만 볼 수 있는 계정입니다' : '재고는 입출고 기록으로 계산합니다'}`, installBtn('sm'))}
  <div class="tiles">
    <div class="tile"><span class="lb">현재 재고</span><span class="v big${String(fmt(tot.qty)).length>9?' long':''}">${fmt(tot.qty)}<small>개</small></span><span class="d muted">재고 있는 상품 ${fmt(tot.kinds)}종</span></div>
    <div class="tile"><span class="lb">품절 (재고 0)</span><span class="v big${String(fmt(tot.out)).length>9?' long':''}">${fmt(tot.out)}<small>종</small></span><span class="d muted">진열·품절 안내 확인</span></div>
    <div class="tile ${tot.neg ? 'alert' : ''}"><span class="lb">마이너스 재고</span><span class="v big${String(fmt(tot.neg)).length>9?' long':''}">${fmt(tot.neg)}<small>종</small></span><span class="d ${tot.neg ? '' : 'muted'}">${tot.neg ? '🔺 실사로 맞춰야 함' : '✔ 없음'}</span></div>
    ${salesBlock}
  </div>
  ${multi ? `<div class="card"><h2>매장별</h2><div class="tw"><table><thead><tr><th>매장</th><th class="n">현재 재고</th><th class="n">상품</th><th class="n">품절</th><th class="n">마이너스</th></tr></thead><tbody>
    ${st.map(s => { const x = storeStats(s); return `<tr><td class="nowrap"><span class="dot" style="background:${storeColor(s)};display:inline-block;margin-right:6px"></span>${esc(storeName(s))}</td><td class="n">${fmt(x.qty)}</td><td class="n">${fmt(x.kinds)}</td><td class="n">${fmt(x.out)}</td><td class="n ${x.neg ? 'qty-neg' : ''}">${fmt(x.neg)}</td></tr>`; }).join('')}
    <tr class="tot"><td>합계</td><td class="n">${fmt(tot.qty)}</td><td class="n">${fmt(tot.kinds)}</td><td class="n">${fmt(tot.out)}</td><td class="n">${fmt(tot.neg)}</td></tr></tbody></table></div>
    ${st.some(s => !Object.keys(S.stock[s] || {}).length) ? '<p class="muted" style="margin:8px 0 0;font-size:13px">상품이 아직 없는 매장은 입고를 등록하면 채워집니다.</p>' : ''}</div>` : ''}
  <div class="grid2">
    <div class="card"><h2>확인할 것 <span class="r">${al.length ? al.length + '건' : ''}</span></h2>
      ${al.length ? `<div class="alerts">${al.map((a, i) => `<div class="al"><span class="ic">${a.lv === 'bad' ? '🔺' : a.lv === 'warn' ? '🔸' : 'ℹ︎'}</span><span class="tx">${a.t}</span>${a.go && !limited() ? `<button class="btn sm" data-al="${i}">보기</button>` : ''}</div>`).join('')}</div>` : '<div class="empty">✔ 확인할 것이 없습니다</div>'}
    </div>
    ${limited() ? '' : `<div class="card"><h2>최근 입출고 <span class="r"><button class="btn sm" data-nav="records">전체 기록</button></span></h2>${movesTable(recent, true)}</div>`}
  </div>`;
}

/* ───────── 상품·재고 ───────── */
function productRows() {
  const q = norm(S.ui.q), st = S.stores;
  let rows = S.products.map(p => {
    const per = st.map(s => stockOf(s, p.id)); const t = per.reduce((a, b) => a + b, 0);
    const has = st.some(s => (S.stock[s] || {})[p.id] != null);
    return { p, per, t, has };
  }).filter(r => r.has || S.ui.f === 'allp');
  if (q) rows = rows.filter(r => norm(r.p.name).includes(q) || (r.p.barcode || '').includes(S.ui.q.trim()) || norm(r.p.sku).includes(q) || norm(r.p.ip).includes(q));
  if (S.ui.ip) rows = rows.filter(r => r.p.ip === S.ui.ip);
  if (S.ui.f === 'out') rows = rows.filter(r => r.t === 0);
  if (S.ui.f === 'neg') rows = rows.filter(r => r.t < 0 || r.per.some(x => x < 0));
  if (S.ui.f === 'in') rows = rows.filter(r => r.t > 0);
  rows.sort((a, b) => (a.p.ip || '').localeCompare(b.p.ip || '', 'ko') || a.p.name.localeCompare(b.p.name, 'ko'));
  return rows;
}
function productsView() {
  const rows = productRows(); const st = S.stores; const multi = st.length > 1;
  const ips = [...new Set(S.products.filter(p => st.some(s => (S.stock[s] || {})[p.id] != null)).map(p => p.ip))].sort((a, b) => a.localeCompare(b, 'ko'));
  const shown = rows.slice(0, 300);
  return `${head('상품·재고', `${fmt(rows.length)}종 · 이름·바코드·품번·IP로 찾기`, `<button class="btn" id="scanBtn">${ic('scan')} 바코드 스캔</button>`)}
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="row"><div class="search">${ic('search')}<input class="inp" id="pq" type="search" placeholder="상품명, 바코드, 품번, IP" value="${esc(S.ui.q)}" autocomplete="off"></div>
      <select class="inp" id="pip" style="width:auto;min-width:160px" aria-label="IP"><option value="">IP 전체</option>${ips.map(i => `<option ${S.ui.ip === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select></div>
    <div class="chips">${[['all', '재고 등록 상품'], ['in', '재고 있음'], ['out', '품절'], ['neg', '마이너스']].map(([k, t]) => `<button class="chip ${S.ui.f === k ? 'on' : ''}" data-pf="${k}">${t}</button>`).join('')}</div>
  </div>
  <div class="card" style="padding:8px 12px">
    ${rows.length ? `<div class="tw"><table><thead><tr><th>상품명</th><th class="hide-s">IP</th><th class="hide-s">바코드·품번</th>${multi ? st.map(s => `<th class="n">${esc(storeName(s))}</th>`).join('') : ''}<th class="n">${multi ? '합계' : '재고'}</th><th class="hide-s">상태</th></tr></thead><tbody>
      ${shown.map(r => `<tr class="click" data-pid="${esc(r.p.id)}"><td class="nm">${esc(r.p.name)}</td><td class="hide-s nowrap">${esc(r.p.ip)}</td><td class="code hide-s">${esc(r.p.barcode || r.p.sku)}</td>
        ${multi ? r.per.map(x => `<td class="n ${x < 0 ? 'qty-neg' : x === 0 ? 'qty-zero' : ''}">${fmt(x)}</td>`).join('') : ''}<td class="n big ${r.t < 0 ? 'qty-neg' : r.t === 0 ? 'qty-zero' : ''}" style="font-size:16px">${fmt(r.t)}</td><td class="hide-s">${statusPill(r.t)}</td></tr>`).join('')}
    </tbody></table></div>${rows.length > 300 ? `<p class="muted" style="font-size:13px">앞 300종만 보여 줍니다. 검색으로 좁혀 주세요.</p>` : ''}` : '<div class="empty">찾는 상품이 없습니다</div>'}
  </div>`;
}
function statusPill(t) { return t < 0 ? '<span class="pill p-bad">🔺 마이너스</span>' : t === 0 ? '<span class="pill p-mute">품절</span>' : t <= 3 ? '<span class="pill p-warn">🔸 3개 이하</span>' : '<span class="pill p-ok">정상</span>'; }
function productDrawer(pid) {
  const p = S.P[pid]; if (!p) return '';
  const rows = STORES.filter(s => myStores().includes(s.id)).map(s => ({ s, q: stockOf(s.id, pid), has: (S.stock[s.id] || {})[pid] != null }));
  const mv = limited() ? [] : S.moves.filter(m => m.pid === pid && myStores().includes(m.store)).slice(-30).reverse();
  return `<div class="hd"><div><div class="muted" style="font-size:12px">${esc(p.ip)}${p.cat ? ' · ' + esc(p.cat) : ''}</div><h3>${esc(p.name)}</h3></div><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card"><dl class="kv"><dt>바코드</dt><dd class="num" style="text-align:left">${esc(p.barcode || '-')}</dd><dt>품번</dt><dd>${esc(p.sku || '-')}</dd>${!limited() && p.price ? `<dt>판매가</dt><dd>${won(p.price)}</dd>` : ''}${S.warehouse[pid] ? `<dt>창고 보관</dt><dd>${fmt(S.warehouse[pid])}개</dd>` : ''}${S.places.filter(pl => (pl.q || {})[pid]).map(pl => `<dt>외부 · ${esc(pl.kind)}</dt><dd>${esc(placeLabel(pl))} — ${fmt(pl.q[pid])}개</dd>`).join('')}</dl></div>
  <div class="card"><h2>매장별 재고</h2><table><tbody>${rows.map(r => `<tr><td class="nowrap"><span class="dot" style="background:${storeColor(r.s.id)};display:inline-block;margin-right:6px"></span>${esc(r.s.name)}</td><td class="n big ${r.q < 0 ? 'qty-neg' : ''}" style="font-size:18px">${r.has ? fmt(r.q) : '-'}</td><td style="width:1%">${r.has ? statusPill(r.q) : '<span class="pill p-mute">미등록</span>'}</td></tr>`).join('')}</tbody></table></div>
  ${can('move') ? `<div class="row"><button class="btn pri" data-quick="입고" data-qp="${esc(pid)}">입고 등록</button><button class="btn" data-quick="매장 이동" data-qp="${esc(pid)}">매장 이동</button>${can('count') ? `<button class="btn" data-quick="count" data-qp="${esc(pid)}">실사 입력</button>` : ''}</div>` : ''}
  ${limited() ? '' : `<div class="card"><h2>입출고 기록 <span class="r">최근 30건</span></h2>${movesTable(mv, false, true)}</div>`}`;
}
function movesTable(list, withName = true, compact = false) {
  if (!list.length) return '<div class="empty">기록이 없습니다</div>';
  return `<div class="tw"><table><thead><tr><th>날짜</th>${S.stores.length > 1 || compact ? '<th>매장</th>' : ''}<th>구분</th>${withName ? '<th>상품명</th>' : ''}<th class="n">수량</th><th class="hide-s">메모</th></tr></thead><tbody>
  ${list.map(m => `<tr><td class="nowrap num" style="text-align:left">${md(m.date)}</td>${S.stores.length > 1 || compact ? `<td class="nowrap">${esc(storeName(m.store).replace('SMG STORE_', '').replace('SMG MUSEUM_', ''))}</td>` : ''}<td>${typePill(m.type)}</td>${withName ? `<td class="nm">${esc((S.P[m.pid] || {}).name || m.pid)}</td>` : ''}<td class="n ${m.qty < 0 ? 'qty-neg' : ''}" style="font-weight:600">${m.qty > 0 ? '+' : ''}${fmt(m.qty)}</td><td class="hide-s muted" style="font-size:12px">${esc(m.memo || '')}${m.by && !/claude/i.test(m.by) ? ` · ${esc(m.by)}` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function typePill(t) { const pos = ['입고', '창고에서 가져옴', '매장 이동(받음)']; return `<span class="pill ${t === COUNT_TYPE ? 'p-info' : pos.includes(t) ? 'p-ok' : t === '판매' ? 'p-mute' : 'p-warn'}">${esc(t)}</span>`; }

/* ───────── 외부 장소 ───────── */
const placeById = id => S.places.find(p => p.id === id);
function placeLabel(p) {
  if (!p) return '';
  const per = p.start ? ` · ${p.start.slice(2).replace(/-/g, '.')}${p.end && p.end !== p.start ? '~' + p.end.slice(5).replace('-', '.') : ''}` : '';
  return `${p.name}${p.addr ? ' · ' + p.addr : ''}${per}`;
}
function placeQty(p) { return Object.values(p.q || {}).reduce((a, b) => a + b, 0); }
function placeDrawer() {
  const f = S.ui.placeForm ||= { name: '', kind: '행사장', start: today(), end: today(), addr: '', person: '', memo: '' };
  const dup = S.places.filter(p => norm(p.name) === norm(f.name) && f.name.trim());
  return `<div class="hd"><h3>외부 장소 등록</h3><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label for="plName">장소·행사 이름</label><input class="inp" id="plName" value="${esc(f.name)}" placeholder="예: 코믹월드 338"></div>
    <div class="field"><label>구분</label><div class="chips">${PLACE_KINDS.map(k => `<button class="chip ${f.kind === k ? 'on' : ''}" data-plk="${k}">${k}</button>`).join('')}</div></div>
    <div class="formgrid"><div class="field"><label for="plStart">시작일</label><input class="inp" type="date" id="plStart" value="${f.start}"></div><div class="field"><label for="plEnd">종료일</label><input class="inp" type="date" id="plEnd" value="${f.end}"></div></div>
    <div class="field"><label for="plAddr">장소 · 위치</label><input class="inp" id="plAddr" value="${esc(f.addr)}" placeholder="예: 수원메쎄 B홀, 부스 A-12"></div>
    <div class="formgrid"><div class="field"><label for="plPerson">현장 담당자</label><input class="inp" id="plPerson" value="${esc(f.person)}" placeholder="이름"></div><div class="field"><label for="plMemo">메모</label><input class="inp" id="plMemo" value="${esc(f.memo)}"></div></div>
    ${dup.length ? `<div class="note warn">🔸 같은 이름의 장소가 이미 ${dup.length}곳 있습니다: ${dup.map(p => esc(placeLabel(p))).join(' / ')}<br>날짜·위치가 다르면 새로 등록하고, 같은 곳이면 목록에서 고르세요.</div>` : ''}
  </div>
  <div class="row" style="justify-content:flex-end"><button class="btn" data-close>취소</button><button class="btn pri" id="plSave" ${f.name.trim() && f.start ? '' : 'disabled'}>장소 등록</button></div>`;
}
async function savePlace() {
  const f = S.ui.placeForm; const n = S.places.filter(p => p.start === f.start).length + 1;
  const id = 'P' + f.start.replace(/-/g, '').slice(2) + '-' + String(n).padStart(2, '0') + Math.random().toString(36).slice(2, 5);
  const p = { id, name: f.name.trim(), kind: f.kind, start: f.start, end: f.end || f.start, addr: f.addr.trim(), person: f.person.trim(), memo: f.memo.trim(), q: {}, by: S.user.name, at: new Date().toISOString() };
  if (DB.savePlace) await DB.savePlace(p);
  S.places.push(p); S.ui.placeForm = null; S.ui.drawer = null;
  const e = S.ui.entry; if (e) { if (e.type === '외부에서 돌아옴') e.from = id; else e.place = id; }
  toast('장소를 등록했습니다');
}
function placeSelect(id, val, label) {
  const list = S.places.slice().sort((a, b) => (b.start || '').localeCompare(a.start || ''));
  return `<div class="field" style="grid-column:span 2;min-width:0"><label for="${id}">${label}</label><div class="row"><select class="inp" id="${id}" style="flex:1 1 220px;min-width:0"><option value="">${list.length ? '등록된 장소에서 고르기' : '등록된 장소가 없습니다 → 새 장소 등록'}</option>${list.map(p => `<option value="${p.id}" ${val === p.id ? 'selected' : ''}>[${esc(p.kind)}] ${esc(placeLabel(p))}${placeQty(p) ? ` · 남은 ${fmt(placeQty(p))}개` : ''}</option>`).join('')}</select><button class="btn" id="plNew">새 장소 등록</button></div>
  ${val && placeById(val) ? `<div class="note" style="margin-top:4px"><b>[${esc(placeById(val).kind)}] ${esc(placeLabel(placeById(val)))}</b><br><span class="muted" style="font-size:12px">장소 번호 ${esc(val)}${placeById(val).person ? ' · 담당 ' + esc(placeById(val).person) : ''}${placeQty(placeById(val)) ? ' · 지금 그곳에 ' + fmt(placeQty(placeById(val))) + '개' : ''}</span></div>` : ''}</div>`;
}

/* ───────── 입고 예정 → 실제 입고 → 차이 ───────── */
function readTable(rows, qtyPref) {
  const det = detectCols(rows, qtyPref);
  if (!det || det.map.qty == null || (det.map.name == null && det.map.barcode == null && det.map.sku == null)) return { err: '수량 칸과 상품 칸(상품명·바코드·품번 중 하나)을 찾지 못했습니다. 첫 줄에 "상품명", "수량" 같은 제목이 있는지 확인해 주세요.' };
  const m = det.map; const out = [];
  for (let i = det.r + 1; i < rows.length; i++) {
    const r = rows[i]; const g = k => m[k] != null ? String(r[m[k]] ?? '').trim().replace(/^'/, '') : '';
    const name = g('name'), bc = g('barcode'), sku = g('sku');
    if (!name && !bc && !sku) continue;
    if (/^(합계|총계|소계|total)/i.test(name) && !bc && !sku) continue;
    const num = v => { const n = Number(String(v).replace(/[,원\s]/g, '')); return isNaN(n) ? null : n; };
    let cand = bc ? findProduct(bc) : []; if (!cand.length && sku) cand = findProduct(sku); if (!cand.length && name) cand = S.byName[norm(name)] || [];
    out.push({ line: i + 1, name, bc, sku, qty: num(g('qty')), price: num(g('price')), ip: g('ip'), pid: cand.length === 1 ? cand[0].id : '', multi: cand.length > 1 });
  }
  return { rows: out, header: det.r + 1 };
}
async function fileRows(f) {
  if (/\.(pdf|png|jpe?g|heic|gif|webp)$/i.test(f.name)) throw new Error('PDF·사진은 입력할 수 없습니다. 엑셀이나 구글시트로 받아 주세요.');
  const wb = await readBook(f);
  let best = null;
  for (const n of wb.SheetNames) { const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }); const d = detectCols(rows); if (d && (!best || d.score > best.d.score)) best = { n, rows, d }; }
  return { rows: best ? best.rows : [], src: f.name + (best && wb.SheetNames.length > 1 ? ' › ' + best.n : '') };
}
async function linkRows(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); const g = url.match(/[#&?]gid=(\d+)/);
  if (!m) throw new Error('구글시트 링크가 아닙니다.');
  if (S.mode === 'demo') throw new Error('미리보기 화면에서는 외부 링크를 열 수 없습니다. 실제 앱에서는 "링크가 있는 모든 사용자" 공유 시트를 바로 읽습니다.');
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${g ? '&gid=' + g[1] : ''}`); if (!r.ok) throw new Error('시트를 열지 못했습니다. 공유를 "링크가 있는 모든 사용자 · 뷰어"로 바꿔 주세요.');
  const wb = XLSX.read(await r.text(), { type: 'string' }); return { rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }), src: '구글시트' };
}
const itemKey = r => r.pid ? 'p:' + r.pid : 'n:' + (r.bc || r.sku || norm(r.name));
function ibStats(ib) {
  const it = ib.items; const plan = it.reduce((a, b) => a + (b.plan || 0), 0);
  const done = it.filter(x => x.actual != null); const act = done.reduce((a, b) => a + b.actual, 0) + (ib.extra || []).reduce((a, b) => a + (b.actual || 0), 0);
  const diff = it.filter(x => x.actual != null && x.actual !== x.plan).length + (ib.extra || []).length;
  const money = k => it.reduce((a, b) => a + (b.price || 0) * ((k === 'plan' ? b.plan : b.actual) || 0), 0) + (k === 'act' ? (ib.extra || []).reduce((a, b) => a + (b.price || 0) * (b.actual || 0), 0) : 0);
  return { plan, act, done: done.length, left: it.length - done.length, diff, planMoney: money('plan'), actMoney: money('act') };
}
function inboundView() {
  const list = S.inbounds.filter(x => S.stores.includes(x.store)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (S.ui.ib === 'new') return ibNewView();
  const ib = S.inbounds.find(x => x.id === S.ui.ib);
  if (ib) return ibDetailView(ib);
  const pill = ib => ib.status === 'received' ? (ibStats(ib).diff ? '<span class="pill p-warn">🔸 입고 완료 · 차이 있음</span>' : '<span class="pill p-ok">✔ 입고 완료</span>') : ibStats(ib).done ? '<span class="pill p-info">확인 중</span>' : '<span class="pill p-mute">입고 예정</span>';
  return `${head('입고 확인', '보내는 상품 리스트를 예정으로 등록 → 실제 입고 파일·수량 입력 → 차이를 자동 계산', `<button class="btn pri" id="ibNew">입고 예정 등록</button>`)}
  ${list.length ? `<div class="card" style="padding:8px 12px"><div class="tw"><table><thead><tr><th>예정일</th><th>내용</th><th class="hide-s">매장</th><th class="n">예정</th><th class="n">실제</th><th class="n">차이</th><th>상태</th></tr></thead><tbody>
  ${list.map(ib => { const st = ibStats(ib); return `<tr class="click" data-ib="${ib.id}"><td class="num nowrap" style="text-align:left">${ib.date ? md(ib.date) : '-'}</td><td class="nm"><b>${esc(ib.title)}</b><div class="muted" style="font-size:12px">${esc([ib.ip, ib.from].filter(Boolean).join(' · '))} · ${ib.items.length}종</div></td><td class="hide-s nowrap">${esc(storeName(ib.store))}</td><td class="n">${fmt(st.plan)}</td><td class="n">${st.done ? fmt(st.act) : '-'}</td><td class="n" style="font-weight:700">${st.done ? fmt(st.act - st.plan) : '-'}</td><td>${pill(ib)}</td></tr>`; }).join('')}
  </tbody></table></div></div>` : '<div class="card"><div class="empty">입고 예정이 없습니다. 보내는 쪽에서 받은 상품 리스트 파일로 [입고 예정 등록]을 해 주세요.</div></div>'}`;
}
function ibNewView() {
  const f = S.ui.ibForm ||= { store: S.stores[0], date: today(), title: '', ip: '', from: '', parsed: null, src: '', err: '' };
  const P = f.parsed;
  return `${head('입고 예정 등록', '보내는 쪽에서 받은 상품 리스트(엑셀·CSV·구글시트)를 올리면 예정 수량으로 등록합니다. 재고에는 아직 더하지 않습니다.', '<button class="btn" id="ibBack">목록으로</button>')}
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="formgrid">
      <div class="field"><label for="ibStore">받는 매장</label><select class="inp" id="ibStore">${myStores().map(s => `<option value="${s}" ${f.store === s ? 'selected' : ''}>${esc(storeName(s))}</option>`).join('')}</select></div>
      <div class="field"><label for="ibDate">입고 예정일</label><input class="inp" type="date" id="ibDate" value="${f.date}"></div>
      <div class="field"><label for="ibFrom">보내는 곳</label><input class="inp" id="ibFrom" value="${esc(f.from)}" placeholder="예: SMG 홀딩스 물류"></div>
      <div class="field"><label for="ibIp">IP (선택)</label><input class="inp" id="ibIp" value="${esc(f.ip)}" placeholder="예: 진격의 거인"></div>
      <div class="field" style="grid-column:1/-1"><label for="ibTitle">제목</label><input class="inp" id="ibTitle" value="${esc(f.title)}" placeholder="비워 두면 파일 이름으로 들어갑니다"></div>
    </div>
    <div class="row"><button class="btn" id="ibPlanFile">상품 리스트 파일 고르기</button><input class="inp" id="ibPlanLink" placeholder="또는 구글시트 링크" style="flex:1;min-width:200px"><button class="btn" id="ibPlanLinkGo">링크 열기</button></div>
    ${f.err ? `<div class="note bad">🔺 ${esc(f.err)}</div>` : ''}
  </div>
  ${P ? (() => { const known = P.filter(r => r.pid).length, nw = P.filter(r => !r.pid).length, noq = P.filter(r => !(r.qty > 0)).length; const dupK = {}; P.forEach(r => { const k = itemKey(r); dupK[k] = (dupK[k] || 0) + 1; });
    const dups = Object.values(dupK).filter(v => v > 1).length;
    return `<div class="card"><h2>미리보기 · ${esc(f.src)} <span class="r">${P.length}줄 · ${fmt(P.reduce((a, b) => a + (b.qty || 0), 0))}개${P.some(r => r.price) ? ` · ${won(P.reduce((a, b) => a + (b.price || 0) * (b.qty || 0), 0))}` : ''}</span></h2>
    <div class="alerts" style="margin-bottom:10px"><div class="al"><span class="ic">✔</span><span class="tx">등록된 상품 <b>${known}</b>종</span></div>
    ${nw ? `<div class="al"><span class="ic">🔸</span><span class="tx">처음 보는 상품 <b>${nw}</b>종 — 입고를 확정할 때 상품 목록에 새로 등록됩니다.</span></div>` : ''}
    ${noq ? `<div class="al"><span class="ic">🔺</span><span class="tx">수량이 비었거나 0인 줄 <b>${noq}</b>개</span></div>` : ''}
    ${dups ? `<div class="al"><span class="ic">🔸</span><span class="tx">같은 상품이 두 번 나온 경우 <b>${dups}</b>건 — 수량을 합쳐서 등록합니다.</span></div>` : ''}</div>
    <div class="tw"><table><thead><tr><th class="n">줄</th><th>상품명</th><th class="hide-s">바코드·품번</th><th class="n">예정 수량</th><th class="n hide-s">가격</th><th>상태</th></tr></thead><tbody>
    ${P.map(r => `<tr class="${!r.pid || !(r.qty > 0) || dupK[itemKey(r)] > 1 ? 'flag' : ''}"><td class="n muted">${r.line}</td><td class="nm">${esc(r.pid ? S.P[r.pid].name : r.name)}</td><td class="code hide-s">${esc(r.bc || r.sku)}</td><td class="n" style="font-weight:700">${fmt(r.qty)}</td><td class="n hide-s">${r.price ? fmt(r.price) : '-'}</td><td>${!(r.qty > 0) ? '<span class="pill p-bad">🔺 수량</span>' : r.pid ? '<span class="pill p-ok">✔</span>' : '<span class="pill p-warn">🔸 새 상품</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn pri" id="ibCreate">입고 예정으로 등록</button></div></div>`; })() : ''}`;
}
function ibDetailView(ib) {
  const st = ibStats(ib); const done = ib.status === 'received';
  const rows = ib.items.map((x, i) => ({ ...x, i, d: x.actual == null ? null : x.actual - x.plan }));
  return `${head(ib.title, `${esc(storeName(ib.store))} · 예정일 ${ib.date || '-'}${ib.from ? ' · ' + esc(ib.from) : ''}${ib.ip ? ' · ' + esc(ib.ip) : ''}`, '<button class="btn" id="ibBack">목록으로</button>')}
  <div class="tiles">
    <div class="tile"><span class="lb">예정</span><span class="v big">${fmt(st.plan)}<small>개</small></span><span class="d muted">${ib.items.length}종${st.planMoney ? ' · ' + man(st.planMoney) + '원' : ''}</span></div>
    <div class="tile"><span class="lb">실제 입고</span><span class="v big">${st.done ? fmt(st.act) : '-'}<small>개</small></span><span class="d muted">확인 ${st.done}종 · 남은 ${st.left}종</span></div>
    <div class="tile ${st.diff ? 'alert' : ''}"><span class="lb">차이</span><span class="v big">${st.done ? (st.act - st.plan > 0 ? '+' : '') + fmt(st.act - st.plan) : '-'}<small>개</small></span><span class="d">${st.diff ? `🔸 다른 상품 ${st.diff}종` : st.done ? '✔ 차이 없음' : ''}</span></div>
  </div>
  ${done ? `<div class="note">✔ ${esc(ib.receivedAt || '')} ${esc(ib.receivedBy || '')} 입고 확정 — 실제 수량으로 재고에 더했습니다.</div>` : `<div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>실제 입고 수량 넣기</h2>
    <div class="row"><button class="btn" id="ibActFile">실제 입고 파일 고르기</button><input class="inp" id="ibActLink" placeholder="또는 구글시트 링크 (직원 입력 시트 등)" style="flex:1;min-width:200px"><button class="btn" id="ibActLinkGo">링크 열기</button><button class="btn" id="scanBtn">${ic('scan')} 스캔</button></div>
    <span class="muted" style="font-size:12px">파일의 "실제 수량" 칸을 먼저 찾고, 없으면 "수량" 칸을 씁니다. 아래 표에서 직접 고쳐도 됩니다. 스캔하면 그 상품 실제 수량이 1씩 올라갑니다.</span>
    ${S.ui.ibMsg ? `<div class="note ${S.ui.ibMsg.bad ? 'bad' : ''}">${esc(S.ui.ibMsg.t)}</div>` : ''}</div>`}
  <div class="card"><h2>상품별 예정 · 실제 · 차이 <span class="r">차이 있는 줄은 주황색</span></h2>
    <div class="chips" style="margin-bottom:8px">${[['all', '전체'], ['diff', '차이 있음'], ['left', '아직 안 넣음']].map(([k, t]) => `<button class="chip ${(S.ui.ibF || 'all') === k ? 'on' : ''}" data-ibf="${k}">${t}</button>`).join('')}</div>
    <div class="tw"><table><thead><tr><th>상품명</th><th class="hide-s">바코드·품번</th><th class="n">예정</th><th class="n">실제</th><th class="n">차이</th><th class="n hide-s">차이 금액</th></tr></thead><tbody>
    ${rows.filter(r => S.ui.ibF === 'diff' ? r.d : S.ui.ibF === 'left' ? r.actual == null : true).map(r => `<tr class="${r.d ? 'flag' : ''}"><td class="nm">${esc(r.name)}${r.pid ? '' : '<div style="font-size:12px;color:var(--warn)">🔸 새 상품 — 확정 때 등록</div>'}</td><td class="code hide-s">${esc(r.code)}</td><td class="n">${fmt(r.plan)}</td>
      <td class="n">${done ? fmt(r.actual) : `<input class="inp qty" type="number" inputmode="numeric" min="0" value="${r.actual ?? ''}" data-iba="${r.i}" aria-label="실제 수량">`}</td>
      <td class="n" style="font-weight:700">${r.d == null ? '' : r.d === 0 ? '<span class="muted">0</span>' : `<span style="color:${r.d < 0 ? 'var(--bad)' : 'var(--ok)'}">${r.d > 0 ? '+' : ''}${fmt(r.d)}</span>`}</td><td class="n hide-s">${r.d && r.price ? fmt(r.d * r.price) : ''}</td></tr>`).join('')}
    ${(ib.extra || []).map(r => `<tr class="flag"><td class="nm">${esc(r.name)}<div style="font-size:12px;color:var(--warn)">🔸 예정에 없던 상품</div></td><td class="code hide-s">${esc(r.code)}</td><td class="n">0</td><td class="n">${fmt(r.actual)}</td><td class="n" style="font-weight:700;color:var(--ok)">+${fmt(r.actual)}</td><td class="n hide-s">${r.price ? fmt(r.actual * r.price) : ''}</td></tr>`).join('')}
    <tr class="tot"><td>합계</td><td class="hide-s"></td><td class="n">${fmt(st.plan)}</td><td class="n">${st.done ? fmt(st.act) : '-'}</td><td class="n">${st.done ? fmt(st.act - st.plan) : '-'}</td><td class="n hide-s">${st.done && (st.actMoney || st.planMoney) ? fmt(st.actMoney - st.planMoney) : ''}</td></tr>
    </tbody></table></div>
    ${done ? '' : `<div class="row" style="justify-content:flex-end;margin-top:12px">${st.left ? `<span class="muted" style="font-size:13px">🔸 아직 안 넣은 ${st.left}종은 확정하면 0개로 처리됩니다</span>` : ''}<button class="btn pri" id="ibConfirm" ${st.done || (ib.extra || []).length ? '' : 'disabled'}>실제 수량으로 입고 확정</button></div>`}
  </div>`;
}
function ibApplyActual(ib, rows, src) {
  const byKey = {}; ib.items.forEach((x, i) => { byKey[x.key] = i; });
  let matched = 0, extra = 0;
  const add = {}; for (const r of rows) { if (!(r.qty >= 0) || r.qty === null) continue; const k = itemKey(r); add[k] = (add[k] || { r, q: 0 }); add[k].q += r.qty; }
  for (const [k, { r, q }] of Object.entries(add)) {
    let i = byKey[k];
    if (i == null && r.name) i = ib.items.findIndex(x => norm(x.name) === norm(r.name));
    if (i != null && i >= 0) { ib.items[i].actual = q; matched++; }
    else { ib.extra = (ib.extra || []).filter(x => x.key !== k); ib.extra.push({ key: k, pid: r.pid, name: r.pid ? S.P[r.pid].name : r.name, code: r.bc || r.sku, bc: r.bc, sku: r.sku, ip: r.ip, actual: q, price: r.price }); extra++; }
  }
  S.ui.ibMsg = { t: `${src}: 예정 상품 ${matched}종 수량을 넣었습니다${extra ? ` · 예정에 없던 상품 ${extra}종` : ''}.` };
}
function ibPlanLoaded(x) { const f = S.ui.ibForm; const t = readTable(x.rows, QTY_PLAN); f.err = t.err || ''; f.parsed = t.rows || null; f.src = x.src; if (!f.title) f.title = x.src.replace(/\.(xlsx|xls|csv)( › .*)?$/i, ''); render(); }
function ibActLoaded(ib, x) { const t = readTable(x.rows, QTY_ACTUAL); if (t.err) { S.ui.ibMsg = { t: '🔺 ' + t.err, bad: true }; render(); return; } ibApplyActual(ib, t.rows, x.src); if (DB.saveInbound) DB.saveInbound(ib); render(); }
async function ibCreate() {
  const f = S.ui.ibForm; const items = {};
  for (const r of f.parsed) { if (!(r.qty > 0)) continue; const k = itemKey(r); const x = items[k] ||= { key: k, pid: r.pid, name: r.pid ? S.P[r.pid].name : r.name, code: r.bc || r.sku || (r.pid ? (S.P[r.pid].barcode || S.P[r.pid].sku) : ''), bc: r.bc, sku: r.sku, plan: 0, price: r.price || (r.pid ? S.P[r.pid].price : null) || null, ip: r.ip || f.ip || '', actual: null }; x.plan += r.qty; }
  const ib = { id: 'IB-' + f.date.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), store: f.store, date: f.date, title: f.title.trim() || f.src, ip: f.ip.trim(), from: f.from.trim(), status: 'planned', items: Object.values(items), extra: [], by: S.user.name, at: new Date().toISOString() };
  if (DB.saveInbound) await DB.saveInbound(ib);
  S.inbounds.push(ib); S.ui.ibForm = null; S.ui.ib = ib.id; toast(`입고 예정 ${ib.items.length}종을 등록했습니다`);
}
async function ibConfirm(ib) {
  const lines = [...ib.items.map(x => ({ ...x, q: x.actual || 0 })), ...(ib.extra || []).map(x => ({ ...x, q: x.actual || 0, plan: 0 }))];
  for (const l of lines) if (!l.pid && l.q > 0) {   // 처음 보는 상품은 목록에 등록
    const id = l.bc || l.sku || ('N' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    if (!S.P[id]) { const p = { id, sku: /^\d{8,14}$/.test(id) ? '' : (l.sku || id), barcode: /^\d{8,14}$/.test(id) ? id : (l.bc || ''), name: l.name, ip: l.ip || ib.ip || '미분류', cat: '', price: l.price || null, kind: ib.ip ? '팝업' : '상설' }; S.products.push(p); if (DB.saveProduct) await DB.saveProduct(p); }
    l.pid = id;
  }
  indexProducts();
  const at = new Date().toISOString();
  const moves = lines.filter(l => l.q > 0).map((l, i) => ({ id: 'ib' + Date.now().toString(36) + i, date: today(), store: ib.store, type: '입고', pid: l.pid, qty: l.q, memo: `${ib.title} · 예정 ${fmt(l.plan)}${l.q !== l.plan ? ` · 차이 ${l.q - l.plan > 0 ? '+' : ''}${fmt(l.q - l.plan)}` : ''}`, by: S.user.name, at }));
  await DB.saveMoves(moves);
  for (const m of moves) { S.moves.push(m); (S.stock[m.store] ||= {})[m.pid] = stockOf(m.store, m.pid) + m.qty; }
  ib.items.forEach(x => { if (x.actual == null) x.actual = 0; if (!x.pid) { const l = lines.find(y => y.key === x.key); if (l) x.pid = l.pid; } });
  ib.status = 'received'; ib.receivedAt = today(); ib.receivedBy = S.user.name;
  if (DB.saveInbound) await DB.saveInbound(ib);
  toast(`입고 확정: ${moves.length}종 ${fmt(moves.reduce((a, b) => a + b.qty, 0))}개를 재고에 더했습니다`);
}

/* ───────── 입출고 등록 ───────── */
function newEntry(type = '입고') { return { type, date: today(), store: S.stores[0], to: '', partner: '', memo: '', lines: [], mode: 'hand' }; }
function entryView() {
  const e = S.ui.entry ||= newEntry();
  const T = TYPES.find(t => t.id === e.type);
  const okStores = myStores();
  return `${head('입출고 등록', '종류를 고르고 상품을 스캔·검색해서 수량을 넣습니다')}
  <div class="card" style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label>종류</label><div class="chips">${TYPES.map(t => `<button class="chip ${e.type === t.id ? 'on' : ''}" data-et="${t.id}">${t.id}</button>`).join('')}</div><span class="muted" style="font-size:12px">${esc(T.d)}</span></div>
    <div class="formgrid">
      <div class="field"><label for="eDate">날짜</label><input class="inp" type="date" id="eDate" value="${e.date}"></div>
      <div class="field"><label for="eStore">${T.to ? '보내는 매장' : '매장'}</label><select class="inp" id="eStore">${okStores.map(s => `<option value="${s}" ${e.store === s ? 'selected' : ''}>${esc(storeName(s))}</option>`).join('')}</select></div>
      ${T.to ? `<div class="field"><label for="eTo">받는 곳</label><select class="inp" id="eTo"><option value="">선택</option>${STORES.filter(s => s.id !== e.store).map(s => `<option value="${s.id}" ${e.to === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}<option value="__custom" ${e.to === '__custom' ? 'selected' : ''}>외부 장소 (행사장·팝업 등)</option></select></div>
      ${e.to === '__custom' ? placeSelect('ePlace', e.place, '외부 장소') : ''}` : ''}
      ${T.from ? placeSelect('eFrom', e.from, '돌아온 곳 (외부 장소)') : ''}
      ${T.partner ? `<div class="field"><label for="ePartner">${e.type === '반품' ? '반품처' : '받는 업체'}</label><input class="inp" id="ePartner" value="${esc(e.partner)}" placeholder="업체 이름"></div>` : ''}
      <div class="field" style="grid-column:span 2;min-width:0"><label for="eMemo">메모</label><input class="inp" id="eMemo" value="${esc(e.memo)}" placeholder="예: 10/21 출고리스트, 파손 사유"></div>
    </div>
    <div class="seg" role="tablist"><button class="${e.mode === 'hand' ? 'on' : ''}" data-em="hand">직접 입력·스캔</button><button class="${e.mode === 'file' ? 'on' : ''}" data-em="file">파일·링크로 올리기</button></div>
    ${e.mode === 'hand' ? `<div class="row"><div class="search">${ic('search')}<input class="inp" id="eq" placeholder="상품명·바코드·품번 입력 후 Enter" autocomplete="off"></div><button class="btn" id="scanBtn2">${ic('scan')} 스캔</button></div><div id="eSug"></div>` : importBox()}
  </div>
  ${e.mode === 'hand' ? entryLines(e) : importPreview()}`;
}
function entryLines(e) {
  if (!e.lines.length) return `<div class="card"><div class="empty">상품을 추가하면 여기에 쌓입니다. 같은 상품을 두 번 넣으면 수량이 합쳐집니다.</div></div>`;
  const T = TYPES.find(t => t.id === e.type);
  const issues = lineIssues(e);
  return `<div class="card"><h2>${esc(e.type)} 목록 <span class="r">${e.lines.length}종 · ${fmt(e.lines.reduce((a, b) => a + (+b.qty || 0), 0))}개</span></h2>
    ${issues.length ? `<div class="alerts" style="margin-bottom:10px">${issues.map(x => `<div class="al"><span class="ic">${x.lv === 'bad' ? '🔺' : '🔸'}</span><span class="tx">${x.t}</span></div>`).join('')}</div>` : ''}
    <div class="tw"><table><thead><tr><th>상품명</th><th class="hide-s">바코드·품번</th><th class="n">현재 재고</th><th class="n">수량</th><th class="n">반영 후</th><th></th></tr></thead><tbody>
    ${e.lines.map((l, i) => { const now = stockOf(e.store, l.pid); const after = now + T.sign * (+l.qty || 0); const flag = after < 0 || l.flag; return `<tr class="${flag ? 'flag' : ''}"><td class="nm">${esc(S.P[l.pid].name)}${l.flag ? `<div style="font-size:12px;color:var(--warn)">🔸 ${esc(l.flag)}</div>` : ''}</td><td class="code hide-s">${esc(S.P[l.pid].barcode || S.P[l.pid].sku)}</td><td class="n">${fmt(now)}</td><td class="n"><input class="inp qty" type="number" inputmode="numeric" min="1" value="${l.qty}" data-lq="${i}" aria-label="수량"></td><td class="n ${after < 0 ? 'qty-neg' : ''}" style="font-weight:700">${fmt(after)}</td><td style="width:1%"><button class="btn sm" data-ld="${i}" aria-label="빼기">빼기</button></td></tr>`; }).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" id="eClear">모두 지우기</button><button class="btn pri" id="eSave" ${issues.some(x => x.block) ? 'disabled' : ''}>${esc(e.type)} ${e.lines.length}종 저장</button></div></div>`;
}
function lineIssues(e) {
  const out = []; const T = TYPES.find(t => t.id === e.type);
  if (T.to && !e.to) out.push({ lv: 'bad', block: true, t: '받는 곳을 골라 주세요.' });
  if (T.to && e.to === '__custom' && !e.place) out.push({ lv: 'bad', block: true, t: '외부 장소를 고르거나 [새 장소 등록]으로 만들어 주세요.' });
  if (T.from && !e.from) out.push({ lv: 'bad', block: true, t: '돌아온 외부 장소를 골라 주세요.' });
  if (T.from && e.from) { const pl = placeById(e.from); const over = e.lines.filter(l => (+l.qty || 0) > ((pl && pl.q || {})[l.pid] || 0)); if (over.length) out.push({ lv: 'warn', t: `그 장소로 보낸 수량보다 많이 돌아온 상품 ${over.length}종이 있습니다. 수량을 확인해 주세요.` }); }
  if (T.partner && !e.partner.trim()) out.push({ lv: 'bad', block: true, t: `${e.type === '반품' ? '반품처' : '받는 업체'}를 적어 주세요.` });
  const neg = e.lines.filter(l => stockOf(e.store, l.pid) + T.sign * (+l.qty || 0) < 0);
  if (neg.length) out.push({ lv: 'warn', t: `반영하면 재고가 마이너스가 되는 상품 ${neg.length}종이 있습니다. 수량을 확인해 주세요.` });
  if (e.lines.some(l => !(+l.qty > 0))) out.push({ lv: 'bad', block: true, t: '수량이 0이거나 비어 있는 줄이 있습니다.' });
  const big = e.lines.filter(l => +l.qty >= 1000);
  if (big.length) out.push({ lv: 'warn', t: `수량 1,000개 이상인 줄 ${big.length}개 — 단위(박스·낱개)를 확인해 주세요.` });
  const dupToday = e.lines.filter(l => S.moves.some(m => m.store === e.store && m.pid === l.pid && m.date === e.date && m.type === e.type && m.qty === T.sign * (+l.qty)));
  if (dupToday.length) out.push({ lv: 'warn', t: `같은 날짜·같은 수량으로 이미 등록된 ${e.type} ${dupToday.length}건이 있습니다. 중복 등록인지 확인해 주세요.` });
  return out;
}
function addLine(pid, qty = 1, flag) {
  const e = S.ui.entry; const ex = e.lines.find(l => l.pid === pid);
  if (ex) { ex.qty = (+ex.qty || 0) + qty; ex.flag = ex.flag || '같은 상품을 두 번 넣어 수량을 합쳤습니다'; } else e.lines.push({ pid, qty, flag });
}
async function saveEntry() {
  const e = S.ui.entry; const T = TYPES.find(t => t.id === e.type);
  const by = S.user.name; const at = new Date().toISOString();
  const list = [];
  for (const l of e.lines) {
    const q = T.sign * (+l.qty);
    const m = { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: e.date, store: e.store, type: e.type, pid: l.pid, qty: q, memo: [e.to ? `→ ${e.to === '__custom' ? placeLabel(placeById(e.place)) : storeName(e.to)}` : '', T.from ? `← ${placeLabel(placeById(e.from))}` : '', e.partner, e.memo].filter(Boolean).join(' · '), place: (e.to === '__custom' && e.place) || (T.from && e.from) || null, by, at };
    list.push(m);
  }
  await DB.saveMoves(list);
  for (const m of list) {
    S.moves.push(m); (S.stock[m.store] ||= {})[m.pid] = stockOf(m.store, m.pid) + m.qty;
    if (m.type === '창고 보관') S.warehouse[m.pid] = (S.warehouse[m.pid] || 0) - m.qty;
    if (m.type === '창고에서 가져옴') S.warehouse[m.pid] = (S.warehouse[m.pid] || 0) - m.qty;
    if (m.place) { const pl = placeById(m.place); if (pl) { pl.q ||= {}; pl.q[m.pid] = (pl.q[m.pid] || 0) - m.qty; } }
    if (m.type === '매장 이동' && e.to !== '__custom') S.transfers.push({ id: m.id, pid: m.pid, qty: -m.qty, from: m.store, to: e.to, date: m.date, by, status: 'sent' });
  }
  const n = list.length; S.ui.entry = newEntry(e.type); S.ui.imp = null;
  toast(`${e.type} ${n}종 저장했습니다`);
}

/* 파일·링크 올리기 */
function importBox() {
  return `<div class="drop" id="drop"><div style="font-weight:700">엑셀·CSV 파일을 끌어 놓거나 고르세요</div>
    <div class="muted" style="font-size:13px;margin:4px 0 10px">품번·바코드·상품명·수량 칸을 자동으로 찾습니다. PDF·사진은 입력할 수 없습니다.</div>
    <button class="btn" id="fileBtn">파일 고르기</button></div>
  <div class="row"><input class="inp" id="linkIn" placeholder="구글시트 링크 붙여넣기 (링크가 있는 모든 사용자 보기 권한)" style="flex:1;min-width:220px"><button class="btn" id="linkGo">링크 열기</button></div>`;
}
const HDR = {
  sku: ['sku', '품번', '상품코드', '코드', '품목코드', '상품번호'],
  barcode: ['바코드', 'barcode', 'ean', 'jan', '바코드번호'],
  name: ['상품명', '품명', '제품명', '상품', 'name', '품목명'],
  qty: ['수량', '입고수량', '출고수량', '실제수량', '실제 수량', '예정수량', '예정 수량', 'qty', '입고', '수 량', '개수'],
  memo: ['메모', '비고', 'memo', '사유'],
  price: ['판매가', '소비자가', '단가', '가격', '상품가격', '정가', 'price'],
  ip: ['ip', '카테고리', '작품', '브랜드'],
};
const QTY_PLAN = ['예정수량', '출고수량', '발주수량', '수량', '입고수량', 'qty', '개수'];
const QTY_ACTUAL = ['실제수량', '실수량', '검수수량', '확인수량', '입고수량', '수량', 'qty', '개수'];
function detectCols(rows, qtyPref) {
  let best = null;
  for (let r = 0; r < Math.min(rows.length, 15); r++) {
    const row = rows[r].map(c => String(c ?? '').trim().toLowerCase().replace(/\s+/g, ''));
    const map = {};
    for (const [k, keys] of Object.entries(HDR)) {
      const ks = keys.map(x => x.toLowerCase().replace(/\s+/g, ''));
      let idx = row.findIndex(c => ks.includes(c));
      if (idx < 0) idx = row.findIndex(c => c && ks.some(x => c.includes(x)) && !Object.values(map).includes(row.indexOf(c)));
      if (idx >= 0 && !Object.values(map).includes(idx)) map[k] = idx;
    }
    if (qtyPref) { for (const k of qtyPref) { const i = row.indexOf(k); if (i >= 0) { map.qty = i; break; } } }
    const score = Object.keys(map).length + (map.qty != null ? 2 : 0) + (map.name != null || map.barcode != null || map.sku != null ? 2 : 0);
    if (!best || score > best.score) best = { r, map, score };
  }
  return best;
}
function importRows(rows, src) {
  const det = detectCols(rows);
  if (!det || det.map.qty == null || (det.map.name == null && det.map.barcode == null && det.map.sku == null)) {
    S.ui.imp = { src, err: '수량 칸과 상품 칸(상품명·바코드·품번 중 하나)을 찾지 못했습니다. 첫 줄에 "상품명", "수량" 같은 제목이 있는지 확인해 주세요.' }; return;
  }
  const m = det.map; const out = []; const seen = {};
  for (let i = det.r + 1; i < rows.length; i++) {
    const r = rows[i]; const g = k => m[k] != null ? String(r[m[k]] ?? '').trim().replace(/^'/, '') : '';
    const qty = Number(String(g('qty')).replace(/,/g, ''));
    const name = g('name'), bc = g('barcode'), sku = g('sku');
    if (!name && !bc && !sku) continue;
    if (/합계|총계|소계/.test(name) && !bc && !sku) continue;
    let cand = []; let how = '';
    if (bc) { cand = findProduct(bc); how = '바코드'; }
    if (!cand.length && sku) { cand = findProduct(sku); how = '품번'; }
    if (!cand.length && name) { cand = S.byName[norm(name)] || []; how = '상품명'; }
    const row = { line: i + 1, name, bc, sku, qty, memo: g('memo'), how, cand: cand.map(p => p.id), pid: cand.length === 1 ? cand[0].id : '', st: '' };
    if (!(qty > 0)) row.st = 'qty';
    else if (!cand.length) row.st = 'new';
    else if (cand.length > 1) row.st = 'multi';
    const key = row.pid || norm(name) + bc;
    if (seen[key]) { row.dup = seen[key]; } else seen[key] = row.line;
    out.push(row);
  }
  S.ui.imp = { src, rows: out, header: det.r + 1 };
}
function importPreview() {
  const im = S.ui.imp; if (!im) return '';
  if (im.err) return `<div class="note bad">🔺 ${esc(im.src)} — ${esc(im.err)}</div>`;
  const R = im.rows; const ok = R.filter(r => r.pid && r.qty > 0);
  const cnt = k => R.filter(r => r.st === k).length;
  const dup = R.filter(r => r.dup).length;
  return `<div class="card"><h2>미리보기 · ${esc(im.src)} <span class="r">${R.length}줄 (제목 ${im.header}번째 줄)</span></h2>
    <div class="alerts" style="margin-bottom:10px">
      <div class="al"><span class="ic">✔</span><span class="tx">상품을 찾은 줄 <b>${ok.length}</b>개 · ${fmt(ok.reduce((a, b) => a + b.qty, 0))}개</span></div>
      ${cnt('new') ? `<div class="al"><span class="ic">🔺</span><span class="tx">등록된 상품에 없는 줄 <b>${cnt('new')}</b>개 — 저장에서 빠집니다. 새 상품이면 관리 › 상품 목록에서 먼저 등록해 주세요.</span></div>` : ''}
      ${cnt('multi') ? `<div class="al"><span class="ic">🔸</span><span class="tx">같은 이름 상품이 여러 개인 줄 <b>${cnt('multi')}</b>개 — 줄마다 맞는 상품을 골라 주세요.</span></div>` : ''}
      ${cnt('qty') ? `<div class="al"><span class="ic">🔺</span><span class="tx">수량이 비었거나 0인 줄 <b>${cnt('qty')}</b>개 — 저장에서 빠집니다.</span></div>` : ''}
      ${dup ? `<div class="al"><span class="ic">🔸</span><span class="tx">파일 안에 같은 상품이 두 번 나온 줄 <b>${dup}</b>개 — 저장하면 수량이 합쳐집니다.</span></div>` : ''}
    </div>
    <div class="tw"><table><thead><tr><th class="n">줄</th><th>파일 상품명</th><th class="hide-s">바코드·품번</th><th>찾은 상품</th><th class="n">수량</th><th>상태</th></tr></thead><tbody>
    ${R.map((r, i) => `<tr class="${r.st || r.dup ? 'flag' : ''}"><td class="n muted">${r.line}</td><td class="nm">${esc(r.name || '-')}</td><td class="code hide-s">${esc(r.bc || r.sku || '')}</td>
      <td class="nm">${r.st === 'multi' ? `<select class="inp" data-ip="${i}" style="min-width:180px"><option value="">고르기</option>${r.cand.map(c => `<option value="${esc(c)}" ${r.pid === c ? 'selected' : ''}>${esc(S.P[c].name)} · ${esc(S.P[c].barcode || S.P[c].sku)}</option>`).join('')}</select>` : r.pid ? `${esc(S.P[r.pid].name)}<div class="muted" style="font-size:12px">${esc(r.how)}로 찾음</div>` : '<span class="muted">없음</span>'}</td>
      <td class="n" style="font-weight:700">${fmt(r.qty)}</td><td>${r.st === 'new' ? '<span class="pill p-bad">🔺 미등록</span>' : r.st === 'qty' ? '<span class="pill p-bad">🔺 수량</span>' : r.st === 'multi' && !r.pid ? '<span class="pill p-warn">🔸 선택</span>' : r.dup ? `<span class="pill p-warn">🔸 ${r.dup}줄과 중복</span>` : '<span class="pill p-ok">✔</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" id="impCancel">취소</button><button class="btn pri" id="impUse">찾은 ${R.filter(r => r.pid && r.qty > 0).length}줄을 ${esc(S.ui.entry.type)} 목록에 담기</button></div></div>`;
}
async function readFile(f) {
  if (/\.(pdf|png|jpe?g|heic|gif|webp)$/i.test(f.name)) { S.ui.imp = { src: f.name, err: 'PDF·사진은 입력할 수 없습니다. 엑셀이나 구글시트로 받아 주세요.' }; render(); return; }
  const wb = await readBook(f);
  let best = null;
  for (const n of wb.SheetNames) { const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '' }); const d = detectCols(rows); if (d && (!best || d.score > best.d.score)) best = { n, rows, d }; }
  importRows(best ? best.rows : [], `${f.name}${best && wb.SheetNames.length > 1 ? ' › ' + best.n : ''}`);
  render();
}
async function readLink(url) {
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); const g = url.match(/[#&?]gid=(\d+)/);
  if (!m) { S.ui.imp = { src: '링크', err: '구글시트 링크가 아닙니다. 주소에 /spreadsheets/d/ 가 들어 있어야 합니다.' }; render(); return; }
  const csvUrl = `https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${g ? '&gid=' + g[1] : ''}`;
  try {
    const r = await fetch(csvUrl); if (!r.ok) throw new Error(r.status);
    const text = await r.text(); const wb = XLSX.read(text, { type: 'string' });
    importRows(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }), '구글시트');
  } catch (err) {
    S.ui.imp = { src: '구글시트', err: S.mode === 'demo' ? '미리보기 화면에서는 외부 링크를 열 수 없습니다. 실제 앱에서는 "링크가 있는 모든 사용자" 공유 시트를 바로 읽습니다.' : '시트를 열지 못했습니다. 공유 설정을 "링크가 있는 모든 사용자 · 뷰어"로 바꿔 주세요.' };
  }
  render();
}

/* ───────── 실사 ───────── */
function countView() {
  const st = S.stores[0]; const c = S.ui.counts[st] ||= {};
  const q = norm(S.ui.countQ);
  let list = S.products.filter(p => (S.stock[st] || {})[p.id] != null || c[p.id] != null);
  if (S.ui.countIp) list = list.filter(p => p.ip === S.ui.countIp);
  if (q) list = list.filter(p => norm(p.name).includes(q) || (p.barcode || '').includes(S.ui.countQ.trim()) || norm(p.sku).includes(q));
  list.sort((a, b) => (c[b.id] != null) - (c[a.id] != null) || a.ip.localeCompare(b.ip, 'ko') || a.name.localeCompare(b.name, 'ko'));
  const ips = [...new Set(S.products.filter(p => (S.stock[st] || {})[p.id] != null).map(p => p.ip))].sort((a, b) => a.localeCompare(b, 'ko'));
  const done = Object.keys(c); const diffs = done.filter(pid => c[pid] !== stockOf(st, pid));
  return `${head('실사', `${esc(storeName(st))} · 세어 본 수량을 넣으면 장부와 차이를 바로 보여 줍니다${S.stores.length > 1 ? ' (여러 매장 중 첫 매장)' : ''}`, `<button class="btn" id="scanBtn">${ic('scan')} 스캔</button>`)}
  <div class="tiles"><div class="tile"><span class="lb">입력한 상품</span><span class="v big">${done.length}<small>종</small></span></div>
    <div class="tile ${diffs.length ? 'alert' : ''}"><span class="lb">장부와 다른 상품</span><span class="v big">${diffs.length}<small>종</small></span><span class="d">${diffs.length ? '🔸 반영 전에 확인' : ''}</span></div>
    <div class="tile"><span class="lb">차이 합계</span><span class="v big${String(fmt(diffs.reduce((a, pid) => a + c[pid] - stockOf(st, pid), 0))).length>9?' long':''}">${fmt(diffs.reduce((a, pid) => a + c[pid] - stockOf(st, pid), 0))}<small>개</small></span></div></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="row"><div class="search">${ic('search')}<input class="inp" id="cq" type="search" placeholder="상품명·바코드·품번" value="${esc(S.ui.countQ)}" autocomplete="off"></div>
    <select class="inp" id="cip" style="width:auto;min-width:160px" aria-label="IP"><option value="">IP 전체</option>${ips.map(i => `<option ${S.ui.countIp === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select></div>
    <div class="tw"><table><thead><tr><th>상품명</th><th class="hide-s">IP</th><th class="n">장부</th><th class="n">실사</th><th class="n">차이</th></tr></thead><tbody>
    ${list.slice(0, 200).map(p => { const b = stockOf(st, p.id); const v = c[p.id]; const d = v == null ? null : v - b; return `<tr class="${d ? 'flag' : ''}"><td class="nm">${esc(p.name)}<div class="code">${esc(p.barcode || p.sku)}</div></td><td class="hide-s nowrap">${esc(p.ip)}</td><td class="n ${b < 0 ? 'qty-neg' : ''}">${fmt(b)}</td><td class="n"><input class="inp qty" type="number" inputmode="numeric" min="0" value="${v ?? ''}" data-cnt="${esc(p.id)}" aria-label="실사 수량"></td><td class="n" style="font-weight:700">${d == null ? '' : d === 0 ? '<span class="muted">0</span>' : `<span style="color:${d < 0 ? 'var(--bad)' : 'var(--ok)'}">${d > 0 ? '+' : ''}${fmt(d)}</span>`}</td></tr>`; }).join('')}
    </tbody></table></div>${list.length > 200 ? '<p class="muted" style="font-size:13px">앞 200종만 보여 줍니다. IP나 검색으로 좁혀 주세요.</p>' : ''}
    <div class="row" style="justify-content:flex-end"><button class="btn" id="cReset" ${done.length ? '' : 'disabled'}>입력 지우기</button><button class="btn pri" id="cSave" ${diffs.length ? '' : 'disabled'}>차이 ${diffs.length}종 재고에 반영</button></div>
  </div>`;
}
async function saveCount() {
  const st = S.stores[0]; const c = S.ui.counts[st]; const at = new Date().toISOString();
  const list = Object.keys(c).filter(pid => c[pid] !== stockOf(st, pid)).map(pid => ({ id: 'c' + Date.now().toString(36) + pid, date: today(), store: st, type: COUNT_TYPE, pid, qty: c[pid] - stockOf(st, pid), memo: `실사 ${fmt(c[pid])}개 (장부 ${fmt(stockOf(st, pid))})`, by: S.user.name, at }));
  await DB.saveMoves(list);
  for (const m of list) { S.moves.push(m); S.stock[st][m.pid] = stockOf(st, m.pid) + m.qty; }
  S.ui.counts[st] = {}; toast(`실사 차이 ${list.length}종을 반영했습니다`);
}

/* ───────── 매장 이동 ───────── */
function transferView() {
  const st = S.stores;
  const inc = S.transfers.filter(t => st.includes(t.to)); const out = S.transfers.filter(t => st.includes(t.from));
  const row = (t, recv) => `<tr><td class="num nowrap" style="text-align:left">${md(t.date)}</td><td class="nowrap">${esc(storeName(t.from))} → ${esc(storeName(t.to))}</td><td class="nm">${esc(S.P[t.pid].name)}</td><td class="n" style="font-weight:700">${fmt(t.qty)}</td><td>${t.status === 'sent' ? (recv ? `<button class="btn sm pri" data-recv="${t.id}">받기 확인</button>` : '<span class="pill p-warn">🔸 받는 중</span>') : `<span class="pill p-ok">✔ 받음 ${md(t.recvDate)}</span>`}</td></tr>`;
  return `${head('매장 이동', '보낸 매장에서 빠지고, 받는 매장이 확인하면 더해집니다', `<button class="btn pri" data-quick="매장 이동">상품 보내기</button>`)}
  <div class="card"><h2>받을 상품 <span class="r">${inc.filter(t => t.status === 'sent').length}건 대기</span></h2>${inc.length ? `<div class="tw"><table><thead><tr><th>보낸 날</th><th>경로</th><th>상품명</th><th class="n">수량</th><th>상태</th></tr></thead><tbody>${inc.map(t => row(t, true)).join('')}</tbody></table></div>` : '<div class="empty">받을 상품이 없습니다</div>'}</div>
  <div class="card"><h2>보낸 상품</h2>${out.length ? `<div class="tw"><table><thead><tr><th>보낸 날</th><th>경로</th><th>상품명</th><th class="n">수량</th><th>상태</th></tr></thead><tbody>${out.map(t => row(t, false)).join('')}</tbody></table></div>` : '<div class="empty">보낸 상품이 없습니다. 위 [상품 보내기]로 시작하세요.</div>'}</div>`;
}
async function receive(id) {
  const t = S.transfers.find(x => x.id === id); if (!t) return;
  const m = { id: 'r' + Date.now().toString(36), date: today(), store: t.to, type: '매장 이동(받음)', pid: t.pid, qty: t.qty, memo: `← ${storeName(t.from)}`, by: S.user.name, at: new Date().toISOString(), tid: t.id };
  await DB.saveMoves([m]); S.moves.push(m); (S.stock[t.to] ||= {})[t.pid] = stockOf(t.to, t.pid) + t.qty;
  t.status = 'received'; t.recvDate = m.date; toast('받기 확인했습니다');
}

/* ───────── 기록 ───────── */
function recordsView() {
  const q = norm(S.ui.recQ); let L = S.moves.filter(m => S.stores.includes(m.store));
  const tot = {}; for (const m of L) tot[m.type] = (tot[m.type] || 0) + 1;
  if (S.ui.recType) L = L.filter(m => m.type === S.ui.recType);
  if (q) L = L.filter(m => norm((S.P[m.pid] || {}).name).includes(q) || norm(m.memo).includes(q) || (S.P[m.pid] || {}).barcode === S.ui.recQ.trim());
  const types = [...new Set(S.moves.map(m => m.type))];
  return `${head('기록', `${fmt(L.length)}건 · 최근 것부터`)}
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><div class="row"><div class="search">${ic('search')}<input class="inp" id="rq" type="search" placeholder="상품명·메모·바코드" value="${esc(S.ui.recQ)}"></div></div>
  <div class="chips"><button class="chip ${!S.ui.recType ? 'on' : ''}" data-rt="">전체</button>${types.map(t => `<button class="chip ${S.ui.recType === t ? 'on' : ''}" data-rt="${esc(t)}">${esc(t)} <span class="num">${fmt(tot[t] || 0)}건</span></button>`).join('')}</div></div>
  <div class="card" style="padding:8px 12px">${movesTable(L.slice(-400).reverse())}${L.length > 400 ? '<p class="muted" style="font-size:13px">최근 400건만 보여 줍니다.</p>' : ''}</div>`;
}

/* ───────── 매출 ───────── */
function dayRec(st, d) { const m = (S.sales[st] || {})[d.slice(0, 7)]; return m && m.days[d.slice(8)] || null; }
function latestSalesDate(stores) {
  let best = '';
  for (const st of stores) for (const [ym, m] of Object.entries(S.sales[st] || {})) for (const dd of Object.keys(m.days)) { const d = ym + '-' + dd; if (d > best) best = d; }
  return best;
}
function firstSalesDate(stores) {
  let best = '9999';
  for (const st of stores) for (const [ym, m] of Object.entries(S.sales[st] || {})) for (const dd of Object.keys(m.days)) { const d = ym + '-' + dd; if (d < best) best = d; }
  return best === '9999' ? '' : best;
}
function defaultRange(unit, last) {
  if (!last) last = today();
  if (unit === 'day') return [addDays(last, -13), last];
  if (unit === 'week') return [addDays(last, -7 * 8 + 1), last];
  if (unit === 'month') return [addDays(last, -365).slice(0, 7) + '-01', last];
  if (unit === 'year') return [firstSalesDate(S.stores) || last.slice(0, 4) + '-01-01', last];
  if (unit === 'ip') return [last.slice(0, 7) + '-01', last];
}
function periodKey(d, unit) {
  if (unit === 'day') return d;
  if (unit === 'week') { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, -((w + 6) % 7)); }
  if (unit === 'month') return d.slice(0, 7);
  if (unit === 'year') return d.slice(0, 4);
  return 'all';
}
function periodLabel(k, unit) {
  if (unit === 'day') return `${md(k)} (${wd(k)})`;
  if (unit === 'week') return `${md(k)}~${md(addDays(k, 6))}`;
  if (unit === 'month') return `${k.slice(0, 4)}.${k.slice(5)}`;
  if (unit === 'year') return `${k}년`;
  return k;
}
function aggregate(stores, a, b) {
  const per = {}; // store → {s,p,q,ip:{},pr:{},days}
  for (const st of stores) {
    const o = per[st] = { s: 0, p: 0, q: 0, ip: {}, pr: {}, days: 0, series: {} };
    for (let d = a; d <= b; d = addDays(d, 1)) {
      const r = dayRec(st, d); if (!r) continue;
      o.s += r.s; o.p += r.p; o.q += r.q; o.days++;
      const k = periodKey(d, S.ui.salesUnit); const se = o.series[k] ||= { s: 0, p: 0 }; se.s += r.s; se.p += r.p;
      for (const [ip, [q, s]] of Object.entries(r.ip)) { const x = o.ip[ip] ||= [0, 0]; x[0] += q; x[1] += s; }
      for (const [nm, [q, s, ip]] of Object.entries(r.pr)) { const x = o.pr[nm] ||= [0, 0, ip]; x[0] += q; x[1] += s; }
    }
  }
  return per;
}
function salesView() {
  const stores = S.stores; const last = latestSalesDate(stores);
  const unit = S.ui.salesUnit;
  if (!S.ui.range || S.ui.range.unit !== unit) S.ui.range = { unit, ab: defaultRange(unit, last) };
  const [a, b] = S.ui.range.ab;
  const sum = (S.sumStores || stores).filter(s => stores.includes(s));
  const per = aggregate(stores, a, b);
  const len = daysBetween(a, b) + 1; const pa = addDays(a, -len), pb = addDays(a, -1);
  const prev = aggregate(stores, pa, pb);
  const T = (o, ks) => ks.reduce((x, k) => ({ s: x.s + o[k].s, p: x.p + o[k].p, q: x.q + o[k].q }), { s: 0, p: 0, q: 0 });
  const cur = T(per, sum), pre = T(prev, sum);
  const multi = stores.length > 1;
  const ch = pct(cur.s, pre.s);
  const units = [['day', '일별'], ['week', '주별'], ['month', '월별'], ['year', '연도별'], ['ip', 'IP별']];
  const quick = [['이번 주', () => { const k = periodKey(last, 'week'); return [k, last]; }], ['지난주', () => { const k = addDays(periodKey(last, 'week'), -7); return [k, addDays(k, 6)]; }], ['이번 달', () => [last.slice(0, 7) + '-01', last]], ['지난달', () => { const f = addDays(last.slice(0, 7) + '-01', -1); return [f.slice(0, 7) + '-01', f]; }], ['올해', () => [last.slice(0, 4) + '-01-01', last]], ['전체', () => [firstSalesDate(stores), last]]];
  S._quick = quick;
  const noData = stores.filter(s => !per[s].days);
  return `${head('매출', `토스포스 매출리포트 기준 · ${last ? `${last} 마감까지` : '아직 자료 없음'}`, `<button class="btn" id="posBtn">토스포스 파일 올리기</button>`)}
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="seg">${units.map(([k, t]) => `<button class="${unit === k ? 'on' : ''}" data-su="${k}">${t}</button>`).join('')}</div>
    <div class="row"><div class="field"><label for="ra">시작일</label><input class="inp" type="date" id="ra" value="${a}"></div><div class="field"><label for="rb">종료일</label><input class="inp" type="date" id="rb" value="${b}"></div>
      <div class="chips" style="align-self:flex-end">${quick.map(([t], i) => `<button class="chip" data-qr="${i}">${t}</button>`).join('')}</div></div>
    ${multi ? `<div class="field"><label>합산에 넣을 매장</label><div class="chips">${stores.map(s => `<label class="chip ${sum.includes(s) ? 'on' : ''}" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-sum="${s}" ${sum.includes(s) ? 'checked' : ''} style="accent-color:var(--red)"><span class="dot" style="background:${storeColor(s)}"></span>${esc(storeName(s))}</label>`).join('')}</div></div>` : ''}
  </div>
  ${noData.length ? `<div class="note">${noData.map(s => esc(storeName(s))).join(', ')} — 이 기간 매출 자료가 없습니다. [토스포스 파일 올리기]로 넣어 주세요.</div>` : ''}
  <div class="tiles">
    <div class="tile"><span class="lb">매출${multi ? ` · 합산 ${sum.length}곳` : ''}</span><span class="v big${String(fmt(cur.s)).length>9?' long':''}">${fmt(cur.s)}<small>원</small></span><span class="d">${ch == null ? '<span class="muted">이전 기간 자료 없음</span>' : `${ch >= 0 ? '✔ +' : '🔺 '}${ch.toFixed(1)}% <span class="muted">이전 ${len}일 대비</span>`}</span></div>
    <div class="tile"><span class="lb">결제건수</span><span class="v big${String(fmt(cur.p)).length>9?' long':''}">${fmt(cur.p)}<small>건</small></span><span class="d muted">이전 ${fmt(pre.p)}건</span></div>
    <div class="tile"><span class="lb">객단가</span><span class="v big${String(fmt(cur.p ? cur.s / cur.p : 0)).length>9?' long':''}">${fmt(cur.p ? cur.s / cur.p : 0)}<small>원</small></span><span class="d muted">이전 ${fmt(pre.p ? pre.s / pre.p : 0)}원</span></div>
    <div class="tile"><span class="lb">판매수량</span><span class="v big${String(fmt(cur.q)).length>9?' long':''}">${fmt(cur.q)}<small>개</small></span><span class="d muted">${a.slice(2).replace(/-/g, '.')} ~ ${b.slice(2).replace(/-/g, '.')}</span></div>
  </div>
  ${multi ? storeCompare(per, sum, stores) : ''}
  ${unit === 'ip' ? ipBlock(per, sum) : seriesBlock(per, sum, stores, unit)}
  ${unit !== 'ip' ? ipBlock(per, sum, 10) : ''}
  ${productTop(per, sum)}`;
}
function storeCompare(per, sum, stores) {
  const tot = sum.reduce((a, s) => a + per[s].s, 0); const mx = Math.max(1, ...stores.map(s => per[s].s));
  return `<div class="card"><h2>매장별 매출 <span class="r">합산 = 체크한 매장만</span></h2>
  <div class="tw"><table><thead><tr><th>매장</th><th class="n">매출</th><th class="n hide-s">결제건수</th><th class="n hide-s">객단가</th><th class="n">비중</th><th style="width:30%" class="hide-s"></th></tr></thead><tbody>
  ${stores.map(s => { const o = per[s]; return `<tr><td class="nowrap"><span class="dot" style="background:${storeColor(s)};display:inline-block;margin-right:6px"></span>${esc(storeName(s))}${sum.includes(s) ? '' : ' <span class="pill p-mute">합산 제외</span>'}</td><td class="n" style="font-weight:700">${fmt(o.s)}</td><td class="n hide-s">${fmt(o.p)}</td><td class="n hide-s">${fmt(o.p ? o.s / o.p : 0)}</td><td class="n">${sum.includes(s) && tot ? (o.s / tot * 100).toFixed(1) + '%' : '-'}</td><td class="hide-s"><div class="hb" style="grid-template-columns:1fr"><div class="tr"><i style="width:${o.s / mx * 100}%;background:${storeColor(s)}"></i></div></div></td></tr>`; }).join('')}
  <tr class="tot"><td>합산 (${sum.length}곳)</td><td class="n">${fmt(tot)}</td><td class="n hide-s">${fmt(sum.reduce((a, s) => a + per[s].p, 0))}</td><td class="n hide-s">${fmt(sum.reduce((a, s) => a + per[s].p, 0) ? tot / sum.reduce((a, s) => a + per[s].p, 0) : 0)}</td><td class="n">100%</td><td class="hide-s"></td></tr></tbody></table></div></div>`;
}
function seriesBlock(per, sum, stores, unit) {
  const keys = [...new Set(stores.flatMap(s => Object.keys(per[s].series)))].sort();
  if (!keys.length) return `<div class="card"><h2>${unit === 'day' ? '일별' : unit === 'week' ? '주별' : unit === 'month' ? '월별' : '연도별'} 매출</h2><div class="empty">이 기간 매출 자료가 없습니다</div></div>`;
  const multi = stores.length > 1;
  const val = (s, k) => (per[s].series[k] || { s: 0 }).s;
  const totK = k => sum.reduce((a, s) => a + val(s, k), 0);
  const mx = Math.max(1, ...keys.map(k => multi ? Math.max(...stores.map(s => val(s, k)), totK(k)) : val(stores[0], k)));
  const title = { day: '일별', week: '주별 (월~일)', month: '월별', year: '연도별' }[unit];
  const rows = keys.slice().reverse();
  return `<div class="card"><h2>${title} 매출 <span class="r">${rows.length}개 · 최근이 위</span></h2>
    ${trendSvg(keys.map(k => multi ? totK(k) : val(stores[0], k)), keys.map(k => periodLabel(k, unit)))}
    ${multi ? `<div class="legend" style="margin:8px 0">${stores.map(s => `<span><span class="dot" style="background:${storeColor(s)}"></span>${esc(storeName(s))}</span>`).join('')}<span><span class="dot" style="background:var(--ink)"></span>합산</span></div>` : ''}
    <div class="hb" style="margin-top:8px">${rows.map((k, i) => {
      if (!multi) { const v = val(stores[0], k); const p = (per[stores[0]].series[k] || {}).p || 0; return `<span class="k">${periodLabel(k, unit)}</span><span class="tr"><i style="width:${v / mx * 100}%;background:var(--red)"></i></span><span class="v">${fmt(v)}<span class="muted" style="font-weight:500"> · ${fmt(p)}건</span></span>`; }
      return `${i ? '<span class="sep"></span>' : ''}<span class="k">${periodLabel(k, unit)}</span><span class="tr multi">${stores.map(s => `<i style="width:${val(s, k) / mx * 100}%;background:${storeColor(s)}"></i>`).join('')}<i style="width:${totK(k) / mx * 100}%;background:var(--ink)"></i></span><span class="v multi">${stores.map(s => `<span style="color:${storeColor(s)}">${man(val(s, k))}</span>`).join('')}<span>${man(totK(k))}</span></span>`;
    }).join('')}</div></div>`;
}
function trendSvg(vals, labels) {
  if (vals.length < 2) return '';
  const W = 640, H = 150, L = 8, R = 8, T = 22, B = 22; const mx = Math.max(...vals, 1);
  const x = i => L + i * (W - L - R) / (vals.length - 1), y = v => T + (1 - v / mx) * (H - T - B);
  const pts = vals.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const iMax = vals.indexOf(mx), iL = vals.length - 1;
  const lab = (i, anchor) => `<circle cx="${x(i)}" cy="${y(vals[i])}" r="3.5" fill="var(--red)"/><text class="vl" x="${x(i)}" y="${y(vals[i]) - 7}" text-anchor="${anchor}">${man(vals[i])}</text>`;
  const anc = i => i < vals.length * .15 ? 'start' : i > vals.length * .85 ? 'end' : 'middle';
  return `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="매출 추이"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--line)"/>
    <polygon points="${L},${H - B} ${pts} ${W - R},${H - B}" fill="var(--line-2)"/><polyline points="${pts}" fill="none" stroke="var(--red)" stroke-width="2"/>
    ${lab(iMax, anc(iMax))}${iL !== iMax ? lab(iL, 'end') : ''}
    <text x="${L}" y="${H - 6}">${esc(labels[0])}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${esc(labels[iL])}</text></svg>`;
}
function ipBlock(per, sum, top) {
  const ip = {}; for (const s of sum) for (const [k, [q, v]] of Object.entries(per[s].ip)) { const x = ip[k] ||= { q: 0, s: 0, by: {} }; x.q += q; x.s += v; x.by[s] = (x.by[s] || 0) + v; }
  let rows = Object.entries(ip).sort((a, b) => b[1].s - a[1].s); const tot = rows.reduce((a, b) => a + b[1].s, 0);
  const n = rows.length; if (top) rows = rows.slice(0, top);
  if (!rows.length) return '';
  const mx = rows[0][1].s || 1; const multi = sum.length > 1;
  return `<div class="card"><h2>IP별 매출 ${top ? `TOP ${Math.min(top, n)}` : `전체 ${n}개`} <span class="r">${multi ? '합산 매장 기준 · ' : ''}비중 = 기간 매출 대비</span></h2>
    <div class="hb">${rows.map(([k, x], i) => `<span class="k wrap"><span class="muted num">${i + 1}</span> ${esc(k)}</span><span class="tr">${multi ? `<span style="display:flex;height:100%;width:${x.s / mx * 100}%">${sum.map(s => `<i style="width:${(x.by[s] || 0) / x.s * 100}%;background:${storeColor(s)};border-radius:0"></i>`).join('')}</span>` : `<i style="width:${x.s / mx * 100}%;background:var(--red)"></i>`}</span><span class="v">${fmt(x.s)}<span class="muted" style="font-weight:500"> · ${(x.s / tot * 100).toFixed(1)}%</span></span>`).join('')}</div>
    ${top && n > top ? `<div style="margin-top:10px"><button class="btn sm" data-su="ip">IP ${n}개 전체 보기</button></div>` : ''}</div>`;
}
function productTop(per, sum) {
  const pr = {}; for (const s of sum) for (const [k, [q, v, ip]] of Object.entries(per[s].pr)) { const x = pr[k] ||= { q: 0, s: 0, ip }; x.q += q; x.s += v; }
  const rows = Object.entries(pr).sort((a, b) => b[1].s - a[1].s).slice(0, 15);
  if (!rows.length) return '';
  return `<div class="card"><h2>상품별 매출 TOP 15</h2><div class="tw"><table><thead><tr><th class="n">순위</th><th>상품명</th><th class="hide-s">IP</th><th class="n">수량</th><th class="n">매출</th></tr></thead><tbody>
    ${rows.map(([k, x], i) => `<tr><td class="n muted">${i + 1}</td><td class="nm">${esc(k.replace(/^에바30주년팝업_/, ''))}</td><td class="hide-s nowrap">${esc(x.ip)}</td><td class="n">${fmt(x.q)}</td><td class="n" style="font-weight:700">${fmt(x.s)}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* 토스포스 파일 */
function posDrawer() {
  const pv = S.ui.posPreview;
  return `<div class="hd"><h3>토스포스 매출리포트 올리기</h3><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="field"><label for="posStore">매장</label><select class="inp" id="posStore">${myStores().map(s => `<option value="${s}" ${(pv && pv.store) === s ? 'selected' : ''}>${esc(storeName(s))}</option>`).join('')}</select></div>
    <div class="drop"><div style="font-weight:700">토스포스에서 받은 zip 또는 xlsx</div><div class="muted" style="font-size:13px;margin:4px 0 10px">zip은 관리 › 파일 비밀번호에 등록한 비밀번호로 앱이 풉니다</div><button class="btn" id="posFileBtn">파일 고르기</button></div>
  </div>
  ${pv ? pv.err ? `<div class="note bad">🔺 ${esc(pv.err)}</div>` : `<div class="card"><h2>확인 · ${esc(storeName(pv.store))}</h2>
    <div class="alerts">${pv.days.map(d => `<div class="al"><span class="ic">${d.ok ? '✔' : '🔺'}</span><span class="tx"><b>${d.date}(${wd(d.date)})</b> 매출 ${won(d.s)} · ${fmt(d.p)}건 · 상품 ${d.items}종 ${fmt(d.q)}개${d.ok ? ' — 결제 합계와 상품 합계 일치' : ` — 🔺 결제 ${won(d.s)} ≠ 상품 ${won(d.si)}`}${d.exists ? '<br>🔸 이미 올린 날짜입니다. 저장하면 덮어씁니다.' : ''}</span></div>`).join('')}
    ${pv.match ? `<div class="al"><span class="ic">${pv.unmatched.length ? '🔸' : '✔'}</span><span class="tx">재고 차감: 상품 ${pv.match.length}종 찾음${pv.unmatched.length ? ` · 못 찾은 ${pv.unmatched.length}종 (${esc(pv.unmatched.slice(0, 3).join(', '))}${pv.unmatched.length > 3 ? ' 외' : ''}) — 재고에 없는 상품은 차감하지 않습니다` : ''}</span></div>` : ''}</div>
    <label class="ck"><input type="checkbox" id="posDeduct" ${pv.days.some(d => d.exists) ? '' : 'checked'}><span><span class="t">판매 수량을 재고에서 빼기</span><span class="s" style="display:block">${pv.days.some(d => d.exists) ? '🔸 이미 올린 날짜가 있어 꺼 두었습니다. 그날 재고를 이미 뺐다면 다시 빼면 두 번 빠집니다.' : "찾은 상품만 '판매'로 기록합니다"}</span></span></label>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" id="posSave" ${pv.days.every(d => d.ok) ? '' : 'disabled'}>매출 저장</button></div></div>` : ''}`;
}
async function readPos(f, store) {
  try {
    let buf = await f.arrayBuffer(); let wbs = [];
    if (/\.zip$/i.test(f.name)) {
      if (!window.zip) await loadScript('https://cdn.jsdelivr.net/npm/@zip.js/zip.js@2.7.45/dist/zip.min.js');
      const pw = S.zipPw[store];
      const rd = new zip.ZipReader(new zip.BlobReader(new Blob([buf])), pw ? { password: pw } : {});
      const ents = await rd.getEntries();
      for (const e of ents) if (/\.xlsx$/i.test(e.filename)) { const b = await e.getData(new zip.Uint8ArrayWriter(), pw ? { password: pw } : {}); wbs.push(XLSX.read(b, { type: 'array' })); }
      await rd.close();
      if (!wbs.length) throw new Error('zip 안에 xlsx 파일이 없습니다.');
    } else wbs = [XLSX.read(buf, { type: 'array' })];
    const days = []; const items = {};
    for (const wb of wbs) {
      if (!wb.Sheets['결제 합계'] || !wb.Sheets['상품 주문 합계']) throw new Error('토스포스 매출리포트가 아닙니다 (결제 합계·상품 주문 합계 시트가 없음).');
      const pay = XLSX.utils.sheet_to_json(wb.Sheets['결제 합계'], { header: 1, defval: '' });
      for (const r of pay) if (/^\d{4}-\d{2}-\d{2}$/.test(String(r[0]))) days.push({ date: r[0], s: +r[1] || 0, p: +r[3] || 0 });
      const it = XLSX.utils.sheet_to_json(wb.Sheets['상품 주문 합계'], { header: 1, defval: '' });
      for (const r of it) if (/^\d{4}-\d{2}-\d{2}$/.test(String(r[0]))) (items[r[0]] ||= []).push({ name: String(r[1]).trim(), ip: String(r[3]).trim() || '미분류', q: +r[4] || 0, s: +r[8] || 0 });
    }
    const unmatched = new Set(); const match = [];
    for (const d of days) {
      const L = items[d.date] || []; d.items = L.length; d.q = L.reduce((a, b) => a + b.q, 0); d.si = L.reduce((a, b) => a + b.s, 0); d.ok = d.si === d.s; d.exists = !!dayRec(store, d.date); d.L = L;
      for (const x of L) { const c = S.byName[norm(x.name)]; if (c && c.length === 1 && (S.stock[store] || {})[c[0].id] != null) match.push({ date: d.date, pid: c[0].id, q: x.q }); else unmatched.add(x.name); }
    }
    if (!days.length) throw new Error('결제 합계에 날짜 줄이 없습니다.');
    S.ui.posPreview = { store, days, match, unmatched: [...unmatched] };
  } catch (err) {
    S.ui.posPreview = { store, err: /password|encrypted|Wrong/i.test(String(err && err.message)) ? `zip 비밀번호가 맞지 않습니다. 관리 › 파일 비밀번호에서 ${storeName(store)} 비밀번호를 확인해 주세요.` : String(err.message || err) };
  }
  render();
}
async function savePos() {
  const pv = S.ui.posPreview; const st = pv.store;
  for (const d of pv.days) {
    const ip = {}, pr = {}; for (const x of d.L) { const a = ip[x.ip] ||= [0, 0]; a[0] += x.q; a[1] += x.s; const b = pr[x.name] ||= [0, 0, x.ip]; b[0] += x.q; b[1] += x.s; }
    const rec = { s: d.s, p: d.p, q: d.q, ip, pr };
    await DB.saveSalesDay(st, d.date, rec);
    ((S.sales[st] ||= {})[d.date.slice(0, 7)] ||= { days: {} }).days[d.date.slice(8)] = rec;
  }
  if ($('#posDeduct') && $('#posDeduct').checked && pv.match.length) {
    const list = pv.match.map((m, i) => ({ id: 'p' + Date.now().toString(36) + i, date: m.date, store: st, type: '판매', pid: m.pid, qty: -m.q, memo: 'POS 판매', by: '자동(POS)', at: new Date().toISOString() }));
    await DB.saveMoves(list); for (const m of list) { S.moves.push(m); S.stock[st][m.pid] = stockOf(st, m.pid) + m.qty; }
  }
  S.ui.posPreview = null; S.ui.drawer = null; toast(`매출 ${pv.days.length}일치를 저장했습니다`);
}
async function readBook(f) {
  // CSV는 글자(UTF-8)로 읽어야 한글이 깨지지 않음
  if (/\.csv$/i.test(f.name)) { let t = await f.text(); if (t.includes('\uFFFD')) t = new TextDecoder('euc-kr').decode(await f.arrayBuffer()); return XLSX.read(t.replace(/^\uFEFF/, ''), { type: 'string' }); }
  return XLSX.read(await f.arrayBuffer(), { type: 'array' });
}
function pickFile(accept, cb) {
  // 화면이 다시 그려져도 사라지지 않도록 문서 맨 끝에 따로 만든 파일 선택 칸
  let inp = document.getElementById('smgFilePick');
  if (inp) inp.remove();
  inp = document.createElement('input'); inp.type = 'file'; inp.id = 'smgFilePick'; inp.accept = accept; inp.style.display = 'none';
  inp.addEventListener('change', () => { const f = inp.files && inp.files[0]; if (f) cb(f); });
  document.body.appendChild(inp); inp.click();
}
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('라이브러리를 불러오지 못했습니다')); document.head.appendChild(s); }); }

/* ───────── 정산 (대표만) ───────── */
function settleView() {
  if (!isOwner()) return '';
  const months = [...new Set(S.settle.map(r => r.month))].sort().reverse();
  const m = S.ui.settleMonth || months[0];
  const rows = S.settle.filter(r => r.month === m);
  const ipRows = rows.filter(r => r.kind === 'ip').sort((a, b) => b.net - a.net); const ded = rows.filter(r => r.kind !== 'ip');
  const T = k => rows.reduce((a, r) => a + (+r[k] || 0), 0);
  const st = rows[0] ? rows[0].status : '';
  return `${head('정산', '대표 계정에만 보입니다 · POS 매출 × 홀딩스 정산서 요율', `<select class="inp" id="setM" style="width:auto">${months.map(x => `<option ${x === m ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
  <div class="tiles"><div class="tile"><span class="lb">판매 금액</span><span class="v big${String(fmt(ipRows.reduce((a, r) => a + r.sales, 0))).length>9?' long':''}">${fmt(ipRows.reduce((a, r) => a + r.sales, 0))}<small>원</small></span></div>
    <div class="tile"><span class="lb">온인터 배분</span><span class="v big${String(fmt(T('onin'))).length>9?' long':''}">${fmt(T('onin'))}<small>원</small></span></div>
    <div class="tile"><span class="lb">크리에이티브 지급</span><span class="v big${String(fmt(-T('creative'))).length>9?' long':''}">${fmt(-T('creative'))}<small>원</small></span></div>
    <div class="tile"><span class="lb">순수익 (${/확정/.test(st) ? '✔ 확정' : '🔸 예상'})</span><span class="v big${String(fmt(T('net'))).length>9?' long':''}">${fmt(T('net'))}<small>원</small></span><span class="d muted">시공비 차감 포함</span></div></div>
  <div class="card"><h2>IP별</h2><div class="tw"><table><thead><tr><th>IP</th><th class="hide-s">공급</th><th class="n">판매 금액</th><th class="n">요율</th><th class="n">온인터 배분</th><th class="n hide-s">크리에이티브 지급</th><th class="n">순수익</th></tr></thead><tbody>
  ${ipRows.map(r => `<tr><td class="nm">${esc(r.ip)}</td><td class="hide-s nowrap muted">${esc(r.supplier)}</td><td class="n">${fmt(r.sales)}</td><td class="n">${r.rate === '' ? '-' : Math.round(r.rate * 100) + '%'}</td><td class="n">${fmt(r.onin)}</td><td class="n hide-s">${r.creative ? fmt(-r.creative) : '-'}</td><td class="n" style="font-weight:700">${fmt(r.net)}</td></tr>`).join('')}
  ${ded.map(r => `<tr><td class="nm">${esc(r.ip)}</td><td class="hide-s muted">차감</td><td class="n">-</td><td class="n">-</td><td class="n">${fmt(r.onin)}</td><td class="n hide-s">-</td><td class="n" style="font-weight:700;color:var(--bad)">${fmt(r.net)}</td></tr>`).join('')}
  <tr class="tot"><td>합계</td><td class="hide-s"></td><td class="n">${fmt(ipRows.reduce((a, r) => a + r.sales, 0))}</td><td></td><td class="n">${fmt(T('onin'))}</td><td class="n hide-s">${fmt(-T('creative'))}</td><td class="n">${fmt(T('net'))}</td></tr></tbody></table></div></div>`;
}

/* ───────── 관리 ───────── */
function adminView() {
  const tabs = [['pending', '승인 대기'], ['users', '직원'], ['stores', '매장·회사'], ['pw', '파일 비밀번호'], ['products', '상품 목록']].filter(([k]) => can('approve') || k === 'products');
  if (isOwner() && S.mode === 'live') tabs.push(['seed', '처음 자료 넣기']);
  const t = S.ui.adminTab;
  const pendingN = S.users.filter(u => u.status === 'pending').length;
  return `${head('관리', '승인권자: 유명훈 본부장 · 사용자 승인 권한이 있는 사람만 볼 수 있습니다', S.mode === 'demo' ? '<button class="btn" id="showApply">직원 신청 화면 보기</button>' : '')}
  <div class="seg">${tabs.map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-at="${k}">${n}${k === 'pending' && pendingN ? ` (${pendingN})` : ''}</button>`).join('')}</div>
  ${t === 'seed' ? seedView() : t === 'pending' ? pendingView() : t === 'users' ? usersView() : t === 'stores' ? storesAdmin() : t === 'pw' ? pwView() : productsAdmin()}`;
}
function recPerms(u) {
  const lim = u.company === '기타(직접 입력)';
  const st = STORES.filter(s => (u.places || []).includes(s.name)).map(s => s.id);
  const hq = (u.places || []).includes('본사') && !lim;
  return { stores: hq ? STORES.map(s => s.id) : st, move: !lim, count: !lim && COUNT_REC.has(u.position), sales: !lim && SALES_REC.has(u.position), approve: false, lim };
}
function permEditor(u, p, idp) {
  const lim = u.company === '기타(직접 입력)'; const rec = recPerms(u);
  return `<div class="field"><label>볼 수 있는 매장</label><div class="checks">${STORES.map(s => `<label class="ck"><input type="checkbox" data-pst="${idp}:${s.id}" ${p.stores.includes(s.id) ? 'checked' : ''}><span><span class="t">${esc(s.name)}</span>${rec.stores.includes(s.id) ? '<span class="rec">추천</span>' : ''}</span></label>`).join('')}</div></div>
  <div class="field"><label>권한</label><div class="checks">
    <label class="ck dis"><input type="checkbox" checked disabled><span><span class="t">재고 수량 보기</span><span class="s">모든 승인 사용자 기본</span></span></label>
    ${PERM_DEF.map(d => `<label class="ck ${lim ? 'dis' : ''}"><input type="checkbox" data-pp="${idp}:${d.k}" ${p[d.k] && !lim ? 'checked' : ''} ${lim ? 'disabled' : ''}><span><span class="t">${d.t}</span>${rec[d.k] ? '<span class="rec">추천</span>' : ''}<span class="s" style="display:block">${d.s}</span></span></label>`).join('')}
    <label class="ck dis"><input type="checkbox" disabled ${u.owner ? 'checked' : ''}><span><span class="t">정산 보기</span><span class="s" style="display:block">대표 계정 고정 · 줄 수 없음</span></span></label>
  </div></div>
  ${lim ? '<div class="note warn">🔸 기타(직접 입력) 소속은 재고 수량 확인만 됩니다. 다른 권한을 주려면 소속을 목록 회사로 바꿔야 합니다. 가격·매출·기록·직원 정보도 보이지 않습니다.</div>' : ''}`;
}
function pendingView() {
  const P = S.users.filter(u => u.status === 'pending');
  if (!P.length) return '<div class="card"><div class="empty">✔ 승인 대기 중인 신청이 없습니다</div></div>';
  S.ui.draft ||= {};
  return P.map(u => {
    const p = S.ui.draft[u.uid] ||= recPerms(u);
    return `<div class="card"><h2>${esc(u.name)} <span class="pill p-warn">🔸 승인 대기</span><span class="r">${esc(u.createdAt || '')} 신청</span></h2>
    <dl class="kv" style="margin-bottom:12px"><dt>이메일</dt><dd>${esc(u.email)}</dd><dt>소속</dt><dd>${esc(u.company)}${u.companyOther ? ` · ${esc(u.companyOther)}` : ''}</dd><dt>직급</dt><dd>${esc(u.position)}</dd><dt>근무 매장</dt><dd>${esc((u.places || []).join(', '))}</dd>${u.memo ? `<dt>메모</dt><dd>${esc(u.memo)}</dd>` : ''}</dl>
    <div style="display:flex;flex-direction:column;gap:12px">${permEditor(u, p, u.uid)}</div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-reject="${u.uid}">거절</button><button class="btn pri" data-approve="${u.uid}" ${p.stores.length ? '' : 'disabled'}>승인</button></div></div>`;
  }).join('');
}
function usersView() {
  const U = S.users.filter(u => u.status !== 'pending');
  const lab = { active: '<span class="pill p-ok">사용 중</span>', suspended: '<span class="pill p-warn">🔸 일시 정지</span>', resigned: '<span class="pill p-mute">퇴사</span>' };
  return `<div class="card" style="padding:8px 12px"><div class="tw"><table><thead><tr><th>이름</th><th>직급</th><th class="hide-s">소속</th><th>매장</th><th>권한</th><th>상태</th><th></th></tr></thead><tbody>
  ${U.map(u => `<tr><td class="nowrap"><b>${esc(u.name)}</b><div class="code">${esc(u.email)}</div></td><td class="nowrap">${esc(u.position)}</td><td class="hide-s">${esc(u.company)}</td><td style="font-size:12px">${(u.perms && u.perms.stores.length === STORES.length) ? '전체' : esc((u.perms ? u.perms.stores : []).map(storeName).join(', '))}</td>
    <td style="font-size:12px">${u.limited ? '수량만' : PERM_DEF.filter(d => u.perms && u.perms[d.k]).map(d => d.t.replace(' 등록', '').replace('실재고 입력·수정', '실재고').replace('사용자 승인', '승인')).join(' · ') || '보기만'}${u.owner ? ' · 정산' : ''}</td><td>${lab[u.status]}</td>
    <td class="nowrap">${u.owner ? '<span class="muted" style="font-size:12px">대표</span>' : u.status === 'active' ? `<button class="btn sm" data-edit="${u.uid}">권한</button> <button class="btn sm" data-susp="${u.uid}">정지</button> <button class="btn sm" data-resign="${u.uid}">퇴사 처리</button>` : `<button class="btn sm" data-restore="${u.uid}">복구</button>`}</td></tr>`).join('')}
  </tbody></table></div></div>
  <div class="note">퇴사 처리하면 그 직원은 앱을 켜 둔 상태에서도 바로 로그아웃되고, 서버에서 모든 자료 읽기가 막힙니다. 그 직원이 남긴 기록은 이름 그대로 남습니다.</div>`;
}
function confirmDrawer(title, body, okLabel, onOk) {
  S.ui.confirm = onOk;
  S.ui.drawer = () => `<div class="hd"><h3>${esc(title)}</h3><button class="x" data-close aria-label="닫기">×</button></div><div class="card">${body}</div><div class="row" style="justify-content:flex-end"><button class="btn" data-close>취소</button><button class="btn pri" id="confirmOk">${esc(okLabel)}</button></div>`;
  render();
}
function editDrawer(uid) {
  const u = S.users.find(x => x.uid === uid); S.ui.draft ||= {}; const p = S.ui.draft[uid] = { ...u.perms, stores: [...u.perms.stores] };
  S.ui.drawer = () => `<div class="hd"><h3>${esc(u.name)} 권한</h3><button class="x" data-close aria-label="닫기">×</button></div><div class="card" style="display:flex;flex-direction:column;gap:12px">${permEditor(u, S.ui.draft[uid], uid)}</div><div class="row" style="justify-content:flex-end"><button class="btn" data-close>취소</button><button class="btn pri" data-saveperm="${uid}">저장</button></div>`;
  render();
}
function storesAdmin() {
  return `<div class="grid2"><div class="card"><h2>매장</h2><table><tbody>${STORES.map((s, i) => `<tr><td class="n muted" style="width:1%">${i + 1}</td><td><span class="dot" style="background:${storeColor(s.id)};display:inline-block;margin-right:6px"></span>${esc(s.name)}</td><td class="n">${fmt(Object.keys(S.stock[s.id] || {}).length)}종</td></tr>`).join('')}</tbody></table>
    <div class="row" style="margin-top:10px"><input class="inp" placeholder="새 매장 이름" style="flex:1" id="newStore"><button class="btn" id="addStore">매장 추가</button></div></div>
    <div class="card"><h2>신청 때 고르는 소속 회사</h2><table><tbody>${COMPANIES.map((c, i) => `<tr><td class="n muted" style="width:1%">${i + 1}</td><td>${esc(c)}${c.startsWith('기타') ? ' <span class="pill p-warn">수량 보기만</span>' : ''}</td></tr>`).join('')}</tbody></table>
    <h2 style="margin-top:14px">직급</h2><div class="chips">${POSITIONS.map(p => `<span class="chip">${esc(p)}${SALES_REC.has(p) ? ' · 매출 추천' : ''}</span>`).join('')}</div></div></div>`;
}
function pwView() {
  return `<div class="card"><h2>토스포스 매출리포트 zip 비밀번호</h2><p class="muted" style="margin:0 0 10px;font-size:13px">매장마다 다른 비밀번호를 한 번만 넣어 두면, zip을 그대로 올려도 앱이 풉니다. 이 화면은 승인 권한자만 볼 수 있습니다.</p>
  <table><tbody>${STORES.map(s => `<tr><td class="nowrap">${esc(s.name)}</td><td><input class="inp" type="password" data-zpw="${s.id}" value="${esc(S.zipPw[s.id] || '')}" placeholder="비밀번호" autocomplete="off" style="max-width:220px"></td><td>${S.zipPw[s.id] ? '<span class="pill p-ok">✔ 등록됨</span>' : '<span class="pill p-mute">없음</span>'}</td></tr>`).join('')}</tbody></table></div>`;
}
function productsAdmin() {
  const dupBar = Object.entries(S.byCode).filter(([k, v]) => v.length > 1);
  const dupName = Object.values(S.byName).filter(v => v.length > 1);
  return `<div class="card"><h2>상품 목록 <span class="r">${fmt(S.products.length)}종</span></h2>
    <p class="muted" style="margin:0 0 10px;font-size:13px">새 상품은 엑셀로 한꺼번에 등록하거나 한 개씩 추가합니다. 같은 바코드는 두 번 등록되지 않습니다.</p>
    ${dupBar.length || dupName.length ? `<div class="alerts">${dupBar.map(([k, v]) => `<div class="al"><span class="ic">🔺</span><span class="tx"><b>바코드·품번 중복</b> ${esc(k)} — ${v.map(p => esc(p.name)).join(' / ')}</span></div>`).join('')}
    ${dupName.map(v => `<div class="al"><span class="ic">🔸</span><span class="tx"><b>같은 이름, 다른 품번</b> ${esc(v[0].name)} — ${v.map(p => `${esc(p.barcode || p.sku)}${p.price ? ` (${fmt(p.price)}원)` : ''}`).join(' / ')}</span></div>`).join('')}</div>` : '<div class="empty">✔ 중복 없음</div>'}</div>`;
}
function seedView() {
  return `<div class="card"><h2>처음 자료 넣기 (대표만, 한 번만)</h2><p style="margin:0 0 10px;font-size:13px"><b>smg-seed-수원.json</b> 파일을 고르면 수원 상품·재고·입출고 기록·매출·정산 자료를 한 번에 넣습니다. 이미 넣었다면 다시 하지 마세요 (같은 내용으로 덮어씁니다).</p>
  <button class="btn pri" id="seedBtn" ${S.ui.seeding ? 'disabled' : ''}>파일 고르기</button><div class="muted" style="margin-top:8px;font-weight:600">${esc(S.ui.seedMsg || '')}</div></div>`;
}
function moreView() {
  const nav = NAV.filter(n => n.show() && !['home', 'products', 'entry', 'count'].includes(n.id));
  return `${head('더보기')}<div class="card" style="padding:6px">${nav.map(n => `<button class="btn" style="width:100%;justify-content:flex-start;border:0;min-height:48px" data-nav="${n.id}">${esc(n.t)}</button>`).join('')}</div>`;
}

/* ───────── 로그인·신청 ───────── */
const GICON = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
function loginView() {
  const f = S.ui.apply ||= { name: '', company: '', other: '', places: [], position: '', phone: '', memo: '' };
  const sent = S.ui.applied;
  return `<div style="padding:16px"><div class="login">
    <div class="brand"><img src="logo-w.png" alt="SMG STORE"><b style="font-size:18px">SMG 재고관리</b><span style="font-size:13px;color:#cfcfd4">SMG 홀딩스 · 각 매장 직원용</span></div>
    ${S.mode === 'demo' ? '<div class="note">미리보기: 직원이 처음 들어오면 보는 화면입니다. 실제로는 구글 로그인 후 이 신청서를 냅니다.</div>' : ''}
    ${inAppNotice()}
    ${sent ? `<div class="card"><h2>🔸 승인 대기 중</h2><p style="margin:0">신청을 보냈습니다. 유명훈 본부장님이 승인하면 바로 쓸 수 있습니다.</p></div>${S.mode === 'live' ? '<button class="btn" id="logout2">다른 계정으로 로그인</button>' : ''}` : S.mode === 'live' && !S.ui.authUser ? `
    <p class="muted" style="margin:0;text-align:center">회사에서 쓰는 구글 계정으로 로그인한 뒤 사용 신청을 보내 주세요.</p>
    <button class="gbtn" id="gLogin">${GICON}Google 계정으로 로그인</button>` : `
    ${S.mode === 'live' ? '' : `<button class="gbtn" id="gLogin">${GICON}Google 계정으로 계속하기</button>`}
    <div class="card" style="display:flex;flex-direction:column;gap:12px"><h2>사용 신청</h2>
      <div class="field"><label for="aName">이름</label><input class="inp" id="aName" value="${esc(f.name)}"></div>
      <div class="field"><label>이메일</label><input class="inp" value="${esc(S.ui.authUser ? S.ui.authUser.email : '구글 로그인하면 자동으로 들어갑니다')}" disabled></div>
      <div class="field"><label for="aComp">소속 회사</label><select class="inp" id="aComp"><option value="">선택</option>${COMPANIES.map(c => `<option ${f.company === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
      ${f.company === '기타(직접 입력)' ? `<div class="field"><label for="aOther">회사 이름</label><input class="inp" id="aOther" value="${esc(f.other)}"><span class="muted" style="font-size:12px">기타 소속은 재고 수량 확인만 가능합니다</span></div>` : ''}
      <div class="field"><label>근무 매장 (여러 개 가능)</label><div class="checks">${WORK_PLACES.map(p => `<label class="ck"><input type="checkbox" data-place="${esc(p)}" ${f.places.includes(p) ? 'checked' : ''}><span class="t">${esc(p)}</span></label>`).join('')}</div></div>
      <div class="field"><label for="aPos">직급</label><select class="inp" id="aPos"><option value="">선택</option>${POSITIONS.map(p => `<option ${f.position === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div>
      <div class="formgrid"><div class="field"><label for="aPhone">휴대폰 (선택)</label><input class="inp" id="aPhone" inputmode="tel" value="${esc(f.phone)}"></div><div class="field"><label for="aMemo">메모 (선택)</label><input class="inp" id="aMemo" value="${esc(f.memo)}" placeholder="예: 수원 재고 담당"></div></div>
      <button class="btn pri" id="aSend">승인 신청 보내기</button></div>`}
    ${installBtn()}
    ${S.mode === 'demo' ? '<button class="btn" id="backDemo">미리보기로 돌아가기</button>' : ''}
  </div></div>
  ${S.ui.drawer ? `<div class="ov" id="ov"><div class="dr" role="dialog" aria-modal="true">${S.ui.drawer()}</div></div>` : ''}`;
}
function bindLogin() {
  const f = S.ui.apply; const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); };
  on('#aName', 'input', e => f.name = e.target.value); on('#aOther', 'input', e => f.other = e.target.value);
  on('#aPhone', 'input', e => f.phone = e.target.value); on('#aMemo', 'input', e => f.memo = e.target.value);
  on('#aComp', 'change', e => { f.company = e.target.value; render(); }); on('#aPos', 'change', e => f.position = e.target.value);
  document.querySelectorAll('[data-place]').forEach(c => c.addEventListener('change', e => { const p = e.target.dataset.place; f.places = e.target.checked ? [...f.places, p] : f.places.filter(x => x !== p); }));
  on('#aSend', 'click', () => {
    const miss = [!f.name && '이름', !f.company && '소속 회사', f.company.startsWith('기타') && !f.other && '회사 이름', !f.places.length && '근무 매장', !f.position && '직급'].filter(Boolean);
    if (miss.length) { alertBox(`${miss.join(', ')}을(를) 넣어 주세요.`); return; }
    if (S.mode === 'demo') S.users.push({ uid: 'u-new' + Date.now(), name: f.name, email: '(구글 계정)', company: f.company, companyOther: f.other, position: f.position, places: f.places, phone: f.phone, memo: f.memo, status: 'pending', createdAt: new Date().toLocaleString('ko-KR'), sample: true });
    if (S.mode === 'live') { DB.apply(f).then(() => { S.ui.applied = true; render(); }).catch(e => alertBox('신청을 보내지 못했습니다: ' + e.message)); return; }
    S.ui.applied = true; render();
  });
  on('#logout2', 'click', () => FB.signOut());
  on('#gLogin', 'click', () => { if (S.mode === 'demo') alertBox('미리보기에서는 구글 로그인을 하지 않습니다. 아래 신청서만 둘러보세요.'); else FB.signIn(); });
  document.querySelectorAll('[data-install]').forEach(b => b.onclick = doInstall);
  document.querySelectorAll('[data-openext]').forEach(b => b.onclick = openExternal);
  document.querySelectorAll('[data-copylink]').forEach(b => b.onclick = copyLink);
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { S.ui.drawer = null; render(); });
  on('#ov', 'click', e => { if (e.target.id === 'ov') { S.ui.drawer = null; render(); } });
  on('#backDemo', 'click', () => { S.ui.showApply = false; S.ui.applied = false; S.ui.apply = null; render(); });
}
/* ───────── 홈 화면 설치 ───────── */
const UA = navigator.userAgent || '';
const ENV = {
  ios: /iPhone|iPad|iPod/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1),
  android: /Android/i.test(UA),
  inApp: /KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(UA),
  kakao: /KAKAOTALK/i.test(UA),
  standalone: () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true,
};
let installEvt = null;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; if (S.ready) render(); });
window.addEventListener('appinstalled', () => { installEvt = null; S.ui.installed = true; if (S.ready) render(); });
function installBtn(cls = '') {
  if (ENV.standalone() || S.ui.installed) return '';
  return `<button class="btn ${cls}" data-install>📲 홈 화면에 앱 설치</button>`;
}
function inAppNotice() {
  if (!ENV.inApp) return '';
  return `<div class="note warn"><b>🔸 카카오톡 같은 앱 안에서 열렸습니다.</b><br>여기서는 구글 로그인과 앱 설치가 되지 않습니다. ${ENV.ios ? '사파리' : '크롬'}로 다시 열어 주세요.
    <div class="row" style="margin-top:8px"><button class="btn sm pri" data-openext>${ENV.ios ? '사파리로 열기' : '크롬으로 열기'}</button><button class="btn sm" data-copylink>주소 복사</button></div></div>`;
}
function installGuide() {
  const ios = `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px"><li><b>사파리</b>로 이 주소를 엽니다 (크롬·카카오톡 안에서는 안 됩니다).</li><li>화면 아래 <b>공유 버튼(□↑)</b>을 누릅니다. 안 보이면 오른쪽 아래 <b>⋯</b>을 먼저 누르세요.</li><li>목록을 아래로 내려 <b>홈 화면에 추가</b> → 오른쪽 위 <b>추가</b></li><li>홈 화면에 생긴 <b>SMG 재고</b> 아이콘으로 엽니다.</li></ol>`;
  const and = `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px"><li><b>크롬</b>으로 이 주소를 엽니다.</li><li>오른쪽 위 <b>⋮</b> 메뉴를 누릅니다.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b> → <b>설치</b></li><li>홈 화면에 생긴 <b>SMG 재고</b> 아이콘으로 엽니다.</li></ol>`;
  return `<div class="hd"><h3>홈 화면에 앱 설치</h3><button class="x" data-close aria-label="닫기">×</button></div>
  ${inAppNotice()}
  ${ENV.ios ? `<div class="card"><h2>아이폰·아이패드</h2>${ios}</div><div class="card"><h2>안드로이드·갤럭시</h2>${and}</div>` : `<div class="card"><h2>안드로이드·갤럭시</h2>${and}</div><div class="card"><h2>아이폰·아이패드</h2>${ios}</div>`}
  <div class="card"><h2>PC (크롬·엣지)</h2><p style="margin:0">주소창 오른쪽 끝의 <b>설치 아이콘(⊕ 또는 모니터 모양)</b>을 누르고 <b>설치</b>합니다.</p></div>
  <p class="muted" style="font-size:13px;margin:0">설치한 앱은 주소창 없이 열리고, 로그인은 처음 한 번만 하면 됩니다. 앱을 고치면 다음에 열 때 자동으로 새 버전이 뜹니다.</p>`;
}
async function doInstall() {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; if (r && r.outcome === 'accepted') toast('설치했습니다. 홈 화면의 SMG 재고 아이콘으로 여세요'); else render(); return; }
  S.ui.drawer = installGuide; render();
}
const APP_URL = 'https://killon2000-star.github.io/smg-inventory/';
function openExternal() {
  if (ENV.android) location.href = 'intent://' + APP_URL.replace('https://', '') + '#Intent;scheme=https;package=com.android.chrome;end';
  else if (ENV.kakao) location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(APP_URL);
  else copyLink();
}
function copyLink() { (navigator.clipboard ? navigator.clipboard.writeText(APP_URL) : Promise.reject()).then(() => alertBox('주소를 복사했습니다. ' + (ENV.ios ? '사파리' : '크롬') + ' 주소창에 붙여넣어 주세요.')).catch(() => alertBox(APP_URL)); }
function alertBox(t) { const d = document.createElement('div'); d.className = 'toast'; d.textContent = t; document.body.appendChild(d); setTimeout(() => d.remove(), 2800); }

/* ───────── 바코드 스캔 ───────── */
async function scan(cb) {
  if (S.mode === 'demo') { alertBox('미리보기 화면에서는 카메라를 쓸 수 없습니다. 실제 앱에서는 휴대폰 카메라로 바코드를 읽습니다.'); return; }
  if (!window.Html5Qrcode) await loadScript('https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js');
  S.ui.drawer = () => `<div class="hd"><h3>바코드 스캔</h3><button class="x" data-close aria-label="닫기">×</button></div><div id="reader" style="width:100%;background:#000;border-radius:8px;overflow:hidden"></div><p class="muted">바코드를 화면 가운데에 맞춰 주세요.</p>`;
  render();
  const qr = new Html5Qrcode('reader');
  S.ui.stopScan = () => qr.stop().catch(() => { });
  qr.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 260, height: 120 } }, txt => { S.ui.stopScan(); S.ui.drawer = null; cb(txt); }).catch(() => { S.ui.drawer = null; render(); alertBox('카메라를 열지 못했습니다. 브라우저에서 카메라 권한을 허용해 주세요.'); });
}
function onScanned(code) {
  const c = findProduct(code);
  if (!c.length) { alertBox(`🔺 ${code} — 등록된 상품이 아닙니다`); return; }
  if (c.length > 1) alertBox(`🔸 같은 바코드 상품이 ${c.length}개입니다. 첫 번째를 열었습니다.`);
  if (S.view === 'inbound' && S.ui.ib && S.ui.ib !== 'new') { const ib = S.inbounds.find(x => x.id === S.ui.ib); const it = ib && ib.items.find(x => x.pid === c[0].id); if (it) { it.actual = (it.actual || 0) + 1; if (DB.saveInbound) DB.saveInbound(ib); toast(`${it.name} 실제 ${it.actual}개`); } else alertBox('🔸 이 입고 예정에 없는 상품입니다'); return; }
  if (S.view === 'entry') { addLine(c[0].id, 1); render(); }
  else if (S.view === 'count') { S.ui.countQ = code; render(); }
  else openProduct(c[0].id);
}
function openProduct(pid) { S.ui.drawer = () => productDrawer(pid); render(); }

/* ───────── 이벤트 ───────── */
function bind() {
  const app = $('#app');
  app.onclick = async ev => {
    const t = ev.target.closest('button,[data-pid],label,input'); if (!t) return;
    const d = t.dataset;
    if (d.install != null) { doInstall(); return; }
    if (d.openext != null) { openExternal(); return; }
    if (d.copylink != null) { copyLink(); return; }
    if (t.id === 'storeBtn') { S.ui.storeMenu = !S.ui.storeMenu; render(); return; }
    if (t.id === 'scrim' || t.id === 'smClose') { if (S.ui.storeEdit) await saveStoreOrder(); S.ui.storeEdit = false; S.ui.storeMenu = false; render(); return; }
    if (t.id === 'smOrder') { S.ui.storeEdit = true; render(); return; }
    if (d.mv) { const [id, dir] = d.mv.split(':'); moveStore(id, +dir); render(); return; }
    if (t.id === 'smOrderDone') { await saveStoreOrder(); S.ui.storeEdit = false; toast('매장 순서를 저장했습니다'); return; }
    if (t.id === 'smAll') { S.stores = [...myStores()]; S.sumStores = null; S.ui.range = null; S.ui.storeMenu = false; render(); return; }
    if (d.sg) { S.stores = [d.sg]; S.sumStores = null; S.ui.storeMenu = false; S.ui.range = null; render(); return; }
    if (d.nav) { if (d.nav === 'more' && S.view === 'more') return; S.view = d.nav; S.ui.drawer = null; window.scrollTo(0, 0); render(); return; }
    if (d.al != null) { const a = alerts(S.stores)[+d.al]; if (a && a.go) { a.go(); render(); } return; }
    if (d.pid && ev.target.tagName !== 'INPUT') { openProduct(d.pid); return; }
    if (d.close != null) { if (S.ui.stopScan) S.ui.stopScan(); S.ui.drawer = null; S.ui.posPreview = null; render(); return; }
    if (t.id === 'ov' && ev.target === t) { S.ui.drawer = null; render(); return; }
    if (d.pf) { S.ui.f = d.pf; render(); return; }
    if (t.id === 'scanBtn' || t.id === 'scanBtn2') { scan(onScanned); return; }
    if (d.quick) {
      S.ui.drawer = null;
      if (d.quick === 'count') { S.view = 'count'; S.ui.countQ = (S.P[d.qp] || {}).barcode || (S.P[d.qp] || {}).name || ''; }
      else { S.view = 'entry'; S.ui.entry = newEntry(d.quick); if (d.qp) addLine(d.qp, 1); }
      render(); return;
    }
    if (d.et) { const e = S.ui.entry; e.type = d.et; render(); return; }
    if (d.em) { S.ui.entry.mode = d.em; render(); return; }
    if (d.ld != null) { S.ui.entry.lines.splice(+d.ld, 1); render(); return; }
    if (t.id === 'eClear') { S.ui.entry.lines = []; render(); return; }
    if (t.id === 'eSave') { await saveEntry(); return; }
    if (t.id === 'fileBtn') { pickFile('.xlsx,.xls,.csv', f => readFile(f)); return; }
    if (t.id === 'posFileBtn') { const st = $('#posStore').value; pickFile('.zip,.xlsx', f => readPos(f, st)); return; }
    if (t.id === 'seedBtn') {
      pickFile('.json,application/json', f => {
        S.ui.seeding = true; S.ui.seedMsg = `${f.name} 읽는 중…`; render();
        f.text().then(JSON.parse).then(d => DB.seed(d, (a, b) => { S.ui.seedMsg = `저장 중 ${fmt(a)} / ${fmt(b)}`; render(); }))
          .then(n => { S.ui.seedMsg = `✔ ${fmt(n)}건 저장했습니다. 홈으로 가서 재고를 확인해 주세요.`; })
          .catch(e => { S.ui.seedMsg = '🔺 ' + (e.message || e); })
          .finally(() => { S.ui.seeding = false; render(); });
      }); return;
    }
    if (d.ib) { S.ui.ib = d.ib; S.ui.ibMsg = null; S.ui.ibF = 'all'; render(); return; }
    if (t.id === 'ibNew') { S.ui.ib = 'new'; S.ui.ibForm = null; render(); return; }
    if (t.id === 'ibBack') { S.ui.ib = null; render(); return; }
    if (d.ibf) { S.ui.ibF = d.ibf; render(); return; }
    if (t.id === 'ibPlanFile') { pickFile('.xlsx,.xls,.csv', f => fileRows(f).then(x => ibPlanLoaded(x)).catch(e => { S.ui.ibForm.err = e.message; render(); })); return; }
    if (t.id === 'ibPlanLinkGo') { linkRows($('#ibPlanLink').value.trim()).then(x => ibPlanLoaded(x)).catch(e => { S.ui.ibForm.err = e.message; render(); }); return; }
    if (t.id === 'ibCreate') { await ibCreate(); return; }
    if (t.id === 'ibActFile') { const ib = S.inbounds.find(x => x.id === S.ui.ib); pickFile('.xlsx,.xls,.csv', f => fileRows(f).then(x => ibActLoaded(ib, x)).catch(e => { S.ui.ibMsg = { t: '🔺 ' + e.message, bad: true }; render(); })); return; }
    if (t.id === 'ibActLinkGo') { const ib = S.inbounds.find(x => x.id === S.ui.ib); linkRows($('#ibActLink').value.trim()).then(x => ibActLoaded(ib, x)).catch(e => { S.ui.ibMsg = { t: '🔺 ' + e.message, bad: true }; render(); }); return; }
    if (t.id === 'ibConfirm') { const ib = S.inbounds.find(x => x.id === S.ui.ib); confirmDrawer('실제 수량으로 입고 확정', `<p style="margin:0">${esc(ib.title)} — 실제 수량으로 재고에 더합니다. 확정한 뒤에는 수량을 고칠 수 없고, 차이는 기록으로 남습니다.</p>`, '입고 확정', () => ibConfirm(ib)); return; }
    if (t.id === 'plNew') { S.ui.placeForm = null; S.ui.drawer = placeDrawer; render(); return; }
    if (d.plk) { S.ui.placeForm.kind = d.plk; render(); return; }
    if (t.id === 'plSave') { await savePlace(); return; }
    if (t.id === 'linkGo') { readLink($('#linkIn').value.trim()); return; }
    if (t.id === 'impCancel') { S.ui.imp = null; render(); return; }
    if (t.id === 'impUse') { for (const r of S.ui.imp.rows) if (r.pid && r.qty > 0) addLine(r.pid, r.qty, r.dup ? `파일 ${r.dup}줄과 같은 상품 — 수량 합침` : null); S.ui.imp = null; S.ui.entry.mode = 'hand'; render(); return; }
    if (t.id === 'cSave') { await saveCount(); return; }
    if (t.id === 'cReset') { S.ui.counts[S.stores[0]] = {}; render(); return; }
    if (d.recv) { await receive(d.recv); return; }
    if (d.rt != null) { S.ui.recType = d.rt; render(); return; }
    if (d.su) { S.ui.salesUnit = d.su; S.ui.range = null; render(); return; }
    if (d.qr != null) { S.ui.range = { unit: S.ui.salesUnit, ab: S._quick[+d.qr][1]() }; render(); return; }
    if (t.id === 'posBtn') { S.ui.posPreview = null; S.ui.drawer = posDrawer; render(); return; }
    if (t.id === 'posSave') { await savePos(); return; }
    if (d.at) { S.ui.adminTab = d.at; render(); return; }
    if (t.id === 'showApply') { S.ui.showApply = true; render(); return; }
    if (d.approve) { const u = S.users.find(x => x.uid === d.approve); const p = S.ui.draft[u.uid]; u.perms = { stores: p.stores, move: !p.lim && !!p.move, count: !p.lim && !!p.count, sales: !p.lim && !!p.sales, approve: !p.lim && !!p.approve }; u.limited = p.lim; u.status = 'active'; u.approvedAt = today(); u.approvedBy = S.user.name; await DB.saveUser(u); toast(`${u.name} 승인했습니다`); return; }
    if (d.reject) { const u = S.users.find(x => x.uid === d.reject); confirmDrawer('신청 거절', `<p style="margin:0">${esc(u.name)}의 신청을 거절할까요?</p>`, '거절', async () => { S.users = S.users.filter(x => x !== u); if (DB.deleteUser) await DB.deleteUser(u.uid); toast('거절했습니다'); }); return; }
    if (d.resign) { const u = S.users.find(x => x.uid === d.resign); confirmDrawer(`${u.name} 퇴사 처리`, `<p style="margin:0 0 8px"><b>${esc(u.name)}</b> (${esc(u.position)}) 을 퇴사 처리할까요?</p><ul style="margin:0;padding-left:18px;font-size:13px"><li>앱을 켜 둔 상태여도 바로 로그아웃됩니다</li><li>같은 구글 계정으로 다시 들어오거나 재신청할 수 없습니다</li><li>남긴 입출고 기록은 이름 그대로 남습니다</li></ul>`, '퇴사 처리', async () => { u.status = 'resigned'; u.resignedAt = today(); u.resignedBy = S.user.name; await DB.saveUser(u); toast(`${u.name} 퇴사 처리했습니다`); }); return; }
    if (d.susp) { const u = S.users.find(x => x.uid === d.susp); u.status = 'suspended'; await DB.saveUser(u); toast(`${u.name} 일시 정지했습니다`); return; }
    if (d.restore) { const u = S.users.find(x => x.uid === d.restore); u.status = 'active'; await DB.saveUser(u); toast(`${u.name} 다시 사용하게 했습니다`); return; }
    if (d.edit) { editDrawer(d.edit); return; }
    if (d.saveperm) { const u = S.users.find(x => x.uid === d.saveperm); const p = S.ui.draft[u.uid]; u.perms = { stores: p.stores, move: !!p.move, count: !!p.count, sales: !!p.sales, approve: !!p.approve }; await DB.saveUser(u); S.ui.drawer = null; toast('권한을 저장했습니다'); return; }
    if (t.id === 'confirmOk') { const f = S.ui.confirm; S.ui.drawer = null; S.ui.confirm = null; await f(); render(); return; }
    if (t.id === 'addStore') { alertBox('매장 추가는 실제 앱에서 저장됩니다. 미리보기에서는 4곳 고정입니다.'); return; }
    if (t.id === 'logout') { FB.signOut(); return; }
  };
  app.onchange = ev => {
    const t = ev.target, d = t.dataset;
    if (t.id === 'roleSel') { setUser(S.users.find(u => u.uid === t.value)); render(); return; }
    if (d.sc) { const on = t.checked; let s = S.stores.filter(x => x !== d.sc); if (on) s.push(d.sc); if (!s.length) s = [d.sc]; S.stores = STORES.map(x => x.id).filter(x => s.includes(x)); S.sumStores = null; S.ui.range = null; render(); return; }
    if (t.id === 'pip') { S.ui.ip = t.value; render(); return; }
    if (t.id === 'cip') { S.ui.countIp = t.value; render(); return; }
    if (t.id === 'eDate') S.ui.entry.date = t.value;
    if (t.id === 'eStore') { S.ui.entry.store = t.value; render(); return; }
    if (t.id === 'eTo') { S.ui.entry.to = t.value; render(); if (t.value === '__custom') setTimeout(() => $('#eToText') && $('#eToText').focus(), 0); return; }
    if (['ibStore', 'ibDate', 'ibFrom', 'ibIp', 'ibTitle'].includes(t.id)) { S.ui.ibForm[{ ibStore: 'store', ibDate: 'date', ibFrom: 'from', ibIp: 'ip', ibTitle: 'title' }[t.id]] = t.value; return; }
    if (d.iba != null) { const ib = S.inbounds.find(x => x.id === S.ui.ib); ib.items[+d.iba].actual = t.value === '' ? null : Math.max(0, parseInt(t.value, 10)); if (DB.saveInbound) DB.saveInbound(ib); render(); return; }
    if (t.id === 'ePlace') { S.ui.entry.place = t.value; render(); return; }
    if (t.id === 'eFrom') { S.ui.entry.from = t.value; render(); return; }
    if (['plName', 'plStart', 'plEnd', 'plAddr', 'plPerson', 'plMemo'].includes(t.id)) { const k = { plName: 'name', plStart: 'start', plEnd: 'end', plAddr: 'addr', plPerson: 'person', plMemo: 'memo' }[t.id]; S.ui.placeForm[k] = t.value; if (k === 'start' && (!S.ui.placeForm.end || S.ui.placeForm.end < t.value)) S.ui.placeForm.end = t.value; render(); return; }
    if (t.id === 'ePartner') { S.ui.entry.partner = t.value; render(); return; }
    if (t.id === 'eMemo') S.ui.entry.memo = t.value;
    if (d.lq != null) { S.ui.entry.lines[+d.lq].qty = Math.max(0, parseInt(t.value || '0', 10)); render(); return; }
    if (d.ip != null) { const r = S.ui.imp.rows[+d.ip]; r.pid = t.value; render(); return; }
    if (d.cnt) { const st = S.stores[0]; const v = t.value === '' ? null : Math.max(0, parseInt(t.value, 10)); if (v == null) delete S.ui.counts[st][d.cnt]; else S.ui.counts[st][d.cnt] = v; render(); return; }
    if (t.id === 'ra' || t.id === 'rb') { const a = $('#ra').value, b = $('#rb').value; if (a && b && a <= b) S.ui.range = { unit: S.ui.salesUnit, ab: [a, b] }; render(); return; }
    if (d.sum) { const cur = (S.sumStores || S.stores).filter(s => s !== d.sum); if (t.checked) cur.push(d.sum); S.sumStores = cur.length ? cur : [d.sum]; render(); return; }
    if (t.id === 'setM') { S.ui.settleMonth = t.value; render(); return; }
    if (d.pst) { const [id, s] = d.pst.split(':'); const p = S.ui.draft[id]; p.stores = t.checked ? [...new Set([...p.stores, s])] : p.stores.filter(x => x !== s); render(); return; }
    if (d.pp) { const [id, k] = d.pp.split(':'); S.ui.draft[id][k] = t.checked; return; }
    if (d.zpw) { S.zipPw[d.zpw] = t.value; if (DB.saveZip) DB.saveZip(S.zipPw).then(() => toast('비밀번호를 저장했습니다')); else render(); return; }
  };
  const pq = $('#pq'); if (pq) pq.oninput = debounce(() => { S.ui.q = pq.value; rerenderKeep('#pq'); });
  const cq = $('#cq'); if (cq) cq.oninput = debounce(() => { S.ui.countQ = cq.value; rerenderKeep('#cq'); });
  const rq = $('#rq'); if (rq) rq.oninput = debounce(() => { S.ui.recQ = rq.value; rerenderKeep('#rq'); });
  const eq = $('#eq');
  if (eq) {
    eq.oninput = debounce(() => {
      const q = norm(eq.value); const box = $('#eSug'); if (!q) { box.innerHTML = ''; return; }
      const hit = S.products.filter(p => norm(p.name).includes(q) || (p.barcode || '').includes(eq.value.trim()) || norm(p.sku).includes(q)).slice(0, 8);
      box.innerHTML = hit.length ? `<div class="alerts">${hit.map(p => `<button class="al" style="border:0;text-align:left;width:100%" data-add="${esc(p.id)}"><span class="tx">${esc(p.name)} <span class="code">${esc(p.barcode || p.sku)}</span></span><span class="num">재고 ${fmt(stockOf(S.ui.entry.store, p.id))}</span></button>`).join('')}</div>` : '<div class="muted" style="padding:6px">🔺 찾는 상품이 없습니다. 새 상품은 관리 › 상품 목록에서 등록합니다.</div>';
      box.querySelectorAll('[data-add]').forEach(b => b.onclick = () => { addLine(b.dataset.add, 1); render(); setTimeout(() => $('#eq') && $('#eq').focus(), 0); });
    }, 120);
    eq.onkeydown = e => { if (e.key === 'Enter') { const v = eq.value.trim(); const c = findProduct(v); if (c.length) { addLine(c[0].id, 1); render(); setTimeout(() => $('#eq') && $('#eq').focus(), 0); } else { const b = $('#eSug [data-add]'); if (b) b.click(); } } };
  }
  const drop = $('#drop');
  if (drop && $('#fileBtn')) { drop.ondragover = e => { e.preventDefault(); drop.classList.add('on'); }; drop.ondragleave = () => drop.classList.remove('on'); drop.ondrop = e => { e.preventDefault(); drop.classList.remove('on'); if (e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); }; }
  const ov = $('#ov'); if (ov) ov.onclick = e => { if (e.target === ov) { if (S.ui.stopScan) S.ui.stopScan(); S.ui.drawer = null; render(); } };
  document.onkeydown = e => { if (e.key === 'Escape' && (S.ui.drawer || S.ui.storeMenu)) { S.ui.drawer = null; S.ui.storeMenu = false; render(); } };
}
function debounce(fn, ms = 180) { let t; return () => { clearTimeout(t); t = setTimeout(fn, ms); }; }
function rerenderKeep(sel) { const el = $(sel); const pos = el ? el.selectionStart : null; render(); const n = $(sel); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) { } } }
function setUser(u) {
  S.user = u;
  let ord = u && u.storeOrder; try { ord = ord || JSON.parse(localStorage.getItem('smg-store-order:' + (u ? u.uid : '')) || 'null'); } catch (e) { }
  applyStoreOrder(ord || DEFAULT_ORDER);
  const mine = myStores();
  S.stores = S.stores.filter(s => mine.includes(s)); if (!S.stores.length) S.stores = [mine[0] || 'suwon'];
  S.sumStores = null; S.ui.range = null; S.ui.drawer = null; S.ui.entry = null;
}

/* ───────── Firebase 연결 (실제 앱) ───────── */
const FB = window.SMG_FIREBASE ? window.SMG_FIREBASE(S, { render, setUser, indexProducts, STORES, OWNER_EMAIL }) : null;

/* ───────── 시작 ───────── */
async function start() {
  try {
    if (FB) { S.mode = 'live'; DB = FB.backend; await FB.start(); }
    else { await DB.load(); indexProducts(); setUser(S.users[0]); }
    S.ready = true; render();
  } catch (err) {
    $('#app').innerHTML = `<div class="login"><div class="note bad" style="margin:20px">🔺 앱을 여는 중 문제가 생겼습니다: ${esc(err.message || err)}</div></div>`;
  }
}
window.SMGApp = { S, render, indexProducts, setUser };
start();
})();
