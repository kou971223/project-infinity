// Adds verified record visibility without reading or transmitting chat history.
const details=document.createElement('details'),title=document.createElement('summary'),text=document.createElement('p');
title.textContent='継続研究・世代継承の記録';text.style.whiteSpace='pre-wrap';text.style.overflowWrap='anywhere';
text.textContent='研究記録を確認しています…';details.append(title,text);
document.getElementById('messages')?.before(details);
const button=document.createElement('button');button.type='button';button.textContent='状態を更新';details.append(button);
async function refresh(){button.disabled=true;try{
 const r=await fetch('/api/autonomy/status',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error('HTTP');const x=await r.json();
 if(!x.available){text.textContent='継続研究の完了記録は未確認です。'+(x.reason||'');return;}
 text.textContent=['最終記録：'+x.at,'実行契機：'+(x.event==='schedule'?'定刻自動実行':x.event==='push'?'コード更新後の実行':x.event),
 '処理状態：'+x.runStatus,'研究モデルの世代：'+x.generationBefore+' → '+x.generationAfter,
 '前世代の採用済み重みを読込：'+(x.inheritedAcceptedCheckpoint?'確認あり':'今回なし'),
 '学習判定：'+x.decision,'ソース候補：'+x.sourceStatus,'外部研究取得：'+x.literatureAccess,
 '対象は研究用モデルの一部分です。会話用モデルへの重み反映・アプリ全体の自動採用は未実施です。'].join('\n');
}catch{text.textContent='研究記録を取得できませんでした。稼働状態は未確認です。';}finally{button.disabled=false;}}
button.onclick=refresh;refresh();
