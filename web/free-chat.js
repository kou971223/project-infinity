const $=id=>document.getElementById(id);
const layout=document.createElement('style');layout.textContent='.intro.ready h1,.intro.ready p,.intro.ready .actions{display:none}.intro.ready{padding:10px 16px}.message{scroll-margin-bottom:160px}#model-state{font-size:12px;color:#adbed8;margin-top:10px}#model-controls{margin-top:10px;display:flex;gap:8px;flex-wrap:wrap}';document.head.append(layout);
const state=document.createElement('div');state.id='model-state';state.textContent='起動時に検証済みの学習版を確認します。未承認なら元モデルを使用します。';$('intro').append(state);
const controls=document.createElement('div');controls.id='model-controls';const rollback=document.createElement('button');rollback.id='rollback-model';rollback.textContent='元モデルに戻す';rollback.type='button';const updates=document.createElement('button');updates.id='check-model-update';updates.textContent='学習版を確認';updates.type='button';controls.append(rollback,updates);$('intro').append(controls);
let worker=null,ready=false,busy=false,timer=null,messages=[],partial=null,retryAfterLoad=false,forceBase=false;
try{forceBase=localStorage.getItem('pinf-force-base-v1')==='true';const x=JSON.parse(localStorage.getItem('pinf-local-chat-v1')||'[]');if(Array.isArray(x))messages=x.filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-20);}catch{}
function save(){try{localStorage.setItem('pinf-local-chat-v1',JSON.stringify(messages.slice(-20)));}catch{$('error').textContent='保存容量が不足しています。再読込で履歴が失われる場合があります。';}}
function render(){const list=$('messages');list.replaceChildren();for(const m of messages){const el=document.createElement('div');el.className='message '+m.role;const role=document.createElement('span');role.className='role';role.textContent=m.role==='user'?'あなた':'端末内AI';el.append(role,document.createTextNode(m.content));list.append(el);}if(partial!==null){const el=document.createElement('div');el.className='message';el.textContent=partial||'考えています…';list.append(el);}}
function setBusy(x){busy=x;$('send').disabled=x||!ready;$('load').disabled=x||ready;$('cpu').disabled=x||ready;$('stop').hidden=!x;}
function stop(message='処理を停止しました。再開にはAIを起動してください。'){clearTimeout(timer);worker?.terminate();worker=null;ready=false;partial=null;$('intro').classList.remove('ready');setBusy(false);$('progress').textContent=message;render();}
function saveMode(){try{localStorage.setItem('pinf-force-base-v1',String(forceBase));}catch{}}
function generate(){partial='';setBusy(true);render();timer=setTimeout(()=>{if(state.dataset.source==='trained'){forceBase=true;saveMode();retryAfterLoad=true;stop('学習版の応答が時間切れのため元モデルで再試行します。');start('cpu');}else stop('応答が時間上限に達しました。内容を短くして再実行してください。');},180000);worker.postMessage({type:'chat',messages:messages.slice(-6).map(m=>({...m,content:m.content.slice(0,2000)}))});}
function start(device){if(busy||ready)return;worker?.terminate();worker=new Worker('/chat-worker.js',{type:'module'});$('error').textContent='';$('progress').textContent='モデルを読み込んでいます。初回は時間がかかります。';setBusy(true);timer=setTimeout(()=>stop('読込が時間上限に達しました。通信・空きメモリを確認してください。'),300000);
 worker.onerror=e=>{stop();$('error').textContent=e.message||'端末内AIを起動できませんでした。';};
 worker.onmessage=({data})=>{
  if(data.type==='progress')$('progress').textContent='モデル読込 '+(data.file||'')+(data.progress===null?'':' '+Math.round(data.progress)+'%');
  else if(data.type==='ready'){
   clearTimeout(timer);ready=true;$('intro').classList.add('ready');setBusy(false);$('progress').textContent='起動済み：'+(data.device==='webgpu'?'端末GPU':'端末CPU');$('input').placeholder='Project ∞ にメッセージ';
   const m=data.model||{source:'base'};state.dataset.source=m.source;state.dataset.weightHash=m.weightHash||'';state.dataset.releaseHash=m.releaseHash||'';state.dataset.verifiedChunks=String(m.verifiedChunks||0);
   state.textContent=m.source==='trained'?'学習版 '+m.generation+' を実際に読込済み（部分重み・検証範囲限定）':'元モデルを使用中'+(m.reason==='USER_SELECTED_BASE'?'（手動復元）':'（採用可能な学習版なし／起動失敗時の復元）');
   if(retryAfterLoad){retryAfterLoad=false;generate();}
  }else if(data.type==='delta'){partial=data.text;render();}
  else if(data.type==='done'){clearTimeout(timer);messages.push({role:'assistant',content:data.text});partial=null;setBusy(false);save();render();$('messages').lastElementChild?.scrollIntoView({block:'end'});}
  else if(data.type==='fallback_required'){forceBase=true;saveMode();retryAfterLoad=true;stop('学習版で応答エラーが発生したため元モデルで再試行します。');start('cpu');}
  else if(data.type==='error'){clearTimeout(timer);partial=null;setBusy(false);$('error').textContent=data.message;render();}
 };
 worker.postMessage({type:'load',device,forceBase});}
$('load').onclick=()=>start('auto');$('cpu').onclick=()=>start('cpu');$('stop').onclick=()=>{retryAfterLoad=false;stop();};
$('form').onsubmit=e=>{e.preventDefault();const text=$('input').value.trim();if(!text||busy||!ready)return;messages.push({role:'user',content:text});$('input').value='';save();generate();};
$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229&&!matchMedia('(pointer: coarse)').matches){e.preventDefault();$('form').requestSubmit();}};
$('new').onclick=()=>{retryAfterLoad=false;if(busy)stop();messages=[];partial=null;save();render();};
rollback.onclick=()=>{retryAfterLoad=false;forceBase=true;saveMode();stop('元モデルへ復元しています。');start('cpu');};
updates.onclick=()=>{retryAfterLoad=false;forceBase=false;saveMode();stop('検証済み学習版を確認しています。');start('cpu');};
async function status(){try{const r=await fetch('/api/chat-learning/status',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('STATUS');const s=await r.json();$('research').textContent=s.available?'会話用の追加検証を通過した学習版：'+s.generation+'\n使用中の版は上の起動表示で確認してください。\n対象：最終正規化層896パラメータ。汎用知能・RSI向上の証明ではありません。':'会話に反映可能な学習版は現在未確認です。元モデルを使用します。';}catch{$('research').textContent='研究記録を取得できません。元モデルで会話できます。';}}
$('refresh').onclick=status;render();status();
