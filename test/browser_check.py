"""Real inference, remembered context and browser-local multi-chat verification."""
import json, os, pathlib, time
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=os.environ.get('BROWSER_BASE_URL','http://127.0.0.1:3000')
ENGINE=os.environ.get('BROWSER_ENGINE','chromium');started=time.monotonic();errors=[];requests=[]
with sync_playwright() as p:
 browser=getattr(p,ENGINE).launch(headless=True)
 ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,is_mobile=True,has_touch=True)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
 try:
  # Exact-release gate is optional locally, mandatory in post-deploy CI.
  health=ctx.request.get(BASE+'/health',timeout=90000).json()
  expected=os.environ.get('EXPECTED_REVISION')
  if expected:assert health['revision']==expected,health
  assert health['version']=='0.8.0',health
  page.goto(BASE,wait_until='domcontentloaded',timeout=90000);page.locator('#send').wait_for()
  answers=[]
  for prompt in ['この会話の合言葉は「青い灯台583」です。合言葉だけを返してください。','さっき覚えた合言葉だけを答えてください。']:
   page.locator('#input').fill(prompt);page.locator('#send').click()
   page.wait_for_function("document.querySelectorAll('.message.assistant').length > %d || !!document.querySelector('#error').textContent"%len(answers),timeout=90000)
   err=page.locator('#error').inner_text();assert not err,err
   answer=page.locator('.message.assistant').last.inner_text();assert '青い灯台583' in answer,answer
   answers.append(answer[:300])
  assert page.locator('.message.user').count()==2 and page.locator('.message.assistant').count()==2
  assert any(r['method']=='POST' and '/api/chat' in r['url'] for r in requests)
  assert not any('huggingface' in r['url'] or 'transformers' in r['url'] for r in requests)
  assert float(page.locator('#input').evaluate('(e)=>getComputedStyle(e).fontSize').removesuffix('px'))>=16
  assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
  assert page.locator('#send').bounding_box()['y']<844
  page.reload(wait_until='domcontentloaded');page.wait_for_function("document.querySelectorAll('.message.assistant').length===2")
  prior=page.locator('#history').input_value();page.locator('#new').click();assert page.locator('.message').count()==0
  assert page.locator('#history option').count()==2
  page.locator('#history').select_option(prior);assert page.locator('.message.assistant').count()==2
  api=ctx.request.post(BASE+'/api/chat',data={'messages':[{'role':'user','content':'17かける19を計算して数字だけ答えてください。'}]},timeout=65000)
  assert api.status==200,api.text();answer=api.json();assert answer['reply'].strip()=='323',answer
  assert not errors,errors
  page.screenshot(path=str(ROOT/'reports'/('browser-'+ENGINE+'.png')))
  result={'status':'passed','mode':'real anonymous remote inference','browser':ENGINE,'viewport':[390,844],'deployedHealth':health,'twoTurnsWithRecall':True,'historyReloadAndSwitch':True,'newChatPreservesPrior':True,'productionAPI':BASE.startswith('https:'),'apiArithmetic':True,'answers':answers,'elapsedSeconds':round(time.monotonic()-started,2),'realIPhoneVerified':False}
  (ROOT/'reports'/('browser-'+ENGINE+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False),flush=True)
 finally:browser.close()
