"""Real two-turn browser verification for the zero-cost remote chat surface."""
import json, os, pathlib, time
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=os.environ.get('BROWSER_BASE_URL','http://127.0.0.1:3000');started=time.monotonic();errors=[];requests=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
 page.goto(BASE,wait_until='domcontentloaded',timeout=60000);page.wait_for_selector('#send',timeout=20000)
 answers=[]
 try:
  for prompt in ['「テスト1成功」とだけ答えて','前の指示に続けて「テスト2成功」とだけ答えて']:
   page.locator('#input').fill(prompt);page.locator('#send').click()
   page.wait_for_function("document.querySelectorAll('.message.assistant').length > %d || !!document.querySelector('#error').textContent"%len(answers),timeout=90000)
   err=page.locator('#error').inner_text()
   if err: raise RuntimeError('REMOTE_GENERATION: '+err)
   answer=page.locator('.message.assistant').last.inner_text()
   if len(answer.strip())<4: raise AssertionError('EMPTY_REMOTE_ANSWER')
   answers.append(answer[:300])
  assert page.locator('.message.user').count()==2 and page.locator('.message.assistant').count()==2
  assert any(r['method']=='POST' and '/api/chat' in r['url'] for r in requests)
  font=page.locator('#input').evaluate('(e)=>getComputedStyle(e).fontSize');assert float(font.removesuffix('px'))>=16
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
  assert not errors,errors
  page.reload(wait_until='domcontentloaded');assert page.locator('.message.assistant').count()==2
  page.locator('#new').click();assert page.locator('.message.user').count()==0
  result={'status':'passed','mode':'real keyless remote inference','browser':'Chromium Linux','viewport':[390,844],'twoTurns':True,'historyReload':True,'newChat':True,'sameOriginProxyObserved':True,'answers':answers,'elapsedSeconds':round(time.monotonic()-started,2),'realIPhoneVerified':False}
  (ROOT/'reports').mkdir(exist_ok=True);(ROOT/'reports/browser-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False),flush=True)
 finally: browser.close()
