import type {Db} from 'mongodb';
import type {RecordDoc} from '../auth/schema.ts';
export const metadataCollections=(db:Db)=>({
 projects:db.collection<RecordDoc>('projects'),datasets:db.collection<RecordDoc>('datasets'),
 versions:db.collection<RecordDoc>('dataset_versions'),branches:db.collection<RecordDoc>('dataset_branches'),
 refs:db.collection<RecordDoc>('resource_references'),intents:db.collection<RecordDoc>('import_intents'),
 identities:db.collection<RecordDoc>('mutation_commit_identities'),tombstones:db.collection<RecordDoc>('tombstones'),
 cursors:db.collection<RecordDoc>('metadata_read_cursors')
});
export async function prepareMetadata(db:Db){
 const c=metadataCollections(db);
 await c.projects.createIndex({ownerId:1,_id:1},{name:'IX07_owner_page'});
 await c.datasets.createIndex({ownerId:1,projectId:1,_id:1},{name:'IX08_dataset_page'});
 await c.versions.createIndex({ownerId:1,datasetId:1,branchId:1,_id:1},{name:'IX09_version_page'});
 await c.versions.createIndex({ownerId:1,parentVersionId:1},{name:'IX09_parent'});
 await c.branches.createIndex({ownerId:1,datasetId:1,_id:1},{name:'IX10_branch_page'});
 await c.refs.createIndex({ownerId:1,projectId:1,targetEntityId:1,strength:1},{name:'IX11_incoming'});
 await c.refs.createIndex({sourceEntityId:1,sourceRevision:1,targetEntityId:1,relation:1,sourceOrder:1},{unique:true,name:'IX12_outgoing'});
 await c.intents.createIndex({ownerId:1,logicalImportId:1},{unique:true,name:'intent_logical'});
 await c.intents.createIndex({ownerId:1,mutationId:1},{unique:true,name:'intent_mutation'});
 await c.intents.createIndex({ownerId:1,datasetId:1},{unique:true,name:'intent_dataset'});
 await c.intents.createIndex({ownerId:1,versionId:1},{unique:true,name:'intent_version'});
 await c.identities.createIndex({ownerId:1,mutationId:1},{unique:true,name:'IX17_durable_identity'});
 await c.identities.createIndex({ownerId:1,projectId:1,'result.branchResult.versionId':1},{name:'IX17_branch_history'});
 await c.tombstones.createIndex({ownerId:1,entityType:1,entityId:1},{unique:true,name:'IX21_tombstone'});
 // Intent/identity/tombstone are deliberately retained; expiry is authority, not TTL deletion.
 await c.cursors.createIndex({expiresAt:1},{expireAfterSeconds:86400,name:'metadata_cursor_grace'});
}
