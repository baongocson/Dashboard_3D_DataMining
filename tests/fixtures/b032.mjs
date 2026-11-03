import {randomUUID,createHash} from 'node:crypto';
export const id=()=>randomUUID(),sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function* input(bytes,{part=65536}={}){for(let at=0;at<bytes.length;at+=part)yield bytes.subarray(at,Math.min(bytes.length,at+part));}
export function descriptor(projectId,bytes,purpose='model'){return {artifactId:id(),projectId,purpose,formatVersion:purpose==='source'?'csv-v1':'b032-fixture-binary-v1',mediaType:'application/octet-stream',sizeBytes:bytes.length,sha256:sha(bytes),dependencyArtifactIds:[]};}
export async function upload(storage,token,generation,d,bytes){const u=await storage.declare(token,{serverGeneration:generation,descriptor:d});for(let offset=0,index=0;offset<bytes.length;offset+=u.chunkSizeBytes,index++){const b=bytes.subarray(offset,Math.min(bytes.length,offset+u.chunkSizeBytes));await storage.chunk(token,u.uploadId,index,offset,b.length,sha(b),input(b));}return storage.complete(token,u.uploadId);}
