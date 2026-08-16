(function(){
'use strict';
const URL='https://havdtfcfqhxwdtiqqdej.supabase.co';
const KEY='sb_publishable_WRIoU60I_CWO1oOXYootow_8g3UYdBL';
let c,pid,q=Promise.resolve();
const client=()=>c||(c=window.supabase.createClient(URL,KEY));
const clone=v=>JSON.parse(JSON.stringify(v));
const lid=(x,p,i)=>String(x?.id??x?.localId??x?.event