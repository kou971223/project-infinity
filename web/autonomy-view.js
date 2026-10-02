const box=document.getElementById('autonomy');
async function refresh(){
  if(!box||document.hidden)return;
  try{
    const res=await fetch('/api/autonomy/status',{signal:AbortSignal.timeout(15000)});
    if(!res.ok)throw Error('status');const r=await res.json();
    if(!r.available){box.textContent='研究履歴をまだ確認できていません。実行成功とは扱いません。';return;}
    const labels={REVIEW_READY:'コード候補を検査済み・採用待ち',REJECTED:'今回の候補は棄却',NO_CHANGE:'変更なし',DEFER:'情報不足で保留',SOURCE_CANDIDATE_FROZEN:'候補を固定・検証待ち'};
    box.textContent=[
      '研究記録 #'+r.generation+'（知能の世代番号ではありません）',
      '最終実行: '+new Date(r.at).toLocaleString('ja-JP'),
      '起動理由: '+(r.event==='schedule'?'定期実行':r.event==='push'?'コード更新に伴う実行':r.event),
      '前回結果の継承: '+(r.parentRecordHash?'確認済み':'初回'),
      '今回: '+(labels[r.decision]||r.decision),
      '対象: '+(r.path||'新しい課題を待機'),
      '検査: '+r.sandbox,
      '変更候補ブランチ: '+(r.sourceBranch||'なし'),
      r.stale?'記録が古い、または最新取得に失敗しています。':'',
      '本番コード・会話モデルへの自動採用: 未実施'
    ].filter(Boolean).join('\n');
  }catch{box.textContent='研究履歴の取得に失敗しました。最新状態は未確認です。';}
}
document.getElementById('refresh')?.addEventListener('click',refresh);
document.addEventListener('visibilitychange',()=>{if(!document.hidden)refresh();});
refresh();setInterval(()=>{if(!document.hidden)refresh();},120000);
