# 기기별 화면 검사 (미리보기 모드 · Firebase 차단): 가로 넘침·겹침·잘린 글자·터치 44px·같은 줄 버튼 높이·숫자 정렬·아래 메뉴 전부 보임
import sys,os,json
from playwright.sync_api import sync_playwright
sys.path.insert(0,os.path.dirname(__file__)); from align import check
B='http://127.0.0.1:18931/index.html'; OUT=sys.argv[1] if len(sys.argv)>1 else 'screenshots/dev/'
os.makedirs(OUT,exist_ok=True)
DEV0=[('360x780',360,780,True),('390x844',390,844,True),('430x932',430,932,True),('768x1024',768,1024,True),('1024x1366',1024,1366,True),('1366x768',1366,768,False),('1440x900',1440,900,False),('1920x1080',1920,1080,False),('932x430',932,430,True)]
DEV=[d for d in DEV0 if not os.environ.get('DEVONLY') or d[0] in os.environ['DEVONLY'].split(',')]
VIEWS=['home','ipnow','products','entry','count','inbound','transfer','records','files','sales','collab','settle','admin','more','ibnew','ipform','placeform','sales_week','sales_month','sales_year','sales_ip','admin_users','admin_stores','admin_products','home_drawer','cmp_drawer','product_drawer']
# 화면 이름 → 여는 방법 (입력 양식·서랍)
OPEN={'ibnew':"SMGApp.S.view='inbound';SMGApp.S.ui.ib='new';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'ipform':"SMGApp.S.view='ipnow';SMGApp.S.ui.drawer=null;SMGApp.render();document.querySelector('#ipAdd').click()",
 'sales_week':"SMGApp.S.view='sales';SMGApp.S.ui.salesUnit='week';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'sales_month':"SMGApp.S.view='sales';SMGApp.S.ui.salesUnit='month';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'sales_year':"SMGApp.S.view='sales';SMGApp.S.ui.salesUnit='year';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'sales_ip':"SMGApp.S.view='sales';SMGApp.S.ui.salesUnit='ip';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'admin_users':"SMGApp.S.view='admin';SMGApp.S.ui.adminTab='users';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'admin_stores':"SMGApp.S.view='admin';SMGApp.S.ui.adminTab='stores';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'admin_products':"SMGApp.S.view='admin';SMGApp.S.ui.adminTab='products';SMGApp.S.ui.drawer=null;SMGApp.render()",
 'home_drawer':"SMGApp.S.view='home';SMGApp.S.ui.drawer=null;SMGApp.S.ui.salesUnit='day';SMGApp.render();(document.querySelector('[data-hd=all]')||{click(){}}).click()",
 'cmp_drawer':"SMGApp.S.view='home';SMGApp.S.ui.drawer=null;SMGApp.render();(document.querySelector('[data-hday]')||document.querySelector('[data-cmp]')||{click(){}}).click()",
 'product_drawer':"SMGApp.S.view='products';SMGApp.S.ui.drawer=null;SMGApp.render();(document.querySelector('#app tbody tr[data-pid],#app [data-pid]')||{click(){}}).click()",
 'placeform':"SMGApp.S.view='entry';SMGApp.S.ui.drawer=null;SMGApp.render();(document.querySelector('#plNew')||{click(){}}).click()"}
# 입력칸·고르기·이름표 겹침 / 칸 안 글자 잘림
FORM=r"""()=>{const iss=[];const vis=e=>{const r=e.getBoundingClientRect();return e.offsetParent!==null&&r.width>0&&r.height>0};
 const root=document.querySelector('.dr')||document.querySelector('#app');
 const el=[...root.querySelectorAll('input:not([type=hidden]):not([type=file]),select,textarea,label,button')].filter(vis).filter(e=>!e.closest('.tabbar,.side,.tw table'));
 const R=el.map(e=>e.getBoundingClientRect());const nm=e=>(e.id||e.getAttribute('for')||e.getAttribute('aria-label')||e.tagName)+':'+(e.innerText||'').trim().slice(0,8);
 for(let i=0;i<el.length;i++)for(let j=i+1;j<el.length;j++){if(el[i].contains(el[j])||el[j].contains(el[i]))continue;const a=R[i],b=R[j];if(a.left<b.right-1&&b.left<a.right-1&&a.top<b.bottom-1&&b.top<a.bottom-1)iss.push({k:'입력칸 겹침',a:nm(el[i]),b:nm(el[j])})}
 const cv=document.createElement('canvas').getContext('2d');
 el.forEach(e=>{const cs=getComputedStyle(e);if(e.tagName==='SELECT'){const o=e.options[e.selectedIndex];if(!o)return;cv.font=cs.font;const w=cv.measureText(o.text).width,room=e.clientWidth-parseFloat(cs.paddingLeft)-parseFloat(cs.paddingRight)+2;if(w>room)iss.push({k:'고르기 칸 글자 잘림',a:nm(e),t:o.text,w:Math.round(w),room:Math.round(room)})}
  else if(e.tagName==='INPUT'&&e.value&&e.scrollWidth>e.clientWidth+1)iss.push({k:'입력칸 글자 잘림',a:nm(e)});
  else if(e.tagName==='LABEL'&&e.scrollWidth>e.clientWidth+1&&cs.overflow!=='visible')iss.push({k:'이름표 잘림',a:nm(e)});
  const pr=e.parentElement.closest('.field,.card,.dr');if(pr){const p=pr.getBoundingClientRect(),r=e.getBoundingClientRect();if(r.right>p.right+1&&!e.closest('.tw,.chips,.ipstrip'))iss.push({k:'칸이 상자 밖으로',a:nm(e),by:Math.round(r.right-p.right)})}});
 return iss.slice(0,12)}"""
