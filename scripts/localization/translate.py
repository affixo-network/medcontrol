"""Prepare static machine-translation drafts from public repository UI strings.
Never loaded by MedControl. Never accepts vaults, browser storage or passwords.
"""
import concurrent.futures, hashlib, html, json, os, pathlib, re, sys, time
import urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=json.loads((ROOT/'locales/source-ru.json').read_text())
MANIFEST=json.loads((ROOT/'locales/manifest.json').read_text())
MARK=re.compile(r'MC([0-9]{4})\s*[:：]')
def request(text,language):
    query=urllib.parse.urlencode(dict(client='gtx',sl='ru',tl=language,dt='t',q=text))
    req=urllib.request.Request('https://translate.googleapis.com/translate_a/single?'+query,headers={'User-Agent':'MedControl-public-interface-localization/1.0'})
    for attempt in range(5):
        try:
            with urllib.request.urlopen(req,timeout=45) as response:
                data=json.load(response)
            return ''.join(row[0] or '' for row in data[0])
        except Exception:
            if attempt==4: raise
            time.sleep(min(60,5*2**attempt))
def batches(items):
    batch=[];size=0
    for key,record in items:
        text=record['source'];n=len(text.encode())+15
        if batch and size+n>3000:
            yield batch;batch=[];size=0
        batch.append((key,text));size+=n
    if batch:yield batch

def translate(language):
    output=ROOT/'locales/drafts'/f'{language}.json';output.parent.mkdir(parents=True,exist_ok=True)
    if language=='ru':values={k:v['source'] for k,v in SOURCE.items()}
    else:
        values={}
        for batch in batches(SOURCE.items()):
            payload='\n'.join(f'MC{i:04d}: {text}' for i,(_,text) in enumerate(batch))
            translated=html.unescape(request(payload,language))
            matches=list(MARK.finditer(translated))
            parsed={int(m.group(1)):translated[m.end():matches[i+1].start() if i+1<len(matches) else len(translated)].strip() for i,m in enumerate(matches)}
            for i,(key,text) in enumerate(batch):
                value=parsed.get(i,'')
                if not value or sorted(re.findall(r'⟦\d+⟧',value))!=sorted(re.findall(r'⟦\d+⟧',text)):
                    value=html.unescape(request(text,language)).strip()
                if not value or sorted(re.findall(r'⟦\d+⟧',value))!=sorted(re.findall(r'⟦\d+⟧',text)):
                    raise ValueError(f'{language}:{key}: missing translation or changed placeholders')
                values[key]=value
            time.sleep(0.3)
    if set(values)!=set(SOURCE):raise ValueError('Catalog is incomplete')
    result={'language':language,'sourceSha256':hashlib.sha256((ROOT/'locales/source-ru.json').read_bytes()).hexdigest(),'provenance':'machine-generated draft; editorial review not established','messages':values}
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f'{language}: {len(values)} actual translations',flush=True)
if __name__=='__main__':
    partition=int(sys.argv[1]) if len(sys.argv)>1 else 0
    groups=int(sys.argv[2]) if len(sys.argv)>2 else 19
    for record in MANIFEST[partition::groups]:translate(record['code'])
