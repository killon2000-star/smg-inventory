# 입고 예정 등록 → [사진·캡처로 올리기] → 미리보기 줄을 정답과 비교 (미리보기 모드: AI 막힘 → 기기 안 글자 읽기)
import json,sys,os,re
from playwright.sync_api import sync_playwright
D=os.path.dirname(os.path.abspath(__file__)); T=json.load(open(D+'/truth.json'))
B='http://127.0.0.1:18931/index.html'
nz=lambda s:re.sub(r'\s','',s or '')
def score(rows):
    ok=dict(name=0,barcode=0,qty=0)
    for t in T:
        m=next((r for r in rows if nz(r['name'])==nz(t['name']) or (r.get('bc') and r['bc']==t['barcode'])),None) or next((r for r in rows if r.get('qty')==t['qty']),None)
        if not m: continue
        ok['name']+=nz(m['name'])==nz(t['name']); ok['barcode']+=(m.get('bc') or '')==t['barcode']; ok['qty']+=m.get('qty')==t['qty']
    return ok
with sync_playwright() as p:
    b=p.chromium.launch(); res={}
    for f in sys.argv[1:] or ['s1_table.png','s2_photo.jpg','s3_kakao.png']:
        pg=b.new_page(viewport={'width':1366,'height':900})
        pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ('firebase','googleapis','firestore')) else r.continue_())
        pg.goto(B); pg.wait_for_selector('#page',timeout=30000)
        pg.evaluate("SMGApp.S.view='inbound';SMGApp.S.ui.ib='new';SMGApp.render()")
        with pg.expect_file_chooser() as fc: pg.click('#ibPlanImg')
        fc.value.set_files(D+'/'+f)
        pg.wait_for_function("SMGApp.S.ui.ibForm && !SMGApp.S.ui.ibForm.busy && (SMGApp.S.ui.ibForm.parsed||SMGApp.S.ui.ibForm.err)",timeout=240000)
        rows=pg.evaluate("(SMGApp.S.ui.ibForm.parsed||[]).map(r=>({name:r.name,bc:r.bc,qty:r.qty}))"); err=pg.evaluate("SMGApp.S.ui.ibForm.err"); print("date",pg.evaluate("SMGApp.S.ui.ibForm.date"))
        pg.screenshot(path=f'screenshots/img/{f.split(".")[0]}_preview.png',full_page=True)
        res[f]={'rows':rows,'err':err,'score':score(rows),'of':len(T)}; print(f,json.dumps(res[f],ensure_ascii=False))
    json.dump(res,open(D+'/result.json','w'),ensure_ascii=False,indent=1)
