const {test}=require('node:test'),assert=require('node:assert/strict');
const source=require('../locales/source-ru.json'),manifest=require('../locales/manifest.json');
const {formatMessage}=require('../js/modular3-protected-locale-controller.js');
for(const {code}of manifest)test('owned compound history event '+code,()=>{
 const values=code==='ru'?Object.fromEntries(Object.entries(source).map(([id,row])=>[id,row.source])):require('../locales/catalogs/'+code+'.json').messages;
 const catalog=Object.fromEntries(Object.entries(source).map(([id,row])=>[row.source,values[id]]));
 const original='Время 1 заменено; Количество приёма заменено; Детали заменены';
 const expected=catalog['Время ⟦0⟧ заменено'].replace('⟦0⟧','1')+'; '+catalog['Количество приёма']+' '+catalog['заменено']+'; '+catalog['Детали']+' '+catalog['заменены'];
 assert.equal(formatMessage(original,catalog,true),expected);
 assert.equal(formatMessage('История препарата «Количество приёма заменено»',catalog),catalog['История препарата «⟦0⟧»'].replace('⟦0⟧','Количество приёма заменено'));
});
