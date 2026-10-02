// All evidence is displayed as text. No model HTML, instructions, credentials or user chats are published.
const host=document.querySelector('main')||document.body;
const detail=document.createElement('details'),title=document.createElement('summary'),text=document.createElement('pre');
title.textContent='コード更新・外部資料の実行記録';text.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px;line-height:1.6';detail.append(title,text);host.append(detail);
try{
 const r=await fetch('/api/runtime/status',{signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error();const x=await r.json();
 text.textContent=x.available?['最終記録：'+x.at,'実行契機：'+(x.event==='schedule'?'定期実行':x.event),'判定：'+x.decision,'今回のコード反映：'+(x.applied?'あり':'なし'),'取得できた一次資料：'+x.sourceCount,'対象：端末内AIの起動・障害復旧。基盤モデルの総合知能向上とは別です。',...x.sources.map(s=>s.title+'\n'+s.url+'\n確認範囲：'+s.status)].join('\n'):'研究記録を取得できていません。完了・稼働は未確認です。';
}catch{text.textContent='実行記録の読込に失敗しました。';}
