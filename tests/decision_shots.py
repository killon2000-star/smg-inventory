import os
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:18931/index.html'; OUT='screenshots/decision'; os.makedirs(OUT,exist_ok=True); err=[]
CHK="""()=>{const r=[];const W=document.documentElement.clientWidth;if(document.documentElement.scrollWidth>W+1)r.push('hscroll '+document.documentElement.scrollWidth);document.querySelectorAll('.bizname,.inp,.tile,.chip,.srow').forEach(e=>{const b=e.getBoundingClientRect();if(b.width&&(b.right>W+1||b.left<-1))r.push('cut '+e.className+' '+e.textContent.slice(0,15))});if(innerWidth<500)document.querySelectorAll('#page table').forEach(t=>{const n=[...t.querySelectorAll('thead th')].filter(x=>x.offsetParent).length;if(n>2)r.push('table cols '+n)});return r}"""
with sync_playwright() as p:
  br=p.chromium.launch()
  for TH in ('light',):
   for W,H in ((1280,900),(390,844)):
    m=W<500
    ctx=br.new_context(viewport={'width':W,'height':H},device_scale_factor=2 if m else 1,is_mobile=m,has_touch=m)
    ctx.add_init_script(f"try{{localStorage.setItem('smg-theme','{TH}');localStorage.setItem('oninter-biz',JSON.stringify({{_cfg:{{offline:{{cr:55,labor:6000000,rent:4000000,goal:300000000}}}},onkihote:{{'2026-10-03':{{s:120000,p:3}},'2026-10-10':{{s:90000,p:2}}}},blog:{{'2026-09-01':{{s:500000,p:0}},'2026-10-01':{{s:500000,p:0,memo:'10월 대행료'}}}}}}))}}catch(e){{}}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:err.append(str(e)))
    pg.route('**/*',lambda r:r.abort() if ('firebase' in r.request.url or 'firestore' in r.request.url or 'identitytoolkit' in r.request.url) else r.continue_())
    pg.goto(B); pg.wait_for_selector('#page',timeout=30000); pg.wait_for_timeout(800)
    for v,f in (('home','all'),('biz','all'),('biz','offline'),('biz','onkihote'),('biz','kuji'),('biz','blog')):
      pg.evaluate("v=>{const S=SMGApp.S;S.view=v[0];S.ui.bizF=v[1];S.ui.drawer=null;S.ui.storeMenu=false;SMGApp.render();scrollTo(0,0)}",[v,f]); pg.wait_for_timeout(400)
      pg.screenshot(path=f'{OUT}/{v}_{f}_{W}x{H}_{TH}.png',full_page=True)
      print(TH,W,v,f,pg.evaluate(CHK))
    ctx.close()
print('errors',err)
