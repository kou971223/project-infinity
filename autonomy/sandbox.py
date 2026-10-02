"""Separate OS-container verification for application-source candidates.
Passing these public tests ONLY creates a reviewable candidate, not a gain claim.
No generated program is imported by the publisher or trusted Python process.
"""
from __future__ import annotations
import json, os, pathlib, selectors, shutil, subprocess, tempfile, time, uuid
from loop import ROOT, save, seal, snapshot, verify, verify_candidate

IMAGE='node:22.16.0-bookworm-slim'
CAP=160000


def capture(args, timeout=120, limit=CAP, env=None):
    p=subprocess.Popen(args,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,
                       env=env,bufsize=0)
    sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ)
    data=bytearray();start=time.monotonic()
    try:
        while sel.get_map():
            if time.monotonic()-start>timeout:
                raise TimeoutError('SANDBOX_TIMEOUT')
            for key,_ in sel.select(0.2):
                chunk=os.read(key.fd,8192)
                if not chunk:sel.unregister(key.fileobj);continue
                data.extend(chunk)
                if len(data)>limit:raise ValueError('SANDBOX_OUTPUT_LIMIT')
        return p.wait(timeout=2),data.decode('utf8',errors='replace')
    finally:
        sel.close()
        if p.poll() is None:p.kill()
        p.wait(timeout=5)


def one_run(root, candidate=None, timeout=110):
    if not shutil.which('docker'):
        return {'status':'unavailable','reason':'DOCKER_NOT_AVAILABLE'}
    name='pinf-verify-'+uuid.uuid4().hex[:12]
    with tempfile.TemporaryDirectory(prefix='pinf-app-') as temp:
        work=pathlib.Path(temp)/'app'
        # Only the source tree and tests; never host credentials, .git or environments.
        def ignored(folder,names):
            return {n for n in names if n in {'.git','.venv','.browserenv','.runtime','node_modules','__pycache__','.pytest_cache'}
                    or n.startswith('.env') or pathlib.Path(folder,n).is_symlink()}
        shutil.copytree(root,work,ignore=ignored)
        if candidate:
            for c in candidate['changes']:
                (work/c['path']).write_text(c['content'],encoding='utf8')
        for p in work.rglob('*'):
            p.chmod(0o755 if p.is_dir() else 0o644)
        os.chmod(temp,0o755);os.chmod(work,0o755)
        # Writable paths contain only fresh scratch data. No Docker socket or tokens.
        args=['docker','run','--rm','--name',name,'--network','none',
              '--cap-drop','ALL','--security-opt','no-new-privileges',
              '--read-only','--memory','512m','--cpus','1','--pids-limit','96',
              '--user','65534:65534','--tmpfs','/tmp:rw,nosuid,size=64m',
              '--tmpfs','/app/.runtime:rw,nosuid,size=32m,mode=1777',
              '-v',str(work)+':/app:ro','-w','/app',IMAGE,'npm','test']
        start=time.monotonic()
        try:
            code,text=capture(args,timeout=timeout)
            return {'status':'passed' if code==0 else 'failed','exitCode':code,
                    'elapsedMs':int((time.monotonic()-start)*1000),'logTail':text[-18000:]}
        except Exception as exc:
            return {'status':'failed','reason':type(exc).__name__+':'+str(exc)}
        finally:
            subprocess.run(['docker','rm','-f',name],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15)


def main():
    file=ROOT/'reports/autonomy.json';record=verify(json.loads(file.read_text()))
    candidate=record.get('candidate')
    if not candidate or record['decision']=='REJECTED':
        record['sandbox']={'status':'not_run','reason':'NO_ELIGIBLE_FROZEN_CANDIDATE'}
        save(file,seal(record));print(json.dumps(record['sandbox']));return 0
    verify_candidate(candidate,snapshot())
    # Resolve and record the actual image digest used; both arms use this image.
    code,_=capture(['docker','pull',IMAGE],timeout=100)
    if code:raise RuntimeError('SANDBOX_IMAGE_UNAVAILABLE')
    code,identity=capture(['docker','image','inspect','--format','{{.Id}}',IMAGE],timeout=15)
    if code or not identity.strip().startswith('sha256:'):raise RuntimeError('IMAGE_IDENTITY_UNKNOWN')
    parent=one_run(ROOT);child=one_run(ROOT,candidate)
    record['sandbox']={'status':'passed' if parent['status']==child['status']=='passed' else 'failed',
        'baseline':parent,'candidate':child,'image':IMAGE,'imageId':identity.strip(),
        'network':'none','credentials':'none','testSource':'unchanged public repository tests',
        'independence':'separate OS processes; shared tests/author; NOT external independent validation',
        'measurement':'regression checks only; no demonstrated capability gain'}
    record['decision']='REVIEW_READY' if record['sandbox']['status']=='passed' else 'REJECTED'
    record['history'][-1]['decision']=record['decision']
    record['history'][-1]['reason']=None if record['decision']=='REVIEW_READY' else 'SOURCE_SANDBOX_FAILED'
    save(file,seal(record));print(json.dumps({'decision':record['decision'],'sandbox':record['sandbox']['status']}))
    return 0


if __name__=='__main__':raise SystemExit(main())
