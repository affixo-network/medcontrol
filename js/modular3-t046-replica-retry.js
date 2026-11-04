/* T-046 isolated event-driven replica retry controller.
 * No production integration; no polling and no automatic key storage.
 * Online events signal an opportunity, not proof of remote availability.
 */
(function(root){
'use strict';
function create(resolveJob){
 const drain=root.MedControlT046ReplicaDrain;
 if(!drain||typeof resolveJob!=='function')throw Error('Retry prerequisites required');
 let running=null,started=false,disposed=false;
 const run=()=>{
  if(disposed)return Promise.resolve({skipped:true});
  if(running)return running;
  if(root.navigator&&root.navigator.onLine===false)return Promise.resolve({offline:true});
  running=Promise.resolve().then(()=>drain.drain(resolveJob)).finally(()=>{running=null;});
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
