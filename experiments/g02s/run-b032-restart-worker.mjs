import {MongoClient} from 'mongodb';
import {AuthService} from '../../apps/api/src/auth/service.ts';
import {FakeMailAdapter} from '../../apps/api/src/auth/fake-mail.ts';
import {StorageService} from '../../apps/api/src/storage/service.ts';
import {MetadataService} from '../../apps/api/src/metadata/service.ts';
import {createHash} from 'node:crypto';
process.once('message',async m=>{let client;try{
 client=new MongoClient(m.uri);await client.connect();const auth=new AuthService(client,client.db(m.dbName),{...m.config,secret:Buffer.from(m.secret,'base64')},new FakeMailAdapter(),()=>m.now);await auth.ready();
 const storage=new StorageService(auth,m.byteRoot);await storage.ready();const metadata=new MetadataService(auth,{artifacts:storage.authority});await metadata.ready();
 const content=await storage.content(m.token,m.artifactId),hash=createHash('sha256');let bytes=0;for await(const part of content.stream){hash.update(part);bytes+=part.length;}
 const version=await metadata.read(m.token,'version',m.versionId);process.send({ok:true,pid:process.pid,node:process.version,sha256:hash.digest('hex'),bytes,versionId:version.versionId,refs:await metadata.c.refs.countDocuments({targetEntityId:m.artifactId})});
}catch(e){process.send({ok:false,code:e.code??'WORKER_ERROR',message:e.message});}finally{await client?.close();process.disconnect();}});
