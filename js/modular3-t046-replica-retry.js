/* T-046 isolated event-driven replica retry controller.
 * No production integration; no polling and no automatic key storage.
 * Online events signal an opportunity, not proof of remote availability.
 */
(function(root){
'use strict';
function create(resolveJob){
 const drain=root.MedControlT046ReplicaDrain;
 if(!drain||typeof resolveJob!=='function')throw Error('Retry prerequisites required');
 let running=null,started=false,disposed=false,retryTimer=null,failures=0;
 const baseDelayMs=1000,maxDelayMs=60000;
 const run=()=>{
  if(disposed)return Promise.resolve({skipped:true});
  if(running)return running;
  if(root.navigator&&root.navigator.onLine===false)return Promise.resolve({offline:true});
  if(retryTimer!==null){root.clearTimeout(retryTimer);retryTimer=null;}
  running=Promise.resolve().then(async()=>{
   const locks=root.navigator?.locks;
   // Never silently fall back to unsafe concurrent writers.
   if(!locks||typeof locks.request!=='function')return {lockUnavailable:true};
   return locks.request('medcontrol-t046-replica-drain',{mode:'exclusive',ifAvailable:true},
    lock=>lock?drain.drain(resolveJob):{busy:true});
  }).then(result=>{
   if(result&&typeof result.remaining==='number'&&result.remaining>0){
    failures=Math.min(failures+1,7);
    if(started&&!disposed){
     const delay=Math.min(maxDelayMs,baseDelayMs*Math.pow(2,failures-1));
     retryTimer=root.setTimeout(()=>{retryTimer=null;onOnline();},delay);
    }
   }else if(result&&result.remaining===0){failures=0;}
   return result;
  }).catch(error=>{
   failures=Math.min(failures+1,7);
   if(started&&!disposed){
    const delay=Math.min(maxDelayMs,baseDelayMs*Math.pow(2,failures-1));
    retryTimer=root.setTimeout(()=>{retryTimer=null;onOnline();},delay);
   }
   throw error;
  }).finally(()=>{running=null;});
  return running;
 };
 const onOnline=()=>{run().catch(()=>{/* jobs remain pending */});};
 const onVisible=()=>{if(root.document?.visibilityState==='visible')onOnline();};
 function start(){
  if(disposed)throw Error('Controller disposed');
  if(started)return;
  started=true;
  root.addEventListener('online',onOnline);
  root.document?.addEventListener('visibilitychange',onVisible);
  onOnline();
 }
 function stop(){
  if(retryTimer!==null){root.clearTimeout(retryTimer);retryTimer=null;}
  if(!started)return;
  started=false;
  root.removeEventListener('online',onOnline);
  root.document?.removeEventListener('visibilitychange',onVisible);
 }
 function dispose(){stop();disposed=true;}
 return Object.freeze({start,stop,dispose,run});
}
root.MedControlT046ReplicaRetry=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
