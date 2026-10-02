"""Execute proposed app code only in a disposable networkless container.
A passing smoke test is NOT sufficient evidence to merge arbitrary app changes.
"""
from __future__ import annotations
import json, os, pathlib, re, shutil, subprocess, tempfile, uuid
from contracts import digest,validate_patch

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
          r=subprocess.run(cmd,capture_output=True,timeout=100)
          # Do not trust generated stdout as a correctness attestation.
          results[lane]={'exitCode':r.returncode,'logHash':digest(r.stdout+r.stderr),'bytes':len(r.stdout)+len(r.stderr)}
        except subprocess.TimeoutExpired:
          results[lane]={'exitCode':None,'timeout':True}
        finally:
          subprocess.run(['docker','rm','-f',name],capture_output=True,timeout=10)
    return {'status':'executed','image':image,'results':results,'promoted':False,
            'decision':'SOURCE_REVIEW_REQUIRED',
            'limitation':'Exit status is smoke evidence only; shared tests and candidate-controlled runtime cannot authorize application-wide promotion.'}
