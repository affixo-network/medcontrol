/* T-046 isolated replica transport: HTTPS service must enforce durable immutable objects and atomic CAS. */
(function(root){
'use strict';
function create({baseUrl,authorization,fetcher=root.fetch}){
 if(!/^https:\/\//.test(baseUrl)||typeof authorization!=='function')throw Error('Secure replica service required');
 const base=baseUrl.replace(/\/$/,'');
 async function call(method,path,body){
  const token=await authorization();
  if(typeof token!=='string'||!token)throw Error('Authorization unavailable');
  const response=await fetcher(base+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),redirect:'error',cache:'no-store'});
  if(response.status===409||response.status===412)return {conflict:true};
  if(!response.ok)throw Error('Replica request failed: '+response.status);
  return response.status===204?null:response.json();
 }
 const object=(kind,id)=>{if(!/^[a-f0-9]{64}$/.test(id))throw Error('Invalid commitment');return '/v1/'+kind+'/'+id;};
 return Object.freeze({
  putSegment:async(id,value)=>{if((await call('PUT',object('segments',id),value))?.conflict)throw Error('Immutable conflict');},
  getSegment:id=>call('GET',object('segments',id)),
  putManifest:async(id,value)=>{if((await call('PUT',object('manifests',id),value))?.conflict)throw Error('Immutable conflict');},
  getManifest:id=>call('GET',object('manifests',id)),
  getHead:()=>call('GET','/v1/head'),
  compareAndSwapHead:async(expectedGeneration,previousCommitment,next)=>{
   const result=await call('POST','/v1/head/compare-and-swap',{expectedGeneration,previousCommitment,next});
   return result?.conflict?false:result?.committed===true;
  }
 });
}
root.MedControlT046HttpReplica=Object.freeze({create});
})(typeof window!=='undefined'?window:globalThis);
