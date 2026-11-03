import {fixtures,multiclass,leakage,csr,splitIds,scaleData} from './x04-fixtures.mjs';
import {assert,close,same,fit,validate,matrix,fitPreprocess,transform,textFit,predictNative,reloadPredict,regression,classification,silhouette,rawSparseAttempt} from './x04-engine.mjs';
const copy=x=>structuredClone(x);
function scenario(algorithm,f,onEnter){const pre=['linear','logistic','knn'].includes(algorithm)?fitPreprocess(f.X):null;const train=pre?transform(f.X,pre):f.X;
 const trained=fit(algorithm,{...f,X:train},onEnter);trained.envelope.preprocess=pre;trained.envelope.execution={source:'synthetic-X04',trainRowIds:f.X.map((_,i)=>`train-${i}`),testRowIds:f.test?.map((_,i)=>`test-${i}`)??[],seed:42};
 const query=f.test??f.X;const t=performance.now();const prediction=predictNative(algorithm,trained.native,pre?transform(query,pre):query,f.params,trained.envelope.labelMapping);return{...trained,prediction,predictMs:performance.now()-t};}
function compare(pred,expected,tolerance=1e-9){assert(pred.length===expected.length,'prediction length');pred.forEach((x,i)=>typeof x==='number'?close(x,expected[i],tolerance):same(x,expected[i]));}
function suite(algorithm){const cases=[];let artifact;
 const test=(name,expected,fn)=>{try{const actual=fn();cases.push({id:`X04-${algorithm}-${name}`,algorithm,expected,status:actual?.status??'passed',actual});}catch(e){cases.push({id:`X04-${algorithm}-${name}`,algorithm,expected,status:'failed',actual:{name:e.name,message:e.message}});}};
 const f=copy(fixtures[algorithm]);
 test('dense-oracle',f.oracle,()=>{const trained=scenario(algorithm,f);artifact=trained.envelope;
   if(['linear','logistic','knn'].includes(algorithm)){compare(trained.prediction,f.expected);if(algorithm==='linear')close(regression(f.expected,trained.prediction).mse,0,1e-16);else close(classification(f.expected,trained.prediction,'positive').accuracy,1);}
   if(algorithm==='kmeans'){const centers=trained.native.centroids.slice().sort((a,b)=>a[0]-b[0]);centers.forEach((r,i)=>r.forEach((v,j)=>close(v,[[0,1],[10,11]][i][j])));const inertia=f.X.reduce((s,r,i)=>s+r.reduce((q,v,j)=>q+(v-trained.native.centroids[trained.native.clusters[i]][j])**2,0),0);close(inertia,4);const expected=1-1/((Math.sqrt(200)+Math.sqrt(244))/2)-1/((Math.sqrt(164)+Math.sqrt(200))/2);close(silhouette(f.X,trained.native.clusters),expected);}
   if(algorithm==='pca'){close(trained.native.getExplainedVariance()[0],1);close(trained.native.getEigenvalues()[0],20/3);trained.prediction.forEach(r=>close(Math.abs(r[0]),3*Math.sqrt(2)));same(trained.native.means,[0,0]);}
   return{prediction:trained.prediction,fitMs:trained.fitMs,predictMs:trained.predictMs,engine:artifact.engine,executionLocation:'DedicatedWorkerGlobalScope',workerGlobal:typeof document==='undefined'&&typeof self.postMessage==='function',details:algorithm==='pca'?{eigenvalues:trained.native.getEigenvalues(),explainedVariance:trained.native.getExplainedVariance()}:algorithm==='kmeans'?{centroids:trained.native.centroids,inertia:4,silhouette:silhouette(f.X,trained.native.clusters)}:regressionOrClass(algorithm,f.expected,trained.prediction)};
 });
 test('seed-repeat','Seeded split identical for 42, changed IDs for 43; engine repeat reproducible without hidden Math.random',()=>{
   const a=splitIds(30,42),b=splitIds(30,42),c=splitIds(30,43);same(a,b);assert(JSON.stringify(a)!==JSON.stringify(c),'seed ignored');assert(!a.train.some(i=>a.test.includes(i))&&new Set([...a.train,...a.test]).size===30,'split overlap');
   const first=scenario(algorithm,f),second=scenario(algorithm,f);same(first.prediction,second.prediction);
   let nativeSeed=null;if(algorithm==='kmeans'){const seeded={...f,params:{...f.params,initialization:'random',seed:42}};const r1=scenario(algorithm,seeded),r2=scenario(algorithm,seeded);same(r1.native.clusters,r2.native.clusters);same(r1.native.centroids,r2.native.centroids);nativeSeed={seed:42,initialization:'random',clusters:r1.native.clusters,centroids:r1.native.centroids};}
   return{split:a,engineRandomness:algorithm==='kmeans'?'native seeded random initialization':'deterministic estimator, seed applies to split/data only',nativeSeed,repeatEqual:true};
 });
 test('sparse-native','Attempt CSR object directly, no conversion; unsupported native sparse is blocked rather than passed',()=>rawSparseAttempt(algorithm,copy(csr)));
 test('adapter-invalid','Reject CSR without densification, empty/ragged/nonfinite/constant matrices and algorithm parameter boundaries before fit',()=>{
   const invalid=[{...f,X:copy(csr)},{...f,X:[]},{...f,X:[[1],[1,2]]},{...f,X:[[NaN],[1]]},{...f,X:[[Infinity],[1]]},{...f,X:[[1],[1]]}];
   if(['linear','logistic','knn'].includes(algorithm))invalid.push({...f,y:[1]});
   if(['logistic','knn'].includes(algorithm))invalid.push({...f,y:f.y.map(()=>0)});
   if(algorithm==='knn')invalid.push({...f,params:{k:0}},{...f,params:{k:f.X.length+1}});
   if(algorithm==='kmeans')invalid.push({...f,params:{...f.params,k:0}},{...f,params:{...f.params,k:f.X.length+1}});
   if(algorithm==='pca')invalid.push({...f,params:{...f.params,nComponents:0}},{...f,params:{...f.params,nComponents:3}});
   if(algorithm==='logistic')invalid.push({...f,params:{...f.params,numSteps:0}},{...f,params:{...f.params,learningRate:-1}});
   const errors=invalid.map(x=>{try{validate(algorithm,x);return null;}catch(e){return e.message;}});assert(errors.every(Boolean),'invalid accepted');let cellGuard;try{matrix(Array(10001).fill(Array(1000).fill(1)));}catch(e){cellGuard=e.message;}same(cellGuard,'DENSE_CELL_LIMIT');let pairGuard;try{silhouette(Array(2001).fill([0]),Array.from({length:2001},(_,i)=>i%2));}catch(e){pairGuard=e.message;}same(pairGuard,'PAIRWISE_COST_LIMIT');return{rejected:errors.length,errors,cellGuard,pairGuard,scope:'adapter validation, distinct from native library behavior; guard shapes reuse rows, not memory stress',densified:false};
 });
 test('leakage','Only training rows fit numeric/text/category parameters; extreme/test-only values cannot alter fitted model/PCA state',()=>{
   const pre=fitPreprocess(copy(leakage.train));close(pre.mean[0],1);close(pre.std[0],Math.sqrt(2/3));const before=JSON.stringify(pre);const out=transform(leakage.test,pre);transform(leakage.testPerturbed,pre);same(before,JSON.stringify(pre));assert(pre.mean[0]!==leakage.wrongFullDataMean,'leaked mean');
   const text=textFit(leakage.trainDocs);same(text.vocabulary,['blue','red']);close(text.idf[0],leakage.expectedBlueIdf);assert(!text.vocabulary.includes('testonly'),'leaked vocabulary');
   const categories=[...new Set(leakage.trainCategories)];assert(!categories.includes(leakage.testCategory),'leaked category');
   const encodeCategory=v=>{assert(categories.includes(v),'UNKNOWN_CATEGORY');return categories.map(c=>Number(c===v));};
   const oneHot=leakage.trainCategories.map(encodeCategory);let unknownRejected=false;try{encodeCategory(leakage.testCategory);}catch{unknownRejected=true;}assert(unknownRejected,'unknown category learned');
   const tfidf=doc=>{const tokens=doc.toLowerCase().split(/\s+/);return text.vocabulary.map((v,j)=>tokens.filter(t=>t===v).length*text.idf[j]);};
   const denseText=leakage.trainDocs.map(tfidf);close(denseText[0][0],leakage.expectedBlueIdf);same(tfidf(leakage.testDocs?.[0]??'testonly red'),[0,1]);
   const toCSR=rows=>{const data=[],indices=[],indptr=[0];for(const row of rows){row.forEach((v,j)=>{if(v!==0){data.push(v);indices.push(j);}});indptr.push(data.length);}return{shape:[rows.length,rows[0].length],data,indices,indptr};};
   const textCSR=toCSR(denseText),categoryCSR=toCSR(oneHot);
   for(const [dense,sparse]of [[denseText,textCSR],[oneHot,categoryCSR]])for(let i=0;i<dense.length;i++)for(let j=0;j<dense[i].length;j++){let v=0;for(let k=sparse.indptr[i];k<sparse.indptr[i+1];k++)if(sparse.indices[k]===j)v=sparse.data[k];close(v,dense[i][j]);}
   const original=scenario(algorithm,f);const altered=scenario(algorithm,{...f,test:f.test.map(r=>r.map(v=>v+10000))});same(original.envelope.model,altered.envelope.model);
   return{numeric:pre,transformedSentinel:out,wrongFullDataMean:3334,text,categories,oneHot,denseText,textCSR,categoryCSR,unknownRejected,encodingScope:'probe tokenizer/raw-count TF-IDF and one-hot only; CSR equivalence is not native sparse engine support',unknownCategoryPolicy:'error (not silently learned)',modelUnaffectedByTest:true,pcaInsideEvaluationScope:algorithm==='pca'?'same native training PCA model, held-out points only transformed':'not this algorithm'};
 });
 if(['logistic','knn'].includes(algorithm))test('multiclass','Three disjoint geometrical classes left/right/top have expected test labels',()=>{const m=scenario(algorithm,{...copy(multiclass),params:f.params});same(m.prediction,multiclass.expected);return{prediction:m.prediction,expected:multiclass.expected,labelMapping:m.envelope.labelMapping};});
 test('metrics-boundaries','Independent hand oracle and undefined denominator semantics',()=>{
   if(algorithm==='linear'){const m=regression([1,2,3],[2,2,2]);close(m.mae,2/3);close(m.mse,2/3);close(m.rmse,Math.sqrt(2/3));close(m.r2.value,0);assert(regression([1,1],[1,1]).r2.value===null,'constant R2');return m;}
   if(['logistic','knn'].includes(algorithm)){const m=classification([1,1,0,0],[1,1,1,0],1);close(m.accuracy,3/4);close(m.precision,2/3);close(m.recall,1);close(m.f1,4/5);const undefinedMetric=classification([1,0],[0,0],1);assert(undefinedMetric.precision===null,'undefined precision');return{oracle:m,undefinedMetric};}
   if(algorithm==='kmeans'){let rejected=false;try{silhouette(f.X,[0,0,0,0]);}catch{rejected=true;}assert(rejected,'silhouette invalid');return{oneClusterRejected:rejected};}
   const trained=scenario(algorithm,f);const reconstructed=trained.native.invert(trained.native.predict(f.X)).to2DArray();reconstructed.forEach((r,i)=>r.forEach((v,j)=>close(v,f.X[i][j])));return{reconstruction:reconstructed,constantMatrixRejectedByAdapter:true};
 });
 return{algorithm,cases,artifact};
}
function regressionOrClass(algorithm,y,pred){return algorithm==='linear'?regression(y,pred):classification(y,pred,'positive');}
self.onmessage=async e=>{const {jobId,generation,mode,algorithm}=e.data;const post=value=>self.postMessage({jobId,generation,...value});
 try {
  if(mode==='suite'){post({type:'result',value:suite(algorithm)});return;}
  if(mode==='reload'){const envelope=JSON.parse(e.data.serialized);const started=performance.now();const prediction=reloadPredict(envelope,e.data.X);post({type:'result',value:{algorithm,prediction,loadPredictMs:performance.now()-started,newWorker:true,fitCalled:false}});return;}
  if(mode==='scale'||mode==='cancel'){
    const n=e.data.rows,p=e.data.cols;const data=scaleData(algorithm,n,p);const splits=splitIds(n,42,0.2);let f;
    if(mode==='cancel'){f={...data,test:data.test.slice(0,1),params:algorithm==='logistic'?{numSteps:500,learningRate:0.0001}:data.params};}
    else{const supervised=['linear','logistic','knn'].includes(algorithm);const trainIds=supervised?splits.train:Array.from({length:n},(_,i)=>i);const queryIds=supervised?splits.test.slice(0,40):trainIds.slice(0,40);f={...data,X:trainIds.map(i=>data.X[i]),y:trainIds.map(i=>data.y[i]),test:queryIds.map(i=>data.X[i]),params:algorithm==='logistic'&&n>=50000?{numSteps:20,learningRate:0.00001}:data.params};}
    const start=performance.now();const trained=scenario(algorithm,f,()=>post({type:'entered-estimator',rows:f.X.length,cols:p,mode}));
    assert(trained.prediction.flat(Infinity).every(x=>typeof x!=='number'||Number.isFinite(x)),'NONFINITE_SCALE_OUTPUT');
    post({type:'result',value:{algorithm,inputRows:n,trainRows:f.X.length,queryRows:f.test.length,cols:p,splitSeed:42,dataSeed:123,params:f.params,fitMs:trained.fitMs,predictMs:trained.predictMs,totalFitPredictMs:performance.now()-start,workerMemory:{status:'inconclusive',bytes:null,reason:'No trustworthy per-worker peak heap API used'},sampledEvaluationRows:mode==='scale'?40:1,fullTrainingRowsRetained:true,predictionPreview:trained.prediction.slice(0,3)}});return;
  }
  throw new Error('unknown mode');
 }catch(error){post({type:'error',error:{name:error.name,message:error.message}});}
};
