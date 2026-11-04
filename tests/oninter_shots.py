# 온인터내셔널 리브랜딩 스크린샷 (미리보기 · Firebase 차단): 홈·사업부·로그인 × 화이트/블랙
import sys,os
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:18931/index.html'; OUT='screenshots/oninter'; os.makedirs(OUT,exist_ok=True); err=[]
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
    for v in ('home','biz'):
      pg.evaluate("v=>{const S=SMGApp.S;S.view=v;S.ui.drawer=null;SMGApp.render();scrollTo(0,0)}",v); pg.wait_for_timeout(400)
      pg.screenshot(path=f'{OUT}/{v}_{W}x{H}_{TH}.png')
    pg.evaluate("()=>{SMGApp.S.user=null;SMGApp.render()}"); pg.wait_for_timeout(300)
    pg.screenshot(path=f'{OUT}/login_{W}x{H}_{TH}.png')
    ctx.close()
print('errors',err)
