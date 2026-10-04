"""Fault injection tests only. Not evidence of successful remote model inference."""
import json,os,time
from playwright.sync_api import sync_playwright
BASE=os.environ.get('BROWSER_BASE_URL','http://127.0.0.1:3000')
with sync_playwright() as p:
 for engine in ['chromium','webkit']:
  b=getattr(p,engine).launch(headless=True);ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def respond(route):route.fulfill(status=503,content_type='application/json',body='{"error":"UPSTREAM_BUSY"}')
  page.route('**/api/chat',respond);page.goto(BASE)
  page.locator('#input').fill('失敗復帰テスト');page.locator('#send').click();page.locator('#retry').wait_for(state='visible')
  assert page.locator('.message.user').count()==1
  page.unroute('**/api/chat',respond)
  page.route('**/api/chat',lambda r:r.fulfill(content_type='application/json',body=json.dumps({'reply':'復帰しました'})))
  page.locator('#retry').click();page.wait_for_function("document.querySelectorAll('.message.assistant').length===1")
  assert page.locator('.message.user').count()==1
  page.unroute('**/api/chat')
  held=[];page.route('**/api/chat',lambda r:held.append(r))
  page.locator('#input').fill('停止テスト');page.locator('#send').click();page.locator('#stop').wait_for(state='visible');page.locator('#stop').click();assert page.locator('#retry').is_visible()
  page.locator('#new').click();assert page.locator('.message').count()==0
  for route in held:
   try:route.fulfill(content_type='application/json',body='{"reply":"古い応答"}')
   except Exception:pass
  page.wait_for_timeout(200);assert page.locator('.message').count()==0
  # Background old request cannot overwrite state of a new request.
  page.unroute('**/api/chat');page.route('**/api/chat',lambda r:r.fulfill(content_type='application/json',body='{"reply":"新しい応答"}'))
  page.locator('#input').fill('新しい要求');page.locator('#send').click();page.wait_for_function("document.querySelectorAll('.message.assistant').length===1")
  assert '新しい応答' in page.locator('.message.assistant').inner_text()
  page.reload();page.wait_for_function("document.querySelectorAll('.message.assistant').length===1")
  assert page.locator('#history option').count()==2;assert not errors,errors
  for width in [320,390,430]:
   page.set_viewport_size({'width':width,'height':740});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth+1')
  print(json.dumps({'browser':engine,'faultInjection':True,'errorRetryNoDuplicate':True,'cancelNewChatRace':True,'mobileWidths':[320,390,430],'status':'passed'}));b.close()
