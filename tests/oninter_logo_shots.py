# 온인터내셔널 리브랜딩 스크린샷 (미리보기 · Firebase 차단): 홈·사업부·로그인 × 화이트/블랙
import sys,os
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:18931/index.html'; OUT='screenshots/oninter_logo'; os.makedirs(OUT,exist_ok=True); err=[]
with sync_playwright() as p:
  br=p.chromium.launch()
  for TH in ('light','dark'):
   for W,H in ((1920,1080),(390,844)):
    m=W<500
    ctx=br.new_context(viewport={'width':W,'height':H},device_scale_factor=2 if m else 1,is_mobile=m,has_touch=m)
    ctx.add_init_script(f"try{{localStorage.setItem('smg-theme','{TH}')}}catch(e){{}}")
    pg=ctx.new_page(); pg.on('pageerror',lambda e:err.append(str(e)))
    pg.route('**/*',lambda r:r.abort() if ('firebase' in r.request.url or 'firestore' in r.request.url or 'identitytoolkit' in r.request.url) else r.continue_())
    pg.goto(B); pg.wait_for_selector('#page',timeout=30000); pg.wait_for_timeout(800)
    for v in ('home',):
      pg.evaluate("v=>{const S=SMGApp.S;S.view=v;S.ui.drawer=null;SMGApp.render();scrollTo(0,0)}",v); pg.wait_for_timeout(400)
      pg.screenshot(path=f'{OUT}/{v}_{W}x{H}_{TH}.png')
      ov=pg.evaluate("""()=>{const r=[];const W=document.documentElement.clientWidth;if(document.documentElement.scrollWidth>W+1)r.push('hscroll '+document.documentElement.scrollWidth);document.querySelectorAll('.logo-btn img,.logo-btn .wm,.login .brand img,.login .brand .wm,.top > *').forEach(e=>{const b=e.getBoundingClientRect();if(b.width&&(b.right>W+1||b.left<-1))r.push('cut '+e.className);if(e.scrollWidth>e.clientWidth+1&&e.matches('.wm'))r.push('clip '+e.className)});const l=document.querySelector('.logo-btn img'),w=document.querySelector('.logo-btn .wm'),s=document.querySelector('.store-btn');if(l&&w){const a=l.getBoundingClientRect(),b=w.getBoundingClientRect();if(a.right>b.left+0.5)r.push('logo/wm overlap');if(s){const c=s.getBoundingClientRect();if(b.right>c.left+0.5&&b.top<c.bottom&&c.top<b.bottom)r.push('wm/store overlap')}}return r}""")
      print(TH,W,v,ov)
    pg.evaluate("()=>{SMGApp.S.user=null;SMGApp.render()}"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/login_{W}x{H}_{TH}.png')
    ov=pg.evaluate("""()=>{const r=[];const W=document.documentElement.clientWidth;if(document.documentElement.scrollWidth>W+1)r.push('hscroll '+document.documentElement.scrollWidth);document.querySelectorAll('.logo-btn img,.logo-btn .wm,.login .brand img,.login .brand .wm,.top > *').forEach(e=>{const b=e.getBoundingClientRect();if(b.width&&(b.right>W+1||b.left<-1))r.push('cut '+e.className);if(e.scrollWidth>e.clientWidth+1&&e.matches('.wm'))r.push('clip '+e.className)});const l=document.querySelector('.logo-btn img'),w=document.querySelector('.logo-btn .wm'),s=document.querySelector('.store-btn');if(l&&w){const a=l.getBoundingClientRect(),b=w.getBoundingClientRect();if(a.right>b.left+0.5)r.push('logo/wm overlap');if(s){const c=s.getBoundingClientRect();if(b.right>c.left+0.5&&b.top<c.bottom&&c.top<b.bottom)r.push('wm/store overlap')}}return r}""")
    print(TH,W,'login',ov)
    ctx.close()
print('errors',err)
