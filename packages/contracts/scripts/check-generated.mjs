import {readFile,readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
export async function checkGenerated(){const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),m=JSON.parse(await readFile(path.join(root,'src/generated/build-manifest.json'),'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
 const schemaFiles=[];async function walk(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await walk(p);else if(f.name.endsWith('.json'))schemaFiles.push(path.relative(root,p).replaceAll('\\','/'));}}await walk(path.join(root,'schemas'));
 if(schemaFiles.some(f=>!m.sources[f])||schemaFiles.length!==Object.keys(m.sources).filter(f=>f.startsWith('schemas/')).length)throw Error('Contract schemas changed; rebuild validators first.');
 for(const [file,h]of Object.entries({...m.sources,...m.outputs}))if(sha(await readFile(path.join(root,file)))!==h)throw Error('Stale generated contracts: '+file+'; run npm run build in packages/contracts.');
 return{schemas:schemaFiles.length,compiler:m.compiler,generatedMatchesSource:true};}
