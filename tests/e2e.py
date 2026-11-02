# 미리보기(demo) 모드 E2E — Firebase 스크립트는 막아서 실제 Firestore에 절대 연결하지 않음
import sys,os,json,time
from playwright.sync_api import sync_playwright
sys.path.insert(0,os.path.dirname(__file__)); from align import check, contrast, controls
B='http://127.0.0.1:18931/index.html'; SH='screenshots/'; FX='/workspace/smg-inventory-firebase/tests/fixtures/'
FAILS=[]; RES=[]
def ok(c,m): RES.append(('PASS' if c else 'FAIL')+' '+m); print(RES[-1]); c or FAILS.append(m)
def soft(c,m): RES.append(('PASS' if c else 'WARN')+' '+m); print(RES[-1])
ENG=sys.argv[1] if len(sys.argv)>1 else 'chromium'
def go(pg,v,**ui):
  pg.evaluate("([v,ui])=>{const S=SMGApp.S;S.view=v;Object.assign(S.ui,ui);S.ui.drawer=null;SMGApp.render();scrollTo(0,0)}",[v,ui]); pg.wait_for_timeout(250)
with sync_playwright() as p:
  br=getattr(p,ENG).launch()
  for W,H in ((430,932),(1440,900)):
    ctx=br.new_context(viewport={'width':W,'height':H},device_scale_factor=2 if W<500 else 1, **({'is_mobile':True,'has_touch':True} if W<500 and ENG!='firefox' else {}))
    pg=ctx.new_page(); errs=[]; pg.on('pageerror',lambda e:errs.append(str(e)))
    blocked=[]
    pg.route('**/*', lambda r: (blocked.append(r.request.url), r.abort()) if ('firebase' in r.request.url or 'googleapis.com/identitytoolkit' in r.request.url or 'firestore' in r.request.url) else r.continue_())
    pg.goto(B); pg.wait_for_selector('#page',timeout=30000); pg.wait_for_timeout(800)
    tag=f'{ENG}_{W}'
    ok(pg.evaluate('SMGApp.S.mode')=='demo',f'{tag} 미리보기 모드 (Firebase 차단 {len(blocked)}건)')
    # ── 콜라보 분석: 에반게리온
    go(pg,'collab'); pg.wait_for_selector('#cbTot')
    T=pg.eval_on_selector('#cbTot','e=>({...e.dataset})'); print(T)
    ok((T['in'],T['sold'],T['now'])==('5800','1972','3828'),f'{tag} 에바 콜라보 입고 5,800 / 판매 1,972 / 현재고 3,828 → {T}')
    txt=pg.inner_text('#page'); ok('입고된 상품 판매' in txt and '입고 없는 상품 판매' in txt and '기타 내역' in txt and '콜라보 vs 상설' in txt and 'IP별 매출 순위' in txt,f'{tag} 콜라보 화면 구성 (입고/미입고 판매, 기타 내역, 상품별, 콜라보vs상설, IP 순위)')
    pg.screenshot(path=SH+f'{tag}_collab_eva.png',full_page=True)
    check(pg,f'{tag} 콜라보',ok); contrast(pg,f'{tag} 콜라보',soft)
    # 하이큐 쉬는시간(콜라보) vs 하이큐 10주년(상설)
    hid=pg.evaluate("SMGApp.S.ui.cb && [...document.querySelectorAll('#cbPlan option')].find(o=>o.textContent.includes('쉬는시간')).value")
    pg.select_option('#cbPlan',hid); pg.wait_for_timeout(300)
    rk=pg.inner_text('#page'); import re
    m1=re.search(r'하이큐 쉬는시간\s*콜라보',rk); m2=re.search(r'하이큐 10주년\s*상설',rk)
    ok(bool(m1 and m2),f'{tag} 하이큐 쉬는시간=콜라보, 하이큐 10주년=상설 구분')
    pg.screenshot(path=SH+f'{tag}_collab_haikyu.png',full_page=True)
    # 날짜 고르기 (년/월/일 select, iPhone 안전)
    pg.select_option('select[data-dsel="cba:d"]','20'); pg.wait_for_timeout(200)
    ok(pg.evaluate("SMGApp.S.ui.cb.a").endswith('-20'),f'{tag} 기간 시작일 select 변경 반영')
    # ── 기간별 매출
    go(pg,'sales',salesUnit='day',range=None)
    for t in ['이번달','지난달','이번주','오늘']:
      b=pg.locator('.fquick button',has_text=t).first; b.click(); pg.wait_for_timeout(250)
      ok('on' in (pg.locator('.fquick button',has_text=t).first.get_attribute('class') or ''),f'{tag} 빠른 선택 [{t}] 동작')
    pg.locator('.fquick button',has_text='지난달').first.click(); pg.wait_for_timeout(300)
    ok(pg.locator('.grand .g-v').count()==1,f'{tag} 총매출 카드')
    nl=pg.locator('svg.lc .xl:not(.xs)').count(); nd=pg.locator('svg.lc .xl.xs').count(); npts=pg.locator('svg.lc .chit').count()
    ok(nl>=8 and nd==nl and npts>=28,f'{tag} 일별 그래프 날짜 라벨 {nl}개·요일 {nd}개·점 {npts}개')
    pg.locator('svg.lc .chit').nth(5).click(); pg.wait_for_timeout(150)
    tip=pg.inner_text('.ctip'); ok('원' in tip and '건' in tip and '(' in tip,f'{tag} 그래프 점 누르면 말풍선: {tip}')
    pg.screenshot(path=SH+f'{tag}_sales_day.png',full_page=True)
    check(pg,f'{tag} 매출 일별',ok,need_slots=False)
    for u in ('week','month'):
      pg.locator(f'[data-su={u}]').click(); pg.wait_for_timeout(300); pg.screenshot(path=SH+f'{tag}_sales_{u}.png',full_page=True)
      ok(pg.locator('svg.lc .xl').count()>=4,f'{tag} {u} 그래프 라벨')
    # 여러 매장
    pg.evaluate("SMGApp.S.stores=['suwon','boxcafe'];SMGApp.render()"); pg.wait_for_timeout(300)
    ok(pg.locator('[data-sum]').count()==2,f'{tag} 여러 매장 선택 시 합산 체크박스'); pg.screenshot(path=SH+f'{tag}_sales_multi.png',full_page=True)
    pg.evaluate("SMGApp.S.stores=['suwon'];SMGApp.render()")
    # 비교 서랍 그래프
    pg.locator('[data-su=day]').click(); pg.locator('.fquick button',has_text='최근 14일').click(); pg.wait_for_timeout(200); pg.locator('[data-cmp=s]').click(); pg.wait_for_timeout(400)
    ok(pg.locator('svg.lc .xl.xs').count()>=7,f'{tag} 비교 그래프 요일 라벨'); pg.screenshot(path=SH+f'{tag}_sales_compare.png',full_page=True)
    # ── 파일 자동 매핑
    def upload(f):
      go(pg,'entry'); pg.locator('[data-em=file]').click(); pg.wait_for_timeout(150)
      with pg.expect_file_chooser() as fc: pg.click('#fileBtn')
      fc.value.set_files(f); pg.wait_for_timeout(1200); return pg.inner_text('#page')
    t=upload('/workspace/smg-sales/eva_in.xlsx')
    ok('찾은 줄 37개' in t.replace('\n',' ').replace('  ',' ') or '상품을 찾은 줄 37' in t,f'{tag} 에바 입고표(양식 없음): 37줄 매칭')
    s=pg.evaluate("(()=>{const im=SMGApp.S.ui.imp;return im&&im.rows?im.rows.filter(r=>r.pid).reduce((a,b)=>a+b.qty,0):-1})()")
    ok(s==5800,f'{tag} 에바 입고표 수량 합계 5,800 (수원점 입고 수량 열) → {s}')
    pg.screenshot(path=SH+f'{tag}_import_eva.png',full_page=True)
    t=upload(FX+'messy_md_inbound.xlsx'); hd=pg.evaluate("SMGApp.S.ui.imp.det && [SMGApp.S.ui.imp.det.a,SMGApp.S.ui.imp.det.r]")
    ok(hd and hd[1]>hd[0],f'{tag} MD 내역서 여러 줄 머리글 감지 {hd}'); pg.screenshot(path=SH+f'{tag}_import_multirow.png',full_page=True)
    t=upload(FX+'unknown_layout.xlsx'); ok(pg.evaluate("SMGApp.S.ui.imp.det.how")=='auto' and pg.locator('[data-mapf]').count()>=5,f'{tag} 처음 보는 양식(물건/갯수) → 동의어로 자동 매핑 + 열 바꾸기 패널')
    pg.screenshot(path=SH+f'{tag}_import_mapping.png',full_page=True); controls(pg,f'{tag} 열 맞추기',ok)
    opt=lambda f,lab: pg.select_option(f'select[data-mapf={f}]',value=pg.evaluate(f"[...document.querySelectorAll('select[data-mapf={f}] option')].find(o=>o.textContent.includes('{lab}')).value"))
    opt('name','물건'); opt('qty','갯수'); pg.click('#mapSave'); pg.wait_for_timeout(500)
    ok(pg.evaluate("!!(SMGApp.S.ui.imp.rows)") ,f'{tag} 열 직접 골라 양식 기억 → 미리보기')
    t=upload(FX+'unknown_layout_2.xlsx'); ok('저장된 양식' in t,f'{tag} 같은 머리글 다른 파일 → 저장된 양식 자동 적용')
    t=upload(FX+'messy_staff_out.csv'); ok(pg.evaluate("SMGApp.S.ui.imp.rows.length")==2 ,f'{tag} 직원 CSV(영문·TOTAL 행 제외)')
    if pg.locator('[data-dupm=first]').count(): pg.click('[data-dupm=first]'); pg.wait_for_timeout(200); ok('on' in pg.get_attribute('[data-dupm=first]','class'),f'{tag} 중복 줄 처리 선택')
    pg.screenshot(path=SH+f'{tag}_import_csv.png',full_page=True)
    # ── 기존 기능 화면 그대로 열리는지 + 가로 넘침
    for v in ['home','ipnow','products','count','inbound','transfer','records','settle','admin','more']:
      go(pg,v); over=pg.evaluate("document.documentElement.scrollWidth>document.documentElement.clientWidth+1")
      ok(not over,f'{tag} {v} 가로 넘침 없음'); pg.screenshot(path=SH+f'{tag}_{v}.png')
    ok(pg.locator('input[type=date]').count()==0 and 'showPicker' not in open('app.js').read(),f'{tag} 날짜 입력: showPicker·숨은 date input 없음 (년/월/일 선택)')
    ok(not errs,f'{tag} 자바스크립트 오류 없음 {errs[:3]}')
    ctx.close()
  br.close()
open(f'screenshots/result_{ENG}.txt','w').write('\n'.join(RES))
print('FAILS',len(FAILS)); [print(' -',f) for f in FAILS]
