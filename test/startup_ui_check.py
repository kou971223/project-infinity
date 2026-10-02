"""Deterministic UI fault-injection checks. Fake worker results are NEVER inference evidence."""
import json, os, pathlib
from playwright.sync_api import sync_playwright
BASE=os.environ.get('BROWSER_BASE_URL','http://127.0.0.1:3000')
ROOT=pathlib.Path(__file__).resolve().parents[1]
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path=os.environ.get('CHROMIUM_PATH') or None,args=['--disable-dev-shm-usage'])
 c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,user_agent=UA)
 c.add_init_script("""
 window.fakeWorkers=[];window.failWorker=false;
 class FakeWorker {
  constructor(){if(window.failWorker)throw Error('Injected constructor failure');this.commands=[];this.dead=false;window.fakeWorkers.push(this);}
  postMessage(d){this.commands.push(d);}
  emit(d){if(this.onmessage)this.onmessage({data:d});}
  terminate(){this.dead=true;}
 }
 window.Worker=FakeWorker;
 """)
 page=c.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
 page.route('**/api/**',lambda route:route.fulfill(status=200,content_type='application/json',body=json.dumps({'available':False})))
 page.goto(BASE,wait_until='domcontentloaded');page.wait_for_selector('#load')
 assert not page.locator('#research-dialog').is_visible()
 assert not any('/api/' in r['url'] for r in requests), 'No background research fetch before the dialog is opened'
 page.locator('#new').click();assert '新しい会話にしました' in page.locator('#notice').inner_text()
 page.locator('#input').fill('準備が終わったら質問します');page.locator('#send').click()
 assert page.locator('body').get_attribute('data-phase')=='loading'
 assert page.evaluate('fakeWorkers.length')==1
 assert page.evaluate('fakeWorkers[0].commands[0].device')=='cpu'
 page.evaluate("fakeWorkers[0].emit({type:'progress',file:'model.onnx',progress:54})")
 assert '54' in page.locator('#progress').inner_text()
 assert '起動済み' not in page.locator('#progress').inner_text()
 assert page.locator('#input').is_enabled()
 assert len(page.evaluate("fakeWorkers[0].commands.filter(c=>c.type==='chat')"))==0
 # A new chat during load clears the queued question without loading a second model.
 page.locator('#new').click();assert page.locator('.message.user').count()==0
 assert page.evaluate('fakeWorkers.length')==1
 page.evaluate("fakeWorkers[0].emit({type:'ready',device:'wasm'})")
 assert len(page.evaluate("fakeWorkers[0].commands.filter(c=>c.type==='chat')"))==0
 page.locator('#input').fill('こんにちは');page.locator('#send').click()
 page.evaluate("const w=fakeWorkers[0],t=w.commands.at(-1).turn;w.emit({type:'delta',text:'検証用',turn:t});w.emit({type:'done',text:'検証用応答（モック）',turn:t});")
 assert page.locator('.message.assistant').count()==1
 assert not page.locator('#intro .setup-copy').is_visible()
 page.locator('#new').click();assert page.locator('.message.assistant').count()==0
 assert page.evaluate('fakeWorkers.length')==1
 # IME Enter must not submit.
 page.locator('#input').fill('入力変換中')
 page.locator('#input').dispatch_event('keydown',{'key':'Enter','isComposing':True,'keyCode':229})
 assert page.locator('.message.user').count()==0
 page.locator('#send').click()
 page.evaluate('window.stale=fakeWorkers[0].onmessage')
 page.locator('#new').click()
 page.evaluate("stale({data:{type:'done',text:'DO NOT APPEND',turn:2}})")
 assert page.locator('.message.assistant').count()==0
 assert page.evaluate('fakeWorkers[0].dead') is True
 # Cancelled loading cannot later mark a replacement session ready.
 page.locator('#cpu').click();page.evaluate('window.stale=fakeWorkers.at(-1).onmessage')
 page.locator('#stop').click();page.evaluate("stale({data:{type:'ready',device:'wasm'}})")
 assert page.locator('body').get_attribute('data-phase')=='stopped'
 # Worker error restores unsent text and re-enables explicit retry.
 page.locator('#input').fill('消してはいけない未送信文');page.locator('#send').click()
 page.evaluate("fakeWorkers.at(-1).emit({type:'error',message:'Injected load failure'})")
 assert page.locator('#input').input_value()=='消してはいけない未送信文'
 assert page.locator('#cpu').is_enabled()
 assert page.locator('body').get_attribute('data-phase')=='error'
 page.evaluate('window.failWorker=true');page.locator('#cpu').click()
 assert 'constructor' in page.locator('#error').inner_text()
 assert page.locator('#cpu').is_enabled()
 page.evaluate('window.failWorker=false')
 # One queued message, exactly one send after ready; no fake response before that.
 page.locator('#send').click();n=page.evaluate('fakeWorkers.length')
 page.evaluate("fakeWorkers.at(-1).emit({type:'ready',device:'wasm'})")
 assert page.evaluate("fakeWorkers.at(-1).commands.filter(c=>c.type==='chat').length")==1
 page.evaluate("const w=fakeWorkers.at(-1);w.emit({type:'done',text:'検証用応答（モック）',turn:w.commands.at(-1).turn})")
 page.reload(wait_until='domcontentloaded')
 assert page.locator('.message.assistant').count()==1
 # A stopped download must not leave an endless disabled form.
 page.clock.install();page.locator('#cpu').click();page.clock.fast_forward(300001)
 assert page.locator('body').get_attribute('data-phase')=='error'
 assert page.locator('#cpu').is_enabled()
 # Failed record lookup is shown as unknown; records remain separate from chat.
 page.locator('#records').click();page.wait_for_function("!document.querySelector('#refresh').disabled")
 assert '取得できません' in page.locator('#research').inner_text()
 page.locator('#close-records').click();assert not page.locator('#research-dialog').is_visible()
 font=page.locator('#input').evaluate('(e)=>getComputedStyle(e).fontSize');assert float(font.removesuffix('px'))>=16
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
 for height in [844,480]:
  page.set_viewport_size({'width':390,'height':height})
  boxes=page.evaluate("['header','#scroll','footer'].map(s=>{const r=document.querySelector(s).getBoundingClientRect();return {top:r.top,bottom:r.bottom}})")
  assert boxes[0]['bottom']<=boxes[1]['top']+1,boxes
  assert boxes[1]['bottom']<=boxes[2]['top']+1,boxes
 assert not errors,errors
 assert not any(x['method']=='POST' for x in requests)
 (ROOT/'reports').mkdir(exist_ok=True)
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path=str(ROOT/'reports/startup-ui.png'))
 result={'status':'passed','mode':'mock worker UI failure/recovery tests ONLY','newDuringLoad':True,'staleCallbacksBlocked':True,'draftRestored':True,'queuedExactlyOnce':True,'constructorFailure':True,'timeoutRecovery':True,'iOSRoutesToCPU':True,'recordsSeparate':True,'fontSize':font,'physicalIPhoneVerified':False}
 (ROOT/'reports/startup-ui-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps(result,ensure_ascii=False))
 b.close()
