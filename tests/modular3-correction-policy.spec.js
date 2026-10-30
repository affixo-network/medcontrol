'use strict';
const {test,expect}=require('@playwright/test');
const URL='http://127.0.0.1:8765/modular3-protected.html';
for(const reason of ['accident','error']){
  test('correction '+reason+' rolls back failed plaintext save and preserves history',async({page})=>{
    await page.goto(URL);
    await page.addScriptTag({url:'/js/correction-cancel-taken-policy.js'});
    const result=await page.evaluate(async reason=>{
      const log={id:'synthetic-log',medicationId:'synthetic-med',plannedAt:'2026-10-31T10:00:00Z',actualAt:'2026-10-31T10:02:00Z',status:'taken'};
      const state={intakeLogs:[log],intakeCorrections:[]};
      window.getState=()=>state;
      window.uid=()=> 'synthetic-correction';
      window.nowISO=()=> '2026-10-31T10:03:00Z';
      window.confirm=()=>true;
      window.alert=()=>{};
      let mounts=0;
      window.mount=async()=>{mounts++;};
      const select=document.createElement('select');select.id='correction_reason';select.innerHTML='<option value="'+reason+'">'+reason+'</option>';document.body.appendChild(select);
      window.saveStateAsync=async()=>false;
      const rejected=await window.applyCorrection('synthetic-med',log.plannedAt);
      const afterFailure={rejected,corrections:state.intakeCorrections.length,logs:state.intakeLogs.length,mounts};
      window.saveStateAsync=async()=>true;
      const accepted=await window.applyCorrection('synthetic-med',log.plannedAt);
      return {afterFailure,accepted,correction:state.intakeCorrections[0],logs:state.intakeLogs,mounts};
    },reason);
    expect(result.afterFailure).toEqual({rejected:false,corrections:0,logs:1,mounts:0});
    expect(result.accepted).toBe(true);
    expect(result.correction.reason).toBe(reason);
    expect(result.correction.after.action).toBe('reset');
    expect(result.correction.before.actualAt).toBe('2026-10-31T10:02:00Z');
    expect(result.logs).toHaveLength(1);
    expect(result.mounts).toBe(1);
  });
}

test('correction dialog displays activated translation and preserves reason codes',async({page})=>{
 await page.goto(URL);
 await page.addScriptTag({url:'/js/correction-cancel-taken-policy.js'});
 const result=await page.evaluate(()=>{
  const plannedAt='2026-10-31T10:00:00Z';
  const state={settings:{interfaceLanguage:'en'},intakeLogs:[{id:'test-log',medicationId:'test-med',plannedAt,actualAt:'2026-10-31T10:02:00Z',status:'taken'}],intakeCorrections:[]};
  window.getState=()=>state;
  window.canCorrectIntakeNow=()=>true;
  window.formatDateTime=value=>String(value);
  window.escapeHtml=value=>String(value);
  window.MedControlCorrectionCatalogs={en:{messages:{
   '1419825a704fb8e4':'Previous corrections: ⟦0⟧',
   '57cb4188862a5ff0':'Scheduled intake time',
   '442e7ad5479655fc':'Reason',
   '6a323db2ae5bed82':'Choose',
   '435d3d1cbd5cc878':'Choose a reason.',
   '0a23c2a4fe16415a':'Cancel taken',
   'a7a4033657e89fc9':'Close',
   '89c4361d72299747':'Accidental mark will be cancelled.',
   '585d7328139b9ece':'Error mark will be cancelled.'
  }}};
  window.tr=key=>({correction_reason_accident:'Accidental button press',correction_reason_error:'Error'})[key]||key;
  const dialog=document.createElement('dialog');dialog.id='correctionDialog';
  const content=document.createElement('div');content.id='correctionContent';
  dialog.appendChild(content);document.body.appendChild(dialog);
  window.openCorrection('test-med',plannedAt);
  const select=content.querySelector('#correction_reason');
  const labels=Array.from(select.options).map(option=>option.textContent);
  select.value='error';window.syncCorrectionMode();
  return {labels,html:content.textContent,hint:content.querySelector('#correction_hint').textContent,
   button:content.querySelector('#correction_apply').textContent,reason:select.value};
 });
 expect(result.labels).toEqual(['Choose','Accidental button press','Error']);
 expect(result.html).toContain('Scheduled intake time');
 expect(result.html).toContain('Previous corrections: 0');
 expect(result.hint).toBe('Error mark will be cancelled.');
 expect(result.button).toBe('Cancel taken');
 expect(result.reason).toBe('error');
});
