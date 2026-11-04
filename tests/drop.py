# 파일 끌어다 놓기: 모든 파일 버튼 칸이 드롭 영역인지 + 실사 칸에 CSV 놓으면 읽힘 + 형식 틀리면 안내
import sys
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:18931/index.html'; ENG=sys.argv[1] if len(sys.argv)>1 else 'chromium'; F=[]
def ok(c,m): print(('PASS ' if c else 'FAIL ')+m); c or F.append(m)
DROP="""([sel,name,type,body])=>{const z=document.querySelector(sel).closest('[data-fzone]');const dt=new DataTransfer();dt.items.add(new File([body],name,{type}));
for(const t of ['dragenter','dragover','drop'])z.dispatchEvent(new DragEvent(t,{bubbles:true,cancelable:true,dataTransfer:dt}));return z.dataset.fzone}"""
with sync_playwright() as p:
  br=getattr(p,ENG).launch(); pg=br.new_page(viewport={'width':1440,'height':900})
  pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ('firebase','firestore','identitytoolkit')) else r.continue_())
  pg.goto(B); pg.wait_for_selector('#page'); pg.wait_for_timeout(600)
  for v,ui,bid in [('count',{},'cntFile'),('inbound',{'ib':'new'},'ibPlanImg'),('inbound',{'ib':'new'},'ibPlanFile'),('settle',{},'posFileBtn')]:
    pg.evaluate("([v,ui])=>{const S=SMGApp.S;S.view=v;Object.assign(S.ui,ui);S.ui.drawer=null;SMGApp.render()}",[v,ui]); pg.wait_for_timeout(300)
    if pg.locator('#'+bid).count()==0: print('SKIP',bid,'(이 화면에 없음)'); continue
    ok(pg.evaluate(f"!!document.getElementById('{bid}').closest('[data-fzone]')"),f'{ENG} {bid} 드롭 영역')
  pg.evaluate("()=>{const S=SMGApp.S;S.view='count';S.ui.drawer=null;SMGApp.render()}"); pg.wait_for_timeout(300)
  pg.evaluate(DROP,['#cntFile','bad.txt','text/plain','x']); pg.wait_for_timeout(300)
  ok('형식' in pg.inner_text('body'),f'{ENG} 형식 틀린 파일 안내')
  pg.evaluate(DROP,['#cntFile','c.csv','text/csv','바코드,수량\n0000,1\n']); pg.wait_for_timeout(800)
  ok(bool(pg.evaluate("SMGApp.S.ui.cntMsg")),f'{ENG} 실사 칸에 CSV 놓으면 읽음')
  br.close()
sys.exit(1 if F else 0)
