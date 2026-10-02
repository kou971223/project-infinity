"""UI integration checks. MOCK_BROWSER=1 checks UI only, never model inference."""
import json, os, pathlib, sys, time
from playwright.sync_api import sync_playwright
ROOT=pathlib.Path(__file__).resolve().parents[1]
MOCK=os.environ.get('MOCK_BROWSER')=='1'
BASE=os.environ.get('BROWSER_BASE_URL','http://127.0.0.1:3000')
started=time.monotonic(); errors=[]; requests=[]
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True, executable_path=os.environ.get('CHROMIUM_PATH') or None, args=['--disable-dev-shm-usage'])
    ctx=browser.new_context(viewport={'width':390,'height':844}, device_scale_factor=1, is_mobile=True, has_touch=True)
    page=ctx.new_page(); page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append({'method':r.method,'url':r.url}))
    if MOCK:
        page.add_init_script("""class FakeWorker {
          constructor() { this.onmessage = null; }
          postMessage(d) { const self=this; setTimeout(()=>{
            if(!self.onmessage)return;
            if(d.type==='load')self.onmessage({data:{type:'ready',device:'wasm'}});
            else self.onmessage({data:{type:'done',text:'検証用応答（実際のモデル出力ではありません）: '+d.messages.at(-1).content}});
          }, 25); }
          terminate(){this.onmessage=null;}
        } window.Worker=FakeWorker;""")
    page.goto(BASE,wait_until='domcontentloaded',timeout=60000)
    page.wait_for_selector('#cpu',timeout=20000)
    page.locator('#cpu').click()
    try:
        page.wait_for_function("document.querySelector('#progress').textContent.startsWith('起動済み') || !!document.querySelector('#error').textContent",timeout=300000)
        error=page.locator('#error').inner_text()
        if error: raise RuntimeError('MODEL_LOAD: '+error)
        answers=[]
        for prompt in ['こんにちは。日本語で短くあいさつしてください。','前のあいさつに続けて、一言だけ返してください。']:
            page.locator('#input').fill(prompt); page.locator('#send').click()
            page.wait_for_function("!document.querySelector('#send').disabled || !!document.querySelector('#error').textContent",timeout=180000)
            error=page.locator('#error').inner_text()
            if error: raise RuntimeError('GENERATION: '+error)
            answer=page.locator('.message.assistant').last.inner_text()
            if len(answer.strip())<6: raise AssertionError('EMPTY_MODEL_ANSWER')
            answers.append(answer[:300])
        assert page.locator('.message.user').count()==2
        assert page.locator('.message.assistant').count()==2
        font=page.locator('#input').evaluate('(e)=>getComputedStyle(e).fontSize')
        assert float(font.removesuffix('px'))>=16
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth+1')
        assert not errors, errors
        assert not any(r['method']=='POST' and ('/api/' in r['url'] or 'models.github' in r['url']) for r in requests)
        (ROOT/'reports').mkdir(exist_ok=True)
        page.screenshot(path=str(ROOT/'reports/mobile-0.4.png'),full_page=True)
        page.reload(wait_until='domcontentloaded')
        assert page.locator('.message.assistant').count()==2
        page.locator('#new').click()
        assert page.locator('.message.user').count()==0
        result={'status':'passed','mode':'mock UI only' if MOCK else 'real browser-local model',
                'browser':'Chromium Linux','viewport':[390,844],'fontSize':font,'twoTurns':True,
                'historyReload':True,'noPaidPost':True,'answers':answers,
                'elapsedSeconds':round(time.monotonic()-started,2),'realIPhoneVerified':False}
        (ROOT/'reports/browser-check.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
        print(json.dumps(result,ensure_ascii=False),flush=True)
    except Exception:
        print('BROWSER_DIAGNOSTIC',json.dumps({'progress':page.locator('#progress').inner_text(),'error':page.locator('#error').inner_text(),'pageErrors':errors},ensure_ascii=False),flush=True)
        raise
    finally:
        browser.close()
