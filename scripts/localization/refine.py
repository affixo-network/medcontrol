"""Align clinical button references in public interface translations. No user data."""
import collections,json,pathlib,re,shutil,sys,time
from translate import ROOT,SOURCE,MANIFEST,GLOSSARY,MARK,request,batches,apply_glossary
NATIVE={'eu','ka','km','fa','th'}
TERMS=['Не принято','Принято','Случайность']
KEYS={row['source']:key for key,row in SOURCE.items()}
TERM=re.compile(r'(?<![А-Яа-яЁё])(?:Не принято|Принято|Случайность)(?![А-Яа-яЁё])')

def restore(value,tokens):
    for token,original in tokens.items():value=re.sub(re.escape(token),lambda _:original,value,flags=re.I)
    return value

def refine(language):
    if language in NATIVE:return
    path=ROOT/'locales/drafts'/(language+'.json')
    if not path.exists():raise ValueError('Missing source catalog '+language)
    catalog=json.loads(path.read_text());values=catalog['messages']
    if set(values)!=set(SOURCE):raise ValueError('Incomplete source catalog '+language)
    if language=='ru':catalog['glossaryVersion']=3;return catalog
    GLOSSARY['Случайность']='Accidental button press'
    values=apply_glossary(values,language)
    targets=[(key,record) for key,record in SOURCE.items() if TERM.search(record['source']) and record['source'] not in GLOSSARY]
    for batch in batches(targets):
        rows=[];tokenMaps=[]
        for key,text in batch:
            tokens={};i=0
            def replace_term(m):
                nonlocal i
                token='ZXQTERM'+chr(65+i)+'QXZ';i+=1
                tokens[token]=values[KEYS[m.group()]];return token
            protected=TERM.sub(replace_term,text)
            for j,slot in enumerate(dict.fromkeys(re.findall(r'⟦\d+⟧',protected))):
                token='ZXQSLOT'+chr(65+j)+'QXZ';tokens[token]=slot;protected=protected.replace(slot,token)
            rows.append(protected);tokenMaps.append(tokens)
        payload='\n'.join(f'MC{i:04d}: {text}' for i,text in enumerate(rows))
        result=request(payload,language);matches=list(MARK.finditer(result))
        parsed={int(m.group(1)):result[m.end():matches[i+1].start() if i+1<len(matches) else len(result)].strip() for i,m in enumerate(matches)}
        for i,(key,source) in enumerate(batch):
            translated=parsed.get(i,'');tokens=tokenMaps[i]
            if not translated or any(len(re.findall(re.escape(token),translated,re.I))!=rows[i].count(token) for token in tokens):translated=request(rows[i],language).strip()
            if not translated or any(len(re.findall(re.escape(token),translated,re.I))!=rows[i].count(token) for token in tokens):raise ValueError('Changed clinical references '+language+':'+key)
            translated=restore(translated,tokens)
            if sorted(re.findall(r'⟦\d+⟧',translated))!=sorted(re.findall(r'⟦\d+⟧',source)):raise ValueError('Changed placeholders '+language+':'+key)
            values[key]=translated
        time.sleep(.3)
    catalog['messages']=values;catalog['glossaryVersion']=3
    catalog['provenance']='machine translation with medication glossary and aligned clinical button references; native editorial review not established'
    print(f'{language}: refined {len(targets)} clinical messages; {len(values)} total',flush=True)
    return catalog
if __name__=='__main__':
    part=int(sys.argv[1]);groups=int(sys.argv[2]);out=ROOT/'locales/output';out.mkdir(parents=True,exist_ok=True)
    for row in MANIFEST[part::groups]:
        catalog=refine(row['code'])
        if catalog:(out/(row['code']+'.json')).write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n')
