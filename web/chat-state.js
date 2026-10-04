/** Browser-local conversations; pending turns survive reload as retryable errors. */
export const KEY='pinf-conversations-v2';
export const LEGACY_KEY='pinf-remote-chat-v1';
export function newChat(){return {id:crypto.randomUUID(),title:'新しい会話',updatedAt:new Date().toISOString(),messages:[]};}
export function cleanCitations(x){return (Array.isArray(x)?x:[]).filter(c=>c&&typeof c.title==='string'&&typeof c.url==='string'&&(/^https:\/\/arxiv\.org\/abs\/\d{4}\.\d{4,5}(?:v\d+)?$/.test(c.url)||/^https:\/\/huggingface\.co\/docs\/transformers\.js\/v3\.8\.1\/guides\/(webgpu|dtypes)$/.test(c.url))).slice(0,3).map(c=>({title:c.title.slice(0,300),url:c.url,checkedAt:String(c.checkedAt||'').slice(0,40),kind:String(c.kind||'').slice(0,50)}));}
export function cleanMessages(messages){return (Array.isArray(messages)?messages:[]).filter(m=>m&&['user','assistant'].includes(m.role)&&typeof m.content==='string'&&m.content.length<=8000).map(m=>({role:m.role,content:m.content,status:['pending','failed','cancelled'].includes(m.status)?'failed':'complete',...(m.citations?{citations:cleanCitations(m.citations)}:{})})).slice(-200);}
export function loadState(storage){
  try{const data=JSON.parse(storage.getItem(KEY)||'null');
    if(data?.version===2&&Array.isArray(data.chats)){
      const chats=data.chats.filter(c=>c&&typeof c.id==='string'&&Array.isArray(c.messages)).slice(-50).map(c=>({id:c.id,title:String(c.title||'会話').slice(0,60),updatedAt:String(c.updatedAt||''),messages:cleanMessages(c.messages)}));
      if(chats.length)return {version:2,chats,activeId:chats.some(c=>c.id===data.activeId)?data.activeId:chats[0].id};
    }
  }catch{}
  const chat=newChat();try{chat.messages=cleanMessages(JSON.parse(storage.getItem(LEGACY_KEY)||'[]'));if(chat.messages.length)chat.title=chat.messages[0].content.slice(0,40);}catch{}
  return {version:2,chats:[chat],activeId:chat.id};
}
export function contextFor(chat){
  const completed=chat.messages.filter(m=>m.status==='complete');const last=chat.messages.at(-1);
  if(last?.role==='user'&&last.status!=='complete')completed.push(last);
  let length=0;const chosen=[];
  for(const m of completed.slice(-8).reverse()){
    if(length+m.content.length>14000)break;length+=m.content.length;chosen.unshift({role:m.role,content:m.content});
  }
  while(chosen[0]?.role==='assistant')chosen.shift();
  return chosen;
}
