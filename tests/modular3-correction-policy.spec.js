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
