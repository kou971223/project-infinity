"""Controlled isolation probe; no generated candidate or private data is used."""
import json, os, pathlib, re, subprocess, tempfile, uuid
image=os.environ.get('PINF_NODE_IMAGE','')
if not re.fullmatch(r'sha256:[0-9a-f]{64}',image):raise ValueError('IMMUTABLE_IMAGE_REQUIRED')
with tempfile.TemporaryDirectory(prefix='pinf-probe-') as d:
 p=pathlib.Path(d);p.chmod(0o755);(p/'fixture').write_text('unchanged');(p/'fixture').chmod(0o444)
 name='pinf-probe-'+uuid.uuid4().hex
 probe="""
 const fs=require('node:fs'),net=require('node:net');
 (async()=>{
  const r={nonroot:process.getuid()!==0,secretsAbsent:!process.env.GH_TOKEN&&!process.env.GITHUB_TOKEN&&!process.env.PINF_SENTINEL};
  try{fs.writeFileSync('/work/fixture','changed');r.readonly=false}catch{r.readonly=true}
  try{fs.writeFileSync('/etc/pinf-probe','x');r.rootReadonly=false}catch{r.rootReadonly=true}
  r.networkBlocked=await new Promise(resolve=>{const s=net.createConnection({host:'192.0.2.1',port:443});s.once('error',()=>resolve(true));s.setTimeout(800,()=>{s.destroy();resolve(true)});s.once('connect',()=>{s.destroy();resolve(false)})});
  console.log(JSON.stringify(r));if(!Object.values(r).every(Boolean))process.exitCode=1;
 })();
 """
 cmd=['docker','run','--rm','--name',name,'--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','32','--memory','128m','--cpus','1','--user','10001:10001','--tmpfs','/tmp:rw,nosuid,noexec,size=16m','--mount',f'type=bind,src={d},dst=/work,readonly',image,'node','-e',probe]
 try:
  r=subprocess.run(cmd,capture_output=True,timeout=12,env={**os.environ,'PINF_SENTINEL':'not-forwarded'})
  if r.returncode!=0:raise RuntimeError('BOUNDARY_PROBE_FAILED:'+r.stderr.decode()[:300])
  result=json.loads(r.stdout);assert all(result.values());assert(p/'fixture').read_text()=='unchanged'
  print(json.dumps({'controlledSandboxProbe':'passed','checks':result,'image':image,'notClaimed':'proof against all container escapes or generated source correctness'}))
 finally:subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=5)
