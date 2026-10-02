"""Actual browser-local inference with learned tensor, fresh reload and base rollback.
No FakeWorker, no inference API, no injected responses. This is not an iPhone test.
"""
import json, os, pathlib, time
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE=os.environ.get('BROWSER_BASE_URL','http://127.0.0.1:3000')
manifest=json.loads((ROOT/'reports/chat-release.test.json').read_text())
started=time.monotonic();requests=[];errors=[]
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,args=['--disable-dev-shm-usage'])
 ctx=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
 def wait_ready(expected):
  page.wait_for_function("document.querySelector('#progress').textContent.startsWith('起動済み') || !!document.querySelector('#error').textContent",timeout=300000)
  error=page.locator('#error').inner_text()
  if error:raise RuntimeError(error)
  state=page.locator('#model-state').evaluate('(e)=>({...e.dataset})')
  assert state['source']==expected, {'expected':expected,'actual':state,'status':page.locator('#model-state').inner_text()}
  return state
 def ask(prompt):
  page.locator('#input').fill(prompt);page.locator('#send').click()
  page.wait_for_function("!document.querySelector('#send').disabled || !!document.querySelector('#error').textContent",timeout=180000)
  assert not page.locator('#error').inner_text(),page.locator('#error').inner_text()
  text=page.locator('.message.assistant').last.inner_text()
  assert len(text.strip())>6
  return text
 try:
  page.goto(BASE,wait_until='domcontentloaded',timeout=60000);page.locator('#cpu').click();state=wait_ready('trained')
  assert state['weightHash']==manifest['weightHash'];assert state['releaseHash']==manifest['releaseHash']
  assert int(state['verifiedChunks'])==len(manifest['baseChunkHashes'])
  answers=[ask('2+3の答えを数字だけで答えてください。'),ask('日本の首都を一語で答えてください。')]
  assert '5' in answers[0] or '５' in answers[0],answers
  assert '東京' in answers[1],answers
  assert page.locator('.message.user').count()==2 and page.locator('.message.assistant').count()==2
  assert float(page.locator('#input').evaluate('(e)=>getComputedStyle(e).fontSize').removesuffix('px'))>=16
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  page.screenshot(path=str(ROOT/'reports/chat-bridge-mobile.png'),full_page=True)
  page.reload(wait_until='domcontentloaded');assert page.locator('.message.assistant').count()==2
  page.locator('#cpu').click();again=wait_ready('trained');assert again['weightHash']==state['weightHash']
  page.locator('#rollback-model').click();wait_ready('base');rollback_answer=ask('2+3の答えを数字だけで答えてください。')
  assert '5' in rollback_answer or '５' in rollback_answer
  assert not errors,errors
  assert not any(r['method']=='POST' for r in requests),[r for r in requests if r['method']=='POST']
  result={'status':'passed','mode':'real-model','releaseHash':manifest['releaseHash'],'weightHash':manifest['weightHash'],
   'verifiedChunks':int(state['verifiedChunks']),'twoTurns':True,'reloadVerified':True,'rollbackVerified':True,'noPaidPost':True,
   'answers':answers,'rollbackAnswer':rollback_answer,'browser':'Chromium Linux','realIPhoneVerified':False,'elapsedSeconds':round(time.monotonic()-started,3)}
  (ROOT/'reports/chat-browser.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False),flush=True)
 except Exception:
  print('BRIDGE_DIAGNOSTIC',json.dumps({'progress':page.locator('#progress').inner_text(),'error':page.locator('#error').inner_text(),'state':page.locator('#model-state').inner_text(),'errors':errors},ensure_ascii=False),flush=True)
  raise
 finally:browser.close()
