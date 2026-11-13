/* 온인터내셔널 앱 — 앱 본체 (미리보기 모드와 Firebase 모드가 같은 화면을 씁니다) */
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
  { id: 'gukdae', name: '국대출판물류', type: 'warehouse' },   // SMG 홀딩스 물류창고 (대표 지시 11/2)
];
// 온인터내셔널 사업부/채널 (본부장 지시 2026-11-04). 오프라인 매장은 토스포스 매출(S.sales)을 그대로 씀, 나머지는 S.biz[id][YYYY-MM-DD] = { s: 매출, p: 건수, q: 수량 }
const BIZ = [
  { id: 'offline', name: '오프라인 매장', sub: '수원 SMG STORE · 토스포스 매출', stores: ['suwon'] },
  { id: 'onkihote', name: '온키호테', sub: 'SMG 크리에이티브 온라인쇼핑몰 운영대행 · 네이버 스마트스토어(marlinshop) · 일본 라이선스 승인 후 상품 등록' },
  { id: 'kuji', name: '쿠지사업 운영', sub: 'SMG 크리에이티브와 함께 · 수원 SMG STORE에서 토스포스로 시작' },
  { id: 'blog', name: 'SMG STORE 수원 블로그 운영', sub: '유온컴퍼니 대행 · 월 대행료/수익 직접 입력', monthly: true },
];
const BIZ_SOON = { name: '콜라보카페', sub: '오픈 예정 (2027.06 수원 AK플라자, 토스포스)' };   // 4개 사업부에 넣지 않음
const COMPANIES = ['SMG 홀딩스', 'SMG 크리에이티브', '온인터내셔널', 'SMG STORE_수원', 'BOX CAFE', 'SMG MUSEUM_홍대', 'CAFE 오마케', '리밋션_홍대', '국대출판물류', '기타(직접 입력)'];
const POSITIONS = ['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '대리', '수석팀장', '팀장', '부팀장', '매니저', '사원'];
const SALES_REC = new Set(['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '대리', '수석팀장', '팀장', '부팀장']);   // 부팀장 이상 (대표 지시 2026-10-30)     // 팀장 이상 → 매출 보기 추천
const COUNT_REC = new Set(['대표', '전무', '상무', '본부장', '편집장', '부장', '차장', '과장', '대리', '수석팀장', '팀장', '부팀장', '매니저']); // 매장 책임자 → 실재고 추천
const WORK_PLACES = STORES.map(s => s.name).concat(['본사', '창고']);
const TYPES = [
  { id: '입고', sign: +1, d: '상품이 매장에 들어옴' },
  { id: '판매', sign: -1, d: 'POS 밖에서 판매한 수량 (POS 판매는 매출 파일로 자동 차감)' },
  { id: '매장 이동', sign: -1, d: '다른 매장이나 국대출판물류로 보냄 — 받는 쪽이 받기 확인을 하면 그쪽 재고에 더해짐. 행사장·팝업 같은 외부 장소로도 보낼 수 있음', to: true },
  { id: '창고 보관', sign: -1, d: '판매가 끝난 상품을 매장 안·근처 보관 창고로 옮김 (국대출판물류로 보낼 땐 ‘매장 이동’)' },
  { id: '창고에서 가져옴', sign: +1, d: '보관 창고에 두었던 상품을 다시 매장으로 (국대출판물류에서 받을 땐 ‘이동’ 화면에서 받기 확인)' },
  { id: '외부에서 돌아옴', sign: +1, d: '행사장·팝업·거래처 같은 외부 장소에 보냈던 상품이 매장으로 돌아옴 (국대출판물류에서 오는 상품은 ‘이동’ 화면에서 받기 확인)', from: true },
  { id: '타 업체 이동', sign: -1, d: '다른 회사로 보냄', partner: true },
  { id: '반품', sign: -1, d: '공급처로 돌려보냄', partner: true },
  { id: '폐기', sign: -1, d: '파손·불량으로 폐기' },
];
const COUNT_TYPE = '실사 조정';
const LOW_QTY = 100, LOW_DAYS = 14;   // 품절 임박: 재고 LOW_QTY개 이하 + 지금 판매 속도면 LOW_DAYS일 안에 품절 (대표 지시 11/3: 100개)
const PLACE_KINDS = ['행사장', '팝업', '창고', '거래처', '기타'];   // 물류창고(국대출판물류)는 재고 위치로 따로 관리
// 늘 쓰는 고정 장소 (대표 지시 2026-11-01: SMG 홀딩스가 계약해 쓰는 물류창고). 보낸·받은 수량은 places/{id}.q 에 쌓임
const FIXED_PLACES = [];   // 국대출판물류는 11/2부터 6번째 재고 위치(STORES 'gukdae', 물류창고)로 관리 — 예전 places/P-GUKDAE 자료가 있으면 일반 외부 장소로 계속 보임
const allPlaces = () => FIXED_PLACES.map(f => ({ ...f, q: ((S.places || []).find(p => p.id === f.id) || {}).q || {} })).concat((S.places || []).filter(p => !FIXED_PLACES.some(f => f.id === p.id)));
const PERM_DEF = [
  { k: 'move', t: '입출고 등록', s: '입고·이동·창고·폐기 등록, 파일·링크로 올리기' },
  { k: 'count', t: '실재고 입력·수정', s: '매장 책임자. 실사 수량 반영' },
  { k: 'sales', t: '매출 보기', s: '부팀장 이상. 매출 화면, 토스포스 파일 올리기' },
  { k: 'approve', t: '사용자 승인', s: '가입 승인, 권한 변경, 퇴사 처리' },
];

const DEFAULT_ORDER = STORES.map(s => s.id);
const APP_VERSION = '2026-11-13 17:10';   // 앱 화면을 마지막으로 고친 시각 (한국 시간)
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
// 날짜 표시는 모두 여기서 (대표 지시 11/3): 2026.10.15(목) · 범위는 fr(a,b) = '2026.10.15(목) ~ 2026.11.24(화)'
const fd = d => d ? `${d.slice(0, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}(${wd(d.slice(0, 10))})` : '';
const fr = (a, b) => `${fd(a)} ~ ${fd(b)}`;
const fm = ym => `${ym.slice(0, 4)}.${ym.slice(5, 7)}`;   // 2026.01
const mdc = d => `${d.slice(5, 7)}.${d.slice(8, 10)}`;     // 그래프 축 전용 (제목에 연도 표시)
const md = fd;
// '2026-10-30 09:12' 같은 글자 → '2026.10.30(금) 09:12'
const fdt = s => /^\d{4}-\d{2}-\d{2}/.test(s || '') ? (/T/.test(s) ? kst(s) : fd(s.slice(0, 10)) + s.slice(10)) : (s || '');
// 'YYYY-MM-DDTHH:mm…' (UTC ISO 또는 날짜만) → '10/30 02:25' 한국 시간
const kst = iso => { if (!iso) return ''; if (/^\d{4}-\d{2}-\d{2}(T00:00)?$/.test(iso)) return md(iso.slice(0, 10)); const t = new Date(Date.parse(iso) + 9 * 3600e3).toISOString(); return `${md(t.slice(0, 10))} ${t.slice(11, 16)}`; };
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 864e5);
const norm = s => String(s || '').toLowerCase().replace(/^에바30주년팝업_/, '').replace(/[\s\[\]()!_\-.,~·&]/g, '');
const storeName = id => (STORES.find(s => s.id === id) || {}).name || id;
const storeColor = id => `var(--s-${id})`;
const SHORT = { suwon: '수원', boxcafe: 'BOX CAFE', museum: 'MUSEUM 홍대', omake: 'CAFE 오마케', limission: '리밋션 홍대', gukdae: '국대출판물류' };   // 오마케는 온라인쇼핑몰과 헷갈리지 않게 항상 'CAFE 오마케' (대표 지시 11/2)
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
  settle: [], popups: [], schedules: [], users: [], asof: '',
  places: [],
  inbounds: [],            // 입고 예정: {id, store, date, title, ip, from, items:[{key,pid,name,code,plan,price,actual}], extra:[], status, ...}              // 외부 장소 (행사장·팝업 등): {id, name, kind, start, end, addr, person, memo, q:{pid:qty}}
  zipPw: { suwon: '0000' },
  ui: { q: '', f: 'all', ip: '', salesUnit: 'day', range: null, recType: '', recQ: '', counts: {}, countQ: '', countIp: '', entry: null, imp: null, adminTab: 'pending', showApply: false, posPreview: null, storeMenu: false },
};

// 새로고침 전에 보던 화면·사업부·매장 되살리기
try { const n = JSON.parse(localStorage.getItem('smg-nav') || 'null'); if (n && n.view) { S.view = n.view; ['adminTab', 'ib', 'ipF', 'bizF'].forEach(k => { if (n[k] != null) S.ui[k] = n[k]; }); if (Array.isArray(n.stores) && n.stores.length) S.stores = n.stores; const p = n.salesPeriod; if (p && p.preset === 'custom' && /^\d{4}-\d{2}-\d{2}$/.test(p.a || '') && /^\d{4}-\d{2}-\d{2}$/.test(p.b || '')) S.ui.salesPeriod = { preset: 'custom', a: p.a, b: p.b }; else if (p && p.preset && p.preset !== 'custom') S.ui.salesPeriod = { preset: String(p.preset) }; } } catch (e) { }
/* ───────── 데이터 계층 ───────── */
const DemoBackend = {
  async load() {
    const r = await fetch('demo-data.json'); const d = await r.json();
    S.asof = d.asof;
    S.products = d.products;
    S.stock = { suwon: d.stock.suwon, boxcafe: {}, museum: {}, omake: {}, limission: {}, gukdae: {} };
    S.moves = d.moves;
    S.incoming = [];
    if (d.incoming && d.incoming.length) S.inbounds.push({ id: 'IB-261112-AOT', store: 'suwon', date: d.incoming[0].date, title: '진격의 거인 팝업 입고 예정 (SMG 상품리스트)', ip: '진격의 거인', from: 'SMG 홀딩스', status: 'planned', by: '', at: '2026-10-29',
      items: d.incoming.map(x => { const p = d.products.find(q => q.id === x.pid) || {}; return { key: 'p:' + x.pid, pid: x.pid, name: p.name || x.pid, code: p.barcode || p.sku || x.pid, plan: x.qty, price: p.price || null, actual: null }; }), extra: [] });
    S.sales = { suwon: d.sales.suwon, boxcafe: {}, museum: {}, omake: {}, limission: {}, gukdae: {} };
    S.settle = d.settle; S.settleRules = d.settleRules || null; S.popups = []; S.schedules = S.schedules || [];
    S.users = demoUsers();
  },
  async saveMoves(list) { /* 미리보기: 화면 안에서만 반영 */ return true; },
  async saveSalesDay() { return true; },
  async saveMachMonth() { return true; },
  async saveUser() { return true; },
  async replaceSchedules() { return true; },
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
  S.P = {}; S.byCode = {}; S.byName = {}; S.byLoose = {};
  for (const p of S.products) {
    S.P[p.id] = p;
    if (p.barcode) (S.byCode[p.barcode] ||= []).push(p);
    if (p.sku) (S.byCode[p.sku.toLowerCase()] ||= []).push(p);
    (S.byName[norm(p.name)] ||= []).push(p);
    for (const src of [p.name, p.sku]) { const k = looseKey(src); if (k) (S.byLoose[k] ||= []).push(p); }
  }
}
function looseKey(s) {
  return String(s || '').toLowerCase().replace(/aot[\s_\-]*26[\s_\-]*/g, '').replace(/[\s_\-\[\]()（）!.,~·&]/g, '');
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
const NAV = [   // 관련 메뉴끼리 묶음(g): 요약 → 매출 분석 → 재고·입고 → 기록 → 관리
  { id: 'home', t: '홈', i: 'home', g: 1, show: () => true },
  { id: 'ipnow', t: 'IP 현황', g: 1, show: () => true },
  { id: 'sales', t: '매출', grp: '매출 분석', g: 2, show: () => can('sales') },
  { id: 'biz', t: '사업부 매출', g: 2, show: () => can('sales') },
  { id: 'collab', t: '콜라보 분석', g: 2, show: () => can('sales') },
  { id: 'settle', t: '정산', g: 2, show: () => canSettle() },
  { id: 'popup', t: '팝업 비용', g: 2, show: () => canSettle() || can('approve') },
  { id: 'sched', t: '월간 일정', g: 2, show: () => isOwner() },
  { id: 'products', t: '상품·재고', i: 'box', grp: '재고', g: 3, show: () => true },
  { id: 'entry', t: '입출고 등록', i: 'plus', g: 3, show: () => can('move') },
  { id: 'inbound', t: '입고 확인', g: 3, show: () => can('move') },
  { id: 'transfer', t: '상품 이동', g: 3, show: () => can('move') },
  { id: 'count', t: '실사', i: 'check', g: 3, show: () => can('count') },
  { id: 'records', t: '기록', g: 4, show: () => !limited() },
  { id: 'files', t: '파일 이력', g: 4, show: () => !limited() && (can('approve') || can('sales') || can('move')) },
  { id: 'admin', t: '관리', g: 5, show: () => can('approve') || isOwner() },
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
  if (S.view === 'sales') { try { rememberSalesPeriod(resolveSalesPeriod()); } catch (e) { } }
  try { localStorage.setItem('smg-nav', JSON.stringify({ ...cur, bizF: S.ui.bizF, stores: S.stores, salesPeriod: S.ui.salesPeriod || null })); } catch (e) { }   // 새로고침해도 보던 화면 그대로. 매출 빠른 기간은 이름만 저장(오늘 기준으로 다시 계산), 직접 고른 날짜만 그대로 둠
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
  if (S.view !== 'more' && S.view !== 'mclose' && !nav.find(n => n.id === S.view)) S.view = 'home';
  document.body.classList.toggle('mclose-on', S.view === 'mclose');
  document.body.classList.toggle('sched-on', S.view === 'sched');
  trackNav();
  const pendingN = S.users.filter(u => u.status === 'pending').length;
  const sv = S.view === 'biz' && S.ui.bizF && S.ui.bizF !== 'all' && S.ui.bizF !== 'offline' ? (BIZ.find(b => b.id === S.ui.bizF) || {}).name || '사업부' : S.stores.length === 1 ? (S.stores[0] === 'suwon' ? '오프라인 매장 · 수원 SMG STORE' : storeName(S.stores[0])) : `${S.stores.length}개 매장 함께 보기`;
  app.innerHTML = `
  <header class="top">
    <button class="logo-btn" id="logoHome" aria-label="첫 화면으로"><img src="oninter_logo.png" alt="" width="40" height="40"><span class="wm">온인터내셔널</span></button>
    <button class="store-btn" id="storeBtn" aria-haspopup="true" aria-expanded="${S.ui.storeMenu}">
      <span class="nm">${esc(sv)}</span><span class="car"></span>
    </button>
    ${noticeBar()}
    ${headTools()}
    <div class="who"><button class="me-btn" id="meBtn" title="내 정보" aria-label="내 정보 · ${esc(S.user.name)}"><span class="me1"><b>${esc(S.user.name)}</b> ${esc(S.user.position || '')}</span><span class="me2">${esc(meLine(S.user))}</span></button>${S.mode === 'demo' ? '' : '<button class="btn sm" id="logout">로그아웃</button>'}</div>
  </header>
  ${S.mode === 'demo' ? `<div class="demobar"><span class="demo-tag">미리보기</span><label for="roleSel">권한별로 보기</label><select id="roleSel">${DEMO_ROLES.map(r => `<option value="${r.uid}" ${S.user.uid === r.uid ? 'selected' : ''}>${esc(r.label)}</option>`).join('')}</select><span class="muted hide-s">수원 실제 자료 · 저장한 내용은 새로고침하면 처음 상태로 돌아갑니다</span></div>` : ''}
  ${S.stores.length > 1 ? `<div class="storebar" aria-label="보고 있는 매장"><span class="lb">보고 있는 매장</span>${S.stores.map(id => `<button class="schip" data-sg="${id}" title="${esc(storeName(id))}만 보기"><span class="dot" style="background:${storeColor(id)}"></span>${esc(storeName(id))}</button>`).join('')}<button class="schip more" id="storeBtn2">바꾸기</button></div>` : ''}
  ${S.ui.storeMenu ? storeMenu() : ''}
  <div class="shell">
    <nav class="side" aria-label="메뉴">
      ${nav.map(n => `${n.grp ? `<div class="grp">${n.grp}</div>` : ''}<button data-nav="${n.id}" class="${S.view === n.id ? 'on' : ''}">${esc(n.t)}${n.id === 'admin' && pendingN && can('approve') ? `<span class="cnt">${pendingN}</span>` : ''}</button>`).join('')}
      <div class="grp" style="margin-top:16px">앱 업데이트 ${fd(APP_VERSION.slice(0, 10))} ${APP_VERSION.slice(11)}</div>
    </nav>
    <main><div class="page" id="page">${pageView()}</div></main>
  </div>
  <nav class="tabbar" aria-label="아래 메뉴">${tabbar(nav)}</nav>
  ${S.ui.drawer ? `<div class="ov" id="ov"><div class="dr${S.ui.drawer.wide ? ' wide' : ''}" role="dialog" aria-modal="true">${S.ui.drawer()}</div></div>` : ''}
  ${S.ui.toast ? `<div class="toast" role="status">${esc(S.ui.toast)}</div>` : ''}`;
  { const tb = document.querySelector('.tabbar'), z = S.ui.textZoom || 1; if (tb) tb.style.zoom = z === 1 ? '' : String(1 / z); }   // 글자 크기를 바꿔도 아래 메뉴는 화면 폭에 딱 맞게
  bind(); pinTabbar(); fitTabLabels(); markDropZones();
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
const TAB = { home: ['홈', 'home'], ipnow: ['IP현황', 'star'], products: ['상품', 'box'], entry: ['입출고', 'plus'], count: ['실사', 'check'], inbound: ['입고확인', 'truck'], transfer: ['상품이동', 'swap'], records: ['기록', 'list'], files: ['파일', 'list'], sales: ['매출', 'chart'], biz: ['사업부', 'chart'], collab: ['콜라보', 'star'], settle: ['정산', 'won'], popup: ['팝업비용', 'won'], sched: ['월간일정', 'star'], admin: ['관리', 'user'], more: ['설정', 'gear'] };
const TAB_MAIN = ['home', 'products', 'entry', 'transfer', 'sales', 'count'];
// 아래 메뉴 글씨가 칸 밖으로 나가지 않게: 넘치면 그 칸만 글씨를 줄임 (최소 8px)
function fitTabLabels() {
  document.querySelectorAll('.tabbar button span').forEach(s => { s.style.fontSize = ''; let f = parseFloat(getComputedStyle(s).fontSize) || 11; while (s.scrollWidth > s.clientWidth + 0.5 && f > 8) { f -= 0.5; s.style.fontSize = f + 'px'; } });
}
addEventListener('resize', () => { try { fitTabLabels(); } catch (e) { } });
function tabbar(nav) {
  const pendingN = can('approve') ? S.users.filter(u => u.status === 'pending').length : 0;
  // 대표 지시 11/3: 숨김 메뉴 없이 모든 메뉴를 아래에 다 보이게 (최대 두 줄)
  // 11/4: 관련 메뉴끼리 붙여서, 묶음 사이에 옅은 구분선. 한 묶음이 두 줄로 갈라지지 않게 줄을 나눔
  const items = [...nav.map(n => ({ id: n.id, g: n.g || 9 })), { id: 'more', g: 5 }];
  const groups = []; items.forEach(x => { const l = groups[groups.length - 1]; if (l && l[0].g === x.g) l.push(x); else groups.push([x]); });
  let rows = [items];
  if (items.length > 6) {   // 두 줄: 줄 길이 차이가 가장 작은 묶음 경계에서 나눔
    let best = null, acc = 0;
    for (let k = 1; k < groups.length; k++) { acc += groups[k - 1].length; const d = Math.abs(items.length - 2 * acc); if (!best || d < best.d) best = { d, n: acc }; }
    rows = best ? [items.slice(0, best.n), items.slice(best.n)] : [items.slice(0, Math.ceil(items.length / 2)), items.slice(Math.ceil(items.length / 2))];
  }
  if (rows.length > 1) { const k = rows[1].findIndex(x => x.id === 'admin'); if (k >= 0) rows[0].push(...rows[1].splice(k, 1)); }   // 11/4 대표: 관리는 윗줄 끝, 설정 바로 위
  const btn = (x, i, row) => { const [t, ic2] = x.id === 'more' ? ['설정', 'more'] : (TAB[x.id] || [x.id, 'more']);
    return `<button data-nav="${x.id}" class="${S.view === x.id ? 'on' : ''}${i && (!row[i - 1] || row[i - 1].g !== x.g) ? ' gs' : ''}">${ic(ic2, 18)}<span>${t}</span>${x.id === 'admin' && pendingN ? `<b class="tcnt">${pendingN}</b>` : ''}</button>`; };
  // 11/4 대표: 간격 맞추기 → 두 줄 모두 같은 칸 너비. 짧은 줄은 관리 앞에 빈칸을 둬서 관리가 설정 바로 위에 오게
  const cols = Math.max(...rows.map(r => r.length));
  rows.forEach(r => { while (r.length < cols) { const k = r.findIndex(x => x && x.id === 'admin'); r.splice(k >= 0 ? k : r.length, 0, null); } });
  const cell = (x, i, row) => x ? btn(x, i, row) : '<span class="tgap" aria-hidden="true"></span>';
  return `<div class="tabgrid ${rows.length > 1 ? 'two' : ''}" style="--tcols:${cols}">` + rows.map(r => `<div class="trow">${r.map(cell).join('')}</div>`).join('') + '</div>';
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
    <h4 class="bizname">온인터내셔널 사업부</h4>
    ${BIZ.map(b => `<div class="srow"><button class="go" data-bizgo="${b.id}"><span class="dot" style="background:var(--green)"></span><span><b class="bizname">${esc(b.name)}</b>${b.id === 'offline' ? ' <span class="muted">(수원 SMG STORE)</span>' : ''}</span></button></div>`).join('')}
    <h4 style="margin-top:12px">물류·이동용 매장 <span class="muted">(입출고·매장이동 · 체크하면 함께 보기)</span></h4>
    ${STORES.filter(s => s.id !== 'suwon').map(s => {
      const ok = mine.includes(s.id);
      return `<div class="srow"${ok ? '' : ' style="opacity:.45"'}>
        <input type="checkbox" data-sc="${s.id}" ${S.stores.includes(s.id) ? 'checked' : ''} ${ok ? '' : 'disabled'} aria-label="${esc(s.name)} 함께 보기">
        <button class="go" data-sg="${s.id}" ${ok ? '' : 'disabled'}><span class="dot" style="background:${storeColor(s.id)}"></span>${esc(s.name)}</button>
        ${ok ? '' : '<span class="pill p-mute">권한 없음</span>'}</div>`;
    }).join('')}
    <div class="foot"><button class="btn sm" id="smOrder">순서 바꾸기</button><span style="flex:1"></span><button class="btn sm" id="smAll">권한 있는 매장 모두</button><button class="btn sm pri" id="smClose">닫기</button></div></div>`;
}
/* ───────── 월간 일정 (공식 팝업·카페·전시. 개인 일정은 넣지 않음) ───────── */
const SCHED_TYPES = { popup: '팝업', cafe: '카페', exhibit: '전시' };
const SCHED_VENUE_COLOR = { '수원': '#19776A', '홍대 리밋션': '#2F6FDB', '홍대 뮤지엄': '#7B4B9A', '홍대 카페': '#C48A2A', '신촌': '#C45B4A', '오마케': '#3C8F7A', '홍대 2층 신규': '#5C6BC0', '기타 외부': '#6B7280' };
function schedVenueKey(v) {
  const s = String(v || '');
  if (/수원/.test(s)) return '수원';
  if (/리밋션|LIMITION/i.test(s)) return '홍대 리밋션';
  if (/뮤지엄|오뮤지엄|MUSEUM/i.test(s)) return '홍대 뮤지엄';
  if (/오마케/.test(s)) return '오마케';
  if (/신촌/.test(s)) return '신촌';
  if (/BOX|홍대카페|홍대 카페/.test(s)) return '홍대 카페';
  const t = s.replace(/\([^)]*\)/g, '').trim();
  return t || '기타';
}
function schedTypeOf(venue, title, section) {
  const t = `${venue} ${title} ${section}`;
  if (/전시|뮤지엄|오뮤지엄/.test(t)) return 'exhibit';
  if (/카페|BOX|오마케/.test(t)) return 'cafe';
  return 'popup';
}
function schedColor(key) {
  if (SCHED_VENUE_COLOR[key]) return SCHED_VENUE_COLOR[key];
  const pal = ['#19776A', '#2F6FDB', '#7B4B9A', '#C48A2A', '#C45B4A', '#3C8F7A', '#8A5A2B', '#3E6B8A'];
  let h = 0; for (const ch of key) h = (h + ch.charCodeAt(0)) % pal.length;
  return pal[h];
}
function schedId(e) {
  const s = [e.source, e.venueKey, e.title, e.start, e.end].join('|');
  let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return 's' + h.toString(36);
}
function schedParseYmd(tok, baseYear) {
  const s = String(tok || '');
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { d: `${m[1]}-${m[2]}-${m[3]}` };
  m = s.match(/(\d{4})-(\d{2})(?!\d)/);
  if (m) return { d: `${m[1]}-${m[2]}-01`, partial: 'month' };
  m = s.match(/(?:^|[^\d])(\d{2})-(\d{2})(?!\d)/);
  if (m && baseYear) {
    let y = baseYear, mo = +m[1];
    return { d: `${y}-${m[1]}-${m[2]}`, rel: true, mo };
  }
  return null;
}
function parseSchedText(text) {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  let section = '', source = 'x';
  const rows = [], skipped = [];
  lines.forEach((raw, idx) => {
    const line = raw.trim();
    if (!line || line.startsWith('<!--')) return;
    if (line.startsWith('#')) {
      const level = (line.match(/^#+/) || ['#'])[0].length;
      section = line.replace(/^#+\s*/, '');
      if (level <= 2) {
        if (/^2[\.\s]|내부 엑셀|내부 예정/.test(section)) source = 'plan';
        else if (/^1[\.\s]|공식\s*X|공식/.test(section)) source = 'x';
      }
      return;
    }
    if (!line.startsWith('-')) return;
    const body = line.replace(/^-\s*/, '');
    const bits = body.split('|').map(s => s.trim());
    if (bits.length < 3) { skipped.push({ n: idx + 1, line, why: '날짜 | 장소 | 행사 이름 으로 나누지 않았습니다' }); return; }
    const datePart = bits[0];
    const venue = bits[1] || '';
    const title = bits[2] || '';
    let rest = bits.slice(3).filter(Boolean);
    let link = '';
    if (rest.length && /^https?:\/\//i.test(rest[rest.length - 1])) link = rest.pop();
    const note = rest.filter(s => s !== '내부 엑셀').join(' · ');
    if (!title) { skipped.push({ n: idx + 1, line, why: '행사 이름이 없습니다' }); return; }
    let src = source;
    if (/\[내부\]|내부 엑셀|내부 예정/.test(body)) src = 'plan';
    if (/\[공식\]/.test(body)) src = 'x';
    const timeM = datePart.match(/(\d{1,2}:\d{2})/);
    const undated = /미정/.test(datePart.split('~')[0] || '') && !/\d{4}-\d{2}/.test(datePart);
    if (undated) {
      rows.push({
        on: true, hold: false, source: src, venue, venueKey: schedVenueKey(venue), type: schedTypeOf(venue, title, section),
        title, start: '', end: '', time: timeM ? timeM[1] : '', note, link, section, warn: '날짜가 미정이라 달력 막대 대신 날짜 미정 목록에 둡니다', open: true, undated: true, line,
      });
      return;
    }
    const halves = datePart.split('~');
    const a = schedParseYmd(halves[0]);
    if (!a || !a.d) { skipped.push({ n: idx + 1, line, why: '시작 날짜를 읽지 못했습니다' }); return; }
    let start = a.d, end = a.d, warn = '', open = false;
    if (a.partial) warn = '시작 일이 없어 그달 1일로 봤습니다';
    if (halves[1] != null) {
      if (/미정|미기재|\?|없음/.test(halves[1]) && !/\d{4}-\d{2}-\d{2}/.test(halves[1])) {
        open = true;
        end = a.partial ? monthEnd(start.slice(0, 7)) : start;
        warn = (warn ? warn + ' · ' : '') + (a.partial ? '종료 일이 없어 그달 전체로 표시합니다' : '종료일이 없어 시작일만 표시합니다');
      } else {
        const b = schedParseYmd(halves[1], +start.slice(0, 4));
        if (!b) { warn = (warn ? warn + ' · ' : '') + '종료 날짜를 읽지 못해 하루로 봤습니다'; }
        else {
          end = b.d;
          if (b.rel && end.slice(5, 7) < start.slice(5, 7)) end = (+start.slice(0, 4) + 1) + end.slice(4);
          if (b.partial) { end = monthEnd(end.slice(0, 7)); warn = (warn ? warn + ' · ' : '') + '종료 일이 없어 그달 말로 봤습니다'; }
        }
      }
    } else if (a.partial) end = monthEnd(start.slice(0, 7));
    if (end < start) { const t = start; start = end; end = t; }
    const hold = /대안|기타 메모/.test(section);
    rows.push({
      on: !hold, hold, source: src, venue, venueKey: schedVenueKey(venue), type: schedTypeOf(venue, title, section),
      title, start, end, time: timeM ? timeM[1] : '', note, link, section, warn, open, undated: false, line,
    });
  });
  return { rows, skipped };
}
function parseSchedJson(text) {
  const data = JSON.parse(text);
  const list = Array.isArray(data) ? data : (data.entries || data.items || []);
  if (!Array.isArray(list)) throw new Error('entries 배열이 있는 JSON이 아닙니다');
  const rows = [], skipped = [];
  list.forEach((r, i) => {
    const start = String(r.start || r.date || '').slice(0, 10);
    const end = String(r.end || start).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) { skipped.push({ n: i + 1, line: JSON.stringify(r).slice(0, 80), why: 'start(YYYY-MM-DD)가 없습니다' }); return; }
    const venue = String(r.venue || r.place || '');
    const title = String(r.title || r.name || '');
    if (!venue || !title) { skipped.push({ n: i + 1, line: title || venue, why: '장소 또는 행사 이름이 없습니다' }); return; }
    const source = r.source === 'plan' || r.source === '내부' || r.source === '내부 예정' ? 'plan' : 'x';
    const type = r.type === 'cafe' || r.type === 'exhibit' || r.type === 'popup' ? r.type : schedTypeOf(venue, title, '');
    rows.push({ on: true, hold: false, source, venue, venueKey: schedVenueKey(venue), type, title, start, end: /^\d{4}-\d{2}-\d{2}$/.test(end) ? end : start, time: r.time || '', note: r.note || '', section: '', warn: '', open: false, line: '' });
  });
  return { rows, skipped };
}
function schedDocs(rows) {
  return rows.filter(r => r.on).map(r => {
    const e = { source: r.source, venue: r.venue, venueKey: r.venueKey, type: r.type, title: r.title, start: r.start, end: r.end, time: r.time || '', note: r.note || '', link: r.link || '', open: !!r.open, undated: !!r.undated };
    e.id = schedId(e);
    return e;
  });
}
function schedInMonth(list, ym) {
  const a = ym + '-01', b = monthEnd(ym);
  return (list || []).filter(e => e.start && e.end && e.end >= a && e.start <= b);
}
function schedWeeks(ym) {
  const [y, m] = ym.split('-').map(Number);
  const pad = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
  const dim = +monthEnd(ym).slice(8);
  const cells = [];
  for (let i = 0; i < pad; i++) cells.push(null);
  for (let d = 1; d <= dim; d++) cells.push(`${ym}-${String(d).padStart(2, '0')}`);
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
function schedLanes(week, events) {
  const items = [];
  events.forEach(ev => {
    let a = -1, b = -1;
    week.forEach((d, i) => { if (d && d >= ev.start && d <= ev.end) { if (a < 0) a = i; b = i; } });
    if (a >= 0) items.push({ ev, a, b });
  });
  items.sort((x, y) => x.a - y.a || (y.b - y.a) - (x.b - x.a));
  const laneEnd = [];
  items.forEach(it => {
    let lane = laneEnd.findIndex(end => end < it.a);
    if (lane < 0) { lane = laneEnd.length; laneEnd.push(it.b); } else laneEnd[lane] = it.b;
    it.lane = lane;
  });
  return { items, n: laneEnd.length };
}
function schedYm() { const cap = today().slice(0, 7); return S.ui.schedYm || cap; }
const SCHED_SUB = /사전\s*예약|예약제|예약|특전|할인|후기|(?:^|\s)MD(?:\s|$)|오픈|이용/;
const SCHED_STOP = new Set(['콜라보', '카페', '팝업', '스토어', '팝업스토어', '전시', '기념', '방송', '애니메이션', '주년', '시즌', '주말', '평일', '한정', '당초', '조기', '종료', '영업', 'the', 'final', 'season', 'pop', 'up', 'store', 'new', 'coming', 'soon', 'popup', 'light', 'shadow', 'cafe', 'box', 'smg', 'tv']);
function schedTokens(title) {
  const raw = String(title || '').replace(/\([^)]*\)/g, ' ').replace(/사전\s*예약/g, ' ');
  const parts = raw.split(/[^\p{Script=Hangul}A-Za-z0-9]+/u).filter(Boolean);
  const out = [];
  parts.forEach(p => {
    const t = p.toLowerCase();
    if (t.length < 2 || SCHED_STOP.has(t) || /^\d+$/.test(t)) return;
    out.push(t);
  });
  return out;
}
function schedOverlap(a, b) { return !!(a.start && a.end && b.start && b.end && a.start <= b.end && b.start <= a.end); }
function schedCovers(e, day) { return !!(e && e.start && e.end && e.start <= day && e.end >= day); }
function schedGroups(events) {
  const items = (events || []).filter(e => e && !e.undated && e.start && e.end);
  const isSub = e => SCHED_SUB.test(e.title || '');
  const groups = items.filter(e => !isSub(e)).map(main => ({ main, kids: [] }));
  items.filter(isSub).forEach(sub => {
    const tok = new Set(schedTokens(sub.title));
    let best = null, score = 0;
    groups.forEach(g => {
      if (g.main.venueKey !== sub.venueKey || !schedOverlap(g.main, sub)) return;
      const shared = schedTokens(g.main.title).filter(t => tok.has(t) && t.length >= 3);
      const s = shared.reduce((n, t) => n + t.length, 0);
      if (shared.length && s > score) { score = s; best = g; }
    });
    if (best) best.kids.push(sub);
    else groups.push({ main: sub, kids: [] });
  });
  groups.forEach(g => g.kids.sort((a, b) => (a.start || '').localeCompare(b.start || '') || a.title.localeCompare(b.title, 'ko')));
  return groups;
}
function schedOnDay(groups, day) {
  return groups.filter(g => schedCovers(g.main, day) || g.kids.some(k => schedCovers(k, day)));
}
function schedView() {
  if (!isOwner()) return `${head('월간 일정', '대표만')}<div class="card"><div class="empty">대표 계정만 공식 일정을 보고 올립니다.</div></div>`;
  const ym = schedYm();
  const [y, m] = ym.split('-').map(Number);
  const list = S.schedules || [];
  const undated = list.filter(e => e.undated || !e.start);
  const month = schedInMonth(list, ym).filter(e => !e.undated).slice().sort((a, b) => a.start.localeCompare(b.start) || a.venueKey.localeCompare(b.venueKey, 'ko'));
  const groups = schedGroups(month);
  const mains = groups.map(g => g.main);
  const venues = [...new Map(month.map(e => [e.venueKey, e])).values()];
  const weeks = schedWeeks(ym);
  const dim = +monthEnd(ym).slice(8);
  let day = S.ui.schedDay && S.ui.schedDay.slice(0, 7) === ym ? S.ui.schedDay : '';
  if (!day) {
    const t = today();
    if (t.slice(0, 7) === ym) day = t;
    else {
      for (let n = 1; n <= dim; n++) {
        const iso = `${ym}-${String(n).padStart(2, '0')}`;
        if (month.some(e => e.start <= iso && e.end >= iso)) { day = iso; break; }
      }
    }
    if (!day) day = `${ym}-01`;
    S.ui.schedDay = day;
  }
  const dayGroups = schedOnDay(groups, day);
  const dow = ['일', '월', '화', '수', '목', '금', '토'];
  const MAX_LANES = 4;
  const bars = weeks.map(week => {
    const L = schedLanes(week, mains);
    const shown = L.items.filter(it => it.lane < MAX_LANES);
    const laneH = Math.max(Math.min(L.n, MAX_LANES), 1);
    const extra = week.map((d, i) => d ? L.items.filter(it => it.lane >= MAX_LANES && it.a <= i && it.b >= i).length : 0);
    const barHtml = shown.map(it => {
      const e = it.ev;
      const cont = week[it.a] !== e.start;
      const kind = SCHED_TYPES[e.type] || '';
      const label = `${cont ? '← ' : ''}${kind ? kind + ' ' : ''}${esc(e.title)}`;
      return `<button type="button" class="mcal-bar ${e.source === 'plan' ? 'plan' : 'official'}" data-sday="${week[it.a]}" style="grid-column:${it.a + 1} / ${it.b + 2};grid-row:${it.lane + 1};background:${schedColor(e.venueKey)}" title="${esc(e.venueKey)} · ${esc(kind)} · ${esc(e.title)} · ${esc(e.start)}~${esc(e.end)}"><span>${label}</span></button>`;
    }).join('');
    const days = week.map((d, i) => {
      const on = d && d === day ? ' on' : '';
      const n = d ? +d.slice(8) : '';
      const wk = d ? new Date(d + 'T00:00:00Z').getUTCDay() : 0;
      const more = d ? `<span class="mcal-more">${extra[i] ? '+' + extra[i] : ''}</span>` : '';
      const al = d ? ` aria-label="${n}일${extra[i] ? ', 막대 밖 ' + extra[i] + '건' : ''}"` : '';
      return `<button type="button" class="mcal-day${on}${d ? '' : ' empty'}${wk === 0 ? ' sun' : ''}${wk === 6 ? ' sat' : ''}" ${d ? `data-sday="${d}"` : 'disabled'}${al}><b>${n}</b>${more}</button>`;
    }).join('');
    return `<div class="mcal-week"><div class="mcal-lanes" style="grid-template-rows:repeat(${laneH},44px)">${barHtml || '<span class="mcal-none"></span>'}</div><div class="mcal-days">${days}</div></div>`;
  }).join('');
  const quiet = [];
  const agenda = [];
  for (let d = 1; d <= dim; d++) {
    const iso = `${ym}-${String(d).padStart(2, '0')}`;
    const items = schedOnDay(groups, iso).map(g => g.main);
    if (!items.length) { quiet.push(d); continue; }
    const wkI = new Date(iso + 'T00:00:00Z').getUTCDay();
    agenda.push(`<section class="mcal-agday${iso === day ? ' on' : ''}"><button type="button" class="mcal-agdate${wkI === 0 ? ' sun' : ''}${wkI === 6 ? ' sat' : ''}" data-sday="${iso}" aria-label="${d}일 ${dow[wkI]}"><b>${d}</b><span>${dow[wkI]}</span></button><div class="mcal-agitems">${items.map(e => `<button type="button" class="mcal-agitem ${e.source === 'plan' ? 'plan' : 'official'}" data-sday="${iso}"><i style="background:${schedColor(e.venueKey)}"></i><span class="mcal-agbody"><b>${esc(e.title)}</b><small>${esc(e.venueKey)} · ${esc(SCHED_TYPES[e.type] || '')} · ${e.source === 'plan' ? '내부 예정' : '공식 발표'}${e.end !== e.start ? ' · ' + esc(e.start.slice(5)) + '~' + esc(e.end.slice(5)) : ''}</small></span></button>`).join('')}</div></section>`);
  }
  const srcLabel = e => e.source === 'plan' ? '내부 예정' : '공식 발표';
  const evBlock = e => `<div class="mcal-ev"><div class="mcal-evmeta"><b style="color:${schedColor(e.venueKey)}">${esc(e.venueKey)}</b><span class="ty">${esc(SCHED_TYPES[e.type] || '')}</span><span>${srcLabel(e)}</span></div><div class="mcal-evtitle">${esc(e.title)}</div><div class="muted">${e.undated ? '날짜 미정' : esc(e.start) + (e.end && e.end !== e.start ? ' ~ ' + esc(e.end) : '')}${e.time ? ' · ' + esc(e.time) : ''}${e.open ? ' · 종료 미정' : ''}</div>${e.note ? `<div class="muted">${esc(e.note)}</div>` : ''}${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener">공식 발표 원문</a>` : ''}</div>`;
  const subLine = e => `<div class="mcal-sub"><b>${esc(e.title)}</b><span class="muted">${srcLabel(e)} · ${esc(e.start)}${e.end && e.end !== e.start ? ' ~ ' + esc(e.end) : ''}${e.time ? ' · ' + esc(e.time) : ''}</span>${e.note ? `<span class="muted">${esc(e.note)}</span>` : ''}${e.link ? `<a href="${esc(e.link)}" target="_blank" rel="noopener">공식 발표 원문</a>` : ''}</div>`;
  const groupBlock = g => `${evBlock(g.main)}${g.kids.filter(k => schedCovers(k, day)).map(subLine).join('')}`;
  const printList = groups.map(g => `<p><b>${esc(g.main.start.slice(5))}${g.main.end !== g.main.start ? '~' + esc(g.main.end.slice(5)) : ''}</b> ${esc(g.main.venueKey)} · ${esc(SCHED_TYPES[g.main.type] || '')} · ${esc(g.main.title)} · ${srcLabel(g.main)}${g.kids.map(k => `<br><span class="mcal-sub">· ${esc(k.title)} (${esc(k.start.slice(5))}${k.end !== k.start ? '~' + esc(k.end.slice(5)) : ''})</span>`).join('')}</p>`).join('');
  const phoneDays = weeks.map(week => week.map(d => {
    if (!d) return '<span class="mcal-phday empty"></span>';
    const items = schedOnDay(groups, d);
    const n = +d.slice(8);
    const wk = new Date(d + 'T00:00:00Z').getUTCDay();
    const dotShown = items.slice(0, 3).map(g => g.main);
    const nameShown = items.slice(0, items.length > 2 ? 1 : items.length).map(g => g.main);
    const marks = dotShown.map(e => `<i class="${e.source === 'plan' ? 'plan' : 'official'}" style="--c:${schedColor(e.venueKey)};background:${schedColor(e.venueKey)}"></i>`).join('') + (items.length > 3 ? `<em>${items.length}</em>` : '');
    const names = nameShown.map(e => `<i class="${e.source === 'plan' ? 'plan' : ''}"><b style="--c:${schedColor(e.venueKey)};background:${schedColor(e.venueKey)}"></b><span>${esc(e.title)}</span></i>`).join('') + (items.length > nameShown.length ? `<em>+${items.length - nameShown.length}</em>` : '');
    return `<button type="button" class="mcal-phday${d === day ? ' on' : ''}${d === today() ? ' is-today' : ''}${wk === 0 ? ' sun' : ''}${wk === 6 ? ' sat' : ''}" data-sday="${d}" aria-pressed="${d === day}" aria-label="${n}일${items.length ? ', 일정 ' + items.length + '건' : ''}"><span class="mcal-phtop"><b>${n}</b><span class="mcal-marks">${marks}</span></span><span class="mcal-names">${names}</span></button>`;
  }).join('')).join('');
  const prev = S.ui.schedPrev;
  const preview = prev ? `<div class="card sched-prev">
    <h2>올리기 전 확인 <span class="r">${esc(prev.name || '')}</span></h2>
    <p class="src">체크한 줄만 저장합니다. 1부(공식 발표)와 2부(내부 예정)는 출처가 달라, 다시 올리면 그 출처만 바뀝니다. 줄 끝의 주소는 상세에 링크로 남습니다.</p>
    <div class="tw"><table><thead><tr><th></th><th>출처</th><th>기간</th><th>장소</th><th>행사</th><th>종류</th></tr></thead><tbody>
    ${prev.rows.map((r, i) => `<tr class="${r.hold ? 'flag' : ''}"><td><input type="checkbox" data-schk="${i}" ${r.on ? 'checked' : ''} aria-label="저장"></td><td>${r.source === 'plan' ? '내부 예정' : '공식 발표'}</td><td class="nowrap">${r.undated ? '날짜 미정' : esc(r.start) + (r.end !== r.start ? ' ~ ' + esc(r.end) : '')}${r.open && !r.undated ? ' · 종료 미정' : ''}</td><td><input class="inp" data-sved="${i}" value="${esc(r.venue)}"></td><td><input class="inp" data-stit="${i}" value="${esc(r.title)}"></td><td>${esc(SCHED_TYPES[r.type] || r.type)}${r.link ? ` <a href="${esc(r.link)}" target="_blank" rel="noopener">원문</a>` : ''}${r.warn ? `<div class="muted">${esc(r.warn)}</div>` : ''}</td></tr>`).join('')}
    </tbody></table></div>
    ${prev.skipped.length ? `<p class="src">읽지 못한 줄 ${prev.skipped.length}개. 예: ${esc(prev.skipped[0].why)} (${esc(String(prev.skipped[0].line || '').slice(0, 80))})</p>` : ''}
    <div class="row"><button class="btn pri" id="schedSave">이 목록 저장</button><button class="btn" id="schedCancel">취소</button></div>
  </div>` : '';
  const thisOn = ym === today().slice(0, 7) ? ' on' : '';
  const fileCard = `<div class="card drop" id="schedDrop"><h2>일정 파일</h2>
    <p class="src">한 줄에 하나. <b>- 2026-11-12 (목) ~ 2026-12-03 (목) | 장소 | 행사 이름 | 출처 주소</b>. 큰 제목 <b>## 1. … 공식 발표</b>는 실선, <b>## 2. … 내부 예정</b>은 점선입니다. JSON도 됩니다.</p>
    <button class="btn pri" id="schedFile">일정 파일 올리기</button>
  </div>`;
  return `${head('월간 일정', '공식 팝업·카페·전시 · 대표만 · 실선은 공식 발표, 점선은 내부 예정', '<button class="btn" id="schedPrevM">이전 달</button><button class="chip' + thisOn + '" id="schedThis">이번달</button><button class="btn" id="schedNextM">다음 달</button><button class="btn" id="schedPrint">인쇄</button>')}
  ${preview}
  <article class="mcal">
    <header class="mcal-top"><h2>${y}년 ${m}월</h2><p class="src">${month.length ? `이 달 ${month.length}건 · 장소 ${venues.length}곳` : '이 달에 겹치는 일정이 없습니다. 위에서 파일을 올리세요.'}</p></header>
    <ul class="mcal-leg">${venues.map(e => `<li><i style="background:${schedColor(e.venueKey)}"></i><span>${esc(e.venueKey)}</span></li>`).join('')}<li><i class="official"></i><span>공식 발표</span></li><li><i class="plan"></i><span>내부 예정</span></li><li><span class="ty">팝업</span><span class="ty">카페</span><span class="ty">전시</span></li></ul>
    ${undated.length ? `<aside class="mcal-undated"><h3>날짜 미정</h3>${undated.map(e => `<p><b style="color:${schedColor(e.venueKey)}">${esc(e.venueKey)}</b> ${srcLabel(e)} · ${esc(e.title)}</p>`).join('')}</aside>` : ''}
    <div class="mcal-split">
    <div class="mcal-phone"><div class="mcal-dow">${dow.map((d, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</span>`).join('')}</div><div class="mcal-phdays" style="--weeks:${weeks.length}">${phoneDays}</div></div>
    <section class="mcal-detail"><h3>${day ? md(day) + ' 일정' : '날짜를 누르면 그 날이 여기에 나옵니다'}</h3>
      ${day ? (dayGroups.length ? dayGroups.map(groupBlock).join('') : '<p class="muted">이 날 일정이 없습니다.</p>') : ''}
      ${fileCard}
    </section>
    </div>
    <div class="mcal-gridwrap">
      <p class="src">한 주에는 막대를 4줄까지만 보여 줍니다. 날짜 아래 +숫자는 그 날 더 있는 일정입니다. 날짜를 누르면 아래에 전부 나옵니다.</p>
      <div class="mcal-dow">${dow.map((d, i) => `<span class="${i === 0 ? 'sun' : i === 6 ? 'sat' : ''}">${d}</span>`).join('')}</div>
      ${bars}
    </div>
    <div class="mcal-agenda">${agenda.join('')}${quiet.length ? `<p class="src">일정 없는 날: ${quiet.join(', ')}</p>` : ''}</div>
    <section class="mcal-printlist"><h3>이 달 전체</h3>${printList || '<p>이 달에 겹치는 일정이 없습니다.</p>'}</section>
  </article>`;
}
async function schedReadFile(f) {
  const text = await f.text();
  let parsed;
  try { parsed = /\.json$/i.test(f.name) || text.trim().startsWith('{') || text.trim().startsWith('[') ? parseSchedJson(text) : parseSchedText(text); }
  catch (e) { toast('파일을 읽지 못했습니다: ' + (e.message || e)); return; }
  parsed.rows.forEach(r => { if (r.hold) r.on = false; });
  S.ui.schedPrev = { name: f.name, rows: parsed.rows, skipped: parsed.skipped };
  render();
  toast(`줄 ${parsed.rows.length}개를 읽었습니다. 저장 전에 확인하세요.`);
}
async function schedSavePreview() {
  const prev = S.ui.schedPrev; if (!prev) return;
  const docs = schedDocs(prev.rows);
  const sources = [...new Set(docs.map(d => d.source))];
  if (!sources.length) { toast('저장할 줄이 없습니다'); return; }
  try {
    for (const src of sources) {
      const list = docs.filter(d => d.source === src);
      if (DB.replaceSchedules) await DB.replaceSchedules(src, list);
      S.schedules = (S.schedules || []).filter(x => x.source !== src).concat(list);
    }
    S.ui.schedPrev = null;
    const ym = docs.map(d => d.start).filter(s => /^\d{4}-\d{2}/.test(s || '')).map(s => s.slice(0, 7)).sort()[0];
    if (ym) S.ui.schedYm = ym;
    render();
    toast(`${docs.length}건을 저장했습니다. 같은 출처의 이전 일정은 이 파일로 바뀌었습니다.`);
  } catch (e) { toast('저장하지 못했습니다: ' + (e.message || e)); }
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
    case 'biz': return bizView();
    case 'collab': return collabView();
    case 'settle': return settleView();
    case 'popup': return popupView();
    case 'sched': return schedView();
    case 'mclose': return mcloseView();
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
  const opt = (a, b, cur, suf) => { let o = ''; for (let i = a; i <= b; i++) o += `<option value="${i}" ${i === cur ? 'selected' : ''}>${suf === '년' ? i : String(i).padStart(2, '0')}${suf}</option>`; return o; };
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
const STORE_KIND = { suwon: '팝업', limission: '팝업', museum: '전시', boxcafe: '카페', omake: '카페', gukdae: '물류창고' };
const STORE_PLACE = { suwon: 'AK PLAZA 수원 5F', limission: 'AK PLAZA 홍대 4F', museum: 'AK PLAZA 홍대 4F', boxcafe: 'AK PLAZA 홍대 3F', omake: '현대백화점 신촌 B2', gukdae: 'SMG 홀딩스 물류창고' };
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
const mdw = fd;
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
        return `<div class="tlbar${on ? ' on' : ''}${r.end < t ? ' past' : ''}" style="left:${l}%;width:${w}%;top:${r._lane * 30 + 4}px;--c:${storeColor(s.id)}" title="${esc(r.ip)} ${fr(r.start, r.end)}"><span>${esc(r.ip)}</span></div>`; }).join('')}
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
    <div class="tw"><table class="tb"><thead><tr><th>매장</th><th>구분</th><th>IP</th><th>기간</th><th class="n">일수</th><th>상태</th>${canIpEdit() ? '<th></th>' : ''}</tr></thead><tbody>
    ${L.map(r => { const st = r.end < t ? '<span class="pill p-mute">종료</span>' : r.start <= t ? '<span class="pill p-bad">진행 중</span>' : `<span class="pill p-ok">D-${dDiff(t, r.start)}</span>`;
      return `<tr><td class="nowrap"><span class="dot" style="background:${storeColor(r.store)};display:inline-block;margin-right:6px"></span>${esc(shortName(r.store))}</td><td class="nowrap">${esc(r.kind)}</td><td style="min-width:140px"><b>${esc(r.ip)}</b>${r.host ? ` <span class="muted">· ${esc(r.host)}</span>` : ''}${r.note ? `<div class="muted" style="font-size:12px">🔸 ${esc(r.note)}</div>` : ''}</td><td class="nowrap">${mdw(r.start)} ~ ${mdw(r.end)}</td><td class="n">${dDiff(r.start, r.end) + 1}</td><td>${st}</td>${canIpEdit() ? `<td><button class="btn sm" data-ipe="${r.id}">고치기</button></td>` : ''}</tr>`; }).join('') || `<tr><td colspan="7" class="muted">일정이 없습니다</td></tr>`}
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
      ${n.at ? `<div class="muted" style="font-size:12px">마지막 수정 ${esc(fdt(n.at))}</div>` : ''}
    </div>
    <div class="row" style="justify-content:space-between">${n.text ? '<button class="btn" id="ntClear" style="color:var(--red)">공지 내리기</button>' : '<span></span>'}<span class="row"><button class="btn" data-close>취소</button><button class="btn pri" id="ntSave">공지 올리기</button></span></div>`
  : `<div class="card"><div style="white-space:pre-wrap;line-height:1.6;font-size:15px">${esc(n.text || '등록된 공지가 없습니다')}</div>${n.at ? `<div class="muted" style="font-size:12px;margin-top:10px">${esc(fdt(n.at))}</div>` : ''}</div>
    <div class="row" style="justify-content:flex-end"><button class="btn pri" data-close>확인</button></div>`}`;
}
async function saveNotice(text) {
  const n = { text: text.trim(), at: kstStamp(), by: S.user ? S.user.name : '' };
  S.notice = n;
  if (DB.saveNotice) await DB.saveNotice(n).catch(e => { toast('저장하지 못했습니다: ' + e.message); });
}

/* ───────── 대표 판단용 요약 (실제 자료만 · 목표치 설정이 없으면 지난달과만 비교) ───────── */
const isWh = id => (STORES.find(s => s.id === id) || {}).type === 'warehouse';
const saleSt = st => st.filter(s => !isWh(s));
function salesSum(stores, a, b) { let s = 0, p = 0, q = 0; for (const st of stores) for (let d = a; d <= b; d = addDays(d, 1)) { const r = dayRec(st, d); if (r) { s += r.s; p += r.p; q += r.q; } } return { s, p, q }; }
// 이번 달 누적 · 지난달 같은 기간 · 월말 예상 (토스포스 기준)
function monthKpi(stores) {
  const last = latestSalesDate(stores); if (!last) return null;
  const m1 = last.slice(0, 8) + '01', n = +last.slice(8), dim = new Date(Date.UTC(+last.slice(0, 4), +last.slice(5, 7), 0)).getUTCDate();
  const pm1 = addMonths(m1, -1), pdim = new Date(Date.UTC(+pm1.slice(0, 4), +pm1.slice(5, 7), 0)).getUTCDate(), pEnd = pm1.slice(0, 8) + String(Math.min(n, pdim)).padStart(2, '0');
  const cur = salesSum(stores, m1, last), prev = salesSum(stores, pm1, pEnd), prevFull = salesSum(stores, pm1, pm1.slice(0, 8) + String(pdim).padStart(2, '0'));
  return { last, m1, n, dim, pm1, pEnd, cur, prev, prevFull, fc: cur.s / n * dim, ch: prev.s ? pct(cur.s, prev.s) : null };
}
function stockValue(stores) { let t = 0, n = 0; for (const s of stores) for (const [pid, q] of Object.entries(S.stock[s] || {})) if (q > 0 && S.P[pid]) { const v = priceOf(S.P[pid]); if (v) t += v * q; else n++; } return { t, noPrice: n }; }
// 판매 속도: 최근 28일 POS 판매 차감 기록 (판매 자료가 있는 매장만)
function velocity(stores, days = 28) {
  const last = latestSalesDate(stores) || today(), a = addDays(last, -(days - 1)), v = {}, has = new Set();
  for (const m of S.moves) if (m.type === '판매' && stores.includes(m.store)) { has.add(m.store); if (m.date >= a && m.date <= last) v[m.pid] = (v[m.pid] || 0) - m.qty; }
  return { v, last, a, days, stores: stores.filter(s => has.has(s)) };
}
function stockDays(t, sold, days) { if (t <= 0) return 0; if (!sold) return Infinity; return t / (sold / days); }
const daysTxt = d => d === Infinity ? '판매 없음' : d >= 365 ? '1년 이상' : `${Math.round(d)}일`;
function todoBox(st) {
  const ss = saleSt(st);
  const pend = S.transfers.filter(t => t.status === 'sent' && st.includes(t.to)), pendQ = pend.reduce((a, t) => a + t.qty, 0);
  const ibs = S.inbounds.filter(x => st.includes(x.store) && x.status !== 'received');
  const pos = ss.map(s => { const l = latestSalesDate([s]); return { s, l, d: l ? daysBetween(l, today()) : null }; }).sort((a, b) => (b.d ?? 999) - (a.d ?? 999));
  const worst = pos[0];
  const V = velocity(ss);
  let neg = 0, low = 0; for (const p of S.products) { const has = st.some(s => (S.stock[s] || {})[p.id] != null); if (!has) continue; const t = st.reduce((a, s) => a + stockOf(s, p.id), 0); if (t < 0) neg++; else if (t > 0 && t <= LOW_QTY && V.v[p.id] > 0 && stockDays(t, V.v[p.id], V.days) <= LOW_DAYS) low++; }
  const it = (ic, lb, v, sub, go, bad) => `<button class="todo ${bad ? 'bad' : ''}" ${go}><span class="ti">${ic}</span><span class="tl">${lb}<small>${sub}</small></span><b class="tv">${v}</b></button>`;
  return `<div class="card todobox"><h2>오늘 할 일 <span class="r">${fd(today())} 기준</span></h2><div class="todos">
    ${it('🚚', '받기 확인 안 한 이동', `${pend.length}건`, pend.length ? `${fmt(pendQ)}개 · 가장 오래된 ${md(pend.map(t => t.date).sort()[0])}` : '없음', can('move') ? 'data-nav="transfer"' : '', pend.length)}
    ${it('📦', '확정 안 한 입고', `${ibs.length}건`, ibs.length ? ibs.slice(0, 2).map(x => esc(x.title)).join(', ') : '없음', can('move') ? 'data-nav="inbound"' : '', ibs.length)}
    ${ss.length ? it('🧾', 'POS 매출 마지막 반영', worst && worst.d != null ? (worst.d === 0 ? '오늘' : `${worst.d}일 전`) : '자료 없음', pos.map(x => `${esc(shortName(x.s))} ${x.l ? md(x.l) : '-'}`).join(' · '), can('sales') ? 'data-nav="sales"' : '', worst && (worst.d == null || worst.d > 2)) : ''}
    ${it('🔺', '마이너스 재고', `${neg}종`, '실사로 맞춰야 함', 'data-hd="neg"', neg)}
    ${it('⏳', '품절 임박', `${low}종`, V.stores.length ? `${LOW_QTY}개 이하 · 지금 속도면 ${LOW_DAYS}일 안에 품절` : '판매 기록 없음', 'data-pfgo="low"', low)}
  </div></div>`;
}
function ceoKpi(st) {
  const ss = saleSt(st); const K = can('sales') && ss.length ? monthKpi(ss) : null; const SV = stockValue(st);
  if (!K && !can('sales')) return '';
  const tile = (lb, v, unit, d, go = '') => `<button class="tile tbtn kpi" ${go}><span class="lb">${lb}</span><span class="v big${String(v).length > 9 ? ' long' : ''}">${v}<small>${unit}</small></span><span class="d">${d}</span></button>`;
  return `<div class="tiles kpis">
    ${K ? tile(`${+K.last.slice(5, 7)}월 누적 매출 <span class="go">매출 ›</span>`, fmt(K.cur.s), '원', `${chg(K.ch)} <span class="muted">지난달 같은 기간(${md(K.pm1)} ~ ${md(K.pEnd)}) ${man(K.prev.s)}원</span>`, 'data-nav="sales"') : ''}
    ${K ? tile(`${+K.last.slice(5, 7)}월 말 예상`, fmt(Math.round(K.fc / 1000) * 1000), '원', `<span class="muted">${K.n}일간 하루 평균 ${man(K.cur.s / K.n)}원 × ${K.dim}일${K.prevFull.s ? ` · 지난달 ${man(K.prevFull.s)}원` : ''}</span>`, 'data-nav="sales"') : ''}
    ${tile('재고 금액 <span class="go">상품 ›</span>', fmt(SV.t), '원', `<span class="muted">판매가 × 재고 (마이너스 제외)${SV.noPrice ? ` · 가격 없는 ${SV.noPrice}종 빠짐` : ''}</span>`, 'data-nav="products"')}
  </div>${K ? `<div class="muted" style="font-size:12px;margin-top:-8px">토스포스 매출 ${md(K.last)}까지 · ${ss.map(shortName).join(', ')}${st.some(isWh) ? ' · 국대출판물류(물류창고)는 매출 합계에서 뺌' : ''} · 목표 설정이 없어 지난달과 비교합니다</div>` : ''}`;
}
// 매출: TOP5·BOTTOM5 (상품·IP) · 매장 순위 · 이번 주 vs 지난 주 한 줄
function ceoSales(per, sum, stores, a, b) {
  const pr = {}, ip = {}; for (const s of sum) { for (const [k, [q, v, i]] of Object.entries(per[s].pr)) { const x = pr[k] ||= { q: 0, s: 0, ip: i }; x.q += q; x.s += v; } for (const [k, [q, v]] of Object.entries(per[s].ip)) { const x = ip[k] ||= { q: 0, s: 0 }; x.q += q; x.s += v; } }
  const P = Object.entries(pr).filter(([, x]) => x.s > 0).sort((x, y) => y[1].s - x[1].s), I = Object.entries(ip).filter(([, x]) => x.s > 0).sort((x, y) => y[1].s - x[1].s);
  const nm = k => esc(k.replace(/^에바30주년팝업_/, ''));
  const list = (L, top, isP) => `<ol class="rk">${L.map(([k, x], i) => `<li><span class="rn">${top ? i + 1 : (isP ? P : I).length - i}</span><span class="rt">${nm(k)}${isP ? `<small>${esc(x.ip || '')}</small>` : ''}</span><span class="rq">${fmt(x.q)}개</span><b class="rv">${fmt(x.s)}</b></li>`).join('')}</ol>`;
  const tb = (t, L) => L.length < 2 ? '' : `<div class="card"><h2>${t} <span class="r">${md(a)} ~ ${md(b)} · 매출(원)</span></h2><div class="grid2 tb5"><div><div class="tbh up">▲ 잘 팔린 TOP 5</div>${list(L.slice(0, 5), true, L === P)}</div><div><div class="tbh dn">▼ 덜 팔린 BOTTOM 5 <span class="muted">(1개 이상 팔린 것 중)</span></div>${list(L.slice(-5).reverse(), false, L === P)}</div></div></div>`;
  // 고른 기간 vs 바로 앞 같은 일수 (마지막 올린 날 기준의 최근 7일을 따로 보여 주지 않음)
  const len = daysBetween(a, b) + 1, prevA = addDays(a, -len), prevB = addDays(a, -1);
  const w1 = salesSum(sum, a, b), w0 = salesSum(sum, prevA, prevB); const c = w0.s ? pct(w1.s, w0.s) : null;
  let sent = '';
  if (w1.s || w0.s) {
    const ipW = {}; for (const s of sum) for (let d = prevA; d <= b; d = addDays(d, 1)) { const r = dayRec(s, d); if (!r) continue; const cur = d >= a; for (const [k, [, v]] of Object.entries(r.ip || {})) { const x = ipW[k] ||= [0, 0]; x[cur ? 1 : 0] += v; } }
    const best = Object.entries(ipW).sort((x, y) => (y[1][1] - y[1][0]) - (x[1][1] - x[1][0]))[0], worst = Object.entries(ipW).sort((x, y) => (x[1][1] - x[1][0]) - (y[1][1] - y[1][0]))[0];
    sent = `<div class="card wk"><b>이 기간 한 줄</b> — ${md(a)} ~ ${md(b)} (${len}일) 매출 <b class="ink">${won(w1.s)}</b>${c == null ? ', 바로 앞 같은 일수 자료가 없습니다.' : `, 바로 앞 ${len}일(${md(prevA)} ~ ${md(prevB)})보다 <b class="${c >= 0 ? 'up' : 'dn'}">${Math.abs(c).toFixed(1)}% ${c >= 0 ? '늘었습니다' : '줄었습니다'}</b> (${won(w0.s)}).`}${best && best[1][1] - best[1][0] > 0 ? ` 가장 많이 늘어난 IP는 <b>${esc(best[0])}</b>(+${man(best[1][1] - best[1][0])}원)` : ''}${worst && worst[1][1] - worst[1][0] < 0 ? `, 가장 많이 줄어든 IP는 <b>${esc(worst[0])}</b>(−${man(worst[1][0] - worst[1][1])}원)` : ''}${best || worst ? '입니다.' : ''}</div>`;
  }
  const R = sum.map(s => [s, per[s].s]).sort((x, y) => y[1] - x[1]), mx = Math.max(1, ...R.map(x => x[1])), tot = R.reduce((t, x) => t + x[1], 0);
  const rank = sum.length > 1 ? `<div class="card"><h2>매장 순위 <span class="r">${md(a)} ~ ${md(b)} · 매출(원)</span></h2><div class="hb">${R.map(([s, v], i) => `<span class="k"><span class="muted num">${i + 1}</span> ${sdot(s)}${esc(shortName(s))}</span><span class="tr"><i style="width:${v / mx * 100}%;background:${i === 0 ? 'var(--red)' : 'var(--ink-2)'}"></i></span><span class="v">${fmt(v)}<span class="muted" style="font-weight:500"> · ${tot ? (v / tot * 100).toFixed(1) : 0}%</span></span>`).join('')}</div></div>` : '';
  return sent + rank + tb('상품 TOP 5 · BOTTOM 5', P) + tb('IP TOP 5 · BOTTOM 5', I);
}
// 콜라보: 일평균 · 지금 속도면 종료일 예상 재고 · 추가 발주/이동 추천 · 지난 콜라보와 비교
function collabForecast(st, r, a, b, R) {
  const last = latestSalesDate([st]); if (!last || last < a) return '';
  const end = b < last ? b : last, el = daysBetween(a, end) + 1, left = Math.max(0, daysBetween(last, b));
  const daily = R.posS / el, soldPerDay = R.T.sold / el;
  const rows = R.rows.map(x => { const v = x.sold / el, need = v * left; return { ...x, v, need, after: x.now - need, out: v > 0 ? (x.now <= 0 ? 0 : x.now / v) : Infinity }; });
  const exp = rows.reduce((t, x) => t + Math.max(0, x.after), 0);
  const recs = rows.filter(x => x.sold > 0 && (x.now <= 0 || (left && x.after < 0))).sort((x, y) => x.out - y.out || y.v - x.v).map(x => {
    const lack = Math.max(1, Math.ceil(left ? x.need - x.now : x.v * 7)), src = myStores().filter(s => s !== st).map(s => [s, stockOf(s, x.pid)]).filter(([, q]) => q > 0).sort((p, q) => q[1] - p[1]);
    return { ...x, lack, src };
  });
  const past = ipPlan().filter(p => p.id !== r.id && p.end < a && myStores().includes(p.store)).map(p => { const d = daysBetween(p.start, p.end) + 1; let s = 0, q = 0, nd = 0; for (let x = p.start; x <= p.end; x = addDays(x, 1)) { const rec = dayRec(p.store, x); if (!rec) continue; nd++; for (const [ip, [qq, ss]] of Object.entries(rec.ip || {})) if (catMatch(p, ip)) { s += ss; q += qq; } } return { p, d, s, q, nd }; }).filter(x => x.s > 0).sort((x, y) => y.p.start.localeCompare(x.p.start)).slice(0, 6);
  return `<div class="card fc"><h2>지금 속도라면 <span class="r">${md(a)} ~ ${md(end)} ${el}일 실적 기준${left ? ` · 종료까지 ${left}일 남음` : ' · 콜라보 종료'}</span></h2>
    <div class="tiles">
      <div class="tile"><span class="lb">일평균 매출</span><span class="v big">${fmt(daily)}<small>원</small></span><span class="d muted">하루 ${fmt(soldPerDay)}개 판매</span></div>
      <div class="tile"><span class="lb">${left ? '종료일 예상 매출' : '콜라보 총매출'}</span><span class="v big">${fmt(R.posS + daily * left)}<small>원</small></span><span class="d muted">${left ? `종료 ${md(b)} · 지금까지 ${man(R.posS)}원 + ${left}일 × ${man(daily)}원` : `${el}일 실적`}</span></div>
      <div class="tile ${recs.length ? 'alert' : ''}"><span class="lb">${left ? '종료일 예상 잔여재고' : '남은 재고'}</span><span class="v big">${fmt(left ? exp : R.T.now)}<small>개</small></span><span class="d">${left ? `<span class="muted">지금 ${fmt(R.T.now)}개 − 예상 판매 ${fmt(R.T.now - exp)}개</span>` : '<span class="muted">반품·이동 판단용</span>'}</span></div>
    </div>
    ${recs.length ? `<h2 style="margin-top:14px">추가 발주 · 이동 추천 <span class="r">${recs.length}종 · 품절됐거나 ${left ? '종료 전 품절 예상' : ''}</span></h2><div class="tw"><table><thead><tr><th>상품명</th><th class="n">하루 판매</th><th class="n">현재고</th>${left ? '<th class="n">품절 예상</th>' : ''}<th class="n">필요</th><th>추천</th></tr></thead><tbody>
      ${recs.slice(0, 12).map(x => `<tr data-pid="${x.pid}" class="click"><td class="nm">${esc(x.p.name.replace(/^에바30주년팝업_/, ''))}</td><td class="n">${x.v.toFixed(1)}</td><td class="n ${x.now <= 0 ? 'qty-neg' : ''}"><b>${fmt(x.now)}</b></td>${left ? `<td class="n nowrap">${x.now <= 0 ? '<span class="pill p-bad">품절</span>' : `${md(addDays(last, Math.floor(x.out)))}`}</td>` : ''}<td class="n"><b>${fmt(x.lack)}</b></td><td class="rc nowrap">${x.src.length ? `<span class="pill p-info">이동</span> <span class="nowrap">${esc(shortName(x.src[0][0]))} ${fmt(x.src[0][1])}개</span>` : '<span class="pill p-warn">발주</span>'}</td></tr>`).join('')}</tbody></table></div>${recs.length > 12 ? `<p class="muted" style="font-size:12.5px">급한 순 12종만 보여 줍니다 (전체 ${recs.length}종)</p>` : ''}` : `<div class="note" style="margin-top:10px">✔ ${left ? '지금 속도면 종료일까지 품절될 상품이 없습니다.' : '품절된 상품이 없습니다.'}</div>`}
    <div class="muted" style="font-size:12px;margin-top:8px">필요 수량 = 하루 판매 × 남은 날 − 현재고${left ? '' : ' (종료 후: 1주일치)'} · 이동 = 내 권한 매장 중 재고가 있는 곳</div>
    ${past.length ? `<h2 style="margin-top:14px">지난 콜라보와 비교 <span class="r">토스포스 IP 매출</span></h2><div class="tw"><table><thead><tr><th>콜라보</th><th class="hide-s">매장</th><th class="n">기간</th><th class="n">매출</th><th class="n">일평균</th></tr></thead><tbody>
      <tr class="sel"><td><b>${esc(r.ip)}</b> <span class="pill p-bad">이번</span></td><td class="hide-s nowrap">${esc(shortName(st))}</td><td class="n">${el}일</td><td class="n"><b>${fmt(R.posS)}</b></td><td class="n"><b>${fmt(daily)}</b></td></tr>
      ${past.map(x => `<tr><td>${esc(x.p.ip)} <span class="muted" style="font-size:12px">${fd(x.p.start)} ~</span></td><td class="hide-s nowrap">${esc(shortName(x.p.store))}</td><td class="n">${x.nd}일</td><td class="n">${fmt(x.s)}</td><td class="n">${fmt(x.s / (x.nd || 1))} ${chg(pct(daily, x.s / (x.nd || 1)))}</td></tr>`).join('')}</tbody></table></div><div class="muted" style="font-size:12px;margin-top:6px">일평균 옆 ▲▼ = 이번 콜라보가 그 콜라보보다 높거나 낮은 정도 · 기간 = 매출 자료가 있는 날 수</div>` : '<div class="muted" style="font-size:12.5px;margin-top:10px">비교할 지난 콜라보 매출 자료가 없습니다.</div>'}
  </div>`;
}
/* ───────── 사업부/채널 ───────── */
S.biz = (() => { try { return JSON.parse(localStorage.getItem('oninter-biz') || '{}'); } catch (e) { return {}; } })();
function saveBiz() { try { localStorage.setItem('oninter-biz', JSON.stringify(S.biz)); } catch (e) {} }
function bizDays(b) {   // { 'YYYY-MM-DD': { s, p } }
  if (b.stores) { const o = {}; for (const st of b.stores) for (const [ym, m] of Object.entries(S.sales[st] || {})) for (const [dd, r] of Object.entries(m.days || {})) { const x = o[ym + '-' + dd] ||= { s: 0, p: 0 }; x.s += r.s || 0; x.p += r.p || 0; } return o; }
  return S.biz[b.id] || {};
}
function bizSum(b, ym) { let s = 0, p = 0, last = ''; for (const [d, r] of Object.entries(bizDays(b))) { if (ym && d.slice(0, 7) !== ym) continue; s += r.s || 0; p += r.p || 0; if (d > last) last = d; } return { s, p, last }; }
function bizMonth() { let m = ''; for (const b of BIZ) for (const d of Object.keys(bizDays(b))) if (d.slice(0, 7) > m) m = d.slice(0, 7); return m || today().slice(0, 7); }
function bizCards() {
  const ym = bizMonth(); const R = BIZ.map(b => ({ b, ...bizSum(b, ym) })); const tot = R.reduce((a, r) => a + r.s, 0);
  const card = r => r.last ? `<button class="tile tbtn biz" data-nav="biz"><span class="lb bizname">${esc(r.b.name)} <span class="go">›</span></span><span class="v">${fmt(r.s)}<small>원</small></span><span class="d muted">${esc(r.b.sub)} · ${md(r.last)}까지 · ${fmt(r.p)}건</span></button>`
    : `<button class="tile tbtn biz empty" data-nav="biz"><span class="lb bizname">${esc(r.b.name)} <span class="go">›</span></span><span class="v muted" style="font-size:18px">자료 업로드 전</span><span class="d muted">${esc(r.b.sub)}</span></button>`;
  return `${head('온인터내셔널 사업부 매출', `${+ym.slice(5)}월 · ${ym.slice(0, 4)}년 · 자료가 올라온 사업부만 더합니다`)}<div class="bizgrid"><button class="tile tbtn biz tot" data-nav="biz"><span class="lb">${+ym.slice(5)}월 전체 합계 <span class="go">›</span></span><span class="v big">${fmt(tot)}<small>원</small></span><span class="d muted">${BIZ.length}개 사업부 중 ${R.filter(r => r.last).length}개 자료</span></button>${R.map(card).join('')}</div>${soonLine()}`;
}
function soonLine() { return `<div class="bizsoon"><span class="pill p-mute">오픈 예정</span> <b>${esc(BIZ_SOON.name)}</b> <span class="muted">${esc(BIZ_SOON.sub.replace(/^오픈 예정 /, ''))} · 사업부 합계에 넣지 않음</span></div>`;
}
/* ───────── 의사결정 분석 (요약 · 자동 인사이트 · 추천 행동 · 경고) ─────────
   모든 문장은 실제 자료에서 규칙으로 계산합니다. 자료가 없으면 무엇을 넣어야 하는지 안내합니다. */
const DECWD = ['일', '월', '화', '수', '목', '금', '토'];
function bizCfg(id) { return ((S.biz._cfg ||= {})[id] ||= {}); }
function ymPrev(ym) { const [y, m] = ym.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; }
function unitStats(b) {
  const D = bizDays(b), days = Object.keys(D).sort(), last = days[days.length - 1] || '';
  const ym = last.slice(0, 7), c = bizCfg(b.id);
  const sumR = (a, z) => days.filter(d => d >= a && d <= z).reduce((t, d) => t + (D[d].s || 0), 0);
  const cur = ym ? bizSum(b, ym).s : 0;
  // 지난달 같은 기간(1일~같은 날)과 비교. 월 단위 입력(블로그)은 지난달 전체와 비교
  const pm = ym ? ymPrev(ym) : '', dd = last.slice(8);
  const prevSame = b.monthly ? bizSum(b, pm).s : sumR(pm + '-01', pm + '-' + dd);
  const pmHas = days.some(d => d.slice(0, 7) === pm);
  const months = [...new Set(days.map(d => d.slice(0, 7)))].filter(m => m < ym).slice(-3);
  const avg3 = months.length ? months.reduce((t, m) => t + bizSum(b, m).s, 0) / months.length : null;
  const dim = ym ? new Date(+ym.slice(0, 4), +ym.slice(5), 0).getDate() : 30;
  const fcast = b.monthly ? cur : (+dd ? cur / +dd * dim : 0);
  const cr = c.cr === '' || c.cr == null ? null : +c.cr, fixed = (+c.labor || 0) + (+c.rent || 0);
  const profit = cr == null ? null : fcast * (1 - cr / 100) - fixed;
  return { b, D, days, last, ym, cur, prevSame, pmHas, avg3, fcast, cr, fixed, profit, goal: +c.goal || 0, c, ch: pmHas ? pct(cur, prevSame) : null };
}
function prodWindow(stores, a, z) { // 상품명별 {q,s,ip}, IP별 {q,s}
  const P = {}, I = {};
  for (const st of stores) for (let d = a; d <= z; d = addDays(d, 1)) { const r = dayRec(st, d); if (!r) continue;
    for (const [n, [q, s, ip]] of Object.entries(r.pr || {})) { const x = P[n] ||= { q: 0, s: 0, ip }; x.q += q; x.s += s; }
    for (const [n, [q, s]] of Object.entries(r.ip || {})) { const x = I[n] ||= { q: 0, s: 0 }; x.q += q; x.s += s; } }
  return { P, I };
}
function weekdayLine(D, last, weeks = 8) {
  const a = addDays(last, -(weeks * 7 - 1)), t = Array(7).fill(0), n = Array(7).fill(0);
  for (const [d, r] of Object.entries(D)) if (d >= a && d <= last && r.s) { const w = new Date(d + 'T00:00:00').getDay(); t[w] += r.s; n[w]++; }
  const av = t.map((x, i) => n[i] ? x / n[i] : null), ok = av.map((v, i) => [v, i]).filter(x => x[0] != null);
  if (ok.length < 5) return null;
  ok.sort((x, y) => y[0] - x[0]); const best = ok[0], worst = ok[ok.length - 1], mean = ok.reduce((s, x) => s + x[0], 0) / ok.length;
  const wk = [6, 0].map(i => av[i]).filter(v => v != null), wd = [1, 2, 3, 4, 5].map(i => av[i]).filter(v => v != null);
  const we = wk.length && wd.length ? pct(wk.reduce((s, v) => s + v, 0) / wk.length, wd.reduce((s, v) => s + v, 0) / wd.length) : null;
  return `최근 ${weeks}주 요일 평균: <b>${DECWD[best[1]]}요일</b>이 가장 높고(${man(best[0])}원, 평균보다 ${Math.round(pct(best[0], mean))}% 높음) <b>${DECWD[worst[1]]}요일</b>이 가장 낮습니다(${man(worst[0])}원).${we != null ? ` 주말이 평일보다 ${Math.abs(Math.round(we))}% ${we >= 0 ? '높습니다' : '낮습니다'}.` : ''}`;
}
function offlineAnalysis(stores, last, cr) {
  const I = [], A = [], W = [];
  const a = addDays(last, -27), pa = addDays(last, -55), pz = addDays(last, -28);
  const now = prodWindow(stores, a, last), prev = prodWindow(stores, pa, pz);
  const byName = {}; for (const p of S.products) byName[norm(p.name)] = p;
  const stk = p => stores.reduce((t, s) => t + stockOf(s, p.id), 0);
  const prods = Object.entries(now.P).map(([n, x]) => ({ n, ...x, p: byName[norm(n)] })).filter(x => x.s > 0 && !/쇼핑백/.test(x.n));
  prods.sort((x, y) => y.s - x.s);
  if (prods.length) {
    I.push(`최근 4주 <b>베스트 상품</b>: ${prods.slice(0, 3).map(x => `${esc(x.n)} ${man(x.s)}원(${fmt(x.q)}개)`).join(' · ')}`);
    const low = prods.filter(x => x.p && stk(x.p) > 0).slice(-3).reverse();
    if (low.length) I.push(`최근 4주 <b>가장 적게 팔린 재고 상품</b>: ${low.map(x => `${esc(x.n)} ${man(x.s)}원(${fmt(x.q)}개, 재고 ${fmt(stk(x.p))}개)`).join(' · ')}`);
  }
  const ips = Object.entries(now.I).filter(([n]) => n !== '메인').map(([n, x]) => ({ n, s: x.s, ps: (prev.I[n] || {}).s || 0 })).sort((x, y) => y.s - x.s);
  if (ips.length) {
    const tot = ips.reduce((t, x) => t + x.s, 0);
    I.push(`<b>IP 매출 1위</b>는 ${esc(ips[0].n)} ${man(ips[0].s)}원(전체의 ${Math.round(ips[0].s / tot * 100)}%)${ips[1] ? `, 2위 ${esc(ips[1].n)} ${man(ips[1].s)}원` : ''}.`);
    const up = ips.filter(x => x.ps >= 100000).map(x => ({ ...x, c: pct(x.s, x.ps) })).sort((x, y) => x.c - y.c);
    if (up.length) { const dn = up[0], best = up[up.length - 1];
      if (dn.c < -20) { I.push(`<b>가장 크게 줄어든 IP</b>: ${esc(dn.n)} ${man(dn.ps)}원 → ${man(dn.s)}원 (${Math.round(dn.c)}%, 직전 4주 대비)`); A.push(`${esc(dn.n)}: 진열 위치·구성을 줄이고 남은 재고 소진 계획을 세우세요.`); }
      if (best.c > 20) { I.push(`<b>가장 크게 늘어난 IP</b>: ${esc(best.n)} ${man(best.ps)}원 → ${man(best.s)}원 (+${Math.round(best.c)}%)`); A.push(`${esc(best.n)}: 매출이 늘고 있으니 앞쪽 진열·추가 입고로 밀어 주세요.`); } }
  }
  // 품절로 놓친 매출 / 재발주
  const out = [], reo = [];
  for (const x of prods) { if (!x.p) continue; const t = stk(x.p), v = x.q / 28, pr = x.s / (x.q || 1);
    if (t <= 0) out.push({ ...x, v, loss: v * pr * 7 });
    else if (t / v < 14) reo.push({ ...x, t, v, need: Math.ceil(v * 28 - t), dleft: t / v }); }
  out.sort((x, y) => y.loss - x.loss); reo.sort((x, y) => x.dleft - y.dleft);
  if (out.length) { const L = out.reduce((t, x) => t + x.loss, 0);
    I.push(`<b>품절로 놓치는 매출</b>: 최근 4주에 팔리던 ${fmt(out.length)}종이 지금 재고 0개입니다. 지금 속도라면 1주일에 약 ${man(L)}원을 놓칩니다 (큰 순: ${out.slice(0, 3).map(x => esc(x.n)).join(', ')}).`);
    A.push(`<b>재발주(품절)</b>: ${out.slice(0, 5).map(x => `${esc(x.n)} ${fmt(Math.max(1, Math.ceil(x.v * 28)))}개`).join(' · ')} <span class="muted">(4주치 = 최근 하루 판매 × 28)</span>`);
    W.push(`품절 ${fmt(out.length)}종 · 주당 약 ${man(L)}원 매출 손실 추정`); }
  if (reo.length) A.push(`<b>재발주(2주 안에 품절 예상)</b>: ${reo.slice(0, 5).map(x => `${esc(x.n)} ${fmt(x.need)}개(재고 ${fmt(x.t)}개 · ${Math.round(x.dleft)}일분)`).join(' · ')}`);
  // 과재고 · 안 팔리는 재고
  const soldN = new Set(Object.keys(prodWindow(stores, addDays(last, -59), last).P).map(norm));
  let deadAmt = 0, deadQ = 0, deadN = 0, overAmt = 0; const over = [];
  for (const p of S.products) { const t = stk(p); if (t <= 0) continue; const amt = t * priceOf(p);
    if (!soldN.has(norm(p.name))) { deadAmt += amt; deadQ += t; deadN++; continue; }
    const x = now.P[p.name] || Object.entries(now.P).find(([n]) => norm(n) === norm(p.name))?.[1]; const v = x ? x.q / 28 : 0;
    if (v > 0 && t / v > 90) { overAmt += amt; over.push({ n: p.name, t, d: t / v, amt }); } }
  over.sort((x, y) => y.amt - x.amt);
  const cost = v => cr == null ? '' : ` (원가 기준 약 ${man(v * cr / 100)}원)`;
  if (deadN) { I.push(`<b>60일 동안 한 개도 안 팔린 재고</b>: ${fmt(deadN)}종 ${fmt(deadQ)}개 · 판매가 기준 ${man(deadAmt)}원이 묶여 있습니다${cost(deadAmt)}.`); A.push(`<b>줄일 것</b>: 안 팔리는 ${fmt(deadN)}종은 추가 발주를 멈추고 묶음·할인 또는 다른 매장 이동/반품을 검토하세요.`); }
  if (over.length) { I.push(`<b>과재고</b>(지금 속도로 90일 넘게 걸림): ${fmt(over.length)}종 · ${man(overAmt)}원${cost(overAmt)} — ${over.slice(0, 3).map(x => `${esc(x.n)} ${fmt(x.t)}개(${daysTxt(x.d)}분)`).join(' · ')}`); }
  const tied = deadAmt + overAmt, all = S.products.reduce((t, p) => t + Math.max(0, stk(p)) * priceOf(p), 0);
  if (all && tied / all > 0.3) W.push(`남은 재고 금액의 ${Math.round(tied / all * 100)}%(${man(tied)}원)가 안 팔리거나 90일 넘게 걸리는 재고입니다.`);
  if (ips.length >= 2) A.push(`<b>밀 것</b>: 매출 상위 IP ${ips.slice(0, 2).map(x => esc(x.n)).join(' · ')} 상품을 품절 없이 유지하세요.`);
  return { I, A, W };
}
function unitDecision(b, compact) {
  const u = unitStats(b), I = [], A = [], W = [];
  const nm = `<b class="bizname">${esc(b.name)}</b>`;
  if (!u.last) {
    const what = b.id === 'onkihote' ? '아래 <b>네이버 스마트스토어 주문 엑셀</b>을 올려 주세요.' : b.id === 'blog' ? '아래 <b>블로그 월 대행료</b>에 월과 금액을 입력해 주세요.' : b.id === 'kuji' ? '쿠지 매출 올리기는 다음 단계에서 붙습니다. 그 전까지는 토스포스에서 쿠지를 별도 IP(예: “쿠지”)로 등록해 주세요.' : '토스포스 매출 파일을 올려 주세요.';
    return `<div class="card dec"><h2>${nm} <span class="r">분석할 자료 없음</span></h2><div class="note warn">📥 자료가 없어 분석할 수 없습니다. ${what}</div></div>`;
  }
  const mo = +u.ym.slice(5);
  // 요약 타일
  const tiles = [
    [`${mo}월 매출${b.monthly ? '' : ` · ${md(u.last)}까지`}`, `${man(u.cur)}원`, u.ch == null ? '지난달 자료 없음' : `${chg(u.ch)} 지난달 같은 기간 ${man(u.prevSame)}원 대비`],
    [b.monthly ? '최근 3개월 평균' : `${mo}월 예상 (지금 속도)`, b.monthly ? (u.avg3 == null ? '-' : `${man(u.avg3)}원`) : `${man(u.fcast)}원`, u.avg3 == null ? '비교할 지난 달 없음' : `최근 ${'3'}개월 평균 ${man(u.avg3)}원 ${chg(pct(u.fcast, u.avg3))}`],
    ['목표 대비', u.goal ? `${Math.round(u.fcast / u.goal * 100)}%` : '목표 미입력', u.goal ? `목표 ${man(u.goal)}원 · ${u.fcast >= u.goal ? '달성 예상' : `${man(u.goal - u.fcast)}원 부족 예상`}` : '아래 입력칸에 월 목표를 넣으면 계산합니다'],
    ['예상 이익', u.profit == null ? '원가율 미입력' : `${man(u.profit)}원`, u.profit == null ? '원가율·인건비·임대료를 넣으면 계산합니다' : `매출 ${man(u.fcast)} − 원가 ${u.cr}% − 고정비 ${man(u.fixed)}`],
  ];
  // 경고
  if (u.cr == null) W.push(`<b>원가율</b>이 입력되지 않아 이익을 계산할 수 없습니다.`);
  if (!b.monthly && !u.c.labor && !u.c.rent) W.push(`<b>인건비·임대료</b>가 0원입니다. 실제 비용이 있으면 입력해 주세요.`);
  if (u.profit != null && u.fcast) { const mg = u.profit / u.fcast * 100; if (mg < 10) W.push(`이익률이 ${mg.toFixed(1)}%로 낮습니다${u.profit < 0 ? ' (적자 예상)' : ''}.`); }
  if (u.ch != null && u.ch < -10) W.push(`매출이 지난달 같은 기간보다 ${Math.abs(Math.round(u.ch))}% 줄었습니다.`);
  if (u.goal && u.fcast < u.goal * 0.9) W.push(`지금 속도로는 목표의 ${Math.round(u.fcast / u.goal * 100)}%에 그칩니다.`);
  const stale = daysBetween(u.last, today()); if (stale > (b.monthly ? 40 : 3)) W.push(`마지막 자료가 ${md(u.last)}(${stale}일 전)입니다. 최신 자료를 올려 주세요.`);
  // 인사이트
  if (u.ch != null) I.push(`${mo}월 매출이 지난달 같은 기간보다 ${Math.abs(Math.round(u.ch))}% ${u.ch >= 0 ? '많습니다' : '적습니다'} (${man(u.prevSame)}원 → ${man(u.cur)}원).`);
  if (!b.monthly) { const wl = weekdayLine(u.D, u.last); if (wl) I.push(wl); else I.push('<span class="muted">요일별 패턴을 보기엔 자료가 부족합니다(5개 요일 이상 필요).</span>');
    const r = Object.entries(u.D).filter(([d]) => d.slice(0, 7) === u.ym), pp = r.reduce((t, [, x]) => t + (x.p || 0), 0); if (pp) I.push(`${mo}월 건당 평균 ${man(u.cur / pp)}원 · ${fmt(pp)}건.`);
    I.push('<span class="muted">시간대별 매출은 지금 자료(일별 합계)에 없어 보여 주지 않습니다.</span>'); }
  if (b.stores && !compact) { const o = offlineAnalysis(b.stores, u.last, u.cr); I.push(...o.I); A.push(...o.A); W.push(...o.W); }
  if (b.id === 'blog') { if (u.ym < today().slice(0, 7)) W.push(`${+today().slice(5, 7)}월 블로그 대행료가 아직 입력되지 않았습니다.`); }
  if (u.goal && u.fcast < u.goal && !b.monthly) { const rest = new Date(+u.ym.slice(0, 4), mo, 0).getDate() - +u.last.slice(8); if (rest > 0) A.push(`목표를 채우려면 남은 ${rest}일 동안 하루 ${man((u.goal - u.cur) / rest)}원이 필요합니다 (지금 하루 ${man(u.cur / +u.last.slice(8))}원).`); }
  if (!A.length) A.push('<span class="muted">자료로 계산되는 추천 행동이 아직 없습니다.</span>');
  const li = L => `<ul class="dl">${L.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const cfg = compact ? '' : `<details class="dcfg"${u.cr == null ? ' open' : ''}><summary>직접 입력 · 원가율 · 인건비 · 임대료 · 목표</summary><div class="dform">${[['cr', '원가율(%)', u.c.cr], ['labor', '월 인건비(원)', u.c.labor], ['rent', '월 임대료(원)', u.c.rent], ['goal', '월 매출 목표(원)', u.c.goal]].map(([k, t, v]) => `<label class="field"><span>${t}</span><input class="inp" inputmode="numeric" data-dcfg="${b.id}" data-k="${k}" value="${v ?? ''}"></label>`).join('')}<button class="btn pri" data-dcfgsave="${b.id}">저장</button></div><p class="muted" style="font-size:12px;margin:6px 0 0">이 기기에만 저장됩니다.</p></details>`;
  return `<div class="card dec"><h2>${nm} <span class="r">${u.ym.slice(0, 4)}.${u.ym.slice(5)} · 자료 ${md(u.last)}까지</span></h2>
  <div class="tiles">${tiles.map(([l, v, d]) => `<div class="tile"><span class="lb">${l}</span><span class="v">${v}</span><span class="d muted">${d}</span></div>`).join('')}</div>
  <div class="dgrid"><div class="dbox"><h3>🔎 자동 인사이트</h3>${li(I)}</div><div class="dbox"><h3>✅ 추천 행동</h3>${li(A)}</div>${W.length ? `<div class="dbox warn"><h3>⚠️ 경고</h3>${li(W)}</div>` : '<div class="dbox"><h3>⚠️ 경고</h3><p class="muted">✔ 경고할 것이 없습니다</p></div>'}</div>${cfg}</div>`;
}
function decisionHome() {
  const U = BIZ.map(unitStats), ym = bizMonth(), R = U.map(u => ({ u, s: bizSum(u.b, ym).s })), tot = R.reduce((t, r) => t + r.s, 0);
  const prev = U.reduce((t, u) => t + (u.ym === ym && u.pmHas ? u.prevSame : 0), 0), cmpN = U.filter(u => u.ym === ym && u.pmHas).length;
  const P = U.filter(u => u.profit != null), I = [], A = [], W = [];
  const has = R.filter(r => r.s > 0).sort((x, y) => y.s - x.s);
  if (has.length) I.push(`<b>사업부 기여도</b> (${+ym.slice(5)}월): ${has.map(r => `<b class="bizname">${esc(r.u.b.name)}</b> ${Math.round(r.s / tot * 100)}%`).join(' · ')}`);
  if (has.length === 1 && tot) W.push(`매출의 100%가 <b class="bizname">${esc(has[0].u.b.name)}</b> 한 곳에서 나옵니다.`);
  else if (has[0] && has[0].s / tot > 0.8) W.push(`매출의 ${Math.round(has[0].s / tot * 100)}%가 <b class="bizname">${esc(has[0].u.b.name)}</b>에 몰려 있습니다.`);
  for (const u of U) { if (u.ch != null) (u.ch < -10 ? W : I).push(`<b class="bizname">${esc(u.b.name)}</b> 지난달 같은 기간 대비 ${chg(u.ch)}`); }
  const off = U.find(u => u.b.stores && u.last); if (off) { const o = offlineAnalysis(off.b.stores, off.last, off.cr); I.push(...o.I.slice(0, 3)); A.push(...o.A.slice(0, 3)); W.push(...o.W); }
  const miss = U.filter(u => !u.last).map(u => `<b class="bizname">${esc(u.b.name)}</b>`); if (miss.length) W.push(`자료가 없는 사업부: ${miss.join(', ')} → 사업부 매출 화면에서 입력해 주세요.`);
  const nocr = U.filter(u => u.last && u.cr == null).map(u => `<b class="bizname">${esc(u.b.name)}</b>`); if (nocr.length) W.push(`원가율 미입력: ${nocr.join(', ')} → 이익을 계산할 수 없습니다.`);
  if (!A.length) A.push('<span class="muted">자료로 계산되는 추천 행동이 아직 없습니다.</span>');
  const ch = cmpN ? pct(R.filter(r => r.u.ym === ym && r.u.pmHas).reduce((t, r) => t + r.s, 0), prev) : null;
  const li = L => `<ul class="dl">${L.map(x => `<li>${x}</li>`).join('')}</ul>`;
  return `<div class="card dec"><h2>대표 요약 · 오늘의 판단 <span class="r"><button class="btn sm" data-nav="biz">사업부별 분석 ›</button></span></h2>
  <div class="tiles"><div class="tile"><span class="lb">${+ym.slice(5)}월 매출 합계</span><span class="v">${man(tot)}원</span><span class="d muted">${ch == null ? '지난달 비교 자료 없음' : `${chg(ch)} 지난달 같은 기간 대비`}</span></div>
  <div class="tile"><span class="lb">예상 이익 합계</span><span class="v">${P.length ? man(P.reduce((t, u) => t + u.profit, 0)) + '원' : '원가율 미입력'}</span><span class="d muted">${P.length ? `${P.length}개 사업부 기준 · 월말 예상` : '사업부별 원가율을 넣어 주세요'}</span></div>
  <div class="tile"><span class="lb">목표 대비</span><span class="v">${U.some(u => u.goal) ? Math.round(U.reduce((t, u) => t + (u.goal ? u.fcast : 0), 0) / U.reduce((t, u) => t + u.goal, 0) * 100) + '%' : '목표 미입력'}</span><span class="d muted">월말 예상 매출 ÷ 목표</span></div></div>
  <div class="dgrid"><div class="dbox"><h3>🔎 자동 인사이트</h3>${li(I)}</div><div class="dbox"><h3>✅ 추천 행동</h3>${li(A)}</div><div class="dbox${W.length ? ' warn' : ''}"><h3>⚠️ 경고</h3>${W.length ? li(W) : '<p class="muted">✔ 경고할 것이 없습니다</p>'}</div></div></div>`;
}
function bizView() {
  const months = new Set(); for (const b of BIZ) for (const d of Object.keys(bizDays(b))) months.add(d.slice(0, 7));
  const ms = [...months].sort().reverse(); const sel = S.ui.bizF || 'all';
  const shown = sel === 'all' ? BIZ : BIZ.filter(b => b.id === sel);
  const nv = S.ui.naver;
  const pv = nv ? (nv.err ? `<div class="card"><b class="bad">읽지 못했습니다</b><p>${esc(nv.err)}</p><button class="btn" id="naverCancel">닫기</button></div>` : `<div class="card"><h2>미리보기 · ${esc(nv.src)}</h2><p class="muted">맞춘 열: ${Object.entries(nv.map).map(([k, v]) => `${esc(k)} → ${esc(v)}`).join(' · ')}</p><div class="tw"><table><thead><tr><th>날짜</th><th class="n">주문 건수</th><th class="n">수량</th><th class="n">매출(원)</th></tr></thead><tbody>${Object.entries(nv.days).sort().map(([d, v]) => `<tr><td class="nowrap">${md(d)}</td><td class="n">${fmt(v.p)}</td><td class="n">${fmt(v.q)}</td><td class="n">${fmt(v.s)}</td></tr>`).join('')}</tbody></table></div>${nv.skip ? `<p class="muted">취소·반품 등 ${fmt(nv.skip)}줄은 뺐습니다</p>` : ''}<div style="display:flex;gap:8px;margin-top:10px"><button class="btn pri" id="naverSave">온키호테 매출로 반영</button><button class="btn" id="naverCancel">취소</button></div></div>`) : '';
  return `${head('사업부 매출', BIZ.map(b => b.name).join(' · '))}
  <div class="chips">${[['all', '전체'], ...BIZ.map(b => [b.id, b.name])].map(([k, t]) => `<button class="chip ${sel === k ? 'on' : ''}" data-bizf="${k}"><b class="bizname">${esc(t)}</b></button>`).join('')}</div>
  <div class="card"><div class="tw"><table><thead><tr><th>월</th>${shown.map(b => `<th class="n bizname${sel === 'all' ? ' hide-s' : ''}">${esc(b.name)}</th>`).join('')}${sel === 'all' ? '<th class="n">합계</th>' : ''}</tr></thead><tbody>${ms.length ? ms.map(m => { const v = shown.map(b => bizSum(b, m)); return `<tr><td class="nowrap">${m.slice(0, 4)}.${m.slice(5)}</td>${v.map(x => `<td class="n${sel === 'all' ? ' hide-s' : ''}">${x.last ? fmt(x.s) : '<span class="muted">-</span>'}</td>`).join('')}${sel === 'all' ? `<td class="n"><b>${fmt(v.reduce((a, x) => a + x.s, 0))}</b></td>` : ''}</tr>`; }).join('') : `<tr><td colspan="${shown.length + 2}" class="muted">자료 업로드 전</td></tr>`}</tbody></table></div>
  ${shown.filter(b => !bizSum(b).last).map(b => `<p class="muted" style="margin:8px 0 0">${esc(b.name)}: 자료 업로드 전</p>`).join('')}</div>
  <div class="bizlist">${shown.map(b => `<div class="bizrow"><span class="bizname">${esc(b.name)}</span><span class="muted">${esc(b.sub)}</span></div>`).join('')}</div>
  ${shown.map(b => unitDecision(b, sel === 'all' && !b.stores)).join('')}
  ${shown.some(b => b.id === 'blog') ? blogCard() : ''}
  ${shown.some(b => b.id === 'onkihote') ? `<div class="card"><h2><span class="bizname">온키호테</span> · 네이버 스마트스토어 주문 엑셀</h2><div class="drop"><div style="font-weight:700">스마트스토어센터 › 주문조회에서 받은 엑셀(.xlsx)</div><div class="muted" style="font-size:13px;margin:4px 0 10px">상품주문번호 · 주문일시(결제일) · 상품명 · 수량 · 최종 상품별 총 주문금액 열을 자동으로 찾습니다 · 취소·반품 건은 뺍니다 (시험 기능)</div><button class="btn" id="naverFileBtn">파일 고르기</button><div class="muted" style="font-size:12.5px;margin-top:8px">스토어: <a href="https://smartstore.naver.com/marlinshop" target="_blank" rel="noopener">smartstore.naver.com/marlinshop</a> · 상품은 일본 라이선스 승인 후 등록 예정</div></div></div>${pv}` : ''}
  ${soonLine()}
  <p class="muted" style="font-size:13px">쿠지사업 매출 올리기는 다음 단계에서 붙입니다. 온키호테·블로그 자료는 지금은 이 기기에만 저장됩니다(서버 저장은 다음 단계).</p>`;
}
function blogCard() {
  const B = S.biz.blog || {}; const rows = Object.entries(B).sort().reverse();
  return `<div class="card"><h2><span class="bizname">SMG STORE 수원 블로그 운영</span> · 월별 대행료/수익 <span class="r">유온컴퍼니</span></h2>
  <div class="blogform"><div class="field"><label for="blogMonth">월</label><input class="inp" type="month" id="blogMonth" value="${today().slice(0, 7)}"></div>
  <div class="field"><label for="blogAmt">금액(원)</label><input class="inp" id="blogAmt" inputmode="numeric" placeholder="예: 500000"></div>
  <div class="field"><label for="blogMemo">메모</label><input class="inp" id="blogMemo" placeholder="예: 11월 대행료"></div>
  <div class="field"><label>&nbsp;</label><button class="btn pri" id="blogSave">저장</button></div></div>
  ${rows.length ? `<div class="tw"><table><thead><tr><th>월 · 메모</th><th class="n">금액</th></tr></thead><tbody>${rows.map(([d, v]) => `<tr><td>${d.slice(0, 4)}.${d.slice(5, 7)} <span class="muted">${esc(v.memo || '')}</span></td><td class="n">${fmt(v.s)} <button class="btn sm" data-blogdel="${d}">지우기</button></td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">아직 입력한 달이 없습니다.</p>'}</div>`;
}
const NAVER_COLS = { no: ['상품주문번호'], date: ['결제일', '주문일시', '발주확인일', '구매확정일'], name: ['상품명'], qty: ['수량'], amt: ['최종 상품별 총 주문금액', '상품별 총 주문금액', '총 주문금액', '정산예정금액'], st: ['주문상태', '클레임상태'] };
async function readNaver(f) {
  const wb = await readBook(f); let rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
  const hi = rows.findIndex(r => r.some(c => String(c).trim() === '상품주문번호')); if (hi < 0) throw new Error('"상품주문번호" 열을 찾지 못했습니다. 스마트스토어 주문조회 엑셀인지 확인해 주세요. (비밀번호가 걸린 파일이면 풀어서 올려 주세요)');
  const H = rows[hi].map(c => String(c).replace(/\s+/g, ' ').trim()); const ix = {}, map = {};
  for (const [k, cands] of Object.entries(NAVER_COLS)) for (const c of cands) { const i = H.indexOf(c); if (i >= 0) { ix[k] = i; map[k === 'no' ? '주문번호' : k === 'date' ? '날짜' : k === 'name' ? '상품' : k === 'qty' ? '수량' : k === 'amt' ? '금액' : '상태'] = c; break; } }
  if (ix.date == null || ix.amt == null) throw new Error('날짜(주문일시/결제일) 또는 금액(최종 상품별 총 주문금액) 열이 없습니다.');
  const days = {}, seen = new Set(); let skip = 0;
  for (const r of rows.slice(hi + 1)) {
    const no = String(r[ix.no] || '').trim(); if (!no || seen.has(no)) continue; seen.add(no);
    if (ix.st != null && /취소|반품|환불/.test(String(r[ix.st]))) { skip++; continue; }
    let d = r[ix.date]; if (typeof d === 'number') { const o = XLSX.SSF.parse_date_code(d); d = `${o.y}-${String(o.m).padStart(2, '0')}-${String(o.d).padStart(2, '0')}`; } else { const m = String(d).match(/(\d{4})[.\-\/]\s?(\d{1,2})[.\-\/]\s?(\d{1,2})/); if (!m) continue; d = `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`; }
    const x = days[d] ||= { s: 0, p: 0, q: 0 }; x.s += +String(r[ix.amt]).replace(/[^\d.-]/g, '') || 0; x.p++; x.q += +r[ix.qty] || 0;
  }
  if (!Object.keys(days).length) throw new Error('읽을 주문 줄이 없습니다.');
  S.ui.naver = { src: f.name, days, map, skip }; render();
}
function homeView() {
  const st = S.stores;
  const al = alerts(st);
  const tot = st.map(storeStats).reduce((a, b) => ({ qty: a.qty + b.qty, kinds: a.kinds + b.kinds, out: a.out + b.out, neg: a.neg + b.neg }), { qty: 0, kinds: 0, out: 0, neg: 0 });
  const recent = byRecent(S.moves.filter(m => st.includes(m.store))).slice(0, 8);
  const multi = st.length > 1;
  let salesBlock = '';
  if (can('sales') && saleSt(st).length) {
    const st0 = st; { const st = saleSt(st0);
    const last = latestSalesDate(st);
    if (last) {
      const d = st.map(s => dayRec(s, last)).filter(Boolean);
      const s = d.reduce((a, b) => a + b.s, 0), p = d.reduce((a, b) => a + b.p, 0);
      const wk = st.map(x => dayRec(x, addDays(last, -7))).filter(Boolean).reduce((a, b) => a + b.s, 0);
      const ch = pct(s, wk);
      const m1 = last.slice(0, 8) + '01'; const posM = st.reduce((a, x) => { let t = 0; for (let d = m1; d <= last; d = addDays(d, 1)) { const r = dayRec(x, d); if (r) t += r.s; } return a + t; }, 0);
      const mEnd = addDays(addDays(m1, 40).slice(0, 8) + '01', -1); const ML = machAgg(st, m1, mEnd);
      const macM = ML.reduce((a, m) => a + m.s, 0), machLast = ML.reduce((a, m) => (m.last > a ? m.last : a), '');
      salesBlock = `<button class="tile tbtn" data-nav="sales"><span class="lb">${+last.slice(5, 7)}월 총매출 <span class="go">매출 ›</span></span><span class="v big${String(fmt(posM + macM)).length > 9 ? ' long' : ''}">${fmt(posM + macM)}<small>원</small></span><span class="d muted">토스포스 ${md(last)}까지 ${man(posM)} + 기계 ${machLast ? md(machLast) + '까지 ' : ''}${man(macM)}</span></button>` + `<button class="tile tbtn" data-hday="${last}"><span class="lb">매출 · ${md(last)} <span class="go">상세 ›</span></span><span class="v big${String(fmt(s)).length>9?' long':''}">${fmt(s)}<small>원</small></span><span class="d ${ch == null ? 'muted' : ch >= 0 ? '' : ''}">${ch == null ? '지난주 같은 요일 자료 없음' : `${chg(ch)} 지난주 같은 요일 대비`} · ${fmt(p)}건</span></button>`;
    } }
  }
  const bizBlock = can('sales') ? bizCards() + decisionHome() : '';
  return `${bizBlock}${head(multi ? `${st.length}개 매장 요약` : storeName(st[0]), `${freshLine(st) || '아직 반영된 자료가 없습니다'}${limited() ? ' · 재고 수량만 볼 수 있는 계정입니다' : ''}`, installBtn('sm'))}
  ${freshTable(st)}
  <div class="note" style="font-size:12.5px">ℹ︎ 실시간 자료가 아닙니다. 판매는 <b>토스포스 매출 파일</b>을 올려야, 입고·이동은 <b>등록</b>해야 재고에 반영됩니다. 위 시각을 확인해 주세요.</div>
  ${ceoKpi(st)}
  ${limited() ? '' : todoBox(st)}
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
    const per = r.d1 ? (r.d1 === r.d2 ? md(r.d1) : `${md(r.d1)} ~ ${md(r.d2)}`) : '';
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
function deadNote(st) {
  const V60 = velocity(saleSt(st), 60); if (!V60.stores.length) return '<div class="muted" style="font-size:12.5px">재고 일수·악성재고는 토스포스 판매 차감 기록이 있는 매장만 계산합니다 (지금 선택한 매장엔 기록 없음).</div>';
  let amt = 0, n = 0, q = 0; for (const p of S.products) { if (V60.v[p.id]) continue; for (const s of V60.stores) { const x = stockOf(s, p.id); if (x > 0) { amt += x * priceOf(p); q += x; n++; } } }
  return `<button class="deadbar" data-pf="dead"><span>악성재고 <small>60일간 안 팔린 재고 · ${V60.stores.map(shortName).join(', ')}</small></span><b>${fmt(amt)}<small>원</small></b><span class="muted">${fmt(n)}종 ${fmt(q)}개 ›</span></button>`;
}
function productRows() {
  const q = norm(S.ui.q), st = S.stores, V = velocity(saleSt(st)), V60 = velocity(saleSt(st), 60);
  let rows = S.products.map(p => {
    const per = st.map(s => stockOf(s, p.id)); const t = per.reduce((a, b) => a + b, 0);
    const has = st.some(s => (S.stock[s] || {})[p.id] != null);
    const sold = V.v[p.id] || 0, days = stockDays(t, sold, V.days), dead = t > 0 && !V60.v[p.id] && st.some(s => stockOf(s, p.id) > 0 && V60.stores.includes(s));
    return { p, per, t, has, sold, days, dead };
  }).filter(r => r.has || S.ui.f === 'allp');
  if (q) rows = rows.filter(r => norm(r.p.name).includes(q) || (r.p.barcode || '').includes(S.ui.q.trim()) || norm(r.p.sku).includes(q) || norm(r.p.ip).includes(q));
  if (S.ui.ip) rows = rows.filter(r => r.p.ip === S.ui.ip);
  if (S.ui.f === 'out') rows = rows.filter(r => r.t === 0);
  if (S.ui.f === 'neg') rows = rows.filter(r => r.t < 0 || r.per.some(x => x < 0));
  if (S.ui.f === 'in') rows = rows.filter(r => r.t > 0);
  if (S.ui.f === 'low') rows = rows.filter(r => r.t > 0 && r.t <= LOW_QTY && r.sold > 0 && r.days <= LOW_DAYS);
  if (S.ui.f === 'dead') rows = rows.filter(r => r.dead);
  if (S.ui.f === 'risk') rows = rows.filter(r => r.sold > 0 || r.t < 0);
  if (['risk', 'low'].includes(S.ui.f)) rows.sort((a, b) => a.days - b.days || b.sold - a.sold);
  else if (S.ui.f === 'dead') rows.sort((a, b) => b.t * priceOf(b.p) - a.t * priceOf(a.p));
  else rows.sort((a, b) => (a.p.ip || '').localeCompare(b.p.ip || '', 'ko') || a.p.name.localeCompare(b.p.name, 'ko'));
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
    <div class="chips">${[['all', '재고 등록 상품'], ['in', '재고 있음'], ['out', '품절'], ['neg', '마이너스'], ['risk', '품절 위험순'], ['low', `품절 임박 (${LOW_QTY}개↓·${LOW_DAYS}일 내)`], ['dead', '악성재고']].map(([k, t]) => `<button class="chip ${S.ui.f === k ? 'on' : ''}" data-pf="${k}">${t}</button>`).join('')}</div>
    ${deadNote(st)}
  </div>
  <div class="card" style="padding:8px 12px">
    ${rows.length ? `<div class="tw"><table><thead><tr><th>상품명</th><th class="hide-s">IP</th><th class="hide-s">바코드·품번</th>${multi ? st.map(s => `<th class="n">${sdot(s)}${esc(shortName(s))}</th>`).join('') : ''}<th class="n">${multi ? '합계' : '재고'}</th><th class="n" title="재고 ÷ 최근 28일 하루 평균 판매">재고 일수</th><th class="hide-s">상태</th></tr></thead><tbody>
      ${shown.map(r => `<tr class="click" data-pid="${esc(r.p.id)}"><td class="nm">${esc(r.p.name)}</td><td class="hide-s nowrap">${esc(r.p.ip)}</td><td class="code hide-s">${esc(r.p.barcode || r.p.sku)}</td>
        ${multi ? r.per.map(x => `<td class="n ${x < 0 ? 'qty-neg' : x === 0 ? 'qty-zero' : ''}">${fmt(x)}</td>`).join('') : ''}<td class="n big ${r.t < 0 ? 'qty-neg' : r.t === 0 ? 'qty-zero' : ''}" style="font-size:16px">${fmt(r.t)}</td><td class="n nowrap ${r.t > 0 && r.days <= 7 ? 'qty-neg' : r.dead ? 'muted' : ''}">${r.t <= 0 ? '–' : r.dead ? '<span class="pill p-warn">60일 무판매</span>' : daysTxt(r.days)}</td><td class="hide-s">${statusPill(r.t)}</td></tr>`).join('')}
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
  return { title: `재고 현황 · ${stTxt}`, cond: `${md(o.date)} ${isToday ? '현재' : '마감 기준'} · ${ipTxt} · ${f} · ${n}종`, made: kst(new Date().toISOString()), who: whoText(S.user.name, userCo(S.user)), stTxt, ipTxt };
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
    basis: `기준 자료: ${md(pd)} 마감 재고 + ${md(from)} ~ ${md(to)} 입고·판매·기타(이동·실사 조정) · ${o.stores.length > 1 ? `${o.stores.length}개 매장 합계` : M.stTxt}`,
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
  const FR = TR + 3 + N.length; put(FR, 0, `기준: ${fd(o.date)} ${o.date >= today() ? '현재' : '영업 마감'} · 출력 ${M.made} · ${M.who}`, { font: { ...F, sz: 9, color: { rgb: '888888' } } });
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
  <div class="ft">기준: ${fd(o.date)} ${o.date >= today() ? '현재' : '영업 마감'} · 출력 ${e(M.made)} · ${e(M.who)}</div>
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
// 최근 것부터: 날짜 → 같은 날이면 입력한 시각 순
function byRecent(L) { return L.map((m, i) => [m, i]).sort((a, b) => (b[0].date || '').localeCompare(a[0].date || '') || (b[0].at || '').localeCompare(a[0].at || '') || b[1] - a[1]).map(x => x[0]); }
function movesTable(list, withName = true, compact = false) {
  if (!list.length) return '<div class="empty">기록이 없습니다</div>';
  return `<div class="tw"><table><thead><tr><th class="hide-s">날짜</th>${S.stores.length > 1 || compact ? '<th class="hide-s">매장</th>' : ''}<th class="hide-s">구분</th>${withName ? '<th>상품명</th>' : '<th class="show-s">내용</th>'}<th class="n">수량</th><th class="hide-s">메모</th></tr></thead><tbody>
  ${list.map(m => `<tr><td class="nowrap num hide-s" style="text-align:left">${md(m.date)}</td>${S.stores.length > 1 || compact ? `<td class="nowrap hide-s">${sdot(m.store)}${esc(shortName(m.store))}</td>` : ''}<td class="hide-s">${typePill(m.type)}</td>${withName ? `<td class="nm"><span class="show-s muted" style="font-size:12px">${md(m.date)} · ${S.stores.length > 1 || compact ? esc(shortName(m.store)) + ' · ' : ''}${typePill(m.type)}<br></span>${esc((S.P[m.pid] || {}).name || m.pid)}</td>` : `<td class="show-s muted" style="font-size:12px">${md(m.date)} · ${typePill(m.type)}</td>`}<td class="n ${m.qty < 0 ? 'qty-neg' : ''}" style="font-weight:600">${m.qty > 0 ? '+' : ''}${fmt(m.qty)}</td><td class="hide-s muted" style="font-size:12px">${esc(m.memo || '')}${m.by && !/claude/i.test(m.by) ? ` · ${esc(m.by === '자동(POS)' ? (m.upBy ? `POS 파일 · ${whoText(m.upBy, m.co)}` : '자동(POS)') : whoText(m.by, m.co))}` : ''}${m.file ? `<br><span style="font-size:11px">📎 ${esc(m.file)}</span>` : ''}</td></tr>`).join('')}
  </tbody></table></div>`;
}
function typePill(t) { const pos = ['입고', '창고에서 가져옴', '매장 이동(받음)']; return `<span class="pill ${t === COUNT_TYPE ? 'p-info' : pos.includes(t) ? 'p-ok' : t === '판매' ? 'p-mute' : 'p-warn'}">${esc(t)}</span>`; }

/* ───────── 외부 장소 ───────── */
const placeById = id => allPlaces().find(p => p.id === id);
function placeLabel(p) {
  if (!p) return '';
  const per = p.start ? ` · ${p.end && p.end !== p.start ? fr(p.start, p.end) : fd(p.start)}` : '';
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
    const num = v => { const t = String(v ?? '').replace(/[,원\s]|개$|ea$|pcs$/gi, ''); if (t === '') return null; const n = Number(t); return isNaN(n) ? null : n; };
    let cand = bc ? findProduct(bc) : []; if (!cand.length && sku) cand = findProduct(sku); if (!cand.length && name) cand = S.byName[norm(name)] || [];
    out.push({ line: i + 1, name, bc, sku, qty: num(g('qty')), price: num(g('price')), ip: g('ip'), pid: cand.length === 1 ? cand[0].id : '', multi: cand.length > 1 });
  }
  return { rows: out, header: det.r + 1 };
}
async function fileRows(f) {
  if (/\.(pdf)$/i.test(f.name)) throw new Error('PDF는 입력할 수 없습니다. 엑셀·구글시트 또는 화면 캡처 사진으로 올려 주세요.');
  if (isImg(f)) throw new Error('사진은 입고 예정 등록에서 [사진·캡처로 올리기]로 올려 주세요.');
  const wb = await readBook(f);
  const best = bestSheet(wb);
  return { rows: best ? best.rows : [], src: f.name + (best && wb.SheetNames.length > 1 ? ' › ' + best.n : '') };
}
async function linkRows(url) { await needX();
  const m = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/); const g = url.match(/[#&?]gid=(\d+)/);
  if (!m) throw new Error('구글시트 링크가 아닙니다.');
  if (S.mode === 'demo') throw new Error('미리보기 화면에서는 외부 링크를 열 수 없습니다. 실제 앱에서는 "링크가 있는 모든 사용자" 공유 시트를 바로 읽습니다.');
  const r = await fetch(`https://docs.google.com/spreadsheets/d/${m[1]}/gviz/tq?tqx=out:csv${g ? '&gid=' + g[1] : ''}`); if (!r.ok) throw new Error('시트를 열지 못했습니다. 공유를 "링크가 있는 모든 사용자 · 뷰어"로 바꿔 주세요.');
  const wb = XLSX.read(await r.text(), { type: 'string' }); return { rows: XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' }), src: '구글시트' };
}
/* ───────── 사진·캡처로 입고 예정 읽기 (Firebase AI Logic → 안 되면 기기 안 글자 읽기) ───────── */
const IMG_RE = /\.(png|jpe?g|heic|heif|gif|webp|bmp)$/i;
const isImg = f => /^image\//.test(f.type || '') || IMG_RE.test(f.name || '');
const IMG_HDR = ['상품명', '바코드', '품번', '수량', '가격', '입고 예정일', '매장'];
async function imgBitmap(f) {
  let blob = f;
  if (/heic|heif/i.test(f.type || '') || /\.(heic|heif)$/i.test(f.name || '')) {
    try { return await createImageBitmap(f); } catch (e) { /* 크롬 등: 변환 */ }
    if (!window.heic2any) await loadScript('https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js');
    blob = await window.heic2any({ blob: f, toType: 'image/jpeg', quality: 0.92 }); if (Array.isArray(blob)) blob = blob[0];
  }
  return await createImageBitmap(blob);
}
// 긴 변 maxSide 이하로 줄이고(작으면 키우고) JPEG로
async function imgPrep(f, maxSide, minSide, gray) {
  const bm = await imgBitmap(f); let s = Math.min(1, maxSide / Math.max(bm.width, bm.height)); if (minSide && Math.max(bm.width, bm.height) * s < minSide) s = minSide / Math.max(bm.width, bm.height);
  const c = document.createElement('canvas'); c.width = Math.round(bm.width * s); c.height = Math.round(bm.height * s);
  const x = c.getContext('2d'); if (gray) x.filter = 'grayscale(1) contrast(1.25)'; x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(bm, 0, 0, c.width, c.height);
  return c;
}
const cvB64 = c => c.toDataURL('image/jpeg', 0.9).split(',')[1];
// 1) Firebase AI Logic (Gemini) — 표를 줄 단위 JSON으로
let aiOff = false;
const AI_MODELS = [['gemini-flash-lite-latest', 40000], ['gemini-flash-latest', 40000], ['gemini-3.8-flash', 45000]];   // 무료 한도가 넉넉한 lite 먼저
async function aiRows(files) {
  const cfg = window.SMG_CONFIG; if (aiOff || !cfg || !cfg.apiKey || (S.mode === 'demo' && !window.SMG_AI_TEST)) throw new Error('ai off');
  const parts = [{ text: '이 이미지(들)는 매장으로 들어올 상품 리스트입니다 (엑셀 캡처, 카카오톡 메시지, 거래명세서 등). 상품 한 줄마다 상품명, 바코드(8~14자리 숫자), 품번(상품코드), 수량, 가격(단가), 입고 예정일(YYYY-MM-DD), 매장/위치를 읽어 주세요. 이미지에 보이는 글자·숫자를 그대로 옮기고 추측하지 마세요. 없는 값은 빈 문자열, 수량·가격은 숫자만. 합계·소계 줄과 제목 줄은 빼세요. 여러 이미지면 순서대로 이어 주세요.' }];
  for (const f of files) parts.push({ inlineData: { mimeType: 'image/jpeg', data: cvB64(await imgPrep(f, 2048)) } });
  const str = { type: 'STRING' }, num = { type: 'NUMBER', nullable: true };
  const body = { contents: [{ role: 'user', parts }], generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: { type: 'OBJECT', properties: { rows: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: str, barcode: str, sku: str, qty: num, price: num, date: str, store: str }, required: ['name', 'qty'] } } }, required: ['rows'] } } };
  let j = null, last = '';
  for (const [m, ms] of AI_MODELS) {   // 정확한 모델 먼저, 붐비면 가벼운 모델
    const ac = new AbortController(); const to = setTimeout(() => ac.abort(), ms);
    try { const r = await fetch(`https://firebasevertexai.googleapis.com/v1beta/projects/${cfg.projectId}/models/${m}:generateContent`, { method: 'POST', signal: ac.signal, headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey }, body: JSON.stringify(body) });
      if (r.ok) { j = await r.json(); j.model = m; break; } last = 'ai ' + r.status; if (r.status === 403) { aiOff = true; break; } }
    catch (e) { last = 'ai timeout'; } finally { clearTimeout(to); }
  }
  if (!j) throw new Error(last);
  const t = (((j.candidates || [])[0] || {}).content || {}).parts || [];
  aiRows.model = j.model;
  return (JSON.parse(t.filter(p => !p.thought).map(p => p.text || '').join('')).rows || []);
}
// 2) 기기 안에서 글자 읽기 (Tesseract 한국어+영어) → 칸 나누기
async function ocrRows(files, prog) {
  if (!window.Tesseract) await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
  const w = await Tesseract.createWorker('kor+eng', 1, { logger: m => { if (m.status === 'recognizing text' && prog) prog(m.progress); } });
  await w.setParameters({ preserve_interword_spaces: '1', tessedit_pageseg_mode: '6' });
  const out = [];
  try { for (const f of files) { const { data } = await w.recognize(await imgPrep(f, 3000, 1800, true), { rotateAuto: true }); const rs = ocrToRows(data); const dm = (data.text || '').match(/(20\d{2})\s*[.\-/년]\s*(\d{1,2})\s*[.\-/월]\s*(\d{1,2})/); if (dm && rs[0]) rs[0].date = `${dm[1]}-${dm[2]}-${dm[3]}`; out.push(...rs); } } finally { w.terminate(); }
  return out;
}
function ocrToRows(data) {
  const lines = (data.lines || []).filter(l => l.words && l.words.length && l.confidence > 20);
  // 줄 → 칸 (글자 사이 간격이 줄 높이보다 넓으면 다른 칸)
  const cellLines = lines.map(l => { const h = Math.max(8, l.bbox.y1 - l.bbox.y0); const cells = []; let cur = null;
    for (const wd of l.words) { const tx = wd.text.trim(); if (!tx || /^[|│┃]+$/.test(tx)) { cur = null; continue; } if (cur && wd.bbox.x0 - cur.x1 < h * 0.9) { cur.t += (/[가-힣]$/.test(cur.t) && /^[가-힣]/.test(tx) && wd.bbox.x0 - cur.x1 < h * 0.38 ? '' : ' ') + tx; cur.x1 = wd.bbox.x1; } else { cur = { t: tx.replace(/^[|│]/, ''), x0: wd.bbox.x0, x1: wd.bbox.x1 }; cells.push(cur); } }
    return cells.map(c => ({ ...c, t: c.t.replace(/[|│]/g, '').trim() })).filter(c => c.t); });
  const asRows = cellLines.map(cs => cs.map(c => c.t));
  const det = detectCols(asRows, QTY_PLAN);
  const res = [];
  if (det && det.map.qty != null && (det.map.name != null || det.map.barcode != null || det.map.sku != null)) {
    const H = cellLines[det.r]; const cx = c => (c.x0 + c.x1) / 2; const h0 = Math.max(8, lines[det.r].bbox.y1 - lines[det.r].bbox.y0);
    for (let i = det.r + 1; i < cellLines.length; i++) { const row = []; for (const c of cellLines[i]) { const m = cx(c) + h0 * 0.5; let bi = 0; H.forEach((hc, k) => { if (hc.x0 <= m) bi = k; }); row[bi] = row[bi] ? row[bi] + ' ' + c.t : c.t; }
      const g = k => det.map[k] != null ? String(row[det.map[k]] || '').trim() : '';
      res.push({ name: g('name'), barcode: g('barcode').replace(/\D/g, ''), sku: g('sku'), qty: g('qty'), price: g('price') });
    }
    return res;
  }
  // 제목 줄이 없을 때 (카톡 등): "상품명 … 10개" — 끝쪽 숫자를 수량으로
  for (const cs of cellLines) { const t = cs.map(c => c.t).join(' '); const bc = (t.match(/\b\d{8,14}\b/) || [''])[0]; const rest = t.replace(bc, ' ');
    const q = rest.match(/(\d[\d,]*)\s*(개|ea|EA|pcs|박스|입)?\s*$/); if (!q) continue; const name = rest.slice(0, q.index).replace(/[-:·x×*]\s*$/, '').trim(); if (!name && !bc) continue;
    res.push({ name, barcode: bc, sku: '', qty: q[1], price: '' }); }
  return res;
}
async function imgPlanRows(files, prog) {
  let objs = null, how = '';
  try { objs = await aiRows(files); how = 'AI'; } catch (e) { objs = null; }
  if (!objs) { objs = await ocrRows(files, prog); how = '글자 읽기'; }
  const rows = [IMG_HDR, ...objs.map(o => [o.name || '', String(o.barcode || '').replace(/\D/g, ''), o.sku || '', o.qty == null ? '' : String(o.qty).replace(/[^\d.,-]/g, ''), o.price == null ? '' : String(o.price).replace(/[^\d.,]/g, ''), o.date || '', o.store || ''])];
  if (!objs.length) throw new Error('사진에서 상품 줄을 찾지 못했습니다. 표가 잘 보이게 다시 찍거나 캡처해 주세요.');
  const nm = files.length > 1 ? `사진 ${files.length}장` : (files[0].name && !/^image\.\w+$/.test(files[0].name) ? files[0].name : '붙여넣은 사진');
  return { rows, src: nm, img: how, meta: objs };
}
function ibImages(files) {
  const f = S.ui.ibForm; if (!f) return; files = files.filter(isImg); if (!files.length) return;
  f.err = ''; f.busy = '사진에서 표를 읽는 중…'; render();
  imgPlanRows(files, p => { const b = document.getElementById('ibBusy'); if (b) b.textContent = `사진에서 글자를 읽는 중… ${Math.round(p * 100)}%`; })
    .then(x => { f.busy = ''; f.img = x.img;
      const d = x.meta.map(o => String(o.date || '').replace(/[./]/g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)).find(Boolean); if (d) f.date = `${d[1]}-${d[2].padStart(2, '0')}-${d[3].padStart(2, '0')}`;
      const st = x.meta.map(o => o.store).find(Boolean); if (st) { const hit = myStores().find(s => norm(storeName(s)).includes(norm(st)) || norm(st).includes(norm(storeName(s)))); if (hit) f.store = hit; }
      ibPlanLoaded(x); })
    .catch(e => { f.busy = ''; f.err = e.message || String(e); render(); });
}
const itemKey = r => r.pid ? 'p:' + r.pid : 'n:' + (r.bc || r.sku || norm(r.name));
function ibStats(ib) {
  const it = ib.items; const plan = it.reduce((a, b) => a + (b.plan || 0), 0);
  const done = it.filter(x => x.actual != null); const act = done.reduce((a, b) => a + b.actual, 0) + (ib.extra || []).reduce((a, b) => a + (b.actual || 0), 0);
  const diff = it.filter(x => x.actual != null && x.actual !== x.plan).length + (ib.extra || []).length;
  const money = k => it.reduce((a, b) => a + (b.price || 0) * ((k === 'plan' ? b.plan : b.actual) || 0), 0) + (k === 'act' ? (ib.extra || []).reduce((a, b) => a + (b.price || 0) * (b.actual || 0), 0) : 0);
  return { plan, act, done: done.length, left: it.length - done.length, diff, planMoney: money('plan'), actMoney: money('act') };
}
function ibSteps(n) {
  const t = ['1 예정 올리기', '2 실입고 올리기', '3 비교·확정'];
  return `<div class="ibsteps">${t.map((x, i) => `<span class="${i + 1 === n ? 'on' : i + 1 < n ? 'done' : ''}">${x}</span>${i < 2 ? '<i>→</i>' : ''}`).join('')}</div>`;
}
function ibPhase(ib) {
  if (!ib) return 1;
  if (ib.status === 'received') return 3;
  if ((ib.items || []).some(x => x.actual != null) || (ib.extra || []).length) return 3;
  return 2;
}
function ibCard(name, code, bits, bad) {
  return `<div class="grow${bad ? ' bad' : ''}"><b>${esc(name)}</b>${code ? `<div class="code">${esc(code)}</div>` : ''}<div class="gnums">${bits}</div></div>`;
}
function inboundView() {
  const list = S.inbounds.filter(x => S.stores.includes(x.store)).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (S.ui.ib === 'new') return ibNewView();
  const ib = S.inbounds.find(x => x.id === S.ui.ib);
  if (ib) return ibDetailView(ib);
  return `${head('입고 확인', '입고 예정 파일을 올리고, 나중에 실입고 수량을 올려 비교합니다', '<button class="btn pri" id="ibNew">입고 예정 올리기</button>')}
  <div class="glist">${list.map(x => { const ph = ibPhase(x); return `<button type="button" class="grow" data-ib="${esc(x.id)}"><b>${esc(x.title)}</b><div class="code">${esc(storeName(x.store))} · ${x.items.length}종 · ${ph === 3 && x.status === 'received' ? '입고 완료' : ph === 3 ? '비교·확정' : '실입고 대기'}</div></button>`; }).join('') || '<p class="src">아직 입고 예정이 없습니다.</p>'}</div>`;
}
function ibNewView() {
  const f = S.ui.ibForm ||= { store: S.stores[0], date: today(), title: '', ip: '', from: '', parsed: null, src: '', err: '' };
  const P = (f.parsed || []).filter(r => (r.qty > 0) || (r.actual > 0));
  const known = P.filter(r => r.pid).length, nw = P.length - known;
  const blank = (f.parsed || []).length - P.length;
  return `${head('입고 확인', '1단계 · 입고 예정', P.length ? '<button class="btn pri" data-act="ibCreate">입고 예정 등록</button>' : '<button class="btn" id="ibBack">목록</button>')}
  ${ibSteps(1)}
  <div class="card cntbox">
    <div class="sgrid">${myStores().map(s => `<button type="button" class="sbtn ${f.store === s ? 'on' : ''}" data-ibstore="${s}">${esc(shortName(s))}</button>`).join('')}</div>
    ${P.length ? `<div class="row cntacts"><button class="btn" id="ibSheetFile">엑셀 다시 올리기</button></div>` : `<label class="lb" for="ibPaste">입고 예정 붙여넣기</label>
    <textarea class="inp cntpaste" id="ibPaste" placeholder="구글 시트에서 복사해 붙이세요"></textarea>
    <div class="row cntacts"><button class="btn pri" id="ibSheetFile">엑셀 올리기</button></div>`}
    ${f.err ? `<p class="cntwhy bad">${esc(f.err)}</p>` : ''}
    ${P.length ? `<p class="cntwhy">상품 ${P.length}종 읽음 · ${esc(f.src || '')} · 기존 ${known} · 새 상품 ${nw}${blank ? ` · 빈 줄 ${blank}개 제외` : ''}${ibDupWarn()}</p>` : '<p class="src">표를 붙이거나 엑셀을 올리세요.</p>'}
    ${P.length ? `<div class="glist">${P.map(r => ibCard(r.pid && S.P[r.pid] ? S.P[r.pid].name : r.name, `${r.bc || ''}${r.lines > 1 ? ' · ' + r.lines + '줄 합침' : ''} · ${r.pid ? '기존' : '새 상품'}`, `<span>예정 ${fmt(r.qty)}</span>${r.actual != null ? `<span>실입고 ${fmt(r.actual)}</span>` : ''}`, false)).join('')}</div>` : ''}
  </div>
  ${P.length ? `<div class="cntregbar"><p class="cntwhy">상품 ${P.length}종</p><button class="btn pri" data-act="ibCreate">입고 예정 등록</button></div>` : ''}`;
}
function ibDetailView(ib) {
  const phase = ibPhase(ib);
  const done = ib.status === 'received';
  const only = !!S.ui.ibOnly;
  const rows = ib.items.map(x => ({ ...x, d: x.actual == null ? null : x.actual - (x.plan || 0) }));
  const extra = ib.extra || [];
  const same = rows.filter(r => r.d === 0).length;
  const diff = rows.filter(r => r.d != null && r.d !== 0).length;
  const miss = rows.filter(r => r.actual == null || (r.plan > 0 && r.actual === 0)).length;
  const sum = `${rows.length + extra.length}종 중 일치 ${same} · 차이 ${diff} · 예정에 없던 상품 ${extra.length} · 미입고 ${miss}`;
  const show = r => !only || r.d !== 0;
  const cards = rows.filter(show).map(r => ibCard(r.name, r.code || '', `<span>예정 ${fmt(r.plan)}</span><span>실입고 ${r.actual == null ? '—' : fmt(r.actual)}</span><span class="${r.d ? 'bad' : ''}">차이 ${r.d == null ? '—' : (r.d > 0 ? '+' : '') + fmt(r.d)}</span>`, r.d)).join('')
    + extra.filter(() => !only || true).map(r => ibCard(r.name, (r.code || '') + ' · 예정에 없던 상품', `<span>예정 0</span><span>실입고 ${fmt(r.actual)}</span><span class="bad">차이 +${fmt(r.actual)}</span>`, true)).join('');
  return `${head('입고 확인', esc(ib.title), phase === 3 && !done ? '<button class="btn pri" data-act="ibConfirm">실제 수량으로 입고 확정</button>' : '<button class="btn" id="ibBack">목록</button>')}
  ${ibSteps(phase)}
  ${phase === 2 ? `<div class="card cntbox"><p class="cntwhy">예정 ${ib.items.length}종. 실입고 수량을 올리세요.</p>
    <label class="lb" for="ibActPaste">실입고 붙여넣기</label>
    <textarea class="inp cntpaste" id="ibActPaste" placeholder="실입고 수량 표를 붙이세요"></textarea>
    <button class="btn pri" id="ibActFile">실입고 엑셀 올리기</button>
    ${S.ui.ibMsg ? `<p class="src">${esc(S.ui.ibMsg.t)}</p>` : ''}
    <div class="glist">${ib.items.map(x => ibCard(x.name, x.code || '', `<span>예정 ${fmt(x.plan)}</span>`, false)).join('')}</div></div>` : ''}
  ${phase === 3 ? `<div class="card cntbox"><p class="cntwhy">${sum}</p>
    <button class="btn" type="button" id="ibOnly">${only ? '전체 보기' : '차이만'}</button>
    <div class="glist">${cards || '<p class="src">보이는 상품이 없습니다.</p>'}</div></div>
    ${done ? '' : `<div class="cntregbar"><p class="cntwhy">${sum}</p><button class="btn pri" data-act="ibConfirm">실제 수량으로 입고 확정</button></div>`}` : ''}`;
}
function ibApplyActual(ib, rows, src) {
  ib.actSrc = src; ib.actBy = S.user ? S.user.name : ''; ib.actCo = userCo(S.user); ib.actAt = new Date().toISOString(); ib.actUid = S.user ? S.user.uid : '';
  const byKey = {}; ib.items.forEach((x, i) => { byKey[x.key] = i; });
  let matched = 0, extra = 0;
  const add = {}; for (const r of rows) { if (!(r.qty >= 0) || r.qty === null) continue; const k = itemKey(r); add[k] = (add[k] || { r, q: 0 }); add[k].q += r.qty; }
  for (const [k, { r, q }] of Object.entries(add)) {
    let i = byKey[k];
    if (i == null && r.bc) i = ib.items.findIndex(x => x.bc === r.bc || x.code === r.bc);
    if (i == null && r.name) i = ib.items.findIndex(x => norm(x.name) === norm(r.name));
    if (i != null && i >= 0) { ib.items[i].actual = q; matched++; }
    else { ib.extra = (ib.extra || []).filter(x => x.key !== k); ib.extra.push({ key: k, pid: r.pid, name: r.pid ? S.P[r.pid].name : r.name, code: r.bc || r.sku, bc: r.bc, sku: r.sku, ip: r.ip, actual: q, price: r.price }); extra++; }
  }
  S.ui.ibMsg = { t: `${src}: 예정 상품 ${matched}종 수량을 넣었습니다${extra ? ` · 예정에 없던 상품 ${extra}종` : ''}.` };
}
function ibDupWarn() {
  const hit = (S.inbounds || []).filter(x => x.id === 'IB-261112-AOT' || (x.status !== 'received' && /AOT|진격/.test((x.title || '') + (x.ip || ''))));
  if (!hit.length) return '';
  return ` · 이미 있는 예정 ${hit.map(x => x.id === 'IB-261112-AOT' ? 'IB-261112-AOT' : x.title).join(', ')}`;
}
function ibApplyCountRows(rows, src) {
  const f = S.ui.ibForm; const parsed = countParseRows(rows, null);
  if (parsed.err) { f.err = parsed.err; f.parsed = null; render(); return; }
  const map = new Map();
  for (const r of parsed.items || []) {
    if (r.plan == null && r.qty == null) continue;
    const key = r.bc || norm(r.name); if (!key) continue;
    const g = guessIpCat(r.name);
    const actual = r.countCol && r.qty != null ? r.qty : null;
    const plan = r.plan != null ? r.plan : (actual != null ? actual : (r.qty || 0));
    const prev = map.get(key);
    if (prev) { prev.qty += plan || 0; if (actual != null) prev.actual = (prev.actual || 0) + actual; prev.lines++; }
    else map.set(key, { line: map.size + 1, name: r.name, bc: r.bc, sku: r.sku, qty: plan || 0, actual, pid: r.pid, ip: g.ip, cat: g.cat, vendor: r.vendor || '', price: null, lines: 1 });
  }
  f.parsed = [...map.values()]; f.err = f.parsed.length ? '' : '수량 줄을 찾지 못했습니다.'; f.src = src; f.img = '';
  if (!f.title) f.title = String(src || '').replace(/\.(xlsx|xls|csv).*$/i, '');
  if (!f.ip) { const ip = f.parsed.map(x => x.ip).find(Boolean); if (ip) f.ip = ip; }
  render();
}
function ibPlanLoaded(x) { const f = S.ui.ibForm; if (countParseRows(x.rows, null).items) { ibApplyCountRows(x.rows, x.src); return; } f.img = x.img || ''; const t = readTable(x.rows, QTY_PLAN); f.err = t.err || ''; f.parsed = t.rows || null; f.src = x.src; if (!f.title) f.title = x.src.replace(/\.(xlsx|xls|csv|png|jpe?g|heic|heif|webp)( › .*)?$/i, ''); render(); }
async function stockReadFile(f) {
  await needX();
  const buf = await f.arrayBuffer();
  const head = XLSX.read(buf, { type: 'array', sheetRows: 60 });
  let best = null;
  for (const name of head.SheetNames) {
    const parsed = countParseRows(sheetRowsOf(head.Sheets[name]), null);
    const n = (parsed.items || []).filter(r => r.qty != null || r.plan != null).length;
    if (n && (!best || n > best.n)) best = { name, n };
  }
  if (!best) throw new Error('상품과 수량 칸이 있는 탭을 찾지 못했습니다.');
  const full = XLSX.read(buf, { type: 'array', sheets: [best.name] });
  return { rows: sheetRowsOf(full.Sheets[best.name]), src: f.name + (head.SheetNames.length > 1 ? ' › ' + best.name : '') };
}
async function ibReadFile(f) {
  const form = S.ui.ibForm; form.busy = '엑셀을 읽는 중…'; form.err = ''; render();
  try {
    await needX();
    const buf = await f.arrayBuffer();
    const head = XLSX.read(buf, { type: 'array', sheetRows: 50 });
    let best = null;
    for (const n of head.SheetNames) {
      const rows = sheetRowsOf(head.Sheets[n]);
      const parsed = countParseRows(rows, null);
      if (parsed && !parsed.err && (parsed.items || []).length && (!best || parsed.items.length > best.n)) best = { n, rows, score: parsed.items.length };
    }
    if (!best) { form.busy = ''; form.err = '상품과 수량 칸이 있는 탭을 찾지 못했습니다.'; render(); return; }
    const full = XLSX.read(buf, { type: 'array', sheets: [best.n] });
    form.busy = '';
    ibApplyCountRows(sheetRowsOf(full.Sheets[best.n]), f.name + ' › ' + best.n);
  } catch (e) { form.busy = ''; form.err = e.message || String(e); render(); }
}
function ibActLoaded(ib, x) {
  const parsed = countParseRows(x.rows, null);
  if (parsed.err) { S.ui.ibMsg = { t: parsed.err, bad: true }; render(); return; }
  const rows = (parsed.items || []).filter(r => r.qty != null).map(r => ({ ...r, qty: r.qty }));
  if (!rows.length) { S.ui.ibMsg = { t: '실입고 수량을 찾지 못했습니다.', bad: true }; render(); return; }
  ibApplyActual(ib, rows, x.src); if (DB.saveInbound) DB.saveInbound(ib); render();
}
async function ibCreate() {
  const f = S.ui.ibForm; if (!f || !f.parsed) return;
  for (const r of f.parsed) {
    if (r.pid || !r.bc || !((r.qty > 0) || (r.actual > 0))) continue;
    if (S.P[r.bc]) { r.pid = r.bc; continue; }
    const g = guessIpCat(r.name);
    const p = { id: r.bc, barcode: r.bc, sku: r.sku || '', name: r.name, ip: r.ip || g.ip || f.ip || '', cat: r.cat || g.cat || '', price: null, kind: '상설', memo: r.vendor ? `매입 거래처 ${r.vendor}` : '' };
    S.products.push(p); r.pid = r.bc;
    if (DB.saveProduct) await DB.saveProduct(p);
  }
  indexProducts();
  const items = {};
  for (const r of f.parsed) { if (!(r.qty > 0) && !(r.actual > 0)) continue; const k = itemKey(r); const x = items[k] ||= { key: k, pid: r.pid, name: r.pid ? S.P[r.pid].name : r.name, code: r.bc || r.sku || (r.pid ? (S.P[r.pid].barcode || S.P[r.pid].sku) : ''), bc: r.bc, sku: r.sku, plan: 0, price: r.price == null ? null : r.price, ip: r.ip || f.ip || '', cat: r.cat || '', vendor: r.vendor || '', actual: null }; x.plan += r.qty || 0; if (r.actual != null) x.actual = (x.actual || 0) + r.actual; }
  const ib = { id: 'IB-' + f.date.replace(/-/g, '').slice(2) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), store: f.store, date: f.date, title: f.title.trim() || f.src, ip: f.ip.trim(), from: f.from.trim(), status: 'planned', items: Object.values(items), extra: [], by: S.user.name, co: userCo(S.user), src: f.src, at: new Date().toISOString() };
  if (DB.saveInbound) await DB.saveInbound(ib);
  S.inbounds.push(ib); S.ui.ibForm = null; S.ui.ib = ib.id; toast(`입고 예정 ${ib.items.length}종을 등록했습니다`);
}
async function ibConfirm(ib) {
  const lines = [...ib.items.map(x => ({ ...x, q: x.actual || 0 })), ...(ib.extra || []).map(x => ({ ...x, q: x.actual || 0, plan: 0 }))];
  for (const l of lines) if (!l.pid && l.q > 0) {   // 처음 보는 상품은 목록에 등록
    const id = l.bc || l.sku || ('N' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5));
    if (!S.P[id]) { const g = guessIpCat(l.name); const p = { id, sku: /^\d{8,14}$/.test(id) ? '' : (l.sku || ''), barcode: /^\d{8,14}$/.test(id) ? id : (l.bc || ''), name: l.name, ip: l.ip || g.ip || ib.ip || '', cat: l.cat || g.cat || '', price: l.price == null ? null : l.price, kind: '상설', memo: l.vendor ? `매입 거래처 ${l.vendor}` : '' }; S.products.push(p); if (DB.saveProduct) await DB.saveProduct(p); }
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
  const entryTypes = TYPES.filter(t => !['입고', '매장 이동', '창고 보관', '창고에서 가져옴'].includes(t.id));
  if (!entryTypes.some(t => t.id === e.type)) e.type = entryTypes[0].id;
  const T = entryTypes.find(t => t.id === e.type);
  const okStores = myStores();
  return `${head('입출고 등록', '종류를 고르고 상품을 스캔·검색해서 수량을 넣습니다')}
  <div class="card" style="display:flex;flex-direction:column;gap:14px">
    <div class="field"><label>종류</label><div class="chips">${entryTypes.map(t => `<button class="chip ${e.type === t.id ? 'on' : ''}" data-et="${t.id}">${t.id}</button>`).join('')}</div><span class="muted" style="font-size:12px">${esc(T.d)} 입고·매장 이동·실사는 위쪽 메뉴에서 합니다.</span></div>
    <div class="formgrid">
      <div class="field"><label for="eDate">날짜</label>${dateSel('eDate', e.date)}</div>
      <div class="field"><label for="eStore">${T.to ? '보내는 매장' : '매장'}</label><select class="inp" id="eStore">${okStores.map(s => `<option value="${s}" ${e.store === s ? 'selected' : ''}>${esc(storeName(s))}</option>`).join('')}</select></div>
      ${T.to ? `<div class="field"><label for="eTo">받는 곳</label><select class="inp" id="eTo"><option value="">선택</option>${STORES.filter(s => s.id !== e.store).map(s => `<option value="${s.id}" ${e.to === s.id ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}${FIXED_PLACES.map(f => `<option value="__wh:${f.id}" ${e.to === '__custom' && e.place === f.id ? 'selected' : ''}>${esc(f.name)} (${esc(f.kind)})</option>`).join('')}<option value="__custom" ${e.to === '__custom' && !FIXED_PLACES.some(f => f.id === e.place) ? 'selected' : ''}>외부 장소 (행사장·팝업 등)</option></select></div>
      ${e.to === '__custom' && !FIXED_PLACES.some(f => f.id === e.place) ? placeSelect('ePlace', e.place, '외부 장소') : ''}` : ''}
      ${e.type === '입고' ? `<div class="field"><label for="eSrc">보낸 곳 (선택)</label><select class="inp" id="eSrc"><option value="">선택 안 함</option>${FIXED_PLACES.map(f => `<option value="${esc(f.name)}" ${e.src === f.name ? 'selected' : ''}>${esc(f.name)} (${esc(f.kind)})</option>`).join('')}<option value="SMG 홀딩스" ${e.src === 'SMG 홀딩스' ? 'selected' : ''}>SMG 홀딩스</option><option value="SMG 크리에이티브" ${e.src === 'SMG 크리에이티브' ? 'selected' : ''}>SMG 크리에이티브</option></select></div>` : ''}
      ${T.from ? placeSelect('eFrom', e.from, '돌아온 외부 장소') : ''}
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
  if (T.from && e.from) { const pl = placeById(e.from); const over = e.lines.filter(l => (+l.qty || 0) > ((pl && pl.q || {})[l.pid] || 0)); if (over.length) { const why = (e.memo || '').trim(); out.push({ lv: why ? 'warn' : 'bad', block: !why, over: true, t: `그 장소로 보낸 수량보다 많이 돌아온 상품 ${over.length}종: ${over.slice(0, 4).map(l => `${esc(S.P[l.pid].name)} (보냄 ${fmt((pl && pl.q || {})[l.pid] || 0)} · 돌아옴 ${fmt(l.qty)})`).join(', ')}${over.length > 4 ? ' 외' : ''}. ${why ? `사유: ${esc(why)} — 이대로 저장합니다.` : '<b>수량을 고치거나, 메모 칸에 사유를 적어야 저장할 수 있습니다.</b>'}` }); } }
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
      ${cnt('multi') ? (() => { const M = R.filter(r => r.st === 'multi'), left = M.filter(r => !r.pid).length; const ips = {}; M.forEach(r => r.cand.forEach(c => { const ip = S.P[c].ip || '(IP 없음)'; ips[ip] = (ips[ip] || 0) + 1; }));
        return `<div class="al"><span class="ic">🔸</span><span class="tx">이름이 같은(괄호·띄어쓰기만 다른) 상품이 두 개 이상인 줄 <b>${M.length}</b>개${left ? ` · 아직 안 고른 줄 <b>${left}</b>개` : ' · ✔ 모두 골랐습니다'}<br><span style="font-size:12.5px">한꺼번에 고르기:</span> <span class="mpick"><button class="btn sm" data-mpick="__stock">재고 있는 쪽으로</button>${Object.entries(ips).sort((a, b) => b[1] - a[1]).map(([ip, n]) => `<button class="btn sm" data-mpick="${esc(ip)}">IP '${esc(ip)}' 쪽 (${n})</button>`).join('')}${M.some(r => r.pid) ? '<button class="btn sm" data-mpick="__clear">선택 지우기</button>' : ''}</span><br><span class="muted" style="font-size:12px">상품 정보는 합치거나 지우지 않습니다. 이번 등록에 어느 상품으로 넣을지만 고릅니다.</span></span></div>`; })() : ''}
      ${cnt('qty') ? `<div class="al"><span class="ic">🔺</span><span class="tx">수량이 비었거나 0인 줄 <b>${cnt('qty')}</b>개 — 저장에서 빠집니다.</span></div>` : ''}
      ${dup ? `<div class="al"><span class="ic">🔸</span><span class="tx">파일 안에 같은 상품이 두 번 나온 줄 <b>${dup}</b>개 — <span class="fseg sm"><button class="${im.dupMode === 'sum' ? 'on' : ''}" data-dupm="sum">수량 합치기</button><button class="${im.dupMode === 'first' ? 'on' : ''}" data-dupm="first">처음 줄만</button></span></span></div>` : ''}
      ${im.prevFile ? `<div class="al"><span class="ic">🔺</span><span class="tx">같은 이름의 파일을 ${md(im.prevFile.date)}에 이미 올렸습니다 (${esc(whoText(im.prevFile.by, im.prevFile.co))}). 두 번 넣지 않도록 확인해 주세요.</span></div>` : ''}
    </div>
    <div class="tw"><table><thead><tr><th class="n">줄</th><th>파일 상품명</th><th class="hide-s">바코드·품번</th><th>찾은 상품</th><th class="n">수량</th><th>상태</th></tr></thead><tbody>
    ${R.map((r, i) => `<tr class="${r.st || r.dup ? 'flag' : ''}"><td class="n muted">${r.line}</td><td class="nm">${esc(r.name || '-')}</td><td class="code hide-s">${esc(r.bc || r.sku || '')}</td>
      <td class="nm">${r.st === 'multi' ? `<select class="inp" data-ip="${i}" style="min-width:180px"><option value="">고르기</option>${r.cand.map(c => `<option value="${esc(c)}" ${r.pid === c ? 'selected' : ''}>${esc(S.P[c].name)} · ${esc(S.P[c].sku || S.P[c].barcode)} · ${esc(S.P[c].ip || '')} · 재고 ${fmt(stockOf(S.ui.entry.store, c))}</option>`).join('')}</select>` : r.pid ? `${esc(S.P[r.pid].name)}<div class="muted" style="font-size:12px">${esc(r.how)}로 찾음</div>` : '<span class="muted">없음</span>'}</td>
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
async function readLink(url) { await needX();
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
const QTY_COUNT = ['실사수량', '실사', '실재고', '실수량', '실제수량', '센수량', '확인수량', '재고수량', '현재고', '수량', '재고', 'qty', '개수'];
let cntBuf = null, cntRows = null;
const cntTick = () => new Promise(r => setTimeout(r, 0));
function countNum(v) { const t = String(v ?? '').replace(/[,원\s]|개$|ea$|pcs$/gi, ''); if (t === '') return null; const n = Number(t); return isNaN(n) ? null : n; }
function countMatchRow(r) {
  const name = r.name || '', bc = r.bc || '', sku = r.sku || '';
  let cand = bc ? findProduct(bc) : [];
  if (!cand.length && sku) cand = findProduct(sku);
  if (!cand.length && name) cand = S.byName[norm(name)] || [];
  if (!cand.length && name) { const hit = (S.byLoose || {})[looseKey(name)] || []; const seen = new Set(); cand = hit.filter(p => !seen.has(p.id) && seen.add(p.id)); }
  return { ...r, pid: cand.length === 1 ? cand[0].id : '', multi: cand.length > 1 };
}
const COUNT_WORDS = ['실입고수량', '실제수량확인', '실제수량', '수량확인', '확인수량', '실제재고', '현장수량', '실재고', '실수량', '실입고', '실수령', '센수량', '실사'];
function normHead(s) { return String(s ?? '').replace(/[\s\n\r\t()（）\[\]{}:：·.\-_/]/g, '').toLowerCase(); }
function countWord(label) { const c = normHead(label); if (!c) return ''; let best = ''; for (const w of COUNT_WORDS) if (c.includes(normHead(w)) && w.length > best.length) best = w; return best; }
function cleanLabel(s) { return String(s ?? '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function isDateCell(s) { return /^\d{4}[./-]\d{1,2}[./-]\d{1,2}$/.test(s); }
function isTimeCell(s) { return /^\d{1,2}:\d{2}(\s*[~\-～]\s*\d{1,2}:\d{2})?$/.test(s); }
function isMemoCell(s) { return /^DP\s*수량/i.test(s) || /수량\s*[:：]\s*\d/.test(s); }
function isBarcodeCell(s) { return /^880\d{9,12}$/.test(s) || /^\d{12,14}$/.test(s); }
function isPlainNum(s) { return /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s) || /^-?\d+(\.\d+)?$/.test(s); }
function isPrivateHead(label) { return /수령|담당|전화|연락|휴대폰|핸드폰|주소|address|phone|tel|mobile/.test(normHead(label)); }
function isPhoneCell(s) { return /(?:^|\D)01[016789][-\s]?\d{3,4}[-\s]?\d{4}(?:\D|$)/.test(String(s || '')); }
function peelQty(s) { const m = String(s ?? '').trim().match(/^(.*[가-힣A-Za-z_])\s+(\d{1,3}(?:,\d{3})+|\d{1,6})$/); return m ? { text: m[1].trim(), n: countNum(m[2]) } : { text: String(s ?? '').trim(), n: null }; }
function rowBlank(r) { return !(r || []).some(c => String(c ?? '').trim()); }
function headerish(row) {
  const cells = (row || []).map(c => String(c ?? '').trim()).filter(Boolean);
  if (cells.length < 2 || cells.some(c => isBarcodeCell(c) || isDateCell(c))) return false;
  let hits = 0;
  for (const c of cells) { const n = normHead(c); if (countWord(c) || /바코드|상품명|품명|품번|입고|거래처|상품종류|비고|예정일|수령|수량|재고|코드/.test(n) || n === 'no') hits++; }
  return hits >= 2;
}
function mapLabels(labels) {
  let qty = -1, qw = '', bc = -1, name = -1;
  labels.forEach((h, i) => {
    const w = countWord(h); if (w && w.length > qw.length) { qty = i; qw = w; }
    const n = normHead(h); if (!n) return;
    if (/바코드|barcode|ean|jan|upc|gtin/.test(n) && !/상품명|품명/.test(n)) bc = bc < 0 ? i : bc;
    if (/상품명|품명|제품명|품목명/.test(n)) name = name < 0 ? i : name;
    else if (/품번|상품코드|품목코드/.test(n) && name < 0) name = i;
  });
  let countCol = qw !== '';
  if (qty < 0) {
    let plain = -1, other = -1;
    labels.forEach((h, i) => {
      const n = normHead(h); if (!n) return;
      if (/입고수량|출고수량|발주수량|예정수량|dp수량/.test(n)) { if (other < 0) other = i; return; }
      if (n === '수량' || n === '재고' || n === '현재고' || n === '재고수량' || n === 'qty' || n === '개수') plain = i;
    });
    qty = plain >= 0 ? plain : other;
  }
  const prod = bc >= 0 ? bc : name;
  return { qty, prod, bc, name, countCol };
}
function isLabelCell(s) {
  const n = normHead(s);
  if (!n || n.length > 30) return false;
  if (countWord(s)) return true;
  return /^(no|번호|순번|구분)$/.test(n) || /바코드|상품명|품명|품번|옵션|입고|거래처|상품종류|비고|예정일|수량|재고|코드|품목|상품/.test(n);
}
function rowHeaderScore(row) {
  const cells = (row || []).map(c => String(c ?? '').trim()).filter(Boolean);
  if (cells.length < 2 || cells.some(isBarcodeCell)) return 0;
  const labels = cells.filter(isLabelCell).length;
  const nums = cells.filter(c => isPlainNum(c)).length;
  if (labels < 2 || (nums > 1 && nums >= labels)) return 0;
  return labels * 10 - nums * 3;
}
function headerTail(row) {
  const cells = (row || []).map(c => String(c ?? '').trim()).filter(Boolean);
  if (!cells.length || cells.some(isBarcodeCell) || cells.some(c => isPlainNum(c) && !isLabelCell(c))) return false;
  return cells.every(isLabelCell);
}
function bodyNums(rows, start, col) {
  let n = 0;
  for (let i = start; i < Math.min(rows.length, start + 120); i++) {
    const v = String((rows[i] || [])[col] ?? '').trim();
    if (v && isPlainNum(v) && !isBarcodeCell(v) && !isDateCell(v)) n++;
  }
  return n;
}
function refineQtyMap(labels, rows, start, map) {
  let best = -1, score = -1, plan = -1, planScore = -1;
  labels.forEach((h, i) => {
    const nums = bodyNums(rows, start, i);
    const w = countWord(h), n = normHead(h);
    if (w && nums > 0 && 2000 + w.length * 20 + nums > score) { score = 2000 + w.length * 20 + nums; best = i; }
    if (!w && /입고수량|수량입고|예정수량|출고수량/.test(n)) { const s = (nums > 0 ? 1000 : 0) + nums; if (s > planScore) { planScore = s; plan = i; } }
    if (!w && nums > 0 && /수량|재고|현재고|qty|개수/.test(n) && best < 0 && 100 + nums > score) { score = 100 + nums; best = i; }
  });
  if (best < 0) labels.forEach((h, i) => { if (isPrivateHead(h)) return; const nums = bodyNums(rows, start, i); if (nums > score && /수량|재고|입고|실사/.test(normHead(h))) { score = nums; best = i; } });
  return { ...map, qty: best >= 0 ? best : map.qty, countCol: best >= 0 ? !!countWord(labels[best]) : map.countCol, planCol: plan };
}
function findHeader(rows) {
  let best = -1, bestS = 0;
  for (let i = 0; i < Math.min(rows.length, 45); i++) { const s = rowHeaderScore(rows[i]); if (s > bestS) { bestS = s; best = i; } }
  if (best < 0) {
    for (let i = 0; i < rows.length; i++) {
      if (!headerish(rows[i])) continue;
      const labels = rows[i].map(cleanLabel);
      const map = refineQtyMap(labels, rows, i + 1, mapLabels(labels));
      if (map.qty >= 0 || map.prod >= 0 || map.bc >= 0) return { start: i, end: i, labels, map };
    }
    return null;
  }
  let start = best, end = best;
  while (start > 0 && best - start < 4 && (rowHeaderScore(rows[start - 1]) > 0 || headerTail(rows[start - 1]))) start--;
  while (end + 1 < rows.length && end - start < 5 && (rowHeaderScore(rows[end + 1]) > 0 || headerTail(rows[end + 1]))) end++;
  const width = Math.max(0, ...rows.slice(start, end + 1).map(r => (r || []).length));
  const labels = Array.from({ length: width }, (_, k) => { const parts = []; for (let r = start; r <= end; r++) { const v = cleanLabel((rows[r] || [])[k] || ''); if (v && !parts.includes(v)) parts.push(v); } return parts.join(' '); });
  return { start, end, labels, map: refineQtyMap(labels, rows, end + 1, mapLabels(labels)) };
}
function guessHeaderless(dataRows) {
  const cols = Math.max(0, ...dataRows.map(r => r.length));
  const stats = [];
  for (let c = 0; c < cols; c++) {
    let n = 0, bc = 0, date = 0, time = 0, memo = 0, num = 0, sku = 0, text = 0;
    for (const r of dataRows) {
      const v = String(r[c] ?? '').trim(); if (!v || v === '-') continue; n++;
      if (isBarcodeCell(v)) bc++; else if (isDateCell(v)) date++; else if (isTimeCell(v)) time++; else if (isMemoCell(v)) memo++;
      else if (isPlainNum(v)) num++; else if (/_[0-9]{2}_|[A-Za-z]{2,}_/.test(v)) sku++; else if (/[가-힣A-Za-z]{2,}/.test(v)) text++;
    }
    stats.push({ c, n, bc, date, time, memo, num, sku, text });
  }
  const ok = s => s.n && s.date / s.n < .5 && s.time / s.n < .5 && s.memo / s.n < .5;
  const bcCol = stats.filter(s => s.bc >= 1).sort((a, b) => b.bc - a.bc)[0];
  const nameCol = stats.filter(s => ok(s) && (!bcCol || s.c !== bcCol.c) && s.sku + s.text >= 1 && s.num / Math.max(1, s.n) < .5).sort((a, b) => (b.sku * 3 + b.text) - (a.sku * 3 + a.text))[0];
  const anchor = Math.max(bcCol ? bcCol.c : -1, nameCol ? nameCol.c : -1);
  const qty = stats.filter(s => s.c > anchor && ok(s) && s.bc === 0 && s.num / Math.max(1, s.n) >= .6).sort((a, b) => a.c - b.c)[0];
  return { prod: bcCol ? bcCol.c : (nameCol ? nameCol.c : -1), qty: qty ? qty.c : -1, bc: bcCol ? bcCol.c : -1, name: nameCol ? nameCol.c : -1, countCol: false };
}
function countParseRows(rows, pick) {
  const list = rows || [];
  const header = findHeader(list);
  const data = [];
  list.forEach((r, i) => {
    if (rowBlank(r)) return;
    if (header && i >= header.start && i <= header.end) return;
    if (header && i < header.start) return;
    if (headerish(r)) return;
    data.push(r);
  });
  const body = data.length ? data : list.filter(r => !rowBlank(r) && !headerish(r));
  if (!body.length) return { err: '표에서 데이터 줄을 찾지 못했습니다.' };
  let map = header ? { ...header.map } : guessHeaderless(body);
  const labels = header ? header.labels : [];
  if (pick && pick.prod != null) {
    const sample = body.map(r => String(r[pick.prod] ?? '').trim()).find(Boolean) || '';
    map = { ...map, prod: pick.prod, bc: isBarcodeCell(sample) ? pick.prod : -1, name: isBarcodeCell(sample) ? map.name : pick.prod };
  }
  if (pick && pick.qty != null) map = { ...map, qty: pick.qty, countCol: true };
  if (pick && pick.plan != null) map = { ...map, planCol: pick.plan };
  if (map.prod < 0 && map.bc < 0 && map.name < 0) return { err: '상품 칸(바코드·상품명)을 찾지 못했습니다. 아래 칸 버튼으로 골라 주세요.' };
  const width = Math.max(labels.length, ...body.slice(0, 40).map(r => r.length));
  const bigo = labels.findIndex(h => normHead(h) === '비고' || normHead(h).startsWith('비고'));
  const vals = c => body.map(r => String(r[c] ?? '').trim()).filter(Boolean);
  const priv = (label, vs) => isPrivateHead(label) || (vs.length && (vs.filter(isPhoneCell).length / vs.length >= .3 || vs.filter(v => /주소\s*[:：]/.test(v)).length / vs.length >= .3));
  const cols = [];
  for (let c = 0; c < width; c++) {
    if (bigo >= 0 && c > bigo) continue;
    const label = cleanLabel(labels[c] || '');
    const vs = vals(c);
    if (priv(label, vs)) continue;
    const n = normHead(label);
    const numeric = vs.length && vs.filter(isPlainNum).length / vs.length >= .6;
    let role = '';
    if (n && /바코드|barcode|ean|jan|upc|gtin/.test(n) && !/상품명|품명/.test(n)) role = 'prod';
    else if (n && /상품명|품명|제품명|품목명|품번|상품코드|품목코드/.test(n)) role = 'prod';
    else if (n && !/^(no|번호|순번)$/.test(n) && (countWord(label) || /수량|재고|현재고|개수|qty/.test(n)) && (numeric || !!countWord(label))) role = 'qty';
    else if (!n && !header && numeric && vs.every(v => !isPhoneCell(v) && !isDateCell(v) && !isTimeCell(v))) role = 'qty';
    else if (!n && !header && vs.filter(isBarcodeCell).length >= 1) role = 'prod';
    else if (!n && !header && vs.filter(v => /[가-힣A-Za-z]{2,}/.test(v) && !isMemoCell(v) && !isTimeCell(v) && !isDateCell(v)).length >= 1 && !numeric) role = 'prod';
    if (!role) continue;
    cols.push({ i: c, role, label: label || ('칸 ' + (c + 1)) });
  }
  const cell = (r, i) => i >= 0 ? String(r[i] ?? '').trim() : '';
  const vendCol = labels.findIndex(h => /거래처/.test(normHead(h)) && !/수령/.test(normHead(h)));
  const planCol = map.planCol != null && map.planCol >= 0 ? map.planCol : labels.findIndex(h => { const n = normHead(h); return !countWord(h) && (n === '입고수량' || n === '수량입고' || n.endsWith('입고수량')); });
  const optCol = labels.findIndex(h => /옵션/.test(normHead(h)) && !/상품명|품명/.test(normHead(h)));
  const items = [];
  body.forEach(r => {
    const filled = (r || []).map(c => String(c ?? '').trim()).filter(Boolean);
    if (filled.length && !filled.some(isBarcodeCell) && filled.every(isLabelCell)) return;
    let bc = cell(r, map.bc).replace(/^'+/, '');
    if (!isBarcodeCell(bc)) { bc = ''; for (const c of r) { const t = String(c ?? '').trim(); if (isBarcodeCell(t)) { bc = t; break; } } }
    let name = cell(r, map.name >= 0 ? map.name : (map.bc !== map.prod ? map.prod : -1));
    if (map.name < 0 && map.prod >= 0 && map.prod !== map.bc && !isBarcodeCell(cell(r, map.prod))) name = cell(r, map.prod);
    const opt = cell(r, optCol);
    if (opt && !isLabelCell(opt) && name && !name.includes(opt)) name = (name + ' ' + opt).trim();
    const peeled = peelQty(name); name = peeled.text;
    if (/^(합계|총계|소계|total)$/i.test(name)) return;
    if (!bc && isLabelCell(name)) return;
    let qty = null, blank = false;
    if (map.qty >= 0) { const q = cell(r, map.qty); if (!q || isLabelCell(q)) blank = true; else qty = countNum(q); }
    if (blank && map.countCol) qty = null;
    else if ((qty == null || blank) && !map.countCol && peeled.n != null) { qty = peeled.n; blank = false; }
    if (!bc && !name && (blank || qty == null)) return;
    if (!bc && !name && !/[가-힣A-Za-z]/.test(r.join(' '))) return;
    const planRaw = cell(r, planCol);
    const plan = planRaw === '' || isLabelCell(planRaw) ? null : countNum(planRaw);
    items.push(countMatchRow({ name, bc, sku: /_|[A-Za-z]{2,}\d/.test(name) ? name : '', qty: blank ? null : qty, plan, blank, countCol: !!map.countCol, vendor: cell(r, vendCol) }));
  });
  const prodLabel = cleanLabel(labels[map.bc >= 0 ? map.bc : map.prod] || '') || (map.bc >= 0 ? '바코드' : '상품');
  const qtyLabel = cleanLabel(labels[map.qty] || '') || '수량';
  return { items, cols, prod: map.prod, qty: map.qty, prodLabel, qtyLabel, countCol: !!map.countCol };
}
function guessIpCat(name) {
  const m = String(name || '').trim().match(/^([A-Za-z]+_?\d+)[_\s-]+(.+)$/);
  if (!m) return { ip: '', cat: '' };
  return { ip: m[1], cat: (m[2].split(/[_\s]/)[0] || '') };
}
function countSetPreview(parsed, src) {
  if (!parsed || parsed.err) { S.ui.cntPrev = null; S.ui.cntMsg = { bad: true, html: '🔺 ' + esc((parsed && parsed.err) || '표를 읽지 못했습니다') }; render(); return; }
  const st = S.stores[0];
  const matched = new Map(), missing = [], fresh = new Map();
  const skip = S.ui.cntSkip || {}, edit = S.ui.cntEdit || {};
  for (const r of parsed.items || []) {
    const noQty = r.blank || r.qty == null;
    if (!r.bc && noQty) { missing.push({ ...r, why: '바코드·실사 수량 없음' }); continue; }
    if (r.countCol && noQty) { missing.push({ ...r, why: '실사 수량 없음' }); continue; }
    if (noQty) { missing.push({ ...r, why: '수량이 비어 있습니다' }); continue; }
    if (r.multi) { missing.push({ ...r, why: '같은 이름 상품이 여러 개입니다. 코드를 적어 주세요' }); continue; }
    if (!r.pid) {
      const key = r.bc || norm(r.name);
      const prev = fresh.get(key);
      if (prev) { prev.qty += Math.max(0, r.qty || 0); prev.lines++; }
      else fresh.set(key, { key, bc: r.bc || '', name: r.name, qty: r.qty, lines: 1 });
      continue;
    }
    const book = stockOf(st, r.pid);
    const prev = matched.get(r.pid);
    if (prev) { prev.qty += Math.max(0, r.qty); prev.lines++; prev.diff = prev.qty - prev.book; }
    else matched.set(r.pid, { pid: r.pid, name: S.P[r.pid].name, code: S.P[r.pid].barcode || S.P[r.pid].sku || '', qty: Math.max(0, r.qty), book, diff: Math.max(0, r.qty) - book, lines: 1 });
  }
  const seen = new Set([...matched.keys()]);
  const absent = S.products.filter(p => stockOf(st, p.id) !== 0 && !seen.has(p.id)).length;
  const blankN = (parsed.items || []).filter(r => r.blank || r.qty == null).length;
  S.ui.cntPrev = { src, matched: [...matched.values()], missing, fresh: [...fresh.values()], absent, blankN, cols: parsed.cols || [], prod: parsed.prod, qty: parsed.qty, prodLabel: parsed.prodLabel, qtyLabel: parsed.qtyLabel };
  S.ui.cntMsg = null;
  render();
  if (!S.ui.cntNoScroll) countScroll();
  S.ui.cntNoScroll = false;
}
function countSel(p) { return { m: (p.matched || []).length, n: 0, fresh: [] }; }
function countRegLabel(p) { const m = countSel(p).m; return m ? `실사 반영 (${m}종)` : '실사 반영'; }
function countSummary(p) {
  const same = p.matched.filter(m => m.diff === 0).length;
  const diff = p.matched.length - same;
  return `일치 ${same} · 차이 ${diff} · 전산에 없는 상품 ${(p.fresh || []).length} · 실사에서 빠진 상품 ${p.absent || 0}`;
}
function countScroll() {
  requestAnimationFrame(() => {
    const el = document.querySelector('.cntprev') || document.getElementById('cntMsg');
    if (!el) return;
    const top = document.querySelector('.top');
    const cover = top ? top.getBoundingClientRect().height : 0;
    window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - cover - 8), behavior: 'smooth' });
  });
}
function countWhy(p) { return p && p.matched ? countSummary(p) : ''; }
function parsePasteTable(text) {
  const s = String(text || '').replace(/^\uFEFF/, '');
  const rows = []; let row = [], cur = '', q = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (q) { if (c === '"') { if (s[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c; }
    else if (c === '"' && cur === '') q = true;
    else if (c === '\t') { row.push(cur); cur = ''; }
    else if (c === '\n') { row.push(cur); rows.push(row); row = []; cur = ''; }
    else if (c !== '\r') cur += c;
  }
  if (cur.length || row.length) { row.push(cur); rows.push(row); }
  return rows.map(r => r.map(c => c.trim()));
}
function countFromPaste(text) {
  S.ui.cntPaste = text; S.ui.cntPick = null; S.ui.cntSkip = {}; S.ui.cntEdit = {};
  cntRows = parsePasteTable(text);
  if (!cntRows.some(r => r.some(c => String(c).trim()))) { S.ui.cntMsg = { bad: true, html: '🔺 붙인 내용이 없습니다.' }; render(); return; }
  countSetPreview(countParseRows(cntRows, null), '붙여넣기');
}
function countRepick(kind, idx) {
  S.ui.cntPick = { ...(S.ui.cntPick || {}), [kind]: idx };
  if (cntRows) countSetPreview(countParseRows(cntRows, S.ui.cntPick), (S.ui.cntPrev && S.ui.cntPrev.src) || '붙여넣기');
}
function sheetRowsOf(ws) {
  if (!ws) return [];
  let rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '', raw: false });
  if (SM.fillMerges) rows = SM.fillMerges(rows, ws['!merges'] || []);
  return rows;
}
async function countUseSheet(name) {
  if (!cntBuf) return;
  S.ui.cntMsg = { html: `‘${esc(name)}’ 탭을 읽는 중…` }; render();
  await cntTick();
  try {
    await needX();
    const wb = XLSX.read(cntBuf, { type: 'array', sheets: [name] });
    const rows = sheetRowsOf(wb.Sheets[name]);
    S.ui.cntSheet = name; cntRows = rows; S.ui.cntPick = null;
    const parsed = countParseRows(rows, null);
    if (parsed.err) { S.ui.cntPrev = null; S.ui.cntMsg = { bad: true, html: '🔺 ‘' + esc(name) + '’ 탭: ' + esc(parsed.err) }; render(); countScroll(); return; }
    countSetPreview(parsed, (S.ui.cntFile || '엑셀') + ' › ' + name);
  } catch (e) { S.ui.cntPrev = null; S.ui.cntMsg = { bad: true, html: '🔺 ‘' + esc(name) + '’ 탭을 읽지 못했습니다. ' + esc(e.message || e) }; render(); countScroll(); }
}
async function countReadFile(f) {
  const mb = f.size / (1024 * 1024);
  if (mb > 120) { S.ui.cntPrev = null; S.ui.cntCands = null; S.ui.cntMsg = { bad: true, html: `🔺 파일이 ${mb.toFixed(0)}MB라 브라우저에서 열기 어렵습니다. 필요한 탭만 남기고 다시 저장해 주세요.` }; render(); countScroll(); return; }
  S.ui.cntMsg = { html: mb >= 40 ? `큰 파일(${mb.toFixed(0)}MB)입니다. 칸 제목만 먼저 읽는 중…` : '엑셀을 읽는 중…' }; S.ui.cntCands = null; S.ui.cntPrev = null; render();
  await cntTick();
  try {
    await needX();
    cntBuf = await f.arrayBuffer();
    await cntTick();
    const head = XLSX.read(cntBuf, { type: 'array', sheetRows: 50 });
    const cands = [];
    for (const n of head.SheetNames) {
      await cntTick();
      const rows = sheetRowsOf(head.Sheets[n]);
      const parsed = countParseRows(rows, null);
      if (parsed && !parsed.err && parsed.qty >= 0 && parsed.prod >= 0) cands.push({ n, score: (parsed.countCol ? 10 : 0) + Math.min((parsed.items || []).length, 40) });
    }
    S.ui.cntFile = f.name; S.ui.cntSheet = '';
    if (!cands.length) { S.ui.cntCands = null; S.ui.cntMsg = { bad: true, html: '🔺 상품(바코드·상품명)과 수량 칸이 함께 있는 탭을 찾지 못했습니다. 제목 줄에 바코드·상품명과 실입고수량(또는 실사·수량)이 있는지 확인해 주세요.' }; render(); countScroll(); return; }
    cands.sort((a, b) => b.score - a.score);
    S.ui.cntCands = cands.map(c => c.n);
    if (cands.length > 1) S.ui.cntMsg = { html: `탭 ${cands.length}개에 수량 칸이 있습니다. 다른 탭을 누르면 바뀝니다.` };
    await countUseSheet(cands[0].n);
  } catch (e) { S.ui.cntPrev = null; S.ui.cntMsg = { bad: true, html: '🔺 파일을 읽지 못했습니다. ' + esc(e.message || e) }; render(); countScroll(); }
}
function countOpenGuard() {
  const p = S.ui.cntPrev; const sel = p ? countSel(p) : { m: 0, n: 0, fresh: [] };
  if (!p || (!sel.m && !sel.n)) return;
  const st = S.stores[0];
  const chg = p.matched.filter(m => m.qty !== m.book);
  const drops = chg.filter(m => m.book > 0 && (m.qty === 0 || m.qty <= m.book * 0.7));
  const ids = new Set(p.matched.map(m => m.pid));
  const bcs = new Set(sel.fresh.map(x => x.bc));
  const hits = [];
  for (const ib of S.inbounds || []) {
    if (ib.status === 'received' || !S.stores.includes(ib.store)) continue;
    const n = [...(ib.items || []), ...(ib.extra || [])].filter(x => (x.pid && ids.has(x.pid)) || (x.bc && bcs.has(x.bc)) || (x.code && bcs.has(x.code))).length;
    if (n) hits.push({ ib, n });
  }
  const body = `<p class="cntwhy">기존 재고 ${chg.length}종이 바뀝니다.</p>
    ${drops.length ? `<p class="cntwhy bad">크게 줄어드는 상품 ${drops.length}종</p><div class="tw"><table class="cntgrid"><tbody>${drops.map(m => `<tr><td class="nm">${esc(m.name)}<div class="code">${esc(m.code)}</div></td><td class="n" style="color:var(--bad);font-weight:800">${fmt(m.book)} → ${fmt(m.qty)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="src">30% 이상 줄거나 0이 되는 기존 상품은 없습니다.</p>'}
    ${hits.length ? `<div class="note bad"><b>입고 확정 먼저 하세요.</b><br>확정되지 않은 입고 예정에 같은 상품이 ${hits.map(h => `${esc(h.ib.title)} ${h.n}종`).join(', ')} 있습니다.${hits.map(h => `<div class="row" style="margin-top:8px"><button class="btn" data-ibjump="${esc(h.ib.id)}">입고 확인으로</button></div>`).join('')}</div>` : ''}
    <div class="field" style="margin-top:12px"><label for="cntGuard">확인 글자</label><input class="inp" id="cntGuard" placeholder="실사" autocomplete="off" aria-label="실사 입력"></div>
    <p class="src">등록하려면 위 칸에 실사 를 그대로 입력하세요.</p>`;
  S.ui.drawer = () => `<div class="hd"><h3>실사 등록 확인</h3><button class="x" data-close aria-label="닫기">×</button></div><div class="card">${body}</div><div class="row" style="justify-content:flex-end"><button class="btn" data-close>취소</button><button class="btn pri" id="cntGuardOk" disabled>실사 등록</button></div>`;
  render();
}
function countUndoAsk() {
  const u = S.ui.cntUndo; if (!u) return;
  const n = (u.created || []).length;
  S.ui.drawer = () => `<div class="hd"><h3>직전 실사 되돌리기</h3><button class="x" data-close aria-label="닫기">×</button></div><div class="card"><p class="src">직전 실사로 바뀐 수량을 이전 수량으로 되돌립니다. 되돌린 내용은 실사 기록에 남습니다.</p>${n ? `<p class="cntwhy">이때 새로 만든 상품 ${n}종을 지울까요?</p>` : ''}</div><div class="row" style="justify-content:flex-end">${n ? '<button class="btn" id="cntUndoDel">상품도 지우기</button>' : ''}<button class="btn pri" id="cntUndoKeep">${n ? '수량만 되돌리기' : '되돌리기'}</button></div>`;
  render();
}
async function countUndo(delNew) {
  const u = S.ui.cntUndo; if (!u) return;
  const st = u.store, at = new Date().toISOString();
  const moves = [];
  for (const [pid, prev] of Object.entries(u.before || {})) {
    if (!S.P[pid]) continue;
    const now = stockOf(st, pid); if (now === prev) continue;
    moves.push({ id: 'cu' + Date.now().toString(36) + pid.slice(-6), date: today(), store: st, type: COUNT_TYPE, pid, qty: prev - now, memo: `실사 되돌림 · ${fmt(now)} → ${fmt(prev)}`, by: S.user.name, at });
  }
  if (moves.length) { await DB.saveMoves(stampMoves(moves, '실사 되돌림')); for (const m of moves) { S.moves.push(m); (S.stock[st] ||= {})[m.pid] = stockOf(st, m.pid) + m.qty; } }
  if (delNew) for (const id of u.created || []) { if (!S.P[id]) continue; S.products = S.products.filter(p => p.id !== id); if (S.stock[st]) delete S.stock[st][id]; if (DB.deleteProduct) await DB.deleteProduct(id); }
  if (delNew) indexProducts();
  S.ui.cntUndo = null; try { localStorage.removeItem('smg-count-undo'); } catch (e) { }
  toast(delNew ? '수량을 되돌리고 새 상품을 지웠습니다' : '직전 실사 수량을 되돌렸습니다');
  render();
}
async function countRegister() {
  const p = S.ui.cntPrev; const sel = p ? countSel(p) : { m: 0, n: 0, fresh: [] };
  if (!p || (!sel.m && !sel.n)) return;
  const st = S.stores[0];
  const before = {};
  p.matched.forEach(m => { before[m.pid] = stockOf(st, m.pid); });
  sel.fresh.forEach(n => { before[n.bc] = stockOf(st, n.bc); });
  const created = [];
  let made = 0;
  for (const n of sel.fresh) {
    if (S.P[n.bc]) continue;
    const prod = { id: n.bc, barcode: n.bc, sku: n.sku || '', name: n.name, ip: n.ip || '', cat: n.cat || '', price: null, kind: '상설', memo: n.vendor ? `매입 거래처 ${n.vendor}` : '', createdBy: S.user && S.user.uid || '' };
    S.products.push(prod); made++; created.push(prod.id);
    if (DB.saveProduct) await DB.saveProduct(prod);
  }
  if (made) indexProducts();
  S.ui.counts[st] = {};
  p.matched.forEach(m => { if (S.P[m.pid]) S.ui.counts[st][m.pid] = m.qty; });
  sel.fresh.forEach(n => { if (S.P[n.bc]) { S.ui.counts[st][n.bc] = n.qty; S.ui.cntVend = S.ui.cntVend || {}; if (n.vendor) S.ui.cntVend[n.bc] = n.vendor; } });
  S.ui.cntSrc = p.src;
  await saveCount();
  S.ui.cntUndo = { store: st, at: new Date().toISOString(), before, created };
  try { localStorage.setItem('smg-count-undo', JSON.stringify(S.ui.cntUndo)); } catch (e) { }
  S.ui.cntPrev = null; S.ui.cntCands = null; S.ui.cntSheet = ''; S.ui.cntVend = null;
}
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
  if (S.ui.cntUndo === undefined) { try { S.ui.cntUndo = JSON.parse(localStorage.getItem('smg-count-undo') || 'null'); } catch (e) { S.ui.cntUndo = null; } }
  const st = S.stores[0];
  const p = S.ui.cntPrev;
  return `${head('실사', `${esc(storeName(st))} · 월말 실사. 엑셀이나 붙여넣으면 전산재고와 바로 비교합니다`, p && p.matched.length ? `<button class="btn pri" data-cntgo="1">${countRegLabel(p)}</button>` : '')}
  <div class="card cntbox">
    ${p ? `<div class="row cntacts"><button class="btn" id="cntFile">엑셀 다시 올리기</button>${S.ui.cntUndo ? '<button class="btn" id="cntUndo">되돌리기</button>' : ''}</div>` : `<label class="lb" for="cntPaste">실사표 붙여넣기</label>
    <textarea class="inp cntpaste" id="cntPaste" placeholder="구글 시트에서 복사해 붙이세요. 붙이면 바로 비교가 나옵니다."></textarea>
    <div class="row cntacts"><button class="btn pri" id="cntFile">엑셀 올리기</button>${S.ui.cntUndo ? '<button class="btn" id="cntUndo">되돌리기</button>' : ''}</div>`}
    ${(S.ui.cntCands || []).length > 1 ? `<div class="cnttabs" role="group" aria-label="엑셀 탭">${S.ui.cntCands.map(n => `<button type="button" class="btn ${S.ui.cntSheet === n ? 'pri' : ''}" data-cntsheet="${esc(n)}">${esc(n)}</button>`).join('')}</div>` : ''}
    ${S.ui.cntMsg ? `<p class="src">${S.ui.cntMsg.html}</p>` : ''}
    ${countPrevHtml()}
  </div>
  ${countRegBar()}`;
}
function countPrevHtml() {
  const p = S.ui.cntPrev; if (!p) return '';
  const only = !!S.ui.cntOnly;
  const rows = p.matched.filter(m => !only || m.diff !== 0);
  const can = p.matched.length > 0;
  const card = m => `<div class="grow${m.diff ? ' bad' : ''}"><b>${esc(m.name)}</b><div class="code">${esc(m.code)}${m.lines > 1 ? ' · ' + m.lines + '줄 합침' : ''}</div><div class="gnums"><span>전산 ${fmt(m.book)}</span><span>실사 ${fmt(m.qty)}</span><span class="${m.diff ? 'bad' : ''}">차이 ${m.diff > 0 ? '+' : ''}${fmt(m.diff)}</span></div></div>`;
  const unk = only ? '' : (p.fresh || []).map(x => `<div class="grow"><b>${esc(x.name || '이름 없음')}</b><div class="code">${esc(x.bc)} · 전산에 없음</div><div class="gnums"><span>실사 ${x.qty == null ? '—' : fmt(x.qty)}</span></div></div>`).join('');
  const cols = S.ui.cntCols ? `<div class="cntpick"><span class="lb">실사 칸</span><div class="cnttabs">${(p.cols || []).filter(c => c.role === 'qty').map(c => `<button type="button" class="btn ${c.i === p.qty ? 'pri' : ''}" data-cntqty="${c.i}">${esc(c.label)}</button>`).join('')}</div></div>` : '';
  return `<div class="cntprev"><p class="cntwhy">${countSummary(p)}${p.blankN ? ` · 빈 줄 ${p.blankN}개 제외` : ''}</p>
    <div class="row"><button class="btn" type="button" id="cntOnly">${only ? '전체 보기' : '차이만'}</button><button class="btn" type="button" id="cntCols">${S.ui.cntCols ? '칸 닫기' : '열 직접 고르기'}</button></div>
    ${cols}
    <div class="glist">${rows.map(card).join('') || '<p class="src">보이는 상품이 없습니다.</p>'}</div>
    ${unk ? `<h3>전산에 없는 상품</h3><div class="glist">${unk}</div>` : ''}
  </div>`;
}
function countRegBar() {
  const p = S.ui.cntPrev; if (!p) return '';
  return `<div class="cntregbar"><p class="cntwhy">${countSummary(p)}</p><button class="btn pri" data-cntgo="1" ${p.matched.length ? '' : 'disabled'}>${countRegLabel(p)}</button></div>`;
}
async function saveCount() {
  const st = S.stores[0]; const c = S.ui.counts[st]; const at = new Date().toISOString();
  const vend = S.ui.cntVend || {};
  const list = Object.keys(c).filter(pid => c[pid] !== stockOf(st, pid)).map(pid => ({ id: 'c' + Date.now().toString(36) + pid, date: today(), store: st, type: COUNT_TYPE, pid, qty: c[pid] - stockOf(st, pid), memo: `실사 ${fmt(c[pid])}개 (장부 ${fmt(stockOf(st, pid))})${vend[pid] ? ` · 매입 거래처 ${vend[pid]}` : ''}`, by: S.user.name, at }));
  await DB.saveMoves(stampMoves(list, S.ui.cntSrc));
  for (const m of list) { S.moves.push(m); S.stock[st][m.pid] = stockOf(st, m.pid) + m.qty; }
  S.ui.counts[st] = {}; S.ui.cntSrc = null; toast(`실사 차이 ${list.length}종을 반영했습니다`);
}

/* ───────── 매장 이동 ───────── */
const moveLabel = id => id === 'gukdae' ? '물류창고' : shortName(id);
function transferView() {
  const m = S.ui.move ||= { from: S.stores[0] || 'suwon', to: '', lines: [], q: '', note: '' };
  const places = STORES.map(s => s.id);
  const btns = (cur, key) => `<div class="sgrid">${places.map(id => `<button type="button" class="sbtn ${cur === id ? 'on' : ''}" data-${key}="${id}" ${key === 'mvto' && id === m.from ? 'disabled' : ''}>${esc(moveLabel(id))}</button>`).join('')}</div>`;
  const q = norm(m.q || '');
  const hits = q ? S.products.filter(p => norm(p.name).includes(q) || (p.barcode || '').includes(String(m.q).trim()) || norm(p.sku || '').includes(q)).slice(0, 8) : [];
  const pend = S.transfers.filter(t => S.stores.includes(t.to) && t.status === 'sent');
  const line = l => { const p = S.P[l.pid] || {}; return `<div class="grow"><b>${esc(p.name || l.pid)}</b><div class="code">${esc(p.barcode || p.sku || '')} · 지금 ${fmt(stockOf(m.from, l.pid))}</div><div class="gnums"><label>수량 <input class="inp qty" type="number" min="1" inputmode="numeric" value="${l.qty}" data-mvq="${esc(l.pid)}" aria-label="이동 수량"></label><button class="btn sm" type="button" data-mvdel="${esc(l.pid)}">빼기</button></div></div>`; };
  return `${head('상품 이동', '다른 매장이나 물류창고로 보냅니다. 받는 곳이 확인하면 재고가 넘어갑니다', m.lines.length && m.from && m.to && m.from !== m.to ? `<button class="btn pri" data-act="mvSave">이동 등록 (${m.lines.length}종)</button>` : '')}
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="field"><label>보내는 곳</label>${btns(m.from, 'mvfrom')}</div>
    <div class="field"><label>받는 곳</label>${btns(m.to, 'mvto')}</div>
    <div class="field"><label for="mvQ">상품</label><div class="search">${ic('search')}<input class="inp" id="mvQ" placeholder="상품명·바코드" value="${esc(m.q || '')}" autocomplete="off"></div>
      ${hits.length ? `<div class="glist" style="margin-top:8px">${hits.map(p => `<button type="button" class="grow" data-mvadd="${esc(p.id)}"><b>${esc(p.name)}</b><div class="code">${esc(p.barcode || p.sku || '')} · ${fmt(stockOf(m.from, p.id))}개</div></button>`).join('')}</div>` : ''}
    </div>
    <label class="lb" for="mvPaste">또는 목록 붙여넣기</label>
    <textarea class="inp cntpaste" id="mvPaste" placeholder="상품과 수량이 있는 표를 붙이거나 엑셀을 올리세요"></textarea>
    <div class="row cntacts"><button class="btn" type="button" id="mvFile">엑셀 올리기</button><button class="btn" type="button" id="scanBtn">${ic('scan')} 스캔</button></div>
    ${m.note ? `<p class="cntwhy">${esc(m.note)}</p>` : ''}
    ${m.lines.length ? `<div class="glist">${m.lines.map(line).join('')}</div>` : '<p class="src">보낼 상품을 고르거나, 표를 붙이세요.</p>'}
  </div>
  ${m.lines.length ? `<div class="cntregbar"><p class="cntwhy">${m.lines.length}종 · ${esc(moveLabel(m.from))} → ${m.to ? esc(moveLabel(m.to)) : '받는 곳'}</p><button class="btn pri" data-act="mvSave" ${m.from && m.to && m.from !== m.to ? '' : 'disabled'}>이동 등록</button></div>` : ''}
  <div class="card"><h2>받을 상품 <span class="r">${pend.length}건</span></h2>${pend.length ? pend.map(t => `<div class="grow"><b>${esc((S.P[t.pid] || {}).name || t.pid)}</b><div class="code">${esc(moveLabel(t.from))} → ${esc(moveLabel(t.to))} · ${fmt(t.qty)}개</div><div class="gnums"><input class="inp qty" id="rq_${t.id}" type="number" min="0" value="${t.qty}" aria-label="받은 수량"><button class="btn pri" data-recv="${t.id}">받기 확인</button></div></div>`).join('') : '<p class="src">받을 상품이 없습니다.</p>'}</div>`;
}
async function moveFromRows(rows, src) {
  const parsed = countParseRows(rows, null);
  const m = S.ui.move ||= { from: S.stores[0], to: '', lines: [], q: '' };
  if (parsed.err) { m.note = parsed.err; render(); return; }
  let n = 0, unknown = 0, blank = 0;
  for (const r of parsed.items || []) {
    if (r.qty == null && r.plan == null) { blank++; continue; }
    const qty = r.qty != null ? r.qty : r.plan;
    if (!r.pid) { unknown++; continue; }
    const ex = m.lines.find(l => l.pid === r.pid);
    if (ex) ex.qty += qty; else m.lines.push({ pid: r.pid, qty });
    n++;
  }
  m.note = `상품 ${m.lines.length}종 읽음` + (unknown ? ` · 전산에 없는 상품 ${unknown}` : '') + (blank ? ` · 빈 줄 ${blank}개 제외` : '');
  m.src = src;
  render();
}
async function moveSave() {
  const m = S.ui.move; if (!m || !m.from || !m.to || m.from === m.to || !m.lines.length) return;
  const at = new Date().toISOString();
  const list = m.lines.filter(l => l.qty > 0 && S.P[l.pid]).map(l => ({ id: 'n' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: today(), store: m.from, type: '매장 이동', pid: l.pid, qty: -Math.abs(+l.qty || 0), memo: `→ ${storeName(m.to)}`, by: S.user.name, at }));
  if (!list.length) return;
  await DB.saveMoves(stampMoves(list, m.src || ''));
  for (const mv of list) { S.moves.push(mv); (S.stock[m.from] ||= {})[mv.pid] = stockOf(m.from, mv.pid) + mv.qty; S.transfers.push({ id: mv.id, pid: mv.pid, qty: -mv.qty, from: m.from, to: m.to, date: mv.date, by: S.user.name, at, status: 'sent' }); }
  const keep = m.from; S.ui.move = { from: keep, to: '', lines: [], q: '', note: '' };
  toast(`이동 ${list.length}종을 보냈습니다`); render();
}
async function receive(id) {
  const t = S.transfers.find(x => x.id === id); if (!t) return;
  const el = document.getElementById('rq_' + id); let q = el ? parseInt(el.value, 10) : t.qty;
  if (isNaN(q) || q < 0) { toast('받은 수량을 0 이상 숫자로 넣어 주세요'); return; }
  if (q > t.qty) { toast(`보낸 수량(${fmt(t.qty)}개)보다 많이 받을 수 없습니다`); return; }
  const short = t.qty - q;
  const go = async () => {
    const m = { id: 'r' + Date.now().toString(36), date: today(), store: t.to, type: '매장 이동(받음)', pid: t.pid, qty: q, memo: `← ${storeName(t.from)}${short ? ` · 보낸 ${fmt(t.qty)}개 중 ${fmt(short)}개 모자람` : ''}`, by: S.user.name, at: new Date().toISOString(), tid: t.id, sentQty: t.qty };
    await DB.saveMoves(stampMoves([m])); S.moves.push(m); (S.stock[t.to] ||= {})[t.pid] = stockOf(t.to, t.pid) + q;
    t.status = 'received'; t.recvDate = m.date; t.recvQty = q; toast(short ? `${fmt(q)}개 받기 확인 · ${fmt(short)}개 모자람을 기록했습니다` : '받기 확인했습니다');
  };
  if (short) { confirmDrawer('덜 온 수량으로 받기', `<p style="margin:0">${esc((S.P[t.pid] || {}).name || '')}<br>보낸 수량 <b>${fmt(t.qty)}개</b> 중 <b>${fmt(q)}개</b>만 받습니다. 모자란 <b class="qty-neg">${fmt(short)}개</b>는 기록에 남으니 보낸 매장과 확인해 주세요.</p>`, `${fmt(q)}개만 받기`, go); return; }
  await go();
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
  <div class="card" style="padding:8px 12px">${movesTable(byRecent(L).slice(0, 400))}${L.length > 400 ? '<p class="muted" style="font-size:13px">최근 400건만 보여 줍니다.</p>' : ''}</div>`;
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
// 빠른 기간. 시작·끝 포함. 화면을 열 때 기본은 오늘.
// 이번달 = 이번 달 1일 ~ 오늘(한국 날짜). 이번주 = 이번 주 월요일 ~ 오늘. 지난주 = 바로 앞 월~일. 지난달 = 바로 앞달 1일~말일.
// 최근 7일·14일 = 오늘 포함 N일. 최근 1개월·3개월 = 같은 날짜만큼 이전(그달에 그 날이 없으면 그달 마지막 날) ~ 오늘. 올해 = 1월 1일 ~ 오늘.
// 최근 올린 날·최근 자료 달·전체는 올려 둔 매출 날짜로 매번 다시 계산합니다. 이름은 저장하고, 날짜 숫자는 저장하지 않습니다.
const SALES_PRESETS = [
  { id: 'thisMonth', t: '이번달' }, { id: 'today', t: '오늘' }, { id: 'thisWeek', t: '이번주' }, { id: 'd7', t: '최근 7일' },
  { id: 'd14', t: '최근 14일' }, { id: 'prevWeek', t: '지난주' }, { id: 'm1', t: '최근 1개월' }, { id: 'prevMonth', t: '지난달' },
  { id: 'm3', t: '최근 3개월' }, { id: 'year', t: '올해' }, { id: 'lastDay', t: '최근 올린 날' }, { id: 'lastMonth', t: '최근 자료 달' }, { id: 'all', t: '전체' },
];
function salesPresetRange(id, now) {
  now = now || today();
  const stores = saleSt(S.stores || []);
  const last = latestSalesDate(stores), first = firstSalesDate(stores);
  if (id === 'thisMonth') return [now.slice(0, 7) + '-01', now];
  if (id === 'thisWeek') return [periodKey(now, 'week'), now];
  if (id === 'd7') return [addDays(now, -6), now];
  if (id === 'd14') return [addDays(now, -13), now];
  if (id === 'prevWeek') { const k = addDays(periodKey(now, 'week'), -7); return [k, addDays(k, 6)]; }
  if (id === 'm1') return [addMonths(now, -1), now];
  if (id === 'prevMonth') { const end = addDays(now.slice(0, 7) + '-01', -1); return [end.slice(0, 7) + '-01', end]; }
  if (id === 'm3') return [addMonths(now, -3), now];
  if (id === 'year') return [now.slice(0, 4) + '-01-01', now];
  if (id === 'lastDay') return [last || now, last || now];
  if (id === 'lastMonth') return last ? [last.slice(0, 7) + '-01', last] : [now, now];
  if (id === 'all') return first && last ? [first, last] : [now, now];
  return [now, now];
}
function presetSpan(a, b) {
  const ymd = d => `${d.slice(2, 4)}.${d.slice(5, 7)}.${d.slice(8, 10)}`;
  const mdn = d => `${d.slice(5, 7)}.${d.slice(8, 10)}`;
  if (a.slice(0, 4) !== b.slice(0, 4)) return `${ymd(a)}~${ymd(b)}`;
  return a === b ? ymd(a) : `${mdn(a)}~${mdn(b)}`;
}
function resolveSalesPeriod(now) {
  now = now || today();
  const p = S.ui.salesPeriod;
  const ok = x => /^\d{4}-\d{2}-\d{2}$/.test(x || '');
  if (p && p.preset === 'custom' && ok(p.a) && ok(p.b)) {
    let a = p.a, b = p.b;
    if (a > b) { const t = a; a = b; b = t; }
    if (b > now) b = now;
    if (a > now) a = now;
    if (a > b) a = b;
    return { preset: 'custom', a, b };
  }
  const id = p && SALES_PRESETS.some(x => x.id === p.preset) ? p.preset : 'today';
  const [a, b] = salesPresetRange(id, now);
  return { preset: id, a, b };
}
function rememberSalesPeriod(sp) {
  S.ui.salesPeriod = sp.preset === 'custom' ? { preset: 'custom', a: sp.a, b: sp.b } : { preset: sp.preset };
  S.ui.range = { unit: S.ui.salesUnit, ab: [sp.a, sp.b], preset: sp.preset };
}
function periodKey(d, unit) {
  if (unit === 'day') return d;
  if (unit === 'week') { const w = new Date(d + 'T00:00:00Z').getUTCDay(); return addDays(d, -((w + 6) % 7)); }
  if (unit === 'month') return d.slice(0, 7);
  if (unit === 'year') return d.slice(0, 4);
  return 'all';
}
function periodLabel(k, unit) {
  if (unit === 'day') return `${md(k)}`;
  if (unit === 'week') return `${md(k)} ~ ${md(addDays(k, 6))}`;
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
  if (mode === 'week') return { pa: addDays(a, -7), pb: addDays(b, -7), mode, label: len === 1 ? `지난주 같은 요일 · ${md(addDays(a, -7))}` : `1주 전 (${md(addDays(a, -7))} ~ ${md(addDays(b, -7))})` };
  if (mode === 'month') { const pa = addMonths(a, -1); let pb = addMonths(b, -1); if (b.slice(8) >= '28' && b === addDays(addMonths(b.slice(0, 8) + '01', 1), -1)) pb = addDays(a.slice(0, 8) + '01', -1); return { pa, pb, mode, label: `지난달 같은 날짜 (${md(pa)} ~ ${md(pb)})` }; }
  if (mode === 'year') { const pa = addMonths(a, -12), pb = addMonths(b, -12); return { pa, pb, mode, label: `작년 같은 날짜 (${pa.slice(2, 4)}.${md(pa)} ~ ${md(pb)})` }; }
  return { pa: addDays(a, -len), pb: addDays(a, -1), mode: 'prev', label: `바로 앞 ${len}일 (${md(addDays(a, -len))} ~ ${md(addDays(a, -1))})` };
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
    <div class="cmp-p"><span class="pl cur">이번</span><b>${md(a)} ~ ${md(b)}</b> <span class="muted">${C.length}일</span></div>
    <div class="cmp-p"><span class="pl pre">비교</span><b>${md(r.pa)} ~ ${md(r.pb)}</b> <span class="muted">${r.label.split(' (')[0]} · ${P.length}일</span></div>
    <div class="chips">${modes.map(([k, t]) => `<button class="chip ${(c.mode || 'auto') === k ? 'on' : ''}" data-cmpm="${k}">${t}</button>`).join('')}</div>
    ${ps.n === 0 ? '<div class="note">🔸 비교 기간에 매출 자료가 없습니다. 다른 비교 기간을 골라 보세요.</div>' : ''}
  </div>
  <div class="card"><div class="tw"><table class="tb cmp-t"><thead><tr><th></th><th class="n">이번</th><th class="n">비교</th><th class="n">차이</th><th class="n">증감</th></tr></thead><tbody>
    ${Object.entries(CMP_M).map(([k, [t, u]]) => `<tr class="${k === m ? 'sel' : ''}" data-cmpk="${k}"><td><b>${t}</b></td><td class="n"><b>${fmt(cs[k])}</b>${u}</td><td class="n">${fmt(ps[k])}${u}</td><td class="n">${cs[k] - ps[k] >= 0 ? '+' : ''}${fmt(cs[k] - ps[k])}</td><td class="n">${chg(pct(cs[k], ps[k]))}</td></tr>`).join('')}
  </tbody></table></div></div>
  ${n > 1 ? `<div class="card"><h2>${mt} 흐름 <span class="muted" style="font-size:12.5px;font-weight:600">${C.length ? fr(C[0].d, C[C.length - 1].d) : ''}</span> <span class="r"><span class="lg cur"></span>이번 <span class="lg pre"></span>비교</span></h2>${lineChart(C.map(v => ({ lab: mdc(v.d), sub: `(${wd(v.d)})`, d: v.d, v: v[m], tip: `${md(v.d)} · ${fmt(v[m])}${mu} · ${fmt(v.p)}건` })), { cmp: P.map(v => v[m]), cmpTip: P.map(v => `비교 ${md(v.d)} ${fmt(v[m])}${mu}`), unitFmt: m === 's' || m === 't' ? man : fmt, aria: mt + ' 기간 비교' })}</div>` : ''}
  <div class="card"><h2>날짜별 ${mt}</h2><div class="tw"><table class="tb cmp-t"><thead><tr><th>이번</th><th class="n">${mt}</th><th>비교</th><th class="n">${mt}</th><th class="n">증감</th></tr></thead><tbody>
    ${Array.from({ length: n }, (_, i) => { const x = C[i], y = P[i]; return `<tr><td class="nowrap">${x ? `${md(x.d)}` : ''}</td><td class="n">${x ? (x.has ? `<b>${fmt(x[m])}</b>` : '<span class="muted">-</span>') : ''}</td><td class="nowrap muted">${y ? `${md(y.d)}` : ''}</td><td class="n">${y ? (y.has ? fmt(y[m]) : '<span class="muted">-</span>') : ''}</td><td class="n">${x && y && x.has && y.has ? chg(pct(x[m], y[m]), 0) : ''}</td></tr>`; }).join('')}
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
    ${pv.mach.map((m, i) => `<tr><td><input class="inp" data-mname="${i}" value="${esc(m.name)}" style="min-width:150px"><div class="muted" style="font-size:11.5px">단말기 ${esc(m.no)} · ${esc(m.files.join(', '))}</div></td><td class="nowrap">${md(m.from)} ~ ${md(m.to)} <span class="muted">${Object.keys(m.days).length}일</span>${m.exists ? `<div style="font-size:11.5px;color:var(--warn)">🔸 이미 올린 ${m.exists}일은 새 값으로 바뀝니다</div>` : ''}</td><td class="n" style="font-weight:700">${fmt(m.s)}</td><td class="n">${fmt(m.n)}</td></tr>`).join('')}
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
  return `<div class="card"><h2>자판기·기계 매출 <span class="r">POS 밖 카드 단말기 · ${md(a)} ~ ${md(b)}</span></h2>
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
  return `<div class="card grand"><div class="g-top"><div><div class="g-lb">총매출 <span>토스포스 + 자판기·기계 · ${md(a)}${a !== b ? ' ~ ' + md(b) : ''}</span></div>
    <div class="g-v">${fmt(tot)}<small>원</small></div></div>
    <div class="g-cmp">${chg(pct(tot, prev))}<div class="muted">${esc(cmpLabel.split(' (')[0])} ${fmt(prev)}원${mc && !mp ? '<br>비교 기간은 기계 자료가 없어 토스포스만' : ''}</div></div></div>
    <div class="g-bar" role="img" aria-label="토스포스 ${Math.round(w)}%, 기계 ${100 - Math.round(w)}%"><i class="pos" style="width:${w}%"></i><i class="mac" style="width:${100 - w}%"></i></div>
    <div class="g-parts"><span><i class="dotc pos"></i>토스포스 <b>${fmt(pos)}</b>원 <span class="muted">${tot ? Math.round(w * 10) / 10 : 0}%</span></span><span><i class="dotc mac"></i>자판기·기계 <b>${fmt(mc)}</b>원 <span class="muted">${tot ? Math.round((100 - w) * 10) / 10 : 0}%</span>${mc ? '' : ' <span class="muted">· 자료 없음</span>'}</span></div></div>`;
}
function salesView() {
  const stores = saleSt(S.stores); const last = latestSalesDate(stores);
  if (!stores.length) return `${head('매출', '토스포스 매출리포트 기준')}<div class="card"><div class="empty">국대출판물류는 물류창고라 매출이 없습니다. 위 매장 선택에서 판매 매장을 골라 주세요.</div></div>`;
  const unit = S.ui.salesUnit;
  const sp = resolveSalesPeriod(); rememberSalesPeriod(sp);
  const a = sp.a, b = sp.b;
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
  const presetBtns = SALES_PRESETS.map(p => { const [x, y] = salesPresetRange(p.id); const on = sp.preset === p.id; return `<button type="button" class="${on ? 'on' : ''}" data-sp="${p.id}" aria-pressed="${on}"><span class="spl">${p.t}</span><span class="spd">${presetSpan(x, y)}</span></button>`; }).join('');
  const noData = stores.filter(s => !per[s].days);
  const posDays = sum.reduce((n, s) => n + per[s].days, 0);
  const machTot = machAgg(sum, a, b).reduce((n, m) => n + m.s, 0);
  const noSales = posDays === 0 && !machTot;
  const su = salesUpdated(stores);
  const how = sp.preset === 'custom' ? '직접 선택' : ((SALES_PRESETS.find(x => x.id === sp.preset) || {}).t || '오늘');
  return `${head('매출', `토스포스 매출리포트 기준 · ${S.stores.length > 1 ? '매장마다 마감일이 다릅니다 (아래 표)' : `${last ? `<b>${fd(last)} 마감</b>까지` : '아직 자료 없음'}${su.up ? ` · 마지막 올림 ${kst(su.up.at)} ${esc(whoText(su.up.by, su.up.co))}` : ''}`}`, `${canSettle() ? '<button class="btn" data-nav="mclose">월말 마감 보고서</button>' : ''}<button class="btn" id="posBtn">토스포스 파일 올리기</button><button class="btn" id="machBtn">자판기·기계 매출 올리기</button>`)}${freshTable(S.stores)}
  ${grandTotal(sum, a, b, pa, pb, cur.s, pre.s, cr.label)}
  <div class="card" style="display:flex;flex-direction:column;gap:12px">
    <div class="flt">
      <div class="fg"><div class="fl">보기 단위</div><div class="fseg">${units.map(([k, t]) => `<button class="${unit === k ? 'on' : ''}" data-su="${k}">${t}</button>`).join('')}</div></div>
      <div class="fg"><div class="fl">빠른 선택</div><div class="fquick" role="group" aria-label="빠른 기간">${presetBtns}</div></div>
      <div class="fg"><div class="fl">기간</div><div class="frange srange"><div class="fd"><span>시작</span>${dateSel('ra', a)}</div><span class="fsep">~</span><div class="fd"><span>종료</span>${dateSel('rb', b)}</div></div></div>
    </div>
    <p class="speriod">선택 기간 <b>${fr(a, b)}</b> <span class="muted">· ${len}일 · 시작·끝 포함 · ${how}</span></p>
    ${multi ? `<div class="field"><label>합산에 넣을 매장</label><div class="chips">${stores.map(s => `<label class="chip ${sum.includes(s) ? 'on' : ''}" style="display:inline-flex;gap:6px;align-items:center;cursor:pointer"><input type="checkbox" data-sum="${s}" ${sum.includes(s) ? 'checked' : ''} style="accent-color:var(--red)"><span class="dot" style="background:${storeColor(s)}"></span>${esc(storeName(s))}</label>`).join('')}</div></div>` : ''}
  </div>
  ${noSales ? `<div class="card"><div class="empty">이 기간(${fr(a, b)}) 매출 자료가 없습니다.${last ? `<br>마지막으로 올린 날은 ${fd(last)}입니다.` : '<br>아직 올린 매출 파일이 없습니다.'}<br>다른 기간을 고르거나 [토스포스 파일 올리기]로 넣어 주세요.</div></div>` : ''}
  ${noData.length && !noSales ? `<div class="note">${noData.map(s => esc(storeName(s))).join(', ')} — 이 기간 매출 자료가 없습니다. [토스포스 파일 올리기]로 넣어 주세요.</div>` : ''}
  <div class="tiles">
    <button class="tile tbtn" data-cmp="s"><span class="lb">토스포스 매출${multi ? ` · 합산 ${sum.length}곳` : ''}<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.s)).length>9?' long':''}">${fmt(cur.s)}<small>원</small></span><span class="d">${ch == null ? '<span class="muted">이전 기간 자료 없음</span>' : `${chg(ch)} <span class="muted">${cmpLabel}</span>`}</span></button>
    <button class="tile tbtn" data-cmp="p"><span class="lb">결제건수<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.p)).length>9?' long':''}">${fmt(cur.p)}<small>건</small></span><span class="d">${chg(pct(cur.p, pre.p))} <span class="muted">이전 ${fmt(pre.p)}건</span></span></button>
    <button class="tile tbtn" data-cmp="t"><span class="lb">객단가<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.p ? cur.s / cur.p : 0)).length>9?' long':''}">${fmt(cur.p ? cur.s / cur.p : 0)}<small>원</small></span><span class="d">${chg(pct(cur.p ? cur.s / cur.p : 0, pre.p ? pre.s / pre.p : 0))} <span class="muted">이전 ${fmt(pre.p ? pre.s / pre.p : 0)}원</span></span></button>
    <button class="tile tbtn" data-cmp="q"><span class="lb">판매수량<span class="go">비교 ›</span></span><span class="v big${String(fmt(cur.q)).length>9?' long':''}">${fmt(cur.q)}<small>개</small></span><span class="d">${chg(pct(cur.q, pre.q))} <span class="muted">이전 ${fmt(pre.q)}개</span></span></button>
  </div>
  <div class="muted" style="font-size:12px;margin-top:-6px">비교 기간: ${esc(cr.label)} · 칸을 누르면 두 기간을 날짜별로 비교합니다</div>
  ${S.stores.some(isWh) ? '<div class="muted" style="font-size:12px;margin-top:-6px">국대출판물류(물류창고)는 매출 합계에서 뺐습니다</div>' : ''}
  ${ceoSales(per, sum, stores, a, b)}
  ${unit !== 'ip' ? machBlock(sum, a, b, cur.s) : ''}
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
  return `<div class="card"><h2>${title} 매출 <span class="muted" style="font-size:12.5px;font-weight:600">${keys.length ? periodLabel(keys[0], unit).split(' ~ ')[0] + ' ~ ' + periodLabel(keys[keys.length - 1], unit).split(' ~ ').pop() : ''}</span> <span class="r">${rows.length}개 · 최근이 위</span></h2>
    ${lineChart(keys.map(k => { const v = multi ? totK(k) : val(stores[0], k); const p = sum.reduce((a, s) => a + ((per[s].series[k] || {}).p || 0), 0); const ex = ` · ${fmt(p)}건`; if (unit === 'day') return dayPt(k, v, ex); if (unit === 'week') return { lab: mdc(k) + '~', sub: `(${wd(k)})`, v, tip: `${periodLabel(k, unit)} · ${fmt(v)}원${ex}` }; return { lab: unit === 'month' ? fm(k) : periodLabel(k, unit), v, tip: `${periodLabel(k, unit)} · ${fmt(v)}원${ex}` }; }), { aria: title + ' 매출 추이' })}
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
    <div class="alerts">${pv.days.map(d => `<div class="al"><span class="ic">${d.ok ? '✔' : '🔺'}</span><span class="tx"><b>${fd(d.date)}</b> 매출 ${won(d.s)} · ${fmt(d.p)}건 · 상품 ${d.items}종 ${fmt(d.q)}개${d.ok ? ' — 결제 합계와 상품 합계 일치' : ` — 🔺 결제 ${won(d.s)} ≠ 상품 ${won(d.si)}`}${d.exists ? '<br>🔸 이미 올린 날짜입니다. 저장하면 덮어씁니다.' : ''}</span></div>`).join('')}
    ${pv.match ? `<div class="al"><span class="ic">${pv.unmatched.length ? '🔸' : '✔'}</span><span class="tx">재고 차감: 상품 <b>${fmt(pv.matchN)}종</b> 찾음${pv.newDays.length ? ` · 뺄 수량 ${fmt(pv.matchQ)}개` : ''}${pv.unmatched.length ? ` · 못 찾은 상품 <b>${pv.unmatched.length}종</b> (${fmt(pv.unmatched.reduce((a, b) => a + b.q, 0))}개) — 아래에서 이어 주지 않으면 재고에서 빼지 않습니다` : ''}</span></div>` : ''}</div>
    ${pv.unmatched.length ? `<details class="posun" ${pv.unmatched.length <= 12 ? 'open' : ''}><summary>못 찾은 상품 ${pv.unmatched.length}종 모두 보기 · 상품 이어 주기</summary>
      <div class="tw"><table><thead><tr><th>POS 상품명</th><th class="n">판매</th><th>재고 상품으로 이어 주기</th></tr></thead><tbody>${pv.unmatched.map((u, i) => `<tr><td class="nm">${esc(u.name)}${u.multi ? '<div style="font-size:12px;color:var(--warn)">🔸 같은 이름 상품이 여러 개</div>' : ''}</td><td class="n">${fmt(u.q)}</td><td>${u.cands.length ? `<select class="inp" data-posln="${i}" aria-label="${esc(u.name)} 이을 상품"><option value="">— 빼지 않음 —</option>${u.cands.map(p => `<option value="${esc(p.id)}">${esc(p.name)} · ${esc(p.barcode || p.sku)} · 재고 ${fmt(stockOf(pv.store, p.id))}</option>`).join('')}</select>` : '<span class="muted" style="font-size:12px">비슷한 상품 없음 — 관리 › 상품 목록에 등록</span>'}</td></tr>`).join('')}</tbody></table></div>
      <p class="muted" style="font-size:12px;margin:6px 0 0">이어 준 내용은 이번 올리기에만 쓰입니다. 상품 정보는 바뀌지 않습니다.</p></details>` : ''}
    ${Object.keys(pv.links).length ? `<div class="note" style="font-size:12.5px">✔ 이어 준 상품 ${Object.keys(pv.links).length}종: ${Object.entries(pv.links).map(([n, id]) => `${esc(n)} → <b>${esc(S.P[id].name)}</b>`).join(' · ')}</div>` : ''}
    ${pv.deduct && pv.neg.length ? `<div class="note bad">🔺 <b>재고가 마이너스가 되는 상품 ${pv.neg.length}종</b> — 실제 재고보다 많이 팔린 것으로 나옵니다. 입고·이동 누락이 없는지 확인해 주세요.<ul style="margin:6px 0 0;padding-left:18px;font-size:12.5px">${pv.neg.slice(0, 10).map(x => `<li>${esc(S.P[x.pid].name)} · 지금 ${fmt(x.now)} → <b class="qty-neg">${fmt(x.after)}</b></li>`).join('')}${pv.neg.length > 10 ? `<li>외 ${pv.neg.length - 10}종</li>` : ''}</ul>
      <label class="ck" style="margin-top:8px"><input type="checkbox" id="posNegOk" ${pv.negOk ? 'checked' : ''}><span class="t">확인했습니다. 마이너스로 두고 저장합니다</span></label></div>` : ''}
    <label class="ck"><input type="checkbox" id="posDeduct" ${pv.deduct ? 'checked' : ''} ${pv.newDays && pv.newDays.length ? '' : 'disabled'}><span><span class="t">판매 수량을 재고에서 빼기${pv.newDays && pv.newDays.length ? ` — ${pv.newDays.length === 1 ? md(pv.newDays[0]) : md(pv.newDays[0]) + ' ~ ' + md(pv.newDays[pv.newDays.length - 1])} ${pv.newDays.length}일치만` : ''}</span><span class="s" style="display:block">${pv.lastPos ? `${md(pv.lastPos)}까지는 이미 재고에서 뺐습니다. ${pv.newDays.length ? '그 뒤 날짜만 빼서 두 번 빠지지 않습니다.' : '새로 뺄 날짜가 없습니다 (매출만 저장).'}` : "찾은 상품만 '판매'로 재고에서 뺍니다."}</span></span></label>
    <div class="row" style="justify-content:flex-end;margin-top:10px"><button class="btn pri" id="posSave" ${pv.days.every(d => d.ok) && !(pv.deduct && pv.neg.length && !pv.negOk) ? '' : 'disabled'}>매출 저장</button></div></div>` : ''}`;
}
// POS 상품명 → 재고 상품 찾기 (+ 화면에서 직접 이어 준 상품). 못 찾은 상품은 판매 수량·비슷한 상품 후보와 함께
function posRecalc(pv) {
  const store = pv.store, match = [], un = {};
  for (const d of pv.days) for (const x of d.L) {
    const lk = pv.links[x.name]; const c = lk ? [S.P[lk]] : S.byName[norm(x.name)];
    if (lk || (c && c.length === 1 && (S.stock[store] || {})[c[0].id] != null)) match.push({ date: d.date, pid: c[0].id, q: x.q });
    else { const u = un[x.name] ||= { name: x.name, q: 0, n: d.date, multi: c && c.length > 1 ? c : null }; u.q += x.q; }
  }
  const nn = s => norm(s).replace(/^\(.*?\)|\d+(호|번|종)?$/g, '');
  for (const u of Object.values(un)) {
    const k = norm(u.name), k2 = nn(u.name);
    u.cands = (u.multi || S.products.filter(p => { const a = norm(p.name); return a && k && (a.includes(k) || k.includes(a) || (k2.length > 2 && a.includes(k2))); })).slice(0, 8);
  }
  const deductM = match.filter(m => !pv.lastPos || m.date > pv.lastPos), use = {};
  for (const m of deductM) use[m.pid] = (use[m.pid] || 0) + m.q;
  pv.match = match; pv.matchN = Object.keys(use).length || new Set(match.map(m => m.pid)).size; pv.matchQ = deductM.reduce((a, b) => a + b.q, 0);
  pv.unmatched = Object.values(un).sort((a, b) => b.q - a.q);
  pv.neg = Object.entries(use).map(([pid, q]) => ({ pid, now: stockOf(store, pid), after: stockOf(store, pid) - q })).filter(x => x.after < 0).sort((a, b) => a.after - b.after);
  return pv;
}
async function readPos(f, store) { await needX();
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
    days.sort((a, b) => a.date.localeCompare(b.date));
    for (const d of days) {
      const L = items[d.date] || []; d.items = L.length; d.q = L.reduce((a, b) => a + b.q, 0); d.si = L.reduce((a, b) => a + b.s, 0); d.ok = d.si === d.s; d.exists = !!dayRec(store, d.date); d.L = L;
    }
    if (!days.length) throw new Error('결제 합계에 날짜 줄이 없습니다.');
    // 재고는 '마지막으로 POS 판매를 뺀 날짜' 다음 날부터만 뺌 (한 달치 파일을 다시 올려도 두 번 빠지지 않게)
    const lastPos = S.moves.filter(m => m.store === store && m.type === '판매' && m.by === '자동(POS)').reduce((a, m) => (m.date > a ? m.date : a), '');
    const newDays = days.map(d => d.date).filter(d => d > lastPos).sort();
    S.ui.posPreview = posRecalc({ store, days, file: f.name, lastPos, newDays, links: {}, deduct: newDays.length > 0, negOk: false });
  } catch (err) {
    S.ui.posPreview = { store, err: /password|encrypted|Wrong/i.test(String(err && err.message)) ? `zip 비밀번호가 맞지 않습니다. 관리 › 파일 비밀번호에서 ${storeName(store)} 비밀번호를 확인해 주세요.` : String(err.message || err) };
  }
  render();
}
async function savePos() {
  const pv = S.ui.posPreview; const st = pv.store;
  if (pv.deduct && pv.neg.length && !pv.negOk) { toast('마이너스 재고 확인란을 먼저 눌러 주세요'); return; }
  for (const d of pv.days) {
    const ip = {}, pr = {}; for (const x of d.L) { const a = ip[x.ip] ||= [0, 0]; a[0] += x.q; a[1] += x.s; const b = pr[x.name] ||= [0, 0, x.ip]; b[0] += x.q; b[1] += x.s; }
    const rec = { s: d.s, p: d.p, q: d.q, ip, pr, up: { at: new Date().toISOString(), by: S.user.name, co: userCo(S.user), uid: S.user.uid, file: pv.file || '' } };
    await DB.saveSalesDay(st, d.date, rec);
    ((S.sales[st] ||= {})[d.date.slice(0, 7)] ||= { days: {} }).days[d.date.slice(8)] = rec;
  }
  if (pv.deduct && pv.newDays.length && pv.match.length) {
    const list = pv.match.filter(m => !pv.lastPos || m.date > pv.lastPos).map((m, i) => ({ id: 'p' + Date.now().toString(36) + i, date: m.date, store: st, type: '판매', pid: m.pid, qty: -m.q, memo: 'POS 판매', by: '자동(POS)', at: new Date().toISOString() }));
    await DB.saveMoves(stampMoves(list, pv.file)); for (const m of list) { S.moves.push(m); S.stock[st][m.pid] = stockOf(st, m.pid) + m.qty; }
  }
  S.ui.posPreview = null; S.ui.drawer = null; toast(`매출 ${pv.days.length}일치를 저장했습니다`);
}
async function readBook(f) { await needX();
  // CSV는 글자(UTF-8)로 읽어야 한글이 깨지지 않음
  if (/\.csv$/i.test(f.name)) { let t = await f.text(); if (t.includes('\uFFFD')) t = new TextDecoder('euc-kr').decode(await f.arrayBuffer()); return XLSX.read(t.replace(/^\uFEFF/, ''), { type: 'string' }); }
  return XLSX.read(await f.arrayBuffer(), { type: 'array' });
}
// 파일 끌어다 놓기: 파일 고르기 버튼이 있는 칸 어디에 놓아도 그 버튼을 누른 것과 같게
const FILE_BTNS = ['fileBtn', 'posFileBtn', 'rulesBtn', 'ibPlanFile', 'ibSheetFile', 'ibPlanImg', 'ibActFile', 'cntFile', 'machFileBtn', 'naverFileBtn', 'schedFile'];
let pendingDrop = null;
const okType = (f, accept) => !accept || accept.split(',').some(a => { a = a.trim().toLowerCase(); if (!a) return false; if (a.endsWith('/*')) return (f.type || '').toLowerCase().startsWith(a.slice(0, -1)); if (a.startsWith('.')) return f.name.toLowerCase().endsWith(a); return (f.type || '').toLowerCase() === a; });
function markDropZones() {
  FILE_BTNS.forEach(id => {
    const b = document.getElementById(id); if (!b || b.closest('.tabbar')) return;
    const z = b.closest('.drop') || b.closest('.field') || b.closest('.card') || b.parentElement; if (!z || z.dataset.fzone) return;
    z.dataset.fzone = id;
    if (!z.classList.contains('drop') && !b.nextElementSibling?.classList?.contains('drophint')) b.insertAdjacentHTML('afterend', '<span class="drophint">또는 파일을 여기로 끌어다 놓기</span>');
  });
}
const fzoneAt = e => e.target && e.target.closest ? e.target.closest('[data-fzone]') : null;
let dzOn = null;
document.addEventListener('dragover', e => { const z = fzoneAt(e); if (!z) return; e.preventDefault(); if (dzOn !== z) { dzOn && dzOn.classList.remove('dropok', 'on'); z.classList.add('dropok', 'on'); dzOn = z; } });
document.addEventListener('dragleave', e => { if (dzOn && !dzOn.contains(e.relatedTarget)) { dzOn.classList.remove('dropok', 'on'); dzOn = null; } });
document.addEventListener('drop', e => {
  const z = fzoneAt(e); dzOn && dzOn.classList.remove('dropok', 'on'); dzOn = null;
  if (!z) { if (e.dataTransfer && e.dataTransfer.types && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); return; }
  e.preventDefault(); const fs = [...(e.dataTransfer.files || [])]; if (!fs.length) return;
  const b = document.getElementById(z.dataset.fzone); if (!b) return;
  pendingDrop = fs; b.click(); setTimeout(() => { pendingDrop = null; }, 1500);
});
addEventListener('dragover', e => { if (e.dataTransfer && [...(e.dataTransfer.types || [])].includes('Files') && !fzoneAt(e)) e.preventDefault(); });
function pickFile(accept, cb, multi) {
  if (pendingDrop) {
    const fs = pendingDrop.filter(f => okType(f, accept)); pendingDrop = null;
    if (!fs.length) { alertBox('이 칸에 놓을 수 없는 파일 형식입니다. (' + accept + ')'); return; }
    multi ? cb(fs) : cb(fs[0]); return;
  }
  // 화면이 다시 그려져도 사라지지 않도록 문서 맨 끝에 따로 만든 파일 선택 칸
  let inp = document.getElementById('smgFilePick');
  if (inp) inp.remove();
  inp = document.createElement('input'); inp.type = 'file'; inp.id = 'smgFilePick'; inp.accept = accept; inp.style.display = 'none'; if (multi) inp.multiple = true;
  inp.addEventListener('change', () => { const fs = [...(inp.files || [])]; if (fs.length) multi ? cb(fs) : cb(fs[0]); });
  document.body.appendChild(inp); inp.click();
}
const needX = () => window.XLSX ? Promise.resolve() : loadScript('https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js');   // 엑셀 도구는 뒤에서 따로 받음
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

/* ───────── 팝업 시공비 (견적서 수원 AK, 2026-10-01 확인) ───────── */
const POPUP_XLS = 'SMG___AK________________261027_8a2e.xls';
function popupQuote() {
  const lines = [
    { name: '라이팅 패널 필름', spec: '1059*2160', qty: 1, price: 90000, amount: 90000, note: '' },
    { name: '솔벤 텐트천 포토존', spec: '5000*3000', qty: 1, price: 380000, amount: 380000, note: '' },
    { name: '내부 현수막', spec: '900*3000', qty: 5, price: 60000, amount: 300000, note: '알루미늄 족자' },
    { name: '거울 시트지', spec: '2000*2000', qty: 1, price: 80000, amount: 80000, note: '' },
    { name: '우드락 등신대', spec: '', qty: 6, price: 50000, amount: 300000, note: '' },
    { name: '매대용 삽지', spec: '910*290', qty: 8, price: 15000, amount: 120000, note: '' },
  ];
  return {
    id: '', ip: '진격의 거인 팝업', place: '수원 AK플라자 (수원 SMG STORE)', vendor: '주식회사 포시',
    quoteDate: '2026-10-01', mailNote: 'SMG 한지우 님 메일 2026-11-10 전달', shipDate: '2026-11-11', month: '2026-11',
    lines, overhead: 63500, freight: 80000, freightSpec: '성수-수원', confirmed: 1490000,
    memo: '시공물 2026-11-11(수) 발송 예정. 견적서 칸 이름은 총계(천단위 절삭)이나 1,413,500원을 천 원 단위로 자르면 1,413,000원이다.',
    fileName: POPUP_XLS, sheet: '견적서_수원_최종', biz: 'offline',
  };
}
function popupNums(p) {
  const lines = (p.lines || []).map(l => ({ ...l, qty: +l.qty || 0, price: +l.price || 0, amount: +l.amount || 0 }));
  const sub = lines.reduce((t, l) => t + l.amount, 0);
  const overhead = +p.overhead || 0, freight = +p.freight || 0, confirmed = +p.confirmed || 0;
  const sum = sub + overhead + freight, gap = confirmed - sum, vat = Math.round(confirmed * 0.1), gross = confirmed + vat;
  return { lines, sub, overhead, freight, sum, confirmed, gap, vat, gross };
}
function popupsIn(ym, biz) { return (S.popups || []).filter(p => p.month === ym && (p.biz || 'offline') === biz); }
function canPopup() { return isOwner() || can('approve'); }
function popupView() {
  if (!canPopup()) return `${head('팝업 비용', '대표·본부장만')}<div class="card"><div class="empty">대표 또는 승인 권한이 있는 본부장만 팝업 시공비를 넣습니다.</div></div>`;
  const f = S.ui.popupForm || (S.ui.popupForm = popupQuote());
  const n = popupNums(f);
  const inp = (k, label, v, extra = '') => `<label class="field"><span>${label}</span><input class="inp" data-pc="${k}" value="${esc(v == null ? '' : v)}" ${extra}></label>`;
  const area = (k, v) => `<textarea class="inp" data-lk="${k}" rows="1">${esc(v || '')}</textarea>`;
  const lineRow = (l, i) => `<tr data-pline="${i}"><td class="pl-name">${area('name', l.name)}</td><td class="pl-spec">${area('spec', l.spec)}</td><td class="pl-qty"><input class="inp" data-lk="qty" inputmode="numeric" value="${l.qty}"></td><td class="pl-price"><input class="inp" data-lk="price" inputmode="numeric" value="${l.price}"></td><td class="n">${fmt(l.amount)}</td><td class="pl-note">${area('note', l.note)}</td></tr>`;
  const saved = `<h2>저장된 팝업</h2>
      ${(S.popups || []).length ? `<div class="tw"><table><thead><tr><th>팝업</th><th>반영 월</th><th class="n">확정</th><th></th></tr></thead><tbody>${S.popups.map(p => `<tr><td>${esc(p.ip)}<div class="muted">${esc(p.place || '')}</div></td><td>${esc(p.month)}</td><td class="n">${fmt(p.confirmed)}</td><td><button class="btn sm" data-pcdel="${esc(p.id)}">지우기</button></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">아직 저장된 팝업 비용이 없습니다. 위 견적을 확인한 뒤 저장하세요.</div>'}`;
  return `${head('팝업 비용', '정산 옆 · 팝업 한 건의 시공비 · 대표·본부장', '<button class="btn" id="pcLoad">견적 불러오기</button><button class="btn pri" id="pcSave">이 견적 저장</button>')}
  <div class="popgrid">
    <div class="popcol">
    <div class="card">
      <h2>입력</h2>
      <div class="formgrid">
        ${inp('ip', 'IP / 팝업명', f.ip)}
        ${inp('place', '장소', f.place)}
        ${inp('vendor', '업체', f.vendor)}
        ${inp('quoteDate', '견적일', f.quoteDate, 'type="date"')}
        ${inp('shipDate', '발송일', f.shipDate, 'type="date"')}
        ${inp('month', '반영 월', f.month, 'inputmode="numeric" placeholder="2026-11"')}
        ${inp('confirmed', '공급가 확정 금액 (부가세 별도)', f.confirmed, 'inputmode="numeric"')}
        ${inp('overhead', '공과잡비·기업이윤', f.overhead, 'inputmode="numeric"')}
        ${inp('freight', '운송', f.freight, 'inputmode="numeric"')}
      </div>
      <label class="field" style="margin-top:8px"><span>전달 메모</span><input class="inp" data-pc="mailNote" value="${esc(f.mailNote || '')}"></label>
      <label class="field" style="margin-top:8px"><span>메모</span><input class="inp" data-pc="memo" value="${esc(f.memo || '')}"></label>
      <p class="src">원본 파일 ${esc(f.fileName || '')}${f.sheet ? ' · 시트 ' + esc(f.sheet) : ''}. 견적 불러오기는 이 파일에서 확인한 품목·수량·금액을 칸에 채웁니다. 저장하기 전에는 서버에 올리지 않습니다.</p>
    </div>
    <div class="card">${saved}</div>
    </div>
    <div class="card">
      <h2>항목 내역</h2>
      <div class="tw"><table class="plines"><colgroup><col class="c-name"><col class="c-spec"><col class="c-qty"><col class="c-price"><col class="c-amt"><col class="c-note"></colgroup><thead><tr><th>품목</th><th>규격</th><th class="n">수량</th><th class="n">단가</th><th class="n">금액</th><th>비고</th></tr></thead><tbody>
        ${n.lines.map(lineRow).join('')}
        <tr class="tot"><td colspan="4">소계</td><td class="n">${fmt(n.sub)}</td><td></td></tr>
        <tr><td colspan="4">공과잡비·기업이윤</td><td class="n">${fmt(n.overhead)}</td><td></td></tr>
        <tr><td colspan="4">운송 ${esc(f.freightSpec || '')}</td><td class="n">${fmt(n.freight)}</td><td></td></tr>
        <tr class="tot"><td colspan="4">합계</td><td class="n">${fmt(n.sum)}</td><td></td></tr>
        <tr class="tot"><td colspan="4">확정 공급가</td><td class="n">${fmt(n.confirmed)}</td><td>부가세 별도</td></tr>
        <tr><td colspan="4">차액 (확정 − 합계)</td><td class="n">${fmt(n.gap)}</td><td>${n.gap === 76500 ? '업체 이윤으로 봄' : ''}</td></tr>
        <tr><td colspan="4">부가세</td><td class="n">${fmt(n.vat)}</td><td>견적서에 칸 없음 · 확정 공급가의 10%</td></tr>
        <tr class="tot"><td colspan="4">부가세 포함</td><td class="n">${fmt(n.gross)}</td><td></td></tr>
      </tbody></table></div>
      <p class="src">시트 칸 이름은 총계(천단위 절삭) ${fmt(1490000)}원입니다. 합계 ${fmt(1413500)}원을 천 원 단위로 자르면 ${fmt(1413000)}원이지 ${fmt(1490000)}원이 아닙니다. 차액 ${fmt(76500)}원은 업체 이윤으로 봅니다. 이익에서는 부가세 별도 확정 금액만 뺍니다.</p>
    </div>
  </div>`;
}
function readPopupForm() {
  const g = k => { const el = document.querySelector(`[data-pc="${k}"]`); return el ? el.value.trim() : ''; };
  const num = s => { const x = String(s == null ? '' : s).replace(/[^\d.-]/g, ''); return x === '' || x === '-' ? 0 : +x; };
  const lines = [...document.querySelectorAll('[data-pline]')].map(tr => {
    const v = k => { const el = tr.querySelector(`[data-lk="${k}"]`); return el ? el.value.trim() : ''; };
    const qty = num(v('qty')), price = num(v('price'));
    const typed = v('amount');
    const amount = typed === '' ? qty * price : num(typed);
    return { name: v('name'), spec: v('spec'), qty, price, amount, note: v('note') };
  }).filter(l => l.name);
  const base = S.ui.popupForm || popupQuote();
  return { ...base, ip: g('ip'), place: g('place'), vendor: g('vendor'), quoteDate: g('quoteDate'), shipDate: g('shipDate'), month: g('month'), mailNote: g('mailNote'), memo: g('memo'), confirmed: num(g('confirmed')), overhead: num(g('overhead')), freight: num(g('freight')), lines };
}
async function savePopupForm() {
  const p = readPopupForm();
  if (!p.ip || !p.month) { alertBox('팝업명과 반영 월이 필요합니다'); return; }
  if (!/^\d{4}-\d{2}$/.test(p.month)) { alertBox('반영 월은 2026-11처럼 쓰세요'); return; }
  p.id = p.id || ('pc-' + Date.now().toString(36));
  const n = popupNums(p);
  p.subtotal = n.sub; p.sum = n.sum; p.gap = n.gap; p.vat = n.vat; p.gross = n.gross;
  p.gapNote = n.gap === 76500 ? '업체 이윤으로 봄' : '';
  if (DB.savePopup) await DB.savePopup(p);
  S.popups = (S.popups || []).filter(x => x.id !== p.id).concat(p);
  S.ui.popupForm = { ...p, id: '' };
  toast('팝업 비용을 저장했습니다'); render();
}
async function deletePopup(id) {
  if (DB.deletePopup) await DB.deletePopup(id);
  S.popups = (S.popups || []).filter(p => p.id !== id);
  toast('지웠습니다'); render();
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
  return `${head('정산', '대표만 보입니다 · POS 매출 × 홀딩스 정산서 요율 + 자판기·기계 매출 × 20%', `<button class="btn" data-nav="mclose">월말 마감 보고서</button><select class="inp" id="setM" style="width:auto">${months.map(x => `<option ${x === m ? 'selected' : ''}>${x}</option>`).join('')}</select>`)}
  <div class="tiles"><div class="tile"><span class="lb">판매 금액${machSales ? ' (POS + 기계)' : ''}</span><span class="v big${String(fmt(ipRows.reduce((a, r) => a + r.sales, 0))).length>9?' long':''}">${fmt(ipRows.reduce((a, r) => a + r.sales, 0))}<small>원</small></span>${machSales ? `<span class="d muted">기계 ${fmt(machSales)}원 포함</span>` : ''}</div>
    <div class="tile"><span class="lb">온인터 배분</span><span class="v big${String(fmt(T('onin'))).length>9?' long':''}">${fmt(T('onin'))}<small>원</small></span></div>
    <div class="tile"><span class="lb">크리에이티브 지급</span><span class="v big${String(fmt(-T('creative'))).length>9?' long':''}">${fmt(-T('creative'))}<small>원</small></span></div>
    <div class="tile"><span class="lb">순수익 (${/확정/.test(st) ? '✔ 확정' : '🔸 예상'})</span><span class="v big${String(fmt(T('net'))).length>9?' long':''}">${fmt(T('net'))}<small>원</small></span><span class="d muted">시공비 차감 포함</span></div></div>
  <div class="note" style="font-size:12.5px">${/확정/.test(st) ? '✔ 홀딩스 정산서와 맞춘 확정 금액입니다.' : `🔸 예상 금액 · 매출 <b>${esc(/^\d{4}-\d{2}-\d{2}$/.test(lastDate || '') ? fd(lastDate) : lastDate)}</b>까지 반영 · 토스포스 파일을 올리면 바로 다시 계산됩니다.${S.settleRules ? '' : ' (정산 요율이 아직 등록되지 않아 마지막으로 넣은 자료를 보여 줍니다)'}`}</div>
  ${unknown.length ? `<div class="note bad">🔺 요율이 정해지지 않은 IP ${unknown.length}개: ${unknown.map(r => esc(r.ip)).join(', ')} — 순수익 합계에서 빠져 있습니다.</div>` : ''}
  <div class="card"><h2>IP별 · 기계</h2><div class="tw"><table><thead><tr><th>IP</th><th class="hide-s">공급</th><th class="n">판매 금액</th><th class="n">요율</th><th class="n">온인터 배분</th><th class="n hide-s">크리에이티브 지급</th><th class="n">순수익</th></tr></thead><tbody>
  ${ipRows.map(r => `<tr><td class="nm">${esc(r.ip)}</td><td class="hide-s nowrap muted">${esc(r.supplier)}</td><td class="n">${fmt(r.sales)}</td><td class="n">${r.rate === '' ? '-' : Math.round(r.rate * 100) + '%'}</td><td class="n">${fmt(r.onin)}</td><td class="n hide-s">${r.creative ? fmt(-r.creative) : '-'}</td><td class="n" style="font-weight:700">${fmt(r.net)}</td></tr>`).join('')}
  ${ded.map(r => `<tr><td class="nm">${esc(r.ip)}</td><td class="hide-s muted">차감</td><td class="n">-</td><td class="n">-</td><td class="n">${fmt(r.onin)}</td><td class="n hide-s">-</td><td class="n" style="font-weight:700;color:var(--bad)">${fmt(r.net)}</td></tr>`).join('')}
  <tr class="tot"><td>합계</td><td class="hide-s"></td><td class="n">${fmt(ipRows.reduce((a, r) => a + r.sales, 0))}</td><td></td><td class="n">${fmt(T('onin'))}</td><td class="n hide-s">${fmt(-T('creative'))}</td><td class="n">${fmt(T('net'))}</td></tr></tbody></table></div></div>`;
}

/* ───────── 월말 마감 보고서 (대표만) ───────── */
function josa(name, a, b) { const c = String(name).charCodeAt(String(name).length - 1); return (c >= 0xAC00 && c <= 0xD7A3 && (c - 0xAC00) % 28) ? a : b; }
function ymAdd(ym, n) { const [y, m] = ym.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1 + n, 1)); return `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}`; }
function monthEnd(ym) { const [y, m] = ym.split('-').map(Number); return `${ym}-${String(new Date(Date.UTC(y, m, 0)).getUTCDate()).padStart(2, '0')}`; }
function monthDays(ym) { const b = monthEnd(ym), o = []; for (let d = ym + '-01'; d <= b; d = addDays(d, 1)) o.push(d); return o; }
function closeYm() { const cap = today().slice(0, 7); let ym = S.ui.closeYm || ymPrev(cap); if (ym > cap) ym = cap; S.ui.closeYm = ym; return ym; }
function numOrNull(v) { return v === '' || v == null || v === undefined ? null : +v; }
function costOf(id) { const c = (S.biz && S.biz._cfg && S.biz._cfg[id]) || {}; return { cr: numOrNull(c.cr), labor: numOrNull(c.labor), rent: numOrNull(c.rent), goal: numOrNull(c.goal) }; }
function profitOf(sales, c) { if (sales == null || c.cr == null || c.labor == null || c.rent == null) return null; return Math.round(sales * (1 - c.cr / 100) - c.labor - c.rent); }
function storeDays(st, ym) { const mon = (S.sales[st] || {})[ym]; const days = {}; if (mon && mon.days) for (const [dd, r] of Object.entries(mon.days)) if (r) days[ym + '-' + dd] = r; return days; }
function machMonth(st, ym) {
  const mon = (S.sales[st] || {})[ym]; if (!mon || !mon.mach) return null;
  let s = 0, n = 0, days = 0;
  for (const m of Object.values(mon.mach)) for (const v of Object.values(m.days || {})) { s += v[0] || 0; n += v[1] || 0; days++; }
  return days ? { s, n, days } : null;
}
function unitMonth(b, ym) {
  const cost = costOf(b.id);
  if (b.stores) {
    const dayMap = {}, agg = {};
    for (const st of b.stores) for (const [d, r] of Object.entries(storeDays(st, ym))) { const x = agg[d] ||= { s: 0, p: 0, q: 0 }; x.s += r.s || 0; x.p += r.p || 0; x.q += r.q || 0; }
    let s = 0, p = 0, q = 0, last = '';
    for (const [d, r] of Object.entries(agg)) { dayMap[d] = r.s; s += r.s; p += r.p; q += r.q; if (d > last) last = d; }
    const mach = b.stores.map(st => machMonth(st, ym)).filter(Boolean);
    const ms = mach.reduce((t, x) => t + x.s, 0), hasPos = !!last, hasMach = mach.length > 0;
    const sales = hasPos || hasMach ? s + ms : null;
    return { b, cost, sales, pos: hasPos ? s : null, mach: hasMach ? ms : null, p: hasPos ? p : null, q: hasPos ? q : null, days: Object.keys(agg).length, last, dayMap, memo: '' };
  }
  const recs = Object.entries(S.biz[b.id] || {}).filter(([d]) => d.slice(0, 7) === ym);
  const sales = recs.length ? recs.reduce((t, [, v]) => t + (v.s || 0), 0) : null;
  const p = recs.length ? recs.reduce((t, [, v]) => t + (v.p || 0), 0) : null;
  const last = recs.reduce((a, [d]) => d > a ? d : a, '');
  return { b, cost, sales, pos: null, mach: null, p, q: null, days: recs.length, last, dayMap: Object.fromEntries(recs.map(([d, v]) => [d, v.s || 0])), memo: recs.map(([, v]) => v.memo).filter(Boolean).join(' · ') };
}
function kujiPos(ym) {
  let s = 0, q = 0, hit = false;
  for (const r of Object.values(storeDays('suwon', ym))) for (const [ip, v] of Object.entries(r.ip || {})) if (/쿠지/.test(ip)) { hit = true; q += v[0] || 0; s += v[1] || 0; }
  return hit ? { s, q } : null;
}
function topProducts(ym) {
  const P = {};
  for (const r of Object.values(storeDays('suwon', ym))) for (const [nm, v] of Object.entries(r.pr || {})) { const x = P[nm] ||= { q: 0, s: 0, ip: v[2] || '' }; x.q += v[0] || 0; x.s += v[1] || 0; }
  return Object.entries(P).filter(([, x]) => x.q || x.s).sort((a, b) => b[1].s - a[1].s || b[1].q - a[1].q);
}
function closeStock(ym) {
  const st = 'suwon', end = monthEnd(ym);
  if (!S.products.length || !Object.keys(S.stock[st] || {}).length) return { missing: true, end };
  const map = stockAtMap(st, end);
  let kinds = 0, qty = 0, amt = 0, neg = 0, zero = 0, noPrice = 0; const negNames = [];
  for (const p of S.products) {
    if ((S.stock[st] || {})[p.id] == null) continue;
    const t = map.at(p.id); kinds++;
    if (t < 0) { neg++; negNames.push(p.name); }
    else if (t === 0) zero++;
    else { qty += t; const pr = priceOf(p); if (pr) amt += t * pr; else noPrice++; }
  }
  const sold = topProducts(ym); let unmatched = 0; const outs = [];
  for (const [nm, x] of sold) {
    if (!(x.q > 0)) continue;
    const p = S.products.find(q => norm(q.name) === norm(nm));
    if (!p || (S.stock[st] || {})[p.id] == null) { unmatched++; continue; }
    const t = map.at(p.id); if (t <= 0) outs.push({ n: p.name, q: x.q, t });
  }
  return { missing: false, end, kinds, qty, amt, neg, zero, noPrice, negNames: negNames.slice(0, 5), negMore: Math.max(0, negNames.length - 5), outs, unmatched, incomplete: !!(map.oldest && map.oldest > end), oldest: map.oldest || '' };
}
function closeSettle(ym) { return settleRows().filter(r => r.month === ym); }
function withCmp(u, ym) {
  const prev = unitMonth(u.b, ymPrev(ym)), yoyM = ymAdd(ym, -12), yoy = unitMonth(u.b, yoyM);
  u.prev = prev.sales; u.prevDays = prev.days; u.yoy = yoy.sales; u.yoyDays = yoy.days; u.yoyM = yoyM;
  u.ch = u.sales != null && u.prev != null ? pct(u.sales, u.prev) : null;
  u.yoyCh = u.sales != null && u.yoy != null ? pct(u.sales, u.yoy) : null;
  u.profitBase = profitOf(u.sales, u.cost);
  u.popups = popupsIn(ym, u.b.id);
  u.popup = u.popups.reduce((t, p) => t + (+p.confirmed || 0), 0);
  u.profit = u.profitBase == null ? null : u.profitBase - (u.popup || 0);
  return u;
}
function closePack(ym) {
  const sp = monthDays(ym), units = BIZ.map(b => withCmp(unitMonth(b, ym), ym));
  const off = units.find(u => u.b.id === 'offline');
  const weeks = [];
  if (off) {
    for (const d of sp) {
      const k = periodKey(d, 'week'); let g = weeks[weeks.length - 1];
      if (!g || g.k !== k) { g = { k, a: d, b: d, s: 0, n: 0, miss: 0 }; weeks.push(g); }
      g.b = d; if (off.dayMap[d] == null) g.miss++; else { g.s += off.dayMap[d]; g.n++; }
    }
  }
  const popups = (S.popups || []).filter(p => p.month === ym);
  return { ym, y: +ym.slice(0, 4), m: +ym.slice(5), a: ym + '-01', b: monthEnd(ym), dim: sp.length, days: sp, units, off, weeks, products: topProducts(ym), stock: closeStock(ym), settle: closeSettle(ym), kuji: kujiPos(ym), popups };
}
function closeWords(R) {
  const good = [], bad = [], next = [], warn = [];
  const named = R.units.filter(u => u.sales != null), miss = R.units.filter(u => u.sales == null);
  const tot = named.reduce((t, u) => t + u.sales, 0);
  if (named.length) {
    const best = [...named].sort((a, b) => b.sales - a.sales)[0];
    if (tot) good.push(`<b>${esc(best.b.name)}</b>${josa(best.b.name, '이', '가')} 자료가 있는 매출의 ${Math.round(best.sales / tot * 100)}%입니다 (${fmt(best.sales)}원).`);
  }
  for (const u of named) {
    if (u.prev != null && u.sales > u.prev) good.push(`<b>${esc(u.b.name)}</b> 매출이 지난달 ${fmt(u.prev)}원보다 ${fmt(u.sales - u.prev)}원 많습니다.`);
    if (u.ch != null && u.ch <= -10) bad.push(`<b>${esc(u.b.name)}</b> 매출이 지난달보다 ${Math.abs(Math.round(u.ch))}% 적습니다 (${fmt(u.prev)}원 → ${fmt(u.sales)}원).`);
    if (u.profit != null && u.profit >= 0) good.push(`<b>${esc(u.b.name)}</b> 이익 ${fmt(u.profit)}원 (원가율 ${u.cost.cr}% · 인건비 ${fmt(u.cost.labor)}원 · 임대료 ${fmt(u.cost.rent)}원).`);
    if (u.profit != null && u.profit < 0) bad.push(`<b>${esc(u.b.name)}</b> 이익이 ${fmt(u.profit)}원으로 적자입니다.`);
    if (u.cost.goal != null && u.sales != null && u.sales >= u.cost.goal) good.push(`<b>${esc(u.b.name)}</b>${josa(u.b.name, '이', '가')} 월 목표 ${fmt(u.cost.goal)}원을 넘겼습니다.`);
    if (u.cost.cr == null) { bad.push(`<b>${esc(u.b.name)}</b> 원가율이 없어 이익을 비워 두었습니다.`); next.push(`${esc(u.b.name)} 원가율을 사업부 화면에 입력하세요.`); }
    else if (u.cost.labor == null || u.cost.rent == null) { bad.push(`<b>${esc(u.b.name)}</b> 인건비 또는 임대료가 비어 있어 이익을 비워 두었습니다.`); next.push(`${esc(u.b.name)} 인건비와 임대료를 입력하세요. 비어 있는 값을 0원으로 채우지 않았습니다.`); }
    if (u.cost.goal == null && u.sales != null) next.push(`${esc(u.b.name)} 월 매출 목표가 없습니다.`);
  }
  const hint = { kuji: '쿠지 매출을 올리는 칸은 아직 없습니다. 토스포스에 쿠지 IP가 있으면 참고로만 보여 줍니다.', blog: '블로그 월 대행료를 사업부 화면에 입력하세요.', onkihote: '온키호테 스마트스토어 주문 엑셀을 사업부 화면에 올리세요.', offline: '수원 토스포스 매출 파일을 올리세요.' };
  for (const u of miss) { bad.push(`<b>${esc(u.b.name)}</b> ${R.y}년 ${R.m}월 자료가 없습니다.`); next.push(hint[u.b.id] || `${esc(u.b.name)} 자료를 올리세요.`); }
  if (R.kuji) warn.push(`토스포스 IP 쿠지 ${fmt(R.kuji.s)}원(${fmt(R.kuji.q)}개)은 오프라인 합계에 이미 들어 있습니다. 쿠지사업 칸과 다시 더하지 않았습니다.`);
  if (R.off && R.off.days < R.dim) warn.push(`오프라인 매출 자료는 ${R.dim}일 중 ${R.off.days}일입니다. 빈 날은 0원이 아니라 자료 없음입니다.`);
  if (R.stock.missing) warn.push('월말 재고를 계산할 수원 상품·재고 자료가 없습니다.');
  else {
    if (R.stock.neg) warn.push(`월말 재고 마이너스 ${fmt(R.stock.neg)}종${R.stock.negNames.length ? `: ${R.stock.negNames.map(esc).join(', ')}` : ''}${R.stock.negMore ? ` 외 ${fmt(R.stock.negMore)}종` : ''}.`);
    if (R.stock.outs.length) { bad.push(`이번 달 팔리고 월말 재고가 0개 이하인 상품이 ${fmt(R.stock.outs.length)}종입니다.`); next.push(`품절 입고를 확인하세요: ${R.stock.outs.slice(0, 3).map(x => esc(x.n)).join(', ')}.`); }
    if (R.stock.incomplete) warn.push(`입출고 기록이 ${md(R.stock.oldest)}부터라 ${md(R.stock.end)} 재고가 정확하지 않을 수 있습니다.`);
    if (R.stock.unmatched) warn.push(`판매 이름 ${fmt(R.stock.unmatched)}종은 상품 목록과 맞지 않아 월말 재고를 보지 못했습니다.`);
  }
  if (!R.settle.length) warn.push('이 달 정산 행이 없습니다. 정산 금액은 비워 두었습니다.');
  if (!good.length) good.push('자료로 확인할 좋은 점이 없습니다.');
  if (!bad.length) bad.push('자료로 확인할 문제점이 없습니다.');
  if (!next.length) next.push('비어 있는 입력칸을 채우면 다음 달 보고서가 더 완전해집니다.');
  if (!warn.length) warn.push('추가로 경고할 항목이 없습니다.');
  const missN = miss.map(u => esc(u.b.name));
  let sum = named.length ? `${R.y}년 ${R.m}월 자료가 있는 사업부 매출 합계는 <b>${fmt(tot)}원</b>입니다. ${named.map(u => `${esc(u.b.name)} ${fmt(u.sales)}원`).join(', ')}.` : `${R.y}년 ${R.m}월 마감 보고서를 만들 매출 자료가 없습니다.`;
  if (missN.length) sum += ` 자료가 없어 합계에 넣지 않은 사업부: ${missN.join(', ')}.`;
  const off = R.off;
  if (off && off.sales != null && off.prev != null && off.ch != null) sum += ` 오프라인 매장은 지난달 ${fmt(off.prev)}원 대비 ${off.ch >= 0 ? '+' : ''}${off.ch.toFixed(1)}%입니다.`;
  else if (off && off.sales != null) sum += ' 오프라인 지난달 비교 자료가 없습니다.';
  if (off && off.sales != null && off.yoy != null && off.yoyCh != null) sum += ` 작년 ${R.m}월 오프라인은 ${fmt(off.yoy)}원 (${off.yoyCh >= 0 ? '+' : ''}${off.yoyCh.toFixed(1)}%)입니다.`;
  else if (off && off.sales != null) sum += ' 작년 같은 달 오프라인 자료가 없습니다.';
  const prof = named.filter(u => u.profit != null);
  sum += prof.length ? ` 이익을 계산한 사업부는 ${prof.length}곳, 합계 ${fmt(prof.reduce((t, u) => t + u.profit, 0))}원입니다. 원가율·인건비·임대료가 모두 있는 곳만 계산했습니다.` : ' 원가율·인건비·임대료가 모두 있는 사업부가 없어 이익 합계는 비워 두었습니다.';
  return { good, bad, next, warn, sum };
}
const CSHORT = { offline: '오프라인', onkihote: '온키호테', kuji: '쿠지', blog: '블로그' };
const clipLab = (s, n = 14) => { s = String(s || ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
function closeSvg(title, w, h, inner, cls) {
  return `<figure class="cfig${cls ? ' ' + cls : ''}"><figcaption>${esc(title)}</figcaption><svg viewBox="0 0 ${w} ${h}" width="100%" role="img" aria-label="${esc(title)}">${inner}</svg></figure>`;
}
function chartEmpty(title) { return `<figure class="cfig"><figcaption>${esc(title)}</figcaption><div class="cnone">자료 없음</div></figure>`; }
function estW(s, fs) {
  let w = 0;
  for (const ch of String(s)) w += ch.charCodeAt(0) > 255 ? fs * 1.08 : fs * 0.72;
  return w + 4;
}
function barText(r) {
  if (r.v == null) return r.miss || '자료 없음';
  if (r.text) return r.text;
  const unit = r.unit == null ? '원' : r.unit;
  let s = (r.v < 0 ? '-' : '') + fmt(Math.abs(r.v)) + unit;
  if (r.qty != null) s += ' · ' + fmt(r.qty) + '개';
  if (r.pct != null) s += ' · ' + r.pct + '%';
  return s;
}
function drawBars(title, lines) {
  const bars = lines.filter(l => l.kind !== 'head');
  const known = bars.filter(l => l.v != null && !isNaN(l.v));
  if (!known.length) return chartEmpty(title);
  const maxAbs = Math.max(...known.map(r => Math.abs(r.v)), 1);
  const hasNeg = known.some(r => r.v < 0), hasPos = known.some(r => r.v > 0);
  const mode = hasNeg && hasPos ? 'both' : hasNeg ? 'neg' : 'pos';
  const html = lines.map(r => {
    if (r.kind === 'head') return `<div class="bhead">${esc(r.name)}</div>`;
    const label = barText(r);
    if (r.v == null) return `<div class="brow"><span class="bn">${esc(r.name || '')}</span><span class="bmiss">${esc(label)}</span></div>`;
    const fill = r.v < 0 ? '#9B3A3A' : (r.color || '#19776A');
    const p = Math.max(0.04, Math.abs(r.v) / maxAbs);
    const barW = `calc(${p.toFixed(4)} * (100% - 13.5em))`;
    if (mode === 'both') {
      const neg = r.v < 0;
      return `<div class="brow"><span class="bn">${esc(r.name || '')}</span><span class="bscale both"><span class="bl">${neg ? `<i style="width:${(p * 100).toFixed(1)}%;background:${fill}"></i>` : ''}</span><span class="br">${neg ? '' : `<i style="width:${(p * 100).toFixed(1)}%;background:${fill}"></i>`}</span></span><span class="bv">${esc(label)}</span></div>`;
    }
    return `<div class="brow ${mode}"><span class="bn">${esc(r.name || '')}</span><span class="bmain ${mode}"><i style="width:${barW};background:${fill}"></i><em class="bv">${esc(label)}</em></span></div>`;
  }).join('');
  return `<figure class="cfig bars"><figcaption>${esc(title)}</figcaption><div class="brows ${mode}">${html}</div></figure>`;
}
function closeHBars(title, rows, kind) { return drawBars(title, rows, kind); }
function closeVBars(title, items) {
  const known = items.filter(r => r.v != null);
  if (!known.length) return chartEmpty(title);
  const mx = Math.max(...known.map(r => Math.abs(r.v)), 1);
  const W = 460, L = 8, Rt = 8, B = 30, n = items.length;
  const slot = (W - L - Rt) / n, bw = Math.max(4, Math.min(16, slot - 4));
  const marks = [];
  let lastRight = -99, needRot = 0;
  items.forEach((r, i) => {
    if (r.v == null) { marks.push(null); return; }
    const lab = (r.v < 0 ? '-' : '') + fmt(Math.abs(r.v)) + (r.unit == null ? '원' : r.unit);
    const lw = estW(lab, 16), cx = L + i * slot + slot / 2;
    const rot = cx - lw / 2 < lastRight + 3;
    if (rot) needRot = Math.max(needRot, lw + 8);
    else lastRight = cx + lw / 2;
    marks.push({ lab, lw, cx, rot, v: r.v, name: r.name });
  });
  const T = Math.max(32, needRot);
  const plotH = 96, H = T + plotH + B, base = T + plotH;
  const Y = v => base - Math.abs(v) / mx * plotH;
  let g = `<line class="grid" x1="${L}" x2="${W - Rt}" y1="${base}" y2="${base}"/>`;
  items.forEach((r, i) => {
    const x = L + i * slot + (slot - bw) / 2;
    const day = r.short != null ? r.short : clipLab(r.name, 3);
    const m = marks[i];
    if (!m) g += `<line class="grid" x1="${(x + bw / 2).toFixed(1)}" x2="${(x + bw / 2).toFixed(1)}" y1="${base - 3}" y2="${base}"><title>${esc(r.name)} 자료 없음</title></line>`;
    else {
      const y = Y(m.v), h = Math.max(2, base - y);
      const fill = m.v < 0 ? '#9B3A3A' : '#19776A';
      g += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${fill}"><title>${esc(m.name)} ${esc(m.lab)}</title></rect>`;
      if (m.rot) g += `<text class="lab" font-size="16" font-weight="800" text-anchor="start" transform="rotate(-90 ${m.cx.toFixed(1)} ${(y - 8).toFixed(1)})" x="${m.cx.toFixed(1)}" y="${(y - 8).toFixed(1)}">${esc(m.lab)}</text>`;
      else g += `<text class="lab" font-size="16" font-weight="800" text-anchor="middle" x="${m.cx.toFixed(1)}" y="${(y - 12).toFixed(1)}">${esc(m.lab)}</text>`;
    }
    const step = Math.max(1, Math.ceil(n / 10));
    if (i % step === 0 || i === n - 1) g += `<text class="lab" font-size="15" x="${(x + bw / 2).toFixed(1)}" y="${H - 8}" text-anchor="middle">${esc(String(day))}</text>`;
  });
  return closeSvg(title, W, H, g, 'day');
}
function closeDonut(R) {
  const parts = R.units.filter(u => u.sales != null && u.sales > 0);
  const rest = R.units.filter(u => u.sales == null || u.sales <= 0);
  if (!parts.length) return chartEmpty('사업부 매출 비중');
  const tot = parts.reduce((t, u) => t + u.sales, 0);
  const colors = ['#19776A', '#0D4A42', '#2F6FDB', '#C4A35A'];
  const VBW = 320, VBH = 348, cx = 160, cy = 124, rad = 78, sw = 80, fs = 15, lh = 17, C = 2 * Math.PI * rad;
  const at = (deg, r) => ({ x: cx + Math.sin(deg * Math.PI / 180) * r, y: cy - Math.cos(deg * Math.PI / 180) * r });
  const block = (x, y, lines, on) => lines.map((ln, i) => `<text class="${on ? 'onslice' : 'lab'}" text-anchor="middle" font-weight="800" font-size="${fs}" fill="${on ? '#fff' : '#111'}" x="${x.toFixed(1)}" y="${(y + i * lh).toFixed(1)}">${esc(ln)}</text>`).join('');
  let off = 0, ang = 0, arcs = '';
  const labels = [];
  if (parts.length === 1) arcs = `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${colors[0]}" stroke-width="${sw}"/>`;
  parts.forEach((u, i) => {
    const frac = u.sales / tot;
    const len = parts.length === 1 ? C : (i === parts.length - 1 ? C - off : frac * C);
    const name = CSHORT[u.b.id] || u.b.name;
    const pct = Math.round(frac * 100);
    const lines = [name, fmt(u.sales) + '원', pct + '%'];
    if (parts.length > 1) arcs += `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="none" stroke="${colors[i % colors.length]}" stroke-width="${sw}" stroke-dasharray="${len.toFixed(2)} ${(C - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}" transform="rotate(-90 ${cx} ${cy})"><title>${esc(lines.join(' '))}</title></circle>`;
    const sweep = frac * 360, mid = ang + sweep / 2;
    ang += sweep; off += len;
    const wide = frac * 2 * Math.PI * rad > Math.max(...lines.map(s => estW(s, fs))) * 1.2 && sw >= lh * 3 + 4;
    labels.push({ mid, lines, wide });
  });
  arcs += `<circle class="hole" cx="${cx}" cy="${cy}" r="${(rad - sw / 2 - 1).toFixed(1)}" fill="var(--surface)"/>`;
  arcs += `<text class="lab" x="${cx}" y="${cy - 1}" text-anchor="middle" font-size="14">합계</text><text class="lab" x="${cx}" y="${cy + 16}" text-anchor="middle" font-size="15" font-weight="800">${esc(fmt(tot))}원</text>`;
  labels.forEach(L => {
    if (L.wide) {
      const p = at(L.mid, rad);
      arcs += block(p.x, p.y - lh, L.lines, true);
    } else {
      const outerR = rad + sw / 2;
      const a = at(L.mid, outerR);
      const down = Math.cos(L.mid * Math.PI / 180) < 0.15;
      const half = Math.max(...L.lines.map(s => estW(s, fs))) / 2 + 2;
      const x = Math.max(half, Math.min(VBW - half, a.x));
      const gap = 40;
      const y = down ? a.y + gap + fs * 0.95 : a.y - gap - lh * (L.lines.length - 1) - 4;
      const tip = down ? { x, y: y - fs * 1.2 } : { x, y: y + lh * (L.lines.length - 1) + 6 };
      arcs += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${tip.x.toFixed(1)}" y2="${tip.y.toFixed(1)}" stroke="#333" stroke-width="1.4"/>`;
      arcs += block(x, y, L.lines, false);
    }
  });
  const leg = parts.map((u, i) => `<li><i style="background:${colors[i % colors.length]}"></i><span>${esc(CSHORT[u.b.id] || u.b.name)} ${fmt(u.sales)}원 · ${Math.round(u.sales / tot * 100)}%</span></li>`).join('')
    + rest.map(u => `<li class="gap"><i></i><span>${esc(CSHORT[u.b.id] || u.b.name)} · ${u.sales === 0 ? '0원' : '자료 없음'}</span></li>`).join('');
  return `<figure class="cfig donut"><figcaption>사업부 매출 비중</figcaption><div class="donut-row"><svg viewBox="0 0 ${VBW} ${VBH}" width="100%" role="img" aria-label="사업부 매출 비중">${arcs}</svg><ul class="cleg">${leg}</ul></div></figure>`;
}
function closeDailyChart(R) {
  const map = R.off && R.off.dayMap;
  if (!map || !Object.keys(map).length) return chartEmpty('오프라인 일별 매출');
  const items = R.days.map(d => ({ name: md(d), short: String(+d.slice(8)), v: map[d] == null ? null : map[d], unit: '원' }));
  return closeVBars('오프라인 일별 매출 · 빈 날은 막대 없음', items, { axis: (i, n) => i % Math.max(1, Math.ceil(n / 8)) === 0 || i === n - 1 });
}
function closeWeekChart(R) {
  if (!R.weeks.length || !R.weeks.some(g => g.n)) return chartEmpty('주별 매출');
  return closeHBars('주별 합계 · 자료 없는 주는 막대 없음', R.weeks.map(g => ({ name: `${+g.a.slice(8)}~${+g.b.slice(8)}일`, v: g.n ? g.s : null })), 'side');
}
function closeCmpChart(R) {
  const rows = R.units;
  if (!rows.some(u => u.sales != null || u.prev != null || u.yoy != null)) return chartEmpty('지난달·작년 비교');
  const colors = ['#19776A', '#7DCEC0', '#2F6FDB'];
  const lines = [];
  rows.forEach(u => {
    lines.push({ kind: 'head', name: CSHORT[u.b.id] || u.b.name });
    [['이번달', u.sales, colors[0]], ['지난달', u.prev, colors[1]], ['작년', u.yoy, colors[2]]].forEach(([name, v, color]) => {
      lines.push({ name, v, color, miss: name + ' 자료 없음' });
    });
  });
  return drawBars('사업부별 이번달 · 지난달 · 작년', lines);
}
function closeGoalChart(R) {
  const rows = R.units;
  if (!rows.some(u => u.cost.goal != null)) return chartEmpty('이번달 매출과 목표');
  const lines = [];
  rows.forEach(u => {
    const rate = u.sales != null && u.cost.goal ? Math.round(u.sales / u.cost.goal * 100) : null;
    lines.push({ kind: 'head', name: CSHORT[u.b.id] || u.b.name });
    lines.push({ name: '이번달', v: u.sales, color: '#19776A', pct: rate, miss: '이번달 자료 없음' });
    lines.push({ name: '목표', v: u.cost.goal, color: '#C4A35A', miss: '목표 없음' });
  });
  return drawBars('이번달 매출과 목표', lines);
}
function closeProdChart(R) {
  const rows = R.products.slice(0, 8).map(([n, x]) => ({ name: n.replace(/^에바30주년팝업_/, ''), v: x.s, qty: x.q }));
  return rows.length ? closeHBars('상품 매출 상위', rows, 'half') : chartEmpty('많이 팔린 상품');
}
function closeStockChart(R) {
  const st = R.stock;
  if (st.missing) return chartEmpty('월말 재고');
  const have = Math.max(0, st.kinds - st.zero - st.neg);
  const counts = closeHBars('월말 재고 상태 (종)', [{ name: '재고 있음', v: have, unit: '종', color: '#19776A' }, { name: '품절', v: st.zero, unit: '종', color: '#C4A35A' }, { name: '마이너스', v: st.neg, unit: '종', color: '#9B3A3A' }], 'half');
  const outs = st.outs.length ? closeHBars('팔린 뒤 재고 0 이하 · 판매 수량', st.outs.slice(0, 5).map(x => ({ name: x.n, v: x.q, unit: '개', color: '#9B3A3A' })), 'half') : chartEmpty('팔린 뒤 재고 0 이하');
  return counts + outs;
}
function closeProfitChart(R) {
  return closeHBars('사업부 이익', R.units.map(u => ({ name: CSHORT[u.b.id] || u.b.name, v: u.profit })));
}
function closePopupChart(R) {
  const rows = [];
  for (const p of R.popups || []) {
    for (const ln of p.lines || []) if (ln.amount) rows.push({ name: ln.name, v: ln.amount, qty: ln.qty });
    if (p.overhead) rows.push({ name: '공과잡비·기업이윤', v: +p.overhead });
    if (p.freight) rows.push({ name: '운송', v: +p.freight });
    if (p.confirmed) rows.push({ name: (p.ip || '팝업') + ' 확정', v: +p.confirmed, color: '#0D4A42' });
  }
  return rows.length ? closeHBars('팝업 시공비', rows) : chartEmpty('팝업 시공비');
}
function closeSettleChart(R) {
  const rows = R.settle.filter(r => r.net !== '' && r.net != null).map(r => ({ name: r.ip, v: +r.net }));
  return rows.length ? closeHBars('정산 순수익', rows) : chartEmpty('정산');
}
const BLAB = { offline: '수원 SMG STORE', onkihote: '온키호테', kuji: '쿠지', blog: '블로그' };
function closeMachChart(R) {
  const mon = ((S.sales.suwon || {})[R.ym] || {}).mach;
  if (!mon) return '';
  const rows = Object.values(mon).map(m => {
    let s = 0, q = 0, n = 0;
    for (const v of Object.values(m.days || {})) if (v && ((v[0] || 0) || (v[1] || 0))) { s += v[0] || 0; q += v[1] || 0; n++; }
    return n ? { name: m.name || '기계', v: s, qty: q, color: '#2F6FDB' } : null;
  }).filter(Boolean);
  return rows.length ? closeHBars('자판기·기계 · 오프라인 합계에 포함', rows) : '';
}
function closeShareBars(R) {
  const tot = R.units.reduce((t, u) => t + (u.sales > 0 ? u.sales : 0), 0);
  return closeHBars('사업부 매출', R.units.map(u => ({ name: BLAB[u.b.id] || u.b.name, v: u.sales, pct: u.sales != null && tot ? Math.round(u.sales / tot * 100) : null }))) + closeMachChart(R);
}
function mcloseView() {
  if (!canSettle()) return `${head('월말 마감 보고서', '대표만 볼 수 있습니다')}<div class="card"><div class="empty">정산과 같은 권한(대표)만 이 보고서를 엽니다.</div></div>`;
  const ym = closeYm(), cap = today().slice(0, 7), R = closePack(ym), W = closeWords(R);
  const miss = t => `<span class="blank">자료 없음${t ? ' · ' + esc(t) : ''}</span>`;
  const need = t => `<span class="blank">미입력${t ? ' · ' + esc(t) : ''}</span>`;
  const wonB = v => v == null ? miss() : `<span class="amt">${fmt(v)}원</span>`;
  const kv = (rows, cap) => `<table class="kv"><thead><tr><th colspan="2">${cap || '항목'}</th></tr></thead><tbody>${rows.map(([k, v]) => `<tr><th>${k}</th><td>${v}</td></tr>`).join('')}</tbody></table>`;
  const ul = L => `<ul>${L.map(x => `<li>${x}</li>`).join('')}</ul>`;
  const on = id => (id === 'this' ? ym === cap : ym === ymPrev(cap)) ? ' on' : '';
  const goalTxt = u => u.cost.goal == null ? need('월 매출 목표') : (u.sales == null ? miss() : `<span class="amt">${fmt(u.sales)}원</span> / 목표 <span class="amt">${fmt(u.cost.goal)}원</span>${u.sales >= u.cost.goal ? ' · 달성' : ` · <span class="amt">${fmt(u.cost.goal - u.sales)}원</span> 부족`}`);
  const salesRows = R.units.map(u => [esc(u.b.name), u.sales == null ? miss(u.b.id === 'blog' ? '월 대행료 없음' : '') : `<span class="amt">${fmt(u.sales)}원</span>${u.memo ? ` <span class="muted">${esc(u.memo)}</span>` : ''}${u.pos != null || u.mach != null ? `<div class="muted">${u.pos != null ? `토스포스 ${fmt(u.pos)}원` : '토스포스 자료 없음'}${u.mach != null ? ` + 자판기·기계 ${fmt(u.mach)}원` : ''}</div>` : ''}`]);
  const tot = R.units.reduce((t, u) => t + (u.sales || 0), 0), totN = R.units.filter(u => u.sales != null).length;
  salesRows.push(['자료가 있는 합계', totN ? `<span class="amt">${fmt(tot)}원</span> <span class="muted">${totN}개 사업부</span>` : miss()]);
  const costRows = [];
  for (const u of R.units) {
    costRows.push([esc(u.b.name) + ' 원가율', u.cost.cr == null ? need() : `${u.cost.cr}%`]);
    costRows.push([esc(u.b.name) + ' 인건비', u.cost.labor == null ? need() : `<span class="amt">${fmt(u.cost.labor)}원</span>`]);
    costRows.push([esc(u.b.name) + ' 임대료', u.cost.rent == null ? need() : `<span class="amt">${fmt(u.cost.rent)}원</span>`]);
    costRows.push([esc(u.b.name) + ' 이익', u.profit == null ? need('원가율·인건비·임대료가 모두 있을 때만') : `<span class="amt">${fmt(u.profit)}원</span>${u.popup ? ` <span class="muted">팝업 시공 ${fmt(u.popup)}원 뺀 뒤${u.profitBase != null ? ' · 빼기 전 ' + fmt(u.profitBase) + '원' : ''}</span>` : ''}`]);
    costRows.push([esc(u.b.name) + ' 목표', goalTxt(u)]);
  }
  const prof = R.units.filter(u => u.profit != null);
  costRows.push(['이익 합계', prof.length ? `<span class="amt">${fmt(prof.reduce((t, u) => t + u.profit, 0))}원</span> <span class="muted">${prof.length}개 사업부</span>` : need('계산할 사업부 없음')]);
  const cmp = R.units.map(u => `<h3 class="accent">${esc(u.b.name)}</h3>${kv([[`${R.m}월`, u.sales == null ? miss() : `<span class="amt">${fmt(u.sales)}원</span> <span class="muted">${u.b.monthly ? '월 입력' : `자료 ${u.days}일 / ${R.dim}일`}</span>`], ['지난달', u.prev == null ? miss() : `<span class="amt">${fmt(u.prev)}원</span> <span class="muted">자료 ${u.prevDays}일</span>`], ['지난달 대비', u.ch == null ? miss(u.sales != null && u.prev === 0 ? '기준이 0원이라 증감률 없음' : '') : chg(u.ch)], [`작년 ${R.m}월`, u.yoy == null ? miss() : `<span class="amt">${fmt(u.yoy)}원</span> <span class="muted">자료 ${u.yoyDays}일</span>`], ['작년 대비', u.yoyCh == null ? miss() : chg(u.yoyCh)]], esc(u.b.name))}`).join('');
  const dayRows = R.off ? R.days.map(d => [md(d), R.off.dayMap[d] == null ? miss() : `<span class="amt">${fmt(R.off.dayMap[d])}원</span>`]) : [[ '오프라인', miss() ]];
  const weekRows = R.weeks.length ? R.weeks.map(g => [`${mdc(g.a)}~${mdc(g.b)}`, g.n ? `<span class="amt">${fmt(g.s)}원</span>` : miss()]) : [['주별', miss()]];
  const prodRows = R.products.length ? R.products.slice(0, 8).map(([n, x], i) => [`${i + 1}. ${esc(n.replace(/^에바30주년팝업_/, ''))}`, `<span class="amt">${fmt(x.s)}원</span> <span class="muted">${fmt(x.q)}개${x.ip ? ' · ' + esc(x.ip) : ''}</span>`]) : [['상품', miss('토스포스 상품 매출 없음')]];
  const st = R.stock;
  const stockRows = st.missing ? [['월말 재고', miss('수원 상품·재고 없음')], ['금액', miss()], ['마이너스', miss()], ['품절', miss()]] : [
    ['기준 날짜', md(st.end)], ['재고 있는 수량', `${fmt(st.qty)}개 <span class="muted">등록 ${fmt(st.kinds)}종</span>`],
    ['재고 금액', `<span class="amt">${fmt(st.amt)}원</span> <span class="muted">판매가 × 0개 초과${st.noPrice ? ` · 판매가 없는 ${fmt(st.noPrice)}종은 금액에서 뺌` : ''}</span>`],
    ['품절', `${fmt(st.zero)}종`], ['마이너스', st.neg ? `${fmt(st.neg)}종` : '0종'],
    ['이번 달 판매 후 월말 재고 0 이하', st.outs.length ? st.outs.slice(0, 5).map(x => `${esc(x.n)} ${fmt(x.q)}개 판매 · 재고 ${fmt(x.t)}`).join('<br>') : '없음'],
  ];
  const setRows = R.settle.length ? R.settle.map(r => [esc(r.ip), `${r.net === '' || r.net == null ? miss('요율 없음') : `<span class="amt">${fmt(r.net)}원</span>`} <span class="muted">${esc(r.status || '')}${r.sales ? ' · 판매 ' + fmt(r.sales) + '원' : ''}</span>`]) : [['정산', miss('이 달 정산 행 없음')]];
  if (R.settle.length) {
    const net = R.settle.reduce((t, r) => t + (+r.net || 0), 0), sales = R.settle.filter(r => r.kind !== 'deduct').reduce((t, r) => t + (+r.sales || 0), 0);
    setRows.push(['판매 금액 합계', `<span class="amt">${fmt(sales)}원</span>`]); setRows.push(['순수익 합계', `<span class="amt">${fmt(net)}원</span>`]);
  }
  const controls = `<button class="chip${on('this')}" data-cym="this">이번달</button><button class="chip${on('prev')}" data-cym="prev">지난달</button><button class="btn" data-cstep="-1">이전 달</button><button class="btn" data-cstep="1" ${ym >= cap ? 'disabled' : ''}>다음 달</button><button class="btn pri" id="closePrint">인쇄 / PDF 저장</button>`;
  return `${head('월말 마감 보고서', '끝난 달이 기본 · 대표만 · 없는 숫자는 비워 둡니다', controls)}
  <article class="mrep">
    <header class="crep-hd"><div class="brand">온인터내셔널</div><h1>${R.y}년 ${R.m}월 월말 마감 보고서</h1><p>${fd(R.a)} ~ ${fd(R.b)} · ${R.dim}일 · 출력 ${esc(kst(new Date().toISOString()))}${S.user ? ' · ' + esc(whoText(S.user.name, userCo(S.user))) : ''}</p></header>
    ${S.ui.closeSample ? '<p class="sample">시험 자료입니다. 실제 매출·재고·정산 숫자가 아닙니다. 빈칸은 일부러 비워 둔 항목입니다.</p>' : ''}
    ${(() => { const box = (title, inner, chart, cls) => `<section class="split ${cls}"><h2>${title}</h2><div class="pane"><div class="txt">${inner}</div><aside class="cht">${chart}</aside></div></section>`; return [
      box('요약', `<p class="sum">${W.sum}</p><div class="cols"><div><h3>잘한 점</h3>${ul(W.good)}</div><div><h3>문제점</h3>${ul(W.bad)}</div><div><h3>다음 행동 추천</h3>${ul(W.next)}</div><div><h3>경고</h3>${ul(W.warn)}</div></div>`, closeDonut(R), 'pack'),
      box('사업부 매출', `${kv(salesRows, '사업부 매출')}${R.kuji ? `<p class="src">참고 · 토스포스 쿠지 IP ${fmt(R.kuji.s)}원 (${fmt(R.kuji.q)}개). 오프라인 합계에 포함되어 있어 위에 다시 더하지 않습니다.</p>` : `<p class="src">토스포스 상품 IP 이름에 “쿠지”가 없습니다. 쿠지사업 별도 자료도 없습니다.</p>`}`, closeShareBars(R), 'pack'),
      box('원가 · 인건비 · 임대료 · 이익', `<p class="src">이익 = 매출 − 매출×원가율 − 인건비 − 임대료 − 그 달 팝업 시공 확정 금액(부가세 별도). 원가율·인건비·임대료 중 하나라도 비어 있으면 이익은 비웁니다. 월 시공비 차감은 정산 순수익에만 있고 여기서 다시 빼지 않습니다.</p>${kv(costRows, '원가 · 인건비 · 임대료 · 이익')}${R.units.some(u => u.popup && S.settleRules && S.settleRules.construction != null) ? `<p class="src">이 달에는 정산 요율의 월 시공비 ${fmt(S.settleRules.construction)}원과 팝업 시공비가 둘 다 있습니다. 이익에서는 팝업 확정 금액만 뺍니다.</p>` : ''}`, closeProfitChart(R) + closeGoalChart(R), 'pack'),
      box('팝업 비용', R.popups.length ? R.popups.map(p => `<p class="src">${esc(p.ip)} · ${esc(p.place || '')} · ${esc(p.vendor || '')} · 견적 ${esc(p.quoteDate || '')} · 반영 ${esc(p.month)}. 확정 ${fmt(p.confirmed)}원, 부가세 ${fmt(p.vat)}원, 포함 ${fmt(p.gross)}원. 합계 ${fmt(p.sum)}원과의 차액 ${fmt(p.gap)}원${p.gapNote ? ' · ' + esc(p.gapNote) : ''}.</p>`).join('') + kv(R.popups.flatMap(p => (p.lines || []).map(l => [esc(l.name), `<span class="amt">${fmt(l.amount)}원</span> <span class="muted">${fmt(l.qty)}개${l.note ? ' · ' + esc(l.note) : ''}</span>`])).concat([['확정 공급가', `<span class="amt">${fmt(R.popups.reduce((t, p) => t + (+p.confirmed || 0), 0))}원</span>`]]), '팝업 비용') : `<p class="src">이 달 반영으로 저장된 팝업 시공비가 없습니다.</p>${kv([['팝업 시공', miss()]], '팝업 비용')}`, closePopupChart(R), 'pack'),
      box('지난달 · 작년 같은 달', cmp, closeCmpChart(R), 'pack'),
      `<section class="split multi"><h2>일별 · 주별 추이</h2>
        <div class="pane"><div class="txt"><h3 class="accent">오프라인 토스포스 · 일별</h3>${R.off && R.off.mach != null ? `<p class="src">자판기·기계 ${fmt(R.off.mach)}원은 일별 표에 넣지 않았습니다.</p>` : ''}${kv(dayRows, '오프라인 일별')}</div><aside class="cht">${closeDailyChart(R)}</aside></div>
        <div class="pane beside"><div class="txt"><h3 class="accent">주별 (월~일, 그 달 안)</h3>${kv(weekRows, '주별')}</div><aside class="cht">${closeWeekChart(R)}</aside></div>
      </section>`,
      '<div class="pair">',
      box('월말 재고', `<p class="src">수원 매장. 지금 재고에서 ${md(R.b)} 다음 날의 입출고를 되돌린 값입니다.</p>${kv(stockRows, '월말 재고')}`, closeStockChart(R), 'pair-item'),
      box('많이 팔린 상품', `<p class="src">수원 토스포스 상품 매출 상위 8개입니다.</p>${kv(prodRows, '많이 팔린 상품')}`, closeProdChart(R), 'pair-item'),
      '</div>',
      box('정산', `${kv(setRows, '정산')}<p class="src">온키호테·쿠지·블로그 금액과 원가율·인건비·임대료는 이 기기에 입력된 값입니다.</p>`, closeSettleChart(R), 'pack'),
    ].join(''); })()}
  </article>`;
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
    return `<div class="card"><h2>${esc(u.name)} <span class="pill p-warn">🔸 승인 대기</span><span class="r">${esc(fdt(u.createdAt))} 신청</span></h2>
    <dl class="kv" style="margin-bottom:12px"><dt>이메일</dt><dd>${esc(u.email)}</dd><dt>소속</dt><dd>${esc(u.company)}${u.companyOther ? ` · ${esc(u.companyOther)}` : ''}</dd><dt>직급</dt><dd>${esc(u.position)}</dd><dt>근무 매장</dt><dd>${esc((u.places || []).join(', '))}</dd>${u.memo ? `<dt>메모</dt><dd>${esc(u.memo)}</dd>` : ''}</dl>
    <div style="display:flex;flex-direction:column;gap:12px">${permEditor(u, p, u.uid)}</div>
    <div class="row" style="justify-content:flex-end;margin-top:12px"><button class="btn" data-reject="${u.uid}">거절</button><button class="btn pri" data-approve="${u.uid}" ${p.stores.length ? '' : 'disabled'}>승인</button></div></div>`;
  }).join('');
}
function usersView() {
  const U = S.users.filter(u => u.status !== 'pending');
  const lab = { active: '<span class="pill p-ok">사용 중</span>', suspended: '<span class="pill p-warn">🔸 일시 정지</span>', resigned: '<span class="pill p-mute">퇴사</span>' };
  return `<div class="card" style="padding:8px 12px"><div class="tw"><table><thead><tr><th>이름</th><th>직급</th><th class="hide-s">소속</th><th>매장</th><th>권한</th><th>상태</th><th>구분</th><th class="ac">권한</th><th class="ac">정지</th><th class="ac">퇴사·복구</th></tr></thead><tbody>
  ${U.map(u => `<tr><td class="nowrap"><b>${esc(u.name)}</b><div class="code">${esc(u.email)}</div></td><td class="nowrap">${esc(u.position)}</td><td class="hide-s">${esc(u.company)}</td><td style="font-size:12px">${(u.perms && u.perms.stores.length === STORES.length) ? '전체' : esc((u.perms ? u.perms.stores : []).map(storeName).join(', '))}</td>
    <td style="font-size:12px">${u.limited ? '수량만' : PERM_DEF.filter(d => u.perms && u.perms[d.k]).map(d => d.t.replace(' 등록', '').replace('실재고 입력·수정', '실재고').replace('사용자 승인', '승인')).join(' · ') || '보기만'}${u.owner ? ' · 정산' : ''}</td><td>${lab[u.status]}</td>
    <td class="nowrap">${u.owner ? '대표' : '직원'}</td>${u.owner ? '<td class="ac"></td><td class="ac"></td><td class="ac"></td>' : u.status === 'active' ? `<td class="ac"><button class="btn sm" data-edit="${u.uid}">권한</button></td><td class="ac"><button class="btn sm" data-susp="${u.uid}">정지</button></td><td class="ac"><button class="btn sm" data-resign="${u.uid}">퇴사 처리</button></td>` : `<td class="ac"></td><td class="ac"></td><td class="ac"><button class="btn sm" data-restore="${u.uid}">복구</button></td>`}</tr>`).join('')}
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
  return `<div class="grid2"><div class="card"><h2>매장</h2><div class="tw"><table><thead><tr><th class="n">번호</th><th>매장 이름</th><th class="n">상품 종류</th></tr></thead><tbody>${STORES.map((s, i) => `<tr><td class="n muted" style="width:1%">${i + 1}</td><td><span class="dot" style="background:${storeColor(s.id)};display:inline-block;margin-right:6px"></span>${esc(s.name)}</td><td class="n">${fmt(Object.keys(S.stock[s.id] || {}).length)}종</td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:10px"><input class="inp" placeholder="새 매장 이름" style="flex:1" id="newStore"><button class="btn" id="addStore">매장 추가</button></div></div>
    <div class="card"><h2>신청 때 고르는 소속 회사</h2><div class="tw"><table><thead><tr><th class="n">번호</th><th>회사 이름</th><th>제한</th></tr></thead><tbody>${COMPANIES.map((c, i) => `<tr><td class="n muted" style="width:1%">${i + 1}</td><td>${esc(c)}</td><td>${c.startsWith('기타') ? '<span class="pill p-warn">수량 보기만</span>' : ''}</td></tr>`).join('')}</tbody></table></div>
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
  const nav = NAV.filter(n => n.show()); const ids = nav.map(n => n.id); const main = TAB_MAIN.filter(id => ids.includes(id)).slice(0, 4);
  const pendingN = can('approve') ? S.users.filter(u => u.status === 'pending').length : 0;
  const rest = nav.filter(n => !main.includes(n.id));
  return `${head('설정', `앱 업데이트 ${fd(APP_VERSION.slice(0, 10))} ${APP_VERSION.slice(11)}`)}
  <div class="card"><h2>설정</h2><div class="setrow"><span class="lb">글자 크기</span>${textSizeBox()}</div><div class="setrow"><span class="lb">화면 색</span>${themeBtn()}</div></div>`;
}

/* ───────── 로그인·신청 ───────── */
const GICON = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>`;
function loginView() {
  const f = S.ui.apply ||= { name: '', company: '', other: '', places: [], position: '', phone: '', memo: '' };
  const sent = S.ui.applied;
  return `<div style="padding:16px"><div class="login">
    <div class="brand"><img src="oninter_logo.png" alt="온인터내셔널 로고" width="72" height="72"><span class="wm big">온인터내셔널</span><b style="font-size:15px">매장·매출 관리</b><span style="font-size:13px;color:#E5F3F0">오프라인 매장 · 온키호테 · 쿠지사업 운영 · 블로그 운영</span></div>
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
  const ios = `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px"><li><b>사파리</b>로 이 주소를 엽니다 (크롬·카카오톡 안에서는 안 됩니다).</li><li>화면 아래 <b>공유 버튼(□↑)</b>을 누릅니다. 안 보이면 오른쪽 아래 <b>⋯</b>을 먼저 누르세요.</li><li>목록을 아래로 내려 <b>홈 화면에 추가</b> → 오른쪽 위 <b>추가</b></li><li>홈 화면에 생긴 <b>온인터</b> 아이콘으로 엽니다.</li></ol>`;
  const and = `<ol style="margin:0;padding-left:20px;display:flex;flex-direction:column;gap:6px"><li><b>크롬</b>으로 이 주소를 엽니다.</li><li>오른쪽 위 <b>⋮</b> 메뉴를 누릅니다.</li><li><b>앱 설치</b> 또는 <b>홈 화면에 추가</b> → <b>설치</b></li><li>홈 화면에 생긴 <b>온인터</b> 아이콘으로 엽니다.</li></ol>`;
  return `<div class="hd"><h3>홈 화면에 앱 설치</h3><button class="x" data-close aria-label="닫기">×</button></div>
  ${inAppNotice()}
  ${ENV.ios ? `<div class="card"><h2>아이폰·아이패드</h2>${ios}</div><div class="card"><h2>안드로이드·갤럭시</h2>${and}</div>` : `<div class="card"><h2>안드로이드·갤럭시</h2>${and}</div><div class="card"><h2>아이폰·아이패드</h2>${ios}</div>`}
  <div class="card"><h2>PC (크롬·엣지)</h2><p style="margin:0">주소창 오른쪽 끝의 <b>설치 아이콘(⊕ 또는 모니터 모양)</b>을 누르고 <b>설치</b>합니다.</p></div>
  <p class="muted" style="font-size:13px;margin:0">설치한 앱은 주소창 없이 열리고, 로그인은 처음 한 번만 하면 됩니다. 앱을 고치면 다음에 열 때 자동으로 새 버전이 뜹니다.</p>`;
}
async function doInstall() {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; if (r && r.outcome === 'accepted') toast('설치했습니다. 홈 화면의 온인터 아이콘으로 여세요'); else render(); return; }
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
function dayPt(d, v, extra) { return { lab: mdc(d), sub: `(${wd(d)})`, d, v, tip: `${md(d)} · ${fmt(v)}원${extra || ''}` }; }
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
    qty: ['실입고수량', '실입고', '실사수량', '실사', '실재고', '실제수량', '현재고', '재고수량', '입고수량', '수량', 'qty', 'quantity', 'q\'ty', 'ea', '개수', '갯수', '출고수량', '이동수량', '확정수량', '납품수량', '발주수량', '예정수량', '입고량', '출고량', '재고', '수'],
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
    const txt = r => (r || []).map(c => String(c ?? '').trim());
    const labelish = r => { const f = txt(r).filter(Boolean); if (f.length < 1 || f.some(x => /^\d{12,14}$/.test(String(x).replace(/\D/g, '')) && String(x).replace(/\D/g, '').length >= 12)) return false; const hits = f.filter(c => Object.keys(SYN).some(k => score(c, k) >= 1.2) || /상품명|옵션|바코드|수량|재고|입고|품번/.test(nz(c))).length; const nums = (r || []).filter(isNum).length; return hits >= 2 && nums <= 1 && !f.some(x => TOTAL.test(nz(x))); };
    let a = hi, b = hi;
    while (a > 0 && labelish(rows[a - 1]) && hi - a < 5) a--;
    while (b + 1 < rows.length && b - a < 6 && labelish(rows[b + 1])) b++;
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
  return { SYN, nz, numVal, isNum, TOTAL, detectHeader, headerBlock, flatHeader, signature, autoMap, bookSheets, fillMerges };
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
  const body = rows.slice(b + 1, b + 90);
  const numAt = i => body.filter(r => r && SM.isNum(r[i]) && !/^\d{12,14}$/.test(String(r[i] ?? '').replace(/\D/g, ''))).length;
  if (!over || !over.map) {
    let best = map.qty, bestS = best == null ? -1 : 0;
    H.forEach((h, i) => {
      const nums = numAt(i); if (!nums) return;
      const z = SM.nz(h);
      const rank = /실입고|실사|실제수량/.test(z) ? 3 : /입고수량/.test(z) ? 2 : /수량|재고|qty/.test(z) ? 1 : 0;
      if (!rank) return;
      const s = rank * 1000 + nums;
      if (s > bestS) { bestS = s; best = i; }
    });
    if (best != null) map = { ...map, qty: best };
  }
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
  if (!S.ui.mapOpen) return `<div class="row"><button class="btn sm" type="button" id="mapToggle">열 직접 고르기</button></div>`;
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
  const top = `${head('콜라보 분석', `IP 콜라보 기간의 입고 · 판매 · 재고 · 매출 · ${esc(shortName(st0))} ${last ? `매출 ${fd(last)} 마감` : ''}`)}
  <div class="card"><div class="flt">
    ${mine.length > 1 ? `<div class="fg"><div class="fl">매장</div><div class="fseg">${mine.map(s => `<button class="${s === st0 ? 'on' : ''}" data-cbst="${s}">${esc(shortName(s))}</button>`).join('')}</div></div>` : ''}
    <div class="fg"><div class="fl"><label for="cbPlan">콜라보</label></div><select class="inp" id="cbPlan">${plans.map(x => `<option value="${x.id}" ${x.id === cb.id ? 'selected' : ''}>${esc(x.ip)} · ${fr(x.start, x.end)}</option>`).join('')}</select></div>
    <div class="fg"><div class="fl">기간</div><div class="frange"><div class="fd"><span>시작</span>${dateSel('cba', cb.a)}</div><span class="fsep">~</span><div class="fd"><span>종료</span>${dateSel('cbb', cb.b)}</div></div></div>
  </div></div>`;
  if (!r) return top + '<div class="empty">이 매장에 등록된 IP 일정이 없습니다. IP 현황에서 일정을 추가해 주세요.</div>';
  const a = cb.a, b = cb.b, R = collabCalc(st0, r, a, b), T = R.T;
  const days = daysBetween(a, b) + 1, cats = catsOf(r);
  const eq = `<div class="card eqcard" id="cbTot" data-in="${T.in}" data-sold="${T.sold}" data-etc="${T.etc}" data-now="${T.now}">
    <h2>${esc(r.ip)} <span class="r">${md(a)} ~ ${md(b)} · ${days}일 · 토스포스 카테고리 ${cats.map(esc).join(', ')}</span></h2>
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
    ${R.etcList.map(m => `<tr><td class="nowrap num">${md(m.date)}</td><td>${typePill(m.type)}</td><td class="nm">${esc((S.P[m.pid] || {}).name || m.pid)}</td><td class="n"><b>${m.qty > 0 ? '+' : ''}${fmt(m.qty)}</b></td><td class="hide-s muted">${esc(m.memo || '')}</td></tr>`).join('')}</tbody></table></div>` : '<div class="empty">기타 내역 없음 — 입고와 판매 차감만 있습니다</div>'}</div>`;
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
  return top + eq.replace(/<span class="op">(.)<\/span>(\s*)<div class="eqi( res)?"><span class="k">/g, '<span class="op">$1</span>$2<div class="eqi$3"><span class="k"><i class="opm">$1</i>') + collabForecast(st0, r, a, b, R) + split + trend + sku + etc + cvp + rank;
}
function bind() {
  const ibActPaste = document.getElementById('ibActPaste');
  if (ibActPaste) ibActPaste.addEventListener('paste', e => { const text = (e.clipboardData || window.clipboardData || {}).getData ? (e.clipboardData || window.clipboardData).getData('text') : ''; if (text && (text.includes('\t') || text.includes('\n'))) { e.preventDefault(); const ib = S.inbounds.find(x => x.id === S.ui.ib); if (ib) ibActLoaded(ib, { rows: parsePasteTable(text), src: '붙여넣기' }); } });
  const mvPaste = document.getElementById('mvPaste');
  if (mvPaste) mvPaste.addEventListener('paste', e => { const text = (e.clipboardData || window.clipboardData || {}).getData ? (e.clipboardData || window.clipboardData).getData('text') : ''; if (text && (text.includes('\t') || text.includes('\n'))) { e.preventDefault(); moveFromRows(parsePasteTable(text), '붙여넣기'); } });
  const ibPaste = document.getElementById('ibPaste');
  if (ibPaste) ibPaste.addEventListener('paste', e => { const text = (e.clipboardData || window.clipboardData || {}).getData ? (e.clipboardData || window.clipboardData).getData('text') : ''; if (text && (text.includes('\t') || text.includes('\n'))) { e.preventDefault(); ibPaste.value = text; ibApplyCountRows(parsePasteTable(text), '붙여넣기'); } });
  const paste = document.getElementById('cntPaste');
  if (paste) paste.addEventListener('paste', e => { const text = (e.clipboardData || window.clipboardData || {}).getData ? (e.clipboardData || window.clipboardData).getData('text') : ''; if (text && (text.includes('\t') || text.includes('\n'))) { e.preventDefault(); countFromPaste(text); } });
  document.querySelectorAll('[data-cntip],[data-cntcat]').forEach(el => el.addEventListener('change', () => {
    const key = el.dataset.cntip || el.dataset.cntcat; const x = ((S.ui.cntPrev || {}).fresh || []).find(f => f.key === key); if (!x) return;
    if (el.dataset.cntip != null) x.ip = el.value; if (el.dataset.cntcat != null) x.cat = el.value;
    S.ui.cntEdit = S.ui.cntEdit || {}; S.ui.cntEdit[key] = { ip: x.ip, cat: x.cat };
  }));
  const gw = document.getElementById('cntGuard');
  if (gw) gw.addEventListener('input', () => { const ok = document.getElementById('cntGuardOk'); if (ok) ok.disabled = gw.value.trim() !== '실사'; });
  const app = $('#app');
  app.onclick = async ev => {
    const t = ev.target.closest('button,[data-pid],[data-cmpk],[data-hdip],label,input'); if (!t) return;
    const d = t.dataset;
    const pick = ev.target.closest('[data-cntpick]');
    if (pick && S.ui.cntPrev && !ev.target.closest('input.inp')) { const key = pick.dataset.cntpick; const x = (S.ui.cntPrev.fresh || []).find(f => f.key === key); if (x) { x.on = !x.on; S.ui.cntSkip = S.ui.cntSkip || {}; S.ui.cntSkip[key] = !x.on; S.ui.cntNoScroll = true; render(); } return; }
    if (d.install != null) { doInstall(); return; }
    if (d.openext != null) { openExternal(); return; }
    if (d.copylink != null) { copyLink(); return; }
    if (t.closest && t.closest('#navBack')) { try { history.back(); } catch (e) { goBack(); } return; }
    if (d.dcfgsave) { const c = bizCfg(d.dcfgsave); document.querySelectorAll(`[data-dcfg="${d.dcfgsave}"]`).forEach(i => { const v = String(i.value).replace(/[^\d.]/g, ''); c[i.dataset.k] = v === '' ? '' : +v; }); saveBiz(); toast('저장했습니다'); render(); return; }
    if (d.bizf) { S.ui.bizF = d.bizf; render(); return; }
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
    if (t.id === 'closePrint') { window.print(); return; }
    if (t.id === 'schedFile') { pickFile('.md,.markdown,.txt,.json,text/markdown,application/json', f => schedReadFile(f)); return; }
    if (t.id === 'schedSave') { await schedSavePreview(); return; }
    if (t.id === 'schedCancel') { S.ui.schedPrev = null; render(); return; }
    if (t.id === 'schedThis') { S.ui.schedYm = today().slice(0, 7); S.ui.schedDay = ''; render(); return; }
    if (t.id === 'schedPrevM' || t.id === 'schedNextM') { S.ui.schedYm = ymAdd(schedYm(), t.id === 'schedNextM' ? 1 : -1); S.ui.schedDay = ''; render(); return; }
    if (t.id === 'schedPrint') { window.print(); return; }
    if (d.sday) { S.ui.schedDay = d.sday; render(); return; }
    if (t.id === 'pcLoad') { S.ui.popupForm = popupQuote(); render(); toast('견적서 숫자를 칸에 채웠습니다'); return; }
    if (t.id === 'pcSave') { await savePopupForm(); return; }
    if (d.pcdel) { await deletePopup(d.pcdel); return; }
    if (d.cym || d.cstep) {
      const cap = today().slice(0, 7);
      let ym = d.cym === 'this' ? cap : d.cym === 'prev' ? ymPrev(cap) : ymAdd(closeYm(), +d.cstep || 0);
      if (ym > cap) { toast('이번 달보다 앞은 아직 마감할 수 없습니다'); return; }
      S.ui.closeYm = ym; render(); return;
    }
    if (d.tzt) { S.ui.tzOpen = !S.ui.tzOpen; render(); return; }
    if (d.tz) { applyTextSize(parseFloat(d.tz)); S.ui.tzOpen = false; render(); return; }
    if (d.tone) { applyTheme(d.tone); render(); return; }
    if (d.al != null) { const a = alerts(S.stores)[+d.al]; if (a && a.go) { a.go(); render(); } return; }
    if (d.pid && ev.target.tagName !== 'INPUT') { openProduct(d.pid); return; }
    if (d.close != null) { if (S.ui.stopScan) S.ui.stopScan(); S.ui.drawer = null; S.ui.posPreview = null; render(); return; }
    if (t.id === 'ov' && ev.target === t) { S.ui.drawer = null; render(); return; }
    if (d.pf) { S.ui.f = d.pf; render(); return; }
    if (d.pfgo) { S.ui.f = d.pfgo; S.ui.q = ''; S.ui.ip = ''; S.view = 'products'; render(); goTop(); return; }
    if (t.id === 'scanBtn' || t.id === 'scanBtn2') { scan(onScanned); return; }
    if (d.quick) {
      S.ui.drawer = null;
      if (d.quick === 'count') { S.view = 'count'; S.ui.countQ = (S.P[d.qp] || {}).barcode || (S.P[d.qp] || {}).name || ''; }
      else if (d.quick === '입고') { S.view = 'inbound'; S.ui.ib = 'new'; S.ui.ibForm = null; }
      else if (d.quick === '매장 이동') { S.view = 'transfer'; const m = S.ui.move ||= { from: S.stores[0], to: '', lines: [], q: '' }; if (d.qp && !m.lines.some(l => l.pid === d.qp)) m.lines.push({ pid: d.qp, qty: 1 }); }
      else { S.view = 'entry'; S.ui.entry = newEntry(d.quick); if (d.qp) addLine(d.qp, 1); }
      render(); return;
    }
    if (d.et) { const e = S.ui.entry; e.type = d.et; render(); return; }
    if (d.em) { S.ui.entry.mode = d.em; render(); return; }
    if (d.ld != null) { S.ui.entry.lines.splice(+d.ld, 1); render(); return; }
    if (t.id === 'eClear') { S.ui.entry.lines = []; render(); return; }
    if (t.id === 'eSave') { await saveEntry(); return; }
    if (t.id === 'fileBtn') { pickFile('.xlsx,.xls,.csv', f => readFile(f)); return; }
    if (t.id === 'naverFileBtn') { pickFile('.xlsx,.xls,.csv', f => readNaver(f).catch(e => { S.ui.naver = { err: e.message || String(e) }; render(); })); return; }
    if (t.id === 'blogSave') { const m = (document.getElementById('blogMonth') || {}).value, a = +String((document.getElementById('blogAmt') || {}).value || '').replace(/[^\d-]/g, ''), memo = ((document.getElementById('blogMemo') || {}).value || '').trim(); if (!m || !a) { toast('월과 금액을 넣어 주세요'); return; } (S.biz.blog ||= {})[m + '-01'] = { s: a, p: 0, memo }; saveBiz(); toast('블로그 운영 금액을 저장했습니다'); render(); return; }
    if (d.blogdel) { if (S.biz.blog) delete S.biz.blog[d.blogdel]; saveBiz(); render(); return; }
    if (d.bizgo) { const b = BIZ.find(x => x.id === d.bizgo); S.ui.storeMenu = false; if (b && b.stores) { S.stores = [...b.stores]; S.sumStores = null; S.ui.range = null; S.view = 'home'; } else { S.ui.bizF = d.bizgo; S.view = 'biz'; } render(); goTop(); return; }
    if (t.id === 'naverSave') { const n = S.ui.naver; if (n && n.days) { const B = S.biz.onkihote ||= {}; for (const [d, v] of Object.entries(n.days)) B[d] = v; saveBiz(); S.ui.naver = null; toast('온키호테 매출을 반영했습니다'); } return; }
    if (t.id === 'naverCancel') { S.ui.naver = null; render(); return; }
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
    if (t.id === 'ibSheetFile' || t.id === 'ibPlanFile') { pickFile('.xlsx,.xls,.csv', f => stockReadFile(f).then(x => ibApplyCountRows(x.rows, x.src)).catch(e => { S.ui.ibForm.err = e.message || String(e); render(); })); return; }
    if (t.id === 'ibPlanImg') { pickFile('image/*,.heic,.heif', fs => ibImages(fs), true); return; }
    if (t.id === 'ibPlanLinkGo') { linkRows($('#ibPlanLink').value.trim()).then(x => ibPlanLoaded(x)).catch(e => { S.ui.ibForm.err = e.message; render(); }); return; }
    if (t.id === 'ibCreate' || d.act === 'ibCreate') { await ibCreate(); return; }
    if (t.id === 'ibActFile') { const ib = S.inbounds.find(x => x.id === S.ui.ib); pickFile('.xlsx,.xls,.csv', f => stockReadFile(f).then(x => ibActLoaded(ib, x)).catch(e => { S.ui.ibMsg = { t: e.message || String(e), bad: true }; render(); })); return; }
    if (t.id === 'ibActLinkGo') { const ib = S.inbounds.find(x => x.id === S.ui.ib); linkRows($('#ibActLink').value.trim()).then(x => ibActLoaded(ib, x)).catch(e => { S.ui.ibMsg = { t: '🔺 ' + e.message, bad: true }; render(); }); return; }
    if (t.id === 'ibConfirm' || d.act === 'ibConfirm') { const ib = S.inbounds.find(x => x.id === S.ui.ib); const st = ibStats(ib), left = ib.items.filter(x => x.actual == null);
      const warn = left.length ? `<div class="note warn" style="margin-top:10px">🔸 <b>아직 실제 수량을 안 넣은 상품 ${left.length}종</b>(예정 ${fmt(left.reduce((a, b) => a + (b.plan || 0), 0))}개)은 <b>0개로 입고</b>됩니다. 정말 안 왔는지 확인해 주세요.<ul style="margin:6px 0 0;padding-left:18px;font-size:12.5px">${left.slice(0, 8).map(x => `<li>${esc(x.name)} · 예정 ${fmt(x.plan)}개</li>`).join('')}${left.length > 8 ? `<li>외 ${left.length - 8}종</li>` : ''}</ul></div>` : '';
      confirmDrawer('실제 수량으로 입고 확정', `<p style="margin:0">${esc(ib.title)} — 실제 <b>${fmt(st.act)}개</b>(예정 ${fmt(st.plan)}개)를 재고에 더합니다. 확정한 뒤에는 수량을 고칠 수 없고, 차이는 기록으로 남습니다.</p>${warn}`, left.length ? `${left.length}종 0개로 두고 확정` : '입고 확정', () => ibConfirm(ib)); return; }
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
    if (d.mpick != null && S.ui.imp) { const st = S.ui.entry.store; let n = 0; for (const r of S.ui.imp.rows.filter(r => r.st === 'multi')) {
        if (d.mpick === '__clear') { r.pid = ''; continue; }
        const c = d.mpick === '__stock' ? [...r.cand].sort((a, b) => stockOf(st, b) - stockOf(st, a)).filter(x => stockOf(st, x) > 0) : r.cand.filter(x => (S.P[x].ip || '(IP 없음)') === d.mpick);
        if (c.length) { r.pid = c[0]; n++; } }
      render(); if (d.mpick !== '__clear') toast(n ? `${n}줄을 골랐습니다` : '맞는 상품이 없습니다 — 줄마다 골라 주세요'); return; }
    if (t.id === 'mapToggle') { S.ui.mapOpen = !S.ui.mapOpen; render(); return; }
    if (t.id === 'mapRe' || t.id === 'mapSave') { const im = S.ui.imp; const m = readMapUI(); if (m.qty == null || (m.name == null && m.barcode == null && m.sku == null)) { toast('상품명(또는 바코드·품번)과 수량 칸을 골라 주세요'); return; }
      if (t.id === 'mapSave') { await saveImportMap(im.det.sig, { map: m, sample: im.det.H.filter(Boolean).slice(0, 8), by: S.user.name, at: new Date().toISOString() }); }
      importRows(im.raw, im.src, { a: im.det.a, r: im.det.r, map: m }); if (t.id === 'mapSave') S.ui.imp.det.how = 'saved'; render(); if (t.id === 'mapSave') toast('이 양식을 기억했습니다 — 같은 제목 줄 파일은 다음부터 자동'); return; }
    if (d.cbst) { S.ui.cb = { store: d.cbst }; render(); return; }
    if (t.id === 'impUse') { S.ui.entry.file = S.ui.imp.src; for (const r of S.ui.imp.rows) if (r.pid && r.qty > 0 && !(r.dup && S.ui.imp.dupMode === 'first')) addLine(r.pid, r.qty, r.dup ? `파일 ${r.dup}줄과 같은 상품 — 수량 합침` : null); S.ui.imp = null; S.ui.entry.mode = 'hand'; render(); return; }
    if (t.id === 'cSave') { const st = S.stores[0], c = S.ui.counts[st] || {}; const df = Object.keys(c).filter(pid => c[pid] !== stockOf(st, pid)).map(pid => ({ pid, b: stockOf(st, pid), v: c[pid] })).sort((a, b) => Math.abs(b.v - b.b) - Math.abs(a.v - a.b));
      const plus = df.filter(x => x.v > x.b).reduce((a, x) => a + x.v - x.b, 0), minus = df.filter(x => x.v < x.b).reduce((a, x) => a + x.b - x.v, 0), amt = df.reduce((a, x) => a + (x.v - x.b) * ((S.P[x.pid] || {}).price || 0), 0);
      confirmDrawer('실사 결과를 재고에 반영', `<p style="margin:0 0 8px">${esc(storeName(st))} · ${fd(today())} — 장부 수량을 세어 본 수량으로 바꿉니다. 반영한 뒤에는 '재고 조정' 기록으로 남습니다.</p>
        <div class="kv"><dt>바뀌는 상품</dt><dd class="num"><b>${df.length}종</b></dd><dt>늘어남</dt><dd class="num" style="color:var(--ok);font-weight:700">+${fmt(plus)}개</dd><dt>줄어듦</dt><dd class="num qty-neg">−${fmt(minus)}개</dd>${amt ? `<dt>금액 차이</dt><dd class="num"><b>${amt > 0 ? '+' : ''}${won(amt)}</b></dd>` : ''}</div>
        <div class="tw" style="margin-top:10px"><table><thead><tr><th>상품명</th><th class="n">장부</th><th class="n">실사</th><th class="n">차이</th></tr></thead><tbody>${df.slice(0, 15).map(x => `<tr><td class="nm">${esc(S.P[x.pid].name)}</td><td class="n">${fmt(x.b)}</td><td class="n">${fmt(x.v)}</td><td class="n" style="font-weight:700;color:${x.v < x.b ? 'var(--bad)' : 'var(--ok)'}">${x.v > x.b ? '+' : ''}${fmt(x.v - x.b)}</td></tr>`).join('')}</tbody></table></div>${df.length > 15 ? `<p class="muted" style="font-size:12.5px;margin:6px 0 0">차이 큰 순 15종만 보여 줍니다 (전체 ${df.length}종 반영)</p>` : ''}`, `${df.length}종 반영`, async () => { await saveCount(); S.ui.cntMsg = null; }); return; }
    if (t.id === 'cntTpl') { countTemplate(); return; }
    if (t.id === 'cntFile') { pickFile('.xlsx,.xls,.csv', f => countReadFile(f)); return; }
    if (t.id === 'cntPasteGo') { countFromPaste((document.getElementById('cntPaste') || {}).value || ''); return; }
    if (t.id === 'cntPrevClear') { S.ui.cntPrev = null; render(); return; }
    if (d.cntprod != null && d.cntprod !== '') { countRepick('prod', +d.cntprod); return; }
    if (d.cntqty != null && d.cntqty !== '') { countRepick('qty', +d.cntqty); return; }
    if (d.cntip != null || d.cntcat != null) return;
    if (t.id === 'cntIpApply') { const v = (document.getElementById('cntIpAll') || {}).value || ''; (S.ui.cntPrev.fresh || []).forEach(f => { f.ip = v; S.ui.cntEdit = S.ui.cntEdit || {}; S.ui.cntEdit[f.key] = { ...(S.ui.cntEdit[f.key] || {}), ip: v, cat: f.cat }; }); S.ui.cntNoScroll = true; render(); return; }
    if (t.id === 'cntGuardOk') { if ((document.getElementById('cntGuard') || {}).value.trim() !== '실사') return; S.ui.drawer = null; await countRegister(); return; }
    if (t.id === 'cntOnly') { S.ui.cntOnly = !S.ui.cntOnly; render(); return; }
    if (t.id === 'cntCols') { S.ui.cntCols = !S.ui.cntCols; render(); return; }
    if (t.id === 'ibOnly') { S.ui.ibOnly = !S.ui.ibOnly; render(); return; }
    if (d.ibstore && S.ui.ibForm) { S.ui.ibForm.store = d.ibstore; render(); return; }
    if (d.mvfrom && S.ui.move) { S.ui.move.from = d.mvfrom; if (S.ui.move.to === d.mvfrom) S.ui.move.to = ''; render(); return; }
    if (d.mvto && S.ui.move) { S.ui.move.to = d.mvto; render(); return; }
    if (d.mvadd && S.ui.move) { const m = S.ui.move; const ex = m.lines.find(l => l.pid === d.mvadd); if (ex) ex.qty += 1; else m.lines.push({ pid: d.mvadd, qty: 1 }); m.q = ''; render(); return; }
    if (d.mvdel && S.ui.move) { S.ui.move.lines = S.ui.move.lines.filter(l => l.pid !== d.mvdel); render(); return; }
    if (t.id === 'mvSave' || t.id === 'mvSave2' || d.act === 'mvSave') { await moveSave(); return; }
    if (t.id === 'mvFile') { pickFile('.xlsx,.xls,.csv', f => stockReadFile(f).then(x => moveFromRows(x.rows, x.src)).catch(e => { S.ui.move.note = e.message || String(e); render(); })); return; }
    if (d.ibjump) { S.ui.drawer = null; S.view = 'inbound'; S.ui.ib = d.ibjump; render(); return; }
    if (t.id === 'cntUndo') { countUndoAsk(); return; }
    if (t.id === 'cntUndoKeep' || t.id === 'cntUndoDel') { S.ui.drawer = null; await countUndo(t.id === 'cntUndoDel'); return; }
    if (t.id === 'cntReg' || d.cntgo) { countOpenGuard(); return; }
    if (d.cntsheet) { countUseSheet(d.cntsheet); return; }
    if (t.id === 'cntLinkGo') { linkRows($('#cntLink').value.trim()).then(x => { cntRows = x.rows; S.ui.cntPick = null; countSetPreview(countParseRows(x.rows, null), x.src); }).catch(e => { S.ui.cntMsg = { bad: true, html: '🔺 ' + esc(e.message) }; render(); }); return; }
    if (t.id === 'cReset') { S.ui.counts[S.stores[0]] = {}; render(); return; }
    if (d.recv) { await receive(d.recv); return; }
    if (d.rt != null) { S.ui.recType = d.rt; render(); return; }
    if (d.su) { S.ui.salesUnit = d.su; render(); return; }
    if (d.sp) { S.ui.salesPeriod = { preset: d.sp }; S.ui.range = null; render(); return; }
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
      const lastD = new Date(Date.UTC(y, m, 0)).getUTCDate(); if (dd > lastD) { setTimeout(() => toast(`${m}월은 ${lastD}일까지라서 ${lastD}일로 맞췄습니다`), 0); dd = lastD; }
      h.value = `${y}-${String(m).padStart(2, '0')}-${String(dd).padStart(2, '0')}`;
      onChange({ target: h }); return;
    }
    if (t.id === 'cbPlan') { const r = ipPlan().find(x => x.id === t.value); if (r) S.ui.cb = { store: r.store, id: r.id, a: r.start, b: r.end }; render(); return; }
    if (t.id === 'cba' || t.id === 'cbb') { const k = t.id === 'cba' ? 'a' : 'b'; S.ui.cb[k] = t.value; let msg = ''; if (S.ui.cb.b < S.ui.cb.a) { if (k === 'a') S.ui.cb.b = S.ui.cb.a; else S.ui.cb.a = S.ui.cb.b; msg = k === 'a' ? '시작일이 종료일보다 늦어서 종료일을 같은 날로 맞췄습니다' : '종료일이 시작일보다 빨라서 시작일을 같은 날로 맞췄습니다'; } render(); if (msg) toast(msg); return; }
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
    if (t.id === 'sdFrom') { const bad = t.value > S.ui.sdoc.date; S.ui.sdoc.from = bad ? S.ui.sdoc.date : t.value; render(); if (bad) toast('시작일은 기준일보다 늦을 수 없어 기준일로 맞췄습니다'); return; }
    if (t.id === 'sdIpq') { S.ui.sdoc.ipq = t.value; return; }
    if (t.id === 'machStore') { S.ui.machStore = t.value; S.ui.machPv = null; render(); return; }
    if (t.id === 'ipPast') { S.ui.ipPast = t.checked; render(); return; }
    if (['ipStore', 'ipName', 'ipStart', 'ipEnd', 'ipHost', 'ipNote'].includes(t.id)) { const k = { ipStore: 'store', ipName: 'ip', ipStart: 'start', ipEnd: 'end', ipHost: 'host', ipNote: 'note' }[t.id]; const f = S.ui.ipForm; f[k] = t.value; if (k === 'store') f.kind = STORE_KIND[t.value] || f.kind; let msg = ''; if (k === 'start' && (!f.end || f.end < t.value)) { if (f.end) msg = '종료일을 시작일과 같은 날로 맞췄습니다'; f.end = t.value; } if (k === 'end' && f.end < f.start) { f.end = f.start; msg = '종료일은 시작일보다 빠를 수 없어 시작일로 맞췄습니다'; } render(); if (msg) toast(msg); return; }
    if (['plName', 'plStart', 'plEnd', 'plAddr', 'plPerson', 'plMemo'].includes(t.id)) { const k = { plName: 'name', plStart: 'start', plEnd: 'end', plAddr: 'addr', plPerson: 'person', plMemo: 'memo' }[t.id]; const pf = S.ui.placeForm; pf[k] = t.value; let msg = ''; if (k === 'start' && (!pf.end || pf.end < t.value)) { if (pf.end) msg = '종료일을 시작일과 같은 날로 맞췄습니다'; pf.end = t.value; } if (k === 'end' && pf.end < pf.start) { pf.end = pf.start; msg = '종료일은 시작일보다 빠를 수 없어 시작일로 맞췄습니다'; } render(); if (msg) toast(msg); return; }
    if (t.id === 'ePartner') { S.ui.entry.partner = t.value; render(); return; }
    if (t.id === 'eMemo') { S.ui.entry.memo = t.value; if (TYPES.find(x => x.id === S.ui.entry.type).from) render(); return; }
    if (d.lq != null) { S.ui.entry.lines[+d.lq].qty = Math.max(0, parseInt(t.value || '0', 10)); render(); return; }
    if (d.mvq && S.ui.move) { const l = S.ui.move.lines.find(x => x.pid === d.mvq); if (l) l.qty = Math.max(1, parseInt(t.value || '1', 10)); return; }
    if (d.ip != null) { const r = S.ui.imp.rows[+d.ip]; r.pid = t.value; render(); return; }
    if (d.cnt) { const st = S.stores[0]; const v = t.value === '' ? null : Math.max(0, parseInt(t.value, 10)); if (v == null) delete S.ui.counts[st][d.cnt]; else S.ui.counts[st][d.cnt] = v; render(); return; }
    if (t.id === 'ra' || t.id === 'rb') { let a = $('#ra').value, b = $('#rb').value; if (!a || !b) return; let msg = '';
      if (a > b) { if (t.id === 'ra') { b = a; msg = `시작일이 종료일보다 늦어서 종료일도 ${md(a)}로 맞췄습니다`; } else { a = b; msg = `종료일이 시작일보다 빨라서 시작일도 ${md(b)}로 맞췄습니다`; } }
      if (b > today()) { b = today(); if (a > b) a = b; msg = '앞으로 올 날짜는 고를 수 없어 오늘까지로 맞췄습니다'; }
      S.ui.salesPeriod = { preset: 'custom', a, b }; S.ui.range = { unit: S.ui.salesUnit, ab: [a, b], preset: 'custom' }; render(); if (msg) toast(msg); return; }
    if (d.sum) { const cur = (S.sumStores || S.stores).filter(s => s !== d.sum); if (t.checked) cur.push(d.sum); S.sumStores = cur.length ? cur : [d.sum]; render(); return; }
    if (t.id === 'setM') { S.ui.settleMonth = t.value; render(); return; }
    if (d.pst) { const [id, s] = d.pst.split(':'); const p = S.ui.draft[id]; p.stores = t.checked ? [...new Set([...p.stores, s])] : p.stores.filter(x => x !== s); render(); return; }
    if (d.pp) { const [id, k] = d.pp.split(':'); S.ui.draft[id][k] = t.checked; return; }
    if (t.id === 'posDeduct' && S.ui.posPreview) { S.ui.posPreview.deduct = t.checked; render(); return; }
    if (t.id === 'posNegOk' && S.ui.posPreview) { S.ui.posPreview.negOk = t.checked; render(); return; }
    if (d.posln != null && S.ui.posPreview) { const pv = S.ui.posPreview, u = pv.unmatched[+d.posln]; if (t.value) pv.links[u.name] = t.value; else delete pv.links[u.name]; posRecalc(pv); render(); return; }
    if (d.zpw) { S.zipPw[d.zpw] = t.value; if (DB.saveZip) DB.saveZip(S.zipPw).then(() => toast('비밀번호를 저장했습니다')); else render(); return; }
  };
  const fq = $('#fq'); if (fq) fq.oninput = debounce(() => { S.ui.fq = fq.value; rerenderKeep('#fq'); });
  const fw = $('#fwho'); if (fw) fw.onchange = () => { S.ui.fwho = fw.value; render(); };
  const pq = $('#pq'); if (pq) pq.oninput = debounce(() => { S.ui.q = pq.value; rerenderKeep('#pq'); });
  const cq = $('#cq'); if (cq) cq.oninput = debounce(() => { S.ui.countQ = cq.value; rerenderKeep('#cq'); });
  const mvQ = $('#mvQ'); if (mvQ) mvQ.oninput = debounce(() => { S.ui.move.q = mvQ.value; rerenderKeep('#mvQ'); });
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
  const kF = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const kst2 = d => { const o = Object.fromEntries(kF.formatToParts(d).map(x => [x.type, x.value])); return `${o.year}.${o.month}.${o.day}(${'일월화수목금토'[new Date(`${o.year}-${o.month}-${o.day}T00:00:00Z`).getUTCDay()]}) ${o.hour}:${o.minute}`; };
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
// 글자를 칠 때마다 저장 버튼을 바로 켜고 끔 (화면 전체를 다시 그리지 않아 한 번에 눌림)
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.id === 'eMemo' && S.ui.entry) { S.ui.entry.memo = t.value; const b = $('#eSave'); if (b) b.disabled = lineIssues(S.ui.entry).some(x => x.block); return; }
  if (['plName', 'plStart'].includes(t.id) && S.ui.placeForm) { S.ui.placeForm[t.id === 'plName' ? 'name' : 'start'] = t.value; const b = $('#plSave'); if (b) b.disabled = !(S.ui.placeForm.name.trim() && S.ui.placeForm.start); return; }
});
document.addEventListener('input', ev => {
  if (ev.target.id !== 'sdIpq' || !S.ui.sdoc) return;
  S.ui.sdoc.ipq = ev.target.value; const q = norm(ev.target.value);
  document.querySelectorAll('.iplist .ipck').forEach(l => { l.style.display = !q || norm(l.textContent).includes(q) ? '' : 'none'; });
});
// 사진 미리보기에서 상품명·수량 고치기 (다시 그리지 않고 바로 반영, 바깥으로 나가면 다시 맞춤)
document.addEventListener('input', ev => {
  const t = ev.target, f = S.ui.ibForm; if (!f || !f.parsed) return;
  if (t.dataset.ibq != null) { const r = f.parsed[+t.dataset.ibq]; if (r) r.qty = t.value === '' ? null : Number(t.value); }
  if (t.dataset.ibn != null) { const r = f.parsed[+t.dataset.ibn]; if (r) r.name = t.value; }
});
document.addEventListener('change', ev => {
  const t = ev.target, p = S.ui.schedPrev;
  if (p && t.dataset.schk != null) { p.rows[+t.dataset.schk].on = t.checked; return; }
  if (p && t.dataset.sved != null) { const r = p.rows[+t.dataset.sved]; r.venue = t.value; r.venueKey = schedVenueKey(t.value); r.type = schedTypeOf(r.venue, r.title, r.section || ''); return; }
  if (p && t.dataset.stit != null) { const r = p.rows[+t.dataset.stit]; r.title = t.value; r.type = schedTypeOf(r.venue, r.title, r.section || ''); return; }
  const f = S.ui.ibForm; if (!f || !f.parsed || t.dataset.ibn == null) return;
  const r = f.parsed[+t.dataset.ibn]; if (!r) return; let cand = r.bc ? findProduct(r.bc) : []; if (!cand.length && r.sku) cand = findProduct(r.sku); if (!cand.length && r.name) cand = S.byName[norm(r.name)] || []; r.pid = cand.length === 1 ? cand[0].id : ''; render();
});
// 컴퓨터: 캡처 후 Ctrl+V / 사진 끌어 놓기 → 입고 예정 등록 화면이면 바로 읽기
document.addEventListener('paste', ev => {
  if (S.view !== 'inbound' || S.ui.ib !== 'new' || !S.ui.ibForm) return;
  const fs = [...((ev.clipboardData || {}).files || [])].filter(isImg); if (!fs.length) return;
  ev.preventDefault(); ibImages(fs);
});
document.addEventListener('dragover', ev => { if (S.view === 'inbound' && S.ui.ib === 'new') ev.preventDefault(); });
document.addEventListener('drop', ev => {
  if (S.view !== 'inbound' || S.ui.ib !== 'new' || !S.ui.ibForm) return;
  const fs = [...((ev.dataTransfer || {}).files || [])]; if (!fs.length) return; ev.preventDefault();
  const im = fs.filter(isImg); if (im.length) ibImages(im); else fileRows(fs[0]).then(x => ibPlanLoaded(x)).catch(e => { S.ui.ibForm.err = e.message; render(); });
});
function goTop() { resetZoom(); window.scrollTo(0, 0); }
const TEXT_SIZES = [['가-', 0.875, '작게'], ['가', 1, '보통'], ['가+', 1.125, '크게'], ['가++', 1.25, '아주 크게']];
const nearZoom = z => TEXT_SIZES.reduce((a, b) => Math.abs(b[1] - z) < Math.abs(a[1] - z) ? b : a)[1];
function applyTextSize(z) { S.ui.textZoom = z; document.documentElement.style.zoom = z === 1 ? '' : String(z); try { localStorage.setItem('smg-text-zoom', String(z)); } catch (e) { } }
try { const z = nearZoom(parseFloat(localStorage.getItem('smg-text-zoom') || '1') || 1); if (z !== 1) applyTextSize(z); } catch (e) { }
function textSizeBox() {
  const z = S.ui.textZoom || 1;
  return `<div class="fsz" role="group" aria-label="글자 크기">${TEXT_SIZES.map(([t, v, l]) => `<button type="button" class="${z === v ? 'on' : ''}" aria-pressed="${z === v}" data-tz="${v}" title="글자 ${l}" aria-label="글자 ${l}">${t}</button>`).join('')}</div>`;
}
// 화이트톤/블랙톤: 저장 → 다음에 열어도 유지. 상태 표시줄(맨 위) 색도 같이 (반투명 없음)
function curTheme() { return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light'; }
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  const c = t === 'dark' ? '#0B0B0C' : '#FFFFFF';
  document.querySelectorAll('meta[name=theme-color]').forEach(m => m.setAttribute('content', c));
  try { localStorage.setItem('smg-theme', t); } catch (e) { }
}
function themeBtn() {
  const d = curTheme() === 'dark';
  return `<div class="tone" role="group" aria-label="화면 색"><button type="button" data-tone="light" class="${d ? '' : 'on'}" aria-pressed="${!d}">화이트톤</button><button type="button" data-tone="dark" class="${d ? 'on' : ''}" aria-pressed="${d}">블랙톤</button></div>`;
}
function headTools() { return `<div class="htools">${textSizeBox()}${themeBtn()}</div>`; }
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
    setTimeout(() => needX().catch(() => { }), 4000);   // 첫 화면이 뜬 뒤에 엑셀 도구 미리 받아두기
  } catch (err) {
    $('#app').innerHTML = `<div class="login"><div class="note bad" style="margin:20px">🔺 앱을 여는 중 문제가 생겼습니다: ${esc(err.message || err)}</div></div>`;
  }
}
// 매출 화면을 켜 둔 채로 날짜가 바뀌면 빠른 기간만 다시 계산 (직접 고른 날짜는 그대로)
function salesPeriodRollover() {
  if (S.view !== 'sales' || !S.user) return;
  const p = S.ui.salesPeriod;
  if (p && p.preset === 'custom') return;
  const sp = resolveSalesPeriod();
  const ab = (S.ui.range && S.ui.range.ab) || [];
  if (ab[0] === sp.a && ab[1] === sp.b) return;
  render();
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') salesPeriodRollover(); });
setInterval(salesPeriodRollover, 30000);
window.SMGApp = { S, render, indexProducts, setUser, salesPresetRange, resolveSalesPeriod, salesPeriodRollover, parseSchedText, parseSchedJson, schedDocs, countFromPaste, countParseRows, parsePasteTable, ibApplyCountRows, moveFromRows, ibActLoaded };
start();
})();

