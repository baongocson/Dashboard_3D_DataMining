import canonicalize from 'canonicalize';
import {assertSchema,assertJson,parseJsonStrict,fail,assertVersionCreateMutation} from '../../contracts/src/index.mjs';
export const FORMAT_VERSION=Object.freeze({table:'table-jsonl-v1',sparse:'csr-v1',canonicalHash:'rfc8785-sha256-business-v1'});
const utf8=text=>new TextEncoder().encode(text);
export const newId=()=>crypto.randomUUID();
export async function hashBytes(bytes){if(!(bytes instanceof Uint8Array))fail('VALIDATION_FAILED');return[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export function canonicalJson(value){assertJson(value);return canonicalize(value);}
export async function hashCanonical(value){return hashBytes(utf8(canonicalJson(value)));}
export async function mutationHash(mutation,artifacts=[]){
 assertSchema('mutation-envelope.json',mutation);for(const a of artifacts)assertSchema('artifact-descriptor.json',a);
 const {schemaVersion,kind,entityId,projectId,baseRevision,dependencies,payload}=mutation;
 return hashCanonical({schemaVersion,kind,entityId,projectId,baseRevision,dependencies,payload,artifacts});
}
// Stable typed preorder reconstructs each version's artifact list from a global batch list.
// Does not change hash algorithm or rewrite a queued mutation.
export function collectVersionArtifacts(mutation,descriptors){
 assertVersionCreateMutation(mutation);if(!Array.isArray(descriptors))fail('VALIDATION_FAILED');
 const byId=new Map();for(const d of descriptors){assertSchema('artifact-descriptor.json',d);if(byId.has(d.artifactId))fail('VALIDATION_FAILED');byId.set(d.artifactId,d);}
 const result=[],active=new Set(),done=new Set();
 function visit(id){
   if(active.has(id))fail('INVALID_SOURCE');if(done.has(id))return;
   const d=byId.get(id);if(!d||d.projectId!==mutation.projectId)fail('INVALID_SOURCE');
   active.add(id);result.push(d);for(const dependency of d.dependencyArtifactIds)visit(dependency);active.delete(id);done.add(id);
 }
 const version=mutation.payload.version,manifest=byId.get(version.tableManifestId);
 if(manifest?.purpose!=='tableManifest')fail('INVALID_SOURCE');
 visit(version.tableManifestId);
 if(version.rowLineageArtifactId){if(byId.get(version.rowLineageArtifactId)?.purpose!=='rowLineage')fail('INVALID_SOURCE');visit(version.rowLineageArtifactId);}
 return result;
}
export function assertCell(value,column){
 if(value===null){if(!column.nullable)fail('VALIDATION_FAILED',{field:column.columnId});return;}
 assertJson(value);const t=column.logicalType;
 if(t==='number'){if(typeof value!=='number')fail('VALIDATION_FAILED',{field:column.columnId});return;}
 if(t==='boolean'){if(typeof value!=='boolean')fail('VALIDATION_FAILED',{field:column.columnId});return;}
 if(typeof value!=='string')fail('VALIDATION_FAILED',{field:column.columnId});
 if(t==='bigint'&&!/^(0|-?[1-9][0-9]*)$/.test(value))fail('VALIDATION_FAILED',{field:column.columnId});
 if(t==='decimal'&&!/^-?(0|[1-9][0-9]*)(\.[0-9]+)?$/.test(value))fail('VALIDATION_FAILED',{field:column.columnId});
 if(t==='date'&&(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value))fail('VALIDATION_FAILED',{field:column.columnId});
 if(t==='datetime'&&(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]+)?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,19)!==value.slice(0,19)))fail('VALIDATION_FAILED',{field:column.columnId});
 if(t==='json'){try{JSON.parse(value);}catch{fail('VALIDATION_FAILED',{field:column.columnId});}}
}
export function assertColumns(columns){if(!Array.isArray(columns))fail('VALIDATION_FAILED');const ids=new Set();for(const c of columns){assertSchema('column.json',c);if(ids.has(c.columnId))fail('VALIDATION_FAILED');ids.add(c.columnId);}return columns;}
export function assertRow(row,columns){assertSchema('row.json',row);if(row.cells.length!==columns.length)fail('VALIDATION_FAILED',{field:'cells'});row.cells.forEach((v,i)=>assertCell(v,columns[i]));return row;}
const combine=pieces=>{const n=pieces.reduce((s,b)=>s+b.length,0),bytes=new Uint8Array(n);let offset=0;for(const b of pieces){bytes.set(b,offset);offset+=b.length;}return bytes;};
export async function encodeTable(rows,columns,{chunkTargetBytes=4194304,artifactMaxBytes=268435456}={}){
 assertColumns(columns);if(!Array.isArray(rows)||!Number.isSafeInteger(chunkTargetBytes)||chunkTargetBytes<1||!Number.isSafeInteger(artifactMaxBytes)||artifactMaxBytes<chunkTargetBytes)fail('VALIDATION_FAILED');
 const descriptors=[],chunks=[],ids=new Set();let pending=[],size=0,rowStart=0;
 const flush=async()=>{if(!pending.length)return;const bytes=combine(pending),artifactId=newId();descriptors.push({artifactId,sizeBytes:bytes.length,sha256:await hashBytes(bytes),rowStart,rowCount:pending.length});chunks.push({artifactId,bytes});rowStart+=pending.length;pending=[];size=0;};
 for(const row of rows){assertRow(row,columns);if(ids.has(row.rowId))fail('VALIDATION_FAILED',{field:'rowId'});ids.add(row.rowId);const bytes=utf8(JSON.stringify(row)+'\n');if(bytes.length>artifactMaxBytes)fail('ARTIFACT_LIMIT_EXCEEDED',{limit:artifactMaxBytes,scope:'resource'});if(size&&size+bytes.length>chunkTargetBytes)await flush();pending.push(bytes);size+=bytes.length;if(size>=chunkTargetBytes)await flush();}
 await flush();const manifest={schemaVersion:1,formatVersion:'table-jsonl-v1',schema:structuredClone(columns),columnOrder:columns.map(c=>c.columnId),rowCount:rows.length,chunks:descriptors};assertSchema('table-manifest.json',manifest);return{manifest,chunks};
}
function manifestShape(manifest){assertSchema('table-manifest.json',manifest);assertColumns(manifest.schema);if(manifest.schema.length!==manifest.columnOrder.length||manifest.schema.some((c,i)=>c.columnId!==manifest.columnOrder[i]))fail('VALIDATION_FAILED');let at=0;const artifactIds=new Set();for(const c of manifest.chunks){if(c.rowStart!==at||artifactIds.has(c.artifactId))fail('VALIDATION_FAILED');artifactIds.add(c.artifactId);at+=c.rowCount;}if(at!==manifest.rowCount)fail('VALIDATION_FAILED');}
export async function decodeTable(manifest,chunks){
 manifestShape(manifest);const parts=new Map();for(const c of chunks){if(parts.has(c.artifactId))fail('VALIDATION_FAILED');parts.set(c.artifactId,c.bytes);}if(parts.size!==manifest.chunks.length)fail('OFFLINE_RESOURCE_MISSING');
 const rows=[],ids=new Set();
 for(const desc of manifest.chunks){const bytes=parts.get(desc.artifactId);if(!(bytes instanceof Uint8Array))fail('OFFLINE_RESOURCE_MISSING');if(bytes.length!==desc.sizeBytes||await hashBytes(bytes)!==desc.sha256)fail('HASH_MISMATCH');if(bytes[0]===239&&bytes[1]===187&&bytes[2]===191)fail('VALIDATION_FAILED');let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('VALIDATION_FAILED');}if(!text.endsWith('\n')||text.includes('\r\n'))fail('VALIDATION_FAILED');const lines=text.slice(0,-1).split('\n');if(lines.length!==desc.rowCount)fail('VALIDATION_FAILED');for(const line of lines){const row=parseJsonStrict(line);assertRow(row,manifest.schema);if(ids.has(row.rowId))fail('VALIDATION_FAILED');ids.add(row.rowId);rows.push(row);}}
 return rows;
}
export function assertCSR(csr){
 const {rows,cols,indptr,indices,data}=csr;if(!Number.isSafeInteger(rows)||rows<0||rows>4294967294||!Number.isSafeInteger(cols)||cols<0||cols>4294967295||!Array.isArray(indptr)||!Array.isArray(indices)||!Array.isArray(data)||indptr.length!==rows+1||indptr[0]!==0||indptr.at(-1)!==data.length||indices.length!==data.length||data.length>4294967295)fail('VALIDATION_FAILED');
 if(indptr.some((v,i)=>!Number.isInteger(v)||v<0||v>data.length||i>0&&v<indptr[i-1])||indices.some(v=>!Number.isInteger(v)||v<0||v>=cols)||data.some(v=>!Number.isFinite(v)))fail('VALIDATION_FAILED');return csr;
}
const binary=(array,width,write)=>{const bytes=new Uint8Array(array.length*width),view=new DataView(bytes.buffer);array.forEach((v,i)=>view[write](i*width,v,true));return bytes;};
export async function encodeCSR(csr,rowIds,featureMapping){
 assertCSR(csr);const arrays={indptr:binary(csr.indptr,4,'setUint32'),indices:binary(csr.indices,4,'setUint32'),data:binary(csr.data,8,'setFloat64')},artifacts={},buffers=[];
 for(const [name,bytes]of Object.entries(arrays)){const artifactId=newId();artifacts[name]={artifactId,sizeBytes:bytes.length,sha256:await hashBytes(bytes)};buffers.push({artifactId,bytes});}
 const manifest={schemaVersion:1,formatVersion:'csr-v1',rows:csr.rows,cols:csr.cols,nnz:csr.data.length,indexType:'uint32-le',dataType:'float64-le',rowIds:structuredClone(rowIds),featureMapping:structuredClone(featureMapping),artifacts};assertSchema('csr-manifest.json',manifest);if(rowIds.length!==csr.rows||featureMapping.length!==csr.cols||new Set(featureMapping.map(f=>f.columnId)).size!==csr.cols)fail('VALIDATION_FAILED');return{manifest,buffers};
}
export async function decodeCSR(manifest,buffers){
 assertSchema('csr-manifest.json',manifest);if(manifest.rowIds.length!==manifest.rows||manifest.featureMapping.length!==manifest.cols||new Set(manifest.featureMapping.map(f=>f.columnId)).size!==manifest.cols)fail('VALIDATION_FAILED');
 const map=new Map(buffers.map(b=>[b.artifactId,b.bytes]));if(map.size!==buffers.length||map.size!==3)fail('VALIDATION_FAILED');const out={rows:manifest.rows,cols:manifest.cols};
 for(const [name,width,count,read]of [['indptr',4,manifest.rows+1,'getUint32'],['indices',4,manifest.nnz,'getUint32'],['data',8,manifest.nnz,'getFloat64']]){const d=manifest.artifacts[name],bytes=map.get(d.artifactId);if(!(bytes instanceof Uint8Array))fail('OFFLINE_RESOURCE_MISSING');if(bytes.length!==count*width||bytes.length!==d.sizeBytes||await hashBytes(bytes)!==d.sha256)fail('HASH_MISMATCH');const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);out[name]=Array.from({length:count},(_,i)=>view[read](i*width,true));}
 assertCSR(out);return{...out,rowIds:structuredClone(manifest.rowIds),featureMapping:structuredClone(manifest.featureMapping)};
}
export function encodeLineage(records){const ids=new Set();for(const r of records){assertSchema('row-lineage.json',r);if(ids.has(r.rowId))fail('VALIDATION_FAILED');ids.add(r.rowId);}return utf8(records.map(r=>JSON.stringify(r)).join('\n')+(records.length?'\n':''));}
export function decodeLineage(bytes){if(!(bytes instanceof Uint8Array))fail('VALIDATION_FAILED');if(bytes.length===0)return[];if(bytes[0]===239&&bytes[1]===187&&bytes[2]===191)fail('VALIDATION_FAILED');let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{fail('VALIDATION_FAILED');}if(!text.endsWith('\n'))fail('VALIDATION_FAILED');const records=text.slice(0,-1).split('\n').map(l=>parseJsonStrict(l));encodeLineage(records);return records;}
