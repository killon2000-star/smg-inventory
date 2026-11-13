#!/usr/bin/env node
/**
 * 2026-11-13 수원 입고(약 17:56)에서 화면에 안 보인 줄을 메우는 일회용 스크립트.
 * 아직 실행하지 않습니다. 본부장님이 허락하기 전에는 --apply 를 붙이지 마세요.
 *
 *   node tools/apply-missing-aot-inbound.mjs
 *     입고 문서를 읽어 계획만 인쇄합니다. 쓰기는 없습니다.
 *   node tools/apply-missing-aot-inbound.mjs --apply
 *     바코드가 없으면 상품을 만들고 입고를 더합니다.
 *     바코드 상품이 이미 있고 같은 입고 기록이 있으면 재고는 그대로 두고,
 *     IP가 진격의 거인이 아닐 때만 IP를 진격의 거인으로 고칩니다.
 *
 * 인증: 환경변수 GOOGLE_ACCESS_TOKEN (Firestore 읽기·쓰기 권한이 있는 토큰).
 * 토큰이 없으면 아래 대조표만 인쇄하고 끝냅니다.
 *
 * 물류 일정 탭 기준 대조 (실입고수량, 같은 바코드는 합침).
 * 포스터는 바코드도 실입고도 없어서 재고에 넣지 않습니다.
 */
