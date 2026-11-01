const { chromium } = require('playwright');
const SP=process.env.OUT || './layout-shots/';
require('fs').mkdirSync(SP,{recursive:true});
(async () => {
  const b = await chromium.launch();
  const views=['home','ipnow','products','entry','count','inbound','transfer','records','sales','settle','admin','more'];
  for (const [w,h] of [[360,740],[390,844],[768,1024],[1024,768],[1366,768]]) {
    const p = await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1,colorScheme:'dark'});
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('http://localhost:8765/index.html'); await p.waitForTimeout(2000);
    await p.addStyleTag({content:'body,button,select,div,span,td,th,b,input{font-family:"Noto Sans CJK KR",sans-serif!important}'});
    await p.click('#storeBtn'); await p.click('#smAll'); await p.waitForTimeout(200);
    const bad=[];
    for (const v of views) {
      await p.evaluate(v=>{SMGApp.S.view=v;SMGApp.S.ui.drawer=null;SMGApp.render();window.scrollTo(0,0)},v); await p.waitForTimeout(150);
      const r=await p.evaluate(()=>{const W=document.documentElement.clientWidth; const over=[...document.querySelectorAll('#page *')].filter(e=>{const r=e.getBoundingClientRect(); return r.width>0 && r.right>W+1 && !e.closest('.tw,.tlwrap')}).slice(0,3).map(e=>e.tagName+'.'+e.className+':'+Math.round(e.getBoundingClientRect().right)); return {sw:document.documentElement.scrollWidth,W,over}});
      if (r.sw>r.W || r.over.length) bad.push(v+' '+JSON.stringify(r));
      if (w<=390 || w===1024) await p.screenshot({path:SP+`${w}_${v}.png`});
    }
    console.log(w, bad.length? bad : 'OK', errs); await p.close();
  }
  await b.close();
})();
