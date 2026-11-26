/* Canonical Modular-3 entry language policy. Public assets only; never handles medical data. */
(function(root){
 'use strict';
 const registry=Object.freeze([{"id":1,"code":"ru","name":"русский","englishName":"Russian","direction":"ltr"},{"id":2,"code":"en","name":"English","englishName":"English","direction":"ltr"},{"id":3,"code":"fr","name":"français","englishName":"French","direction":"ltr"},{"id":4,"code":"de","name":"Deutsch","englishName":"German","direction":"ltr"},{"id":5,"code":"es","name":"español","englishName":"Spanish","direction":"ltr"},{"id":6,"code":"it","name":"italiano","englishName":"Italian","direction":"ltr"},{"id":7,"code":"pt","name":"português","englishName":"Portuguese","direction":"ltr"},{"id":8,"code":"af","name":"Afrikaans","englishName":"Afrikaans","direction":"ltr"},{"id":9,"code":"am","name":"አማርኛ","englishName":"Amharic","direction":"ltr"},{"id":10,"code":"ar","name":"العربية","englishName":"Arabic","direction":"rtl"},{"id":11,"code":"az","name":"azərbaycan","englishName":"Azerbaijani","direction":"ltr"},{"id":12,"code":"be","name":"беларуская","englishName":"Belarusian","direction":"ltr"},{"id":13,"code":"bg","name":"български","englishName":"Bulgarian","direction":"ltr"},{"id":14,"code":"bn","name":"বাংলা","englishName":"Bangla","direction":"ltr"},{"id":15,"code":"bs","name":"bosanski","englishName":"Bosnian","direction":"ltr"},{"id":16,"code":"ca","name":"català","englishName":"Catalan","direction":"ltr"},{"id":17,"code":"cs","name":"čeština","englishName":"Czech","direction":"ltr"},{"id":18,"code":"da","name":"dansk","englishName":"Danish","direction":"ltr"},{"id":19,"code":"nl","name":"Nederlands","englishName":"Dutch","direction":"ltr"},{"id":20,"code":"et","name":"eesti","englishName":"Estonian","direction":"ltr"},{"id":21,"code":"fi","name":"suomi","englishName":"Finnish","direction":"ltr"},{"id":22,"code":"fy","name":"Frysk","englishName":"Western Frisian","direction":"ltr"},{"id":23,"code":"el","name":"Ελληνικά","englishName":"Greek","direction":"ltr"},{"id":24,"code":"gu","name":"ગુજરાતી","englishName":"Gujarati","direction":"ltr"},{"id":25,"code":"he","name":"עברית","englishName":"Hebrew","direction":"rtl"},{"id":26,"code":"hi","name":"हिन्दी","englishName":"Hindi","direction":"ltr"},{"id":27,"code":"gl","name":"galego","englishName":"Galician","direction":"ltr"},{"id":28,"code":"ka","name":"ქართული","englishName":"Georgian","direction":"ltr"},{"id":29,"code":"sq","name":"shqip","englishName":"Albanian","direction":"ltr"},{"id":30,"code":"hy","name":"հայերեն","englishName":"Armenian","direction":"ltr"},{"id":31,"code":"eu","name":"euskara","englishName":"Basque","direction":"ltr"},{"id":32,"code":"ceb","name":"Cebuano","englishName":"Cebuano","direction":"ltr"},{"id":33,"code":"zh","name":"中文","englishName":"Chinese","direction":"ltr"},{"id":34,"code":"co","name":"Corsican","englishName":"Corsican","direction":"ltr"},{"id":35,"code":"hr","name":"hrvatski","englishName":"Croatian","direction":"ltr"},{"id":36,"code":"eo","name":"Esperanto","englishName":"Esperanto","direction":"ltr"},{"id":37,"code":"ht","name":"Haitian Creole","englishName":"Haitian Creole","direction":"ltr"},{"id":38,"code":"ha","name":"Hausa","englishName":"Hausa","direction":"ltr"},{"id":39,"code":"hmn","name":"Hmong","englishName":"Hmong","direction":"ltr"},{"id":40,"code":"hu","name":"magyar","englishName":"Hungarian","direction":"ltr"},{"id":41,"code":"is","name":"íslenska","englishName":"Icelandic","direction":"ltr"},{"id":42,"code":"ig","name":"Igbo","englishName":"Igbo","direction":"ltr"},{"id":43,"code":"id","name":"Indonesia","englishName":"Indonesian","direction":"ltr"},{"id":44,"code":"ga","name":"Gaeilge","englishName":"Irish","direction":"ltr"},{"id":45,"code":"ja","name":"日本語","englishName":"Japanese","direction":"ltr"},{"id":46,"code":"jv","name":"Jawa","englishName":"Javanese","direction":"ltr"},{"id":47,"code":"kn","name":"ಕನ್ನಡ","englishName":"Kannada","direction":"ltr"},{"id":48,"code":"kk","name":"қазақ тілі","englishName":"Kazakh","direction":"ltr"},{"id":49,"code":"km","name":"ខ្មែរ","englishName":"Khmer","direction":"ltr"},{"id":50,"code":"ko","name":"한국어","englishName":"Korean","direction":"ltr"},{"id":51,"code":"ku","name":"kurdî (kurmancî)","englishName":"Kurdish","direction":"ltr"},{"id":52,"code":"ky","name":"кыргызча","englishName":"Kyrgyz","direction":"ltr"},{"id":53,"code":"lo","name":"ລາວ","englishName":"Lao","direction":"ltr"},{"id":54,"code":"lv","name":"latviešu","englishName":"Latvian","direction":"ltr"},{"id":55,"code":"lt","name":"lietuvių","englishName":"Lithuanian","direction":"ltr"},{"id":56,"code":"lb","name":"Lëtzebuergesch","englishName":"Luxembourgish","direction":"ltr"},{"id":57,"code":"mk","name":"македонски","englishName":"Macedonian","direction":"ltr"},{"id":58,"code":"mg","name":"Malagasy","englishName":"Malagasy","direction":"ltr"},{"id":59,"code":"ms","name":"Melayu","englishName":"Malay","direction":"ltr"},{"id":60,"code":"ml","name":"മലയാളം","englishName":"Malayalam","direction":"ltr"},{"id":61,"code":"mt","name":"Malti","englishName":"Maltese","direction":"ltr"},{"id":62,"code":"mr","name":"मराठी","englishName":"Marathi","direction":"ltr"},{"id":63,"code":"mn","name":"монгол","englishName":"Mongolian","direction":"ltr"},{"id":64,"code":"my","name":"မြန်မာ","englishName":"Burmese","direction":"ltr"},{"id":65,"code":"ne","name":"नेपाली","englishName":"Nepali","direction":"ltr"},{"id":66,"code":"no","name":"norsk","englishName":"Norwegian","direction":"ltr"},{"id":67,"code":"ps","name":"پښتو","englishName":"Pashto","direction":"rtl"},{"id":68,"code":"fa","name":"فارسی","englishName":"Persian","direction":"rtl"},{"id":69,"code":"pl","name":"polski","englishName":"Polish","direction":"ltr"},{"id":70,"code":"pa","name":"ਪੰਜਾਬੀ","englishName":"Punjabi","direction":"ltr"},{"id":71,"code":"ro","name":"română","englishName":"Romanian","direction":"ltr"},{"id":72,"code":"gd","name":"Gàidhlig","englishName":"Scottish Gaelic","direction":"ltr"},{"id":73,"code":"sr","name":"српски","englishName":"Serbian","direction":"ltr"},{"id":74,"code":"sd","name":"سنڌي","englishName":"Sindhi","direction":"rtl"},{"id":75,"code":"si","name":"සිංහල","englishName":"Sinhala","direction":"ltr"},{"id":76,"code":"sk","name":"slovenčina","englishName":"Slovak","direction":"ltr"},{"id":77,"code":"sl","name":"slovenščina","englishName":"Slovenian","direction":"ltr"},{"id":78,"code":"so","name":"Soomaali","englishName":"Somali","direction":"ltr"},{"id":79,"code":"su","name":"Basa Sunda","englishName":"Sundanese","direction":"ltr"},{"id":80,"code":"sw","name":"Kiswahili","englishName":"Swahili","direction":"ltr"},{"id":81,"code":"sv","name":"svenska","englishName":"Swedish","direction":"ltr"},{"id":82,"code":"tg","name":"тоҷикӣ","englishName":"Tajik","direction":"ltr"},{"id":83,"code":"ta","name":"தமிழ்","englishName":"Tamil","direction":"ltr"},{"id":84,"code":"te","name":"తెలుగు","englishName":"Telugu","direction":"ltr"},{"id":85,"code":"th","name":"ไทย","englishName":"Thai","direction":"ltr"},{"id":86,"code":"tr","name":"Türkçe","englishName":"Turkish","direction":"ltr"},{"id":87,"code":"uk","name":"українська","englishName":"Ukrainian","direction":"ltr"},{"id":88,"code":"ur","name":"اردو","englishName":"Urdu","direction":"rtl"},{"id":89,"code":"uz","name":"o‘zbek","englishName":"Uzbek","direction":"ltr"},{"id":90,"code":"vi","name":"Tiếng Việt","englishName":"Vietnamese","direction":"ltr"},{"id":91,"code":"cy","name":"Cymraeg","englishName":"Welsh","direction":"ltr"},{"id":92,"code":"xh","name":"IsiXhosa","englishName":"Xhosa","direction":"ltr"},{"id":93,"code":"yi","name":"ייִדיש","englishName":"Yiddish","direction":"rtl"},{"id":94,"code":"yo","name":"Èdè Yorùbá","englishName":"Yoruba","direction":"ltr"},{"id":95,"code":"zu","name":"isiZulu","englishName":"Zulu","direction":"ltr"},{"id":96,"code":"fil","name":"Filipino","englishName":"Filipino","direction":"ltr"}].map(entry=>Object.freeze(entry)));
 const byCode=new Map(registry.map(entry=>[entry.code,entry]));
 const aliases=Object.freeze({iw:'he',ji:'yi',in:'id',tl:'fil',nb:'no',nn:'no'});
 const CACHE='medcontrol-static-modular3-v16';
 function resolve(value){
  const input=String(value||'').trim().replace(/_/g,'-').toLowerCase();
  if(!/^[a-z]{2,3}(?:-[a-z0-9]{1,8})*$/.test(input))return null;
  try{Intl.getCanonicalLocales(input);}catch(_){return null;}
  if(byCode.has(input))return input;
  const base=input.split('-')[0];
  const key=aliases[base]||base;
  return byCode.has(key)?key:null;
 }
 function propose(preferences){
  for(const raw of Array.isArray(preferences)?preferences:[preferences]){
   const code=resolve(raw);if(code)return code;
  }
  return 'en';
 }
 function confirmed(settings){
  return settings?.languageChoiceConfirmed===true&&settings.languageConfirmationVersion===1&&
   typeof settings.interfaceLanguage==='string'&&byCode.has(settings.interfaceLanguage);
 }
 const slots=value=>(String(value).match(/⟦\d+⟧/g)||[]).sort().join('|');
 function validate(source,catalog,code){
  const keys=Object.keys(source||{});
  if(keys.length!==639)throw Error('Russian source catalog must have 639 messages');
  const snapshot=Object.create(null);
  for(const key of keys){
   const record=source[key];
   if(!record||typeof record.source!=='string')throw Error('Invalid Russian source entry: '+key);
   snapshot[key]=Object.freeze({...record,...(Array.isArray(record.files)?{files:Object.freeze([...record.files])}:{})});
  }
  const immutableSource=Object.freeze(snapshot);
  if(code==='ru')return Object.freeze({code,source:immutableSource,messages:null,lookup:null});
  if(!catalog||catalog.language!==code||!catalog.messages||Object.keys(catalog.messages).length!==639)
   throw Error('Incomplete language catalog: '+code);
  const lookup=Object.create(null);
  for(const key of keys){
   if(!Object.prototype.hasOwnProperty.call(catalog.messages,key))throw Error('Missing language key: '+key);
   const value=catalog.messages[key],russian=source[key]?.source;
   if(typeof russian!=='string'||typeof value!=='string'||!value.trim()||
      /MC\s*\d{4}|ZXQ[A-Z]+(?:QXZ|QX|Q)?/i.test(value)||slots(value)!==slots(russian))
    throw Error('Invalid language entry: '+key);
   if(!Object.prototype.hasOwnProperty.call(lookup,russian))lookup[russian]=value;
   else if(lookup[russian]!==value)lookup[russian]=null;
  }
  return Object.freeze({code,source:immutableSource,messages:Object.freeze({...catalog.messages}),lookup:Object.freeze(lookup)});
 }
 async function prepare(raw,fetcher=root.fetch.bind(root)){
  const code=resolve(raw);
  if(!code||code!==raw)throw Error('Unsupported language');
  const paths=['/locales/source-ru.json',...(code==='ru'?[]:['/locales/catalogs/'+code+'.json'])];
  const responses=await Promise.all(paths.map(path=>fetcher(path,{cache:'no-store',credentials:'same-origin'})));
  if(responses.some(response=>!response.ok))throw Error('Language assets unavailable: '+code);
  const json=await Promise.all(responses.map(response=>response.clone().json()));
  const prepared=validate(json[0],json[1],code);
  if(!root.caches)throw Error('Offline cache unavailable; language was not saved');
  const cache=await root.caches.open(CACHE);
  await Promise.all(paths.map((path,index)=>cache.put(path,responses[index])));
  if((await Promise.all(paths.map(path=>cache.match(path)))).some(response=>!response))
   throw Error('Language offline assets not verified: '+code);
  return prepared;
 }
 // One queue per unlocked session: a later request cannot commit before an
 // earlier request finishes preparing, staging and persisting its exact code.
 const pending=new WeakMap();
 function serialize(session,operation,epoch){
  if(!session||typeof session.read!=='function'||typeof session.transact!=='function')
   return Promise.reject(Error('Protected language session required'));
  const previous=pending.get(session)||Promise.resolve();
  const result=previous.then(operation).catch(error=>{checkEpoch(session,epoch);throw error;});
  const settled=result.then(()=>{},()=>{});
  pending.set(session,settled);
  settled.then(()=>{if(pending.get(session)===settled)pending.delete(session);});
  return result;
 }
 function captureEpoch(session){return typeof session?.entryEpoch==='function'?session.entryEpoch():undefined;}
 function checkEpoch(session,expected){
  const actual=captureEpoch(session);
  if(expected!==undefined&&actual!==expected){
   const error=Error('Protected session changed; language operation cancelled');
   error.code='protected_session_changed';error.expectedEntryEpoch=expected;error.actualEntryEpoch=actual;throw error;
  }
 }
 async function stagePrepared(code,fetcher,stage,session,epoch){
  checkEpoch(session,epoch);
  const prepared=await prepare(code,fetcher);
  checkEpoch(session,epoch);
  if(stage!==undefined){
   if(typeof stage!=='function')throw Error('Invalid language staging callback');
   if(await stage(prepared)===false)throw Error('Language catalog staging failed: '+code);
   checkEpoch(session,epoch);
  }
  return prepared;
 }
 function confirm(session,code,{fetcher,stage}={}){
  // No aliases or coercion here: only an exact choice from the approved list
  // may be saved. Capture the string before any asynchronous work begins.
  if(typeof code!=='string'||!byCode.has(code))return Promise.reject(Error('Unsupported language'));
  const epoch=captureEpoch(session);
  return serialize(session,async()=>{
   checkEpoch(session,epoch);
   const prepared=await stagePrepared(code,fetcher,stage,session,epoch);
   checkEpoch(session,epoch);
   const settings=session.read()?.settings;
   if(confirmed(settings)&&settings.interfaceLanguage===code){rememberDisplayLanguage(session,prepared);return prepared;}
   stageDisplayLanguage();
   await session.transact(state=>{
    checkEpoch(session,epoch);
    state.settings=state.settings||{};
    state.settings.interfaceLanguage=code;
    state.settings.languageChoiceConfirmed=true;
    state.settings.languageConfirmationVersion=1;
   },{entryEpoch:epoch});
   checkEpoch(session,epoch);
   rememberDisplayLanguage(session,prepared);
   return prepared;
  },epoch);
 }
 function restore(session,{fetcher,stage}={}){
  const epoch=captureEpoch(session);
  return serialize(session,async()=>{
   checkEpoch(session,epoch);
   const settings=session.read()?.settings;
   if(!confirmed(settings))throw Error('Canonical language confirmation required');
   const prepared=await stagePrepared(settings.interfaceLanguage,fetcher,stage,session,epoch);
   checkEpoch(session,epoch);rememberDisplayLanguage(session,prepared);return prepared;
  },epoch);
 }
 // Public presentation metadata only. Credential salt binds it to this vault;
 // protected settings, never this hint, remain authoritative after unlock.
 const displayKey='medcontrol_modular3_entry_display_locale_v1';
 function displayCredential(storage){
  if(storage.getItem('medcontrol_modular3_protected_state_v1')===null)return null;
  const credential=JSON.parse(storage.getItem('medcontrol_modular3_local_credential_v1'));
  return credential?.version===1&&typeof credential.salt==='string'&&/^[a-f0-9]{32}$/.test(credential.salt)?credential.salt:null;
 }
 function readDisplayLanguage(storage=root.localStorage){
  try{
   const salt=displayCredential(storage);if(!salt)return null;
   const hint=JSON.parse(storage.getItem(displayKey));
   return hint?.version===1&&hint.pending!==true&&byCode.has(hint.code)&&hint.salt===salt?hint.code:null;
  }catch(_){return null;}
 }
 function displayPending(storage=root.localStorage){
  try{const salt=displayCredential(storage),hint=JSON.parse(storage.getItem(displayKey));return !!salt&&hint?.version===1&&hint.pending===true&&hint.salt===salt;}catch(_){return false;}
 }
 function stageDisplayLanguage(){
  const storage=root.localStorage;if(!storage)return;
  const salt=displayCredential(storage);if(!salt)return;
  // Invalidate an older display choice before the encrypted change. If this
  // write or finalization fails, the next locked screen must stay neutral.
  storage.setItem(displayKey,JSON.stringify({version:1,pending:true,salt}));
 }
 function rememberDisplayLanguage(session,prepared){
  try{
   const settings=session.read()?.settings;
   if(!confirmed(settings)||settings.interfaceLanguage!==prepared.code)return;
   const salt=displayCredential(root.localStorage);if(!salt)return;
   root.localStorage.setItem(displayKey,JSON.stringify({version:1,code:prepared.code,salt}));
  }catch(_){/* Display metadata failure cannot undo a committed protected choice. */}
 }
 function translate(prepared,original){
  if(!prepared||prepared.code==='ru')return original;
  return prepared.lookup?.[original]||null;
 }
 const api=Object.freeze({registry,resolve,propose,confirmed,validate,prepare,confirm,restore,translate,readDisplayLanguage,displayPending,displayKey,cacheName:CACHE});
 if(typeof module!=='undefined'&&module.exports)module.exports=api;
 else root.MedControlEntryLanguages=api;
})(typeof window!=='undefined'?window:globalThis);
