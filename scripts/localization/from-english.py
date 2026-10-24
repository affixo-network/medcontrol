"""Translate reviewed public English UI, preserving units and named UI controls."""
import hashlib,html,json,pathlib,re,sys,time
from translate import ROOT,SOURCE,MANIFEST,MARK,request
SKIP={'ru','en','eu','ka','km','fa','th','ro'}
MASTER=json.loads((ROOT/'locales/catalogs/en.json').read_text())
MASTER_HASH=hashlib.sha256((ROOT/'locales/catalogs/en.json').read_bytes()).hexdigest()
KEYS={row['source']:key for key,row in SOURCE.items()}
LABELS=['Препарат','Принято','Не принято','Случайность','Исправить','Ввод','Приём препаратов','Табло','Архив','Войти','Восстановить доступ','Сохранить','Отменить','Добавить','Закрыть','Повторить загрузку','Минуты','Часы']
BASE=[KEYS[label] for label in LABELS if label in KEYS]
SYMBOLS={'мкг':'µg','мг':'mg','г':'g','кг':'kg','мл':'mL','л':'L','МЕ':'IU','мг/мл':'mg/mL','мкг/мл':'µg/mL','мг/г':'mg/g'}
def chunks(rows):
    batch=[];size=0
    for row in rows:
        n=len(row[1].encode())+15
        if batch and size+n>2200:yield batch;batch=[];size=0
        batch.append(row);size+=n
    if batch:yield batch

def request_batch(rows,language):
    result=html.unescape(request('\n'.join(f'MC{i:04d}: {text}' for i,(_,text,_) in enumerate(rows)),language,source='en'))
    marks=list(MARK.finditer(result))
    return {int(m.group(1)):result[m.end():marks[i+1].start() if i+1<len(marks) else len(result)].strip() for i,m in enumerate(marks)}

def protect(text,references):
    tokens={};index=0
    # Opaque markers contain no numerals, keeping non-Latin numeral localization harmless.
    def token(value):
        nonlocal index
        name='ZXQ'+chr(65+index//26)+chr(65+index%26)+'QXZ';index+=1;tokens[name]=value;return name
    patterns={phrase:value for phrase,value in references.items() if phrase and len(phrase)>2}
    if patterns:
        expression=re.compile(r'(?<![A-Za-z])(?:'+'|'.join(re.escape(x) for x in sorted(patterns,key=len,reverse=True))+r')(?![A-Za-z])')
        text=expression.sub(lambda m:token(patterns[m.group()]),text)
    text=re.sub(r'⟦\d+⟧',lambda m:token(m.group()),text)
    units=re.compile(r'(?<![A-Za-z])(?:µg/mL|mg/mL|mg/g|µg|mcg|mg|kg|mL|IU|g|L)(?![A-Za-z])')
    text=units.sub(lambda m:token('µg' if m.group()=='mcg' else m.group()),text)
    return text,tokens

def translate_rows(keys,language,values,references):
    prepared=[]
    for key in keys:
        text=MASTER['messages'][key]
        protected,tokens=protect(text,references)
        prepared.append((key,protected,tokens))
    segmented=0
    for batch in chunks(prepared):
        parsed=request_batch(batch,language)
        for i,(key,protected,tokens) in enumerate(batch):
            translated=parsed.get(i,'')
            good=lambda value:(bool(value) and not re.search(r'(?i)\bMC\s*\d{4}\s*[:：]|ZXQ[A-Z]{2,}QXZ',value.replace(' ','')) and all(len(re.findall(re.escape(t),value,re.I))==protected.count(t) for t in tokens))
            if not good(translated):translated=html.unescape(request(protected,language,source='en')).strip()
            if not good(translated):
                # Last resort preserves every clinical label/data slot; never invent or drop one.
                expression='('+'|'.join(re.escape(t) for t in tokens)+')'
                parts=re.split(expression,protected)
                translated=''.join(part if part in tokens or not part.strip() else html.unescape(request(part,language,source='en')).strip() for part in parts)
                segmented+=1
            if not good(translated):raise ValueError('Corrupt translation or lost UI/data placeholders '+language+':'+key)
            for name,value in tokens.items():translated=re.sub(re.escape(name),lambda _:value,translated,flags=re.I)
            if sorted(re.findall(r'⟦\d+⟧',translated))!=sorted(re.findall(r'⟦\d+⟧',SOURCE[key]['source'])):raise ValueError('Invalid source placeholder '+language+':'+key)
            values[key]=translated
        time.sleep(.3)
    return segmented

def locale(code):
    values={};segmented=translate_rows(BASE,code,values,{})
    refs={MASTER['messages'][key]:values[key] for key in BASE}
    segmented+=translate_rows([key for key in SOURCE if key not in values],code,values,refs)
    for key,record in SOURCE.items():
        if record['source'] in SYMBOLS:values[key]=SYMBOLS[record['source']]
    if set(values)!=set(SOURCE):raise ValueError('Incomplete reviewed-source catalog '+code)
    result={'language':code,'glossaryVersion':4,'englishMasterSha256':MASTER_HASH,'provenance':'machine translation from AI-reviewed English UI; units and named clinical controls preserved; native editorial review not established','segmentedFallbackMessages':segmented,'messages':values}
    out=ROOT/'locales/output';out.mkdir(parents=True,exist_ok=True);(out/(code+'.json')).write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f'{code}: {len(values)} reviewed-source translations; fallback segments {segmented}',flush=True)
if __name__=='__main__':
    if set(MASTER['messages'])!=set(SOURCE):raise ValueError('English master coverage mismatch')
    failed=[]
    for row in MANIFEST[int(sys.argv[1])::int(sys.argv[2])]:
        if row['code'] in SKIP:continue
        try:locale(row['code'])
        except Exception as error:print(row['code']+': '+str(error),flush=True);failed.append(row['code'])
    if failed:raise SystemExit('Incomplete locales: '+','.join(failed))
