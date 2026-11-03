import type {Db} from 'mongodb';
import type {RecordDoc} from '../auth/schema.ts';
export const storageCollections=(db:Db)=>({artifacts:db.collection<RecordDoc>('artifacts'),uploads:db.collection<RecordDoc>('uploads'),chunks:db.collection<RecordDoc>('upload_chunks'),leases:db.collection<RecordDoc>('storage_operation_leases'),control:db.collection<RecordDoc>('storage_control'),inventoryCursors:db.collection<RecordDoc>('storage_inventory_cursors')});
export async function prepareStorage(db:Db){const c=storageCollections(db);
 await c.artifacts.createIndex({ownerId:1,projectId:1,state:1,_id:1},{name:'IX15_private_artifacts'});
 await c.uploads.createIndex({ownerId:1,artifactId:1,sessionId:1,expiresAt:1},{name:'IX16_upload_lookup'});
 await c.chunks.createIndex({uploadId:1,index:1},{unique:true,name:'IX16_chunk_identity'});
 await c.leases.createIndex({ownerId:1,state:1,until:1},{name:'active_owner_uploads'});
 await c.leases.createIndex({instanceId:1,state:1,until:1},{name:'active_instance_uploads'});
 await c.inventoryCursors.createIndex({ownerId:1,projectId:1,_id:1},{name:'inventory_owner_scope'});
 await c.control.updateOne({_id:'leaseFence'},{$setOnInsert:{fence:0}},{upsert:true});
 // No TTL: expiry removes authority, never silently deletes retained data.
}
