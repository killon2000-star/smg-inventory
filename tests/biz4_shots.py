import os
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:18931/index.html'; OUT='screenshots/biz4'; os.makedirs(OUT,exist_ok=True); err=[]
CHK="""()=>{const r=[];const W=document.documentElement.clientWidth;if(document.documentElement.scrollWidth>W+1)r.push('hscroll '+document.documentElement.scrollWidth);document.querySelectorAll('.bizname,.inp,.tile,.chip,.srow').forEach(e=>{const b=e.getBoundingClientRect();if(b.width&&(b.right>W+1||b.left<-1))r.push('cut '+e.className+' '+e.textContent.slice(0,15))});if(innerWidth<500)document.querySelectorAll('#page table').forEach(t=>{const n=[...t.querySelectorAll('thead th')].filter(x=>x.offsetParent).length;if(n>2)r.push('table cols '+n)});return r}"""
with sync_playwright() as p:
  br=p.chromium.launch()
  for TH in ('light','dark'):
   for W,H in ((1920,1080),(390,844)):
    m=W<500
    ctx=br.new_context(viewport={'width':W,'height':H},device_scale_factor=2 if m else 1,is_mobile=m,has_touch=m)
    ctx.add_init_script(f"try{{localStorage.setItem('smg-theme','{TH}');localStorage.setItem('oninter-biz',JSON.stringify({{blog:{{'2026-10-01':{{s:500000,p:0,memo:'10월 대행료'}}}}}}))}}catch(e){{}}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:err.append(str(e)))
    pg.route('**/*',lambda r:r.abort() if ('firebase' in r.request.url or 'firestore' in r.request.url or 'identitytoolkit' in r.request.url) else r.continue_())
    pg.goto(B); pg.wait_for_selector('#page',timeout=30000); pg.wait_for_timeout(800)
    for v in ('home','biz'):
      pg.evaluate("v=>{const S=SMGApp.S;S.view=v;S.ui.drawer=null;S.ui.storeMenu=false;SMGApp.render();scrollTo(0,0)}",v); pg.wait_for_timeout(400)
      pg.screenshot(path=f'{OUT}/{v}_{W}x{H}_{TH}.png',full_page=(v=='biz'))
      print(TH,W,v,pg.evaluate(CHK))
    pg.evaluate("()=>{SMGApp.S.view='home';SMGApp.S.ui.storeMenu=true;SMGApp.render()}"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/storemenu_{W}x{H}_{TH}.png'); print(TH,W,'menu',pg.evaluate(CHK))
    pg.click('[data-bizgo="blog"]'); pg.wait_for_timeout(300); pg.screenshot(path=f'{OUT}/biz_blog_{W}x{H}_{TH}.png',full_page=True); print(TH,W,'blog',pg.evaluate(CHK), pg.evaluate("SMGApp.S.view+' '+SMGApp.S.ui.bizF"))
    pg.evaluate("()=>{SMGApp.S.ui.storeMenu=true;SMGApp.render()}"); pg.click('[data-bizgo="offline"]'); pg.wait_for_timeout(300); print('offline->',pg.evaluate("SMGApp.S.view+' '+SMGApp.S.stores"))
    ctx.close()
print('errors',err)
