// Explicit startup state: downloading is never advertised as ready.
const $=id=>document.getElementById(id);
const KEY='pinf-local-chat-v1',MARK='pinf-init-unfinished-v1';
const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
let worker=null,phase='idle',messages=[],pending=null,partial=null,deadline=null,ticker=null,started=0,lastProgress=0,turn=0,stage='';
try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(a))messages=a.filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-20);}catch{}
function mark(value){try{if(value)sessionStorage.setItem(MARK,JSON.stringify({at:Date.now()}));else sessionStorage.removeItem(MARK);}catch{}}
function save(){try{localStorage.setItem(KEY,JSON.stringify(messages.slice(-20)));}catch{$('notice').textContent='このブラウザへ保存できません。会話は画面に残りますが、再読込で失われる場合があります。';}}
function render(){const list=$('messages');list.replaceChildren();for(const m of messages){const el=document.createElement('div');el.className='message '+m.role;const role=document.createElement('span');role.className='role';role.textContent=m.role==='user'?'あなた':'端末内AI';el.append(role,document.createTextNode(m.content));list.append(el);}if(partial!==null){const el=document.createElement('div');el.className='message';el.id='partial';el.textContent=partial||'考えています…';list.append(el);}$('empty').hidden=messages.length>0;}
function controls(){const loading=phase==='loading',generating=phase==='generating';$('load').disabled=loading||generating||phase==='ready';$('cpu').disabled=$('load').disabled;$('send').disabled=generating||!!pending||!$('input').value.trim();$('send').textContent=pending?'準備中':(phase==='ready'?'送信':'起動して送信');$('stop').hidden=!loading&&!generating;$('intro').classList.toggle('ready',phase==='ready'||generating);$('load-meter').hidden=!loading;document.body.dataset.phase=phase;}
function clearTimers(){clearTimeout(deadline);clearInterval(ticker);deadline=null;ticker=null;}
function restorePending(){if(!pending)return;if(!$('input').value.trim())$('input').value=pending.content;const i=messages.indexOf(pending);if(i>=0)messages.splice(i,1);pending=null;save();}
function release(){const old=worker;worker=null;if(old){old.onmessage=null;old.onerror=null;old.terminate();}clearTimers();mark(false);}
function stop(message='停止しました。再開するときは「端末内AIを起動」を押してください。'){release();restorePending();phase='stopped';partial=null;$('status-title').textContent='停止';$('progress').textContent=message;$('error').textContent='';controls();render();}
function fail(message){release();restorePending();phase='error';partial=null;$('status-title').textContent='起動・応答を完了できませんでした';$('progress').textContent='停止済みです。「CPUで起動」で再試行できます。';$('error').textContent=message+'\n繰り返す場合は、他のタブを閉じて再試行してください。端末によってはこのモデルを実行できません。';controls();render();}
function updateProgress(){if(phase!=='loading')return;const sec=Math.floor((Date.now()-started)/1000),slow=Date.now()-lastProgress>45000;$('progress').textContent=stage+'\n経過 '+sec+'秒。'+(slow?'準備に時間がかかっています。停止して再試行できます。':'完了すると「起動済み」に変わります。');}
function start(device='auto'){if(phase==='loading'||phase==='generating'||phase==='ready')return;release();phase='loading';started=lastProgress=Date.now();stage='1/3 AIの実行エンジンを準備しています';$('status-title').textContent=ios?'準備中（iPhone・iPad用CPU方式）':'準備中';$('error').textContent='';$('load-meter').removeAttribute('value');mark(true);controls();updateProgress();
 try{const w=new Worker('/chat-worker.js?v=ios-startup-1',{type:'module'});worker=w;w.onerror=e=>{if(worker===w)fail(e.message||'AI実行処理でエラーが発生しました。');};w.onmessage=({data:d})=>{if(worker!==w)return;if(d.type==='phase'){lastProgress=Date.now();stage=d.message;updateProgress();}
 else if(d.type==='progress'){lastProgress=Date.now();const p=Number.isFinite(d.progress)?Math.max(0,Math.min(100,d.progress)):null;stage='2/3 モデルをダウンロード中'+(p===null?'':' '+Math.round(p)+'％')+'（現在のファイル）';if(p!==null)$('load-meter').value=p;updateProgress();}
 else if(d.type==='ready'){clearTimers();mark(false);phase='ready';$('status-title').textContent='会話できます';$('progress').textContent='起動済み：'+(d.device==='webgpu'?'端末GPU':'端末CPU');controls();if(pending)sendPending();}
 else if(d.type==='delta'&&phase==='generating'&&d.turn===turn){partial=d.text;const el=$('partial');if(el)el.textContent=partial;}
 else if(d.type==='done'&&phase==='generating'&&d.turn===turn){clearTimers();messages.push({role:'assistant',content:d.text});partial=null;phase='ready';save();controls();render();$('scroll').scrollTop=$('scroll').scrollHeight;}
 else if(d.type==='error')fail(String(d.message||'AIの処理に失敗しました。'));};
 deadline=setTimeout(()=>fail('5分以内に起動を完了できませんでした。'),300000);ticker=setInterval(updateProgress,1000);w.postMessage({type:'load',device:ios?'cpu':device});
 }catch(e){fail(String(e.message||e));}}
