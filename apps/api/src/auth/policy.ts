import {domainToASCII} from 'node:url';
import {createHash,createHmac,randomBytes,timingSafeEqual} from 'node:crypto';
import {hash,verify} from '@node-rs/argon2';
export class AuthError extends Error {
  code:string;
  status:number;
  constructor(code:string,status=422) {super(code);this.code=code;this.status=status;}
}
export function reject(code:string,status=422):never {throw new AuthError(code,status);}
export const token=()=>randomBytes(32).toString('base64url');
export const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
export function mac(secret:Buffer,...parts:(string|number)[]) {
  return createHmac('sha256',secret).update(JSON.stringify(parts)).digest('hex');
}
export function equal(a:string,b:string) {
  const aa=Buffer.from(a),bb=Buffer.from(b);return aa.length===bb.length&&timingSafeEqual(aa,bb);
}
export function emailPolicy(raw:string) {
  const display=raw.trim(),at=display.lastIndexOf('@'),local=display.slice(0,at),domain=domainToASCII(display.slice(at+1)).toLowerCase();
  if(at<1||display.indexOf('@')!==at||local.length>64||!domain||!domain.includes('.')||/[\s\p{Cc}]/u.test(display)||!/^[a-z0-9.-]+$/.test(domain)||domain.split('.').some(x=>!x||x.startsWith('-')||x.endsWith('-')))reject('VALIDATION_FAILED');
  return {displayEmail:display,canonicalEmail:local.toLowerCase()+'@'+domain};
}
export function passwordPolicy(value:string,confirm?:string) {
  if([...value].length<15||[...value].length>128||!value.isWellFormed()||(confirm!==undefined&&confirm!==value))reject('VALIDATION_FAILED');
  return value;
}
export function namePolicy(value:string) {
  if(!value.trim()||[...value].length>100||/[\p{Cc}]/u.test(value))reject('VALIDATION_FAILED');return value;
}
export const HASH_POLICY=Object.freeze({algorithm:2,memoryCost:19456,timeCost:2,parallelism:1,outputLen:32});
export class PasswordHasher {
  private active=0;
  private waiting:(()=>void)[]=[];
  peakActive=0;
  async run<T>(fn:()=>Promise<T>):Promise<T> {
    if(this.active>=2) {
      if(this.waiting.length>=8)reject('RATE_LIMITED',429);
      await new Promise<void>(resolve=>this.waiting.push(resolve));
    } else this.active++;
    this.peakActive=Math.max(this.peakActive,this.active);
    try{return await fn();}finally{const next=this.waiting.shift();if(next)next();else this.active--;}
  }
  create(password:string){passwordPolicy(password);return this.run(()=>hash(password,HASH_POLICY));}
  check(encoded:string,password:string){passwordPolicy(password);return this.run(()=>verify(encoded,password));}
}
