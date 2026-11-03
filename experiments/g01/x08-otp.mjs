// Synthetic OTP protocol probe, deliberately not production auth or mail.
import {randomInt,randomBytes,randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
const fail=code=>{throw Object.assign(new Error(code),{code});};
export const canonicalEmail=email=>email.trim().toLowerCase();
export class FakeMailAdapter{
 #messages=[];next='accepted';
 async send(message){this.#messages.push({...message,status:this.next});return{status:this.next,delivered:false,transport:'in-memory fake; never SMTP'};}
 otpForTest(id){return this.#messages.filter(m=>m.challengeId===id).at(-1)?.code;}
 metadata(){return this.#messages.map(({code,...m})=>({...m,delivered:false}));}
}
export class OtpProbe{
 #secret=randomBytes(32);#records=new Map();#sends=new Map();#grants=new Map();#epochs=new Map();
 constructor({clock,mail,rng=()=>randomInt(0,1000000)}){this.clock=clock;this.mail=mail;this.rng=rng;}
 digest(record,code){return createHmac('sha256',this.#secret).update(JSON.stringify([record.id,record.email,record.purpose,record.generation,code])).digest('hex');}
 epoch(email){return this.#epochs.get(canonicalEmail(email))??1;}
 public(record){return{challengeId:record.id,purpose:record.purpose,generation:record.generation,serverNow:this.clock.now,expiresAt:record.expiresAt,resendAvailableAt:record.resendAt,attemptsRemaining:Math.max(0,5-record.wrong),sendStatus:record.sendStatus};}
 quota(email,purpose){const key=`${email}:${purpose}`,timestamps=(this.#sends.get(key)??[]).filter(t=>this.clock.now-t<3600000);if(timestamps.length>=5)fail('RATE_LIMITED');timestamps.push(this.clock.now);this.#sends.set(key,timestamps);}
 async create(email,purpose='register'){if(!['register','reset'].includes(purpose))fail('VALIDATION_FAILED');email=canonicalEmail(email);this.quota(email,purpose);const record={id:randomUUID(),email,purpose,generation:1,wrong:0,consumed:false,expiresAt:this.clock.now+300000,resendAt:this.clock.now+60000,createdAt:this.clock.now};const code=String(this.rng()).padStart(6,'0');if(!/^\d{6}$/.test(code))fail('INVALID_RNG');record.verifier=this.digest(record,code);this.#records.set(record.id,record);const sent=await this.mail.send({challengeId:record.id,email,purpose,generation:1,code});record.sendStatus=sent.status;return this.public(record);}
 async resend(id){const r=this.#records.get(id);if(!r||r.consumed)fail('OTP_INVALID');if(this.clock.now<r.resendAt)fail('RATE_LIMITED');if(this.clock.now-r.createdAt>=86400000)fail('OTP_EXPIRED');this.quota(r.email,r.purpose);r.generation++;r.wrong=0;r.expiresAt=this.clock.now+300000;r.resendAt=this.clock.now+60000;const code=String(this.rng()).padStart(6,'0');r.verifier=this.digest(r,code);const sent=await this.mail.send({challengeId:r.id,email:r.email,purpose:r.purpose,generation:r.generation,code});r.sendStatus=sent.status;return this.public(r);}
 verify({id,purpose,generation,code,email}){const r=this.#records.get(id);if(!r||r.consumed||r.purpose!==purpose||r.generation!==generation||email&&canonicalEmail(email)!==r.email)fail('OTP_INVALID');if(this.clock.now>=r.expiresAt)fail('OTP_EXPIRED');if(r.wrong>=5)fail('OTP_ATTEMPTS_EXCEEDED');const correct=typeof code==='string'&&/^\d{6}$/.test(code)&&timingSafeEqual(Buffer.from(r.verifier,'hex'),Buffer.from(this.digest(r,code),'hex'));if(!correct){r.wrong++;fail(r.wrong>=5?'OTP_ATTEMPTS_EXCEEDED':'OTP_INVALID');}r.consumed=true;if(purpose==='register')return{verified:true,activatedAutomatically:false,scope:'activation transaction not part of X08'};const token=randomBytes(32).toString('base64url'),key=createHmac('sha256',this.#secret).update(token).digest('hex');this.#grants.set(key,{email:r.email,expiresAt:this.clock.now+300000,epoch:this.epoch(r.email),consumed:false});return{resetGrant:token,expiresAt:this.clock.now+300000};}
 useGrant(token){const key=createHmac('sha256',this.#secret).update(token).digest('hex'),g=this.#grants.get(key);if(!g||g.consumed||g.epoch!==this.epoch(g.email))fail('RESET_GRANT_INVALID');if(this.clock.now>=g.expiresAt)fail('RESET_GRANT_EXPIRED');g.consumed=true;this.#epochs.set(g.email,g.epoch+1);return{epoch:g.epoch+1,autoLogin:false,localOutboxTouched:false,scope:'in-memory grant/epoch state, not DB transaction or actual password reset'};}
 snapshot(){return{records:[...this.#records.values()],grants:[...this.#grants.values()],epochs:[...this.#epochs],sendRateCounts:[...this.#sends].map(([key,times])=>({key,count:times.length}))};}
}