const APPLY = process.argv.includes('--apply');
const PROJECT = 'smg-inventory-677e3';
const STORE = 'suwon';
const BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`;

const EXPECTED = [
  ['8800394220907', '틴케이스_자유의 날개', 160],
  ['8800394220914', '틴케이스_파라디섬의 악마', 160],
  ['8800394220921', '틴케이스_아커만', 160],
  ['8800394220938', '틴케이스_땅울림', 160],
  ['8800394220679', '원화 와이어 키링_엘런', 90],
  ['8800394220686', '원화 와이어 키링_미카사', 182],
  ['8800394220693', '원화 와이어 키링_리바이', 294],
  ['8800394220822', '듀얼 아크릴 스탠드_엘런', 193],
  ['8800394220839', '듀얼 아크릴 스탠드_라이너', 192],
  ['8800394220846', '듀얼 아크릴 스탠드_애니', 92],
  ['8800394220853', '듀얼 아크릴 스탠드_지크', 92],
  ['8800394220860', '듀얼 아크릴 스탠드_피크', 92],
  ['8800394220877', '듀얼 아크릴 스탠드_팔코', 92],
  ['8800394220631', '카드 커버 스티커_자유의 날개', 192],
  ['8800394220648', '카드 커버 스티커_벽', 191],
  ['8800394220969', '반팔 티셔츠_블랙', 142],
  ['8800394220976', '반팔 티셔츠_화이트', 142],
  ['8800394220716', '모티브 키링_엘런', 192],
  ['8800394220723', '모티브 키링_미카사', 292],
  ['8800394220730', '모티브 키링_리바이', 592],
  ['8800394220747', '조사병단 인식표 키링_엘런', 192],
  ['8800394220754', '조사병단 인식표 키링_미카사', 292],
  ['8800394220761', '조사병단 인식표 키링_아르민', 92],
  ['8800394220778', '조사병단 인식표 키링_리바이', 392],
  ['8800394220785', '조사병단 인식표 키링_한지', 92],
  ['8800394220792', '조사병단 인식표 키링_장', 92],
  ['8800394220952', '랜덤 캔뱃지', 936],
  ['8800394220594', '엽서 세트_A', 292],
  ['8800394220600', '엽서 세트_B', 292],
  ['8800394220617', '엽서 세트_C', 292]
];

function unwrap(v) {
  if (!v) return null;
  if (v.stringValue != null) return v.stringValue;
  if (v.integerValue != null) return Number(v.integerValue);
  if (v.doubleValue != null) return Number(v.doubleValue);
  if (v.booleanValue != null) return v.booleanValue;
  if (v.nullValue != null) return null;
  if (v.arrayValue) return (v.arrayValue.values || []).map(unwrap);
  if (v.mapValue) return Object.fromEntries(Object.entries(v.mapValue.fields || {}).map(([k, x]) => [k, unwrap(x)]));
  return null;
}
function docOf(d) {
  const id = decodeURIComponent(String(d.name || '').split('/').pop());
  return { id, ...(unwrap({ mapValue: { fields: d.fields || {} } }) || {}) };
}
function wrap(v) {
  if (v == null) return { nullValue: null };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'object') return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, wrap(x)])) } };
  return { stringValue: String(v) };
}

async function api(token, path, opt = {}) {
  const r = await fetch(BASE + path, { ...opt, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opt.headers || {}) } });
  const text = await r.text();
  if (!r.ok) throw new Error(r.status + ' ' + path + ' ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

function linesOf(ib) {
  const bag = new Map();
  for (const x of [...(ib.items || []), ...(ib.extra || [])]) {
    const bc = String(x.bc || x.code || '').replace(/\D/g, '');
    const qty = Number(x.actual || 0);
    if (!bc || !(qty > 0)) continue;
    const cur = bag.get(bc) || { bc, name: x.name || '', qty: 0, ip: x.ip || '' };
    cur.qty += qty;
    if (x.name) cur.name = x.name;
    bag.set(bc, cur);
  }
  return [...bag.values()];
}

async function main() {
  console.log('모드: ' + (APPLY ? '적용' : '미리보기'));
  console.log('시트 대조: 빠진 것으로 보이는 바코드 ' + EXPECTED.length + '개 (포스터 제외, 이미 보인 8종 제외)');
  const token = process.env.GOOGLE_ACCESS_TOKEN || '';
  if (!token) {
    console.log('GOOGLE_ACCESS_TOKEN 이 없어 Firestore는 열지 않았습니다. 쓰기도 하지 않았습니다.');
    for (const [bc, name, qty] of EXPECTED) console.log('대조  ' + bc + '  ' + name + '  ' + qty);
    process.exit(APPLY ? 1 : 0);
  }
  const listed = [];
  let page = '';
  do {
    const q = await api(token, '/inbounds?pageSize=200' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
    for (const d of q.documents || []) listed.push(docOf(d));
    page = q.nextPageToken || '';
  } while (page);
  const ib = listed.filter(d => d.store === STORE && d.status === 'received')
    .sort((a, b) => String(b.receivedAt || b.at || '').localeCompare(String(a.receivedAt || a.at || '')))[0];
  if (!ib) throw new Error('수원 입고 확정 문서를 찾지 못했습니다.');
  const lines = linesOf(ib);
  console.log('문서 ' + ib.id + ' · ' + (ib.title || '') + ' · 바코드 ' + lines.length + '개');
  const products = [];
  page = '';
  do {
    const q = await api(token, '/products?pageSize=300' + (page ? '&pageToken=' + encodeURIComponent(page) : ''));
    for (const d of q.documents || []) products.push(docOf(d));
    page = q.nextPageToken || '';
  } while (page);
  const byBc = new Map();
  for (const p of products) { if (p.barcode) byBc.set(String(p.barcode), p); if (!byBc.has(p.id)) byBc.set(String(p.id), p); }
  const store = docOf(await api(token, '/stores/' + STORE));
  const stock = (store.q && typeof store.q === 'object') ? store.q : {};
  let skip = 0, retag = 0, add = 0;
  for (const l of lines) {
    const prod = byBc.get(l.bc) || null;
    const pid = prod ? prod.id : l.bc;
    const have = Number(stock[pid] || 0);
    const ipOk = prod && prod.ip === '진격의 거인';
    if (prod && have >= l.qty) {
      skip++;
      console.log((ipOk ? '재고 있음  ' : '재고 있음 · IP만 고침  ') + l.bc + '  ' + (prod.name || l.name) + '  전산 ' + have + ' / 실입고 ' + l.qty);
      if (APPLY && !ipOk) {
        await api(token, '/products/' + encodeURIComponent(prod.id) + '?updateMask.fieldPaths=ip', { method: 'PATCH', body: JSON.stringify({ fields: { ip: wrap('진격의 거인') } }) });
        retag++;
      } else if (!ipOk) retag++;
      continue;
    }
    add++;
    console.log('입고 필요  ' + l.bc + '  ' + l.name + '  더할 수량 ' + (l.qty - (prod ? have : 0)) + (prod ? '  (상품은 있음, 전산 ' + have + ')' : '  (새 상품)'));
    if (!APPLY) continue;
    if (!prod) {
      const product = { id: l.bc, barcode: l.bc, sku: '', name: l.name, ip: '진격의 거인', cat: '', price: null, kind: '상설', memo: '' };
      await api(token, '/products?documentId=' + encodeURIComponent(l.bc), { method: 'POST', body: JSON.stringify({ fields: wrap(product).mapValue.fields }) });
    } else if (!ipOk) {
      await api(token, '/products/' + encodeURIComponent(prod.id) + '?updateMask.fieldPaths=ip', { method: 'PATCH', body: JSON.stringify({ fields: { ip: wrap('진격의 거인') } }) });
    }
    const gap = l.qty - (prod ? have : 0);
    const moveId = 'fix' + l.bc.slice(-6);
    const move = { id: moveId, date: String(ib.receivedAt || '2026-11-13').slice(0, 10), store: STORE, type: '입고', pid, qty: gap, memo: (ib.title || '입고') + ' · 빠졌던 실입고 보완', by: '보완 스크립트', at: new Date().toISOString() };
    await api(token, '/stores/' + STORE + '/moves?documentId=' + moveId, { method: 'POST', body: JSON.stringify({ fields: wrap(move).mapValue.fields }) });
    await api(token, ':commit', { method: 'POST', body: JSON.stringify({ writes: [{ transform: { document: `projects/${PROJECT}/databases/(default)/documents/stores/${STORE}`, fieldTransforms: [{ fieldPath: 'q.`' + pid + '`', increment: { integerValue: String(gap) } }] } }] }) });
  }
  console.log('재고가 이미 찬 바코드 ' + skip + ' · IP만 고칠 바코드 ' + (APPLY ? retag : '(미리보기)') + ' · 입고가 필요한 바코드 ' + add);
  if (!APPLY) console.log('쓰기는 하지 않았습니다.');
}

main().catch(e => { console.error(e.message || e); process.exit(1); });
