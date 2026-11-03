// Protocol probe only; no network/AI/client storage and no product registry.
import canonicalize from 'canonicalize';
import {createHash,randomUUID} from 'node:crypto';
const fail=code=>{throw Object.assign(Error(code),{code});};
export const hashContext=context=>{const {keyContextHandle,...business}=context;return createHash('sha256').update(canonicalize(business)).digest('hex');};
export class ControlledFakeProvider{
 calls=[];pending=[];
 dispatch(payload,key){this.calls.push({payload:structuredClone(payload),keyMatchesFixture:key==='FAKE_KEY_RAM_ONLY'});return new Promise(resolve=>this.pending.push(resolve));}
 deliver(index,proposal){this.pending[index](structuredClone(proposal));}
}
export class AiProtocolProbe{
 #keys=new Map();#consents=new Map();#tokens=new Map();#alive=true;
 constructor({clock,session,provider,audit=new Map()}){this.clock=clock;this.session=session;this.provider=provider;this.audit=audit;for(const record of audit.values())if(record.status==='running')record.status='unknown';}
 auth(){if(!this.#alive||this.session.revoked||this.clock.now>=this.session.expiresAt)fail('SESSION_REVOKED');}
 providerAllowed(context){if(!['fake-a','fake-b'].includes(context.providerId)||context.modelId!=='fake-model')fail('AI_UNAVAILABLE');}
 keySet(key,providerId='fake-a'){this.auth();if(!['fake-a','fake-b'].includes(providerId))fail('AI_UNAVAILABLE');for(const [h,k]of this.#keys)if(k.providerId===providerId)this.#keys.delete(h);const h=randomUUID();this.#keys.set(h,{key,providerId,owner:this.session.owner,sessionId:this.session.id,epoch:this.session.epoch,lastUsed:this.clock.now,expiresAt:this.session.expiresAt});return h;}
 keyGet(handle,providerId){this.auth();const k=this.#keys.get(handle);if(!k||k.providerId!==providerId||k.owner!==this.session.owner||k.sessionId!==this.session.id||k.epoch!==this.session.epoch||this.clock.now-k.lastUsed>=1800000||this.clock.now>=k.expiresAt)fail('KEY_CONTEXT_INVALID');k.lastUsed=this.clock.now;return k.key;}
 prepare(context){this.auth();this.providerAllowed(context);const allowed=['task','sourceRefs','contextVersion','schemaSummary','aggregateStats','rowPayload','constraints','providerId','modelId','keyContextHandle'];if(Object.keys(context).some(k=>!allowed.includes(k)))fail('VALIDATION_FAILED');if(!context.sourceRefs?.length||!['suggestPreprocess','imputeText','explainResult'].includes(context.task))fail('VALIDATION_FAILED');const c={id:randomUUID(),hash:hashContext(context),payload:structuredClone(context),owner:this.session.owner,sessionId:this.session.id,epoch:this.session.epoch,expiresAt:this.clock.now+600000};this.#consents.set(c.id,c);return{consentId:c.id,contextHash:c.hash,payloadPreview:structuredClone(context),expiresAt:c.expiresAt,serverNow:this.clock.now};}
 consentGet(id){this.auth();const c=this.#consents.get(id);if(!c||c.owner!==this.session.owner||c.sessionId!==this.session.id||c.epoch!==this.session.epoch||this.clock.now>=c.expiresAt)fail('CONSENT_INVALID');return c;}
 confirm(id,hash){const c=this.consentGet(id);if(c.hash!==hash)fail('CONSENT_INVALID');const token=randomUUID();this.#tokens.set(token,{consentId:id,requestId:null});return token;}
 view(record){return structuredClone(record);}
 start(input){this.auth();if(Object.keys(input).some(k=>!['requestId','consentId','approvalToken','context'].includes(k)))fail('VALIDATION_FAILED');const {requestId,consentId,approvalToken,context}=input;this.providerAllowed(context);const h=hashContext(context),id=this.session.owner+':'+requestId,existing=this.audit.get(id);if(existing){if(existing.contextHash!==h||existing.consentId!==consentId||existing.sessionId!==this.session.id||existing.epoch!==this.session.epoch)fail('IDEMPOTENCY_MISMATCH');return this.view(existing);}const c=this.consentGet(consentId),token=this.#tokens.get(approvalToken);if(!token||token.consentId!==consentId||token.requestId&&token.requestId!==requestId||c.hash!==h)fail('CONSENT_INVALID');const key=this.keyGet(context.keyContextHandle,context.providerId);token.requestId=requestId;
const record={requestId,consentId,owner:this.session.owner,sessionId:this.session.id,epoch:this.session.epoch,contextHash:h,providerId:context.providerId,modelId:context.modelId,task:context.task,sourceRefs:structuredClone(context.sourceRefs),status:'running',createdAt:this.clock.now,dispatchCount:1};this.audit.set(id,record);const epoch=this.session.epoch;
const {keyContextHandle,...approved}=c.payload;this.provider.dispatch(approved,key).then(proposal=>{if(!this.#alive||this.session.revoked||this.session.epoch!==epoch||record.status==='cancelled')return;try{this.validateProposal(proposal);record.proposal=structuredClone(proposal);record.status='succeeded';}catch{record.status='failed';record.errorCode='INVALID_AI_PROPOSAL';}});return this.view(record);}
 expireRequests(){for(const r of this.audit.values())if(r.status==='running'&&this.clock.now-r.createdAt>=100)r.status='unknown';}
 cancel(id){this.auth();const r=this.audit.get(this.session.owner+':'+id);if(!r)fail('RESOURCE_NOT_FOUND');r.status='cancelled';return this.view(r);}
 validateProposal(p){const keys=['operationId','columnIds','suggestedParams','reason','textCandidates'];if(!p||Object.keys(p).some(k=>!keys.includes(k))||p.operationId!=='PREP.MISS_MEAN'||!Array.isArray(p.columnIds)||p.columnIds.some(c=>c!=='feature1')||typeof p.reason!=='string'||!p.suggestedParams||Object.keys(p.suggestedParams).length)fail('INVALID_AI_PROPOSAL');if(p.textCandidates?.some(c=>c.value!==null&&typeof c.value!=='string'))fail('INVALID_AI_PROPOSAL');}
 accept(requestId){this.auth();const r=this.audit.get(this.session.owner+':'+requestId);if(r?.status!=='succeeded')fail('NO_PROPOSAL');this.validateProposal(r.proposal);return{operationId:r.proposal.operationId,columnIds:r.proposal.columnIds,params:r.proposal.suggestedParams,execute:false,createsVersion:false};}
 revoke(){this.session.revoked=true;this.session.epoch++;this.#keys.clear();this.#consents.clear();this.#tokens.clear();for(const r of this.audit.values())if(r.sessionId===this.session.id&&r.status==='running')r.status='cancelled';}
 shutdown(){this.#alive=false;this.#keys.clear();this.#consents.clear();this.#tokens.clear();}
 durableSnapshot(){return[...this.audit.values()].map(({proposal,...record})=>record);}
 ramStatus(){return{keys:this.#keys.size,consents:this.#consents.size,approvalTokens:this.#tokens.size,alive:this.#alive};}
}
