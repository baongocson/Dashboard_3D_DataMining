import {createServer} from 'node:http';
import {randomBytes,timingSafeEqual} from 'node:crypto';
import {errorEnvelope} from '../../../../packages/contracts/src/index.mjs';
/** Explicit owned loopback helper only; no listener is created on import. */
export async function createProxyErrorHelper(){
 const key=randomBytes(32).toString('hex');
 const server=createServer((req,res)=>{
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
  const supplied=req.headers['x-local-proxy-key'];
  if(typeof supplied!=='string'||! /^[a-f0-9]{64}$/.test(supplied)||!timingSafeEqual(Buffer.from(supplied),Buffer.from(key))){res.writeHead(404);res.end();return;}
  const status=Number(req.headers['x-local-proxy-status']),id=req.headers['x-local-proxy-request-id'];
  if(req.method!=='GET'||!['413','502','503','504'].includes(String(req.headers['x-local-proxy-status']))||typeof id!=='string'||! /^[A-Za-z0-9_-]{1,128}$/.test(id)){res.writeHead(400);res.end();return;}
  const body=errorEnvelope(status===413?'PAYLOAD_TOO_LARGE':'UPSTREAM_UNAVAILABLE',id,{},status>=500,new Date().toISOString());
  res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','X-Request-Id':id});res.end(JSON.stringify(body));
 });
 await new Promise<void>((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve();});});
 const address=server.address();if(!address||typeof address==='string')throw Error('Loopback listener required');
 return {origin:'http://127.0.0.1:'+address.port,key,close:async()=>{server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()));}};
}

