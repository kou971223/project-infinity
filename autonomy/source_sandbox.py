"""Execute proposed app code only in a disposable networkless container.
A passing smoke test is NOT sufficient evidence to merge arbitrary app changes.
"""
from __future__ import annotations
import json, os, pathlib, re, shutil, subprocess, tempfile, uuid, selectors, time
from contracts import digest,validate_patch

def bounded_process(cmd, *, timeout=100, max_output=2000000):
    p=subprocess.Popen(cmd,stdout=subprocess.PIPE,stderr=subprocess.STDOUT)
    selector=selectors.DefaultSelector();selector.register(p.stdout,selectors.EVENT_READ)
    chunks=[];size=0;reason=None;deadline=time.monotonic()+timeout
    try:
      while True:
        if time.monotonic()>deadline:reason='TIMEOUT';break
        events=selector.select(.1)
        if events:
          b=os.read(p.stdout.fileno(),16384)
          if not b:break
          size+=len(b)
          if size>max_output:reason='OUTPUT_LIMIT';break
          chunks.append(b)
        elif p.poll() is not None:break
      if reason:p.kill()
      code=p.wait(timeout=5)
      return {'exitCode':code,'limit':reason,'bytes':size,'logHash':digest(b''.join(chunks))}
    finally:
      if p.poll() is None:p.kill();p.wait(timeout=5)
      selector.close();p.stdout.close()

def verify_patch_in_docker(patch, root, *, image=None):
    patch=validate_patch(patch,root)
    if not shutil.which('docker'):return {'status':'unavailable','reason':'DOCKER_UNAVAILABLE','promoted':False}
    image=image or os.environ.get('PINF_NODE_IMAGE','')
    if not re.fullmatch(r'sha256:[0-9a-f]{64}',image):return {'status':'unavailable','reason':'IMMUTABLE_IMAGE_ID_REQUIRED','promoted':False}
    tracked=subprocess.run(['git','ls-files','-z'],cwd=root,check=True,capture_output=True).stdout.decode().split('\0')
    results={}
    for lane in ['baseline','candidate']:
      with tempfile.TemporaryDirectory(prefix='pinf-source-') as directory:
        work=pathlib.Path(directory)
        for name in tracked:
          if not name or name.startswith(('.git/','.runtime/','.venv/','reports/')):continue
          p=pathlib.Path(root)/name
          if p.is_symlink():raise ValueError('SYMLINK_SOURCE')
          if p.is_file():
            target=work/name;target.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,target);target.chmod(0o644)
        if lane=='candidate':(work/patch['path']).write_text(patch['content'],encoding='utf-8')
        work.chmod(0o755)
        for d in work.rglob('*'):
          if d.is_dir():d.chmod(0o755)
        name='pinf-eval-'+uuid.uuid4().hex
        cmd=['docker','run','--name',name,'--rm','--network','none','--read-only','--cap-drop','ALL',
             '--security-opt','no-new-privileges','--pids-limit','64','--memory','768m','--cpus','1',
             '--user','10001:10001','--tmpfs','/tmp:rw,nosuid,noexec,size=128m',
             '--mount',f'type=bind,src={work},dst=/work,readonly','--workdir','/work',image,
             'sh','-c','node --test test/*.test.js']
        try:
          results[lane]=bounded_process(cmd)
        finally:
          subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=10)
    return {'status':'executed','image':image,'results':results,'promoted':False,
            'decision':'SOURCE_REVIEW_REQUIRED',
            'limitation':'Exit status is smoke evidence only; shared tests and candidate-controlled runtime cannot authorize application-wide promotion.'}
