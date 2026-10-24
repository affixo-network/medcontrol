'use strict';
// Preparation only: extract public interface text, never browser records.
const fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),acorn=require('acorn'),walk=require('acorn-walk');
const auth=fs.readFileSync('js/auth-guard.js','utf8');
const files=[...new Set([...auth.matchAll(/['"]((?:js\/[^'"?]+|core)\.js)(?:\?[^'"]*)?['"]/g)].map(m=>m[1]))].filter(p=>!p.includes('translations.js'));
files.push('js/auth-guard.js','js/modular3-protected-workspace.js');
const found=new Map();
function add(text,file){text=text.trim();if(!/[А-Яа-яЁё]/.test(text)||text.includes('<')||text.includes('function')||text.length>2500)return;const key=crypto.createHash('sha256').update(text).digest('hex').slice(0,16);const prior=found.get(key);if(prior&&prior.source!==text)throw Error('Text key collision');found.set(key,{source:text,files:[...new Set([...(prior?.files||[]),file])]});}
for(const file of files){let src=fs.readFileSync(file,'utf8');if(file==='js/modular3-protected-workspace.js')src=src.slice(src.indexOf(' function comparisonNotice'));if(file==='js/modular3-protected-workspace.js')src='(function(){'+src;const ast=acorn.parse(src,{ecmaVersion:'latest',allowAwaitOutsideFunction:true});walk.simple(ast,{Literal(n){if(typeof n.value==='string'){if(n.value.includes('<')){for(const m of n.value.matchAll(/>([^<>]+)</g))add(m[1],file);for(const m of n.value.matchAll(/(?:placeholder|title|aria-label)=["']([^"']+)["']/g))add(m[1],file);}else add(n.value,file);}},TemplateLiteral(n){const text=n.quasis.map((q,i)=>q.value.cooked+(i<n.expressions.length?'⟦'+i+'⟧':'')).join('');if(text.includes('<')){for(const m of text.matchAll(/>([^<>]+)</g))add(m[1],file);for(const m of text.matchAll(/(?:placeholder|title|aria-label)=["']([^"']+)["']/g))add(m[1],file);}else add(text,file);}});}
const ctx={console:{log(){}}};vm.runInNewContext(fs.readFileSync('js/translations.js','utf8')+';this.tables=TRANSLATIONS',ctx);
for(const [key,value]of Object.entries(ctx.tables.ru)){if(Array.isArray(value))value.forEach(v=>add(v,'translations.'+key));else add(value,'translations.'+key);}
// Entry is static HTML; include its labels and explanatory text.
const fullEntry=fs.readFileSync('modular3-protected.html','utf8');const entry=fullEntry.split('<script')[0];for(const m of entry.matchAll(/>([^<>]+)</g))add(m[1],'modular3-protected.html');
for(const block of fullEntry.matchAll(/<script>([\s\S]*?)<\/script>/g)){const ast=acorn.parse(block[1],{ecmaVersion:'latest'});walk.simple(ast,{Literal(n){if(typeof n.value==='string')add(n.value,'modular3-protected.html');}});}
fs.writeFileSync('locales/source-ru.json',JSON.stringify(Object.fromEntries([...found].sort()),null,2)+'\n');
console.log('Public UI inventory: '+found.size+' unique messages in '+files.length+' files');