# 날짜 표기: 2026.10.15(목) 하나로. 그래프 축(svg)은 'MM.DD' 허용
DATE=r"""()=>{const bad=[[/(?<![\d.\/])\d{1,2}\/\d{1,2}(?![\d\/])/,'월/일'],[/\b\d{4}-\d{2}-\d{2}\b/,'2026-10-15'],[/(?<![\d.])\d{1,2}\.\d{1,2}\s?\([일월화수목금토]\)/,'연도 없음'],[/(?<![\d.])\d{2}\.\d{2}\.\d{2}(?![\d.])/,'26.10.15'],[/\b\d{4}\.\d(?!\d)/,'월 한 자리'],[/\b\d{4}\.\d{2}\.\d(?!\d)/,'일 한 자리'],[/\d{1,2}월\s?\d{1,2}일/,'○월 ○일'],[/\b\d{4}\.\d{2}\.\d{2}(?![\d(])/,'요일 없음']];
 const out=[];const vis=e=>{if(!e)return false;const r=e.getBoundingClientRect();return e.offsetParent!==null&&r.width>0&&r.height>0||getComputedStyle(e).position==='fixed'};
 const roots=[document.querySelector('.dr')||document.querySelector('#app')];const tw=document.createTreeWalker(roots[0],NodeFilter.SHOW_TEXT);let n;
 const test=(t,where)=>{for(const[re,k]of bad){const m=t.match(re);if(m){out.push({k:'날짜 표기',why:k,t:m[0],in:where,ctx:t.trim().slice(0,40)});break}}};
 while(n=tw.nextNode()){const p=n.parentElement;if(!p||p.closest('svg,script,style,option,textarea,.tabbar')||!vis(p))continue;test(n.textContent,p.className||p.tagName)}
 roots[0].querySelectorAll('[title]').forEach(e=>test(e.getAttribute('title'),'title'));
 roots[0].querySelectorAll('svg title').forEach(e=>test(e.textContent,'tooltip'));
 roots[0].querySelectorAll('select[data-dsel] option').forEach(o=>{if(/^\d[월일]$/.test(o.text))out.push({k:'날짜 표기',why:'고르기 0 안 붙음',t:o.text})});
 const tst=document.querySelector('.toast');if(tst)test(tst.textContent,'toast');
 return out.slice(0,40)}"""
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
      pg.evaluate(OPEN.get(v,f"SMGApp.S.view='{v}';SMGApp.S.ui.ib=null;SMGApp.S.ui.drawer=null;SMGApp.render()")+";scrollTo(0,0)"); pg.wait_for_timeout(300)
      iss=pg.evaluate(JS)+pg.evaluate(FORM)+pg.evaluate(DATE); al=[]
      check(pg,f'{name} {v}',lambda c,m: al.append(m) if not c else None,False)
      if al: iss.append({'k':'숫자 정렬','m':al})
      if iss: res[v]=iss
      if v in ('home','products','sales','transfer','collab','ibnew','ipnow'): pg.screenshot(path=f'{OUT}{name}_{v}.png')
    if errs: res['_pageerror']=errs
    R[name]=res; print(name,'PASS' if not res else 'FAIL '+json.dumps(res,ensure_ascii=False)[:1500]); ctx.close()
json.dump(R,open(OUT+'result.json','w'),ensure_ascii=False,indent=1)
