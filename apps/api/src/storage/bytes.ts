import {mkdir,open,realpath,readdir} from 'node:fs/promises';
import type {FileHandle} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes,createHash} from 'node:crypto';
import {reject,AuthError} from '../auth/policy.ts';
export type ByteInput=AsyncIterable<Uint8Array>&{iterator?:(options:{destroyOnReturn:boolean})=>AsyncIterable<Uint8Array>;resume?:()=>unknown};
export const storageError=(e:any):never=>{if(e instanceof AuthError)throw e;reject(e?.code==='ENOSPC'?'STORAGE_CAPACITY_EXCEEDED':'STORAGE_UNAVAILABLE',503);};
export class RetainedByteStore {
 private root:string;
 constructor(root:string){if(!path.isAbsolute(root))throw Error('Explicit absolute private storage root required');this.root=root;}
 async ready(){await mkdir(path.join(this.root,'objects'),{recursive:true});this.root=await realpath(this.root);}
 private filename(key:string){if(!/^[A-Za-z0-9_-]{43}$/.test(key))reject('STORAGE_UNAVAILABLE',503);return path.join(this.root,'objects',key+'.bin');}
 private async allocate(){const key=randomBytes(32).toString('base64url'),file=await open(this.filename(key),'wx',0o600);return {key,file};}
 private async write(file:FileHandle,bytes:Uint8Array){let at=0;while(at<bytes.length){const result=await file.write(bytes,at,bytes.length-at,null);if(!result.bytesWritten)throw Error('Short write');at+=result.bytesWritten;}}
 async put(input:ByteInput,expectedLength:number,expectedHash:string,maxBytes:number){
  let file:FileHandle|undefined;
  try{
   const allocated=await this.allocate();file=allocated.file;let length=0;const hash=createHash('sha256');
   const iterator=input.iterator?input.iterator({destroyOnReturn:false}):input;
   for await(const bytes of iterator){if(!(bytes instanceof Uint8Array))reject('VALIDATION_FAILED');length+=bytes.byteLength;if(length>maxBytes||length>expectedLength)reject('PAYLOAD_TOO_LARGE',413);hash.update(bytes);await this.write(file,bytes);}
   if(length!==expectedLength)reject('VALIDATION_FAILED');const actual=hash.digest('hex');if(actual!==expectedHash)reject('HASH_MISMATCH');
   await file.sync();return {key:allocated.key,length,sha256:actual};
  }catch(e){input.resume?.();return storageError(e);}finally{await file?.close();}
 }
 async check(input:ByteInput,expectedLength:number,expectedHash:string,maxBytes:number){
  try{let length=0;const hash=createHash('sha256'),iterator=input.iterator?input.iterator({destroyOnReturn:false}):input;for await(const b of iterator){length+=b.length;if(length>expectedLength||length>maxBytes)reject('PAYLOAD_TOO_LARGE',413);hash.update(b);}if(length!==expectedLength)reject('VALIDATION_FAILED');if(hash.digest('hex')!==expectedHash)reject('HASH_MISMATCH');}
  catch(e){input.resume?.();return storageError(e);}
 }
 async inspectOpen(file:FileHandle,maxLength:number){const hash=createHash('sha256'),buffer=Buffer.allocUnsafe(65536);let length=0;while(true){const r=await file.read(buffer,0,buffer.length,length);if(!r.bytesRead)break;length+=r.bytesRead;if(length>maxLength)reject('HASH_MISMATCH');hash.update(buffer.subarray(0,r.bytesRead));}return {length,sha256:hash.digest('hex')};}
 async openVerified(key:string,length:number,sha256:string){
  let file:FileHandle|undefined;
  try{file=await open(this.filename(key),'r');const got=await this.inspectOpen(file,length);if(got.length!==length||got.sha256!==sha256)reject('HASH_MISMATCH');return file;}
  catch(e){await file?.close();return storageError(e);}
 }
 async assemble(chunks:{key:string;length:number;sha256:string}[],length:number,sha256:string){
  let output:FileHandle|undefined;
  try{
   const allocated=await this.allocate();output=allocated.file;const hash=createHash('sha256');let total=0;
   for(const chunk of chunks){const input=await this.openVerified(chunk.key,chunk.length,chunk.sha256);try{const buffer=Buffer.allocUnsafe(65536);let offset=0;while(true){const r=await input.read(buffer,0,buffer.length,offset);if(!r.bytesRead)break;const bytes=buffer.subarray(0,r.bytesRead);total+=bytes.length;offset+=bytes.length;if(total>length)reject('HASH_MISMATCH');hash.update(bytes);await this.write(output,bytes);}}finally{await input.close();}}
   if(total!==length||hash.digest('hex')!==sha256)reject('HASH_MISMATCH');await output.sync();return {key:allocated.key,length,sha256};
  }catch(e){return storageError(e);}finally{await output?.close();}
 }
 async json(key:string,length:number,sha256:string,maxEstimatedBytes:number){
  if(length*4>maxEstimatedBytes)reject('RESOURCE_LIMIT_EXCEEDED');const f=await this.openVerified(key,length,sha256);try{const bytes=await f.readFile();try{return new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);}catch{reject('VALIDATION_FAILED');}}finally{await f.close();}
 }
 async *lines(key:string,length:number,sha256:string,maxBufferedCharacters:number){
  const file=await this.openVerified(key,length,sha256),decoder=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}),buffer=Buffer.allocUnsafe(65536);let offset=0,pending='';
  try{while(true){const r=await file.read(buffer,0,buffer.length,offset);if(!r.bytesRead)break;offset+=r.bytesRead;pending+=decoder.decode(buffer.subarray(0,r.bytesRead),{stream:true});let nl;while((nl=pending.indexOf('\n'))>=0){if(nl>maxBufferedCharacters)reject('RESOURCE_LIMIT_EXCEEDED');const line=pending.slice(0,nl);pending=pending.slice(nl+1);if(line.endsWith('\r'))reject('VALIDATION_FAILED');yield line;}if(pending.length>maxBufferedCharacters)reject('RESOURCE_LIMIT_EXCEEDED');}pending+=decoder.decode();if(pending.length)reject('VALIDATION_FAILED');}
  catch(e){if(e instanceof TypeError)reject('VALIDATION_FAILED');throw e;}
  finally{await file.close();}
 }
 async retainedFileCount(){return (await readdir(path.join(this.root,'objects'))).length;}
 // Deliberately no unlink/remove/overwrite operation. Failed attempts and superseded chunks are retained.
}
