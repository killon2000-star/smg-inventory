# 기기별 화면 검사 (미리보기 모드 · Firebase 차단): 가로 넘침·겹침·잘린 글자·터치 44px·같은 줄 버튼 높이·숫자 정렬·아래 메뉴 전부 보임
import sys,os,json
from playwright.sync_api import sync_playwright
sys.path.insert(0,os.path.dirname(__file__)); from align import check
B='http://127.0.0.1:18931/index.html'; OUT=sys.argv[1] if len(sys.argv)>1 else 'screenshots/dev/'
os.makedirs(OUT,exist_ok=True)
DEV=[('360x780',360,780,True),('390x844',390,844,True),('430x932',430,932,True),('768x1024',768,1024,True),('1024x1366',1024,1366,True),('1366x768',1366,768,False),('1440x900',1440,900,False),('1920x1080',1920,1080,False),('932x430',932,430,True)]
VIEWS=['home','ipnow','products','entry','count','inbound','transfer','records','files','sales','collab','settle','admin','more']
JS=r"""()=>{const vw=document.documentElement.clientWidth,vh=innerHeight,iss=[];const vis=e=>{const r=e.getBoundingClientRect();return e.offsetParent!==null&&r.width>0&&r.height>0};
 if(document.documentElement.scrollWidth>vw+1)iss.push({k:'가로 넘침',v:document.documentElement.scrollWidth-vw,el:[...document.querySelectorAll('#app *')].filter(e=>e.getBoundingClientRect().right>vw+1&&!e.closest('.tw,.ipstrip,.tl,.chips,.fquick,.fseg,.seg,.trend')).slice(0,3).map(e=>e.className||e.tagName)});
 const touch=matchMedia('(pointer:coarse)').matches;
 const ctl=[...document.querySelectorAll('#app button,#app select,#app input:not([type=checkbox]):not([type=radio]):not([type=file]),#app a[href]')].filter(vis).filter(e=>!e.closest('.tw table tbody'));
 if(touch){const sm=ctl.filter(e=>{const r=e.getBoundingClientRect();return r.height<43.5||r.width<43.5}).filter(e=>!e.closest('svg'));if(sm.length)iss.push({k:'터치 44px 미만',n:sm.length,s:sm.slice(0,5).map(e=>(e.id||e.className||e.tagName)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)+':'+(e.innerText||'').trim().slice(0,10))})}
 // 같은 줄 버튼 높이
 const rows={};document.querySelectorAll('#app .row,#app .ph .r,#app .tabgrid,#app .todos,#app .moregrid,#app .chips').forEach((c,ci)=>{const bs=[...c.children].filter(e=>e.tagName==='BUTTON'&&vis(e));const byTop={};bs.forEach(b=>{const t=Math.round(b.getBoundingClientRect().top);(byTop[t]||=[]).push(b.getBoundingClientRect().height)});for(const[t,h]of Object.entries(byTop)){if(h.length>1&&Math.max(...h)-Math.min(...h)>1)iss.push({k:'버튼 높이 다름',c:c.className,h})}});
 // 잘린 글자 (버튼·탭·타일 라벨)
 const cut=[...document.querySelectorAll('#app button span,#app .tile .lb,#app .tile .v,#app h1,#app h2')].filter(vis).filter(e=>e.scrollWidth>e.clientWidth+1&&getComputedStyle(e).overflow!=='visible');if(cut.length)iss.push({k:'잘린 글자',n:cut.length,s:cut.slice(0,4).map(e=>e.textContent.trim().slice(0,14))});
 // 아래 메뉴
 const bar=document.querySelector('.tabbar');if(bar&&vis(bar)){const r=bar.getBoundingClientRect();if(r.bottom>vh+1||r.top<vh*0.45)iss.push({k:'아래 메뉴 안 보임/너무 큼',top:Math.round(r.top),bottom:Math.round(r.bottom),vh});[...bar.querySelectorAll('button')].forEach(b=>{const s=b.querySelector('span');if(s&&s.scrollWidth>s.clientWidth+1)iss.push({k:'메뉴 글자 잘림',t:s.textContent})});
  const tst=document.querySelector('.toast');if(tst&&vis(tst)&&tst.getBoundingClientRect().bottom>r.top+1)iss.push({k:'토스트가 메뉴와 겹침'})}
 // 겹침: 헤더 버튼·타일끼리
 const tiles=[...document.querySelectorAll('#app .tile,#app .ph button,#app .todo')].filter(vis).map(e=>e.getBoundingClientRect());for(let i=0;i<tiles.length;i++)for(let j=i+1;j<tiles.length;j++){const a=tiles[i],b=tiles[j];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1){iss.push({k:'겹침',i,j});break}}
 const clk=document.querySelector('.kclock');if((vw<=760||innerHeight<=520)&&clk&&vis(clk))iss.push({k:'시계 보임'});
 const sd=document.querySelector('.side');if(sd&&vis(sd)){const k=document.querySelector('.kclock');const bs=[...sd.querySelectorAll('button')].filter(vis);if(k&&vis(k)){const kr=k.getBoundingClientRect();const hid=bs.filter(b=>{const r=b.getBoundingClientRect();return r.bottom>kr.top&&r.top<kr.bottom&&r.right>kr.left}).length;if(hid&&sd.scrollHeight<=sd.clientHeight)iss.push({k:'옆 메뉴가 시계에 가려짐',n:hid})}}
 return iss}"""
R={}
with sync_playwright() as p:
  br=p.chromium.launch()
  for name,W,H,mob in DEV:
    ctx=br.new_context(viewport={'width':W,'height':H},device_scale_factor=3 if W<500 else 2 if mob else 1,is_mobile=mob,has_touch=mob)
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.route('**/*',lambda r:r.abort() if any(k in r.request.url for k in ('firebase','googleapis','firestore')) else r.continue_())
    pg.goto(B); pg.wait_for_selector('#page',timeout=30000); pg.wait_for_timeout(700)
    assert pg.evaluate('SMGApp.S.mode')=='demo'
    pg.select_option('#roleSel',label='본부장 (유명훈)'); pg.wait_for_timeout(300)
    res={}
    for v in VIEWS:
      pg.evaluate(f"SMGApp.S.view='{v}';SMGApp.S.ui.drawer=null;SMGApp.render();scrollTo(0,0)"); pg.wait_for_timeout(300)
      iss=pg.evaluate(JS); al=[]
      check(pg,f'{name} {v}',lambda c,m: al.append(m) if not c else None,False)
      if al: iss.append({'k':'숫자 정렬','m':al})
      if iss: res[v]=iss
      if v in ('home','products','sales','transfer','collab'): pg.screenshot(path=f'{OUT}{name}_{v}.png')
    if errs: res['_pageerror']=errs
    R[name]=res; print(name,'PASS' if not res else 'FAIL '+json.dumps(res,ensure_ascii=False)[:1500]); ctx.close()
json.dump(R,open(OUT+'result.json','w'),ensure_ascii=False,indent=1)
