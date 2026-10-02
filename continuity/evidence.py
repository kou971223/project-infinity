"""Bounded primary-source ingestion. Downloads are evidence, never instructions.
No arbitrary user URLs or paid APIs. Full HTML retrieval != verified paper claim.
"""
from __future__ import annotations
import hashlib, json, pathlib, time, urllib.request, urllib.parse, xml.etree.ElementTree as ET
from html.parser import HTMLParser
SOURCES=(
 ('HF-WEBGPU-3.8.1','https://huggingface.co/docs/transformers.js/v3.8.1/guides/webgpu','official_versioned_documentation'),
 ('HF-DTYPES-3.8.1','https://huggingface.co/docs/transformers.js/v3.8.1/guides/dtypes','official_versioned_documentation'),
 ('ARXIV-AI-RSS','https://rss.arxiv.org/rss/cs.AI','primary_abstract_feed'))
ALLOWED={u for _,u,_ in SOURCES}
def sha(b):return hashlib.sha256(b if isinstance(b,bytes) else b.encode()).hexdigest()
class NoRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,*args,**kwargs):raise ValueError('REDIRECT_DENIED')
class Text(HTMLParser):
 def __init__(self):super().__init__();self.skip=0;self.parts=[]
 def handle_starttag(self,tag,attrs):
  if tag in ('script','style'):self.skip+=1
 def handle_endtag(self,tag):
  if tag in ('script','style') and self.skip:self.skip-=1
 def handle_data(self,data):
  if not self.skip:self.parts.append(data)
def retrieve(url):
 if url not in ALLOWED:raise ValueError('URL_NOT_ALLOWLISTED')
 req=urllib.request.Request(url,headers={'User-Agent':'ProjectInfinity-Research/0.6','Accept':'text/html,application/rss+xml,application/xml'})
 with urllib.request.build_opener(NoRedirect).open(req,timeout=12) as response:
  data=response.read(1000001)
  if len(data)>1000000:raise ValueError('SOURCE_TOO_LARGE')
  return data

def collect(fetcher=retrieve):
 rows=[];items=[]
 for sid,url,kind in SOURCES:
  row={'id':sid,'url':url,'kind':kind,'at':time.strftime('%Y-%m-%dT%H:%M:%SZ',time.gmtime()),'claimVerification':'not_adjudicated','dependencyCluster':'huggingface-docs' if sid.startswith('HF') else 'arxiv-feed'}
  try:
   raw=fetcher(url)
   if not isinstance(raw,bytes) or len(raw)>1000000:raise ValueError('SOURCE_TOO_LARGE_OR_INVALID')
   text=raw.decode('utf-8');row.update(access='fetched',sha256=sha(raw),bytes=len(raw))
   if kind=='primary_abstract_feed':
    root=ET.fromstring(text)
    for item in root.findall('.//item')[:3]:
     link=item.findtext('link','')
     u=urllib.parse.urlsplit(link)
     if u.scheme not in ('http','https') or u.hostname not in ('arxiv.org','export.arxiv.org'):continue
     items.append({'title':item.findtext('title','')[:300],'url':link,'status':'metadata_only_not_fulltext_verified'})
    row['scope']='feed_only'
   else:
    p=Text();p.feed(text);plain=' '.join(' '.join(p.parts).split())
    marker='Due to the experimental nature' if 'WEBGPU' in sid else 'The list of available quantizations'
    i=plain.find(marker)
    if i<0:i=plain.find('Usage in Transformers.js')
    row.update(scope='documentation_body_retrieved',excerpt=plain[max(0,i):max(0,i)+1000],sourceStatus='available_at_access')
    items.append({'title':'Transformers.js 3.8.1 '+('WebGPU' if 'WEBGPU' in sid else 'dtypes'),'url':url,'status':'official_document_body_retrieved_not_independent_validation'})
  except Exception as e:row.update(access='unavailable',errorType=type(e).__name__,scope='unverified')
  rows.append(row)
 return {'schema':'PINF-SOURCES-1','access':'fetched' if any(r['access']=='fetched' for r in rows) else 'unavailable','items':items,'sources':rows,
  'sourceCount':sum(r['access']=='fetched' for r in rows),'independentEvidenceCount':'not_established','privateDataUsed':False,
  'limits':['Source retrieval is not claim confirmation or independent replication','No feed item is called a fully read paper','All failures retained; no inference from failed access']}

def write(file,record):
 p=pathlib.Path(file);p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(record,ensure_ascii=False,indent=2),encoding='utf-8')
if __name__=='__main__':
 r=collect();write('reports/runtime-sources.json',r);print(json.dumps({'access':r['access'],'sourceCount':r['sourceCount']}))
