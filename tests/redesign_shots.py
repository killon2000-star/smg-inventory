# 리디자인 전/후 스크린샷 (미리보기 모드 · Firebase 차단)
import sys,os
from playwright.sync_api import sync_playwright
B='http://127.0.0.1:18931/index.html'; OUT=sys.argv[1]; os.makedirs(OUT,exist_ok=True)
THEME=os.environ.get('THEME','light')
V=['home','products','entry','inbound','sales','count']
with sync_playwright() as p:
  br=p.chromium.launch()
  for W,H in ((1920,1080),(390,844)):
    m=W<500
    ctx=br.new_context(viewport={'width':W,'height':H},device_scale_factor=2 if m else 1,is_mobile=m,has_touch=m,color_scheme='dark' if THEME=='dark' else 'light')
    ctx.add_init_script(f"try{{localStorage.setItem('smg-theme','{THEME}')}}catch(e){{}}")
    pg=ctx.new_page()
    pg.route('**/*',lambda r:r.abort() if ('firebase' in r.request.url or 'firestore' in r.request.url or 'identitytoolkit' in r.request.url) else r.continue_())
    pg.goto(B); pg.wait_for_selector('#page',timeout=30000); pg.wait_for_timeout(800)
    for v in V:
      pg.evaluate("v=>{const S=SMGApp.S;S.view=v;S.ui.drawer=null;SMGApp.render();scrollTo(0,0)}",v); pg.wait_for_timeout(400)
      pg.screenshot(path=f'{OUT}/{v}_{W}x{H}{"" if THEME=="light" else "_dark"}.png')
    ctx.close()
