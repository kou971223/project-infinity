"""Read-back test in a new process/job. No training or publication authority."""
import json, pathlib, sys
from contracts import *
from cycle import previous_record

def main():
 prior,_=previous_record();active=check_active(prior.get('activeCheckpoint')) if prior else None
 if not active:
  print(json.dumps({'status':'not_applicable','reason':'NO_ACCEPTED_CHECKPOINT','notClaimed':'inheritance success'}));return 0
 import torch
 from transformers import AutoTokenizer,AutoModelForCausalLM
 torch.set_num_threads(4)
 model=AutoModelForCausalLM.from_pretrained(MODEL,revision=REVISION,trust_remote_code=False,use_safetensors=True,dtype=torch.float32)
 model.eval();parameter=dict(model.named_parameters())[PARAMETER]
 before=digest(parameter.detach().tolist())
 with torch.no_grad():parameter.copy_(torch.tensor(active['values'],dtype=parameter.dtype))
 loaded=digest(parameter.detach().tolist())
 if loaded!=active['weightHash']:raise ValueError('INHERITANCE_HASH_MISMATCH')
 tokenizer=AutoTokenizer.from_pretrained(MODEL,revision=REVISION,trust_remote_code=False)
 inputs=tokenizer.apply_chat_template([{'role':'user','content':'日本語で一文だけ挨拶してください。'}],add_generation_prompt=True,return_tensors='pt',return_dict=True)
 with torch.no_grad():out=model.generate(**inputs,max_new_tokens=32,do_sample=False,pad_token_id=tokenizer.eos_token_id)
 text=tokenizer.decode(out[0,inputs['input_ids'].shape[-1]:],skip_special_tokens=True)
 if not text.strip():raise ValueError('EMPTY_GENERATION')
 print(json.dumps({'status':'inherited_and_generated','sourceRecordHash':prior['recordHash'],'generation':active['generation'],
                   'pretrainedHash':before,'loadedHash':loaded,'output':text,'scope':'fresh CPU researcher instance only; not browser or general capability evidence'},ensure_ascii=False))
 return 0
if __name__=='__main__':sys.exit(main())
