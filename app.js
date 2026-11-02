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
const SALES_REC = new Set(['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '대리', '수석팀장', '팀장', '부팀장']);   // 부팀장 이상 (대표 지시 2026-10-30)     // 팀장 이상 → 매출 보기 추천
const COUNT_REC = new Set(['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '대리', '수석팀장', '팀장', '부팀장', '매니저']); // 매장 책임자 → 실재고 추천
const WORK_PLACES = STORES.map(s => s.name).concat(['본사', '창고']);
const TYPES = [
  { id: '입고', sign: +1, d: '상품이 매장에 들어옴' },
  { id: '판매', sign: -1, d: 'POS 밖에서 판매한 수량 (POS 판매는 매출 파일로 자동 차감)' },
  { id: '매장 이동', sign: -1, d: '다른 매장·국대출판물류(물류창고)·외부 장소로 보냄 — 받는 매장이 확인하면 그 매장 재고에 더해짐', to: true },
  { id: '창고 보관', sign: -1, d: '판매 종료 후 창고로 보냄' },
  { id: '창고에서 가져옴', sign: +1, d: '창고에 보관하던 상품을 다시 매장으로' },
  { id: '외부에서 돌아옴', sign: +1, d: '국대출판물류(물류창고)·행사장·팝업 등에 보냈던 상품이 매장으로 돌아옴', from: true },
  { id: '타 업체 이동', sign: -1, d: '다른 회사로 보냄', partner: true },
  { id: '반품', sign: -1, d: '공급처로 돌려보냄', partner: true },
  { id: '폐기', sign: -1, d: '파손·불량으로 폐기' },
];
const COUNT_TYPE = '실사 조정';
const PLACE_KINDS = ['행사장', '팝업', '물류창고', '창고', '거래처', '기타'];
// 늘 쓰는 고정 장소 (대표 지시 2026-11-01: SMG 홀딩스가 계약해 쓰는 물류창고). 보낸·받은 수량은 places/{id}.q 에 쌓임
const FIXED_PLACES = [{ id: 'P-GUKDAE', name: '국대출판물류', kind: '물류창고', addr: 'SMG 홀딩스 계약 물류창고', fixed: true }];
const allPlaces = () => FIXED_PLACES.map(f => ({ ...f, q: ((S.places || []).find(p => p.id === f.id) || {}).q || {} })).concat((S.places || []).filter(p => !FIXED_PLACES.some(f => f.id === p.id)));
const PERM_DEF = [
  { k: 'move', t: '입출고 등록', s: '입고·이동·창고·폐기 등록, 파일·링크로 올리기' },
  { k: 'count', t: '실재고 입력·수정', s: '매장 책임자. 실사 수량 반영' },
  { k: 'sales', t: '매출 보기', s: '부팀장 이상. 매출 화면, 토스포스 파일 올리기' },
  { k: 'approve', t: '사용자 승인', s: '가입 승인, 권한 변경, 퇴사 처리' },
];

const DEFAULT_ORDER = STORES.map(s => s.id);
const APP_VERSION = '2026-11-02 18:30';   // 앱 화면을 마지막으로 고친 시각 (한국 시간)
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
// 'YYYY-MM-DDTHH:mm…' (UTC ISO 또는 날짜만) → '10/30 02:25' 한국 시간
const kst = iso => { if (!iso) return ''; if (/^\d{4}-\d{2}-\d{2}(T00:00)?$/.test(iso)) return md(iso.slice(0, 10)); const t = new Date(Date.parse(iso) + 9 * 3600e3).toISOString(); return `${md(t.slice(0, 10))} ${t.slice(11, 16)}`; };
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const norm = s => String(s || '').toLowerCase().replace(/^에바30주년팝업_/, '').replace(/[\s\[\]()!_\-.,~·&]/g, '');
const storeName = id => (STORES.find(s => s.id === id) || {}).name || id;
const storeColor = id => `var(--s-${id})`;
const SHORT = { suwon: '수원', boxcafe: 'BOX CAFE', museum: 'MUSEUM 홍대', omake: 'CAFE 오마케', limission: '리밋션 홍대' };   // 오마케는 온라인쇼핑몰과 헷갈리지 않게 항상 'CAFE 오마케' (대표 지시 11/2)
const shortName = id => SHORT[id] || storeName(id);
const sdot = id => `<span class="dot" style="background:${storeColor(id)};display:inline-block;margin-right:4px;vertical-align:1px"></span>`;
const ICON = {
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  box: '<path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 7v10l9 4 9-4V7"/><path d="M12 11v10"/>',
  plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',
  check: '<path d="M4 5h16v14H4z"/><path d="M8 12l3 3 5-6"/>',
  more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
  truck: '<path d="M3 6h11v10H3z"/><path d="M14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>',
  swap: '<path d="M4 8h14l-3-3M20 16H6l3 3"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  chart: '<path d="M4 20V4M4 20h16"/><path d="M8 16v-4M12 16V8M16 16v-6"/>',
  won: '<circle cx="12" cy="12" r="9"/><path d="M7 9l2 6 3-6 3 6 2-6M6.5 12h11"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6"/>',
  star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/>',
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
    S.settle = d.settle; S.settleRules = d.settleRules || null;
    S.users = demoUsers();
  },
  async saveMoves(list) { /* 미리보기: 화면 안에서만 반영 */ return true; },
  async saveSalesDay() { return true; },
  async saveMachMonth() { return true; },
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
// 누가 올렸는지: 모든 기록에 이름(by)과 회사(co)를 함께 남김 (대표 지시 2026-11-01: 매출·재고 파일 모두 회사와 이름 확인)
const userCo = u => !u ? '' : (u.company === '기타(직접 입력)' ? (u.companyOther || '기타') : (u.company || (u.owner ? '온인터내셔널' : '')));
// 이름이 바뀐 사람(예: 영어 이름 → 실명)도 지금 이름·직급으로 보여 줌
const akaUser = (by, co) => [S.user, ...(S.users || [])].filter(Boolean).find(x => (x.name === by || (x.aka || []).includes(by)) && (!co || userCo(x) === co));
const whoText = (by, co) => { if (!by) return ''; const u = akaUser(by, co); return u ? `${u.name}${u.position ? ' ' + u.position : ''} (${userCo(u) || co || ''})` : `${by}${co ? ` (${co})` : ''}`; };
function stampMoves(list, file) { for (const m of list) { if (!m.co) m.co = userCo(S.user); if (S.user && !m.uid) m.uid = S.user.uid; if (m.by === '자동(POS)') m.upBy = S.user ? S.user.name : ''; if (file && !m.file) m.file = file; } return list; }

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
const canSettle = () => isOwner();   // 정산은 대표만 (대표 지시 10/31: 정산 담당자 없음)
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
  { id: 'ipnow', t: 'IP 현황', show: () => true },
  { id: 'products', t: '상품·재고', i: 'box', show: () => true },
  { id: 'entry', t: '입출고 등록', i: 'plus', show: () => can('move') },
  { id: 'count', t: '실사', i: 'check', show: () => can('count') },
  { id: 'inbound', t: '입고 확인', show: () => can('move') },
  { id: 'transfer', t: '매장 이동', show: () => can('move') },
  { id: 'records', t: '기록', show: () => !limited() },
  { id: 'files', t: '파일 이력', show: () => !limited() && (can('approve') || can('sales') || can('move')) },
  { id: 'sales', t: '매출', grp: '관리자', show: () => can('sales') },
  { id: 'collab', t: '콜라보 분석', show: () => can('sales') },
  { id: 'settle', t: '정산', show: () => canSettle() },
  { id: 'admin', t: '관리', show: () => can('approve') || isOwner() },
];
// 글칸에서 바로 버튼을 누를 때: 칸이 바뀌어 화면을 다시 그리면 누른 버튼이 사라져 클릭이 안 먹힘 → 손을 뗄 때까지 미룸
let inChange = false, ptrDown = false, renderPending = false;
document.addEventListener('pointerdown', () => { ptrDown = true; }, true);
const ptrUp = () => setTimeout(() => { ptrDown = false; if (renderPending) { renderPending = false; render(); } }, 0);
document.addEventListener('pointerup', ptrUp, true); document.addEventListener('pointercancel', ptrUp, true);
// 이전 화면으로: 화면이 바뀔 때마다 직전 화면을 기억 (휴대폰 뒤로가기 버튼과도 연결)
const navStack = []; let navLast = null, navBackNow = false;
const navSnap = () => ({ view: S.view, adminTab: S.ui.adminTab, ib: S.ui.ib, ipF: S.ui.ipF });
const navKey = x => x ? [x.view, x.view === 'admin' ? x.adminTab : '', x.view === 'inbound' ? (x.ib || '') : ''].join('|') : '';
function trackNav() {
  const cur = navSnap();
  if (navLast && !navBackNow && navKey(cur) !== navKey(navLast)) {
    navStack.push(navLast); if (navStack.length > 30) navStack.shift();
    try { history.pushState({ smgNav: navStack.length }, ''); } catch (e) { }
  }
  navLast = cur; navBackNow = false;
}
function goBack() {
  const x = navStack.pop(); if (!x) return;
  navBackNow = true; S.view = x.view; S.ui.adminTab = x.adminTab; S.ui.ib = x.ib; S.ui.ipF = x.ipF;
  S.ui.drawer = null; S.ui.storeMenu = false; render(); goTop();
}
addEventListener('popstate', () => { if (navStack.length) goBack(); });
function render() {
  if (inChange && ptrDown) { renderPending = true; return; }
  renderPending = false;
  const app = $('#app');
  const inApp = !!(S.user && !S.ui.showApply && (S.mode !== 'live' || S.user.status === 'active' || S.user.owner));
  document.body.classList.toggle('in-app', inApp);
  if (!S.user || S.ui.showApply) { app.innerHTML = loginView(); bindLogin(); return; }
  const nav = NAV.filter(n => n.show());
  if (S.view !== 'more' && !nav.find(n => n.id === S.view)) S.view = 'home';
  trackNav();
  const pendingN = S.users.filter(u => u.status === 'pending').length;
  const sv = S.stores.length === 1 ? storeName(S.stores[0]) : `${S.stores.length}개 매장 함께 보기`;
  app.innerHTML = `
  <header class="top">
    <button class="logo-btn" id="logoHome" aria-label="첫 화면으로"><img src="logo-w.png" alt="SMG STORE"></button>
    <button class="store-btn" id="storeBtn" aria-haspopup="true" aria-expanded="${S.ui.storeMenu}">
      <span class="nm">${esc(sv)}</span><span class="car"></span>
    </button>
    ${noticeBar()}
    <div class="who"><button class="me-btn" id="meBtn" title="내 정보" aria-label="내 정보 · ${esc(S.user.name)}"><span class="me1"><b>${esc(S.user.name)}</b> ${esc(S.user.position || '')}</span><span class="me2">${esc(meLine(S.user))}</span></button>${S.mode === 'demo' ? '' : '<button class="btn sm" id="logout">로그아웃</button>'}</div>
  </header>
  ${S.mode === 'demo' ? `<div class="demobar"><span class="demo-tag">미리보기</span><label for="roleSel">권한별로 보기</label><select id="roleSel">${DEMO_ROLES.map(r => `<option value="${r.uid}" ${S.user.uid === r.uid ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select><span class="muted hide-s">수원 실제 자료 · 저장한 내용은 새로고침하면 처음 상태로 돌아갑니다</span></div>` : ''}
  ${S.stores.length > 1 ? `<div class="storebar" aria-label="보고 있는 매장"><span class="lb">보고 있는 매장</span>${S.stores.map(id => `<button class="schip" data-sg="${id}" title="${esc(storeName(id))}만 보기"><span class="dot" style="background:${storeColor(id)}"></span>${esc(storeName(id))}</button>`).join('')}<button class="schip more" id="storeBtn2">바꾸기</button></div>` : ''}
  ${S.ui.storeMenu ? storeMenu() : ''}
  <div class="shell">
    <nav class="side" aria-label="메뉴">
      ${nav.map(n => `${n.grp ? `<div class="grp">${n.grp}</div>` : ''}<button data-nav="${n.id}" class="${S.view === n.id ? 'on' : ''}">${esc(n.t)}${n.id === 'admin' && pendingN && can('approve') ? `<span class="cnt">${pendingN}</span>` : ''}</button>`).join('')}
      <div style="margin:24px 12px 0">${textSizeBox()}</div>
      <div class="grp" style="margin-top:16px">앱 업데이트 ${APP_VERSION.slice(5).replace('-', '/')}</div>
    </nav>
    <main><div class="page" id="page">${pageView()}</div></main>
  </div>
  <nav class="tabbar" aria-label="아래 메뉴">${tabbar(nav)}</nav>
  ${S.ui.drawer ? `<div class="ov" id="ov"><div class="dr${S.ui.drawer.wide ? ' wide' : ''}" role="dialog" aria-modal="true">${S.ui.drawer()}</div></div>` : ''}
  ${S.ui.toast ? `<div class="toast" role="status">${esc(S.ui.toast)}</div>` : ''}`;
  bind(); pinTabbar();
  // 왼쪽 메뉴 아래가 시계에 가려지지 않게: 시계 높이만큼 아래 여백 (글자 크기 목록은 위로 펼침)
  const kc = document.querySelector('.kclock'); if (kc && kc.offsetHeight) document.documentElement.style.setProperty('--kch', kc.offsetHeight + 'px');
  fitSide();
  if (S.ui.tzOpen) { const bx = document.querySelector('.side .tzbox'); if (bx && bx.offsetParent) bx.scrollIntoView({ block: 'nearest' }); }
  // [이전] 버튼: 화면 제목 줄 오른쪽 끝
  if (navStack.length) { const ph = document.querySelector('#page .ph'); if (ph) ph.insertAdjacentHTML('beforeend', '<button class="back-btn" id="navBack" aria-label="이전 화면으로"><span class="ar"></span>이전</button>'); }
  const tw = document.querySelector('.tlwrap'), tt = tw && tw.querySelector('.tltoday');
  if (tw && tt && tw.scrollWidth > tw.clientWidth && !tw.dataset.sc) { tw.scrollLeft = Math.max(0, tt.offsetLeft - 108 - tw.clientWidth * 0.2); tw.dataset.sc = 1; }
}
// 아래 메뉴: 권한 있는 메뉴를 모두 보여 줌 (6개 넘으면 두 줄)
const TAB = { home: ['홈', 'home'], ipnow: ['IP현황', 'star'], products: ['상품', 'box'], entry: ['입출고', 'plus'], count: ['실사', 'check'], inbound: ['입고확인', 'truck'], transfer: ['매장이동', 'swap'], records: ['기록', 'list'], files: ['파일', 'list'], sales: ['매출', 'chart'], collab: ['콜라보', 'star'], settle: ['정산', 'won'], admin: ['관리', 'user'], more: ['설정', 'gear'] };
function tabbar(nav) {
  const pendingN = can('approve') ? S.users.filter(u => u.status === 'pending').length : 0;
  const out = [...nav.map(n => n.id), 'more'];
  const cols = out.length <= 5 ? out.length : Math.ceil(out.length / 2);
  return `<div class="tabgrid${out.length > 5 ? ' two' : ''}" style="grid-template-columns:repeat(${cols},1fr)">` + out.map(id => {
    const [t, i] = TAB[id] || [id, 'more'];
    return `<button data-nav="${id}" class="${S.view === id ? 'on' : ''}">${ic(i, 20)}<span>${t}</span>${id === 'admin' && pendingN ? `<b class="tcnt">${pendingN}</b>` : ''}</button>`;
  }).join('') + '</div>';
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
// 아이폰 즐겨찾기처럼 ≡ 를 끌어서 매장 순서 바꾸기 (줄 전체를 길게 눌러도 됨)
let ordDrag = null;
function ordStart(row, y, pid) {
  const list = row.parentElement, rows = [...list.children];
  const h = rows.length > 1 ? rows[1].getBoundingClientRect().top - rows[0].getBoundingClientRect().top : row.getBoundingClientRect().height;
  ordDrag = { row, list, rows, from: rows.indexOf(row), to: rows.indexOf(row), y0: y, h, pid };
  row.classList.add('dragging');
  try { navigator.vibrate && navigator.vibrate(10); } catch (e) { }
}
function ordMove(y) {
  const d = ordDrag; if (!d) return;
  const dy = y - d.y0, n = d.rows.length;
  const to = Math.max(0, Math.min(n - 1, d.from + Math.round(dy / d.h)));
  d.to = to;
  d.row.style.transform = `translateY(${dy}px)`;
  d.rows.forEach((r, i) => {
    if (r === d.row) return;
    let sh = 0;
    if (d.from < to && i > d.from && i <= to) sh = -d.h;
    if (d.from > to && i < d.from && i >= to) sh = d.h;
    r.style.transform = sh ? `translateY(${sh}px)` : '';
  });
}
function ordEnd() {
  const d = ordDrag; if (!d) return; ordDrag = null;
  if (d.to !== d.from) {
    const [m] = STORES.splice(d.from, 1); STORES.splice(d.to, 0, m);
    S.stores = STORES.map(x => x.id).filter(x => S.stores.includes(x));
  }
  render();
}
(function ordInit() {
  let press = null;
  document.addEventListener('pointerdown', e => {
    const row = e.target.closest && e.target.closest('.ordrow'); if (!row) return;
    if (e.target.closest('.grip')) { e.preventDefault(); ordStart(row, e.clientY, e.pointerId); return; }
    const y = e.clientY;   // 줄을 길게 누르면 끌기 시작
    press = { t: setTimeout(() => { press = null; ordStart(row, y, e.pointerId); }, 350), y };
  });
  document.addEventListener('pointermove', e => {
    if (press && Math.abs(e.clientY - press.y) > 8) { clearTimeout(press.t); press = null; }
    if (ordDrag) { e.preventDefault(); ordMove(e.clientY); }
  }, { passive: false });
  const up = () => { if (press) { clearTimeout(press.t); press = null; } if (ordDrag) ordEnd(); };
  document.addEventListener('pointerup', up); document.addEventListener('pointercancel', up);
  // 끄는 중 화면이 스크롤되지 않게
  document.addEventListener('touchmove', e => { if (ordDrag) e.preventDefault(); }, { passive: false });
  // 키보드: ≡ 에서 위·아래 화살표
  document.addEventListener('keydown', e => {
    const g = e.target.closest && e.target.closest('.grip'); if (!g) return;
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault(); const id = g.dataset.grip; moveStore(id, e.key === 'ArrowUp' ? -1 : 1); render();
    const ng = document.querySelector(`.grip[data-grip="${id}"]`); ng && ng.focus();
  });
})();
async function saveStoreOrder() {
  const order = STORES.map(s => s.id);
  try { localStorage.setItem('smg-store-order:' + (S.user ? S.user.uid : ''), JSON.stringify(order)); } catch (e) { }
  if (S.user) S.user.storeOrder = order;
  if (DB.saveStoreOrder) await DB.saveStoreOrder(order).catch(() => { });
}
function storeMenu() {
  const mine = myStores();
  if (S.ui.storeEdit) return `<div class="scrim" id="scrim"></div><div class="pop" role="dialog" aria-label="매장 순서 바꾸기">
    <h4>오른쪽 ≡ 를 누른 채 위아래로 끌어서 순서를 바꿉니다 · 다른 사람에게는 영향 없음</h4>
    <div class="ordlist" id="ordList">${STORES.map((s, i) => `<div class="srow ordrow" data-ord="${s.id}"><span class="num muted ordn" style="width:18px;text-align:right">${i + 1}</span><span class="go" style="cursor:default"><span class="dot" style="background:${storeColor(s.id)}"></span>${esc(s.name)}</span>
      <span class="grip" role="button" tabindex="0" data-grip="${s.id}" aria-label="${esc(s.name)} 끌어서 순서 바꾸기 (키보드: 위·아래 화살표)">≡</span></div>`).join('')}</div>
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
    case 'ipnow': return ipView();
    case 'products': return productsView();
    case 'entry': return entryView();
    case 'count': return countView();
    case 'transfer': return transferView();
    case 'records': return recordsView();
    case 'files': return filesView();
    case 'inbound': return inboundView();
    case 'sales': return salesView();
    case 'collab': return collabView();
    case 'settle': return settleView();
    case 'admin': return adminView();
    case 'more': return moreView();
  }
  return '';
}
function head(t, sub, right = '') { return `<div class="ph"><div class="pht"><h1>${esc(t)}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div><span class="sp"></span>${right ? `<div class="pha">${right}</div>` : ''}</div>`; }
function toast(t) { S.ui.toast = t; render(); clearTimeout(toast._t); toast._t = setTimeout(() => { S.ui.toast = null; render(); }, 2600); }

/* ───────── 언제 반영됐는지 ───────── */
function lastMove(stores) { let b = null; for (const m of S.moves) if (stores.includes(m.store) && (!b || (m.at || '') > (b.at || ''))) b = m; return b; }
function salesUpdated(stores) {
  let last = '', up = null;
  for (const st of stores) for (const [ym, m] of Object.entries(S.sales[st] || {})) for (const [dd, r] of Object.entries(m.days || {})) { const d = ym + '-' + dd; if (d > last) last = d; if (r.up && (!up || r.up.at > up.at)) up = r.up; }
  return { last, up };
}
// 여러 매장을 함께 볼 때: 매장마다 마지막 반영 시각이 다를 수 있으니 매장별로 따로 보여 줌
function freshTable(stores, opt = {}) {
  if (stores.length < 2) return '';
  const showSales = can('sales') && opt.sales !== false;
  const rows = stores.map(st => ({ st, lm: lastMove([st]), su: showSales ? salesUpdated([st]) : null }));
  const maxSale = rows.reduce((a, r) => (r.su && r.su.last > a ? r.su.last : a), '');
  const maxMove = rows.reduce((a, r) => (r.lm && (r.lm.at || '') > a ? r.lm.at : a), '');
  return `<div class="card fresh"><div class="fr-hd"><b>매장별 마지막 반영</b><span class="muted">매장마다 올린 시각이 달라서 합계는 아래 시각 기준입니다</span></div>
  <div class="frlist${showSales ? '' : ' nosale'}">
  ${rows.map(r => {
    const late = showSales && r.su && maxSale && r.su.last && r.su.last < maxSale ? dDiff(r.su.last, maxSale) : 0;
    return `<div class="frrow"><span class="frn"><span class="dot" style="background:${storeColor(r.st)}"></span>${esc(shortName(r.st))}</span>
      <span class="fri"><span class="k">재고</span>${r.lm ? `<b>${kst(r.lm.at)}</b> <span class="muted">${esc(r.lm.type)}${r.lm.by && !/claude/i.test(r.lm.by) ? ' · ' + esc(r.lm.by === '자동(POS)' && r.lm.upBy ? whoText(r.lm.upBy, r.lm.co) : whoText(r.lm.by, r.lm.co)) : ''}</span>` : '<span class="muted">아직 없음</span>'}</span>
      ${showSales ? `<span class="fri"><span class="k">매출</span>${r.su && r.su.last ? `<b>${md(r.su.last)}</b>까지${r.su.up ? ` <span class="muted">(${kst(r.su.up.at)} ${esc(whoText(r.su.up.by, r.su.up.co))} 올림)</span>` : ''}${late ? ` <span class="pill p-warn">🔸 ${late}일 늦음</span>` : ''}` : '<span class="pill p-warn">🔸 자료 없음</span>'}</span>` : ''}</div>`;
  }).join('')}</div></div>`;
}
function freshLine(stores) {
  if (stores.length > 1) return `${stores.length}개 매장 · 매장마다 반영 시각이 다릅니다 (아래 표)`;
  const lm = lastMove(stores); const parts = [];
  if (lm) parts.push(`재고 마지막 반영 <b>${kst(lm.at)}</b> (${esc(lm.type)}${lm.by && !/claude/i.test(lm.by) ? ' · ' + esc(lm.by === '자동(POS)' && lm.upBy ? whoText(lm.upBy, lm.co) : whoText(lm.by, lm.co)) : ''})`);
  if (can('sales')) { const su = salesUpdated(stores); if (su.last) parts.push(`매출 <b>${md(su.last)} 마감</b>까지${su.up ? ` (${kst(su.up.at)} ${esc(whoText(su.up.by, su.up.co))} 올림)` : ''}`); }
  return parts.join(' · ');
}

/* ───────── 날짜 고르기: 년·월·일을 따로 고르는 칸 ───────── */
function dateSel(id, val) {
  const v = /^\d{4}-\d{2}-\d{2}$/.test(val || '') ? val : today();
  const [y, m, d] = v.split('-').map(Number);
  const y0 = 2025, y1 = Number(today().slice(0, 4)) + 1;
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const opt = (a, b, cur, suf) => { let o = ''; for (let i = a; i <= b; i++) o += `<option value="${i}" ${i === cur ? 'selected' : ''}>${i}${suf}</option>`; return o; };
  return `<span class="dsel"><input type="hidden" id="${id}" value="${v}">
    <select class="inp" data-dsel="${id}:y" aria-label="년">${opt(y0, Math.max(y1, y), y, '년')}</select>
    <select class="inp" data-dsel="${id}:m" aria-label="월">${opt(1, 12, m, '월')}</select>
    <select class="inp" data-dsel="${id}:d" aria-label="일">${opt(1, last, Math.min(d, last), '일')}</select></span>`;
}

/* ───────── 홈 ───────── */
function storeStats(st) {
  const m = S.stock[st] || {};
  let qty = 0, kinds = 0, out = 0, neg = 0;
  for (const [, q] of Object.entries(m)) { if (q > 0) { qty += q; kinds++; } else if (q === 0) out++; else neg++; }
  return { qty, kinds, out, neg };
}
/* ───────── IP 현황 (전 매장 팝업·전시·카페 운영 일정) ───────── */
const IP_KINDS = ['팝업', '전시', '카페'];
const STORE_KIND = { suwon: '팝업', limission: '팝업', museum: '전시', boxcafe: '카페', omake: '카페' };
const STORE_PLACE = { suwon: 'AK PLAZA 수원 5F', limission: 'AK PLAZA 홍대 4F', museum: 'AK PLAZA 홍대 4F', boxcafe: 'AK PLAZA 홍대 3F', omake: '현대백화점 신촌 B2' };
// 처음 값: SMG NOW 26년 11월 소식(11/1)으로 진행 중 일정 확정, 그 밖은 SMG 홀딩스 전체 개최 일정(10/20 받은 표) 기준. 관리자가 앱에서 고치면 그 값이 우선합니다.
const IP_PLAN_DEFAULT = [
  ['suwon', '하이큐!! 쉬는시간', '2026-09-24', '2026-10-13', 'SMG-C', ''],
  ['suwon', '에반게리온 Light & Shadow', '2026-10-15', '2026-11-24', '홀딩스', ''],
  ['suwon', '진격의 거인 The Final Season', '2026-11-12', '2026-12-03', '홀딩스', '5F 팝토피아 · 에반게리온과 함께 진행'],
  ['suwon', '주술회전 2 (MAPPA)', '2026-12-05', '2026-12-27', '홀딩스', ''],
  ['suwon', '슈가슈가룬 2', '2026-12-29', '2027-01-26', 'SMG-C', ''],
  ['suwon', '은혼 구작 2', '2027-01-28', '2027-02-24', 'SMG-C', ''],
  ['suwon', '약혼', '2027-02-25', '2027-03-24', '홀딩스', ''],
  ['limission', '다모여', '2026-09-24', '2026-10-14', '홀딩스', ''],
  ['limission', '쿠로코의 농구', '2026-10-15', '2026-11-10', 'SMG-C', ''],
  ['limission', '진격의 거인 The Final Season', '2026-11-12', '2026-12-03', '홀딩스', ''],
  ['limission', '주술회전 2 (MAPPA)', '2026-12-03', '2026-12-30', '홀딩스', '슈가슈가룬 2와 기간 겹침'],
  ['limission', '슈가슈가룬 2', '2026-12-24', '2027-01-27', 'SMG-C', ''],
  ['limission', '은혼 구작 2', '2027-01-28', '2027-02-24', 'SMG-C', ''],
  ['limission', '약혼', '2027-02-25', '2027-03-24', '홀딩스', ''],
  ['museum', '명탐정 코난 TV 애니메이션 방송 30주년 기념전', '2026-08-12', '2026-11-29', '', ''],
  ['museum', '전지적 독자 시점', '2026-12-17', '2027-02-07', '', ''],
  ['museum', '이누야샤', '2027-02-18', '2027-02-24', '', '날짜 미정'],
  ['museum', '은혼 원화전 20주년', '2027-05-27', '2027-08-31', '', ''],
  ['boxcafe', '코난', '2026-08-13', '2026-09-23', '', ''],
  ['boxcafe', '2026 주술회전 시부야사변 CAFE', '2026-09-23', '2026-12-01', '', ''],
  ['boxcafe', '하이큐 SD', '2026-12-03', '2027-01-13', '', '다른 안: 프리렌'],
  ['boxcafe', '팔재', '2027-01-14', '2027-02-03', '', ''],
  ['boxcafe', '화산귀환', '2027-02-04', '2027-03-03', '', ''],
  ['omake', '에픽 x 카제나', '2026-09-17', '2026-09-30', '', ''],
  ['omake', '오란고교 사교클럽 CAFE', '2026-10-02', '2026-11-30', '', ''],
  ['omake', '하이큐', '2026-12-03', '2026-12-09', '', ''],
  ['omake', '하이큐 / 리락쿠마', '2026-12-10', '2027-01-13', '', ''],
  ['omake', '카제나', '2027-01-21', '2027-02-24', '', ''],
].map(([store, ip, start, end, host, note], i) => ({ id: 'd' + i, store, kind: STORE_KIND[store], ip, start, end, host, note }));
const ipPlan = () => (S.ipPlan || IP_PLAN_DEFAULT).slice().sort((a, b) => a.start.localeCompare(b.start));
const dDiff = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const canIpEdit = () => isOwner() || can('approve');
const mdw = d => { const t = new Date(d + 'T00:00:00Z'); return `${t.getUTCMonth() + 1}/${t.getUTCDate()}(${'일월화수목금토'[t.getUTCDay()]})`; };
function ipStatus(store, t = today()) {
  const L = ipPlan().filter(r => r.store === store);
  return { now: L.filter(r => r.start <= t && t <= r.end), next: L.filter(r => r.start > t).slice(0, 2), last: L.filter(r => r.end < t).slice(-1)[0] };
}
function ipCard(st) {
  const t = today(), x = ipStatus(st), kind = STORE_KIND[st] || '';
  const nowB = x.now.map(r => {
    const tot = dDiff(r.start, r.end) + 1, gone = dDiff(r.start, t) + 1, left = dDiff(t, r.end);
    return `<div class="ipnow"><div class="ipname">${esc(r.ip)}</div>
      <div class="ipmeta">${mdw(r.start)} ~ ${mdw(r.end)} · ${tot}일${r.host ? ' · ' + esc(r.host) : ''}</div>
      <div class="ipbar" aria-label="${gone}일째 / ${tot}일"><i style="width:${Math.min(100, gone / tot * 100).toFixed(1)}%"></i></div>
      <div class="ipmeta"><b>${gone}일째</b> · ${left === 0 ? '<b class="red">오늘 종료</b>' : `종료까지 <b>${left}일</b>`}</div>
      ${r.note ? `<div class="ipnote">🔸 ${esc(r.note)}</div>` : ''}</div>`;
  }).join('');
  const nx = x.next.map((r, i) => `<div class="ipnext${i ? ' muted' : ''}"><span class="pill ${i ? 'p-mute' : 'p-ok'}">${i ? '그다음' : '다음'}</span><span class="t">${esc(r.ip)}</span><span class="d">${mdw(r.start)}~ · D-${dDiff(t, r.start)}</span></div>`).join('');
  return `<div class="card ipcard" style="--c:${storeColor(st)}">
    <div class="iphd"><div class="iph1"><span class="dot" style="background:${storeColor(st)}"></span><b>${esc(storeName(st))}</b></div><div class="iph2"><span class="pill p-mute">${kind}</span><span class="muted">${esc(STORE_PLACE[st] || '')}</span></div></div>
    ${nowB || `<div class="ipnow empty"><div class="ipname muted">지금 진행 중인 ${kind} 없음</div>${x.last ? `<div class="ipmeta">지난: ${esc(x.last.ip)} (~${mdw(x.last.end)})</div>` : ''}</div>`}
    ${nx || '<div class="ipnext muted">다음 일정 미정</div>'}</div>`;
}
function ipTimeline() {
  const t = today(), T = Date.parse(t);
  const s0 = new Date(T); s0.setUTCDate(1); s0.setUTCMonth(s0.getUTCMonth() - 1);
  const e0 = new Date(s0); e0.setUTCMonth(e0.getUTCMonth() + 5);
  const A = s0.getTime(), B = e0.getTime(), W = B - A, pct = d => ((Date.parse(d) - A) / W * 100);
  const months = []; for (let m = new Date(s0); m < e0; m.setUTCMonth(m.getUTCMonth() + 1)) months.push(new Date(m));
  const rows = STORES.map(s => {
    const L = ipPlan().filter(r => r.store === s.id && Date.parse(r.end) >= A && Date.parse(r.start) < B);
    const lanes = []; L.forEach(r => { let k = lanes.findIndex(e => e < r.start); if (k < 0) { k = lanes.length; lanes.push(''); } lanes[k] = r.end; r._lane = k; });
    const n = Math.max(1, lanes.length);
    return `<div class="tlrow" style="height:${n * 30 + 8}px"><div class="tllb"><span class="dot" style="background:${storeColor(s.id)}"></span>${esc(shortName(s.id))}</div><div class="tltrack">
      ${L.map(r => { const l = Math.max(0, pct(r.start)), w = Math.min(100, pct(r.end) + 100 / (W / 864e5)) - l; const on = r.start <= t && t <= r.end;
        return `<div class="tlbar${on ? ' on' : ''}${r.end < t ? ' past' : ''}" style="left:${l}%;width:${w}%;top:${r._lane * 30 + 4}px;--c:${storeColor(s.id)}" title="${esc(r.ip)} ${r.start}~${r.end}"><span>${esc(r.ip)}</span></div>`; }).join('')}
    </div></div>`;
  }).join('');
  return `<div class="card"><h2>앞으로 일정 <span class="muted" style="font-weight:500;font-size:12px">지난달 ~ 4달 뒤 · 빨간 선 = 오늘</span></h2>
    <div class="tlwrap"><div class="tl">
      <div class="tlrow tlhead"><div class="tllb"></div><div class="tltrack">${months.map(m => `<span class="tlm" style="left:${pct(m.toISOString().slice(0, 10))}%">${m.getUTCFullYear() !== new Date(T).getUTCFullYear() ? String(m.getUTCFullYear()).slice(2) + '년 ' : ''}${m.getUTCMonth() + 1}월</span>`).join('')}</div></div>
      ${rows}
      <div class="tltoday" style="left:calc(var(--tll) + (100% - var(--tll)) * ${(pct(t) / 100).toFixed(4)})"></div>
    </div></div></div>`;
}
function ipListTable() {
  const t = today(), f = S.ui.ipF || 'all';
  const L = ipPlan().filter(r => f === 'all' || r.store === f).filter(r => S.ui.ipPast || r.end >= t);
  return `<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><h2 style="margin:0">전체 일정표</h2>${canIpEdit() ? '<button class="btn sm pri" id="ipAdd">+ 일정 추가</button>' : ''}</div>
    <div class="chips" style="margin-top:10px"><button class="chip ${f === 'all' ? 'on' : ''}" data-ipf="all">전체</button>${STORES.map(s => `<button class="chip ${f === s.id ? 'on' : ''}" data-ipf="${s.id}">${esc(shortName(s.id))}</button>`).join('')}<label class="ck" style="margin-left:auto"><input type="checkbox" id="ipPast" ${S.ui.ipPast ? 'checked' : ''}><span class="t">지난 일정도</span></label></div>
    <div class="tw"><table class="tb"><thead><tr><th>매장</th><th>구분</th><th>IP</th><th>기간</th><th class="r">일수</th><th>상태</th>${canIpEdit() ? '<th></th>' : ''}</tr></thead><tbody>
    ${L.map(r => { const st = r.end < t ? '<span class="pill p-mute">종료</span>' : r.start <= t ? '<span class="pill p-bad">진행 중</span>' : `<span class="pill p-ok">D-${dDiff(t, r.start)}</span>`;
      return `<tr><td class="nowrap"><span class="dot" style="background:${storeColor(r.store)};display:inline-block;margin-right:6px"></span>${esc(shortName(r.store))}</td><td class="nowrap">${esc(r.kind)}</td><td style="min-width:140px"><b>${esc(r.ip)}</b>${r.host ? ` <span class="muted">· ${esc(r.host)}</span>` : ''}${r.note ? `<div class="muted" style="font-size:12px">🔸 ${esc(r.note)}</div>` : ''}</td><td class="nowrap">${mdw(r.start)} ~ ${mdw(r.end)}</td><td class="r num">${dDiff(r.start, r.end) + 1}</td><td>${st}</td>${canIpEdit() ? `<td><button class="btn sm" data-ipe="${r.id}">고치기</button></td>` : ''}</tr>`; }).join('') || `<tr><td colspan="7" class="muted">일정이 없습니다</td></tr>`}
    </tbody></table></div></div>`;
}
function ipView() {
  const t = today(), live = STORES.map(s => ipStatus(s.id).now.length).reduce((a, b) => a + b, 0);
  const soon = ipPlan().filter(r => r.start > t && dDiff(t, r.start) <= 14);
  return `${head('IP 현황', `전 매장 팝업 · 전시 · 카페 운영 IP · 오늘 ${mdw(t)} 기준${S.ipPlanAt ? ' · 일정 수정 ' + esc(S.ipPlanAt) : ' · SMG NOW 11월 소식·홀딩스 일정표 기준'}`)}
  <div class="tiles"><div class="tile"><div class="k">지금 운영 중</div><div class="v num">${live}<small>개 IP</small></div></div>
    <div class="tile"><div class="k">2주 안에 시작</div><div class="v num">${soon.length}<small>개</small></div><div class="d">${soon.slice(0, 2).map(r => esc(shortName(r.store) + ' ' + r.ip)).join(' · ') || '없음'}</div></div></div>
  <div class="ipgrid">${STORES.map(s => ipCard(s.id)).join('')}</div>
  ${ipTimeline()}
  ${ipListTable()}`;
}
function ipStrip() {
  const items = STORES.map(s => ({ s, x: ipStatus(s.id) })).filter(o => o.x.now.length);
  if (!items.length) return '';
  return `<button class="ipstrip" data-nav="ipnow" aria-label="IP 현황 보기"><span class="lb">지금 운영 중</span>${items.map(o => o.x.now.map(r => `<span class="it"><span class="dot" style="background:${storeColor(o.s.id)}"></span>${esc(shortName(o.s.id))} <b>${esc(r.ip)}</b> <span class="muted">종료 D-${dDiff(today(), r.end)}</span></span>`).join('')).join('')}<span class="go">전체 보기 ›</span></button>`;
}
function ipDrawer() {
  const f = S.ui.ipForm;
  return `<div class="hd"><h3>${f.id ? 'IP 일정 고치기' : 'IP 일정 추가'}</h3><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label for="ipStore">매장</label><select class="inp" id="ipStore">${STORES.map(s => `<option value="${s.id}" ${f.store === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select></div>
    <div class="field"><label>구분</label><div class="chips">${IP_KINDS.map(k => `<button class="chip ${f.kind === k ? 'on' : ''}" data-ipk="${k}">${k}</button>`).join('')}</div></div>
    <div class="field"><label for="ipName">IP 이름</label><input class="inp" id="ipName" value="${esc(f.ip)}" placeholder="예: 진격의 거인 (MAPPA)"></div>
    <div class="field"><label for="ipCats">토스포스 카테고리 <span class="muted">(콜라보 분석용 · 쉼표로 여러 개)</span></label><input class="inp" id="ipCats" value="${esc((f.cats && f.cats.length ? f.cats : PLAN_CATS[f.ip] || []).join(', '))}" placeholder="예: 하이큐 쉬는시간 — 하이큐 10주년(상설)과 구분"></div>
    <div class="formgrid"><div class="field"><label for="ipStart">시작일</label>${dateSel('ipStart', f.start)}</div><div class="field"><label for="ipEnd">종료일</label>${dateSel('ipEnd', f.end)}</div></div>
    <div class="formgrid"><div class="field"><label for="ipHost">주최</label><input class="inp" id="ipHost" value="${esc(f.host)}" placeholder="예: 홀딩스, SMG-C"></div><div class="field"><label for="ipNote">메모</label><input class="inp" id="ipNote" value="${esc(f.note)}" placeholder="예: 종료일 확인 필요"></div></div>
  </div>
  <div class="row" style="justify-content:space-between">${f.id ? '<button class="btn" id="ipDel" style="color:var(--red)">이 일정 지우기</button>' : '<span></span>'}<span class="row"><button class="btn" data-close>취소</button><button class="btn pri" id="ipSave">저장</button></span></div>`;
}
async function saveIpPlan(list) {
  S.ipPlan = list; S.ipPlanAt = kstStamp();
  if (DB.saveIpPlan) await DB.saveIpPlan(list.map(({ _lane, ...r }) => r), S.ipPlanAt).catch(e => toast('저장하지 못했습니다: ' + e.message));
}
function kstStamp() { const d = new Date(Date.now() + 9 * 3600e3); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} ${S.user ? S.user.name : ''}`.trim(); }

/* ───────── 공지사항 (대표만 입력, 모든 직원에게 맨 위 가운데 표시) ───────── */
function noticeBar() {
  const n = S.notice && S.notice.text && S.notice.text.trim() ? S.notice : null;
  if (!n && !isOwner()) return '<span class="sp"></span>';
  return `<button class="notice${n ? '' : ' empty'}" id="noticeBtn" aria-label="공지사항${n ? ' 보기' : ' 입력'}"><span class="nt-ic">공지</span><span class="nt-tx">${n ? esc(n.text.split('\n')[0]) : '공지사항 입력하기'}</span>${n && n.text.includes('\n') ? '<span class="nt-more">더보기</span>' : ''}</button>`;
}
function noticeDrawer() {
  const n = S.notice || {}, edit = isOwner();
  return `<div class="hd"><h3>공지사항</h3><button class="x" data-close aria-label="닫기">×</button></div>
  ${edit ? `<div class="card" style="display:flex;flex-direction:column;gap:10px">
      <div class="field"><label for="ntText">공지 내용 <span class="muted" style="font-weight:400">· 첫 줄이 맨 위에 보이고, 누르면 전체가 보입니다</span></label>
      <textarea class="inp" id="ntText" rows="6" style="resize:vertical;min-height:120px" placeholder="예: 11/12(목) 진격의 거인 팝업 오픈 — 전날 18시까지 진열 완료">${esc(n.text || '')}</textarea></div>
      ${n.at ? `<div class="muted" style="font-size:12px">마지막 수정 ${esc(n.at)}</div>` : ''}
    </div>
    <div class="row" style="justify-content:space-between">${n.text ? '<button class="btn" id="ntClear" style="color:var(--red)">공지 내리기</button>' : '<span></span>'}<span class="row"><button class="btn" data-close>취소</button><button class="btn pri" id="ntSave">공지 올리기</button></span></div>`
  : `<div class="card"><div style="white-space:pre-wrap;line-height:1.6;font-size:15px">${esc(n.text || '등록된 공지가 없습니다')}</div>${n.at ? `<div class="muted" style="font-size:12px;margin-top:10px">${esc(n.at)}</div>` : ''}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" data-close>확인</button></div>`}`;
}
async function saveNotice(text) {
  const n = { text: text.trim(), at: kstStamp(), by: S.user ? S.user.name : '' };
  S.notice = n;
  if (DB.saveNotice) await DB.saveNotice(n).catch(e => { toast('저장하지 못했습니다: ' + e.message); });
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
      const m1 = last.slice(0, 8) + '01'; const posM = st.reduce((a, x) => { let t = 0; for (let d = m1; d <= last; d = addDays(d, 1)) { const r = dayRec(x, d); if (r) t += r.s; } return a + t; }, 0);
      const mEnd = addDays(addDays(m1, 40).slice(0, 8) + '01', -1); const ML = machAgg(st, m1, mEnd);
      const macM = ML.reduce((a, m) => a + m.s, 0), machLast = ML.reduce((a, m) => (m.last > a ? m.last : a), '');
      salesBlock = `<button class="tile tbtn" data-nav="sales"><span class="lb">${+last.slice(5, 7)}월 총매출 <span class="go">매출 ›</span></span><span class="v big${String(fmt(posM + macM)).length > 9 ? ' long' : ''}">${fmt(posM + macM)}<small>원</small></span><span class="d muted">토스포스 ${md(last)}까지 ${man(posM)} + 기계 ${machLast ? md(machLast) + '까지 ' : ''}${man(macM)}</span></button>` + `<button class="tile tbtn" data-hday="${last}"><span class="lb">매출 · ${md(last)}(${wd(last)}) <span class="go">상세 ›</span></span><span class="v big${String(fmt(s)).length>9?' long':''}">${fmt(s)}<small>원</small></span><span class="d ${ch == null ? 'muted' : ch >= 0 ? '' : ''}">${ch == null ? '지난주 같은 요일 자료 없음' : `${chg(ch)} 지난주 같은 요일 대비`} · ${fmt(p)}건</span></button>`;
    }
  }
  return `${head(multi ? `${st.length}개 매장 요약` : storeName(st[0]), `${freshLine(st) || '아직 반영된 자료가 없습니다'}${limited() ? ' · 재고 수량만 볼 수 있는 계정입니다' : ''}`, installBtn('sm'))}
  ${freshTable(st)}
  <div class="note" style="font-size:12.5px">ℹ︎ 실시간 자료가 아닙니다. 판매는 <b>토스포스 매출 파일</b>을 올려야, 입고·이동은 <b>등록</b>해야 재고에 반영됩니다. 위 시각을 확인해 주세요.</div>
  ${ipStrip()}
  <div class="tiles">
    <button class="tile tbtn" data-hd="all"><span class="lb">현재 재고 <span class="go">상세 ›</span></span><span class="v big${String(fmt(tot.qty)).length>9?' long':''}">${fmt(tot.qty)}<small>개</small></span><span class="d muted">재고 있는 상품 ${fmt(tot.kinds)}종</span></button>
    <button class="tile tbtn" data-hd="out"><span class="lb">품절 (재고 0) <span class="go">상세 ›</span></span><span class="v big${String(fmt(tot.out)).length>9?' long':''}">${fmt(tot.out)}<small>종</small></span><span class="d muted">진열·품절 안내 확인</span></button>
    <button class="tile tbtn ${tot.neg ? 'alert' : ''}" data-hd="neg"><span class="lb">마이너스 재고 <span class="go">상세 ›</span></span><span class="v big${String(fmt(tot.neg)).length>9?' long':''}">${fmt(tot.neg)}<small>종</small></span><span class="d ${tot.neg ? '' : 'muted'}">${tot.neg ? '🔺 실사로 맞춰야 함' : '✔ 없음'}</span></button>
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

/* ───────── 내 정보 (상단 이름 누르면) ───────── */
function placesOf(u) { const p = (u.places || []).filter(Boolean); if (p.length) return p.join(', '); const st = (u.perms && u.perms.stores) || []; return st.map(shortName).join(', '); }
function meLine(u) { return [userCo(u), placesOf(u)].filter(Boolean).join(' · '); }
function meDrawer() {
  const u = S.user, f = S.ui.meF; const noReal = /^[A-Za-z .]+$/.test(u.name || '');
  const st = u.owner ? '전체 매장' : ((u.perms && u.perms.stores) || []).map(storeName).join(', ') || '-';
  const pm = u.owner ? '모든 권한 (대표)' : [u.perms && u.perms.move && '입출고', u.perms && u.perms.count && '실사', u.perms && u.perms.sales && '매출', u.perms && u.perms.approve && '승인'].filter(Boolean).join(' · ') || '재고 보기';
  return `<div class="hd"><div><div class="muted" style="font-size:12px">로그인한 계정</div><h3>내 정보</h3></div><button class="x" data-close aria-label="닫기">×</button></div>
  ${noReal ? '<div class="note">🔸 이름이 영어로만 되어 있습니다. 파일 이력과 기록에 누가 올렸는지 바로 알 수 있도록 실명을 넣어 주세요.</div>' : ''}
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label for="meName">이름 (실명)</label><input class="inp" id="meName" value="${esc(f.name)}" placeholder="예: 홍길동"></div>
    <div class="field"><label for="mePhone">휴대폰 (선택)</label><input class="inp" id="mePhone" inputmode="tel" value="${esc(f.phone)}"></div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" id="meSave">저장</button></div>
  </div>
  <div class="card"><dl class="kv"><dt>이메일</dt><dd>${esc(u.email || '-')}</dd><dt>소속 회사</dt><dd>${esc(userCo(u) || '-')}</dd><dt>직급</dt><dd>${esc(u.position || '-')}</dd><dt>근무 매장</dt><dd>${esc(placesOf(u) || '-')}</dd><dt>볼 수 있는 매장</dt><dd>${esc(st)}</dd><dt>권한</dt><dd>${esc(pm)}</dd></dl>
  <p class="muted" style="margin:10px 0 0;font-size:12.5px">회사·직급·매장·권한은 관리 화면에서 승인 권한자가 바꿉니다.</p></div>`;
}
async function saveMe() {
  const f = S.ui.meF; const nm = (($('#meName') || {}).value || f.name).trim(), ph = (($('#mePhone') || {}).value || f.phone).trim();
  if (!nm) { alertBox('이름을 넣어 주세요.'); return; }
  const aka = [...new Set([...(S.user.aka || []), ...(S.user.name && S.user.name !== nm ? [S.user.name] : [])])];
  const upd = { name: nm, phone: ph, aka };
  try { if (DB.saveMe) await DB.saveMe(upd); } catch (e) { alertBox('저장하지 못했습니다: ' + e.message); return; }
  Object.assign(S.user, upd); const su = (S.users || []).find(x => x.uid === S.user.uid); if (su) Object.assign(su, upd);
  S.ui.drawer = null; toast('내 정보를 저장했습니다');
}
// 기록에 남은 이름 → 지금 이름 (예전에 영어 이름으로 올린 기록도 실명으로 보이게)
function whoNow(by, uid, co) {
  if (!by && !uid) return '';
  if (by === '자동(POS)') by = '';
  const pool = [S.user, ...(S.users || [])].filter(Boolean);
  let u = uid && pool.find(x => x.uid === uid);
  if (!u && by) u = pool.find(x => (x.aka || []).includes(by) && (!co || userCo(x) === co));
  if (u) return `${u.name}${u.position ? ' ' + u.position : ''} (${userCo(u) || co || ''})`;
  if (/claude/i.test(by || '')) return '처음 자료 입력';
  return whoText(by, co);
}

/* ───────── 파일 이력: 올린 파일 전부 · 누가 올렸는지 ───────── */
const FK = { pos: '토스포스 매출', mach: '기계 매출', in: '입고 파일', plan: '입고 예정 리스트', act: '실제 입고 수량', count: '실사 파일', move: '입출고 파일' };
function fileHistory(stores) {
  const G = new Map();
  const add = (key, o) => { const g = G.get(key); if (!g) { G.set(key, { n: 0, amt: 0, d1: '', d2: '', ...o }); return G.get(key); } if (o.at && (!g.at || o.at < g.at)) g.at = o.at; return g; };
  const span = (g, d) => { if (!d) return; if (!g.d1 || d < g.d1) g.d1 = d; if (!g.d2 || d > g.d2) g.d2 = d; };
  const sales = can('sales');
  for (const st of stores) for (const [ym, mon] of Object.entries(S.sales[st] || {})) {
    if (sales) for (const [dd, r] of Object.entries(mon.days || {})) { const u = r.up; if (!u) continue; const g = add(`pos|${st}|${u.file}|${(u.at || '').slice(0, 16)}`, { k: 'pos', st, file: u.file || '(파일 이름 없음)', at: u.at, by: u.by, co: u.co, uid: u.uid }); g.n++; g.amt += r.s || 0; span(g, ym + '-' + dd); }
    if (sales) for (const m of Object.values(mon.mach || {})) { const u = m.up; if (!u) continue; const g = add(`mach|${st}|${u.file}|${(u.at || '').slice(0, 16)}`, { k: 'mach', st, file: u.file || '(파일 이름 없음)', at: u.at, by: u.by, co: u.co, uid: u.uid, mach: new Set() }); g.mach.add(m.name); for (const [dd, v] of Object.entries(m.days || {})) { g.amt += v[0] || 0; span(g, ym + '-' + dd); } }
  }
  for (const m of S.moves) {
    if (!m.file || !stores.includes(m.store)) continue;
    const pos = m.type === '판매' && m.by === '자동(POS)';
    const k = pos ? 'pos' : m.type === COUNT_TYPE ? 'count' : m.type === '입고' ? 'in' : 'move';
    if (pos) { // 같은 매출 파일의 재고 차감은 매출 줄에 붙임
      let g = [...G.values()].find(x => x.k === 'pos' && x.st === m.store && x.file === m.file);
      if (!g) g = add(`pos|${m.store}|${m.file}`, { k: 'pos', st: m.store, file: m.file, at: m.at, by: m.upBy || '', co: m.co, uid: m.uid, onlyStock: true });
      g.ded = (g.ded || 0) + 1; if (g.onlyStock) span(g, m.date); continue;
    }
    const g = add(`${k}|${m.store}|${m.file}|${(m.at || '').slice(0, 13)}|${m.by}`, { k, st: m.store, file: m.file, at: m.at, by: m.by, co: m.co, uid: m.uid }); g.n++; g.q = (g.q || 0) + Math.abs(m.qty); span(g, m.date);
  }
  for (const ib of S.inbounds || []) {
    if (!stores.includes(ib.store)) continue;
    if (ib.src) { const g = add(`plan|${ib.id}`, { k: 'plan', st: ib.store, file: ib.src, at: ib.at, by: ib.by, co: ib.co, uid: ib.uid }); g.n = (ib.items || []).length; g.q = (ib.items || []).reduce((a, x) => a + (x.plan || x.qty || 0), 0); span(g, ib.date); }
    if (ib.actSrc) { const g = add(`act|${ib.id}`, { k: 'act', st: ib.store, file: ib.actSrc, at: ib.actAt || ib.at, by: ib.actBy, co: ib.actCo, uid: ib.actUid }); g.n = (ib.items || []).length; span(g, ib.date); }
  }
  return [...G.values()].sort((a, b) => (b.at || '').localeCompare(a.at || ''));
}
function filesView() {
  const st = S.stores, all = fileHistory(st), multi = st.length > 1;
  const fk = S.ui.fk || '', q = norm(S.ui.fq || ''), who = S.ui.fwho || '';
  const whoOf = r => whoNow(r.by, r.uid, r.co) || '-';
  const people = [...new Set(all.map(whoOf))].sort((a, b) => a.localeCompare(b, 'ko'));
  let L = all.filter(r => (!fk || r.k === fk) && (!who || whoOf(r) === who) && (!q || norm(r.file).includes(q)));
  const kinds = Object.keys(FK).filter(k => all.some(r => r.k === k));
  const desc = r => {
    const per = r.d1 ? (r.d1 === r.d2 ? md(r.d1) : `${md(r.d1)}~${md(r.d2)}`) : '';
    if (r.k === 'pos') return r.onlyStock ? `${per} 재고 차감 ${fmt(r.ded)}줄` : `${per} ${fmt(r.n)}일 · ${man(r.amt)}${r.ded ? ` · 재고 차감 ${fmt(r.ded)}줄` : ''}`;
    if (r.k === 'mach') return `${[...r.mach].join(', ')} · ${per} · ${man(r.amt)}`;
    if (r.k === 'plan') return `${per} 입고 예정 · ${fmt(r.n)}종 ${r.q ? fmt(r.q) + '개' : ''}`;
    if (r.k === 'act') return `${per} 입고분 · ${fmt(r.n)}종 대조`;
    return `${per} · ${fmt(r.n)}종 ${r.q ? fmt(r.q) + '개' : ''}`;
  };
  const kst16 = a => a ? kst(a) : '-';
  return `${head('파일 이력', `올린 파일 ${fmt(all.length)}건 · 매출·재고·입고·실사 파일을 누가 언제 올렸는지 모아 봅니다${can('sales') ? '' : ' (매출 파일은 매출 권한자만 보입니다)'}`)}
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="chips"><button class="chip ${!fk ? 'on' : ''}" data-fk="">전체 ${fmt(all.length)}</button>${kinds.map(k => `<button class="chip ${fk === k ? 'on' : ''}" data-fk="${k}">${FK[k]} ${fmt(all.filter(r => r.k === k).length)}</button>`).join('')}</div>
    <div class="formgrid"><div class="field"><label for="fq">파일 이름 찾기</label><input class="inp" id="fq" value="${esc(S.ui.fq || '')}" placeholder="예: 매출리포트"></div>
    <div class="field"><label for="fwho">올린 사람</label><select class="inp" id="fwho"><option value="">전체</option>${people.map(p => `<option ${who === p ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></div></div>
  </div>
  <div class="card"><h2>${fk ? FK[fk] : '전체'} <span class="r">${fmt(L.length)}건</span></h2>${L.length ? `<div class="tw"><table class="tb flist"><thead><tr><th>올린 시각</th><th>종류</th><th>파일</th>${multi ? '<th>매장</th>' : ''}<th>올린 사람</th></tr></thead><tbody>
    ${L.map(r => `<tr><td class="nowrap">${kst16(r.at)}</td><td class="nowrap"><span class="pill ${r.k === 'pos' || r.k === 'mach' ? 'p-info' : r.k === 'count' ? 'p-warn' : 'p-ok'}">${FK[r.k]}</span></td><td class="fnm"><span class="fn">📎 ${esc(r.file)}</span><span class="muted fd">${esc(desc(r))}</span></td>${multi ? `<td class="nowrap">${sdot(r.st)}${esc(shortName(r.st))}</td>` : ''}<td class="fwho"><b>${esc(whoOf(r))}</b></td></tr>`).join('')}
  </tbody></table></div>` : '<div class="empty">올린 파일이 없습니다</div>'}</div>`;
}
/* ───────── 홈 칸 상세 (현재 재고 · 품절 · 마이너스) ───────── */
// 판매 기록(POS)으로 상품별 최근 판매 수량과 마지막 판매일을 셉니다
function saleStats(stores, ref) {
  const d7 = addDays(ref, -6), d30 = addDays(ref, -29), o = {};
  for (const m of S.moves) {
    if (m.type !== '판매' || !stores.includes(m.store)) continue;
    const k = m.store + '|' + m.pid, x = o[k] ||= { q7: 0, q30: 0, last: '' };
    if (m.date >= d7 && m.date <= ref) x.q7 -= m.qty;
    if (m.date >= d30 && m.date <= ref) x.q30 -= m.qty;
    if (m.date > x.last) x.last = m.date;
  }
  return o;
}
const HD_T = { all: ['현재 재고', '재고가 남아 있는 상품입니다. IP를 누르면 그 IP만 봅니다.'], out: ['품절 (재고 0)', '최근 30일 동안 많이 팔린 품절 상품부터 보여 줍니다. 위쪽일수록 재입고나 매장 이동을 먼저 검토하세요.'], neg: ['마이너스 재고', '판매가 입고보다 많이 잡힌 상품입니다. 입고 등록이 빠졌거나 바코드가 다른 상품으로 찍혔을 수 있습니다. 실사로 맞춰 주세요.'] };
function homeDrawer() {
  const o = S.ui.hd, st = S.stores, multi = st.length > 1, ref = latestSalesDate(st) || today();
  const ss = saleStats(st, ref), sg = (s, pid) => ss[s + '|' + pid] || { q7: 0, q30: 0, last: '' };
  const [title, desc] = HD_T[o.k];
  let rows = [];
  if (o.k === 'all') {
    rows = S.products.map(p => { const per = st.map(s => stockOf(s, p.id)); const t = per.reduce((a, b) => a + Math.max(0, b), 0); const q30 = st.reduce((a, s) => a + sg(s, p.id).q30, 0); return { p, per, t, q30, amt: (p.price || 0) * t }; }).filter(r => r.t > 0);
  } else {
    for (const s of st) for (const [pid, q] of Object.entries(S.stock[s] || {})) { const p = S.P[pid]; if (!p) continue; if (o.k === 'out' ? q === 0 : q < 0) rows.push({ p, s, q, ...sg(s, pid), other: st.filter(x => x !== s).reduce((a, x) => a + Math.max(0, stockOf(x, pid)), 0) }); }
  }
  const ipAgg = {}; for (const r of rows) { const x = ipAgg[r.p.ip || '(IP 없음)'] ||= { n: 0, q: 0, amt: 0 }; x.n++; x.q += o.k === 'all' ? r.t : r.q; x.amt += r.amt || 0; }
  const ips = Object.entries(ipAgg).sort((a, b) => o.k === 'all' ? b[1].q - a[1].q : b[1].n - a[1].n);
  const view = o.ip ? rows.filter(r => (r.p.ip || '(IP 없음)') === o.ip) : rows;
  if (o.k === 'all') view.sort((a, b) => b.t - a.t); else if (o.k === 'out') view.sort((a, b) => b.q30 - a.q30 || (b.last || '').localeCompare(a.last || '')); else view.sort((a, b) => a.q - b.q);
  const LIM = 300, shown = view.slice(0, LIM);
  const totQ = rows.reduce((a, r) => a + (o.k === 'all' ? r.t : r.q), 0), totAmt = rows.reduce((a, r) => a + (r.amt || 0), 0);
  const kpi = o.k === 'all'
    ? `<div class="hk"><div><span>재고 수량</span><b>${fmt(totQ)}<small>개</small></b></div><div><span>상품</span><b>${fmt(rows.length)}<small>종</small></b></div>${limited() ? '' : `<div><span>재고 금액 (판매가 기준)</span><b>${fmt(totAmt)}<small>원</small></b></div>`}</div>`
    : `<div class="hk"><div><span>${o.k === 'out' ? '품절 상품' : '마이너스 상품'}</span><b>${fmt(rows.length)}<small>종</small></b></div>${o.k === 'neg' ? `<div><span>모자라는 수량 합계</span><b class="qty-neg">${fmt(totQ)}<small>개</small></b></div>` : `<div><span>최근 7일에 팔린 품절 상품</span><b>${fmt(rows.filter(r => r.q7 > 0).length)}<small>종</small></b></div>`}${multi && o.k === 'out' ? `<div><span>다른 매장엔 재고 있음</span><b>${fmt(rows.filter(r => r.other > 0).length)}<small>종</small></b></div>` : ''}</div>`;
  const ipTable = `<div class="card"><h2>IP별 <span class="r">${ips.length}개 IP</span></h2><div class="tw"><table class="tb"><thead><tr><th>IP</th><th class="n">상품</th><th class="n">${o.k === 'out' ? '' : '수량'}</th>${o.k === 'all' && !limited() ? '<th class="n">재고 금액</th><th class="hide-s" style="width:22%">비중</th>' : ''}</tr></thead><tbody>
    <tr class="click ${!o.ip ? 'sel' : ''}" data-hdip=""><td><b>전체</b></td><td class="n">${fmt(rows.length)}</td><td class="n">${o.k === 'out' ? '' : fmt(totQ)}</td>${o.k === 'all' && !limited() ? `<td class="n">${fmt(totAmt)}</td><td class="hide-s"></td>` : ''}</tr>
    ${ips.map(([ip, x]) => `<tr class="click ${o.ip === ip ? 'sel' : ''}" data-hdip="${esc(ip)}"><td>${esc(ip)}</td><td class="n">${fmt(x.n)}</td><td class="n ${o.k === 'neg' ? 'qty-neg' : ''}">${o.k === 'out' ? '' : fmt(x.q)}</td>${o.k === 'all' && !limited() ? `<td class="n">${fmt(x.amt)}</td><td class="hide-s"><span class="hbar"><i style="width:${totQ ? Math.max(1, x.q / totQ * 100).toFixed(1) : 0}%"></i></span></td>` : ''}</tr>`).join('')}
  </tbody></table></div></div>`;
  const sd = s => multi ? `<td class="nowrap">${sdot(s)}${esc(shortName(s))}</td>` : '';
  const lastTxt = d => d ? `${md(d)}<span class="muted hide-s"> · ${daysBetween(d, ref)}일 전</span>` : '<span class="muted">없음</span>';
  let list;
  if (o.k === 'all') list = `<thead><tr><th>상품명</th><th class="hide-s">IP</th>${multi ? st.map(s => `<th class="n">${esc(shortName(s))}</th>`).join('') : ''}<th class="n">재고</th>${limited() ? '' : '<th class="n hide-s">판매가</th><th class="n">재고 금액</th>'}<th class="n">30일 판매</th></tr></thead><tbody>
    ${shown.map(r => `<tr class="click" data-pid="${esc(r.p.id)}"><td class="nm">${esc(r.p.name)}</td><td class="hide-s nowrap">${esc(r.p.ip)}</td>${multi ? r.per.map(x => `<td class="n ${x < 0 ? 'qty-neg' : x === 0 ? 'muted' : ''}">${fmt(x)}</td>`).join('') : ''}<td class="n"><b>${fmt(r.t)}</b></td>${limited() ? '' : `<td class="n hide-s">${r.p.price ? fmt(r.p.price) : '-'}</td><td class="n">${r.amt ? fmt(r.amt) : '-'}</td>`}<td class="n">${r.q30 ? fmt(r.q30) : '<span class="muted">0</span>'}</td></tr>`).join('')}</tbody>`;
  else if (o.k === 'out') list = `<thead><tr><th>상품명</th><th class="hide-s">IP</th>${multi ? '<th>매장</th>' : ''}<th>마지막 판매</th><th class="n hide-s">7일</th><th class="n">30일</th>${multi ? '<th class="n">다른 매장</th>' : ''}</tr></thead><tbody>
    ${shown.map(r => `<tr class="click" data-pid="${esc(r.p.id)}"><td class="nm">${esc(r.p.name)}${r.q7 > 0 ? ' <span class="pill p-warn">최근 판매</span>' : ''}</td><td class="hide-s nowrap">${esc(r.p.ip)}</td>${sd(r.s)}<td class="nowrap">${lastTxt(r.last)}</td><td class="n hide-s">${r.q7 ? fmt(r.q7) : '<span class="muted">0</span>'}</td><td class="n"><b>${r.q30 ? fmt(r.q30) : '<span class="muted">0</span>'}</b></td>${multi ? `<td class="n">${r.other ? `<b style="color:var(--ok)">${fmt(r.other)}</b>` : '<span class="muted">0</span>'}</td>` : ''}</tr>`).join('')}</tbody>`;
  else list = `<thead><tr><th>상품명</th><th class="hide-s">IP</th>${multi ? '<th>매장</th>' : ''}<th class="n">현재 재고</th><th>마지막 판매</th><th class="n">30일 판매</th></tr></thead><tbody>
    ${shown.map(r => `<tr class="click" data-pid="${esc(r.p.id)}"><td class="nm">${esc(r.p.name)}<div class="code">${esc(r.p.barcode || r.p.sku || '')}</div></td><td class="hide-s nowrap">${esc(r.p.ip)}</td>${sd(r.s)}<td class="n qty-neg"><b>${fmt(r.q)}</b></td><td class="nowrap">${lastTxt(r.last)}</td><td class="n">${r.q30 ? fmt(r.q30) : '<span class="muted">0</span>'}</td></tr>`).join('')}</tbody>`;
  const acts = `<div class="row" style="flex-wrap:wrap">${o.k === 'neg' && can('count') ? '<button class="btn pri" data-hdgo="count">실사 하러 가기</button>' : ''}<button class="btn" data-hdgo="products">상품·재고에서 보기</button><button class="btn" id="stockDoc">재고 문서 출력</button></div>`;
  return `<div class="hd"><div><div class="muted" style="font-size:12px">${multi ? `${st.length}개 매장` : esc(storeName(st[0]))} · 판매 반영 ${md(ref)}까지</div><h3>${title}</h3></div><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">${kpi}<p class="muted" style="margin:0;font-size:13px">${desc}</p>${acts}</div>
  ${rows.length ? ipTable : ''}
  <div class="card"><h2>${o.ip ? esc(o.ip) : '전체'} 상품 <span class="r">${fmt(view.length)}종${view.length > LIM ? ` · 위 ${LIM}종만 표시` : ''}</span></h2>${view.length ? `<div class="tw"><table class="tb">${list}</table></div>` : `<div class="empty">✔ ${o.k === 'neg' ? '마이너스 재고가 없습니다' : o.k === 'out' ? '품절 상품이 없습니다' : '재고가 없습니다'}</div>`}</div>`;
}
homeDrawer.wide = true; cmpDrawer.wide = true;
// 이 기간에 많이 팔린 상품 (POS 판매 기록 기준) — 매출 비교 창 아래에 붙입니다
function topSold(stores, a, b, pa, pb) {
  const cur = {}, pre = {};
  for (const m of S.moves) { if (m.type !== '판매' || !stores.includes(m.store)) continue; if (m.date >= a && m.date <= b) cur[m.pid] = (cur[m.pid] || 0) - m.qty; else if (m.date >= pa && m.date <= pb) pre[m.pid] = (pre[m.pid] || 0) - m.qty; }
  const L = Object.entries(cur).filter(([, q]) => q > 0).map(([pid, q]) => ({ p: S.P[pid] || { name: pid, ip: '' }, pid, q, pq: pre[pid] || 0 })).sort((x, y) => y.q - x.q || (y.p.price || 0) - (x.p.price || 0));
  if (!L.length) return '';
  const ipA = {}; for (const r of L) { const x = ipA[r.p.ip || '(IP 없음)'] ||= { q: 0, amt: 0 }; x.q += r.q; x.amt += (r.p.price || 0) * r.q; }
  const ipL = Object.entries(ipA).sort((x, y) => y[1].amt - x[1].amt), tA = ipL.reduce((t, [, x]) => t + x.amt, 0);
  return `<div class="card"><h2>IP별 판매 <span class="r">판매가 × 수량 기준</span></h2><div class="tw"><table class="tb"><thead><tr><th>IP</th><th class="n">수량</th><th class="n">금액</th><th class="hide-s" style="width:26%">비중</th></tr></thead><tbody>
    ${ipL.map(([ip, x]) => `<tr><td>${esc(ip)}</td><td class="n">${fmt(x.q)}</td><td class="n">${fmt(x.amt)}</td><td class="hide-s"><span class="hbar"><i style="width:${tA ? Math.max(1, x.amt / tA * 100).toFixed(1) : 0}%"></i></span></td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><h2>많이 팔린 상품 <span class="r">${fmt(L.length)}종 중 위 30개</span></h2><div class="tw"><table class="tb"><thead><tr><th>상품명</th><th class="hide-s">IP</th><th class="n">이번</th><th class="n">비교</th><th class="n">금액</th></tr></thead><tbody>
    ${L.slice(0, 30).map(r => `<tr class="click" data-pid="${esc(r.pid)}"><td class="nm">${esc(r.p.name)}</td><td class="hide-s nowrap">${esc(r.p.ip)}</td><td class="n"><b>${fmt(r.q)}</b></td><td class="n muted">${fmt(r.pq)}</td><td class="n">${r.p.price ? fmt(r.p.price * r.q) : '-'}</td></tr>`).join('')}</tbody></table></div></div>`;
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
  return `${head('상품·재고', `${fmt(rows.length)}종 · ${freshLine(st) || '이름·바코드·품번·IP로 찾기'}`, `<button class="btn" id="scanBtn">${ic('scan')} 바코드 스캔</button><button class="btn pri" id="stockDoc">재고 문서 출력</button>`)}${freshTable(st, { sales: false })}
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="row"><div class="search">${ic('search')}<input class="inp" id="pq" type="search" placeholder="상품명, 바코드, 품번, IP" value="${esc(S.ui.q)}" autocomplete="off"></div>
      <select class="inp" id="pip" style="width:auto;min-width:160px" aria-label="IP"><option value="">IP 전체</option>${ips.map(i => `<option ${S.ui.ip === i ? 'selected' : ''}>${esc(i)}</option>`).join('')}</select></div>
    <div class="chips">${[['all', '재고 등록 상품'], ['in', '재고 있음'], ['out', '품절'], ['neg', '마이너스']].map(([k, t]) => `<button class="chip ${S.ui.f === k ? 'on' : ''}" data-pf="${k}">${t}</button>`).join('')}</div>
  </div>
  <div class="card" style="padding:8px 12px">
    ${rows.length ? `<div class="tw"><table><thead><tr><th>상품명</th><th class="hide-s">IP</th><th class="hide-s">바코드·품번</th>${multi ? st.map(s => `<th class="n">${sdot(s)}${esc(shortName(s))}</th>`).join('') : ''}<th class="n">${multi ? '합계' : '재고'}</th><th class="hide-s">상태</th></tr></thead><tbody>
      ${shown.map(r => `<tr class="click" data-pid="${esc(r.p.id)}"><td class="nm">${esc(r.p.name)}</td><td class="hide-s nowrap">${esc(r.p.ip)}</td><td class="code hide-s">${esc(r.p.barcode || r.p.sku)}</td>
        ${multi ? r.per.map(x => `<td class="n ${x < 0 ? 'qty-neg' : x === 0 ? 'qty-zero' : ''}">${fmt(x)}</td>`).join('') : ''}<td class="n big ${r.t < 0 ? 'qty-neg' : r.t === 0 ? 'qty-zero' : ''}" style="font-size:16px">${fmt(r.t)}</td><td class="hide-s">${statusPill(r.t)}</td></tr>`).join('')}
    </tbody></table></div>${rows.length > 300 ? `<p class="muted" style="font-size:13px">앞 300종만 보여 줍니다. 검색으로 좁혀 주세요.</p>` : ''}` : '<div class="empty">찾는 상품이 없습니다</div>'}
  </div>`;
}
// 재고 현황 문서 (대표 지시 2026-11-01): IP 여러 개 · 매장 여러 곳 · 기준 날짜를 골라 엑셀 또는 인쇄·PDF
// 기준 날짜 재고 = 지금 재고 − 그 날짜 다음 날부터 들어온 기록(입고·판매·이동 등)을 되돌린 값
function stockAtMap(st, date) {
  const back = {}; let oldest = '';
  for (const m of S.moves) { if (m.store !== st) continue; if (!oldest || m.date < oldest) oldest = m.date; if (m.date > date) back[m.pid] = (back[m.pid] || 0) + m.qty; }
  return { at: pid => stockOf(st, pid) - (back[pid] || 0), oldest };
}
function stockDocRows(o) {
  const maps = o.stores.map(st => stockAtMap(st, o.date));
  let rows = S.products.filter(p => (!o.ips.length || o.ips.includes(p.ip)) && o.stores.some(st => (S.stock[st] || {})[p.id] != null)).map(p => {
    const per = maps.map(m => m.at(p.id)); return { p, per, t: per.reduce((a, b) => a + b, 0) };
  });
  if (o.f === 'in') rows = rows.filter(r => r.t > 0); if (o.f === 'out') rows = rows.filter(r => r.t === 0); if (o.f === 'neg') rows = rows.filter(r => r.t < 0 || r.per.some(x => x < 0));
  rows.sort((a, b) => (a.p.ip || '').localeCompare(b.p.ip || '', 'ko') || a.p.name.localeCompare(b.p.name, 'ko'));
  const warn = o.date < today() ? o.stores.filter((st, i) => Object.keys(S.stock[st] || {}).length && (!maps[i].oldest || maps[i].oldest > o.date)).map(storeName) : [];
  return { rows, warn };
}
function stockDocMeta(o, n) {
  const f = { all: '재고 등록 상품', in: '재고 있음', out: '품절', neg: '마이너스' }[o.f] || '재고 등록 상품';
  const ipTxt = !o.ips.length ? 'IP 전체' : o.ips.length <= 4 ? o.ips.join(', ') : `${o.ips.slice(0, 3).join(', ')} 외 ${o.ips.length - 3}개`;
  const stTxt = o.stores.length === myStores().length && o.stores.length > 1 ? '전체 매장' : o.stores.map(shortName).join(', ');
  const isToday = o.date >= today();
  return { title: `재고 현황 · ${stTxt}`, cond: `${md(o.date)}(${wd(o.date)}) ${isToday ? '현재' : '마감 기준'} · ${ipTxt} · ${f} · ${n}종`, made: kst(new Date().toISOString()), who: whoText(S.user.name, userCo(S.user)), stTxt, ipTxt };
}
// 상품에 판매가가 없으면 토스포스 판매 기록(매출 ÷ 수량)으로 채움
function posPriceMap() {
  const k = S.moves.length + ':' + Object.keys(S.sales).length; if (posPriceMap._k === k) return posPriceMap._m;
  const A = {}; for (const st of Object.keys(S.sales || {})) for (const mon of Object.values(S.sales[st] || {})) for (const r of Object.values(mon.days || {})) for (const [nm, v] of Object.entries(r.pr || {})) { const x = A[norm(nm)] ||= [0, 0]; x[0] += v[0] || 0; x[1] += v[1] || 0; }
  const M = {}; for (const [k2, [q, sm]] of Object.entries(A)) if (q > 0 && sm > 0) M[k2] = Math.round(sm / q / 100) * 100;
  posPriceMap._k = k; posPriceMap._m = M; return M;
}
const priceOf = p => p.price || posPriceMap()[norm(p.name)] || 0;
/* ───────── 재고 흐름표: 입고·판매·기타 → 남은 재고 (대표 지시 2026-11-02: 하이큐 10/31 재고표 양식으로 출력) ───────── */
function flowRows(o) {
  const from = o.from || o.date.slice(0, 8) + '01', to = o.date, A = {};
  for (const st of o.stores) {
    const sumAll = {};
    for (const m of S.moves) {
      if (m.store !== st) continue;
      sumAll[m.pid] = (sumAll[m.pid] || 0) + m.qty;
      if (m.date > to) continue;
      const x = A[m.pid] ||= { preIn: 0, preSale: 0, preOth: 0, inQ: 0, sale: 0, oth: 0, base: 0 };
      const pre = m.date < from, sale = m.type === '판매', cnt = m.type === COUNT_TYPE;
      if (sale) { if (pre) x.preSale -= m.qty; else x.sale -= m.qty; }
      else if (!cnt && m.qty > 0) { if (pre) x.preIn += m.qty; else x.inQ += m.qty; }
      else { if (pre) x.preOth += m.qty; else x.oth += m.qty; }
    }
    // 앱에 기록이 생기기 전부터 있던 재고 = 지금 재고 − 기록 합계 → 이전 입고에 넣음
    for (const pid of Object.keys(S.stock[st] || {})) { const x = A[pid] ||= { preIn: 0, preSale: 0, preOth: 0, inQ: 0, sale: 0, oth: 0, base: 0 }; x.base += stockOf(st, pid) - (sumAll[pid] || 0); }
  }
  let rows = S.products.filter(p => (!o.ips.length || o.ips.includes(p.ip)) && o.stores.some(st => (S.stock[st] || {})[p.id] != null)).map(p => {
    const x = A[p.id] || { preIn: 0, preSale: 0, preOth: 0, inQ: 0, sale: 0, oth: 0, base: 0 };
    const preIn = x.preIn + Math.max(0, x.base), preOth = x.preOth + Math.min(0, x.base);
    const start = preIn - x.preSale + preOth, t = start + x.inQ - x.sale + x.oth;
    return { p, preIn, preSale: x.preSale, preOth: -preOth, start, inQ: x.inQ, sale: x.sale, oth: -x.oth, t, base: x.base };   // 이동·실사 칸: 빠진 수량은 +, 실사로 늘어난 수량은 −
  });
  if (o.f === 'in') rows = rows.filter(r => r.t > 0); if (o.f === 'out') rows = rows.filter(r => r.t === 0); if (o.f === 'neg') rows = rows.filter(r => r.t < 0);
  rows.sort((a, b) => (a.p.ip || '').localeCompare(b.p.ip || '', 'ko') || a.p.name.localeCompare(b.p.name, 'ko'));
  return { rows, from, to };
}
const flowStatus = t => t < 0 ? '마이너스' : t === 0 ? '품절' : t <= 10 ? '10개 이하' : '';
function flowMeta(o, rows, from, to) {
  const M = stockDocMeta(o, rows.length), pd = addDays(from, -1);
  const ipName = o.ips.length === 1 ? o.ips[0] : M.ipTxt;
  return { ...M, pd, title: `${ipName} — 남은 재고 (${md(to)} ${to >= today() ? '현재' : '영업 마감 기준'})`, eyebrow: `${M.stTxt} · 재고 확인`,
    basis: `기준 자료: ${md(pd)} 마감 재고 + ${md(from)}~${md(to)} 입고·판매·기타(이동·실사 조정) · ${o.stores.length > 1 ? `${o.stores.length}개 매장 합계` : M.stTxt}`,
    heads: ['NO.', ...(o.ips.length === 1 ? [] : ['IP']), '상품명', '입고\n~' + md(pd), '판매\n~' + md(pd), '이동·실사·\n기타 ~' + md(pd), '재고\n' + md(pd) + ' 마감', '추가 입고\n' + md(from) + '~' + md(to), '판매\n' + md(from) + '~' + md(to), '이동·실사\n' + md(from) + '~' + md(to), md(to) + '\n남은 재고', '상태', '판매가', '재고 금액\n(판매가×남은 재고)'] };
}
function flowNotes(rows, from) {
  const N = [];
  const neg = rows.filter(r => r.t < 0); if (neg.length) N.push(['bad', `마이너스 ${neg.length}종: ${neg.slice(0, 5).map(r => r.p.name).join(', ')}${neg.length > 5 ? ' 외' : ''} — 입고 등록이 빠졌거나 다른 상품으로 찍힌 판매가 있을 수 있습니다. 실사로 맞춰 주세요.`]);
  const out = rows.filter(r => r.t === 0); if (out.length) N.push(['', `품절 ${out.length}종`]);
  if (rows.some(r => r.base)) N.push(['', '앱에 기록이 생기기 전부터 있던 재고는 "입고" 칸에 포함했습니다.']);
  N.push(['', '남은 재고 = 재고 + 추가 입고 − 판매 − 이동·실사. 이동·실사 칸은 다른 곳으로 보낸 수량·실사로 줄어든 수량이 +, 실사로 늘어난 수량은 −로 들어갑니다. 받은 수량은 입고 칸에 들어갑니다.']);
  N.push(['', '재고 금액 = 판매가 × 남은 재고 (마이너스는 0으로 계산)']);
  return N;
}
async function exportFlow(o) {
  try { if (!window.XLSX || !XLSX.__styled) { await loadScript('https://cdn.jsdelivr.net/npm/xlsx-js-style@1.2.0/dist/xlsx.bundle.js'); XLSX.__styled = true; } } catch (e) { /* 꾸밈 없는 엑셀로라도 받기 */ }
  const { rows, from, to } = flowRows(o), M = flowMeta(o, rows, from, to), oneIp = o.ips.length === 1;
  const H = M.heads, nc = H.length, off = oneIp ? 0 : 1;   // IP 칸이 있으면 한 칸씩 밀림
  const col = i => XLSX.utils.encode_col(i);
  const C = { pin: 2 + off, psale: 3 + off, poth: 4 + off, st: 5 + off, inq: 6 + off, sale: 7 + off, oth: 8 + off, t: 9 + off, stat: 10 + off, pr: 11 + off, amt: 12 + off };
  const R0 = 4, ws = {};
  const F = { name: '맑은 고딕', sz: 10 }, bd = { bottom: { style: 'thin', color: { rgb: 'E6E7EE' } } };
  const put = (r, c, v, st = {}) => { const ref = col(c) + (r + 1); const cell = typeof v === 'object' && v && v.f ? { t: 'n', f: v.f } : { t: typeof v === 'number' ? 'n' : 's', v: v ?? '' }; cell.s = st; ws[ref] = cell; return cell; };
  put(0, 0, M.eyebrow, { font: { ...F, bold: true, color: { rgb: '2563C9' } } });
  put(1, 0, M.title, { font: { ...F, sz: 16, bold: true } });
  put(2, 0, M.basis, { font: { ...F, sz: 9.5, color: { rgb: '555555' } } });
  H.forEach((h, i) => put(R0, i, h, { font: { ...F, bold: true }, fill: { fgColor: { rgb: i === C.t ? 'DFE8F8' : 'F1F2F6' } }, alignment: { horizontal: i === 0 || i === C.stat ? 'center' : i <= 1 + off ? 'left' : 'right', vertical: 'center', wrapText: true }, border: { bottom: { style: 'medium', color: { rgb: 'C9CCD8' } } } }));
  rows.forEach((r, k) => {
    const R = R0 + 1 + k, ex = R + 1, flag = r.t < 0 ? 'FFD45C' : r.inQ ? 'FFF1C7' : null;
    const base = (c, extra = {}) => ({ font: F, border: bd, alignment: { horizontal: c === 0 || c === C.stat ? 'center' : c <= 1 + off ? 'left' : 'right', vertical: 'center' }, numFmt: '#,##0;-#,##0;', ...(flag ? { fill: { fgColor: { rgb: flag } } } : {}), ...extra });
    put(R, 0, k + 1, base(0)); if (!oneIp) put(R, 1, r.p.ip || '', base(1)); put(R, 1 + off, r.p.name + (r.t < 0 ? '  [마이너스]' : ''), base(1 + off, r.t < 0 ? { font: { ...F, bold: true } } : {}));
    put(R, C.pin, r.preIn, base(C.pin)); put(R, C.psale, r.preSale, base(C.psale)); put(R, C.poth, r.preOth, base(C.poth));
    put(R, C.st, { f: `${col(C.pin)}${ex}-${col(C.psale)}${ex}-${col(C.poth)}${ex}` }, base(C.st));
    put(R, C.inq, r.inQ, base(C.inq)); put(R, C.sale, r.sale, base(C.sale)); put(R, C.oth, r.oth, base(C.oth));
    put(R, C.t, { f: `${col(C.st)}${ex}+${col(C.inq)}${ex}-${col(C.sale)}${ex}-${col(C.oth)}${ex}` }, base(C.t, { font: { ...F, bold: true }, fill: { fgColor: { rgb: flag || 'EEF3FC' } } }));
    ws[col(C.st) + ex].v = r.start; ws[col(C.t) + ex].v = r.t;
    put(R, C.stat, { f: `IF(${col(C.t)}${ex}<0,"마이너스",IF(${col(C.t)}${ex}=0,"품절",IF(${col(C.t)}${ex}<=10,"10개 이하","")))` }, base(C.stat, { font: { ...F, bold: true, color: { rgb: 'B3261E' } } })); ws[col(C.stat) + ex].t = 's'; ws[col(C.stat) + ex].v = flowStatus(r.t);
    put(R, C.pr, priceOf(r.p), base(C.pr));
    put(R, C.amt, { f: `MAX(${col(C.t)}${ex},0)*${col(C.pr)}${ex}` }, base(C.amt)); ws[col(C.amt) + ex].v = Math.max(0, r.t) * priceOf(r.p);
  });
  const TR = R0 + 1 + rows.length, top = { top: { style: 'medium', color: { rgb: 'C9CCD8' } } };
  put(TR, 1 + off, `합계 ${rows.length}종`, { font: { ...F, bold: true }, border: top });
  for (const c of [C.pin, C.psale, C.poth, C.st, C.inq, C.sale, C.oth, C.t, C.amt]) { const cell = put(TR, c, { f: `SUM(${col(c)}${R0 + 2}:${col(c)}${TR})` }, { font: { ...F, bold: true }, numFmt: '#,##0', border: top, alignment: { horizontal: 'right' }, ...(c === C.t ? { fill: { fgColor: { rgb: 'EEF3FC' } } } : {}) }); const key = Object.keys(C).find(k => C[k] === c); cell.v = rows.reduce((a, r) => a + (key === 'amt' ? Math.max(0, r.t) * priceOf(r.p) : key === 'st' ? r.start : r[{ pin: 'preIn', psale: 'preSale', poth: 'preOth', inq: 'inQ', sale: 'sale', oth: 'oth', t: 't' }[key]]), 0); }
  const N = flowNotes(rows, from); const merges = [];
  N.forEach(([lv, t], i) => { const R = TR + 2 + i; put(R, 0, (lv === 'bad' ? '▲ ' : '◆ ') + t, { font: { ...F, bold: lv === 'bad' }, fill: { fgColor: { rgb: 'E9F0FB' } } }); for (let c = 1; c < nc; c++) put(R, c, '', { fill: { fgColor: { rgb: 'E9F0FB' } } }); merges.push({ s: { r: R, c: 0 }, e: { r: R, c: nc - 1 } }); });
  const FR = TR + 3 + N.length; put(FR, 0, `기준: ${o.date}(${wd(o.date)}) ${o.date >= today() ? '현재' : '영업 마감'} · 출력 ${M.made} · ${M.who}`, { font: { ...F, sz: 9, color: { rgb: '888888' } } });
  ws['!ref'] = `A1:${col(nc - 1)}${FR + 1}`; ws['!merges'] = merges;
  ws['!cols'] = [{ wch: 6 }, ...(oneIp ? [] : [{ wch: 16 }]), { wch: 42 }, { wch: 9 }, { wch: 9 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 11 }, { wch: 10 }, { wch: 9 }, { wch: 15 }];
  ws['!rows'] = []; ws['!rows'][R0] = { hpt: 34 };
  ws['!freeze'] = { xSplit: 2 + off, ySplit: R0 + 1 };
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '재고');
  XLSX.writeFile(wb, `재고흐름_${M.stTxt.replace(/[\s,]+/g, '_')}_${oneIp ? o.ips[0].replace(/[\\/:*?"<>|\s]+/g, '') + '_' : ''}${from.replace(/-/g, '').slice(2)}-${to.replace(/-/g, '').slice(2)}.xlsx`);
  toast(`엑셀로 받았습니다 · ${rows.length}종`);
}
function printFlow(o) {
  const { rows, from, to } = flowRows(o), M = flowMeta(o, rows, from, to), oneIp = o.ips.length === 1;
  const e = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const n = v => v ? v.toLocaleString() : '';
  const T = k => rows.reduce((a, r) => a + r[k], 0), tm = rows.reduce((a, r) => a + Math.max(0, r.t) * priceOf(r.p), 0);
  const th = M.heads.map((h, i) => `<th class="${i === 0 || h === '상태' ? 'c' : (i <= (oneIp ? 1 : 2) ? 'l' : 'r')}${h.includes('남은 재고') ? ' now' : ''}">${e(h).replace('\n', '<br><span class="g">')}${h.includes('\n') ? '</span>' : ''}</th>`).join('');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${e(M.title)}</title><style>
    @page{size:A4 landscape;margin:10mm}body{font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#1b1a22;margin:0;font-size:10px}
    .t1{color:#2563c9;font-weight:700;font-size:10.5px}h1{font-size:18px;margin:3px 0}.s{font-size:10px;color:#555;margin-bottom:8px}
    table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums}th{background:#f1f2f6;padding:5px 4px;border-bottom:2px solid #c9ccd8;font-size:9.5px;line-height:1.25;vertical-align:bottom}th.l{text-align:left}th.r{text-align:right}th.c{text-align:center}.g{color:#6b6878;font-weight:400}
    td{padding:4px 4px;border-bottom:1px solid #e6e7ee;font-size:10px}td.r{text-align:right}td.c{text-align:center}td.now{font-weight:700;background:#eef3fc}th.now{background:#dfe8f8}
    tr.a td{background:#ffd45c;font-weight:700}tr.b td{background:#fff1c7}td.st{color:#b3261e;font-weight:700}
    thead{display:table-header-group}tr{page-break-inside:avoid}tfoot{display:table-row-group}tfoot td{font-weight:700;border-top:2px solid #c9ccd8}
    .nt{margin-top:10px;background:#e9f0fb;border-left:4px solid #2563c9;padding:7px 12px;font-size:10px;line-height:1.7}.ft{margin-top:6px;font-size:9px;color:#888}
  </style></head><body>
  <div class="t1">${e(M.eyebrow)}</div><h1>${e(M.title)}</h1><div class="s">${e(M.basis)}</div>
  <table><thead><tr>${th}</tr></thead><tbody>
  ${rows.map((r, i) => `<tr class="${r.t < 0 ? 'a' : r.inQ ? 'b' : ''}"><td class="c">${i + 1}</td>${oneIp ? '' : `<td>${e(r.p.ip)}</td>`}<td>${e(r.p.name)}</td><td class="r">${n(r.preIn)}</td><td class="r">${n(r.preSale)}</td><td class="r">${n(r.preOth)}</td><td class="r">${r.start.toLocaleString()}</td><td class="r">${n(r.inQ)}</td><td class="r">${n(r.sale)}</td><td class="r">${n(r.oth)}</td><td class="r now">${r.t.toLocaleString()}</td><td class="c st">${flowStatus(r.t)}</td><td class="r">${n(priceOf(r.p))}</td><td class="r">${n(Math.max(0, r.t) * priceOf(r.p))}</td></tr>`).join('')}
  </tbody><tfoot><tr><td></td>${oneIp ? '' : '<td></td>'}<td>합계 ${rows.length}종</td><td class="r">${n(T('preIn'))}</td><td class="r">${n(T('preSale'))}</td><td class="r">${n(T('preOth'))}</td><td class="r">${T('start').toLocaleString()}</td><td class="r">${n(T('inQ'))}</td><td class="r">${n(T('sale'))}</td><td class="r">${n(T('oth'))}</td><td class="r now">${T('t').toLocaleString()}</td><td></td><td></td><td class="r">${tm.toLocaleString()}</td></tr></tfoot></table>
  <div class="nt">${flowNotes(rows, from).map(([lv, t]) => `${lv === 'bad' ? '🔺 <b>' : '🔸 '}${e(t)}${lv === 'bad' ? '</b>' : ''}`).join('<br>')}</div>
  <div class="ft">기준: ${o.date}(${wd(o.date)}) ${o.date >= today() ? '현재' : '영업 마감'} · 출력 ${e(M.made)} · ${e(M.who)}</div>
  </body></html>`;
  printHtml(html);
}
function stockDocDrawer() {
  const o = S.ui.sdoc; const mine = myStores();
  const ips = [...new Set(S.products.filter(p => o.stores.some(st => (S.stock[st] || {})[p.id] != null)).map(p => p.ip))].sort((a, b) => a.localeCompare(b, 'ko'));
  const fq = norm(o.ipq || ''); const shownIps = ips.filter(i => !fq || norm(i).includes(fq));
  const { rows, warn } = stockDocRows(o); const flow = o.form !== 'simple';
  const fr = flow ? flowRows(o) : null; const tq = (flow ? fr.rows : rows).reduce((a, r) => a + r.t, 0); const nShow = (flow ? fr.rows : rows).length;
  const oldest = o.stores.map(st => stockAtMap(st, o.date).oldest).filter(Boolean).sort()[0] || o.date;
  const ipRun = o.ips.length === 1 ? ipPlan().filter(x => o.stores.includes(x.store) && (norm(x.ip).includes(norm(o.ips[0])) || norm(o.ips[0]).includes(norm(x.ip))) && x.start <= o.date).sort((a, b) => b.start.localeCompare(a.start))[0] : null;
  return `<div class="hd"><h3>재고 문서 출력</h3><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card sdoc" style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label>양식</label><div class="sgrid" style="grid-template-columns:1fr 1fr"><button class="sbtn ${flow ? 'on' : ''}" data-sdform="flow">재고 흐름표<br><span class="muted" style="font-size:11.5px;font-weight:400">입고 · 판매 · 이동 → 남은 재고</span></button><button class="sbtn ${!flow ? 'on' : ''}" data-sdform="simple">재고 수량표<br><span class="muted" style="font-size:11.5px;font-weight:400">매장별 남은 재고만</span></button></div></div>
    <div class="field"><label>매장 <span class="muted" style="font-weight:400">· ${flow ? '여러 곳 고르면 합계로 계산' : '여러 곳 고르면 매장별 수량과 합계'}</span></label>
      <div class="sgrid"><button class="sbtn ${o.stores.length === mine.length ? 'on' : ''}" data-sdst="__all">전체 매장</button>${mine.map(st => `<button class="sbtn ${o.stores.includes(st) ? 'on' : ''}" data-sdst="${st}"><span class="dot" style="background:${storeColor(st)}"></span>${esc(shortName(st))}</button>`).join('')}</div></div>
    ${flow ? `<div class="field"><label for="sdFrom">시작 날짜 <span class="muted" style="font-weight:400">· 이날부터 기준 날짜까지 입고·판매를 따로 보여 줌</span></label>${dateSel('sdFrom', fr.from)}
      <div class="chips" style="margin-top:6px"><button class="chip ${fr.from === o.date.slice(0, 8) + '01' ? 'on' : ''}" data-sdfrom="${o.date.slice(0, 8)}01">이번 달 1일</button><button class="chip ${fr.from === addDays(o.date, -6) ? 'on' : ''}" data-sdfrom="${addDays(o.date, -6)}">최근 7일</button>${ipRun ? `<button class="chip ${fr.from === ipRun.start ? 'on' : ''}" data-sdfrom="${ipRun.start}">${esc(ipRun.ip)} 시작일 ${md(ipRun.start)}</button>` : ''}<button class="chip ${fr.from === oldest ? 'on' : ''}" data-sdfrom="${oldest}">앱 기록 처음부터</button></div></div>` : ''}
    <div class="field"><label for="sdDate">기준 날짜 <span class="muted" style="font-weight:400">· 그날 영업 마감 기준 재고</span></label>${dateSel('sdDate', o.date)}
      ${warn.length ? `<div class="note warn" style="margin-top:6px">🔸 ${esc(warn.join(', '))}: 이 날짜 이전 기록이 앱에 없어 정확하지 않을 수 있습니다 (앱 자료 시작일 이후 날짜를 골라 주세요)</div>` : ''}</div>
    <div class="field"><label>IP <span class="muted" style="font-weight:400">· 여러 개 고를 수 있음 · 아무것도 안 고르면 전체</span></label>
      <div class="row" style="gap:8px"><input class="inp" id="sdIpq" placeholder="IP 찾기 (예: 은혼)" value="${esc(o.ipq || '')}" style="flex:1;min-width:0"><button class="btn" data-sdip="__none">선택 해제</button></div>
      ${o.ips.length ? `<div class="chips" style="margin-top:6px">${o.ips.map(i => `<button class="chip on" data-sdip="${esc(i)}">${esc(i)} ✕</button>`).join('')}</div>` : ''}
      <div class="iplist">${shownIps.map(i => `<label class="ipck"><input type="checkbox" data-sdipc="${esc(i)}" ${o.ips.includes(i) ? 'checked' : ''}><span>${esc(i)}</span></label>`).join('') || '<span class="muted">찾는 IP가 없습니다</span>'}</div></div>
    <div class="field"><label>상품 범위</label><div class="sgrid">${[['all', '재고 등록 전체'], ['in', '재고 있음'], ['out', '품절'], ['neg', '마이너스']].map(([k, t]) => `<button class="sbtn ${o.f === k ? 'on' : ''}" data-sdf="${k}">${t}</button>`).join('')}</div></div>
    <div class="note" style="font-size:13px"><b>${esc(flow ? flowMeta(o, fr.rows, fr.from, fr.to).title : stockDocMeta(o, rows.length).title)}</b><br>${esc(flow ? flowMeta(o, fr.rows, fr.from, fr.to).basis : stockDocMeta(o, rows.length).cond)} · ${fmt(nShow)}종 · 남은 재고 합계 <b>${fmt(tq)}</b>개</div>
  </div>
  <div class="sgrid" style="grid-template-columns:1fr 1fr"><button class="btn" id="sdXls" ${nShow ? '' : 'disabled'}>엑셀로 받기</button><button class="btn pri" id="sdPrint" ${nShow ? '' : 'disabled'}>인쇄 · PDF</button></div>`;
}
function exportStock(o) {
  const { rows } = stockDocRows(o), M = stockDocMeta(o, rows.length), multi = o.stores.length > 1;
  const head = ['IP', '상품명', '바코드', '품번', '판매가', ...(multi ? o.stores.map(storeName) : []), multi ? '합계' : '재고', '재고 금액', '상태'];
  const body = rows.map(r => [r.p.ip, r.p.name, r.p.barcode || '', r.p.sku || '', r.p.price || '', ...(multi ? r.per : []), r.t, (r.p.price || 0) * Math.max(0, r.t), r.t < 0 ? '마이너스' : r.t === 0 ? '품절' : r.t <= 3 ? '3개 이하' : '정상']);
  const tq = rows.reduce((a, r) => a + r.t, 0), tm = rows.reduce((a, r) => a + (r.p.price || 0) * Math.max(0, r.t), 0);
  const aoa = [[M.title], [`조건: ${M.cond}`], [`출력 ${M.made} · ${M.who}`], [], head, ...body, [], ['합계', `${rows.length}종`, '', '', '', ...(multi ? o.stores.map((s, i) => rows.reduce((a, r) => a + r.per[i], 0)) : []), tq, tm, '']];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 18 }, { wch: 44 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, ...(multi ? o.stores.map(() => ({ wch: 11 })) : []), { wch: 10 }, { wch: 14 }, { wch: 10 }];
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '재고현황');
  XLSX.writeFile(wb, `재고현황_${M.stTxt.replace(/[\s,]+/g, '_')}_${o.ips.length === 1 ? o.ips[0].replace(/[\\/:*?"<>|\s]+/g, '') + '_' : ''}${o.date.replace(/-/g, '')}.xlsx`);
  toast(`엑셀로 받았습니다 · ${rows.length}종`);
}
function printStock(o) {
  const { rows } = stockDocRows(o), M = stockDocMeta(o, rows.length), multi = o.stores.length > 1;
  const e = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tq = rows.reduce((a, r) => a + r.t, 0), tm = rows.reduce((a, r) => a + (r.p.price || 0) * Math.max(0, r.t), 0);
  // 열 너비: 상품명이 남는 폭을 모두 쓰고, 매장이 4곳 이상이면 바코드 칸은 빼서(엑셀에는 있음) 상품명이 좁아지지 않게
  const n = multi ? o.stores.length : 0, showBc = n < 4, sw = n > 3 ? 6.5 : 7.5;
  const fixedW = 4 + 12 + (showBc ? 12 : 0) + n * sw + 7 + 7 + 10, nameW = Math.max(24, 100 - fixedW);
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${e(M.title)}</title><style>
    @page{size:A4 ${multi && o.stores.length > 3 ? 'landscape' : 'portrait'};margin:12mm}body{font-family:"Noto Sans KR","Malgun Gothic","Apple SD Gothic Neo",sans-serif;color:#111;font-size:10.5px;margin:0}
    .hd{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #D32229;padding-bottom:6px;margin-bottom:8px}
    h1{font-size:17px;margin:0}.meta{font-size:10px;color:#555;text-align:right;line-height:1.5}
    .sum{display:flex;gap:18px;margin:6px 0 10px;font-size:11px;flex-wrap:wrap}.sum b{font-size:13px}
    table{width:100%;border-collapse:collapse;table-layout:fixed}th{background:#111;color:#fff;font-weight:700;padding:5px 4px;text-align:left;font-size:10px}
    td{border-bottom:1px solid #ddd;padding:3px 4px;vertical-align:top;font-size:9.5px;line-height:1.35;word-break:keep-all;overflow-wrap:anywhere}td.n,th.n{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}
    tr:nth-child(even) td{background:#f6f6f7}.neg{color:#D32229;font-weight:700}.zero{color:#999}
    tfoot{display:table-row-group}tfoot td{font-weight:800;border-top:2px solid #111;background:#fff!important;font-size:10.5px}thead{display:table-header-group}tr{page-break-inside:avoid}
  </style></head><body>
  <div class="hd"><div><h1>${e(M.title)}</h1><div style="font-size:10.5px;color:#444;margin-top:2px">조건: ${e(M.cond)}</div></div><div class="meta">출력 ${e(M.made)}<br>${e(M.who)}</div></div>
  <div class="sum"><span>상품 <b>${rows.length.toLocaleString()}</b>종</span><span>재고 <b>${tq.toLocaleString()}</b>개</span><span>재고 금액(판매가) <b>${tm.toLocaleString()}</b>원</span><span>품절 <b>${rows.filter(r => r.t === 0).length}</b>종</span><span>마이너스 <b>${rows.filter(r => r.t < 0).length}</b>종</span></div>
  <table><thead><tr><th style="width:4%">No</th><th style="width:12%">IP</th><th style="width:${nameW}%">상품명</th>${showBc ? '<th style="width:12%">바코드·품번</th>' : ''}${multi ? o.stores.map(s => `<th class="n" style="width:${sw}%">${e(shortName(s))}</th>`).join('') : ''}<th class="n" style="width:7%">${multi ? '합계' : '재고'}</th><th class="n" style="width:7%">판매가</th><th class="n" style="width:10%">재고 금액</th></tr></thead><tbody>
  ${rows.map((r, i) => `<tr><td>${i + 1}</td><td>${e(r.p.ip)}</td><td>${e(r.p.name)}</td>${showBc ? `<td>${e(r.p.barcode || r.p.sku)}</td>` : ''}${multi ? r.per.map(x => `<td class="n ${x < 0 ? 'neg' : x === 0 ? 'zero' : ''}">${x.toLocaleString()}</td>`).join('') : ''}<td class="n ${r.t < 0 ? 'neg' : r.t === 0 ? 'zero' : ''}"><b>${r.t.toLocaleString()}</b></td><td class="n">${r.p.price ? r.p.price.toLocaleString() : ''}</td><td class="n">${r.p.price && r.t > 0 ? (r.p.price * r.t).toLocaleString() : ''}</td></tr>`).join('')}
  </tbody><tfoot><tr><td colspan="${showBc ? 4 : 3}">합계 ${rows.length.toLocaleString()}종</td>${multi ? o.stores.map((s, i) => `<td class="n">${rows.reduce((a, r) => a + r.per[i], 0).toLocaleString()}</td>`).join('') : ''}<td class="n">${tq.toLocaleString()}</td><td class="n"></td><td class="n">${tm.toLocaleString()}원</td></tr></tfoot></table>
  <p style="font-size:9px;color:#666;margin-top:6px">재고 금액 = 판매가 × 남은 재고 (마이너스 재고는 0으로 계산)</p>
  </body></html>`;
  printHtml(html);
}
function printHtml(html) {
  let fr = document.getElementById('printFrame'); if (fr) fr.remove();
  fr = document.createElement('iframe'); fr.id = 'printFrame'; fr.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(fr);
  fr.contentDocument.open(); fr.contentDocument.write(html); fr.contentDocument.close();
  setTimeout(() => { try { fr.contentWindow.focus(); fr.contentWindow.print(); } catch (err) { toast('인쇄 창을 열지 못했습니다'); } }, 300);
}
function statusPill(t) { return t < 0 ? '<span class="pill p-bad">🔺 마이너스</span>' : t === 0 ? '<span class="pill p-mute">품절</span>' : t <= 3 ? '<span class="pill p-warn">🔸 3개 이하</span>' : '<span class="pill p-ok">정상</span>'; }
function productDrawer(pid) {
  const p = S.P[pid]; if (!p) return '';
  const rows = STORES.filter(s => myStores().includes(s.id)).map(s => ({ s, q: stockOf(s.id, pid), has: (S.stock[s.id] || {})[pid] != null }));
  const mv = limited() ? [] : S.moves.filter(m => m.pid === pid && myStores().includes(m.store)).slice(-30).reverse();
  return `<div class="hd"><div><div class="muted" style="font-size:12px">${esc(p.ip)}${p.cat ? ' · ' + esc(p.cat) : ''}</div><h3>${esc(p.name)}</h3></div>${S.ui.prevDrawer ? '<button class="btn sm" data-hback="1">← 목록</button>' : ''}<button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card"><dl class="kv"><dt>바코드</dt><dd class="num" style="text-align:left">${esc(p.barcode || '-')}</dd><dt>품번</dt><dd>${esc(p.sku || '-')}</dd>${!limited() && p.price ? `<dt>판매가</dt><dd>${won(p.price)}</dd>` : ''}${S.warehouse[pid] ? `<dt>창고 보관</dt><dd>${fmt(S.warehouse[pid])}개</dd>` : ''}${allPlaces().filter(pl => (pl.q || {})[pid]).map(pl => `<dt>외부 · ${esc(pl.kind)}</dt><dd>${esc(placeLabel(pl))} — ${fmt(pl.q[pid])}개</dd>`).join('')}</dl></div>
  <div class="card"><h2>매장별 재고</h2><table><tbody>${rows.map(r => `<tr><td class="nowrap"><span class="dot" style="background:${storeColor(r.s.id)};display:inline-block;margin-right:6px"></span>${esc(r.s.name)}</td><td class="n big ${r.q < 0 ? 'qty-neg' : ''}" style="font-size:18px">${r.has ? fmt(r.q) : '-'}</td><td style="width:1%">${r.has ? statusPill(r.q) : '<span class="pill p-mute">미등록</span>'}</td></tr>`).join('')}</tbody></table></div>
  ${can('move') ? `<div class="row"><button class="btn pri" data-quick="입고" data-qp="${esc(pid)}">입고 등록</button><button class="btn" data-quick="매장 이동" data-qp="${esc(pid)}">매장 이동</button>${can('count') ? `<button class="btn" data-quick="count" data-qp="${esc(pid)}">실사 입력</button>` : ''}</div>` : ''}
  ${limited() ? '' : `<div class="card"><h2>입출고 기록 <span class="r">최근 30건</span></h2>${movesTable(mv, false, true)}</div>`}`;
}
function movesTable(list, withName = true, compact = false) {
  if (!list.length) return '<div class="empty">기록이 없습니다</div>';
  return `<div class="tw"><table><thead><tr><th>날짜</th>${S.stores.length > 1 || compact ? '<th>매장</th>' : ''}<th>구분</th>${withName ? '<th>상품명</th>' : ''}<th class="n">수량</th><th class="hide-s">메모</th></tr></thead><tbody>
  ${list.map(m => `<tr><td class="nowrap num" style="text-align:left">${md(m.date)}</td>${S.stores.length > 1 || compact ? `<td class="nowrap">${sdot(m.store)}${esc(shortName(m.store))}</td>` : ''}<td>${typePill(m.type)}</td>${withName ? `<td class="nm">${esc((S.P[m.pid] || {}).name || m.pid)}</td>` : ''}<td class="n ${m.qty < 0 ? 'qty-neg' : ''}" style="font-weight:600">${m.qty > 0 ? '+' : ''}${fmt(m.qty)}</td><td class="hide-s muted" style="font-size:12px">${esc(m.memo || '')}${m.by && !/claude/i.test(m.by) ? ` · ${esc(m.by === '자동(POS)' ? (m.upBy ? `POS 파일 · ${whoText(m.upBy, m.co)}` : '자동(POS)') : whoText(m.by, m.co))}` : ''}${m.file ? `<br><span style="font-size:11px">📎 ${esc(m.file)}</span>` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function typePill(t) { const pos = ['입고', '창고에서 가져옴', '매장 이동(받음)']; return `<span class="pill ${t === COUNT_TYPE ? 'p-info' : pos.includes(t) ? 'p-ok' : t === '판매' ? 'p-mute' : 'p-warn'}">${esc(t)}</span>`; }

/* ───────── 외부 장소 ───────── */
const placeById = id => allPlaces().find(p => p.id === id);
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
    <div class="formgrid"><div class="field"><label for="plStart">시작일</label>${dateSel('plStart', f.start)}</div><div class="field"><label for="plEnd">종료일</label>${dateSel('plEnd', f.end)}</div></div>
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
  const list = allPlaces().sort((a, b) => (b.fixed ? 1 : 0) - (a.fixed ? 1 : 0) || (b.start || '').localeCompare(a.start || ''));
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
    const num = v => { const t = String(v ?? '').replace(/[,원\s]/g, ''); if (t === '') return null; const n = Number(t); return isNaN(n) ? null : n; };
    let cand = bc ? findProduct(bc) : []; if (!cand.length && sku) cand = findProduct(sku); if (!cand.length && name) cand = S.byName[norm(name)] || [];
    out.push({ line: i + 1, name, bc, sku, qty: num(g('qty')), price: num(g('price')), ip: g('ip'), pid: cand.length === 1 ? cand[0].id : '', multi: cand.length > 1 });
  }
  return { rows: out, header: det.r + 1 };
}
async function fileRows(f) {
  if (/\.(pdf|png|jpe?g|heic|gif|webp)$/i.test(f.name)) throw new Error('PDF·사진은 입력할 수 없습니다. 엑셀이나 구글시트로 받아 주세요.');
  const wb = await readBook(f);
  const best = bestSheet(wb);
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
      <div class="field"><label for="ibDate">입고 예정일</label>${dateSel('ibDate', f.date)}</div>
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
  <div class="note" style="font-size:12.5px">📎 예정 리스트: ${esc(ib.src || ib.title)} · ${esc(whoText(ib.by, ib.co) || '-')} 올림${ib.at ? ' ' + kst(ib.at) : ''}${ib.actSrc ? `<br>📎 실제 입고: ${esc(ib.actSrc)} · ${esc(whoText(ib.actBy, ib.actCo))} 올림` : ''}</div>
  ${done ? `<div class="note">✔ ${esc(ib.receivedAt || '')} ${esc(whoText(ib.receivedBy || '', ib.receivedCo))} 입고 확정 — 실제 수량으로 재고에 더했습니다.</div>` : `<div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>실제 입고 수량 넣기</h2>
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
  ib.actSrc = src; ib.actBy = S.user ? S.user.name : ''; ib.actCo = userCo(S.user); ib.actAt = new Date().toISOString(); ib.actUid = S.user ? S.user.uid : '';
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
  const ib = { id: 'IB-' + f.date.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), store: f.store, date: f.date, title: f.title.trim() || f.src, ip: f.ip.trim(), from: f.from.trim(), status: 'planned', items: Object.values(items), extra: [], by: S.user.name, co: userCo(S.user), src: f.src, at: new Date().toISOString() };
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
  await DB.saveMoves(stampMoves(moves, ib.actSrc || ib.src || ib.title));
  for (const m of moves) { S.moves.push(m); (S.stock[m.store] ||= {})[m.pid] = stockOf(m.store, m.pid) + m.qty; }
  ib.items.forEach(x => { if (x.actual == null) x.actual = 0; if (!x.pid) { const l = lines.find(y => y.key === x.key); if (l) x.pid = l.pid; } });
  ib.status = 'received'; ib.receivedAt = today(); ib.receivedBy = S.user.name; ib.receivedCo = userCo(S.user);
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
      <div class="field"><label for="eDate">날짜</label>${dateSel('eDate', e.date)}</div>
      <div class="field"><label for="eStore">${T.to ? '보내는 매장' : '매장'}</label><select class="inp" id="eStore">${okStores.map(s => `<option value="${s}" ${e.store === s ? 'selected' : ''}>${esc(storeName(s))}</option>`).join('')}</select></div>
      ${T.to ? `<div class="field"><label for="eTo">받는 곳</label><select class="inp" id="eTo"><option value="">선택</option>${STORES.filter(s => s.id !== e.store).map(s => `<option value="${s.id}" ${e.to === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}${FIXED_PLACES.map(f => `<option value="__wh:${f.id}" ${e.to === '__custom' && e.place === f.id ? 'selected' : ''}>${esc(f.name)} (${esc(f.kind)})</option>`).join('')}<option value="__custom" ${e.to === '__custom' && !FIXED_PLACES.some(f => f.id === e.place) ? 'selected' : ''}>외부 장소 (행사장·팝업 등)</option></select></div>
      ${e.to === '__custom' && !FIXED_PLACES.some(f => f.id === e.place) ? placeSelect('ePlace', e.place, '외부 장소') : ''}` : ''}
      ${e.type === '입고' ? `<div class="field"><label for="eSrc">보낸 곳 (선택)</label><select class="inp" id="eSrc"><option value="">선택 안 함</option>${FIXED_PLACES.map(f => `<option value="${esc(f.name)}" ${e.src === f.name ? 'selected' : ''}>${esc(f.name)} (${esc(f.kind)})</option>`).join('')}<option value="SMG 홀딩스" ${e.src === 'SMG 홀딩스' ? 'selected' : ''}>SMG 홀딩스</option><option value="SMG 크리에이티브" ${e.src === 'SMG 크리에이티브' ? 'selected' : ''}>SMG 크리에이티브</option></select></div>` : ''}
      ${T.from ? placeSelect('eFrom', e.from, '돌아온 곳 (물류창고·외부 장소)') : ''}
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
    const m = { id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: e.date, store: e.store, type: e.type, pid: l.pid, qty: q, memo: [e.to ? `→ ${e.to === '__custom' ? placeLabel(placeById(e.place)) : storeName(e.to)}` : '', T.from ? `← ${placeLabel(placeById(e.from))}` : '', e.type === '입고' && e.src ? `← ${e.src}` : '', e.partner, e.memo].filter(Boolean).join(' · '), place: (e.to === '__custom' && e.place) || (T.from && e.from) || null, by, at };
    list.push(m);
  }
  await DB.saveMoves(stampMoves(list, e.file));
  for (const m of list) {
    S.moves.push(m); (S.stock[m.store] ||= {})[m.pid] = stockOf(m.store, m.pid) + m.qty;
    if (m.type === '창고 보관') S.warehouse[m.pid] = (S.warehouse[m.pid] || 0) - m.qty;
    if (m.type === '창고에서 가져옴') S.warehouse[m.pid] = (S.warehouse[m.pid] || 0) - m.qty;
    if (m.place) { let pl = (S.places ||= []).find(p => p.id === m.place); if (!pl && FIXED_PLACES.some(f => f.id === m.place)) { pl = { id: m.place, q: {} }; S.places.push(pl); } if (pl) { pl.q ||= {}; pl.q[m.pid] = (pl.q[m.pid] || 0) - m.qty; } }
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
function detectCols(rows, qtyPref) { return analyzeSheet(rows, qtyPref); }
function importRows(rows, src, over) {
  const det = analyzeSheet(rows, null, over) || { r: 0, a: 0, map: {}, H: (rows[0] || []).map(String), sig: '', how: 'manual' };
  const prevFile = S.moves.find(m => m.file && m.file === src);
  if (det.map.qty == null || (det.map.name == null && det.map.barcode == null && det.map.sku == null)) {
    S.ui.imp = { src, raw: rows, det, err: '처음 보는 양식입니다. 아래에서 상품명(또는 바코드·품번)과 수량 칸을 골라 주세요.' }; return;
  }
  const m = det.map; const out = []; const seen = {};
  for (let i = det.r + 1; i < rows.length; i++) {
    const r = rows[i]; const g = k => m[k] != null ? String(r[m[k]] ?? '').trim().replace(/^'/, '') : '';
    const qty = SM.numVal(g('qty'));
    const op = g('option'); const name = op && op !== '-' && !g('name').includes(op) ? `${g('name')} ${op}`.trim() : g('name'); const bc = g('barcode'), sku = g('sku');
    if (!name && !bc && !sku) continue;
    if (SM.TOTAL.test(SM.nz(sku)) || SM.TOTAL.test(SM.nz(bc)) || ((/합계|총계|소계/.test(name) || r.some(c => SM.TOTAL.test(SM.nz(c)))) && !bc && !sku)) continue;
    if (SM.SYN.qty.includes(SM.nz(g('qty')))) continue;   // 반복 머리글
    let cand = []; let how = '';
    if (bc) { cand = findProduct(bc); how = '바코드'; }
    if (!cand.length && sku) { cand = findProduct(sku); how = '품번'; }
    if (!cand.length && name) { cand = S.byName[norm(name)] || []; how = '상품명'; }
    if (!cand.length && name && norm(name).length >= 4) { const k = norm(name); cand = S.products.filter(p => { const q = norm(p.name); return q.length >= 4 && (q.endsWith(k) || k.endsWith(q)); }).slice(0, 6); how = '비슷한 이름'; }
    const row = { line: i + 1, name, bc, sku, qty, memo: g('memo'), how, cand: cand.map(p => p.id), pid: cand.length === 1 ? cand[0].id : '', st: '' };
    if (!(qty > 0)) row.st = 'qty';
    else if (!cand.length) row.st = 'new';
    else if (cand.length > 1) row.st = 'multi';
    const key = row.pid || norm(name) + bc;
    if (seen[key]) { row.dup = seen[key]; } else seen[key] = row.line;
    out.push(row);
  }
  S.ui.imp = { src, raw: rows, det, rows: out, header: det.r + 1, prevFile, dupMode: 'sum' };
}
function importPreview() {
  const im = S.ui.imp; if (!im) return '';
  if (im.err) return `<div class="note bad">🔺 ${esc(im.src)} — ${esc(im.err)}</div>${mapPanel(im)}`;
  const R = im.rows; const ok = R.filter(r => r.pid && r.qty > 0);
  const cnt = k => R.filter(r => r.st === k).length;
  const dup = R.filter(r => r.dup).length;
  return `${mapPanel(im)}<div class="card"><h2>미리보기 · ${esc(im.src)} <span class="r">${R.length}줄 (제목 ${im.header}번째 줄)</span></h2>
    <div class="alerts" style="margin-bottom:10px">
      <div class="al"><span class="ic">✔</span><span class="tx">상품을 찾은 줄 <b>${ok.length}</b>개 · ${fmt(ok.reduce((a, b) => a + b.qty, 0))}개</span></div>
      ${cnt('new') ? `<div class="al"><span class="ic">🔺</span><span class="tx">등록된 상품에 없는 줄 <b>${cnt('new')}</b>개 — 저장에서 빠집니다. 새 상품이면 관리 › 상품 목록에서 먼저 등록해 주세요.</span></div>` : ''}
      ${cnt('multi') ? `<div class="al"><span class="ic">🔸</span><span class="tx">같은 이름 상품이 여러 개인 줄 <b>${cnt('multi')}</b>개 — 줄마다 맞는 상품을 골라 주세요.</span></div>` : ''}
      ${cnt('qty') ? `<div class="al"><span class="ic">🔺</span><span class="tx">수량이 비었거나 0인 줄 <b>${cnt('qty')}</b>개 — 저장에서 빠집니다.</span></div>` : ''}
      ${dup ? `<div class="al"><span class="ic">🔸</span><span class="tx">파일 안에 같은 상품이 두 번 나온 줄 <b>${dup}</b>개 — <span class="fseg sm"><button class="${im.dupMode === 'sum' ? 'on' : ''}" data-dupm="sum">수량 합치기</button><button class="${im.dupMode === 'first' ? 'on' : ''}" data-dupm="first">처음 줄만</button></span></span></div>` : ''}
      ${im.prevFile ? `<div class="al"><span class="ic">🔺</span><span class="tx">같은 이름의 파일을 ${md(im.prevFile.date)}에 이미 올렸습니다 (${esc(whoText(im.prevFile.by, im.prevFile.co))}). 두 번 넣지 않도록 확인해 주세요.</span></div>` : ''}
    </div>
    <div class="tw"><table><thead><tr><th class="n">줄</th><th>파일 상품명</th><th class="hide-s">바코드·품번</th><th>찾은 상품</th><th class="n">수량</th><th>상태</th></tr></thead><tbody>
    ${R.map((r, i) => `<tr class="${r.st || r.dup ? 'flag' : ''}"><td class="n muted">${r.line}</td><td class="nm">${esc(r.name || '-')}</td><td class="code hide-s">${esc(r.bc || r.sku || '')}</td>
      <td class="nm">${r.st === 'multi' ? `<select class="inp" data-ip="${i}" style="min-width:180px"><option value="">고르기</option>${r.cand.map(c => `<option value="${esc(c)}" ${r.pid === c ? 'selected' : ''}>${esc(S.P[c].name)} · ${esc(S.P[c].barcode || S.P[c].sku)}</option>`).join('')}</select>` : r.pid ? `${esc(S.P[r.pid].name)}<div class="muted" style="font-size:12px">${esc(r.how)}로 찾음</div>` : '<span class="muted">없음</span>'}</td>
      <td class="n" style="font-weight:700">${fmt(r.qty)}</td><td>${r.st === 'new' ? '<span class="pill p-bad">🔺 미등록</span>' : r.st === 'qty' ? '<span class="pill p-bad">🔺 수량</span>' : r.st === 'multi' && !r.pid ? '<span class="pill p-warn">🔸 선택</span>' : r.dup ? `<span class="pill p-warn">🔸 ${r.dup}줄과 중복</span>` : '<span class="pill p-ok">✔</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <div class="row" style="margin-top:12px;justify-content:flex-end"><button class="btn" id="impCancel">취소</button><button class="btn pri" id="impUse">찾은 ${R.filter(r => r.pid && r.qty > 0 && !(r.dup && im.dupMode === 'first')).length}줄을 ${esc(S.ui.entry.type)} 목록에 담기</button></div></div>`;
}
async function readFile(f) {
  if (/\.(pdf|png|jpe?g|heic|gif|webp)$/i.test(f.name)) { S.ui.imp = { src: f.name, err: 'PDF·사진은 입력할 수 없습니다. 엑셀이나 구글시트로 받아 주세요.' }; render(); return; }
  const wb = await readBook(f);
  const best = bestSheet(wb);
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
const QTY_COUNT = ['실사수량', '실재고', '실수량', '실제수량', '센수량', '확인수량', '재고수량', '현재고', '수량', '재고', 'qty', '개수'];
function countApply(rows, src) {
  S.ui.cntSrc = src;
  const st = S.stores[0]; const c = S.ui.counts[st] ||= {};
  const t = readTable(rows, QTY_COUNT);
  if (t.err) { S.ui.cntMsg = { bad: true, html: '🔺 ' + esc(t.err) }; render(); return; }
  const add = {}, notFound = [], noQty = [], multi = [], notInStore = []; let used = 0;
  for (const r of t.rows) {
    if (r.qty == null) { noQty.push(r.name || r.bc || r.sku); continue; }
    if (r.multi) { multi.push(r.name); continue; }
    if (!r.pid) { notFound.push(r.name || r.bc || r.sku); continue; }
    if ((S.stock[st] || {})[r.pid] == null) notInStore.push(S.P[r.pid].name);
    add[r.pid] = (add[r.pid] || 0) + Math.max(0, r.qty); used++;
  }
  const dup = used - Object.keys(add).length;
  for (const [pid, q] of Object.entries(add)) c[pid] = q;
  const list = (a, n = 5) => esc(a.slice(0, n).join(', ')) + (a.length > n ? ` 외 ${a.length - n}개` : '');
  S.ui.cntMsg = { html: `✔ ${esc(src)}: <b>${Object.keys(add).length}종</b> 실사 수량을 넣었습니다. 아래 표에서 차이를 확인하고 [재고에 반영]을 눌러 주세요.`
    + (dup > 0 ? `<br>🔸 같은 상품이 여러 줄에 있어 수량을 합친 경우 ${dup}건` : '')
    + (notFound.length ? `<br>🔺 등록된 상품에 없는 줄 ${notFound.length}개: ${list(notFound)}` : '')
    + (multi.length ? `<br>🔸 같은 이름 상품이 여러 개라 건너뛴 줄 ${multi.length}개 (바코드를 적어 주세요): ${list(multi)}` : '')
    + (noQty.length ? `<br>🔸 수량이 비어 건너뛴 줄 ${noQty.length}개` : '')
    + (notInStore.length ? `<br>🔸 이 매장 재고에 없던 상품 ${notInStore.length}종 — 반영하면 새로 생깁니다: ${list(notInStore)}` : '') };
  render();
}
function countTemplate() {
  const st = S.stores[0];
  const ps = S.products.filter(p => (S.stock[st] || {})[p.id] != null).sort((a, b) => a.ip.localeCompare(b.ip, 'ko') || a.name.localeCompare(b.name, 'ko'));
  const aoa = [['IP', '바코드', '품번', '상품명', '실사 수량', '메모']].concat(ps.map(p => [p.ip, p.barcode, p.sku, p.name, '', '']));
  const ws = XLSX.utils.aoa_to_sheet(aoa); ws['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 14 }, { wch: 46 }, { wch: 10 }, { wch: 16 }];
  for (let i = 2; i <= aoa.length; i++) { const cell = ws['B' + i]; if (cell) { cell.t = 's'; } }
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, '실사');
  const name = `${storeName(st)}_실사양식_${today()}.xlsx`;
  if (S.mode === 'demo') { alertBox('미리보기 화면에서는 파일을 내려받을 수 없습니다. 실제 앱에서는 이 매장 상품 목록이 담긴 엑셀이 바로 받아집니다.'); return; }
  XLSX.writeFile(wb, name);
}
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
  <div class="card" style="display:flex;flex-direction:column;gap:10px"><h2>엑셀로 실사 수량 올리기</h2>
    <span class="muted" style="font-size:12.5px">매장에서 엑셀에 적어 둔 실사 수량을 올리면 아래 표에 한꺼번에 들어갑니다. "실사 수량" 칸을 먼저 찾고, 없으면 "수량"·"재고" 칸을 씁니다. 바코드·품번·상품명 중 하나로 상품을 찾습니다.</span>
    <div class="row"><button class="btn" id="cntTpl">실사 양식 받기 (이 매장 상품 목록)</button><button class="btn pri" id="cntFile">실사 엑셀 올리기</button><input class="inp" id="cntLink" placeholder="또는 구글시트 링크" style="flex:1;min-width:200px"><button class="btn" id="cntLinkGo">링크 열기</button></div>
    ${S.ui.cntMsg ? `<div class="note ${S.ui.cntMsg.bad ? 'bad' : ''}">${S.ui.cntMsg.html}</div>` : ''}
  </div>
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
  await DB.saveMoves(stampMoves(list, S.ui.cntSrc));
  for (const m of list) { S.moves.push(m); S.stock[st][m.pid] = stockOf(st, m.pid) + m.qty; }
  S.ui.counts[st] = {}; S.ui.cntSrc = null; toast(`실사 차이 ${list.length}종을 반영했습니다`);
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
  await DB.saveMoves(stampMoves([m])); S.moves.push(m); (S.stock[t.to] ||= {})[t.pid] = stockOf(t.to, t.pid) + t.qty;
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
function dayRec(st, d) { const m = (S.sales[st] || {})[d.slice(0, 7)]; return m && m.days && m.days[d.slice(8)] || null; }
function latestSalesDate(stores) {
  let best = '';
  for (const st of stores) for (const [ym, m] of Object.entries(S.sales[st] || {})) for (const dd of Object.keys(m.days || {})) { const d = ym + '-' + dd; if (d > best) best = d; }
  return best;
}
function firstSalesDate(stores) {
  let best = '9999';
  for (const st of stores) for (const [ym, m] of Object.entries(S.sales[st] || {})) for (const dd of Object.keys(m.days || {})) { const d = ym + '-' + dd; if (d < best) best = d; }
  return best === '9999' ? '' : best;
}
function defaultRange(unit, last) {
  if (!last) last = today();
  if (unit === 'day') return [last, last];   // 기본: 마지막으로 올린 날 하루
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
// 증감 표시: 늘면 빨간 ▲, 줄면 파란 ▼ (한국 증권·매출 표기 관례)
function chg(ch, digits = 1) {
  if (ch == null || !isFinite(ch)) return '<span class="muted">비교 자료 없음</span>';
  if (Math.abs(ch) < 0.05) return '<span class="chg flat">– 0.0%</span>';
  return `<span class="chg ${ch > 0 ? 'up' : 'dn'}">${ch > 0 ? '▲' : '▼'} ${Math.abs(ch).toFixed(digits)}%</span>`;
}
const addMonths = (d, n) => { const [y, m, dd] = d.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); const last = new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + 1, 0)).getUTCDate(); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(dd, last)).padStart(2, '0')}`; };
// 비교 기간: auto = 하루면 지난주 같은 요일, 1일부터면 지난달 같은 날짜, 그 밖엔 바로 앞 같은 일수 / month = 지난달 같은 날짜 / year = 작년 같은 날짜 / prev = 바로 앞 같은 일수
function cmpRange(a, b, mode = 'auto') {
  const len = daysBetween(a, b) + 1;
  if (mode === 'auto') mode = len === 1 ? 'week' : a.slice(8) === '01' ? 'month' : 'prev';
  if (mode === 'week') return { pa: addDays(a, -7), pb: addDays(b, -7), mode, label: len === 1 ? `지난주 ${wd(a)}요일(${md(addDays(a, -7))})` : `1주 전 (${md(addDays(a, -7))}~${md(addDays(b, -7))})` };
  if (mode === 'month') { const pa = addMonths(a, -1); let pb = addMonths(b, -1); if (b.slice(8) >= '28' && b === addDays(addMonths(b.slice(0, 8) + '01', 1), -1)) pb = addDays(a.slice(0, 8) + '01', -1); return { pa, pb, mode, label: `지난달 같은 날짜 (${md(pa)}~${md(pb)})` }; }
  if (mode === 'year') { const pa = addMonths(a, -12), pb = addMonths(b, -12); return { pa, pb, mode, label: `작년 같은 날짜 (${pa.slice(2, 4)}.${md(pa)}~${md(pb)})` }; }
  return { pa: addDays(a, -len), pb: addDays(a, -1), mode: 'prev', label: `바로 앞 ${len}일 (${md(addDays(a, -len))}~${md(addDays(a, -1))})` };
}
const CMP_M = { s: ['매출', '원'], p: ['결제건수', '건'], t: ['객단가', '원'], q: ['판매수량', '개'] };
function cmpDrawer() {
  const c = S.ui.cmp; const { a, b, stores } = c; const r = cmpRange(a, b, c.mode);
  const days = (x, y) => { const L = []; for (let d = x; d <= y; d = addDays(d, 1)) { const o = { d, s: 0, p: 0, q: 0, has: false }; for (const st of stores) { const v = dayRec(st, d); if (v) { o.s += v.s; o.p += v.p; o.q += v.q; o.has = true; } } o.t = o.p ? o.s / o.p : 0; L.push(o); } return L; };
  const C = days(a, b), P = days(r.pa, r.pb);
  const sumOf = L => { const o = L.reduce((x, v) => ({ s: x.s + v.s, p: x.p + v.p, q: x.q + v.q }), { s: 0, p: 0, q: 0 }); o.t = o.p ? o.s / o.p : 0; o.n = L.filter(v => v.has).length; return o; };
  const cs = sumOf(C), ps = sumOf(P), m = c.metric, [mt, mu] = CMP_M[m];
  const modes = [['auto', '추천'], ['prev', '바로 앞 기간'], ['month', '지난달 같은 날짜'], ['year', '작년 같은 날짜']];
  // 두 기간을 겹쳐 그리는 그래프 (이번 = 빨강, 비교 = 회색)
  const n = Math.max(C.length, P.length), W = 640, H = 170, L = 8, R = 8, T = 24, B = 24;
  const mx = Math.max(1, ...C.map(v => v[m]), ...P.map(v => v[m]));
  const X = i => L + (n > 1 ? i * (W - L - R) / (n - 1) : (W - L - R) / 2), Y = v => T + (1 - v / mx) * (H - T - B);
  const line = (A, col, w, dash) => A.length > 1 ? `<polyline points="${A.map((v, i) => `${X(i).toFixed(1)},${Y(v[m]).toFixed(1)}`).join(' ')}" fill="none" stroke="${col}" stroke-width="${w}"${dash ? ' stroke-dasharray="5 4"' : ''}/>` : A.map((v, i) => `<circle cx="${X(i)}" cy="${Y(v[m])}" r="5" fill="${col}"/>`).join('');
  const iC = C.reduce((k, v, i) => (v[m] > C[k][m] ? i : k), 0), iP = P.reduce((k, v, i) => (v[m] > P[k][m] ? i : k), 0);
  const svg = `<svg class="trend" viewBox="0 0 ${W} ${H}" role="img" aria-label="${mt} 기간 비교"><line x1="${L}" x2="${W - R}" y1="${H - B}" y2="${H - B}" stroke="var(--line)"/>
    ${line(P, 'var(--muted)', 1.6, true)}${line(C, 'var(--red)', 2.4)}
    <text class="vl" x="${X(iC)}" y="${Y(C[iC][m]) - 8}" text-anchor="${iC < n * .15 ? 'start' : iC > n * .85 ? 'end' : 'middle'}" fill="var(--red)">${m === 's' || m === 't' ? man(C[iC][m]) : fmt(C[iC][m])}</text>
    <text x="${L}" y="${H - 7}">${n > 1 ? '1일째' : ''}</text><text x="${W - R}" y="${H - 7}" text-anchor="end">${n > 1 ? n + '일째' : ''}</text></svg>`;
  const val = (v, k) => k === 's' || k === 't' ? fmt(v) : fmt(v);
  return `<div class="hd"><h3>${mt} 비교</h3><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card" style="display:flex;flex-direction:column;gap:10px">
    <div class="cmp-p"><span class="pl cur">이번</span><b>${md(a)}(${wd(a)}) ~ ${md(b)}(${wd(b)})</b> <span class="muted">${C.length}일</span></div>
    <div class="cmp-p"><span class="pl pre">비교</span><b>${md(r.pa)}(${wd(r.pa)}) ~ ${md(r.pb)}(${wd(r.pb)})</b> <span class="muted">${r.label.split(' (')[0]} · ${P.length}일</span></div>
    <div class="chips">${modes.map(([k, t]) => `<button class="chip ${(c.mode || 'auto') === k ? 'on' : ''}" data-cmpm="${k}">${t}</button>`).join('')}</div>
    ${ps.n === 0 ? '<div class="note">🔸 비교 기간에 매출 자료가 없습니다. 다른 비교 기간을 골라 보세요.</div>' : ''}
  </div>
  <div class="card"><div class="tw"><table class="tb cmp-t"><thead><tr><th></th><th class="n">이번</th><th class="n">비교</th><th class="n">차이</th><th class="n">증감</th></tr></thead><tbody>
    ${Object.entries(CMP_M).map(([k, [t, u]]) => `<tr class="${k === m ? 'sel' : ''}" data-cmpk="${k}"><td><b>${t}</b></td><td class="n"><b>${fmt(cs[k])}</b>${u}</td><td class="n">${fmt(ps[k])}${u}</td><td class="n">${cs[k] - ps[k] >= 0 ? '+' : ''}${fmt(cs[k] - ps[k])}</td><td class="n">${chg(pct(cs[k], ps[k]))}</td></tr>`).join('')}
  </tbody></table></div></div>
  ${n > 1 ? `<div class="card"><h2>${mt} 흐름 <span class="r"><span class="lg cur"></span>이번 <span class="lg pre"></span>비교</span></h2>${lineChart(C.map(v => ({ lab: md(v.d), sub: `(${wd(v.d)})`, d: v.d, v: v[m], tip: `${md(v.d)}(${wd(v.d)}) · ${fmt(v[m])}${mu} · ${fmt(v.p)}건` })), { cmp: P.map(v => v[m]), cmpTip: P.map(v => `비교 ${md(v.d)}(${wd(v.d)}) ${fmt(v[m])}${mu}`), unitFmt: m === 's' || m === 't' ? man : fmt, aria: mt + ' 기간 비교' })}</div>` : ''}
  <div class="card"><h2>날짜별 ${mt}</h2><div class="tw"><table class="tb cmp-t"><thead><tr><th>이번</th><th class="n">${mt}</th><th>비교</th><th class="n">${mt}</th><th class="n">증감</th></tr></thead><tbody>
    ${Array.from({ length: n }, (_, i) => { const x = C[i], y = P[i]; return `<tr><td class="nowrap">${x ? `${md(x.d)}(${wd(x.d)})` : ''}</td><td class="n">${x ? (x.has ? `<b>${fmt(x[m])}</b>` : '<span class="muted">-</span>') : ''}</td><td class="nowrap muted">${y ? `${md(y.d)}(${wd(y.d)})` : ''}</td><td class="n">${y ? (y.has ? fmt(y[m]) : '<span class="muted">-</span>') : ''}</td><td class="n">${x && y && x.has && y.has ? chg(pct(x[m], y[m]), 0) : ''}</td></tr>`; }).join('')}
  </tbody></table></div></div>
  ${topSold(stores, a, b, r.pa, r.pb)}`;
}
/* ───────── 자판기·기계 매출 (POS 밖 매출: 카드 단말기 PDF·엑셀) ───────── */
// 단말기 번호 → 이름. 처음 보는 단말기는 '기계 번호'로 넣고, 올릴 때 이름을 바꿀 수 있음
const MACHINES = { '8353980': '자판기 8353980', '8354753': '자판기 8354753', '2000119281': '하이큐 증명사진·학생수첩' };
const MACH_RATE_DEFAULT = 0.2;   // 대표 확인 2026-11-01: 자판기 2대·하이큐 증명사진 모두 카드 순매출의 20% (부가세 포함)
const machName = no => (S.machNames && S.machNames[no]) || MACHINES[no] || `기계 ${no}`;
const normDate = v => {
  if (v instanceof Date && !isNaN(v)) return new Date(v.getTime() + 9 * 3600e3).toISOString().slice(0, 10);
  const t = String(v ?? '').trim(); let m = t.match(/(20\d\d)[-./년\s]*(\d{1,2})[-./월\s]*(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(20\d\d)(\d\d)(\d\d)/); return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
};
const numOf = v => { const t = String(v ?? '').replace(/[,원\s]/g, '').match(/^-?\d+(\.\d+)?/); return t ? Number(t[0]) : null; };
// 결과: [{no, date, s, n}] (s = 순매출, n = 순건수: 승인 +1, 취소 −1)
function machFromTokens(tokens, fileName) {
  // PDF 신용거래내역조회: 한 거래가 [거래일시 … 카드번호 … 금액] 다음 [승인|취소 … 단말기번호] 순서로 나옴
  const all = tokens.join(' ');
  const head = all.match(/단말기명\s*:\s*(\d{5,})/) || String(fileName || '').match(/(\d{7,})/);
  const out = []; let cur = null;
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    const dm = t.match(/^(20\d\d-\d\d-\d\d)(?:\s+\d\d:\d\d:\d\d)?$/);
    if (dm) { if (/^\d\d:\d\d:\d\d$/.test(tokens[i + 1] || '') || t.length > 10) { cur = { date: dm[1], s: null, st: null, no: head ? head[1] : '' }; continue; } }
    if (!cur) continue;
    if (cur.s == null && /^\d{1,3}(,\d{3})+$|^\d{3,}$/.test(t) && !/^\d{7,}$/.test(t)) { cur.s = Number(t.replace(/,/g, '')); continue; }
    if (cur.s != null && (t === '승인' || t === '취소')) { cur.st = t; }
    if (cur.st && /^\d{6,}$/.test(t) && head && t === head[1]) cur.no = t;
    if (cur.st && cur.s != null) { out.push({ no: cur.no || (head ? head[1] : ''), date: cur.date, s: cur.st === '취소' ? -cur.s : cur.s, n: cur.st === '취소' ? -1 : 1 }); cur = null; }
  }
  return out;
}
function machFromRows(rows, fileName) {
  // 엑셀: ① 거래 한 줄씩 (승인구분·거래일시·단말기번호·금액) ② 단말기 일별 집계 (거래일·단말기번호·결제액-취소액·결제건+취소건)
  const txt = rows.flat().map(v => String(v ?? '')).join(' ');
  const head = txt.match(/단말기명\s*:\s*(\d{5,})/) || String(fileName || '').match(/(\d{7,})/);
  let hr = rows.findIndex(r => r.some(v => /^(거래일|거래일자|거래일시|결제일|결제일자|승인일|승인일자|승인일시|날짜)$/.test(String(v ?? '').replace(/\s/g, ''))));
  if (hr < 0) return [];
  const H = rows[hr].map((v, i) => `${String(v ?? '')} ${String((rows[hr + 1] || [])[i] ?? '')}`.replace(/\s+/g, ' ').trim());
  const col = (re, not) => H.findIndex(h => re.test(h) && !(not && not.test(h)));
  const cD = col(/거래일|결제일|승인일/), cT = col(/단말기번호|단말기\s*ID|TID|단말기명/), cSt = col(/승인구분|거래구분|^구분/);
  let cA = col(/결제액\s*-\s*취소액|순매출|순금액/); if (cA < 0) cA = H.findLastIndex ? H.findLastIndex(h => /금액|매출액/.test(h) && !/공급|부가|봉사|수수료/.test(h)) : col(/금액/);
  let cN = col(/결제건\s*\+\s*취소건/); if (cN < 0) cN = H.findLastIndex ? H.findLastIndex(h => /건수/.test(h)) : -1;
  const out = [];
  for (const r of rows.slice(hr + 1)) {
    if (r.some(v => /소계|합계|총계/.test(String(v ?? '')))) continue;   // 소계·합계 줄은 건너뜀
    const raw = r[cD]; const date = raw instanceof Date || typeof raw === 'number' || /^\s*20\d\d/.test(String(raw ?? '')) ? normDate(typeof raw === 'number' ? new Date(Math.round((raw - 25569) * 864e5) - 9 * 3600e3) : raw) : ''; if (!date) continue;
    let s = numOf(r[cA]); if (s == null) continue;
    const st = cSt >= 0 ? String(r[cSt] ?? '') : '';
    let n = cN >= 0 ? numOf(r[cN]) : null; if (n == null) n = 1;
    if (/취소/.test(st)) { s = -Math.abs(s); n = -Math.abs(n); }
    const no = (cT >= 0 && String(r[cT] ?? '').replace(/\D/g, '')) || (head ? head[1] : '');
    out.push({ no, date, s, n });
  }
  return out;
}
async function pdfTokens(f) {
  if (!window.pdfjsLib) await new Promise((ok, bad) => { const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; s.onload = ok; s.onerror = () => bad(new Error('PDF 읽기 도구를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.')); document.head.appendChild(s); });
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
  const tokens = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const c = await (await doc.getPage(p)).getTextContent();
    // 글자가 한 자씩 나오는 PDF도 있어서, 같은 줄에서 가까운 글자끼리 붙이고 칸 사이가 넓으면 나눔
    const it = c.items.filter(x => String(x.str).trim()).map(x => ({ s: String(x.str), x: x.transform[4], w: x.width || 0, y: x.transform[5], h: Math.abs(x.transform[3]) || 8 }));
    it.sort((a, b) => b.y - a.y || a.x - b.x);
    const lines = []; for (const x of it) { const L = lines[lines.length - 1]; if (L && Math.abs(L.y - x.y) <= 2) L.it.push(x); else lines.push({ y: x.y, it: [x] }); }
    for (const L of lines) {
      L.it.sort((a, b) => a.x - b.x); let cur = '', end = null;
      for (const x of L.it) {
        const gap = end == null ? 0 : x.x - end;
        if (end != null && gap > x.h * 1.2) { if (cur.trim()) tokens.push(cur.trim()); cur = ''; }
        else if (end != null && gap > x.h * 0.25) cur += ' ';
        cur += x.s; end = x.x + x.w;
      }
      if (cur.trim()) tokens.push(cur.trim());
    }
  }
  if (!tokens.length) throw new Error('이 PDF에서 글자를 찾지 못했습니다. 스캔한 사진 PDF는 읽을 수 없으니, 카드사·VAN 사이트에서 받은 원본 PDF나 엑셀을 올려 주세요.');
  return tokens;
}

// 기계 매출 읽기: PDF(글자 있는 원본) 또는 엑셀·CSV 여러 개를 한 번에
async function readMachFiles(files, store) {
  const all = [], errs = [], names = [];
  for (const f of files) {
    try {
      let r;
      if (/\.pdf$/i.test(f.name)) r = machFromTokens(await pdfTokens(f), f.name);
      else if (/\.(xlsx|xls|csv)$/i.test(f.name)) { const wb = await readBook(f); r = []; for (const n of wb.SheetNames) { const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, defval: '', raw: true }); r.push(...machFromRows(rows, f.name)); } }
      else throw new Error('PDF나 엑셀(xlsx·xls·csv)만 올릴 수 있습니다');
      if (!r.length) throw new Error('매출 줄을 찾지 못했습니다 (거래일·금액 칸이 있는 단말기 매출 자료인지 확인해 주세요)');
      r.forEach(x => { x.file = f.name; if (!x.no) x.no = '미확인'; }); all.push(...r); names.push(f.name);
    } catch (e) { errs.push(`${f.name}: ${e.message || e}`); }
  }
  const by = {};
  for (const x of all) {
    const o = by[x.no] ||= { no: x.no, name: machName(x.no), days: {}, files: new Set() };
    const d = o.days[x.date] ||= [0, 0]; d[0] += x.s; d[1] += x.n; o.files.add(x.file);
  }
  const mach = Object.values(by).map(o => {
    const ds = Object.keys(o.days).sort(); const ex = ds.filter(d => { const m = (S.sales[store] || {})[d.slice(0, 7)]; return m && m.mach && m.mach['m' + o.no] && m.mach['m' + o.no].days && m.mach['m' + o.no].days[d.slice(8)]; });
    return { ...o, files: [...o.files], from: ds[0], to: ds[ds.length - 1], s: ds.reduce((a, d) => a + o.days[d][0], 0), n: ds.reduce((a, d) => a + o.days[d][1], 0), exists: ex.length };
  });
  S.ui.machPv = { store, mach, errs, files: names };
  render();
}
function machDrawer() {
  const pv = S.ui.machPv; const st = (pv && pv.store) || S.ui.machStore || S.stores[0];
  return `<div class="hd"><h3>자판기·기계 매출 올리기</h3><button class="x" data-close aria-label="닫기">×</button></div>
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label for="machStore">매장</label><select class="inp" id="machStore">${myStores().map(s => `<option value="${s}" ${st === s ? 'selected' : ''}>${esc(storeName(s))}</option>`).join('')}</select></div>
    <div class="drop"><div style="font-weight:700">카드 단말기 매출 PDF 또는 엑셀 (여러 개 한 번에 가능)</div><div class="muted" style="font-size:13px;margin:4px 0 10px">카드사·VAN 사이트에서 받은 <b>신용거래내역조회 PDF</b>, <b>단말기 일별 매출 엑셀</b> 등 · 승인은 더하고 취소는 뺍니다</div><button class="btn" id="machFileBtn">파일 고르기</button></div>
  </div>
  ${pv ? `${pv.errs.length ? `<div class="note bad">🔺 ${pv.errs.map(esc).join('<br>🔺 ')}</div>` : ''}
  ${pv.mach.length ? `<div class="card"><h2>확인 · ${esc(storeName(pv.store))}</h2>
    <div class="tw"><table><thead><tr><th>기계 (단말기)</th><th>기간</th><th class="n">매출</th><th class="n">건수</th></tr></thead><tbody>
    ${pv.mach.map((m, i) => `<tr><td><input class="inp" data-mname="${i}" value="${esc(m.name)}" style="min-width:150px"><div class="muted" style="font-size:11.5px">단말기 ${esc(m.no)} · ${esc(m.files.join(', '))}</div></td><td class="nowrap">${md(m.from)}~${md(m.to)} <span class="muted">${Object.keys(m.days).length}일</span>${m.exists ? `<div style="font-size:11.5px;color:var(--warn)">🔸 이미 올린 ${m.exists}일은 새 값으로 바뀝니다</div>` : ''}</td><td class="n" style="font-weight:700">${fmt(m.s)}</td><td class="n">${fmt(m.n)}</td></tr>`).join('')}
    <tr class="tot"><td>합계</td><td></td><td class="n">${fmt(pv.mach.reduce((a, m) => a + m.s, 0))}</td><td class="n">${fmt(pv.mach.reduce((a, m) => a + m.n, 0))}</td></tr></tbody></table></div>
    <div class="muted" style="font-size:12px;margin-top:6px">올린 사람으로 <b>${esc(whoText(S.user.name, userCo(S.user)))}</b>이 함께 저장됩니다. 기계 이름은 위 칸에서 바꿀 수 있습니다.</div>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" id="machSave">기계 매출 저장</button></div></div>` : ''}` : ''}`;
}
async function saveMach() {
  const pv = S.ui.machPv; const st = pv.store; const up = { at: new Date().toISOString(), by: S.user.name, co: userCo(S.user), uid: S.user.uid, file: pv.files.join(', ') };
  for (const m of pv.mach) {
    const id = 'm' + m.no.replace(/\W/g, ''); const byM = {};
    for (const [d, v] of Object.entries(m.days)) (byM[d.slice(0, 7)] ||= {})[d.slice(8)] = v;
    for (const [ym, days] of Object.entries(byM)) {
      const rec = { name: m.name.trim() || machName(m.no), no: m.no, days, up: { ...up, file: m.files.join(', ') } };
      await DB.saveMachMonth(st, ym, id, rec);
      const mon = ((S.sales[st] ||= {})[ym] ||= { days: {} }); const cur = (mon.mach ||= {})[id] ||= { days: {} };
      Object.assign(cur.days, days); cur.name = rec.name; cur.no = m.no; cur.up = rec.up;
    }
  }
  S.ui.machPv = null; S.ui.drawer = null; toast(`기계 매출 ${pv.mach.length}대를 저장했습니다`);
}
// 기간 안의 기계 매출: [{id, name, no, s, n, days, up}]
function machAgg(stores, a, b) {
  const per = {};
  for (const st of stores) for (const [ym, mon] of Object.entries(S.sales[st] || {})) {
    if (!mon.mach) continue;
    for (const [id, m] of Object.entries(mon.mach)) for (const [dd, v] of Object.entries(m.days || {})) {
      const d = ym + '-' + dd; if (d < a || d > b) continue;
      const k = st + '|' + id; const o = per[k] ||= { st, id, name: m.name, no: m.no, s: 0, n: 0, days: 0, last: '', up: null };
      o.s += v[0]; o.n += v[1]; o.days++; if (d > o.last) o.last = d; if (m.up && (!o.up || m.up.at > o.up.at)) o.up = m.up;
    }
  }
  return Object.values(per).sort((x, y) => y.s - x.s);
}
function machBlock(stores, a, b, posTotal) {
  const L = machAgg(stores, a, b);
  const tot = L.reduce((x, m) => x + m.s, 0);
  return `<div class="card"><h2>자판기·기계 매출 <span class="r">POS 밖 카드 단말기 · ${md(a)}~${md(b)}</span></h2>
  ${L.length ? `<div class="tw"><table><thead><tr><th>기계</th>${stores.length > 1 ? '<th>매장</th>' : ''}<th class="n">매출</th><th class="n hide-s">건수</th><th class="hide-s">마지막 거래</th><th class="hide-s">올린 사람</th></tr></thead><tbody>
  ${L.map(m => `<tr><td class="nm">${esc(m.name)}<div class="muted" style="font-size:11px">단말기 ${esc(m.no || '')}</div></td>${stores.length > 1 ? `<td class="nowrap">${sdot(m.st)}${esc(shortName(m.st))}</td>` : ''}<td class="n" style="font-weight:700">${fmt(m.s)}</td><td class="n hide-s">${fmt(m.n)}</td><td class="hide-s nowrap">${md(m.last)}</td><td class="hide-s" style="font-size:12px">${m.up ? `${esc(whoText(m.up.by, m.up.co))}<div class="muted">${kst(m.up.at)}${m.up.file ? ' · 📎 ' + esc(m.up.file) : ''}</div>` : '-'}</td></tr>`).join('')}
  <tr class="tot"><td>기계 합계</td>${stores.length > 1 ? '<td></td>' : ''}<td class="n">${fmt(tot)}</td><td class="n hide-s">${fmt(L.reduce((x, m) => x + m.n, 0))}</td><td class="hide-s"></td><td class="hide-s"></td></tr>
  <tr><td><b>POS + 기계</b></td>${stores.length > 1 ? '<td></td>' : ''}<td class="n" style="font-weight:800">${fmt(posTotal + tot)}</td><td class="hide-s" colspan="3"><span class="muted">POS ${fmt(posTotal)} + 기계 ${fmt(tot)}</span></td></tr></tbody></table></div>`
  : `<div class="empty">이 기간 기계 매출 자료가 없습니다. [자판기·기계 매출 올리기]로 PDF나 엑셀을 넣어 주세요.</div>`}</div>`;
}

// 총매출 = 토스포스(POS) + 자판기·기계. 매장 전체 매출로 가장 의미 있는 숫자라 매출 화면 맨 위에 크게
function grandTotal(stores, a, b, pa, pb, pos, posPrev, cmpLabel) {
  const mc = machAgg(stores, a, b).reduce((x, m) => x + m.s, 0), mp = machAgg(stores, pa, pb).reduce((x, m) => x + m.s, 0);
  const tot = pos + mc, prev = posPrev + mp, w = tot ? pos / tot * 100 : 100;
  return `<div class="card grand"><div class="g-top"><div><div class="g-lb">총매출 <span>토스포스 + 자판기·기계 · ${md(a)}${a !== b ? '~' + md(b) : ''}</span></div>
    <div class="g-v">${fmt(tot)}<small>원</small></div></div>
    <div class="g-cmp">${chg(pct(tot, prev))}<div class="muted">${esc(cmpLabel.split(' (')[0])} ${fmt(prev)}원${mc && !mp ? '<br>비교 기간은 기계 자료가 없어 토스포스만' : ''}</div></div></div>
    <div class="g-bar" role="img" aria-label="토스포스 ${Math.round(w)}%, 기계 ${100 - Math.round(w)}%"><i class="pos" style="width:${w}%"></i><i class="mac" style="width:${100 - w}%"></i></div>
    <div class="g-parts"><span><i class="dotc pos"></i>토스포스 <b>${fmt(pos)}</b>원 <span class="muted">${tot ? Math.round(w * 10) / 10 : 0}%</span></span><span><i class="dotc mac"></i>자판기·기계 <b>${fmt(mc)}</b>원 <span class="muted">${tot ? Math.round((100 - w) * 10) / 10 : 0}%</span>${mc ? '' : ' <span class="muted">· 자료 없음</span>'}</span></div></div>`;
}
function salesView() {
  const stores = S.stores; const last = latestSalesDate(stores);
  const unit = S.ui.salesUnit;
  if (!S.ui.range || S.ui.range.unit !== unit) S.ui.range = { unit, ab: defaultRange(unit, last) };
  const [a, b] = S.ui.range.ab;
  const sum = (S.sumStores || stores).filter(s => stores.includes(s));
  const per = aggregate(stores, a, b);
  const len = daysBetween(a, b) + 1; const cr = cmpRange(a, b, S.ui.cmpMode || 'auto'); const pa = cr.pa, pb = cr.pb;
  const cmpLabel = cr.label.split(' (')[0] + ' 대비';
  S.ui.cmpCtx = { a, b, stores: sum };
  const prev = aggregate(stores, pa, pb);
  const T = (o, ks) => ks.reduce((x, k) => ({ s: x.s + o[k].s, p: x.p + o[k].p, q: x.q + o[k].q }), { s: 0, p: 0, q: 0 });
  const cur = T(per, sum), pre = T(prev, sum);
  const multi = stores.length > 1;
  const ch = pct(cur.s, pre.s);
  const units = [['day', '일별'], ['week', '주별'], ['month', '월별'], ['year', '연도별'], ['ip', 'IP별']];
  const quick = [['오늘', () => [today(), today()]], ['최근 올린 날', () => [last, last]], ['최근 14일', () => [addDays(last, -13), last]], ['이번주', () => { const k = periodKey(last, 'week'); return [k, last]; }], ['지난주', () => { const k = addDays(periodKey(last, 'week'), -7); return [k, addDays(k, 6)]; }], ['이번달', () => [last.slice(0, 7) + '-01', last]], ['지난달', () => { const f = addDays(last.slice(0, 7) + '-01', -1); return [f.slice(0, 7) + '-01', f]; }], ['올해', () => [last.slice(0, 4) + '-01-01', last]], ['전체', () => [firstSalesDate(stores), last]]];
  S._quick = quick;
  const noData = stores.filter(s => !per[s].days);
  const su = salesUpdated(stores);
  return `${head('매출', `토스포스 매출리포트 기준 · ${S.stores.length > 1 ? '매장마다 마감일이 다릅니다 (아래 표)' : `${last ? `<b>${last} 마감</b>까지` : '아직 자료 없음'}${su.up ? ` · 마지막 올림 ${kst(su.up.at)} ${esc(whoText(su.up.by, su.up.co))}` : ''}`}`, `<button class="btn" id="posBtn">토스포스 파일 올리기</button><button class="btn" id="machBtn">자판기·기계 매출 올리기</button>`)}${freshTable(S.stores)}
  ${grandTotal(sum, a, b, pa, pb, cur.s, pre.s, cr.label)}
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="flt">
      <div class="fg"><div class="fl">보기 단위</div><div class="fseg">${units.map(([k, t]) => `<button class="${unit === k ? 'on' : ''}" data-su="${k}">${t}</button>`).join('')}</div></div>
      <div class="fg"><div class="fl">기간</div><div class="frange"><div class="fd"><span>시작</span>${dateSel('ra', a)}</div><span class="fsep">~</span><div class="fd"><span>종료</span>${dateSel('rb', b)}</div></div></div>
      <div class="fg"><div class="fl">빠른 선택</div><div class="fquick">${quick.map(([t, fn], i) => { let on = false; try { const [x, y] = fn(); on = x === a && y === b; } catch (e) { } return `<button class="${on ? 'on' : ''}" data-qr="${i}">${t}</button>`; }).join('')}</div></div>
    </div>
    ${multi ? `<div class="field"><label>합산에 넣을 매장</label><div class="chips">${stores.map(s => `<label class="chip ${sum.includes(s) ? 'on' : ''}" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-sum="${s}" ${sum.includes(s) ? 'checked' : ''} style="accent-color:var(--red)"><span class="dot" style="background:${storeColor(s)}"></span>${esc(storeName(s))}</label>`).join('')}</div></div>` : ''}
  </div>
  ${noData.length ? `<div class="note">${noData.map(s => esc(storeName(s))).join(', ')} — 이 기간 매출 자료가 없습니다. [토스포스 파일 올리기]로 넣어 주세요.</div>` : ''}
  <div class="tiles">
    <button class="tile tbtn" data-cmp="s"><span class="lb">토스포스 매출${multi ? ` · 합산 ${sum.length}곳` : ''}<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.s)).length>9?' long':''}">${fmt(cur.s)}<small>원</small></span><span class="d">${ch == null ? '<span class="muted">이전 기간 자료 없음</span>' : `${chg(ch)} <span class="muted">${cmpLabel}</span>`}</span></button>
    <button class="tile tbtn" data-cmp="p"><span class="lb">결제건수<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.p)).length>9?' long':''}">${fmt(cur.p)}<small>건</small></span><span class="d">${chg(pct(cur.p, pre.p))} <span class="muted">이전 ${fmt(pre.p)}건</span></span></button>
    <button class="tile tbtn" data-cmp="t"><span class="lb">객단가<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.p ? cur.s / cur.p : 0)).length>9?' long':''}">${fmt(cur.p ? cur.s / cur.p : 0)}<small>원</small></span><span class="d">${chg(pct(cur.p ? cur.s / cur.p : 0, pre.p ? pre.s / pre.p : 0))} <span class="muted">이전 ${fmt(pre.p ? pre.s / pre.p : 0)}원</span></span></button>
    <button class="tile tbtn" data-cmp="q"><span class="lb">판매수량<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.q)).length>9?' long':''}">${fmt(cur.q)}<small>개</small></span><span class="d">${chg(pct(cur.q, pre.q))} <span class="muted">이전 ${fmt(pre.q)}개</span></span></button>
  </div>
  <div class="muted" style="font-size:12px;margin-top:-6px">비교 기간: ${esc(cr.label)} · 칸을 누르면 두 기간을 날짜별로 비교합니다</div>
  ${unit !== 'ip' ? machBlock(sum, a, b, cur.s) : ''}
  ${multi ? storeCompare(per, sum, stores) : ''}
  ${len === 1 && unit !== 'ip' ? `<div class="note" style="font-size:12.5px">${md(a)}(${wd(a)}) 하루 매출입니다. 아래 그래프는 흐름을 보기 위해 그날까지 최근 14일을 보여 줍니다.</div>` : ''}
  ${unit === 'ip' ? ipBlock(per, sum) : seriesBlock(len === 1 && unit === 'day' ? aggregate(stores, addDays(a, -13), a) : per, sum, stores, unit)}
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
    ${lineChart(keys.map(k => { const v = multi ? totK(k) : val(stores[0], k); const p = sum.reduce((a, s) => a + ((per[s].series[k] || {}).p || 0), 0); const ex = ` · ${fmt(p)}건`; if (unit === 'day') return dayPt(k, v, ex); if (unit === 'week') return { lab: md(k) + '~', sub: `(${wd(k)})`, v, tip: `${periodLabel(k, unit)} · ${fmt(v)}원${ex}` }; return { lab: unit === 'month' ? k.slice(2).replace('-', '.') : periodLabel(k, unit), v, tip: `${periodLabel(k, unit)} · ${fmt(v)}원${ex}` }; }), { aria: title + ' 매출 추이' })}
    ${multi ? `<div class="legend" style="margin:8px 0">${stores.map(s => `<span><span class="dot" style="background:${storeColor(s)}"></span>${esc(storeName(s))}</span>`).join('')}<span><span class="dot" style="background:var(--ink)"></span>합산</span></div>` : ''}
    <div class="hb" style="margin-top:8px">${rows.map((k, i) => {
      if (!multi) { const v = val(stores[0], k); const p = (per[stores[0]].series[k] || {}).p || 0; return `<span class="k">${periodLabel(k, unit)}</span><span class="tr"><i style="width:${v / mx * 100}%;background:var(--red)"></i></span><span class="v">${fmt(v)}<span class="muted" style="font-weight:500"> · ${fmt(p)}건</span></span>`; }
      return `${i ? '<span class="sep"></span>' : ''}<span class="k">${periodLabel(k, unit)}</span><span class="tr multi">${stores.map(s => `<i style="width:${val(s, k) / mx * 100}%;background:${storeColor(s)}"></i>`).join('')}<i style="width:${totK(k) / mx * 100}%;background:var(--ink)"></i></span><span class="v multi">${stores.map(s => `<span style="color:${storeColor(s)}">${man(val(s, k))}</span>`).join('')}<span>${man(totK(k))}</span></span>`;
    }).join('')}</div></div>`;
}
function trendSvg(vals, labels) {
  if (vals.length < 2) return '';
  // 화면 폭에 맞춰 그림 비율을 바꿔서, 큰 모니터에서도 그래프 높이가 너무 커지지 않게 (글자는 그대로)
  const zw = (parseFloat(getComputedStyle(document.body).zoom) || 1) * (parseFloat(document.documentElement.style.zoom) || 1);
  const avail = Math.round(innerWidth / zw - (innerWidth / zw > 900 ? 270 : 70));
  const W = Math.max(360, Math.min(2000, avail)), H = W < 640 ? 170 : 190, L = 8, R = 8, T = 22, B = 22; const mx = Math.max(...vals, 1);
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
    <label class="ck"><input type="checkbox" id="posDeduct" ${pv.newDays && pv.newDays.length ? 'checked' : ''} ${pv.newDays && pv.newDays.length ? '' : 'disabled'}><span><span class="t">판매 수량을 재고에서 빼기${pv.newDays && pv.newDays.length ? ` — ${pv.newDays.length === 1 ? md(pv.newDays[0]) : md(pv.newDays[0]) + '~' + md(pv.newDays[pv.newDays.length - 1])} ${pv.newDays.length}일치만` : ''}</span><span class="s" style="display:block">${pv.lastPos ? `${md(pv.lastPos)}까지는 이미 재고에서 뺐습니다. ${pv.newDays.length ? '그 뒤 날짜만 빼서 두 번 빠지지 않습니다.' : '새로 뺄 날짜가 없습니다 (매출만 저장).'}` : "찾은 상품만 '판매'로 재고에서 뺍니다."}</span></span></label>
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
    // 재고는 '마지막으로 POS 판매를 뺀 날짜' 다음 날부터만 뺌 (한 달치 파일을 다시 올려도 두 번 빠지지 않게)
    const lastPos = S.moves.filter(m => m.store === store && m.type === '판매' && m.by === '자동(POS)').reduce((a, m) => (m.date > a ? m.date : a), '');
    const newDays = days.map(d => d.date).filter(d => d > lastPos);
    S.ui.posPreview = { store, days, match, unmatched: [...unmatched], file: f.name, lastPos, newDays };
  } catch (err) {
    S.ui.posPreview = { store, err: /password|encrypted|Wrong/i.test(String(err && err.message)) ? `zip 비밀번호가 맞지 않습니다. 관리 › 파일 비밀번호에서 ${storeName(store)} 비밀번호를 확인해 주세요.` : String(err.message || err) };
  }
  render();
}
async function savePos() {
  const pv = S.ui.posPreview; const st = pv.store;
  for (const d of pv.days) {
    const ip = {}, pr = {}; for (const x of d.L) { const a = ip[x.ip] ||= [0, 0]; a[0] += x.q; a[1] += x.s; const b = pr[x.name] ||= [0, 0, x.ip]; b[0] += x.q; b[1] += x.s; }
    const rec = { s: d.s, p: d.p, q: d.q, ip, pr, up: { at: new Date().toISOString(), by: S.user.name, co: userCo(S.user), uid: S.user.uid, file: pv.file || '' } };
    await DB.saveSalesDay(st, d.date, rec);
    ((S.sales[st] ||= {})[d.date.slice(0, 7)] ||= { days: {} }).days[d.date.slice(8)] = rec;
  }
  if ($('#posDeduct') && $('#posDeduct').checked && pv.match.length) {
    const list = pv.match.filter(m => !pv.lastPos || m.date > pv.lastPos).map((m, i) => ({ id: 'p' + Date.now().toString(36) + i, date: m.date, store: st, type: '판매', pid: m.pid, qty: -m.q, memo: 'POS 판매', by: '자동(POS)', at: new Date().toISOString() }));
    await DB.saveMoves(stampMoves(list, pv.file)); for (const m of list) { S.moves.push(m); S.stock[st][m.pid] = stockOf(st, m.pid) + m.qty; }
  }
  S.ui.posPreview = null; S.ui.drawer = null; toast(`매출 ${pv.days.length}일치를 저장했습니다`);
}
async function readBook(f) {
  // CSV는 글자(UTF-8)로 읽어야 한글이 깨지지 않음
  if (/\.csv$/i.test(f.name)) { let t = await f.text(); if (t.includes('\uFFFD')) t = new TextDecoder('euc-kr').decode(await f.arrayBuffer()); return XLSX.read(t.replace(/^\uFEFF/, ''), { type: 'string' }); }
  return XLSX.read(await f.arrayBuffer(), { type: 'array' });
}
function pickFile(accept, cb, multi) {
  // 화면이 다시 그려져도 사라지지 않도록 문서 맨 끝에 따로 만든 파일 선택 칸
  let inp = document.getElementById('smgFilePick');
  if (inp) inp.remove();
  inp = document.createElement('input'); inp.type = 'file'; inp.id = 'smgFilePick'; inp.accept = accept; inp.style.display = 'none'; if (multi) inp.multiple = true;
  inp.addEventListener('change', () => { const fs = [...(inp.files || [])]; if (fs.length) multi ? cb(fs) : cb(fs[0]); });
  document.body.appendChild(inp); inp.click();
}
function loadScript(src) { return new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('라이브러리를 불러오지 못했습니다')); document.head.appendChild(s); }); }

/* ───────── 정산 계산: 매출 파일을 올리면 바로 다시 계산 ───────── */
function settleKey(R, ip, name) {
  if (ip === '하이큐 쉬는시간') return R.hkC.includes(name) ? '하이큐 쉬는시간(SMG-C)' : '하이큐 쉬는시간(SMG_H)';
  if (ip === 'SMG-C 은혼 요시와라 대염상' && String(name).includes('(영상)')) return '은혼 요시와라 대염상(MP)';
  return ip;
}
function settleRate(R, key, month) {
  if (R.creConsign.includes(key)) return ['크리에이티브 위탁', 0.8];
  if (R.oninBuy.includes(key)) return ['온인터 사입', 0.8];
  if (key === R.license.key) return ['홀딩스', month < R.license.before ? R.license.old : R.license.new];
  if (R.rates[key]) return R.rates[key];
  return ['요율 확인 필요', null];
}
function computeSettle(store = 'suwon') {
  const R = S.settleRules; if (!R) return null;
  const out = []; const months = Object.keys(S.sales[store] || {}).filter(m => m >= R.from && !R.confirmed.includes(m)).sort();
  const machRate = name => { const v = R.machineRates && R.machineRates[name]; return v == null ? MACH_RATE_DEFAULT : v; };
  for (const m of months) {
    const g = {}; let lastD = '';
    for (const [dd, rec] of Object.entries(S.sales[store][m].days || {})) {
      lastD = dd > lastD ? dd : lastD;
      for (const [name, [q, sales, ip]] of Object.entries(rec.pr || {})) {
        const k = settleKey(R, ip, name); const x = g[k] ||= { sales: 0, gel: 0 }; x.sales += sales;
        if (k === R.gelKey && name.includes(R.gelKeyword)) x.gel += sales;
      }
    }
    for (const [k, x] of Object.entries(g)) {
      const [sup, rate] = settleRate(R, k, m);
      const onin = rate == null ? '' : Math.round(x.sales * rate);
      const cre = sup === '크리에이티브 위탁' ? Math.round(x.gel * R.gelCreRate + (x.sales - x.gel) * R.creRate) : 0;
      out.push({ month: m, ip: k, supplier: sup, sales: x.sales, rate: rate == null ? '' : rate, onin, creative: cre, net: rate == null ? '' : onin - cre, status: '예상', last_date: `${m}-${lastD}`, kind: 'ip' });
    }
    for (const [, mm] of Object.entries(S.sales[store][m].mach || {})) {
      const ds = Object.entries(mm.days || {}); if (!ds.length) continue;
      const sales = ds.reduce((a, [, v]) => a + v[0], 0), rate = machRate(mm.name), onin = Math.round(sales * rate);
      const ld = ds.reduce((a, [d]) => (d > a ? d : a), ''); if (ld > lastD) lastD = ld;
      out.push({ month: m, ip: mm.name, supplier: '자판기·기계', sales, rate, onin, creative: 0, net: onin, status: '예상', last_date: `${m}-${ld}`, kind: 'machine' });
    }
    out.push({ month: m, ip: '시공비 (월 차감)', supplier: '차감', sales: 0, rate: '', onin: -R.construction, creative: 0, net: -R.construction, status: '예상', last_date: `${m}-${lastD}`, kind: 'deduct' });
  }
  return out;
}
function settleRows() {
  const calc = computeSettle(); if (!calc) return S.settle;
  const done = S.settle.filter(r => (S.settleRules.confirmed || []).includes(r.month));
  return done.concat(calc);
}

/* ───────── 정산 (대표만) ───────── */
function settleView() {
  if (!canSettle()) return '';
  const ALL = settleRows();
  const months = [...new Set(ALL.map(r => r.month))].sort().reverse();
  const m = S.ui.settleMonth || months[0];
  const rows = ALL.filter(r => r.month === m);
  const lastDate = rows.reduce((a, r) => (r.last_date > a ? r.last_date : a), '');
  const unknown = rows.filter(r => (r.kind === 'ip' || r.kind === 'machine') && r.rate === '');
  const ipRows = rows.filter(r => r.kind === 'ip' || r.kind === 'machine').sort((a, b) => (a.kind === 'machine') - (b.kind === 'machine') || b.net - a.net); const ded = rows.filter(r => r.kind === 'deduct');
  const machSales = rows.filter(r => r.kind === 'machine').reduce((a, r) => a + r.sales, 0);
  const T = k => rows.reduce((a, r) => a + (+r[k] || 0), 0);
  const st = rows[0] ? rows[0].status : '';
  return `${head('정산', '대표만 보입니다 · POS 매출 × 홀딩스 정산서 요율 + 자판기·기계 매출 × 20%', `<select class="inp" id="setM" style="width:auto">${months.map(x => `<option ${x === m ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
  <div class="tiles"><div class="tile"><span class="lb">판매 금액${machSales ? ' (POS + 기계)' : ''}</span><span class="v big${String(fmt(ipRows.reduce((a, r) => a + r.sales, 0))).length>9?' long':''}">${fmt(ipRows.reduce((a, r) => a + r.sales, 0))}<small>원</small></span>${machSales ? `<span class="d muted">기계 ${fmt(machSales)}원 포함</span>` : ''}</div>
    <div class="tile"><span class="lb">온인터 배분</span><span class="v big${String(fmt(T('onin'))).length>9?' long':''}">${fmt(T('onin'))}<small>원</small></span></div>
    <div class="tile"><span class="lb">크리에이티브 지급</span><span class="v big${String(fmt(-T('creative'))).length>9?' long':''}">${fmt(-T('creative'))}<small>원</small></span></div>
    <div class="tile"><span class="lb">순수익 (${/확정/.test(st) ? '✔ 확정' : '🔸 예상'})</span><span class="v big${String(fmt(T('net'))).length>9?' long':''}">${fmt(T('net'))}<small>원</small></span><span class="d muted">시공비 차감 포함</span></div></div>
  <div class="note" style="font-size:12.5px">${/확정/.test(st) ? '✔ 홀딩스 정산서와 맞춘 확정 금액입니다.' : `🔸 예상 금액 · 매출 <b>${esc(lastDate)}</b>까지 반영 · 토스포스 파일을 올리면 바로 다시 계산됩니다.${S.settleRules ? '' : ' (정산 요율이 아직 등록되지 않아 마지막으로 넣은 자료를 보여 줍니다)'}`}</div>
  ${unknown.length ? `<div class="note bad">🔺 요율이 정해지지 않은 IP ${unknown.length}개: ${unknown.map(r => esc(r.ip)).join(', ')} — 순수익 합계에서 빠져 있습니다.</div>` : ''}
  <div class="card"><h2>IP별 · 기계</h2><div class="tw"><table><thead><tr><th>IP</th><th class="hide-s">공급</th><th class="n">판매 금액</th><th class="n">요율</th><th class="n">온인터 배분</th><th class="n hide-s">크리에이티브 지급</th><th class="n">순수익</th></tr></thead><tbody>
  ${ipRows.map(r => `<tr><td class="nm">${esc(r.ip)}</td><td class="hide-s nowrap muted">${esc(r.supplier)}</td><td class="n">${fmt(r.sales)}</td><td class="n">${r.rate === '' ? '-' : Math.round(r.rate * 100) + '%'}</td><td class="n">${fmt(r.onin)}</td><td class="n hide-s">${r.creative ? fmt(-r.creative) : '-'}</td><td class="n" style="font-weight:700">${fmt(r.net)}</td></tr>`).join('')}
  ${ded.map(r => `<tr><td class="nm">${esc(r.ip)}</td><td class="hide-s muted">차감</td><td class="n">-</td><td class="n">-</td><td class="n">${fmt(r.onin)}</td><td class="n hide-s">-</td><td class="n" style="font-weight:700;color:var(--bad)">${fmt(r.net)}</td></tr>`).join('')}
  <tr class="tot"><td>합계</td><td class="hide-s"></td><td class="n">${fmt(ipRows.reduce((a, r) => a + r.sales, 0))}</td><td></td><td class="n">${fmt(T('onin'))}</td><td class="n hide-s">${fmt(-T('creative'))}</td><td class="n">${fmt(T('net'))}</td></tr></tbody></table></div></div>`;
}

/* ───────── 관리 ───────── */
function adminView() {
  const tabs = [['pending', '승인 대기'], ['users', '직원'], ['stores', '매장·회사'], ['pw', '파일 비밀번호'], ['products', '상품 목록']].filter(([k]) => can('approve') || k === 'products');
  if (isOwner()) tabs.push(['check', '자료 점검']);
  if (isOwner() && S.mode === 'live') tabs.push(['rules', '정산 요율']);
  if (isOwner() && S.mode === 'live') tabs.push(['seed', '처음 자료 넣기']);
  const t = S.ui.adminTab;
  const pendingN = S.users.filter(u => u.status === 'pending').length;
  return `${head('관리', '승인권자: 유명훈 본부장 · 사용자 승인 권한이 있는 사람만 볼 수 있습니다', S.mode === 'demo' ? '<button class="btn" id="showApply">직원 신청 화면 보기</button>' : '')}
  <div class="seg">${tabs.map(([k, n]) => `<button class="${t === k ? 'on' : ''}" data-at="${k}">${n}${k === 'pending' && pendingN ? ` (${pendingN})` : ''}</button>`).join('')}</div>
  ${t === 'rules' ? rulesView() : t === 'check' ? checkView() : t === 'seed' ? seedView() : t === 'pending' ? pendingView() : t === 'users' ? usersView() : t === 'stores' ? storesAdmin() : t === 'pw' ? pwView() : productsAdmin()}`;
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
    <div class="muted" style="font-size:12px">정산은 대표만 볼 수 있습니다</div>
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
function rulesView() {
  const R = S.settleRules;
  return `<div class="card"><h2>정산 요율 (대표만)</h2><p class="muted" style="margin:0 0 10px;font-size:13px">IP별 온인터 요율표입니다. 이 표로 매출 파일을 올릴 때마다 정산 예상을 다시 계산합니다. 요율표는 Firebase의 정산 칸(대표·정산 담당자만 읽기)에만 저장되고 공개 코드에는 들어가지 않습니다.</p>
  ${R ? `<div class="note">✔ 등록됨 · ${esc(R.updated || '')} · IP ${Object.keys(R.rates).length}개 + 크리에이티브 위탁 ${R.creConsign.length}개 · 시공비 월 ${fmt(R.construction)}원</div>` : '<div class="note warn">🔸 아직 등록되지 않았습니다. Claude가 보내 드린 smg-정산요율.json 파일을 골라 주세요.</div>'}
  <div style="margin-top:10px"><button class="btn pri" id="rulesBtn">요율 파일 고르기</button></div></div>`;
}
function checkView() {
  const rows = [];
  for (const st of STORES.map(s => s.id)) for (const [ym, m] of Object.entries(S.sales[st] || {}).sort()) {
    const days = Object.keys(m.days || {}).sort(); const dim = new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
    const lastD = days[days.length - 1]; const want = ym === (latestSalesDate([st]) || '').slice(0, 7) ? +lastD - +(days[0] || 1) + 1 : dim;
    const miss = []; if (days.length) for (let i = +days[0]; i <= +lastD; i++) if (!days.includes(String(i).padStart(2, '0'))) miss.push(i);
    rows.push({ st, ym, n: days.length, first: days[0], last: lastD, s: days.reduce((a, d) => a + (m.days[d].s || 0), 0), miss });
  }
  return `<div class="card"><h2>매출 자료 점검 (대표만)</h2><p class="muted" style="margin:0 0 10px;font-size:13px">월마다 들어 있는 날짜 수와 빠진 날짜를 보여 줍니다. 빠진 날이 있으면 그날 토스포스 파일을 다시 올리면 됩니다.</p>
  <div class="tw"><table><thead><tr><th>매장</th><th>월</th><th class="n">날짜 수</th><th>처음~마지막</th><th class="n">매출 합계</th><th>자료 없는 날</th></tr></thead><tbody>
  ${rows.reverse().map(r => `<tr class="${r.miss.length ? 'flag' : ''}"><td class="nowrap">${sdot(r.st)}${esc(shortName(r.st))}</td><td class="nowrap num" style="text-align:left">${r.ym}</td><td class="n">${r.n}</td><td class="nowrap">${r.first || '-'}일 ~ ${r.last || '-'}일</td><td class="n">${fmt(r.s)}</td><td>${r.miss.length ? `🔸 ${r.miss.join(', ')}일 (휴무일이 아니면 파일 다시 올리기)` : '✔'}</td></tr>`).join('') || '<tr><td colspan="6" class="empty">매출 자료가 없습니다</td></tr>'}
  </tbody></table></div></div>`;
}
function seedView() {
  return `<div class="card"><h2>처음 자료 넣기 (대표만, 한 번만)</h2><p style="margin:0 0 10px;font-size:13px"><b>smg-seed-수원.json</b> 파일을 고르면 수원 상품·재고·입출고 기록·매출·정산 자료를 한 번에 넣습니다. 이미 넣었다면 다시 하지 마세요 (같은 내용으로 덮어씁니다).</p>
  <div class="row"><button class="btn pri" id="seedBtn" ${S.ui.seeding ? 'disabled' : ''}>전체 다시 넣기</button><button class="btn" id="reseedBtn" ${S.ui.seeding ? 'disabled' : ''}>매출·정산만 다시 넣기</button></div>
  <p class="muted" style="font-size:12.5px;margin:8px 0 0">매출이 빠진 날이 있을 때는 <b>[매출·정산만 다시 넣기]</b>를 쓰세요. 한 달씩 넣고, 앱에서 이미 올린 날짜(예: 10/30)는 지우지 않습니다. 실패한 달이 있으면 아래에 이유가 나옵니다.</p><div class="muted" style="margin-top:8px;font-weight:600">${esc(S.ui.seedMsg || '')}</div></div>`;
}
function moreView() {
  return `${head('설정', `앱 업데이트 ${APP_VERSION}`)}<div class="card">${textSizeBox()}</div>`;
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
    <p class="muted" style="margin:0;text-align:center">구글 계정으로 로그인한 뒤 사용 신청을 보내 주세요.</p>
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
  ${S.ui.drawer ? `<div class="ov" id="ov"><div class="dr${S.ui.drawer.wide ? ' wide' : ''}" role="dialog" aria-modal="true">${S.ui.drawer()}</div></div>` : ''}`;
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
function openProduct(pid) { S.ui.prevDrawer = (S.ui.drawer === homeDrawer || S.ui.drawer === cmpDrawer) ? S.ui.drawer : null; S.ui.drawer = () => productDrawer(pid); render(); resetZoom(); }

/* ───────── 이벤트 ───────── */
/* ───────── 그래프 (모든 날짜·요일 표시, 값 라벨, 눈금선, 주말 색, 누르면 자세히) ───────── */
// pts: [{ lab:'10/19', sub:'(월)', d:'YYYY-MM-DD'|null, v, tip }]  o: { cmp:[v...], cmpTip:[...], color, aria, unitFmt }
function niceMax(v) { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; }
function lineChart(pts, o = {}) {
  const n = pts.length; if (!n) return '';
  const zw = (parseFloat(getComputedStyle(document.body).zoom) || 1) * (parseFloat(document.documentElement.style.zoom) || 1);
  const avail = Math.round(innerWidth / zw - (innerWidth / zw > 900 ? 300 : 64));
  const W = Math.max(330, Math.min(1800, avail)), L = 44, R = 14, T = 26, B = 40, H = W < 640 ? 230 : 250;
  const cw = (W - L - R) / Math.max(1, n);   // 점 하나 폭
  const fv = o.unitFmt || man;
  const all = pts.map(p => p.v).concat(o.cmp || []); const mx = niceMax(Math.max(1, ...all));
  const X = i => L + cw * (i + .5), Y = v => T + (1 - v / mx) * (H - T - B);
  let g = '';
  for (let k = 0; k <= 4; k++) { const v = mx * k / 4, y = Y(v); g += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="yl" x="${L - 6}" y="${(y + 4).toFixed(1)}" text-anchor="end">${k ? fv(v) : '0'}</text>`; }
  // 주말 바탕색
  pts.forEach((p, i) => { if (!p.d) return; const w = new Date(p.d + 'T00:00:00Z').getUTCDay(); if (w === 0 || w === 6) g += `<rect class="${w ? 'sat' : 'sun'}" x="${(X(i) - cw / 2).toFixed(1)}" y="${T}" width="${cw.toFixed(1)}" height="${H - T - B}"/>`; });
  const step = Math.max(1, Math.ceil(36 / cw));   // 날짜 글자가 겹치지 않게 (430px 기준 약 9개)
  const showVal = cw >= 40;
  const line = (V, cls) => V.length > 1 ? `<polyline class="${cls}" points="${V.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(' ')}"/>` : '';
  if (o.cmp) g += line(o.cmp, 'ln2');
  g += pts.length > 1 ? `<polygon class="area" points="${X(0).toFixed(1)},${Y(0)} ${pts.map((p, i) => `${X(i).toFixed(1)},${Y(p.v).toFixed(1)}`).join(' ')} ${X(n - 1).toFixed(1)},${Y(0)}"/>` : '';
  g += line(pts.map(p => p.v), 'ln');
  const iMax = pts.reduce((k, p, i) => (p.v > pts[k].v ? i : k), 0);
  pts.forEach((p, i) => {
    const w = p.d ? new Date(p.d + 'T00:00:00Z').getUTCDay() : -1, wc = w === 0 ? ' sun' : w === 6 ? ' sat' : '';
    g += `<circle class="pt" cx="${X(i).toFixed(1)}" cy="${Y(p.v).toFixed(1)}" r="${n > 60 ? 2 : 3.2}"/>`;
    if (showVal || i === iMax || i === n - 1) g += `<text class="vl" x="${X(i).toFixed(1)}" y="${(Y(p.v) - 7).toFixed(1)}" text-anchor="${i === 0 && !showVal ? 'start' : i === n - 1 && !showVal ? 'end' : 'middle'}">${fv(p.v)}</text>`;
    if (i % step === 0 || (i === n - 1 && (n - 1) % step >= step / 2)) g += `<text class="xl${wc}" x="${X(i).toFixed(1)}" y="${H - B + 16}" text-anchor="middle">${esc(p.lab)}</text>${p.sub ? `<text class="xl xs${wc}" x="${X(i).toFixed(1)}" y="${H - B + 30}" text-anchor="middle">${esc(p.sub)}</text>` : ''}`;
    g += `<rect class="chit" data-tip="${esc(p.tip || p.lab + ' ' + fmt(p.v))}${o.cmpTip && o.cmpTip[i] ? esc(' · ' + o.cmpTip[i]) : ''}" x="${(X(i) - cw / 2).toFixed(1)}" y="${T - 20}" width="${cw.toFixed(1)}" height="${H - T + 20}"><title>${esc(p.tip || '')}</title></rect>`;
  });
  return `<div class="chartbox"><svg class="trend lc" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(o.aria || '추이 그래프')}">${g}</svg><div class="ctip" hidden></div>
    <div class="chint muted">점을 누르면 날짜·금액·건수가 나옵니다${step > 1 ? ` · 날짜는 ${step}칸마다 표시` : ''} · <span class="sat-t">토</span> <span class="sun-t">일</span> 바탕색</div></div>`;
}
function dayPt(d, v, extra) { return { lab: md(d), sub: `(${wd(d)})`, d, v, tip: `${md(d)}(${wd(d)}) · ${fmt(v)}원${extra || ''}` }; }
// 누르거나 마우스를 올리면 말풍선
function chartTip(ev) {
  const r = ev.target.closest && ev.target.closest('.chit'); const boxes = document.querySelectorAll('.chartbox .ctip');
  if (!r) { if (ev.type === 'click') boxes.forEach(b => b.hidden = true); return; }
  const box = r.closest('.chartbox'), tip = box.querySelector('.ctip'), br = box.getBoundingClientRect(), rr = r.getBoundingClientRect();
  tip.textContent = r.dataset.tip; tip.hidden = false;
  const x = Math.min(Math.max(rr.left + rr.width / 2 - br.left - tip.offsetWidth / 2, 0), br.width - tip.offsetWidth);
  tip.style.left = x + 'px'; tip.style.top = '0px';
  box.querySelectorAll('.chit.on').forEach(e => e.classList.remove('on')); r.classList.add('on');
}
document.addEventListener('click', chartTip); document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse') chartTip(e); });

/* ───────── 파일 자동 매핑 (양식 없이: 여러 줄 머리글, 같은 뜻 열 이름, 양식 기억) ───────── */
const SM = (() => {
  const nz = s => String(s ?? '').replace(/[\s\n\r\t()（）\[\]{}:·.\-_/]/g, '').toLowerCase();
  const SYN = {
    sku: ['sku', '품번', '상품코드', '품목코드', '제품코드', '자체코드', '상품번호', 'itemcode', 'code', '코드', 'productcode', '관리코드', '모델번호'],
    barcode: ['바코드', 'barcode', 'ean', 'jan', 'upc', 'gtin', '바코드번호'],
    name: ['상품명', '품명', '제품명', '품목명', '상품', '품목', '아이템', 'item', 'itemname', 'productname', 'product', 'name', '상품이름', '물건'],
    qty: ['수량', 'qty', 'quantity', 'q\'ty', 'ea', '개수', '갯수', '입고수량', '출고수량', '이동수량', '실사수량', '실제수량', '재고수량', '확정수량', '납품수량', '발주수량', '예정수량', '입고량', '출고량', '수'],
    date: ['날짜', '일자', '입고일', '출고일', '입고날짜', '출고날짜', '입고일자', '출고일자', '납품일', 'date', '기준일', '일시'],
    price: ['판매가', '단가', '소비자가', '가격', 'price', '정가', '상품가격', '공급가'],
    option: ['옵션명', '옵션', 'option', '색상', '사이즈'],
    memo: ['메모', '비고', '사유', 'note', 'memo', 'remark', '참고'],
    ip: ['ip', '카테고리', '작품', '브랜드', 'category'],
  };
  const numVal = v => { if (typeof v === 'number') return v; const t = String(v ?? '').replace(/[₩￦$,\s]/g, '').replace(/(개|ea|pcs|원|매|장)$/i, ''); return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : NaN; };
  const isNum = v => String(v ?? '').trim() !== '' && !Number.isNaN(numVal(v));
  const TOTAL = /^(합계|총계|소계|누계|계|total|subtotal|sum|grandtotal)$/i;
  function score1(cell, f) {
    const c = nz(cell); if (!c) return 0; let best = 0;
    SYN[f].forEach((k, i) => { const w = 1 - i * .02; if (c === k) best = Math.max(best, 3 * w); else if (k.length >= 2 && (c.startsWith(k) || c.endsWith(k))) best = Math.max(best, 2 * w); else if (k.length >= 2 && c.includes(k)) best = Math.max(best, 1.2 * w); });
    if (f === 'qty' && /현재고|참고|리스트/.test(c)) best *= .5; if (f === 'qty' && /금액|가격|단가/.test(c)) best = 0; if (f === 'name' && /코드|번호|바코드/.test(c)) best = 0; if (f === 'sku' && /바코드|barcode/.test(c)) best = 0;
    return best;
  }
  const score = (cell, f) => { const parts = String(cell ?? '').split(' > '); if (parts.length < 2) return score1(cell, f); const L = parts.length - 1; return Math.max(score1(parts[L], f), ...parts.slice(0, L).map(x => score1(x, f) * .6), score1(parts.join(''), f) * .7); };
  function fillMerges(rows, merges = []) {
    for (const m of merges) { const v = rows[m.s.r] && rows[m.s.r][m.s.c]; if (v === '' || v == null) continue;
      for (let r = m.s.r; r <= Math.min(m.e.r, rows.length - 1); r++) { rows[r] ||= []; for (let c = m.s.c; c <= m.e.c; c++) if ((r !== m.s.r || c !== m.s.c) && (r === m.s.r || m.e.r - m.s.r < 4) && (rows[r][c] === '' || rows[r][c] == null)) rows[r][c] = v; } }
    return rows;
  }
  function detectHeader(rows) {
    let best = { i: -1, s: 0 };
    for (let i = 0; i < Math.min(rows.length, 40); i++) { const r = rows[i] || []; const filled = r.filter(c => String(c ?? '').trim()).length; if (filled < 2) continue;
      let s = 0; const hit = new Set();
      for (const f of Object.keys(SYN)) { const m = Math.max(0, ...r.map(c => score(c, f))); if (m >= 1.2) { s += m; hit.add(f); } }
      if (!['qty', 'name', 'sku', 'barcode'].some(f => hit.has(f))) continue;
      s -= r.filter(isNum).length / filled * 4;
      if (rows.slice(i + 1, i + 6).some(x => x && x.some(isNum))) s += 1;
      if (s > best.s) best = { i, s }; }
    return best.i;
  }
  function headerBlock(rows, hi) {
    const txt = r => (r || []).map(c => String(c ?? '').trim()); const isHd = r => { const f = txt(r).filter(Boolean); return f.length >= 1 && !(r || []).some(isNum) && !f.some(x => TOTAL.test(nz(x))); };
    let a = hi, b = hi;
    while (a > 0 && isHd(rows[a - 1]) && new Set(txt(rows[a - 1]).filter(Boolean)).size >= 2) a--;
    while (b + 1 < rows.length && b - a < 6 && isHd(rows[b + 1]) && rows.slice(b + 2, b + 8).some(x => (x || []).some(isNum))) b++;
    return [a, b];
  }
  function flatHeader(rows, a, b) {
    const Bk = []; for (let r = a; r <= b; r++) Bk.push((rows[r] || []).map(c => String(c ?? '').replace(/\s+/g, ' ').trim()));
    const n = Math.max(...Bk.map(r => r.length)); Bk.forEach(r => { while (r.length < n) r.push(''); });
    return Array.from({ length: n }, (_, c) => { const parts = []; Bk.forEach(r => { const v = r[c]; if (v && !parts.includes(v)) parts.push(v); }); return parts.join(' > '); });
  }
  const signature = H => H.map(nz).filter(Boolean).join('|');
  function autoMap(H, qtyPref) {
    const map = {}, used = new Set();
    for (const f of ['barcode', 'sku', 'date', 'price', 'memo', 'option', 'ip', 'name', 'qty']) { let bi = -1, bs = 0;
      H.forEach((h, i) => { if (used.has(i)) return; let s = score(h, f); if (f === 'qty' && qtyPref && s > 0) { const c = nz(h.split(' > ').pop()); const k = qtyPref.findIndex(x => nz(x) === c); if (k >= 0) s += 3 - k * .1; } if (s > bs) { bs = s; bi = i; } });
      if (bi >= 0 && bs >= 1.2) { map[f] = bi; used.add(bi); } }
    return map;
  }
  // 엑셀 → 시트별 행 (병합 셀 채움, 비정상 범위 정리)
  function bookSheets(wb) {
    return wb.SheetNames.map(n => { const ws = wb.Sheets[n]; if (!ws['!ref']) return null;
      let mr = 0, mc = 0; for (const k of Object.keys(ws)) { if (k[0] === '!') continue; const v = ws[k]; if (v && v.v !== '' && v.v != null) { const a = XLSX.utils.decode_cell(k); if (a.r > mr) mr = a.r; if (a.c > mc) mc = a.c; } }
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: mr, c: mc } });
      return { n, rows: fillMerges(XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: true, blankrows: true }), ws['!merges'] || []) }; }).filter(Boolean);
  }
  return { SYN, nz, numVal, isNum, TOTAL, detectHeader, headerBlock, flatHeader, signature, autoMap, bookSheets };
})();
const FIELD_T = { name: '상품명', barcode: '바코드', sku: '품번', qty: '수량', option: '옵션', price: '판매가', date: '날짜', memo: '메모', ip: 'IP' };
S.maps = S.maps || {};
try { Object.assign(S.maps, JSON.parse(localStorage.getItem('smg-import-maps') || '{}')); } catch (e) { }
async function saveImportMap(sig, m) {
  S.maps[sig] = m; try { localStorage.setItem('smg-import-maps', JSON.stringify(S.maps)); } catch (e) { }
  if (DB.saveImportMap) await DB.saveImportMap(sig, m).catch(e => toast('양식을 저장하지 못했습니다: ' + e.message));
}
// 머리글 찾기 + 열 매핑. 돌려주는 값 {r: 머리글 마지막 줄, a: 첫 줄, map, H, sig, how:'saved'|'auto'|'manual', score}
function analyzeSheet(rows, qtyPref, over) {
  const hi = SM.detectHeader(rows); if (hi < 0 && !over) return null;
  const [a, b] = hi < 0 ? [over.a, over.r] : SM.headerBlock(rows, hi);
  const H = SM.flatHeader(rows, a, b); const sig = SM.signature(H);
  let map, how;
  if (over && over.map) { map = over.map; how = 'manual'; }
  else if (S.maps[sig]) { map = { ...S.maps[sig].map }; how = 'saved'; }
  else { map = SM.autoMap(H, qtyPref); how = 'auto'; }
  const score = Object.keys(map).length + (map.qty != null ? 2 : 0) + (map.name != null || map.barcode != null || map.sku != null ? 2 : 0);
  return { r: b, a, map, H, sig, how, score };
}
function bestSheet(wb) {
  let best = null;
  for (const s of SM.bookSheets(wb)) { const d = analyzeSheet(s.rows); if (d && (!best || d.score > best.d.score)) best = { ...s, d }; }
  return best;
}
function mapPanel(im) {
  const d = im.det; if (!d) return '';
  const opts = (f) => `<option value="">없음</option>` + d.H.map((h, i) => h ? `<option value="${i}" ${d.map[f] === i ? 'selected' : ''}>${esc(String.fromCharCode(65 + (i % 26)))}${i >= 26 ? Math.floor(i / 26) : ''} · ${esc(h.length > 28 ? h.slice(0, 28) + '…' : h)}</option>` : '').join('');
  const how = { saved: '<span class="pill p-ok">저장된 양식</span>', auto: '<span class="pill p-info">자동으로 찾음</span>', manual: '<span class="pill p-warn">직접 고름</span>' }[d.how];
  return `<div class="card mapcard"><h2>열 맞추기 ${how} <span class="r">제목 ${d.a + 1}${d.r > d.a ? '~' + (d.r + 1) : ''}번째 줄</span></h2>
    <div class="muted" style="font-size:12.5px;margin:-4px 0 10px">양식이 달라도 됩니다. 칸이 틀렸으면 고르고 [다시 읽기] — [이 양식 기억]을 누르면 같은 제목 줄의 파일은 다음부터 자동으로 맞춥니다.</div>
    <div class="mapgrid">${['name', 'barcode', 'sku', 'option', 'qty', 'price', 'memo'].map(f => `<div class="field"><label for="mp_${f}">${FIELD_T[f]}${f === 'qty' ? ' *' : ''}</label><select class="inp" id="mp_${f}" data-mapf="${f}">${opts(f)}</select></div>`).join('')}</div>
    <div class="row" style="margin-top:10px;justify-content:flex-end"><button class="btn" id="mapRe">다시 읽기</button><button class="btn pri" id="mapSave">이 양식 기억</button></div></div>`;
}
function readMapUI() { const m = {}; document.querySelectorAll('[data-mapf]').forEach(s => { if (s.value !== '') m[s.dataset.mapf] = +s.value; }); return m; }

/* ───────── 콜라보 분석 ───────── */
// IP 일정 이름 → 토스포스 카테고리 (일정마다 '카테고리'를 고치면 그 값이 우선). 하이큐 쉬는시간(콜라보) ≠ 하이큐 10주년(상설)
const PLAN_CATS = { '하이큐!! 쉬는시간': ['하이큐 쉬는시간'], '에반게리온 Light & Shadow': ['에반게리온'], '진격의 거인 The Final Season': ['MP-진격의 거인'], '주술회전 2 (MAPPA)': ['MP-주술회전2'], '슈가슈가룬 2': ['슈슈룬2'], '은혼 구작 2': ['은혼 구작2'] };
const catsOf = r => (r.cats && r.cats.length ? r.cats : PLAN_CATS[r.ip] || [r.ip]);
const catMatch = (r, cat) => { const c = norm(cat); return catsOf(r).some(x => norm(x) === c); };
const collabAt = (st, cat, d) => ipPlan().some(r => r.store === st && r.start <= d && d <= r.end && catMatch(r, cat));
function stockAt(st, pid, d) { let q = stockOf(st, pid); for (const m of S.moves) if (m.store === st && m.pid === pid && m.date > d) q -= m.qty; return q; }
function collabCalc(st, r, a, b) {
  const pids = new Set(S.products.filter(p => catMatch(r, p.ip || '')).map(p => p.id));
  const inP = {}, sold = {}, etc = {}, etcList = [];
  for (const m of S.moves) {
    if (m.store !== st || !pids.has(m.pid) || m.date > b) continue;
    if (m.type === '입고') inP[m.pid] = (inP[m.pid] || 0) + m.qty;
    else if (m.type === '판매') sold[m.pid] = (sold[m.pid] || 0) - m.qty;
    else { etc[m.pid] = (etc[m.pid] || 0) + m.qty; etcList.push(m); }
  }
  // 토스포스 매출 (기간 안, 이 IP 카테고리)
  const pos = {}; let posS = 0, posQ = 0;
  const ipAll = {}; let colS = 0, permS = 0, colQ = 0, permQ = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) {
    const rec = dayRec(st, d); if (!rec) continue;
    for (const [nm, [q, s, ip]] of Object.entries(rec.pr || {})) if (catMatch(r, ip)) { const x = pos[nm] ||= { q: 0, s: 0 }; x.q += q; x.s += s; posS += s; posQ += q; }
    for (const [ip, [q, s]] of Object.entries(rec.ip || {})) { const c = collabAt(st, ip, d); const x = ipAll[ip] ||= { q: 0, s: 0, c: false }; x.q += q; x.s += s; x.c = x.c || c; if (c) { colS += s; colQ += q; } else { permS += s; permQ += q; } }
  }
  const rows = [...pids].filter(pid => inP[pid] || sold[pid] || etc[pid] || stockOf(st, pid) || pos[S.P[pid].name]).map(pid => {
    const p = S.P[pid], ps = pos[p.name] || { q: 0, s: 0 }; const i = inP[pid] || 0, so = sold[pid] || 0, e = etc[pid] || 0, now = stockAt(st, pid, b);
    return { pid, p, in: i, sold: so, etc: e, now, rest: now - (i - so + e), rate: i ? so / i * 100 : null, ps };
  }).sort((x, y) => y.sold - x.sold || y.ps.s - x.ps.s);
  const T = rows.reduce((t, x) => ({ in: t.in + x.in, sold: t.sold + x.sold, etc: t.etc + x.etc, now: t.now + x.now, rest: t.rest + x.rest }), { in: 0, sold: 0, etc: 0, now: 0, rest: 0 });
  const inNames = new Set(rows.filter(x => x.in > 0).map(x => x.p.name));
  const split = { inS: 0, inQ: 0, inN: 0, noS: 0, noQ: 0, noN: 0, noList: [] };
  for (const [nm, x] of Object.entries(pos)) { if (inNames.has(nm)) { split.inS += x.s; split.inQ += x.q; split.inN++; } else { split.noS += x.s; split.noQ += x.q; split.noN++; split.noList.push([nm, x]); } }
  split.noList.sort((x, y) => y[1].s - x[1].s);
  return { rows, T, posS, posQ, split, ipAll, colS, permS, colQ, permQ, etcList: etcList.filter(m => m.date >= addDays(a, -30)).sort((x, y) => x.date.localeCompare(y.date)) };
}
function collabView() {
  const mine = S.stores.filter(s => myStores().includes(s)); const st0 = S.ui.cb && mine.includes(S.ui.cb.store) ? S.ui.cb.store : mine[0];
  const plans = ipPlan().filter(r => r.store === st0);
  const last = latestSalesDate([st0]) || today();
  if (!S.ui.cb || S.ui.cb.store !== st0 || !plans.find(r => r.id === S.ui.cb.id)) { const cur = plans.filter(r => r.start <= last).slice(-1)[0] || plans[0]; S.ui.cb = { store: st0, id: cur ? cur.id : '', a: cur ? cur.start : last, b: cur ? cur.end : last }; }
  const cb = S.ui.cb, r = plans.find(x => x.id === cb.id);
  const top = `${head('콜라보 분석', `IP 콜라보 기간의 입고 · 판매 · 재고 · 매출 · ${esc(shortName(st0))} ${last ? `매출 ${last} 마감` : ''}`)}
  <div class="card"><div class="flt">
    ${mine.length > 1 ? `<div class="fg"><div class="fl">매장</div><div class="fseg">${mine.map(s => `<button class="${s === st0 ? 'on' : ''}" data-cbst="${s}">${esc(shortName(s))}</button>`).join('')}</div></div>` : ''}
    <div class="fg"><div class="fl"><label for="cbPlan">콜라보</label></div><select class="inp" id="cbPlan">${plans.map(x => `<option value="${x.id}" ${x.id === cb.id ? 'selected' : ''}>${esc(x.ip)} · ${x.start.slice(2).replace(/-/g, '.')}~${x.end.slice(5).replace('-', '.')}</option>`).join('')}</select></div>
    <div class="fg"><div class="fl">기간</div><div class="frange"><div class="fd"><span>시작</span>${dateSel('cba', cb.a)}</div><span class="fsep">~</span><div class="fd"><span>종료</span>${dateSel('cbb', cb.b)}</div></div></div>
  </div></div>`;
  if (!r) return top + '<div class="empty">이 매장에 등록된 IP 일정이 없습니다. IP 현황에서 일정을 추가해 주세요.</div>';
  const a = cb.a, b = cb.b, R = collabCalc(st0, r, a, b), T = R.T;
  const days = daysBetween(a, b) + 1, cats = catsOf(r);
  const eq = `<div class="card eqcard" id="cbTot" data-in="${T.in}" data-sold="${T.sold}" data-etc="${T.etc}" data-now="${T.now}">
    <h2>${esc(r.ip)} <span class="r">${md(a)}(${wd(a)}) ~ ${md(b)}(${wd(b)}) · ${days}일 · 토스포스 카테고리 ${cats.map(esc).join(', ')}</span></h2>
    <div class="eq"><div class="eqi"><span class="k">입고</span><b class="num">${fmt(T.in)}</b></div><span class="op">−</span>
      <div class="eqi"><span class="k">판매 차감</span><b class="num">${fmt(T.sold)}</b></div><span class="op">${T.etc < 0 ? '−' : '+'}</span>
      <div class="eqi"><span class="k">기타</span><b class="num">${fmt(Math.abs(T.etc))}</b></div>${T.rest ? `<span class="op">${T.rest < 0 ? '−' : '+'}</span><div class="eqi"><span class="k">기초·미기록</span><b class="num">${fmt(Math.abs(T.rest))}</b></div>` : ''}<span class="op">=</span>
      <div class="eqi res"><span class="k">현재고 <small>${md(b) < md(today()) || b < today() ? md(b) + ' 기준' : '지금'}</small></span><b class="num">${fmt(T.now)}</b></div></div>
    <div class="muted" style="font-size:12.5px">입고·판매 차감·기타 = 앱 입출고 기록 (기간 종료일까지, 이 IP 상품 ${R.rows.length}종) · 판매율 <b class="ink">${T.in ? (T.sold / T.in * 100).toFixed(1) : '-'}%</b></div></div>`;
  const sp = R.split, tot = sp.inS + sp.noS || 1;
  const split = `<div class="card"><h2>콜라보 매출 ${fmt(R.posS)}원 <span class="r">토스포스 · ${fmt(R.posQ)}개</span></h2>
    <div class="tw"><table><thead><tr><th>구분</th><th class="n">상품</th><th class="n">수량</th><th class="n">매출</th><th class="n">비중</th></tr></thead><tbody>
      <tr><td><b style="color:var(--ok)">입고된 상품 판매</b></td><td class="n">${fmt(sp.inN)}종</td><td class="n">${fmt(sp.inQ)}</td><td class="n"><b>${fmt(sp.inS)}</b></td><td class="n">${(sp.inS / tot * 100).toFixed(1)}%</td></tr>
      <tr><td><b style="color:#8a4b00">입고 없는 상품 판매</b></td><td class="n">${fmt(sp.noN)}종</td><td class="n">${fmt(sp.noQ)}</td><td class="n"><b>${fmt(sp.noS)}</b></td><td class="n">${(sp.noS / tot * 100).toFixed(1)}%</td></tr>
    </tbody><tfoot><tr class="tot"><td>합계</td><td class="n">${fmt(sp.inN + sp.noN)}종</td><td class="n">${fmt(sp.inQ + sp.noQ)}</td><td class="n">${fmt(sp.inS + sp.noS)}</td><td class="n">100%</td></tr></tfoot></table></div>
    ${sp.noList.length ? `<div class="muted" style="font-size:12.5px;margin-top:8px">🔸 입고 기록 없이 팔린 상품: ${sp.noList.slice(0, 5).map(([n, x]) => `${esc(n.replace(/^에바30주년팝업_/, ''))} ${fmt(x.q)}개`).join(' · ')}${sp.noList.length > 5 ? ` 외 ${sp.noList.length - 5}종` : ''} — 입고 등록이 빠졌거나 상품 목록에 없는 이름입니다.</div>` : ''}</div>`;
  const etc = `<div class="card"><h2>기타 내역 <span class="r">이동 · 창고 · 반품 · 폐기 · 실사 조정</span></h2>${R.etcList.length ? `<div class="tw"><table><thead><tr><th>날짜</th><th>구분</th><th>상품명</th><th class="n">수량</th><th class="hide-s">메모</th></tr></thead><tbody>
    ${R.etcList.map(m => `<tr><td class="nowrap num">${md(m.date)}(${wd(m.date)})</td><td>${typePill(m.type)}</td><td class="nm">${esc((S.P[m.pid] || {}).name || m.pid)}</td><td class="n"><b>${m.qty > 0 ? '+' : ''}${fmt(m.qty)}</b></td><td class="hide-s muted">${esc(m.memo || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">기타 내역 없음 — 입고와 판매 차감만 있습니다</div>'}</div>`;
  const sku = `<div class="card"><h2>상품별 <span class="r">${R.rows.length}종 · 판매 많은 순</span></h2><div class="tw"><table class="cbsku"><thead><tr><th>상품명</th><th class="n">입고</th><th class="n">판매</th><th class="n hide-s">기타</th><th class="n">현재고</th><th class="n">판매율</th><th class="n hide-s">매출</th></tr></thead><tbody>
    ${R.rows.map(x => `<tr data-pid="${x.pid}"><td class="nm">${esc(x.p.name.replace(/^에바30주년팝업_/, ''))}<div class="muted code" style="font-size:11.5px">${esc(x.p.sku || x.p.barcode || '')}</div></td><td class="n">${fmt(x.in)}</td><td class="n"><b>${fmt(x.sold)}</b></td><td class="n hide-s">${x.etc ? fmt(x.etc) : '-'}</td><td class="n ${x.now < 0 ? 'qty-neg' : ''}"><b>${fmt(x.now)}</b>${x.now === 0 ? ' <span class="pill p-mute">품절</span>' : ''}</td><td class="n">${x.rate == null ? '-' : x.rate.toFixed(1) + '%'}</td><td class="n hide-s">${fmt(x.ps.s)}</td></tr>`).join('')}
    </tbody><tfoot><tr class="tot"><td>합계</td><td class="n">${fmt(T.in)}</td><td class="n">${fmt(T.sold)}</td><td class="n hide-s">${fmt(T.etc)}</td><td class="n">${fmt(T.now)}</td><td class="n">${T.in ? (T.sold / T.in * 100).toFixed(1) + '%' : '-'}</td><td class="n hide-s">${fmt(R.rows.reduce((s, x) => s + x.ps.s, 0))}</td></tr></tfoot></table></div></div>`;
  const all = R.colS + R.permS || 1;
  const cvp = `<div class="card"><h2>콜라보 vs 상설 <span class="r">${esc(shortName(st0))} 전체 매출 · 같은 기간</span></h2>
    <div class="g-bar" role="img" aria-label="콜라보 ${Math.round(R.colS / all * 100)}%"><i class="pos" style="width:${R.colS / all * 100}%"></i><i class="mac" style="width:${R.permS / all * 100}%"></i></div>
    <div class="tw"><table><thead><tr><th>구분</th><th class="n">수량</th><th class="n">매출</th><th class="n">비중</th></tr></thead><tbody>
      <tr><td><b style="color:var(--pos,#1f5fbf)">콜라보</b> <span class="muted">(기간 중 일정에 있는 IP)</span></td><td class="n">${fmt(R.colQ)}</td><td class="n"><b>${fmt(R.colS)}</b></td><td class="n">${(R.colS / all * 100).toFixed(1)}%</td></tr>
      <tr><td><b>상설</b> <span class="muted">(그 밖 IP · 예: 하이큐 10주년)</span></td><td class="n">${fmt(R.permQ)}</td><td class="n"><b>${fmt(R.permS)}</b></td><td class="n">${(R.permS / all * 100).toFixed(1)}%</td></tr>
    </tbody><tfoot><tr class="tot"><td>합계</td><td class="n">${fmt(R.colQ + R.permQ)}</td><td class="n">${fmt(R.colS + R.permS)}</td><td class="n">100%</td></tr></tfoot></table></div></div>`;
  const ips = Object.entries(R.ipAll).sort((x, y) => y[1].s - x[1].s); const mx = ips.length ? ips[0][1].s || 1 : 1;
  const rank = `<div class="card"><h2>IP별 매출 순위 <span class="r">${ips.length}개 · 같은 기간</span></h2><div class="hb">${ips.slice(0, 20).map(([k, x], i) => `<span class="k wrap"><span class="muted num">${i + 1}</span> ${esc(k)} <span class="pill ${x.c ? 'p-bad' : 'p-mute'}">${x.c ? '콜라보' : '상설'}</span></span><span class="tr"><i style="width:${x.s / mx * 100}%;background:${x.c ? 'var(--red)' : 'var(--ink-2)'}"></i></span><span class="v">${fmt(x.s)}<span class="muted" style="font-weight:500"> · ${(x.s / all * 100).toFixed(1)}%</span></span>`).join('')}</div></div>`;
  // 일별 콜라보 매출 흐름
  const pts = []; for (let d = a; d <= (b < last ? b : last); d = addDays(d, 1)) { const rec = dayRec(st0, d); let s = 0, q = 0; if (rec) for (const [ip, [qq, ss]] of Object.entries(rec.ip || {})) if (catMatch(r, ip)) { s += ss; q += qq; } pts.push(dayPt(d, s, ` · ${fmt(q)}개`)); }
  const trend = pts.length > 1 ? `<div class="card"><h2>일별 콜라보 매출</h2>${lineChart(pts, { aria: r.ip + ' 일별 매출' })}</div>` : '';
  return top + eq + split + trend + sku + etc + cvp + rank;
}
function bind() {
  const app = $('#app');
  app.onclick = async ev => {
    const t = ev.target.closest('button,[data-pid],[data-cmpk],[data-hdip],label,input'); if (!t) return;
    const d = t.dataset;
    if (d.install != null) { doInstall(); return; }
    if (d.openext != null) { openExternal(); return; }
    if (d.copylink != null) { copyLink(); return; }
    if (t.closest && t.closest('#navBack')) { try { history.back(); } catch (e) { goBack(); } return; }
    if (d.hd) { S.ui.hd = { k: d.hd, ip: '' }; S.ui.drawer = homeDrawer; render(); return; }
    if (d.hdip != null && S.ui.hd) { S.ui.hd.ip = d.hdip; render(); return; }
    if (d.hdgo) { const k = S.ui.hd ? S.ui.hd.k : 'all'; S.view = d.hdgo; if (d.hdgo === 'products') { S.ui.f = k === 'all' ? 'in' : k; S.ui.ip = S.ui.hd && S.ui.hd.ip && S.ui.hd.ip !== '(IP 없음)' ? S.ui.hd.ip : ''; } S.ui.drawer = null; render(); goTop(); return; }
    if (d.hday) { S.ui.cmp = { a: d.hday, b: d.hday, stores: [...S.stores], metric: 's', mode: 'auto' }; S.ui.drawer = cmpDrawer; render(); return; }
    if (d.hback) { S.ui.drawer = S.ui.prevDrawer || null; S.ui.prevDrawer = null; render(); return; }
    if (d.cmp) { S.ui.cmp = { ...S.ui.cmpCtx, metric: d.cmp, mode: S.ui.cmpMode || 'auto' }; S.ui.drawer = cmpDrawer; render(); return; }
    if (d.cmpk) { S.ui.cmp.metric = d.cmpk; render(); return; }
    if (d.cmpm) { S.ui.cmp.mode = d.cmpm; S.ui.cmpMode = d.cmpm; render(); return; }
    if (t.id === 'stockDoc') { S.ui.sdoc = { stores: [...S.stores], ips: S.ui.ip ? [S.ui.ip] : [], date: today(), f: ['in', 'out', 'neg'].includes(S.ui.f) ? S.ui.f : 'all', ipq: '' }; S.ui.drawer = stockDocDrawer; render(); return; }
    if (d.sdst) { const o = S.ui.sdoc, mine = myStores(); if (d.sdst === '__all') o.stores = [...mine]; else { o.stores = o.stores.includes(d.sdst) ? o.stores.filter(x => x !== d.sdst) : [...o.stores, d.sdst]; if (!o.stores.length) o.stores = [d.sdst]; o.stores = mine.filter(x => o.stores.includes(x)); } render(); return; }
    if (d.sdip) { const o = S.ui.sdoc; o.ips = d.sdip === '__none' ? [] : o.ips.filter(x => x !== d.sdip); render(); return; }
    if (d.sdf) { S.ui.sdoc.f = d.sdf; render(); return; }
    if (d.sdform) { S.ui.sdoc.form = d.sdform; render(); return; }
    if (d.sdfrom) { S.ui.sdoc.from = d.sdfrom; render(); return; }
    if (t.id === 'sdXls') { if (S.ui.sdoc.form === 'simple') exportStock(S.ui.sdoc); else await exportFlow(S.ui.sdoc); return; }
    if (t.id === 'sdPrint') { if (S.ui.sdoc.form === 'simple') printStock(S.ui.sdoc); else printFlow(S.ui.sdoc); return; }
    if (t.id === 'noticeBtn') { S.ui.drawer = noticeDrawer; render(); return; }
    if (t.id === 'ntSave' && isOwner()) { const v = (document.getElementById('ntText') || {}).value || ''; S.ui.drawer = null; await saveNotice(v); toast(v.trim() ? '공지를 올렸습니다' : '공지를 내렸습니다'); return; }
    if (t.id === 'ntClear' && isOwner()) { S.ui.drawer = null; await saveNotice(''); toast('공지를 내렸습니다'); return; }
    if (t.id === 'logoHome') { S.view = 'home'; S.ui.drawer = null; S.ui.storeMenu = false; S.ui.ib = null; render(); goTop(); return; }
    if (t.id === 'storeBtn2') { S.ui.storeMenu = true; render(); return; }
    if (t.id === 'storeBtn') { S.ui.storeMenu = !S.ui.storeMenu; render(); return; }
    if (t.id === 'scrim' || t.id === 'smClose') { if (S.ui.storeEdit) await saveStoreOrder(); S.ui.storeEdit = false; S.ui.storeMenu = false; render(); return; }
    if (t.id === 'smOrder') { S.ui.storeEdit = true; render(); return; }
    if (d.mv) { const [id, dir] = d.mv.split(':'); moveStore(id, +dir); render(); return; }
    if (t.id === 'smOrderDone') { await saveStoreOrder(); S.ui.storeEdit = false; toast('매장 순서를 저장했습니다'); return; }
    if (t.id === 'smAll') { S.stores = [...myStores()]; S.sumStores = null; S.ui.range = null; S.ui.storeMenu = false; render(); return; }
    if (d.sg) { S.stores = [d.sg]; S.sumStores = null; S.ui.storeMenu = false; S.ui.range = null; render(); goTop(); return; }
    if (d.nav) { if (d.nav === 'more' && S.view === 'more') return; S.view = d.nav; S.ui.drawer = null; render(); goTop(); return; }
    if (d.tzt) { S.ui.tzOpen = !S.ui.tzOpen; render(); return; }
    if (d.tz) { applyTextSize(parseFloat(d.tz)); S.ui.tzOpen = false; render(); toast('글자 크기: ' + (TEXT_SIZES.find(x => x[1] === parseFloat(d.tz)) || [''])[0]); return; }
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
    if (t.id === 'rulesBtn') { pickFile('.json,application/json', f => f.text().then(JSON.parse).then(async r => { if (!r.rates || !r.creConsign) throw new Error('정산 요율 파일이 아닙니다'); if (DB.saveSettleRules) await DB.saveSettleRules(r); S.settleRules = r; toast('정산 요율을 저장했습니다'); }).catch(e => alertBox('🔺 ' + e.message))); return; }
    if (t.id === 'reseedBtn') {
      pickFile('.json,application/json', f => {
        S.ui.seeding = true; S.ui.seedMsg = `${f.name} 읽는 중…`; render();
        f.text().then(JSON.parse).then(d => DB.reseedSales(d, (a, b) => { S.ui.seedMsg = `넣는 중 ${a} / ${b}`; render(); }))
          .then(r => { S.ui.seedMsg = r.fail.length ? `🔺 ${r.ok.length}건 성공, ${r.fail.length}건 실패: ${r.fail.join(' / ')}` : `✔ ${r.ok.length}건 모두 넣었습니다. 관리 › 자료 점검과 정산 화면을 확인해 주세요.`; })
          .catch(e => { S.ui.seedMsg = '🔺 ' + (e.message || e); })
          .finally(() => { S.ui.seeding = false; render(); });
      }); return;
    }
    if (t.id === 'seedBtn') {
      pickFile('.json,application/json', f => {
        S.ui.seeding = true; S.ui.seedMsg = `${f.name} 읽는 중…`; render();
        f.text().then(JSON.parse).then(d => DB.seed(d, (a, b) => { S.ui.seedMsg = `저장 중 ${fmt(a)} / ${fmt(b)}`; render(); }))
          .then(n => { S.ui.seedMsg = `✔ ${fmt(n)}건 저장했습니다. 홈으로 가서 재고를 확인해 주세요.`; })
          .catch(e => { S.ui.seedMsg = '🔺 ' + (e.message || e); })
          .finally(() => { S.ui.seeding = false; render(); });
      }); return;
    }
    if (d.ib) { S.ui.ib = d.ib; S.ui.ibMsg = null; S.ui.ibF = 'all'; render(); goTop(); return; }
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
    if (d.ipf) { S.ui.ipF = d.ipf; render(); return; }
    if (t.id === 'ipAdd') { S.ui.ipForm = { id: '', store: S.stores[0] || 'suwon', kind: STORE_KIND[S.stores[0]] || '팝업', ip: '', start: today(), end: today(), host: '', note: '' }; S.ui.drawer = ipDrawer; render(); return; }
    if (d.ipe) { const r = ipPlan().find(x => x.id === d.ipe); if (r) { S.ui.ipForm = { ...r }; S.ui.drawer = ipDrawer; render(); } return; }
    if (d.ipk) { S.ui.ipForm.kind = d.ipk; render(); return; }
    if (t.id === 'ipSave') { const f = S.ui.ipForm; [['ipName', 'ip'], ['ipHost', 'host'], ['ipNote', 'note']].forEach(([i, k]) => { const e = document.getElementById(i); if (e) f[k] = e.value; }); if (!f.ip.trim()) { toast('IP 이름을 넣어 주세요'); return; } if (f.end < f.start) { toast('종료일이 시작일보다 빠릅니다'); return; } const L = ipPlan().map(({ _lane, ...r }) => r), r = { id: f.id || 'u' + Date.now().toString(36), store: f.store, kind: f.kind, ip: f.ip.trim(), start: f.start, end: f.end, host: f.host.trim(), note: f.note.trim(), cats: ((document.getElementById('ipCats') || {}).value || '').split(',').map(x => x.trim()).filter(Boolean) }; const i = L.findIndex(x => x.id === r.id); i >= 0 ? (L[i] = r) : L.push(r); S.ui.drawer = null; S.ui.ipForm = null; await saveIpPlan(L); toast('IP 일정을 저장했습니다'); return; }
    if (t.id === 'ipDel') { const id = S.ui.ipForm.id; if (!S.ui.ipDelAsk) { S.ui.ipDelAsk = true; t.textContent = '한 번 더 누르면 지웁니다'; return; } S.ui.ipDelAsk = false; S.ui.drawer = null; S.ui.ipForm = null; await saveIpPlan(ipPlan().filter(x => x.id !== id).map(({ _lane, ...r }) => r)); toast('일정을 지웠습니다'); return; }
    if (t.id === 'plSave') { await savePlace(); return; }
    if (t.id === 'linkGo') { readLink($('#linkIn').value.trim()); return; }
    if (t.id === 'impCancel') { S.ui.imp = null; render(); return; }
    if (d.dupm) { S.ui.imp.dupMode = d.dupm; render(); return; }
    if (t.id === 'mapRe' || t.id === 'mapSave') { const im = S.ui.imp; const m = readMapUI(); if (m.qty == null || (m.name == null && m.barcode == null && m.sku == null)) { toast('상품명(또는 바코드·품번)과 수량 칸을 골라 주세요'); return; }
      if (t.id === 'mapSave') { await saveImportMap(im.det.sig, { map: m, sample: im.det.H.filter(Boolean).slice(0, 8), by: S.user.name, at: new Date().toISOString() }); }
      importRows(im.raw, im.src, { a: im.det.a, r: im.det.r, map: m }); if (t.id === 'mapSave') S.ui.imp.det.how = 'saved'; render(); if (t.id === 'mapSave') toast('이 양식을 기억했습니다 — 같은 제목 줄 파일은 다음부터 자동'); return; }
    if (d.cbst) { S.ui.cb = { store: d.cbst }; render(); return; }
    if (t.id === 'impUse') { S.ui.entry.file = S.ui.imp.src; for (const r of S.ui.imp.rows) if (r.pid && r.qty > 0 && !(r.dup && S.ui.imp.dupMode === 'first')) addLine(r.pid, r.qty, r.dup ? `파일 ${r.dup}줄과 같은 상품 — 수량 합침` : null); S.ui.imp = null; S.ui.entry.mode = 'hand'; render(); return; }
    if (t.id === 'cSave') { await saveCount(); S.ui.cntMsg = null; return; }
    if (t.id === 'cntTpl') { countTemplate(); return; }
    if (t.id === 'cntFile') { pickFile('.xlsx,.xls,.csv', f => fileRows(f).then(x => countApply(x.rows, x.src)).catch(e => { S.ui.cntMsg = { bad: true, html: '🔺 ' + esc(e.message) }; render(); })); return; }
    if (t.id === 'cntLinkGo') { linkRows($('#cntLink').value.trim()).then(x => countApply(x.rows, x.src)).catch(e => { S.ui.cntMsg = { bad: true, html: '🔺 ' + esc(e.message) }; render(); }); return; }
    if (t.id === 'cReset') { S.ui.counts[S.stores[0]] = {}; render(); return; }
    if (d.recv) { await receive(d.recv); return; }
    if (d.rt != null) { S.ui.recType = d.rt; render(); return; }
    if (d.su) { S.ui.salesUnit = d.su; S.ui.range = null; render(); return; }
    if (d.qr != null) { S.ui.range = { unit: S.ui.salesUnit, ab: S._quick[+d.qr][1]() }; render(); return; }
    if (t.id === 'machBtn') { S.ui.machPv = null; S.ui.drawer = machDrawer; render(); return; }
    if (t.id === 'machFileBtn') { const st = ($('#machStore') || {}).value || S.stores[0]; pickFile('.pdf,.xlsx,.xls,.csv', fs => { S.ui.machStore = st; readMachFiles(fs, st).catch(e => { S.ui.machPv = { store: st, mach: [], errs: [e.message || String(e)], files: [] }; render(); }); }, true); return; }
    if (t.id === 'machSave') { document.querySelectorAll('[data-mname]').forEach(x => { S.ui.machPv.mach[+x.dataset.mname].name = x.value; }); await saveMach(); return; }
    if (t.id === 'posBtn') { S.ui.posPreview = null; S.ui.drawer = posDrawer; render(); return; }
    if (t.id === 'posSave') { await savePos(); return; }
    if (d.at) { S.ui.adminTab = d.at; render(); return; }
    if (t.id === 'showApply') { S.ui.showApply = true; render(); return; }
    if (d.approve) { const u = S.users.find(x => x.uid === d.approve); const p = S.ui.draft[u.uid]; u.perms = { stores: p.stores, move: !p.lim && !!p.move, count: !p.lim && !!p.count, sales: !p.lim && !!p.sales, approve: !p.lim && !!p.approve, settle: false }; u.limited = p.lim; u.status = 'active'; u.approvedAt = today(); u.approvedBy = S.user.name; await DB.saveUser(u); toast(`${u.name} 승인했습니다`); return; }
    if (d.reject) { const u = S.users.find(x => x.uid === d.reject); confirmDrawer('신청 거절', `<p style="margin:0">${esc(u.name)}의 신청을 거절할까요?</p>`, '거절', async () => { S.users = S.users.filter(x => x !== u); if (DB.deleteUser) await DB.deleteUser(u.uid); toast('거절했습니다'); }); return; }
    if (d.resign) { const u = S.users.find(x => x.uid === d.resign); confirmDrawer(`${u.name} 퇴사 처리`, `<p style="margin:0 0 8px"><b>${esc(u.name)}</b> (${esc(u.position)}) 을 퇴사 처리할까요?</p><ul style="margin:0;padding-left:18px;font-size:13px"><li>앱을 켜 둔 상태여도 바로 로그아웃됩니다</li><li>같은 구글 계정으로 다시 들어오거나 재신청할 수 없습니다</li><li>남긴 입출고 기록은 이름 그대로 남습니다</li></ul>`, '퇴사 처리', async () => { u.status = 'resigned'; u.resignedAt = today(); u.resignedBy = S.user.name; await DB.saveUser(u); toast(`${u.name} 퇴사 처리했습니다`); }); return; }
    if (d.susp) { const u = S.users.find(x => x.uid === d.susp); u.status = 'suspended'; await DB.saveUser(u); toast(`${u.name} 일시 정지했습니다`); return; }
    if (d.restore) { const u = S.users.find(x => x.uid === d.restore); u.status = 'active'; await DB.saveUser(u); toast(`${u.name} 다시 사용하게 했습니다`); return; }
    if (d.edit) { editDrawer(d.edit); return; }
    if (d.saveperm) { const u = S.users.find(x => x.uid === d.saveperm); const p = S.ui.draft[u.uid]; u.perms = { stores: p.stores, move: !!p.move, count: !!p.count, sales: !!p.sales, approve: !!p.approve, settle: false }; await DB.saveUser(u); S.ui.drawer = null; toast('권한을 저장했습니다'); return; }
    if (t.id === 'confirmOk') { const f = S.ui.confirm; S.ui.drawer = null; S.ui.confirm = null; await f(); render(); return; }
    if (t.id === 'addStore') { alertBox('매장 추가는 실제 앱에서 저장됩니다. 미리보기에서는 4곳 고정입니다.'); return; }
    if (t.id === 'logout') { FB.signOut(); return; }
    if (t.id === 'meBtn') { S.ui.meF = { name: S.user.name || '', phone: S.user.phone || '' }; S.ui.drawer = meDrawer; render(); return; }
    if (t.id === 'meSave') { await saveMe(); return; }
    if (d.fk != null) { S.ui.fk = d.fk; render(); return; }
  };
  app.onchange = ev => { inChange = true; try { onChange(ev); } finally { inChange = false; } };
  const onChange = ev => {
    const t = ev.target, d = t.dataset;
    if (d.dsel) {
      const [id, part] = d.dsel.split(':'); const h = document.getElementById(id); if (!h) return;
      let [y, m, dd] = h.value.split('-').map(Number);
      if (part === 'y') y = +t.value; if (part === 'm') m = +t.value; if (part === 'd') dd = +t.value;
      dd = Math.min(dd, new Date(Date.UTC(y, m, 0)).getUTCDate());
      h.value = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      onChange({ target: h }); return;
    }
    if (t.id === 'cbPlan') { const r = ipPlan().find(x => x.id === t.value); if (r) S.ui.cb = { store: r.store, id: r.id, a: r.start, b: r.end }; render(); return; }
    if (t.id === 'cba' || t.id === 'cbb') { S.ui.cb[t.id === 'cba' ? 'a' : 'b'] = t.value; if (S.ui.cb.b < S.ui.cb.a) S.ui.cb.b = S.ui.cb.a; render(); return; }
    if (t.id === 'roleSel') { setUser(S.users.find(u => u.uid === t.value)); render(); return; }
    if (d.sc) { const on = t.checked; let s = S.stores.filter(x => x !== d.sc); if (on) s.push(d.sc); if (!s.length) s = [d.sc]; S.stores = STORES.map(x => x.id).filter(x => s.includes(x)); S.sumStores = null; S.ui.range = null; render(); return; }
    if (t.id === 'pip') { S.ui.ip = t.value; render(); return; }
    if (t.id === 'cip') { S.ui.countIp = t.value; render(); return; }
    if (t.id === 'eDate') { S.ui.entry.date = t.value; render(); return; }
    if (t.id === 'eStore') { S.ui.entry.store = t.value; render(); return; }
    if (t.id === 'eTo' && t.value.startsWith('__wh:')) { S.ui.entry.to = '__custom'; S.ui.entry.place = t.value.slice(5); render(); return; }
    if (t.id === 'eSrc') { S.ui.entry.src = t.value; render(); return; }
    if (t.id === 'eTo') { if (t.value === '__custom' && FIXED_PLACES.some(f => f.id === S.ui.entry.place)) S.ui.entry.place = ''; S.ui.entry.to = t.value; render(); if (t.value === '__custom') setTimeout(() => $('#eToText') && $('#eToText').focus(), 0); return; }
    if (['ibStore', 'ibDate', 'ibFrom', 'ibIp', 'ibTitle'].includes(t.id)) { S.ui.ibForm[{ ibStore: 'store', ibDate: 'date', ibFrom: 'from', ibIp: 'ip', ibTitle: 'title' }[t.id]] = t.value; if (t.id === 'ibDate') render(); return; }
    if (d.iba != null) { const ib = S.inbounds.find(x => x.id === S.ui.ib); ib.items[+d.iba].actual = t.value === '' ? null : Math.max(0, parseInt(t.value, 10)); if (DB.saveInbound) DB.saveInbound(ib); render(); return; }
    if (t.id === 'ePlace') { S.ui.entry.place = t.value; render(); return; }
    if (t.id === 'eFrom') { S.ui.entry.from = t.value; render(); return; }
    if (d.sdipc != null) { const o = S.ui.sdoc; o.ips = t.checked ? [...new Set([...o.ips, d.sdipc])] : o.ips.filter(x => x !== d.sdipc); render(); return; }
    if (t.id === 'sdDate') { S.ui.sdoc.date = t.value; if (S.ui.sdoc.from && S.ui.sdoc.from > t.value) S.ui.sdoc.from = t.value; render(); return; }
    if (t.id === 'sdFrom') { S.ui.sdoc.from = t.value > S.ui.sdoc.date ? S.ui.sdoc.date : t.value; render(); return; }
    if (t.id === 'sdIpq') { S.ui.sdoc.ipq = t.value; return; }
    if (t.id === 'machStore') { S.ui.machStore = t.value; S.ui.machPv = null; render(); return; }
    if (t.id === 'ipPast') { S.ui.ipPast = t.checked; render(); return; }
    if (['ipStore', 'ipName', 'ipStart', 'ipEnd', 'ipHost', 'ipNote'].includes(t.id)) { const k = { ipStore: 'store', ipName: 'ip', ipStart: 'start', ipEnd: 'end', ipHost: 'host', ipNote: 'note' }[t.id]; const f = S.ui.ipForm; f[k] = t.value; if (k === 'store') f.kind = STORE_KIND[t.value] || f.kind; if (k === 'start' && (!f.end || f.end < t.value)) f.end = t.value; render(); return; }
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
  const fq = $('#fq'); if (fq) fq.oninput = debounce(() => { S.ui.fq = fq.value; rerenderKeep('#fq'); });
  const fw = $('#fwho'); if (fw) fw.onchange = () => { S.ui.fwho = fw.value; render(); };
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
/* ───────── 화면 맞춤: 확대해서 보다가 다른 화면으로 가면 원래 크기로 ───────── */
function resetZoom() {
  const vv = window.visualViewport;
  if (!vv || vv.scale <= 1.01) return;          // 확대 안 했으면 그대로
  const m = document.querySelector('meta[name="viewport"]'); if (!m) return;
  const orig = m.getAttribute('content');
  m.setAttribute('content', 'width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover');
  setTimeout(() => m.setAttribute('content', orig), 400);   // 다시 손가락 확대 가능하게
}
// 손가락으로 확대해도 아래 메뉴는 화면 아래에 같은 크기로 붙어 있게
function pinTabbar() {
  const vv = window.visualViewport, bar = document.querySelector('.tabbar');
  if (bar && bar.offsetHeight) document.documentElement.style.setProperty('--tabh', bar.offsetHeight + 'px');
  if (!vv || !bar) return;
  if (vv.scale <= 1.01) { bar.style.transform = ''; return; }
  const layoutH = document.documentElement.clientHeight;
  const x = vv.offsetLeft, y = vv.offsetTop + vv.height - layoutH;
  bar.style.transformOrigin = 'left bottom';
  bar.style.transform = `translate(${x}px, ${y}px) scale(${1 / vv.scale})`;
}
let rsT; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(() => { if (S.user && !document.querySelector('input:focus,textarea:focus,select:focus')) render(); }, 250); });
if (window.visualViewport) { visualViewport.addEventListener('resize', pinTabbar); visualViewport.addEventListener('scroll', pinTabbar); }
// 대한민국 공휴일 (대체공휴일 포함) — 해마다 추가
const KR_HOLIDAYS = {
  '2026-01-01': '신정', '2026-02-16': '설날 연휴', '2026-02-17': '설날', '2026-02-18': '설날 연휴', '2026-03-01': '삼일절', '2026-03-02': '대체공휴일(삼일절)',
  '2026-05-01': '노동절', '2026-05-05': '어린이날', '2026-05-24': '부처님오신날', '2026-05-25': '대체공휴일(부처님오신날)', '2026-06-03': '지방선거일', '2026-06-06': '현충일',
  '2026-07-17': '제헌절', '2026-08-15': '광복절', '2026-08-17': '대체공휴일(광복절)', '2026-09-24': '추석 연휴', '2026-09-25': '추석', '2026-09-26': '추석 연휴',
  '2026-10-03': '개천절', '2026-10-05': '대체공휴일(개천절)', '2026-10-09': '한글날', '2026-12-25': '성탄절',
  '2027-01-01': '신정', '2027-02-06': '설날 연휴', '2027-02-07': '설날', '2027-02-08': '설날 연휴', '2027-02-09': '대체공휴일(설날)', '2027-03-01': '삼일절',
  '2027-05-01': '노동절', '2027-05-03': '대체공휴일(노동절)', '2027-05-05': '어린이날', '2027-05-13': '부처님오신날', '2027-06-06': '현충일',
  '2027-07-17': '제헌절', '2027-07-19': '대체공휴일(제헌절)', '2027-08-15': '광복절', '2027-08-16': '대체공휴일(광복절)', '2027-09-14': '추석 연휴', '2027-09-15': '추석', '2027-09-16': '추석 연휴',
  '2027-10-03': '개천절', '2027-10-04': '대체공휴일(개천절)', '2027-10-09': '한글날', '2027-10-11': '대체공휴일(한글날)', '2027-12-25': '성탄절', '2027-12-27': '대체공휴일(성탄절)',
};
// 왼쪽 아래 시계 — 쓰는 기기의 시스템 시간 (해외에서는 현지 시간 + 한국 시간 함께). 상자 너비에 맞춰 글씨 크기를 채움
(function kclock() {
  const el = document.createElement('div'); el.className = 'kclock'; el.setAttribute('aria-label', '현재 시간');
  el.innerHTML = '<div class="kr1"><span class="kd"></span><b class="kw"></b></div><div class="kh"></div><div class="kt"><span></span></div><div class="kr2"><span class="kz"></span><span class="kk"></span></div>';
  const q = c => el.querySelector(c), W = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'], p2 = n => String(n).padStart(2, '0');
  const kF = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  const kst2 = d => { const o = Object.fromEntries(kF.formatToParts(d).map(x => [x.type, x.value])); return `${o.month}/${o.day} ${o.hour}:${o.minute}`; };
  let zone = ''; try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').pop().replace(/_/g, ' '); } catch (e) { }
  const fit = () => {   // 컴퓨터: 시간 글씨가 상자 가로를 꽉 채우게
    const sp = q('.kt span'), box = q('.kt');
    if (!matchMedia('(min-width: 901px)').matches) { sp.style.fontSize = ''; return; }
    sp.style.fontSize = '40px'; const w = sp.getBoundingClientRect().width, tw = box.clientWidth;
    if (w && tw) sp.style.fontSize = Math.min(64, 40 * tw / w * 0.99).toFixed(1) + 'px';
  };
  const tick = () => {
    const d = new Date(), abroad = d.getTimezoneOffset() !== -540;
    q('.kd').textContent = `${d.getFullYear()}.${p2(d.getMonth() + 1)}.${p2(d.getDate())}`;
    q('.kw').textContent = W[d.getDay()];
    const hol = KR_HOLIDAYS[`${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`] || '';
    q('.kh').textContent = hol; el.classList.toggle('hol', !!hol); el.classList.toggle('sun', d.getDay() === 0); el.classList.toggle('sat', d.getDay() === 6 && !hol);
    q('.kt span').textContent = `${p2(d.getHours())}:${p2(d.getMinutes())}:${p2(d.getSeconds())}`;
    el.classList.toggle('abroad', abroad); q('.kt').dataset.k = abroad ? '한국 ' + kst2(d).split(' ')[1] : '';
    if (abroad) { q('.kz').textContent = (zone || '현지') + ' 시간'; q('.kk').textContent = '한국 ' + kst2(d); }
    if (!el._fit && el.offsetWidth) { el._fit = 1; fit(); }
  };
  const start = () => { document.body.appendChild(el); tick(); setInterval(tick, 1000); addEventListener('resize', fit); document.fonts && document.fonts.ready.then(fit); setTimeout(fit, 1500); };
  document.body ? start() : document.addEventListener('DOMContentLoaded', start);
})();
// 글자 크기·큰 모니터 배율이 걸려도 왼쪽 메뉴가 화면 높이 안에 들어오고 그 안에서 스크롤되게
function fitSide() {
  const side = document.querySelector('.side'); if (!side || !side.offsetParent) return;
  const zw = (parseFloat(document.documentElement.style.zoom) || 1) * (parseFloat(getComputedStyle(document.body).zoom) || 1);
  const top = document.querySelector('.top'); const th = top ? top.getBoundingClientRect().height / zw : 56;
  const kc = document.querySelector('.kclock'); const kh = kc && getComputedStyle(kc).display !== 'none' ? (kc.getBoundingClientRect().height + 20) / zw : 0;
  const st = Math.max(side.getBoundingClientRect().top / zw, th);   // 맨 위에선 미리보기·매장 줄 아래부터, 스크롤하면 머리글 바로 아래
  side.style.top = th + 'px'; side.style.height = Math.max(160, innerHeight / zw - st - kh) + 'px'; side.style.paddingBottom = '16px';
}
addEventListener('resize', fitSide); addEventListener('scroll', () => requestAnimationFrame(fitSide), { passive: true });
// 재고 문서 출력: IP 찾기 칸은 글자를 칠 때마다 바로 걸러 줌 (화면 전체를 다시 그리지 않음)
document.addEventListener('input', ev => {
  if (ev.target.id !== 'sdIpq' || !S.ui.sdoc) return;
  S.ui.sdoc.ipq = ev.target.value; const q = norm(ev.target.value);
  document.querySelectorAll('.iplist .ipck').forEach(l => { l.style.display = !q || norm(l.textContent).includes(q) ? '' : 'none'; });
});
function goTop() { resetZoom(); window.scrollTo(0, 0); }
const TEXT_SIZES = [['아주 작게', 0.82], ['작게', 0.9], ['보통', 1], ['크게', 1.12], ['아주 크게', 1.25]];
function applyTextSize(z) { S.ui.textZoom = z; document.documentElement.style.zoom = z === 1 ? '' : String(z); try { localStorage.setItem('smg-text-zoom', String(z)); } catch (e) { } }
try { const z = parseFloat(localStorage.getItem('smg-text-zoom') || '1'); if (z && z !== 1) applyTextSize(z); } catch (e) { }
function textSizeBox() {
  const z = S.ui.textZoom || 1, cur = (TEXT_SIZES.find(x => x[1] === z) || TEXT_SIZES[2])[0];
  return `<div class="tzbox"><button class="btn tzbtn" data-tzt="1" aria-expanded="${!!S.ui.tzOpen}"><span>글자 크기</span><b>${cur}</b><span class="car${S.ui.tzOpen ? ' up' : ''}"></span></button>
    ${S.ui.tzOpen ? `<div class="tzlist" role="listbox" aria-label="글자 크기">${TEXT_SIZES.map(([t, v]) => `<button role="option" aria-selected="${z === v}" class="${z === v ? 'on' : ''}" data-tz="${v}" style="font-size:${Math.round(14 * v)}px">${t}${z === v ? ' ✓' : ''}</button>`).join('')}</div>` : ''}</div>`;
}
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

