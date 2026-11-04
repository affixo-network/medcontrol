/* T-046 isolated HTTP replica server contract, in-memory test implementation.
 * Not durable, not a deployed independent failure domain, no medical vault access.
 * Every mutation is synchronous in one JS process to model atomic CAS.
 */
'use strict';
const {createServer}=require('node:http');
const digest=id=>typeof id==='string'&&/^[a-f0-9]{64}$/.test(id);
function createReplicaServer({token='test-token'}={}){
 const segments=new Map(),manifests=new Map();let head=null;
 const server=createServer(async(req,res)=>{
  const send=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  if(req.headers.authorization!=='Bearer '+token){send(401,{error:'unauthorized'});return;}
  try{
   const pathname=new URL(req.url,'http://localhost').pathname;
   let body;
   if(req.method==='PUT'||req.method==='POST'){
    let raw='';
    for await(const chunk of req){raw+=chunk;if(raw.length>8*1024*1024)throw Error('Request too large');}
    body=JSON.parse(raw);
   }
   if(pathname==='/v1/head'&&req.method==='GET'){send(200,head);return;}
   if(pathname==='/v1/head/compare-and-swap'&&req.method==='POST'){
    if(!body||!Number.isSafeInteger(body.expectedGeneration)||body.expectedGeneration<0||
       (body.previousCommitment!==null&&!digest(body.previousCommitment))||
       !body.next||!digest(body.next.commitment)||body.next.generation!==body.expectedGeneration+1||
       typeof body.next.vaultId!=='string'||
       (head?.generation||0)!==body.expectedGeneration||
       (head?.commitment||null)!==body.previousCommitment||
       (head&&head.vaultId!==body.next.vaultId)||
       !manifests.has(body.next.commitment)){
     send(409,{error:'conflict'});return;
    }
    const stored=manifests.get(body.next.commitment);
    if(stored?.manifest?.vaultId!==body.next.vaultId||stored?.manifest?.generation!==body.next.generation){
     send(409,{error:'manifest mismatch'});return;
    }
    head=structuredClone(body.next);send(200,{committed:true});return;
   }
   const match=pathname.match(/^\/v1\/(segments|manifests)\/([a-f0-9]{64})$/);
   if(match){
    const store=match[1]==='segments'?segments:manifests,id=match[2];
    if(req.method==='GET'){if(!store.has(id)){send(404,{error:'missing'});return;}send(200,store.get(id));return;}
    if(req.method==='PUT'){
     if(!body||typeof body!=='object'||(match[1]==='segments'?body.segment?.commitment:body.manifest?.commitment)!==id){send(400,{error:'invalid object'});return;}
     if(store.has(id)&&JSON.stringify(store.get(id))!==JSON.stringify(body)){send(409,{error:'immutable conflict'});return;}
     store.set(id,structuredClone(body));send(200,{stored:true});return;
    }
   }
   send(404,{error:'not found'});
  }catch{send(400,{error:'bad request'});}
 });
 return {server,listen:()=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve(server.address().port))),close:()=>new Promise(resolve=>server.close(resolve))};
}
module.exports={createReplicaServer};
