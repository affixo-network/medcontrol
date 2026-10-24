"""Prepare static machine-translation drafts from public repository UI strings.
Never loaded by MedControl. Never accepts vaults, browser storage or passwords.
"""
import concurrent.futures, hashlib, html, json, os, pathlib, re, sys, time, unicodedata, shutil
import urllib.parse, urllib.request
ROOT=pathlib.Path(__file__).resolve().parents[2]
SOURCE=json.loads((ROOT/'locales/source-ru.json').read_text())
MANIFEST=json.loads((ROOT/'locales/manifest.json').read_text())
MARK=re.compile(r'(?m)^(?:[^\n:：]*?)(\d{4})\s*[:：]')
def request(text,language,source="ru"):
    query=urllib.parse.urlencode(dict(client='gtx',sl=source,tl=language,dt='t',q=text))
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

def protected_request(text, language):
    placeholders=list(dict.fromkeys(re.findall(r'⟦\d+⟧',text)))
    protected=text
    tokens={slot:'ZXQ'+chr(65+i)+'QXZ' for i,slot in enumerate(placeholders)}
    for slot,token in tokens.items():protected=protected.replace(slot,token)
    value=html.unescape(request(protected,language)).strip()
    for slot,token in tokens.items():value=re.sub(re.escape(token),lambda _:slot,value,flags=re.I)
    # Some scripts localize ASCII indices while retaining brackets.
    value=re.sub(r'⟦([^⟧]+)⟧',lambda m:'⟦'+''.join(str(unicodedata.digit(c)) if c.isdigit() else c for c in m.group(1))+'⟧',value)
    if sorted(re.findall(r'⟦\d+⟧',value))!=sorted(re.findall(r'⟦\d+⟧',text)):
        parts=re.split(r'(⟦\d+⟧)',text)
        value=''.join(part if re.fullmatch(r'⟦\d+⟧',part) else html.unescape(request(part,language)).strip() if part.strip() else part for part in parts)
    return value

GLOSSARY={
 'Препарат':'Medication','Препарат *':'Medication *','Приём':'Medication intake','Приём препаратов':'Medication intake',
 'Принято':'Medication taken','Принял':'Taken','Не принято':'Not taken','Случайность':'Accidental tap',
 'Досрочно':'Taken early','Вовремя':'Taken on time','С опозданием':'Taken late','Не выполнен':'Not taken',
 'Расчётный приём':'Scheduled medication intake','Расчётное время':'Scheduled intake time',
 'Фактическое время':'Actual intake time','Фактическое время приёма':'Actual intake time',
 'Фактическое время «Принято»':'Actual time medication was taken',
 'Количество приёма':'Intake quantity','Количество приёма *':'Intake quantity *',
 'Количественное содержание':'Content amount','Количественное содержание *':'Content amount *',
 'Единица содержания':'Content unit','Единица содержания *':'Content unit *',
 'Единица приёма':'Intake unit','Единица приёма *':'Intake unit *',
 'Доза':'Dose','Детали':'Details','Детали *':'Details *','Производитель':'Manufacturer',
 'История приёмов':'Medication intake history','Отмена «Принято»':'Taken mark cancelled',
 'Курс завершён':'Course completed','Завершённые курсы':'Completed courses',
 'Архив':'Archive','Сброс':'Reset','Ввод':'Input',
 'Пн':'Monday','Вт':'Tuesday','Ср':'Wednesday','Чт':'Thursday','Пт':'Friday','Сб':'Saturday','Вс':'Sunday',
}
def apply_glossary(values,language):
    if language=='ru':return values
    pairs=[(key,GLOSSARY[record['source']]) for key,record in SOURCE.items() if record['source'] in GLOSSARY]
    if language=='en':values.update(pairs);return values
    payload='\n'.join(f'MC{i:04d}: {text}' for i,(_,text) in enumerate(pairs))
    result=html.unescape(request(payload,language,source='en'))
    matches=list(MARK.finditer(result))
    parsed={int(m.group(1)):result[m.end():matches[i+1].start() if i+1<len(matches) else len(result)].strip() for i,m in enumerate(matches)}
    for i,(key,text) in enumerate(pairs):
        value=parsed.get(i) or html.unescape(request(text,language,source='en')).strip()
        if not value:raise ValueError('Missing clinical glossary '+language)
        values[key]=value
    return values

def translate(language):
    output=ROOT/'locales/drafts'/f'{language}.json';output.parent.mkdir(parents=True,exist_ok=True)
    existing={}
    prior={}
    if output.exists():
        prior=json.loads(output.read_text())
        existing={key:value for key,value in prior.get('messages',{}).items() if key in SOURCE and isinstance(value,str) and value.strip() and sorted(re.findall(r'⟦\d+⟧',value))==sorted(re.findall(r'⟦\d+⟧',SOURCE[key]['source']))}
        print(f'{language}: reusing {len(existing)} validated message IDs',flush=True)
    if language=='ru':values={k:v['source'] for k,v in SOURCE.items()}
    else:
        values=dict(existing)
        for batch in batches((key,record) for key,record in SOURCE.items() if key not in values):
            payload='\n'.join(f'MC{i:04d}: {text}' for i,(_,text) in enumerate(batch))
            translated=html.unescape(request(payload,language))
            matches=list(MARK.finditer(translated))
            parsed={int(m.group(1)):translated[m.end():matches[i+1].start() if i+1<len(matches) else len(translated)].strip() for i,m in enumerate(matches)}
            for i,(key,text) in enumerate(batch):
                value=parsed.get(i,'')
                if not value or sorted(re.findall(r'⟦\d+⟧',value))!=sorted(re.findall(r'⟦\d+⟧',text)):
                    value=protected_request(text,language)
                if not value or sorted(re.findall(r'⟦\d+⟧',value))!=sorted(re.findall(r'⟦\d+⟧',text)):
                    raise ValueError(f'{language}:{key}: missing translation or changed placeholders')
                values[key]=value
            time.sleep(0.3)
    if prior.get('glossaryVersion')!=2:values=apply_glossary(values,language)
    if set(values)!=set(SOURCE):raise ValueError('Catalog is incomplete')
    result={'language':language,'glossaryVersion':2,'sourceSha256':hashlib.sha256((ROOT/'locales/source-ru.json').read_bytes()).hexdigest(),'provenance':'machine-generated draft; editorial review not established','messages':values}
    output.write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(f'{language}: {len(values)} actual translations',flush=True)
if __name__=='__main__':
    partition=int(sys.argv[1]) if len(sys.argv)>1 else 0
    groups=int(sys.argv[2]) if len(sys.argv)>2 else 19
    out=ROOT/'locales/output';out.mkdir(parents=True,exist_ok=True)
    for record in MANIFEST[partition::groups]:
        translate(record['code'])
        shutil.copy2(ROOT/'locales/drafts'/(record['code']+'.json'),out/(record['code']+'.json'))
