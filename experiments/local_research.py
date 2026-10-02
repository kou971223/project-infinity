"""Free-CPU integration experiment; never a claim of general intelligence gain.
Public inputs only. Frozen pretrained revision; no inference service or API key.
Model-authored text is saved as DATA, never imported or executed by Python.
"""
from __future__ import annotations
import hashlib, json, math, os, pathlib, platform, random, secrets, signal, statistics, sys, time

MODEL = 'Qwen/Qwen2.5-0.5B-Instruct'
REVISION = '7ae557604adf67be50417f59c2c2f167def9a775'
PROTOCOL = {
    'id': 'PINF-LEARN-NORM-1', 'seed': 104729, 'steps': 8, 'learningRate': 0.0005,
    'trainDocuments': 8, 'confirmDocuments': 12, 'anchorDocuments': 6,
    'maxSequenceTokens': 64, 'minLossReduction': 0.01, 'maxAnchorLossIncrease': 0.05,
    'writableParameter': 'model.norm.weight',
    'promotion': 'none: experimental checkpoint only; not the chat model',
    'stopping': 'exactly eight steps; no post-result tuning',
}
ROOT = pathlib.Path(__file__).resolve().parents[1]

def digest(value):
    raw = value if isinstance(value, bytes) else json.dumps(value, sort_keys=True, ensure_ascii=False).encode()
    return hashlib.sha256(raw).hexdigest()

def save(path, value):
    path = pathlib.Path(path); path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + '.new')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False), encoding='utf-8')
    tmp.replace(path)

def corpus(seed, count):
    rng = random.Random(seed)
    return [f'Experiment {rng.randrange(100000,999999)}. The observation is recorded. '
            f'A candidate is tested against a frozen baseline. If evidence is insufficient, '
            f'the decision is unknown. The measured value is {rng.randrange(10,90)}. '
            f'An unsupported claim is not accepted.' for _ in range(count)]

ANCHORS = [
    'The river flows through the valley. Water is necessary for plants and animals.',
    'A triangle has three sides. A rectangle has four sides and four right angles.',
    'The child reads a book in a quiet room. The story begins on a rainy morning.',
    'An oven heats food. A refrigerator keeps food cold. A spoon can be used for soup.',
    'A computer program contains instructions. Testing can identify some programming errors.',
    'The sun provides light to the Earth. The seasons change throughout the year.',
]

def interval(values, seed=271828):
    if not values or not all(math.isfinite(v) for v in values):
        raise ValueError('NONFINITE_OR_EMPTY_EVIDENCE')
    rng = random.Random(seed); n = len(values)
    draws = sorted(sum(values[rng.randrange(n)] for _ in range(n))/n for _ in range(1000))
    return [draws[24], draws[974]]

def judge(before, after, anchor_before, anchor_after, changed):
    if len(before) != PROTOCOL['confirmDocuments'] or len(after) != len(before):
        raise ValueError('MISSING_CONFIRMATORY_CASES')
    if len(anchor_before) != PROTOCOL['anchorDocuments'] or len(anchor_after) != len(anchor_before):
        raise ValueError('MISSING_ANCHOR_CASES')
    all_values = before + after + anchor_before + anchor_after
    if not all(math.isfinite(v) for v in all_values):
        raise ValueError('NONFINITE_EVIDENCE')
    delta = [a-b for a,b in zip(before,after)]
    gain = statistics.mean(delta); ci = interval(delta)
    regression = statistics.mean(anchor_after)-statistics.mean(anchor_before)
    supported = changed and gain >= PROTOCOL['minLossReduction'] and ci[0] > 0 and regression <= PROTOCOL['maxAnchorLossIncrease']
    return {'decision': 'SUPPORTED_LOCAL_EXPERIMENT' if supported else 'NOT_SUPPORTED',
            'lossReduction': gain, 'ci95': ci, 'anchorLossIncrease': regression,
            'weightsChanged': bool(changed), 'promoted': False,
            'scope': 'single-run synthetic next-token-loss experiment; shared templates; NOT general intelligence or RSI'}

