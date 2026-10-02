const $=id=>document.getElementById(id);
const layout=document.createElement('style');layout.textContent='.intro.ready h1,.intro.ready p,.intro.ready .actions{display:none}.intro.ready{padding:10px 16px}.message{scroll-margin-bottom:160px}';document.head.append(layout);
let worker=null,ready=false,busy=false,timer=null,messages=[],partial=null;
try{const x=JSON.parse(localStorage.getItem('pinf-local-chat-v1')||'[]');if(Array.isArray(x))messages=x.filter(m=>['user','assistant'].includes(m.role)&&typeof m.content==='string').slice(-20);}catch{}
function save(){try{localStorage.setItem('pinf-local-chat-v1',JSON.stringify(messages.slice(-20)));}catch{$('error').textContent='保存容量が不足しています。会話は画面に残りますが、再読込すると失われる場合があります。';}}
function render(){const list=$('messages');list.replaceChildren();for(const m of messages){const el=document.createElement('div');el.className='message '+m.role;const role=document.createElement('span');role.className='role';role.textContent=m.role==='user'?'あなた':'端末内AI';el.append(role,document.createTextNode(m.content));list.append(el);}if(partial!==null){const el=document.createElement('div');el.className='message';el.textContent=partial||'考えています…';list.append(el);}}
function setBusy(x){busy=x;$('send').disabled=x||!ready;$('load').disabled=x||ready;$('cpu').disabled=x||ready;$('stop').hidden=!x;}
function stop(message='処理を停止しました。再開にはAIを起動してください。'){clearTimeout(timer);worker?.terminate();worker=null;ready=false;partial=null;$('intro').classList.remove('ready');setBusy(false);$('progress').textContent=message;render();}
function start(device){if(busy||ready)return;worker?.terminate();worker=new Worker('/chat-worker.js',{type:'module'});$('error').textContent='';$('progress').textContent='モデルを読み込んでいます。初回は時間がかかります。';setBusy(true);timer=setTimeout(()=>stop('読込が時間上限に達しました。通信・空きメモリを確認してください。'),300000);
 worker.onerror=e=>{stop();$('error').textContent=e.message||'端末内AIを起動できませんでした。';};
 worker.onmessage=({data})=>{if(data.type==='progress'){$('progress').textContent='モデル読込 '+(data.file||'')+(data.progress===null?'':' '+Math.round(data.progress)+'%');}
 else if(data.type==='ready'){clearTimeout(timer);ready=true;$('intro').classList.add('ready');setBusy(false);$('progress').textContent='起動済み：'+(data.device==='webgpu'?'端末GPU':'端末CPU');$('input').placeholder='Project ∞ にメッセージ';}
 else if(data.type==='delta'){partial=data.text;render();}
 else if(data.type==='done'){clearTimeout(timer);messages.push({role:'assistant',content:data.text});partial=null;setBusy(false);save();render();$('messages').lastElementChild?.scrollIntoView({block:'end'});}
 else if(data.type==='error'){clearTimeout(timer);partial=null;setBusy(false);$('error').textContent=data.message;render();}};
 worker.postMessage({type:'load',device});}
$('load').onclick=()=>start('auto');$('cpu').onclick=()=>start('cpu');$('stop').onclick=()=>stop();
$('form').onsubmit=e=>{e.preventDefault();const text=$('input').value.trim();if(!text||busy||!ready)return;messages.push({role:'user',content:text});$('input').value='';partial='';setBusy(true);save();render();timer=setTimeout(()=>stop('応答が時間上限に達しました。内容を短くして再実行してください。'),180000);worker.postMessage({type:'chat',messages:messages.slice(-6).map(m=>({...m,content:m.content.slice(0,2000)}))});};
$('input').onkeydown=e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing&&e.keyCode!==229&&!matchMedia('(pointer: coarse)').matches){e.preventDefault();$('form').requestSubmit();}};
$('new').onclick=()=>{if(busy)stop();messages=[];partial=null;save();render();};
async function status(){try{const r=await fetch('/api/free/status',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw new Error('HTTP '+r.status);const s=await r.json(),x=s.research;$('research').textContent=x?.available?['最終記録：'+x.at,'学習処理：'+x.learningStatus,'実際の重み変更：'+(x.weightsChanged?'あり':'確認なし'),'更新対象パラメータ数：'+(x.parameterCount??'未確認'),'学習実験判定：'+(x.learningDecision??'未判定'),'コード候補：'+(x.codeDecision??'未判定'),'チャットへの重み反映：未実施'].join('\n'):'完了した研究記録をまだ取得できていません。設定済みでも稼働済みとは扱いません。';}catch{$('research').textContent='記録の取得に失敗しました。研究の完了状態は未確認です。';}}
$('refresh').onclick=status;render();status();
