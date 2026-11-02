// Download only mongod.exe from the official ZIP via bounded HTTP ranges.
// Central-directory size/CRC are verified; no Windows service is installed.
import {readFile,writeFile,mkdir,open} from 'node:fs/promises';
import path from 'node:path';
import {inflateRawSync,crc32} from 'node:zlib';
import {createHash} from 'node:crypto';
const url='https://fastdl.mongodb.org/windows/mongodb-windows-x86_64-8.0.34.zip';
await mkdir('.runtime',{recursive:true});await mkdir('evidence',{recursive:true});
const getRange=async range=>{const r=await fetch(url,{headers:{Range:range}});if(r.status!==206)throw new Error(`Range not honored: ${r.status}`);return Buffer.from(await r.arrayBuffer());};
const tail=await getRange('bytes=-131072');let member;
for(let i=0;i<tail.length-46;i++)if(tail.readUInt32LE(i)===0x02014b50){const nl=tail.readUInt16LE(i+28),el=tail.readUInt16LE(i+30),cl=tail.readUInt16LE(i+32),name=tail.subarray(i+46,i+46+nl).toString();if(name.endsWith('/mongod.exe'))member={name,method:tail.readUInt16LE(i+10),crc:tail.readUInt32LE(i+16),compressed:tail.readUInt32LE(i+20),uncompressed:tail.readUInt32LE(i+24),offset:tail.readUInt32LE(i+42)};i+=45+nl+el+cl;}
if(!member||member.method!==8)throw new Error('ZIP member missing/unsupported');
const partial=path.resolve('.runtime/mongodb-binaries/mongodb-windows-x86_64-8.0.34.zip.downloading');
let fromPartial=false,compressed;
try {
  const h=await open(partial,'r');try{const header=Buffer.alloc(30);await h.read(header,0,30,member.offset);const start=member.offset+30+header.readUInt16LE(26)+header.readUInt16LE(28);const chunk=Buffer.alloc(member.compressed);const {bytesRead}=await h.read(chunk,0,chunk.length,start);if(bytesRead!==chunk.length)throw new Error('partial too short');compressed=chunk;fromPartial=true;}finally{await h.close();}
}catch {
  const header=await getRange(`bytes=${member.offset}-${member.offset+29}`);const start=member.offset+30+header.readUInt16LE(26)+header.readUInt16LE(28);
  compressed=await getRange(`bytes=${start}-${start+member.compressed-1}`);
}
const binary=inflateRawSync(compressed);if(binary.length!==member.uncompressed||crc32(binary)!==member.crc)throw new Error('ZIP CRC/size mismatch');
await writeFile('.runtime/mongod-8.0.34.exe',binary);
const evidence={source:url,member,fromExistingPartialDownload:fromPartial,zipMemberCrcVerified:true,sha256:createHash('sha256').update(binary).digest('hex'),bytes:binary.length,verifiedAt:new Date().toISOString(),fullArchiveChecksumVerified:false};
await writeFile('evidence/mongodb-binary-provenance.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence,null,2));