function sendPending(){if(phase!=='ready'||!pending||!worker)return;pending=null;phase='generating';partial='';turn++;render();controls();deadline=setTimeout(()=>fail('応答が時間上限に達しました。短い質問で再試行してください。'),180000);worker.postMessage({type:'chat',turn,messages:messages.slice(-6).map(m=>({role:m.role,content:m.content.slice(0,2000)}))});}
$('load').onclick=()=>start();$('cpu').onclick=()=>start('cpu');$('stop').onclick=()=>stop();
$('input').oninput=()=>{const e=$('input');e.style.height='auto';e.style.height=Math.min(120,e.scrollHeight)+'px';controls();};
$('form').onsubmit=e=>{e.preventDefault();const text=$('input').value.trim();if(!text||phase==='generating'||pending)return;pending={role:'user',content:text};messages.push(pending);$('input').value='';$('input').style.height='auto';$('notice').textContent=phase==='ready'?'':'AIの準備が終わったら、このメッセージを送信します。';save();render();controls();if(phase==='ready')sendPending();else if(phase!=='loading')start();};
$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229&&!matchMedia('(pointer: coarse)').matches){e.preventDefault();$('form').requestSubmit();}};
$('new').onclick=()=>{if(phase==='generating')stop();messages=[];pending=null;partial=null;$('input').value='';$('input').style.height='auto';$('error').textContent='';save();render();controls();$('notice').textContent='新しい会話にしました。'+(phase==='loading'?'AIの準備はそのまま続けています。':phase==='ready'?'そのままメッセージを送れます。':'質問を入力してください。');$('scroll').scrollTop=0;};
function date(s){const d=new Date(s);return Number.isFinite(d.getTime())?d.toLocaleString('ja-JP'):'時刻不明';}
const trigger=e=>e==='schedule'?'定刻による実行':e==='push'?'コード更新後の実行':e==='workflow_dispatch'?'手動で開始した実行':e||'未確認';
async function research(){const dialog=$('research-dialog');$('refresh').disabled=true;$('research').textContent='記録を取得しています…';const urls=['/api/free/status','/api/autonomy/status','/api/runtime/status'];const data=await Promise.all(urls.map(async url=>{try{const r=await fetch(url,{signal:AbortSignal.timeout(15000),cache:'no-store'});if(!r.ok)throw Error('HTTP '+r.status);return await r.json();}catch{return {available:false};}}));const a=data[0].research,b=data[1],c=data[2];const lines=[];
 lines.push('① 過去の部分学習実験',a?.available?date(a.at)+'\n'+(a.learningStatus==='completed'?'実験は実行済み。':'実行状況：'+a.learningStatus)+' 採用判定：'+(a.learningDecision==='NOT_SUPPORTED'?'改善量が基準に届かず、採用見送り。':a.learningDecision||'未確認'):'記録を取得できませんでした。');
 lines.push('\n② 研究用モデルの継承',b?.available?date(b.at)+'\n'+trigger(b.event)+'／研究世代 '+b.generationBefore+' → '+b.generationAfter+'\n'+(b.decision==='ADOPT_EXPERIMENTAL_RESEARCHER_NORM'?'研究用モデルの一部を実験採用。会話用AIへの反映ではありません。':'判定：'+b.decision):'記録を取得できませんでした。');
 lines.push('\n③ 起動・復旧コードの変更',c?.available?date(c.at)+'\n'+trigger(c.event)+'\n'+(c.applied?'限定した起動・復旧コードの反映記録があります。':'今回のコード反映はありません。')+' 汎用知能の向上を示す記録ではありません。':'記録を取得できませんでした。');
 $('research').textContent=lines.join('\n');$('research-raw').textContent=JSON.stringify(data,null,2);$('refresh').disabled=false;}
$('records').onclick=()=>{$('research-dialog').showModal();research();};$('close-records').onclick=()=>$('research-dialog').close();$('refresh').onclick=research;
if(window.visualViewport){const fit=()=>{document.body.style.height=Math.round(window.visualViewport.height)+'px';};window.visualViewport.addEventListener('resize',fit);fit();}
try{if(sessionStorage.getItem(MARK)){$('notice').textContent='前回は起動完了の確認前に画面が閉じられました。原因は未確定です。CPU方式で再試行できます。';mark(false);}}catch{}
render();controls();