def main():
    start = time.monotonic()
    if hasattr(signal, 'SIGALRM'):
        signal.signal(signal.SIGALRM, lambda *_: (_ for _ in ()).throw(TimeoutError('RESEARCH_TIME_BUDGET')))
        signal.alarm(540)
    os.environ['HF_HUB_DISABLE_TELEMETRY']='1'
    os.environ['TOKENIZERS_PARALLELISM']='false'
    os.environ['DO_NOT_TRACK']='1'
    report = {'version':'0.4.0','status':'running','startedAt':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),
              'model':MODEL,'revision':REVISION,'protocol':PROTOCOL,'protocolHash':digest(PROTOCOL),
              'billing':{'inferenceApiCalls':0,'paidServicesCreated':0},
              'data':{'origin':'project-authored synthetic text','privateConversationUsed':False}}
    save(ROOT/'reports/local-learning.json',report)
    try:
        import torch, transformers
        from transformers import AutoTokenizer, AutoModelForCausalLM
        torch.set_num_threads(min(4, os.cpu_count() or 1)); torch.manual_seed(PROTOCOL['seed'])
        tokenizer = AutoTokenizer.from_pretrained(MODEL, revision=REVISION, trust_remote_code=False)
        model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION,
                   trust_remote_code=False, use_safetensors=True, torch_dtype=torch.float32)
        model.eval(); model.config.use_cache=False
        report['runtime']={'python':platform.python_version(),'torch':torch.__version__,
                           'transformers':transformers.__version__,'device':'cpu','threads':torch.get_num_threads()}
        print('MODEL_LOADED', flush=True)
        baseline = (ROOT/'modules/response-extractor.json').read_text()
        prompt = ('Propose a response-text extraction program in the following JSON array language. '
                  'Return JSON only, with hypothesis and program. No prose or tools. '
                  'Instructions: ["input"], ["get",key,expr], ["map_get",key,expr], '
                  '["flatmap_get",key,expr], ["filter_eq",key,value,expr], ["join","\\n",expr], '
                  '["trim",expr], ["first_nonempty",a,b]. '
                  'Keys: output_text, output, type, content, text, role. '
                  'Only message/output_text/assistant filter literals. '
                  'Do not treat tool or refusal content as answer text. Current program: '+baseline)
        inputs = tokenizer.apply_chat_template([{'role':'user','content':prompt}],
                    tokenize=True, add_generation_prompt=True, return_tensors='pt')
        with torch.no_grad():
            generated = model.generate(inputs, max_new_tokens=192, do_sample=False,
                                       use_cache=True, pad_token_id=tokenizer.eos_token_id)
        raw = tokenizer.decode(generated[0,inputs.shape[-1]:],skip_special_tokens=True)
        save(ROOT/'reports/local-candidate.json',{'status':'generated_unvalidated','model':MODEL,
             'revision':REVISION,'text':raw,'textHash':digest(raw),'maxNewTokens':192})
        print('CANDIDATE_TEXT_GENERATED', flush=True)
        for p in model.parameters(): p.requires_grad_(False)
        parameter = dict(model.named_parameters())[PROTOCOL['writableParameter']]
        parameter.requires_grad_(True)
        before = parameter.detach().clone(); before_hash=digest(before.numpy().tobytes())
        train = corpus(PROTOCOL['seed'],PROTOCOL['trainDocuments'])
        save(ROOT/'reports/learning-preregister.json',{'protocol':PROTOCOL,'protocolHash':digest(PROTOCOL),
             'baseWeightHash':before_hash,'trainHash':digest(train),'frozenBeforeTraining':True})
        optimizer = torch.optim.AdamW([parameter],lr=PROTOCOL['learningRate'],weight_decay=0)
        train_losses=[]
        def encoded(text):
            return tokenizer(text,return_tensors='pt',max_length=PROTOCOL['maxSequenceTokens'],truncation=True)
        for i in range(PROTOCOL['steps']):
            batch=encoded(train[i]); optimizer.zero_grad(set_to_none=True)
            loss=model(**batch,labels=batch['input_ids']).loss
            if not torch.isfinite(loss): raise ValueError('NONFINITE_TRAINING_LOSS')
            loss.backward(); torch.nn.utils.clip_grad_norm_([parameter],1.0); optimizer.step()
            train_losses.append(float(loss.detach()))
        frozen=parameter.detach().clone(); frozen_hash=digest(frozen.numpy().tobytes())
        if not torch.isfinite(frozen).all(): raise ValueError('NONFINITE_WEIGHTS')
        checkpoint={'model':MODEL,'revision':REVISION,'parameter':PROTOCOL['writableParameter'],
                    'values':frozen.tolist(),'baseWeightHash':before_hash,'weightHash':frozen_hash,
                    'modified':True,'license':'Apache-2.0','experimentalOnly':True}
        save(ROOT/'reports/norm-checkpoint.json',checkpoint)
        seed=secrets.randbits(128); confirm=corpus(seed,PROTOCOL['confirmDocuments'])
        def losses(texts):
            out=[]
            with torch.no_grad():
                for text in texts:
                    b=encoded(text); out.append(float(model(**b,labels=b['input_ids']).loss))
            return out
        after_losses=losses(confirm); anchor_after=losses(ANCHORS)
        with torch.no_grad(): parameter.copy_(before)
        base_losses=losses(confirm); anchor_before=losses(ANCHORS)
        result=judge(base_losses,after_losses,anchor_before,anchor_after,before_hash!=frozen_hash)
        report.update({'status':'completed','training':{'stepsCompleted':len(train_losses),
             'parameterCountChanged':int(parameter.numel()),'totalModelParameters':sum(p.numel() for p in model.parameters()),
             'parameter':PROTOCOL['writableParameter'],'beforeHash':before_hash,'afterHash':frozen_hash,
             'trainLosses':train_losses},'result':result,
             'evaluation':{'role':'fresh confirmatory after freeze','seedRevealedAfterDecision':str(seed),
             'before':base_losses,'after':after_losses,'anchorBefore':anchor_before,'anchorAfter':anchor_after,
             'construct':'English next-token loss on synthetic research prose','externalIndependentReplication':False,
             'sharedDependencies':['author','template','tokenizer','pretrained-model']},
             'candidateCheckpointHash':digest(checkpoint),'elapsedSeconds':round(time.monotonic()-start,3),
             'chatModelUpdated':False,'overallProjectAccepted':False})
    except Exception as exc:
        report.update({'status':'error','errorType':type(exc).__name__,'error':str(exc)[:500],
                       'elapsedSeconds':round(time.monotonic()-start,3),'overallProjectAccepted':False})
        save(ROOT/'reports/local-learning.json',report)
        print(json.dumps({'status':'error','error':report['error']}),flush=True)
        return 1
    save(ROOT/'reports/local-learning.json',report)
    print(json.dumps({'status':report['status'],'result':report['result'],'elapsedSeconds':report['elapsedSeconds']}),flush=True)
    return 0

if __name__=='__main__':
    sys.exit(main())
