"""Merge public catalog artifacts deterministically, without concurrent file writes."""
import json,pathlib,re,shutil
ROOT=pathlib.Path(__file__).resolve().parents[2]
source=json.loads((ROOT/'locales/source-ru.json').read_text())
manifest={x['code'] for x in json.loads((ROOT/'locales/manifest.json').read_text())}
best={}
for path in (ROOT/'locales/seed').rglob('*.json'):
    try:
        # Older parallel downloads occasionally left trailing bytes; accept only a complete first JSON object.
        data,end=json.JSONDecoder().raw_decode(path.read_text().lstrip())
        code=data.get('language')
        if code not in manifest or not isinstance(data.get('messages'),dict):continue
        messages={k:v for k,v in data['messages'].items() if k in source and isinstance(v,str) and v.strip() and sorted(re.findall(r'⟦\d+⟧',v))==sorted(re.findall(r'⟦\d+⟧',source[k]['source']))}
        if not messages:continue
        data['messages']=messages
        score=(len(messages),data.get('glossaryVersion',0))
        if code not in best or score>best[code][0]:best[code]=(score,data)
    except (ValueError,TypeError,OSError):continue
out=ROOT/'locales/drafts';out.mkdir(parents=True,exist_ok=True)
for code,(_,data) in best.items():(out/(code+'.json')).write_text(json.dumps(data,ensure_ascii=False)+'\n')
print('Validated seed catalogs:',len(best))
