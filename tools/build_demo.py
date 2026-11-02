# 미리보기용 demo-data.json 생성 (수원 실제 토스포스 자료 + 상품 마스터 + 에바 입고표) — 로컬 테스트 전용, 저장소에 올리지 않음
import openpyxl,glob,collections,json,csv,warnings;warnings.filterwarnings('ignore')
SS='/workspace/smg-sales/'
P=list(csv.DictReader(open(SS+'product_master.csv',encoding='utf-8-sig')))
prods=[dict(id=r['sku'],sku=r['sku'],barcode=r['barcode'],name=r['name'],ip=r['category'],price=int(float(r['price'] or 0)),safety=int(r['safety_stock'] or 0)) for r in P]
byname={p['name']:p for p in prods}
rows=collections.Counter(); pays=collections.Counter()
for f in sorted(glob.glob(SS+'dec/*.xlsx')):
  wb=openpyxl.load_workbook(f,read_only=True)
  ws=wb['상품 주문 상세내역'];ws.reset_dimensions();it=ws.iter_rows(values_only=True);next(it);next(it)
  c=collections.Counter(tuple(r[:17]) for r in it if r and r[0])
  for k,v in c.items(): rows[k]=max(rows[k],v)
  ws=wb['결제 상세내역'];ws.reset_dimensions();it=ws.iter_rows(values_only=True);next(it);next(it)
  c=collections.Counter(tuple(r[:10]) for r in it if r and r[0])
  for k,v in c.items(): pays[k]=max(pays[k],v)
days=collections.defaultdict(lambda:dict(s=0,p=0,q=0,ip={},pr={}))
for k,n in pays.items():
  d=str(k[0])[:10]; amt=(k[5] or 0)*n; cnt=(k[4] or 0)*n
  if k[9]!='승인': continue
  days[d]['s']+=amt; days[d]['p']+=cnt
sold=collections.defaultdict(collections.Counter)  # pid -> date -> q
for k,n in rows.items():
  d=str(k[0])[:10]; nm=str(k[5]).strip(); ip=str(k[7] or '미분류').strip(); q=(k[11] or 0)*n; a=(k[16] or 0)*n
  o=days[d]; o['q']+=q; x=o['ip'].setdefault(ip,[0,0]); x[0]+=q; x[1]+=a; y=o['pr'].setdefault(nm,[0,0,ip]); y[0]+=q; y[1]+=a
  p=byname.get(nm)
  if p: sold[p['id']][d]+=q
# 결제 합계 = 상품 합계로 맞춤(앱 검사와 같게)
for d,o in days.items(): o['s']=sum(v[1] for v in o['pr'].values()); o['ip']={k:[v[0],round(v[1])] for k,v in o['ip'].items()}; o['pr']={k:[v[0],round(v[1]),v[2]] for k,v in o['pr'].items()}; o['s']=round(o['s'])
sales={}
for d,o in sorted(days.items()): sales.setdefault(d[:7],{'days':{}})['days'][d[8:]]=o
# 재고 이동
moves=[];stock={};mid=0
def mv(date,pid,typ,qty,memo,by='데모'):
  global mid; mid+=1; moves.append(dict(id='m%d'%mid,date=date,store='suwon',type=typ,pid=pid,qty=qty,memo=memo,by=by,co='SMG STORE_수원',at=date+'T09:00:00.000Z')); stock[pid]=stock.get(pid,0)+qty
eva={r['sku']:r for r in csv.DictReader(open('/workspace/smg-inventory-firebase/reports/eva_stock_20261028.csv',encoding='utf-8-sig'))}
for sku,r in eva.items():
  mv('2026-10-06',sku,'입고',int(r['입고']),'에바 입고 (eva_in.xlsx)','유명훈')
for pid,dd in sold.items():
  if pid in eva:
    for d,q in sorted(dd.items()):
      if '2026-10-06'<=d<='2026-10-28' and q: mv(d,pid,'판매',-q,'POS 판매','자동(POS)')
    continue
  tot=sum(dd.values()); first=min(dd)
  mv(first,pid,'입고',tot+max(3,tot//5),'초기 입고(데모 추정)')
  bym=collections.Counter()
  for d,q in dd.items(): bym[d[:7]]+=q
  for m,q in sorted(bym.items()):
    last=max(d for d in dd if d.startswith(m))
    if q: mv(last,pid,'판매',-q,'POS 판매(월 합계)','자동(POS)')
# 기타 내역 예시(에바): 파손 폐기 2, 매장 이동은 없음 → 기대 숫자 유지 위해 폐기 없이 0개짜리 대신 다른 IP에 예시
mv('2026-10-20','SMG-00001','폐기',-1,'파손') if 'SMG-00001' in stock else None
json.dump(dict(asof='2026-10-28',products=prods,stock={'suwon':stock},moves=moves,incoming=[],sales={'suwon':sales},settle=[],settleRules=None),open('/workspace/smg-inventory-v2/demo-data.json','w'),ensure_ascii=False)
E9=[s for s in eva]; print('eva in',sum(int(eva[s]['입고']) for s in eva),'sold',-sum(m['qty'] for m in moves if m['pid'] in eva and m['type']=='판매'),'stock',sum(stock[s] for s in eva),'days',len(days),'moves',len(moves))
