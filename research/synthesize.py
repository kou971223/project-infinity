"""Bounded enumerative program synthesis from examples, not a table of task formulas.
No hidden validation samples, network, generated code execution or publishing authority.
"""
import time
from fractions import Fraction
def synthesize(task,variables,examples,*,seconds=12,max_states=50000):
 deadline=time.monotonic()+seconds;target=tuple(Fraction(e['expected']) for e in examples);seen=set();by_cost={};examined=0
 def insert(cost,tree,values):
  nonlocal examined
  examined+=1
  if values in seen:return None
  if any(v is None or abs(v.numerator)>10**18 or v.denominator>10**12 for v in values):return None
  if len(seen)>=max_states:return None
  seen.add(values);by_cost.setdefault(cost,[]).append((tree,values))
  if values==target:return dict(task=task,expression=tree,hypothesis='Program synthesized from training examples; requires separate held-out validation.')
  return None
 for name in variables:
  answer=insert(1,['var',name],tuple(Fraction(e['args'][name]) for e in examples))
  if answer:return answer,dict(examined=examined,states=len(seen),cost=1)
 for n in [0,1,2,3,10,100]:
  answer=insert(1,['const',str(n)],tuple(Fraction(n) for _ in examples))
  if answer:return answer,dict(examined=examined,states=len(seen),cost=1)
 for cost in [3,5,7]:
  for left_cost in range(cost-2,0,-2):
   right_cost=cost-1-left_cost
   for left,a in list(by_cost.get(left_cost,[])):
    for right,b in list(by_cost.get(right_cost,[])):
     if time.monotonic()>deadline or len(seen)>=max_states:return None,dict(examined=examined,states=len(seen),stop='BUDGET')
     for op in ['mul','div','add','sub']:
      if op=='div' and any(v==0 for v in b):continue
      values=tuple(x*y if op=='mul' else x/y if op=='div' else x+y if op=='add' else x-y for x,y in zip(a,b))
      answer=insert(cost,[op,left,right],values)
      if answer:return answer,dict(examined=examined,states=len(seen),cost=cost)
 return None,dict(examined=examined,states=len(seen),stop='NO_SOLUTION_IN_GRAMMAR')
