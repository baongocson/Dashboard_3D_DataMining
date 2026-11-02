// Probe-only serializers/fixtures. Not the application's data-format package.
export const utf8 = value => new TextEncoder().encode(value);
export const uuid = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
export function check(value, message) { if (!value) throw new Error(message); }
export function rejects(fn) { try { fn(); return false; } catch { return true; } }
export async function sha(bytes) {
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
}
export function validateJson(value) {
  if (typeof value === 'number') check(Number.isFinite(value) && (!Number.isInteger(value) || Number.isSafeInteger(value)), 'unsafe/nonfinite number');
  if (typeof value === 'string') check(value.isWellFormed(), 'lone surrogate');
  if (value && typeof value === 'object') {
    check(Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype, 'non JSON object');
    for (const [k,v] of Object.entries(value)) { check(k.isWellFormed(), 'invalid key'); validateJson(v); }
  } else check(!['undefined', 'bigint', 'function', 'symbol'].includes(typeof value), 'not JSON');
}
// Check raw integer tokens BEFORE JSON.parse can lose digits. Not a general importer.
export function parseGuarded(text) {
  const tokens = text.match(/"(?:\\.|[^"\\])*"|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g) ?? [];
  for (const t of tokens) if (/^-?\d+$/.test(t)) check(BigInt(t) <= BigInt(Number.MAX_SAFE_INTEGER) && BigInt(t) >= BigInt(Number.MIN_SAFE_INTEGER), 'raw unsafe integer');
  const obj = JSON.parse(text); validateJson(obj); return obj;
}
export function encodeTable(rows, types) {
  for (const row of rows) {
    check(row.cells.length === types.length, 'cell count');
    row.cells.forEach((v,i) => {
      const type = types[i];
      if (v === null) return;
      check(typeof v === (type === 'number' ? 'number' : type === 'boolean' ? 'boolean' : 'string'), 'logical type');
      validateJson(v);
      if (type === 'bigint') check(/^-?\d+$/.test(v), 'bigint string');
      if (type === 'decimal') check(/^-?\d+(?:\.\d+)?$/.test(v), 'decimal string');
      if (type === 'json') JSON.parse(v);
    });
  }
  return utf8(rows.map(row => JSON.stringify(row)).join('\n') + '\n');
}
export function decodeTable(bytes) { return new TextDecoder('utf-8', {fatal:true}).decode(bytes).trimEnd().split('\n').map(parseGuarded); }
export function csrCheck(csr, maxDenseCells=100) {
  const {rows,cols,indptr,indices,data}=csr;
  check(indptr.length===rows+1 && indptr[0]===0 && indptr.at(-1)===data.length && indices.length===data.length, 'CSR size');
  for(let r=0;r<rows;r++) check(indptr[r]<=indptr[r+1], 'CSR monotonic');
  check(indices.every(x=>Number.isInteger(x)&&x>=0&&x<cols) && data.every(Number.isFinite), 'CSR values');
  return {nnz:data.length,denseAllowed:rows*cols<=maxDenseCells};
}
export async function runX01(canonicalize) {
  const results=[];
  const test=async(id, expected, fn)=>{try {const actual=await fn();results.push({id,expected,status:'passed',actual});} catch(e){results.push({id,expected,status:'failed',actual:e.message});}};
  await test('X01-01','RFC-style expected canonical bytes and Node/browser hash equal',async()=>{
    const a={z:3,a:{'ế':'Tiếng Việt',b:[true,null,'null',-0,1e-7]}};
    const b={a:{b:[true,null,'null',0,1e-7],'ế':'Tiếng Việt'},z:3};
    const expected='{"a":{"b":[true,null,"null",0,1e-7],"ế":"Tiếng Việt"},"z":3}';
    check(canonicalize(a)===expected && canonicalize(b)===expected,'canonical bytes');
    return {canonical:expected,hash:await sha(utf8(expected))};
  });
  await test('X01-02','Reject unsafe integer/nonfinite/undefined/lone surrogate before serialization',()=>{
    const values=[NaN,Infinity,-Infinity,9007199254740992,undefined,'\ud800',1n];
    check(values.every(v=>rejects(()=>validateJson(v))),'invalid accepted');
    check(rejects(()=>parseGuarded('{"n":9007199254740993}')),'raw precision lost');
    check(rejects(()=>canonicalize('\ud800')),'library accepted lone surrogate');
    return {rejected:values.length+2,rawUnsafeInteger:'rejected before parse'};
  });
  await test('X01-03','Typed strings, null tokens, source bytes, row/column IDs roundtrip',async()=>{
    const source=utf8('tên,số\r\n"Tiếng Việt 😀",1\r\n'); const before=await sha(source);
    const types=['string','number','boolean','date','datetime','bigint','decimal','json','string'];
    const row={rowId:uuid(1),cells:['Tiếng Việt 😀',1,true,'2026-11-02','2026-11-02T10:00:00.000Z','9007199254740993','1234567890.1234567890123456789','[1,{"a":2}]','null']};
    const empty={rowId:uuid(2),cells:[null,null,null,null,null,null,null,null,'']};
    const bytes=encodeTable([row,empty],types);const back=decodeTable(bytes);
    check(JSON.stringify(back)===JSON.stringify([row,empty]),'table roundtrip');
    const col={columnId:uuid(101),name:'cũ'};const renamed={...col,name:'mới'};
    check(renamed.columnId===col.columnId && back.filter(r=>r.rowId===uuid(1))[0].rowId===uuid(1),'stable IDs');
    check(await sha(source)===before,'source altered');
    return {bytes:bytes.length,sourceHash:before,tableHash:await sha(bytes),precision:back[0].cells.slice(5,7),rowIds:back.map(r=>r.rowId)};
  });
  await test('X01-04','Concat/join preserve ordered multi-source row lineage',()=>{
    const left=[{id:uuid(1),k:1},{id:uuid(2),k:null}];const right=[{id:uuid(3),k:1},{id:uuid(4),k:1}];
    let n=500;const joined=left.flatMap(a=>{const hits=right.filter(b=>a.k!==null&&a.k===b.k);return (hits.length?hits:[null]).map(b=>({rowId:uuid(n++),sources:[a.id,...(b?[b.id]:[])]}));});
    check(JSON.stringify(joined.map(r=>r.sources))===JSON.stringify([[uuid(1),uuid(3)],[uuid(1),uuid(4)],[uuid(2)]]),'join lineage');
    const concat=[...left,...right].map((r,i)=>({rowId:uuid(i+600),sources:[r.id]}));
    check(concat.every((r,i)=>r.rowId!==r.sources[0] && r.sources[0]===[...left,...right][i].id),'concat lineage');
    return {leftJoinRows:joined,concatSourceOrder:concat.map(r=>r.sources[0])};
  });
  await test('X01-05','CSR LE binary exact, invalid shape/index rejected, no densification',()=>{
    const csr={rows:2,cols:100000,indptr:[0,2,3],indices:[0,99999,3],data:[1,2.5,4]};
    const info=csrCheck(csr);check(!info.denseAllowed,'densify guard');
    const bytes=new Uint8Array(csr.data.length*8);const view=new DataView(bytes.buffer);csr.data.forEach((x,i)=>view.setFloat64(i*8,x,true));
    check(csr.data.every((x,i)=>view.getFloat64(i*8,true)===x),'LE roundtrip');
    check(rejects(()=>csrCheck({...csr,indices:[0,100000,3]})) && rejects(()=>csrCheck({...csr,indptr:[0,3,2]})),'invalid csr');
    return {...info,binaryBytes:bytes.length,allocatedDense:false,logicalDenseCells:200000};
  });
  await test('X01-06','20,000,000 byte input limit distinguished from larger valid artifact',async()=>{
    const sizes=[19999999,20000000,20000001]; const accepted=sizes.map(n=>n<=20000000);
    check(JSON.stringify(accepted)==='[true,true,false]','boundary');
    const bytes=new Uint8Array(20000000).fill(97);
    return {sizes,accepted,exactBytesHash:await sha(bytes),artifact21000000Allowed:21000000<=268435456};
  });
  return results;
}
export async function scaleFixture(rows,cols=50) {
  const before=globalThis.performance?.memory?.usedJSHeapSize??null;const start=performance.now();
  const source=utf8(Array.from({length:rows},(_,r)=>Array.from({length:cols},(_,c)=>(r+c)%97).join(',')).join('\n')+'\n');
  const afterSource=performance.now();
  const records=new TextDecoder().decode(source).trimEnd().split('\n').map((line,r)=>({rowId:uuid(r+1),cells:line.split(',').map(Number)}));
  const afterParse=performance.now();const encoded=encodeTable(records,Array(cols).fill('number'));const afterEncode=performance.now();
  const decoded=decodeTable(encoded);check(decoded.length===rows && decoded.at(-1).cells.length===cols,'scale roundtrip');
  return {rows,cols,sourceBytes:source.length,jsonlBytes:encoded.length,expansion:encoded.length/source.length,sourceHash:await sha(source),tableHash:await sha(encoded),generateMs:afterSource-start,parseMs:afterParse-afterSource,encodeMs:afterEncode-afterParse,decodeMs:performance.now()-afterEncode,heapBefore:before,heapAfter:globalThis.performance?.memory?.usedJSHeapSize??null,explicitLargeRepresentations:['source Uint8Array','decoded CSV string/lines (temporary)','records arrays','JSONL Uint8Array','decoded records'],peakHeapMeasured:false};
}
