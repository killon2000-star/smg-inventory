/* SMG 재고관리 — Firebase 연결 (실제 앱에서만 불러옵니다) */
window.SMG_FIREBASE = function (S, X) {
  'use strict';
  const fb = window.firebase;
  fb.initializeApp(window.SMG_CONFIG);
  const auth = fb.auth(), db = fb.firestore();
  const inc = n => fb.firestore.FieldValue.increment(n);
  const ts = () => fb.firestore.FieldValue.serverTimestamp();
  const key = id => encodeURIComponent(String(id)).replace(/\./g, '%2E');   // 문서 이름에 쓸 수 없는 글자 바꾸기
  const unsub = [];
  const stopAll = () => { while (unsub.length) { try { unsub.pop()(); } catch (e) { } } };
  let first = true;

  function msg(html) { document.getElementById('app').innerHTML = `<div style="padding:16px"><div class="login"><div class="brand"><img src="logo-w.png" alt="SMG STORE"><b style="font-size:18px">SMG 재고관리</b></div>${html}</div></div>`; }

  async function signIn() {
    const p = new fb.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' });
    try { await auth.signInWithPopup(p); }
    catch (e) { if (/popup/i.test(e.code || '')) await auth.signInWithRedirect(p); else alert('로그인하지 못했습니다: ' + (e.message || e)); }
  }
  function signOut() { stopAll(); return auth.signOut(); }

  /* 로그인 상태가 바뀔 때 */
  function watchAuth() {
    auth.onAuthStateChanged(async u => {
      stopAll();
      if (!u) { S.user = null; S.ui.authUser = null; S.ui.applied = false; X.render(); return; }
      const ref = db.collection('users').doc(u.uid);
      const owner = u.email === X.OWNER_EMAIL;
      if (owner) {
        const snap = await ref.get();
        if (!snap.exists) await ref.set({ name: 'Anthony', email: u.email, company: '온인터내셔널', position: '대표', places: ['본사'], status: 'active', owner: true, perms: { stores: X.STORES.map(s => s.id), move: true, count: true, sales: true, approve: true }, createdAt: ts(), approvedAt: ts() });
      }
      // 내 계정 상태를 계속 지켜봄 → 퇴사·정지되면 바로 로그아웃
      unsub.push(ref.onSnapshot(async snap => {
        if (!snap.exists) { S.user = null; S.ui.authUser = { uid: u.uid, email: u.email }; S.ui.applied = false; X.render(); return; }
        const d = { uid: u.uid, ...snap.data() };
        if (d.status === 'pending') { S.user = null; S.ui.applied = true; X.render(); return; }
        if (d.status !== 'active') {
          stopAll(); await auth.signOut();
          msg(`<div class="card"><h2>🔺 사용할 수 없는 계정입니다</h2><p style="margin:0">${d.status === 'resigned' ? '퇴사 처리된 계정입니다.' : '일시 정지된 계정입니다. 관리자에게 문의해 주세요.'}</p></div>`);
          return;
        }
        const wasNull = !S.user; S.user = d;
        if (wasNull) { X.setUser(d); await loadAll(); }
        X.render();
      }, () => { }));
    });
  }

  /* 자료 불러오기 + 실시간 반영 */
  async function loadAll() {
    const mine = S.user.owner ? X.STORES.map(s => s.id) : S.user.perms.stores;
    const cfg = await db.collection('config').doc('app').get().catch(() => null);
    if (cfg && cfg.exists && cfg.data().stores) cfg.data().stores.forEach(s => { if (!X.STORES.find(x => x.id === s.id)) X.STORES.push(s); });   // 코드 목록 + 관리 화면에서 추가한 매장
    unsub.push(db.collection('config').doc('app').onSnapshot(d => { const x = d.exists ? d.data() : {}; if (x.ipPlan) { S.ipPlan = x.ipPlan; S.ipPlanAt = x.ipPlanAt || ''; } X.render(); }, () => { }));
    unsub.push(db.collection('products').onSnapshot(q => { S.products = q.docs.map(d => d.data()); X.indexProducts(); X.render(); }));
    for (const st of mine) {
      unsub.push(db.collection('stores').doc(st).onSnapshot(d => { S.stock[st] = (d.exists && d.data().q) || {}; X.render(); }, () => { }));
      if (!S.user.limited) {
        unsub.push(db.collection('stores').doc(st).collection('moves').orderBy('at', 'desc').limit(1500).onSnapshot(q => {
          S.moves = S.moves.filter(m => m.store !== st).concat(q.docs.map(d => d.data())).sort((a, b) => (a.at > b.at ? 1 : -1)); X.render();
        }, () => { }));
        unsub.push(db.collection('transfers').where('to', '==', st).onSnapshot(q => mergeTransfers(q), () => { }));
        unsub.push(db.collection('transfers').where('from', '==', st).onSnapshot(q => mergeTransfers(q), () => { }));
      }
      if (S.user.perms.sales || S.user.owner) {
        unsub.push(db.collection('stores').doc(st).collection('sales').onSnapshot(q => { S.sales[st] = {}; q.docs.forEach(d => S.sales[st][d.id] = d.data()); X.render(); }, () => { }));
      }
    }
    if (!S.user.limited) for (const st of mine) unsub.push(db.collection('inbounds').where('store', '==', st).onSnapshot(q => { S.inbounds = S.inbounds.filter(x => x.store !== st).concat(q.docs.map(d => d.data())); X.render(); }, () => { }));
    if (!S.user.limited) unsub.push(db.collection('places').onSnapshot(q => { S.places = q.docs.map(d => d.data()); X.render(); }, () => { }));
    if (!S.user.limited) unsub.push(db.collection('warehouse').doc('main').onSnapshot(d => { S.warehouse = (d.exists && d.data().q) || {}; }, () => { }));
    if (S.user.perms.sales || S.user.perms.approve || S.user.owner) {
      const z = await db.collection('config').doc('zip').get().catch(() => null); S.zipPw = (z && z.exists && z.data().pw) || {};
    }
    if (S.user.perms.approve || S.user.owner) unsub.push(db.collection('users').onSnapshot(q => { S.users = q.docs.map(d => ({ uid: d.id, ...d.data() })); X.render(); }));
    else S.users = [S.user];
    if (S.user.owner || (S.user.perms.settle && !S.user.limited)) unsub.push(db.collection('settle').onSnapshot(q => { S.settle = q.docs.filter(d => d.id !== '_rules').flatMap(d => d.data().rows || []); const r = q.docs.find(d => d.id === '_rules'); S.settleRules = r ? r.data() : null; X.render(); }, () => { }));
  }
  function mergeTransfers(q) {
    const m = new Map(S.transfers.map(t => [t.id, t])); q.docs.forEach(d => m.set(d.id, { id: d.id, ...d.data() }));
    S.transfers = [...m.values()]; X.render();
  }

  /* 저장 */
  const backend = {
    async saveMoves(list) {
      for (let i = 0; i < list.length; i += 150) {
        const b = db.batch();
        for (const m of list.slice(i, i + 150)) {
          b.set(db.collection('stores').doc(m.store).collection('moves').doc(m.id), { ...m, uid: S.user.uid });
          b.set(db.collection('stores').doc(m.store), { q: { [m.pid]: inc(m.qty) } }, { merge: true });
          if (m.type === '창고 보관' || m.type === '창고에서 가져옴') b.set(db.collection('warehouse').doc('main'), { q: { [m.pid]: inc(-m.qty) } }, { merge: true });
          if (m.place) b.set(db.collection('places').doc(m.place), { q: { [m.pid]: inc(-m.qty) } }, { merge: true });
          if (m.type === '매장 이동' && !m.place) {
            const to = (m.memo.match(/→ ([^·]+)/) || [])[1]; const toId = (X.STORES.find(s => s.name === (to || '').trim()) || {}).id;
            if (toId) b.set(db.collection('transfers').doc(m.id), { pid: m.pid, qty: -m.qty, from: m.store, to: toId, date: m.date, by: m.by, status: 'sent', at: m.at });
          }
          if (m.type === '매장 이동(받음)' && m.tid) b.update(db.collection('transfers').doc(m.tid), { status: 'received', recvDate: m.date, recvBy: m.by });
        }
        await b.commit();
      }
      return true;
    },
    async saveSalesDay(st, date, rec) {
      await db.collection('stores').doc(st).collection('sales').doc(date.slice(0, 7)).set({ days: { [date.slice(8)]: rec } }, { merge: true });
      return true;
    },
    async saveUser(u) {
      const { uid, ...d } = u; delete d.sample;
      await db.collection('users').doc(uid).set({ ...d, updatedAt: ts(), updatedBy: S.user.name }, { merge: true });
      return true;
    },
    async saveInbound(ib) { await db.collection('inbounds').doc(ib.id).set(JSON.parse(JSON.stringify(ib))); },
    async saveSettleRules(r) { await db.collection('settle').doc('_rules').set(r); },
    async savePlace(p) { await db.collection('places').doc(p.id).set(p); },
    async saveStoreOrder(order) { await db.collection('users').doc(S.user.uid).update({ storeOrder: order }); },
    async deleteUser(uid) { await db.collection('users').doc(uid).delete(); },
    async saveIpPlan(list, at) { await db.collection('config').doc('app').set({ ipPlan: list, ipPlanAt: at }, { merge: true }); },
    async saveZip(pw) { await db.collection('config').doc('zip').set({ pw }, { merge: true }); },
    async saveProduct(p) { await db.collection('products').doc(key(p.id)).set(p, { merge: true }); },
    async apply(f) {
      const u = auth.currentUser;
      await db.collection('users').doc(u.uid).set({ name: f.name, email: u.email, company: f.company, companyOther: f.other || '', places: f.places, position: f.position, phone: f.phone || '', memo: f.memo || '', status: 'pending', perms: null, createdAt: ts() });
    },
    /* 대표 전용: 매출·정산 자료만 다시 넣기 (한 달씩, 이미 올린 날짜는 그대로 둠) */
    async reseedSales(data, progress) {
      if (!S.user.owner) throw new Error('대표 계정만 할 수 있습니다');
      const ok = [], fail = []; const jobs = [];
      for (const [st, months] of Object.entries(data.sales || {})) for (const [ym, v] of Object.entries(months)) jobs.push(['sales', st + ' ' + ym, db.doc(`stores/${st}/sales/${ym}`), v, true]);
      const byM = {}; for (const r of (data.settle || [])) (byM[r.month] ||= []).push(r);
      for (const [m, rows] of Object.entries(byM)) jobs.push(['settle', '정산 ' + m, db.doc('settle/' + m), { rows }, false]);
      if (data.settleRules) jobs.push(['rules', '정산 요율', db.doc('settle/_rules'), data.settleRules, false]);
      let i = 0;
      for (const [kind, label, ref, v, merge] of jobs) {
        try { await ref.set(v, merge ? { merge: true } : {}); ok.push(label); }
        catch (e) { fail.push(label + ' — ' + (e.code || '') + ' ' + (e.message || e)); }
        progress && progress(++i, jobs.length);
      }
      return { ok, fail };
    },
    /* 대표 전용: 처음 한 번 수원 자료 넣기 */
    async seed(data, progress) {
      if (!S.user.owner) throw new Error('대표 계정만 할 수 있습니다');
      const jobs = [];
      jobs.push(['config/app', { stores: X.STORES.map(s => ({ id: s.id, name: s.name })) }]);
      for (const p of data.products) jobs.push(['products/' + key(p.id), p]);
      for (const [st, q] of Object.entries(data.stock)) jobs.push(['stores/' + st, { q, name: (X.STORES.find(s => s.id === st) || {}).name || st }]);
      for (const m of data.moves) jobs.push([`stores/${m.store}/moves/${m.id}`, m]);
      for (const [st, months] of Object.entries(data.sales)) for (const [ym, v] of Object.entries(months)) jobs.push([`stores/${st}/sales/${ym}`, v]);
      const byM = {}; for (const r of data.settle) (byM[r.month] ||= []).push(r);
      for (const [m, rows] of Object.entries(byM)) jobs.push(['settle/' + m, { rows }]);
      jobs.push(['config/zip', { pw: { suwon: '0000' } }]);
      for (let i = 0; i < jobs.length; i += 300) {
        const b = db.batch(); for (const [path, d] of jobs.slice(i, i + 300)) b.set(db.doc(path), d, path === 'config/app' ? { merge: true } : undefined);
        await b.commit(); progress && progress(Math.min(i + 300, jobs.length), jobs.length);
      }
      return jobs.length;
    },
  };

  return {
    backend, signIn, signOut,
    async start() {
      S.users = []; S.transfers = []; S.moves = []; S.products = []; S.stock = {}; S.sales = {}; S.settle = [];
      await auth.getRedirectResult().catch(() => { });
      watchAuth();
    },
  };
};
