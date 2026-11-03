import type {Db} from 'mongodb';
import type {Document} from 'mongodb';
export type RecordDoc=Document&{_id:string};
export const collections=(db:Db)=>({
  users:db.collection<RecordDoc>('users'),
  sessions:db.collection<RecordDoc>('sessions'),
  challenges:db.collection<RecordDoc>('auth_challenges'),
  control:db.collection<RecordDoc>('auth_control'),
  grants:db.collection<RecordDoc>('reset_grants'),
  limits:db.collection<RecordDoc>('auth_rate_limits'),
});
export async function prepareAuth(db:Db,serverGeneration:string) {
  const c=collections(db);
  await c.users.createIndex({canonicalEmail:1},{unique:true,name:'IX01_email'});
  await c.sessions.createIndex({tokenHash:1},{unique:true,name:'IX02_token'});
  await c.sessions.createIndex({userId:1,authEpoch:1,revokedAt:1},{name:'IX03_owner_epoch'});
  await c.sessions.createIndex({expiresAt:1},{expireAfterSeconds:86400,name:'IX03_expiry_grace'});
  await c.challenges.createIndex({canonicalEmail:1,purpose:1,generation:1},{name:'IX04_challenge_lookup'});
  await c.challenges.createIndex({cleanupAt:1},{expireAfterSeconds:0,name:'IX05_pending_cleanup'});
  await c.grants.createIndex({verifier:1},{unique:true,name:'IX06_grant'});
  await c.grants.createIndex({expiresAt:1},{expireAfterSeconds:86400,name:'IX05_grant_cleanup'});
  await c.limits.createIndex({cleanupAt:1},{expireAfterSeconds:0,name:'rate_cleanup'});
  await c.control.updateOne({_id:'activationCounter'},{$setOnInsert:{count:0,revision:0}},{upsert:true});
  await c.control.updateOne({_id:'server'},{$setOnInsert:{serverGeneration}},{upsert:true});
  const state=await c.control.findOne({_id:'server'});
  return state!.serverGeneration as string;
}
