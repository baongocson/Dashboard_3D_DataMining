import Ajv2020 from 'ajv/dist/2020.js';
import standalone from 'ajv/dist/standalone/index.js';
import {build} from 'esbuild';
import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const ajv=new Ajv2020({strict:true,allErrors:true,validateSchema:true,code:{source:true,esm:true},coerceTypes:false,useDefaults:false,removeAdditional:false});
const sha=b=>createHash('sha256').update(b).digest('hex'),sourceHashes={};
const names={};async function load(dir){for(const f of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,f.name);if(f.isDirectory())await load(p);else if(f.name.endsWith('.json')){const bytes=await readFile(p),schema=JSON.parse(bytes.toString('utf8'));sourceHashes[path.relative(root,p).replaceAll('\\','/')]=sha(bytes);ajv.addSchema(schema);const rel=path.relative(path.join(root,'schemas'),p).replaceAll('\\','/');names[rel.replaceAll(/[^A-Za-z0-9_]/g,'_')]=schema.$id;}}}
await load(path.join(root,'schemas'));const code=standalone(ajv,names);await mkdir(path.join(root,'src/generated'),{recursive:true});
const bundled=await build({stdin:{contents:code,resolveDir:root,sourcefile:'validators-build.mjs'},bundle:true,platform:'neutral',format:'esm',target:'es2022',write:false,legalComments:'inline'});
await writeFile(path.join(root,'src/generated/validators.mjs'),bundled.outputFiles[0].contents);
await writeFile(path.join(root,'src/generated/schema-index.json'),JSON.stringify(names,null,2)+'\n');
sourceHashes['scripts/build.mjs']=sha(await readFile(fileURLToPath(import.meta.url)));
await writeFile(path.join(root,'src/generated/build-manifest.json'),JSON.stringify({algorithm:'SHA-256',compiler:'ajv8.20.0',sources:sourceHashes,outputs:{'src/generated/validators.mjs':sha(bundled.outputFiles[0].contents),'src/generated/schema-index.json':sha(await readFile(path.join(root,'src/generated/schema-index.json')))}},null,2)+'\n');
console.log(JSON.stringify({schemas:Object.keys(names).length,bytes:bundled.outputFiles[0].contents.length,compiler:'ajv8.20.0',browserRuntimeCompiler:false},null,2));
