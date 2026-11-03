import {chromium} from '../g01/node_modules/playwright/index.mjs';
import {MongoMemoryReplSet} from 'mongodb-memory-server-core';
import {MongoClient} from 'mongodb';
import {AuthService} from '../../apps/api/src/auth/service.ts';
import {FakeMailAdapter} from '../../apps/api/src/auth/fake-mail.ts';
import {createApp} from '../../apps/api/src/app.ts';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
import {password} from '../../tests/fixtures/b030.mjs';
import {mkdir,readFile,writeFile,readdir,copyFile} from 'node:fs/promises';
import {createHash,randomBytes,randomUUID} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');process.chdir(root);await checkGenerated();
const runId=new Date().toISOString().replace(/[:.]/g,'-'),out=path.resolve('experiments/g02s/evidence/b030-browser',runId),runtime=path.resolve('experiments/g02s/.runtime/b030-browser',runId);
await mkdir(out,{recursive:true});await mkdir(runtime,{recursive:true});
const sha=b=>createHash('sha256').update(b).digest('hex'),check=(v,m)=>{if(!v)throw Error(m);};
const report={task:'B030',runId,environment:{node:process.version,os:os.platform()+' '+os.release(),mongodb:'8.0.34',TLS:'self-signed, ignoreHTTPSErrors only in disposable context; no OS trust change'},cases:[],externalRequests:[],cleanup:[]};
let repl,client,app;
try {
  const openssl='C:/msys64/ucrt64/bin/openssl.exe',key=path.join(runtime,'key.pem'),cert=path.join(runtime,'cert.pem');
  const cp=spawnSync(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-days','1','-keyout',key,'-out',cert,'-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{encoding:'utf8',windowsHide:true});
  if(cp.status!==0)throw Error('Scoped self-signed certificate generation failed');
  const binary=path.resolve('experiments/g01/.runtime/mongod-8.0.34.exe');report.environment.mongoBinarySha256=sha(await readFile(binary));await mkdir(path.join(runtime,'db'));
  repl=await MongoMemoryReplSet.create({binary:{systemBinary:binary,version:'8.0.34'},instanceOpts:[{dbPath:path.join(runtime,'db')}],replSet:{count:1,name:'b030browserrs',ip:'127.0.0.1',storageEngine:'wiredTiger'}});
  client=new MongoClient(repl.getUri());await client.connect();
  // Listener origin is known after ephemeral bind; the auth config object is explicitly updated before any request.
  const config={profile:'test',origin:'https://127.0.0.1',secret:randomBytes(32),serverGeneration:randomUUID()},mail=new FakeMailAdapter();
  const auth=new AuthService(client,client.db('b030_browser'),config,mail);await auth.ready();
  app=await createApp(auth,{tls:{key:await readFile(key),cert:await readFile(cert)}});
  await app.listen({host:'127.0.0.1',port:0});const address=app.server.address();config.origin='https://127.0.0.1:'+address.port;report.environment.origin=config.origin;
  for(const channel of ['chrome','msedge']) {
    let browser;
    try {
      browser=await chromium.launch({channel,headless:true,args:['--disable-background-networking']});
      const context=await browser.newContext({ignoreHTTPSErrors:true});
      await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin===config.origin)await route.continue();else {report.externalRequests.push({browser:channel,origin:u.origin});await route.abort();}});
      const page=await context.newPage();await page.goto(config.origin+'/api/v1/absent-transport-probe');
      const email=channel+'@example.test',deviceId=randomUUID();
      const run=async(p,b,method=b===undefined?'GET':'POST')=>page.evaluate(async({p,b,method})=>{
        if(!globalThis.csrfB030||p==='/auth/csrf'){const r=await fetch('/api/v1/auth/csrf');globalThis.csrfB030=(await r.json()).data.csrfToken;if(p==='/auth/csrf')return {status:r.status};}
        const r=await fetch('/api/v1'+p,{method,headers:b===undefined?{}:{'content-type':'application/json','x-csrf-token':globalThis.csrfB030},...(b===undefined?{}:{body:JSON.stringify(b)})});
        return {status:r.status,json:await r.json(),cache:r.headers.get('cache-control'),clear:r.headers.get('clear-site-data')};
      },{p,b,method});
      check((await run('/auth/session')).status===401,'clean browser private401');
      const c=await run('/auth/register',{email,displayName:'Người dùng '+channel,password,confirmPassword:password});check(c.status===200,'browser register');
      const m=mail.messages.at(-1),challenge=c.json.data;
      check((await run('/auth/register/verify',{challengeId:challenge.challengeId,purpose:'register',generation:challenge.generation,otp:m.otp})).status===200,'browser verify');
      const l=await run('/auth/login',{email,password,deviceId});check(l.status===200,'browser login');
      const cookies=await context.cookies(),sessionCookie=cookies.find(c=>c.name==='__Host-dashboard_session');
      check(sessionCookie?.httpOnly&&sessionCookie.secure&&sessionCookie.sameSite==='Lax'&&sessionCookie.path==='/','cookie flags');
      check(!await page.evaluate(()=>document.cookie.includes('dashboard_session')),'HttpOnly hides session');
      const session=await run('/auth/session');check(session.status===200&&session.cache==='no-store'&&!session.clear,'private no-store');
      const tab=await context.newPage();await tab.goto(config.origin+'/api/v1/absent-transport-probe');
      const tabSession=await tab.evaluate(async()=>{const r=await fetch('/api/v1/auth/session');return (await r.json()).data.sessionId;});
      check(tabSession===session.json.data.sessionId,'same profile tabs share session');
      const profile=await run('/me',{displayName:'Tên Việt đã sửa'},'PATCH');check(profile.status===200,'profile patch');
      const cross=await context.request.post(config.origin+'/api/v1/auth/logout',{data:{},headers:{Origin:'https://evil.invalid','x-csrf-token':'invalid'}});
      check(cross.status()===403&&(await run('/auth/session')).status===200,'cross-origin logout refused');
      check((await run('/auth/logout',{})).status===200,'browser logout');check((await run('/auth/session')).status===401,'browser cookie cleared');
      // Browser screenshot intentionally identifies the engine/version/run and has no credentials.
      await page.evaluate(meta=>{document.body.replaceChildren();const h=document.createElement('h1');h.textContent='B030 — kiểm chứng HTTPS cookie';const p=document.createElement('p');p.textContent=meta;document.body.append(h,p);},'HTTPS cookie, shared tab, profile, CSRF, logout passed | '+channel+' '+browser.version()+' | '+runId);
      await page.screenshot({path:path.join(out,channel+'.png')});
      report.cases.push({id:'B030-HTTPS-browser-'+channel,status:'passed',browser:channel,version:browser.version(),actual:{registerVerifyLoginOverHTTPS:true,secureHttpOnlySameSiteLax:true,cookieValuesPersistedInEvidence:false,sharedTabSameSession:true,profilePatch:true,crossOriginLogout403:true,logoutThen401:true,externalNetworkAllowed:false}});
      await context.close();
    }catch(e){report.cases.push({id:'B030-HTTPS-browser-'+channel,status:'failed',actual:e.code??e.message});}
    finally{if(browser)await browser.close();}
  }
}catch(e){report.fatal=e.code??e.message;}
finally{
  if(app)await app.close();if(client)await client.close();if(repl){await repl.stop({doCleanup:false,force:false});report.cleanup.push({ownedMongoStopped:true,dbRetained:true});}
  report.counts=Object.fromEntries(['passed','failed','inconclusive','blocked'].map(s=>[s,report.cases.filter(c=>c.status===s).length]));
  const sources=['experiments/g02s/run-b030-browser.mjs','apps/api/src/app.ts','apps/api/src/auth/service.ts','apps/api/src/auth/policy.ts','apps/api/src/auth/schema.ts','apps/api/src/auth/fake-mail.ts','packages/contracts/src/generated/build-manifest.json'];report.sources={};
  for(const p of sources){const b=await readFile(p);report.sources[p]=sha(b);const dest=path.join(out,'sources',p);await mkdir(path.dirname(dest),{recursive:true});await copyFile(p,dest);}
  await writeFile(path.join(out,'results.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});const hashes={};
  async function walk(dir){for(const f of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,f.name);if(f.isDirectory())await walk(p);else hashes[path.relative(out,p).replaceAll('\\','/')]=sha(await readFile(p));}}await walk(out);
  await writeFile(path.join(out,'hashes.json'),JSON.stringify(hashes,null,2)+'\n',{flag:'wx'});
  console.log(JSON.stringify({out:path.relative(root,out),counts:report.counts,fatal:report.fatal,external:report.externalRequests}));if(report.fatal||report.counts.failed)process.exitCode=1;
}
