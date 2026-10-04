import {KEY,loadState,newChat,contextFor,cleanCitations} from './chat-state.js';
const $=id=>document.getElementById(id);
let storage;try{storage=localStorage;}catch{storage={getItem:()=>null,setItem:()=>{throw Error('STORAGE_UNAVAILABLE');}};}
let state=loadState(storage),request=null,sequence=0;
const active=()=>state.chats.find(c=>c.id===state.activeId);
function save(){try{storage.setItem(KEY,JSON.stringify(state));}catch{$('notice').textContent='履歴を端末へ保存できません。ブラウザの保存容量・設定を確認してください。';}}
function render(){
 const list=$('messages');list.replaceChildren();
 for(const m of active().messages){const el=document.createElement('div');el.className='message '+m.role;
 const role=document.createElement('span');role.className='role';role.textContent=m.role==='user'?'あなた':'Project ∞';
 el.append(role,document.createTextNode(m.content));if(m.status==='failed'||m.status==='cancelled'){const label=document.createElement('small');label.textContent='\n未回答 · 再試行できます';el.append(label);}
 if(m.citations?.length){const box=document.createElement('small');box.textContent='\n回答時に参照した資料（論文は要旨のみ・主張の独立再現ではありません）';for(const c of cleanCitations(m.citations)){const a=document.createElement('a');a.href=c.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='\n'+c.title+' · '+date(c.checkedAt);box.append(a);}el.append(box);}list.append(el);}
 $('empty').hidden=active().messages.length>0;
 const select=$('history');select.replaceChildren();for(const c of state.chats.slice().reverse()){const o=document.createElement('option');o.value=c.id;o.textContent=c.title;select.append(o);}select.value=state.activeId;
 controls();
}
function controls(){const busy=!!request;$('send').disabled=busy||!$('input').value.trim();$('send').textContent=busy?'回答中…':'送信';$('stop').hidden=!busy;
 const last=active().messages.at(-1);$('retry').hidden=busy||!last||last.role!=='user'||!['failed','cancelled'].includes(last.status);}
function cancel(){if(request){const old=request;request=null;sequence++;old.turn.status='cancelled';old.controller.abort();save();}controls();}
const errorText=code=>({UPSTREAM_BUSY:'外部AIが混雑しています。少し待って再試行してください。',RATE_LIMITED:'短時間の送信上限に達しました。1分後に再試行してください。',KEYLESS_UNAVAILABLE:'提供元でキー不要推論を利用できません。キーや課金へ自動切替はしません。',UPSTREAM_TIMEOUT:'回答が時間内に届きませんでした。再試行できます。',CANCELLED:'停止しました。'})[code]||'回答を取得できませんでした。入力と履歴は残っています。再試行できます。';
async function ask(retry=false){
 if(request)return;const chat=active();let turn;
 if(retry){turn=chat.messages.at(-1);if(turn?.role!=='user'||!['failed','cancelled'].includes(turn.status))return;turn.status='pending';}
 else{const content=$('input').value.trim();if(!content)return;
 if(chat.messages.length>=199){$('error').textContent='この会話は保存上限です。「新しい会話」を使ってください。';return;}
 turn={role:'user',content,status:'pending'};chat.messages.push(turn);if(chat.messages.filter(m=>m.role==='user').length===1)chat.title=content.slice(0,40);$('input').value='';$('input').style.height='auto';}
 chat.updatedAt=new Date().toISOString();const id=++sequence,controller=new AbortController();request={id,controller,turn,chatId:chat.id};
 const timeout=setTimeout(()=>controller.abort('timeout'),75000);save();render();$('error').textContent='';$('progress').textContent='無料枠の送信間隔を調整し、回答を生成しています…';
 try{const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:contextFor(chat)}),signal:controller.signal});
 let data;try{data=await r.json();}catch{throw Error('INVALID_RESPONSE');}if(!r.ok)throw Error(data.error||'HTTP_'+r.status);
 if(typeof data.reply!=='string'||!data.reply.trim())throw Error('EMPTY_RESPONSE');
 if(request?.id!==id)return;turn.status='complete';chat.messages.push({role:'assistant',content:data.reply,status:'complete',citations:cleanCitations(data.citations)});save();if(data.evolution)$('notice').textContent=(data.program?'生成プログラム 第'+data.program.generation+'世代で回答':'会話能力 第'+data.evolution.generation+'世代 · '+(data.evolution.reply!==undefined?'検証済み機能で回答':'外部AIで回答'))+(data.citations?.length?' · 研究資料 '+data.citations.length+'件を参照':'')+'（モデル重みの学習ではありません）';
 }catch(e){if(request?.id!==id)return;turn.status='failed';save();$('error').textContent=errorText(controller.signal.aborted?'UPSTREAM_TIMEOUT':e.message);}
 finally{clearTimeout(timeout);if(request?.id===id){request=null;$('progress').textContent='';render();$('scroll').scrollTop=$('scroll').scrollHeight;}}
}
$('form').onsubmit=e=>{e.preventDefault();ask();};$('retry').onclick=()=>ask(true);$('stop').onclick=()=>{cancel();$('progress').textContent='';$('error').textContent='停止しました。再試行できます。';render();};
$('input').oninput=()=>{const e=$('input');e.style.height='auto';e.style.height=Math.min(120,e.scrollHeight)+'px';controls();};
$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229&&!matchMedia('(pointer: coarse)').matches){e.preventDefault();$('form').requestSubmit();}};
function switchTo(id){cancel();state.activeId=id;$('input').value='';$('error').textContent='';$('progress').textContent='';save();render();}
$('history').onchange=()=>switchTo($('history').value);
$('new').onclick=()=>{if(state.chats.length>=50){$('error').textContent='会話の保存上限（50件）です。履歴をエクスポートして保存してください。';return;}const chat=newChat();state.chats.push(chat);switchTo(chat.id);$('notice').textContent='新しい会話を始めました。以前の会話は履歴から開けます。';};
$('export').onclick=()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(state,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='project-infinity-conversations.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
function date(s){const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString('ja-JP'):'時刻不明';}
async function research(){
 $('refresh').disabled=true;$('research').textContent='記録を取得しています…';
 try{const r=await fetch('/api/project/status',{signal:AbortSignal.timeout(20000),cache:'no-store'});if(!r.ok)throw Error();const data=await r.json();
 const lines=['全体：実験段階（未完成）','会話：キー不要の外部推論／学習重みの反映なし','研究：定期実行。常時稼働は保証されません。'];
 for(const lane of data.lanes){lines.push('\n'+lane.label, lane.available?date(lane.at)+'\n判定：'+lane.decision+'\n'+(lane.summary||''):'記録未取得：'+lane.reason);}
 lines.push('\nKnowledge Archive：公開コード・実験結果のみ。私的な会話は送信しません。','独立評価：生成処理と検証処理を分離。外部研究者による独立再現ではありません。');
 $('research').textContent=lines.join('\n');$('research-raw').textContent=JSON.stringify(data,null,2);
 }catch{$('research').textContent='研究記録を取得できませんでした。時間をおいて更新してください。';}finally{$('refresh').disabled=false;}
}
$('records').onclick=()=>{$('research-dialog').showModal();research();};$('close-records').onclick=()=>$('research-dialog').close();$('refresh').onclick=research;
if(window.visualViewport){const fit=()=>{document.body.style.height=Math.round(window.visualViewport.height)+'px';};window.visualViewport.addEventListener('resize',fit);fit();}
window.addEventListener('pagehide',()=>{cancel();save();});
render();save();
