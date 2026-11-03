import type {Db} from 'mongodb';
import type {RecordDoc} from '../auth/schema.ts';
export const syncCollections=(db:Db)=>({conflictCursors:db.collection<RecordDoc>('sync_conflict_cursors'),batches:db.collection<RecordDoc>('sync_batches'),receipts:db.collection<RecordDoc>('mutation_receipts'),changes:db.collection<RecordDoc>('project_changes'),conflicts:db.collection<RecordDoc>('conflicts'),reconciliations:db.collection<RecordDoc>('sync_reconciliations'),reconciliationRows:db.collection<RecordDoc>('sync_reconciliation_rows'),reconciliationCursors:db.collection<RecordDoc>('sync_reconciliation_cursors'),manifests:db.collection<RecordDoc>('project_manifests'),manifestRows:db.collection<RecordDoc>('project_manifest_rows'),manifestCursors:db.collection<RecordDoc>('project_manifest_cursors'),changeCursors:db.collection<RecordDoc>('project_change_cursors'),changeRanges:db.collection<RecordDoc>('project_change_ranges')});
export async function prepareSync(db:Db){
 await syncCollections(db).batches.createIndex({ownerId:1,batchId:1},{unique:true,name:'IX17_sync_batch'});
 await syncCollections(db).receipts.createIndex({ownerId:1,mutationId:1},{unique:true,name:'IX17_replay_receipt'});
 await syncCollections(db).changes.createIndex({ownerId:1,projectId:1,sequence:1},{unique:true,name:'IX19_change_sequence'});
 await syncCollections(db).changes.createIndex({ownerId:1,mutationId:1},{unique:true,name:'IX19_change_mutation'});
 await syncCollections(db).conflicts.createIndex({ownerId:1,mutationId:1},{unique:true,name:'IX20_conflict_mutation'});
 await syncCollections(db).conflicts.createIndex({ownerId:1,projectId:1,state:1,_id:1},{name:'IX20_conflict_list'});
 await syncCollections(db).reconciliations.createIndex({ownerId:1,state:1,expiresAt:1},{name:'reconciliation_build'});
 await syncCollections(db).reconciliationRows.createIndex({reconciliationId:1,position:1},{unique:true,name:'reconciliation_rows'});
 await syncCollections(db).reconciliationCursors.createIndex({ownerId:1,reconciliationId:1,offset:1},{unique:true,name:'reconciliation_cursor'});
 await syncCollections(db).manifests.createIndex({ownerId:1,state:1,expiresAt:1},{name:'manifest_build'});
 await syncCollections(db).manifestRows.createIndex({manifestId:1,position:1},{unique:true,name:'manifest_rows'});
 await syncCollections(db).manifestCursors.createIndex({ownerId:1,manifestId:1,offset:1},{unique:true,name:'manifest_cursor'});
 await syncCollections(db).changeRanges.createIndex({ownerId:1,checkpointId:1},{unique:true,name:'change_range_checkpoint'});
 await syncCollections(db).changeCursors.createIndex({ownerId:1,rangeId:1,afterSequence:1},{unique:true,partialFilterExpression:{kind:'page'},name:'change_page_cursor'});
 // Logical expiry only. Retain declarations and identities; no TTL/deletion worker.
}
