import express from "express";
import { snapshot } from "./state.js";
import { runResearchCycle } from "./research-cycle.js";

const app=express();
app.use(express.json({limit:"1mb"}));

app.get("/",(_req,res)=>res.type("html").send(`<!doctype html>
<html lang="ja"><head><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Project ∞</title><style>
body{margin:0;background:#080a0e;color:#eef2f7;font:16px system-ui;display:grid;place-items:center;min-height:100vh}
main{width:min(760px,90vw)}h1{font-size:44px;margin:0 0 12px}p{color:#9aa6b7;line-height:1.8}
code{color:#78aaff}.box{border:1px solid #252b35;border-radius:18px;padding:22px;background:#0d1117}
</style></head><body><main><h1>Project ∞</h1><div class="box">
<p>Open-ended AI research infrastructure.</p>
<p>常時研究・Candidate生成・検証・昇格・Rollbackを分離した基盤です。</p>
<p>Health: <code>/health</code> / Status: <code>/api/status</code></p>
</div></main></body></html>`));

app.get("/health",(_req,res)=>res.json({ok:true,version:snapshot().version}));
app.get("/api/status",(_req,res)=>res.json(snapshot()));
app.post("/api/research-cycle",(req,res)=>res.json(runResearchCycle(req.body?.trigger||"manual")));

const port=Number(process.env.PORT||3000);
app.listen(port,()=>console.log(`Project Infinity listening on ${port}`));
