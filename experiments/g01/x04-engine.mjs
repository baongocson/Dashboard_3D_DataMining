// Probe adapters only. All fit/predict work runs in a dedicated browser worker.
import MLR from 'ml-regression-multivariate-linear';
import Logistic from 'ml-logistic-regression';
import KNN from 'ml-knn';
import {kmeans} from 'ml-kmeans';
import {PCA} from 'ml-pca';
import {Matrix} from 'ml-matrix';
import {versions,random} from './x04-fixtures.mjs';
export function assert(ok,message){if(!ok)throw new Error(message);}
export function close(a,b,tolerance=1e-9){assert(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=tolerance,`${a} != ${b} tolerance ${tolerance}`);}
export function same(a,b){assert(JSON.stringify(a)===JSON.stringify(b),'value mismatch');}
export function matrix(X){assert(Array.isArray(X),'UNSUPPORTED_SPARSE: dense arrays only; no conversion');assert(X.length>=2&&Array.isArray(X[0])&&X[0].length>0,'INVALID_SHAPE');const p=X[0].length;assert(X.every(r=>Array.isArray(r)&&r.length===p&&r.every(Number.isFinite)),'INVALID_SHAPE_OR_NONFINITE');assert(X.length*p<=10000000,'DENSE_CELL_LIMIT');return p;}
export function validate(algorithm,f){const p=matrix(f.X),params=f.params??{};if(['linear','logistic','knn'].includes(algorithm)){assert(Array.isArray(f.y)&&f.y.length===f.X.length,'INVALID_TARGET_LENGTH');if(algorithm==='linear')assert(f.y.every(Number.isFinite),'INVALID_REGRESSION_TARGET');else assert(new Set(f.y).size>=2&&f.y.every(v=>typeof v==='string'||typeof v==='number'&&Number.isFinite(v)),'INVALID_CLASSES');}
  assert(f.X.some(r=>r.some((v,j)=>v!==f.X[0][j])),'ALL_FEATURES_CONSTANT');
  if(algorithm==='knn')assert(Number.isInteger(params.k)&&params.k>=1&&params.k<=f.X.length,'INVALID_K');
  if(algorithm==='logistic')assert(Number.isInteger(params.numSteps)&&params.numSteps>0&&params.numSteps<=5000&&Number.isFinite(params.learningRate)&&params.learningRate>0,'INVALID_LOGISTIC_PARAMS');
  if(algorithm==='kmeans')assert(Number.isInteger(params.k)&&params.k>=2&&params.k<=new Set(f.X.map(JSON.stringify)).size&&Number.isInteger(params.maxIterations)&&params.maxIterations>0,'INVALID_CLUSTER_K_OR_ITERATIONS');
  if(algorithm==='pca')assert(Number.isInteger(params.nComponents)&&params.nComponents>=1&&params.nComponents<=Math.min(f.X.length-1,p),'INVALID_COMPONENT_COUNT');
  return p;
}
export function fitPreprocess(train){const p=train[0].length;const mean=Array.from({length:p},(_,j)=>{const xs=train.map(r=>r[j]).filter(v=>v!==null);assert(xs.length&&xs.every(Number.isFinite),'NO_VALID_TRAIN_VALUES');return xs.reduce((a,b)=>a+b,0)/xs.length;});const imputed=train.map(r=>r.map((v,j)=>v===null?mean[j]:v));const std=mean.map((m,j)=>Math.sqrt(imputed.reduce((s,r)=>s+(r[j]-m)**2,0)/train.length));return{fitScope:'train',mean,std,zeroSpreadPolicy:'error',imputation:'mean',scaling:'standard-ddof0',featureOrder:Array.from({length:p},(_,i)=>`x${i}`)};}
export function transform(X,pre){return X.map(r=>r.map((v,j)=>{assert(pre.std[j]>0,'ZERO_SPREAD');return((v===null?pre.mean[j]:v)-pre.mean[j])/pre.std[j];}));}
export function textFit(docs){const tokens=docs.map(d=>new Set(d.toLowerCase().split(/\s+/)));const vocabulary=[...new Set(tokens.flatMap(x=>[...x]))].sort();return{fitScope:'train',vocabulary,idf:vocabulary.map(t=>Math.log((1+docs.length)/(1+tokens.filter(d=>d.has(t)).length))+1),tokenizer:'lowercase-whitespace-v1'};}
export function labels(y){return[...new Set(y)];}
export function fit(algorithm,f,onEnter=()=>{}){const p=validate(algorithm,f);const params=f.params??{};const training=f.X.map(r=>r.slice());let native,labelMapping=null;const t=performance.now();onEnter();
  if(algorithm==='linear')native=new MLR(training,f.y.map(x=>[x]),{intercept:params.intercept??true,statistics:false});
  else if(algorithm==='logistic'){labelMapping=labels(f.y);native=new Logistic({numSteps:params.numSteps,learningRate:params.learningRate});native.train(new Matrix(training.map(r=>[...r,1])),Matrix.columnVector(f.y.map(v=>labelMapping.indexOf(v))));}
  else if(algorithm==='knn'){labelMapping=labels(f.y);native=new KNN(training,f.y,{k:params.k});}
  else if(algorithm==='kmeans')native=kmeans(training,params.k,{...params});
  else if(algorithm==='pca')native=new PCA(training,{method:params.method??'SVD',center:params.center??true,scale:params.scale??false});
  else throw new Error('UNKNOWN_ALGORITHM');
  const fitMs=performance.now()-t;
  const model=algorithm==='kmeans'?{centroids:native.centroids,distance:'squaredEuclidean',tiePolicy:'first-index'}:JSON.parse(JSON.stringify(native.toJSON()));
  const envelope={serializerVersion:algorithm==='kmeans'?'x04-portable-centroids-v1':'x04-native-json-v1',algorithm,engine:versions[algorithm],featureOrder:Array.from({length:p},(_,i)=>`x${i}`),params,labelMapping,adapter:{logisticBiasColumn:algorithm==='logistic'},fitScope:['linear','logistic','knn'].includes(algorithm)?'train':'full',model};
  return{native,envelope,fitMs};
}
export function predictNative(algorithm,native,X,params,labelMapping){if(algorithm==='linear')return native.predict(X).map(r=>r[0]);if(algorithm==='logistic')return native.predict(new Matrix(X.map(r=>[...r,1]))).map(i=>labelMapping[i]);if(algorithm==='knn')return native.predict(X);if(algorithm==='kmeans')return native.nearest(X);return native.predict(X,{nComponents:params.nComponents}).to2DArray();}
export function reloadPredict(e,X){assert(e.engine===versions[e.algorithm],'ENGINE_VERSION_MISMATCH');assert(e.featureOrder.length===X[0].length,'FEATURE_ORDER_MISMATCH');if(e.preprocess)X=transform(X,e.preprocess);if(e.algorithm==='kmeans')return X.map(r=>e.model.centroids.reduce((best,c,i)=>{const d=r.reduce((s,v,j)=>s+(v-c[j])**2,0);return d<best.d?{d,i}:best;},{d:Infinity,i:-1}).i);
  const lib={linear:MLR,logistic:Logistic,knn:KNN,pca:PCA}[e.algorithm];return predictNative(e.algorithm,lib.load(e.model),X,e.params,e.labelMapping);
}
export function regression(actual,pred){const n=actual.length;assert(n>0&&n===pred.length,'INVALID_EVAL_SIZE');const errors=actual.map((v,i)=>v-pred[i]);const mse=errors.reduce((s,v)=>s+v*v,0)/n,mean=actual.reduce((s,v)=>s+v,0)/n,denom=actual.reduce((s,v)=>s+(v-mean)**2,0);return{mae:errors.reduce((s,v)=>s+Math.abs(v),0)/n,mse,rmse:Math.sqrt(mse),r2:denom===0?{defined:false,value:null,reason:'constant target'}:{defined:true,value:1-n*mse/denom}};}
export function classification(actual,pred,positive){assert(actual.length>0&&actual.length===pred.length,'INVALID_EVAL_SIZE');const order=[...new Set([...actual,...pred,positive])];const confusion=order.map(()=>order.map(()=>0));actual.forEach((v,i)=>confusion[order.indexOf(v)][order.indexOf(pred[i])]++);const k=order.indexOf(positive),tp=confusion[k][k],fp=confusion.reduce((s,r)=>s+r[k],0)-tp,fn=confusion[k].reduce((s,v)=>s+v,0)-tp;const precision=tp+fp?tp/(tp+fp):null,recall=tp+fn?tp/(tp+fn):null,f1=2*tp+fp+fn?2*tp/(2*tp+fp+fn):null;return{accuracy:actual.filter((v,i)=>v===pred[i]).length/actual.length,positive,precision,recall,f1,undefinedReasons:{...(precision===null?{precision:'no predicted positives'}:{}),...(recall===null?{recall:'no actual positives'}:{}),...(f1===null?{f1:'no actual or predicted positives'}:{})},confusion,order};}
export function silhouette(X,clusters){const ids=[...new Set(clusters)];assert(ids.length>=2&&ids.length<X.length,'INVALID_SILHOUETTE');assert(X.length*(X.length-1)/2<=2000000,'PAIRWISE_COST_LIMIT');const dist=(a,b)=>Math.sqrt(a.reduce((s,v,j)=>s+(v-b[j])**2,0));return X.reduce((sum,r,i)=>{const own=X.filter((_,j)=>j!==i&&clusters[j]===clusters[i]);if(!own.length)return sum;const a=own.reduce((s,x)=>s+dist(r,x),0)/own.length;const b=Math.min(...ids.filter(c=>c!==clusters[i]).map(c=>{const group=X.filter((_,j)=>clusters[j]===c);return group.reduce((s,x)=>s+dist(r,x),0)/group.length;}));return sum+(b-a)/Math.max(a,b);},0)/X.length;}
export function rawSparseAttempt(algorithm,csr){try{let result;if(algorithm==='linear')result=new MLR(csr,[[1],[2],[3],[4]],{statistics:false});else if(algorithm==='logistic'){result=new Logistic({numSteps:1});result.train(csr,Matrix.columnVector([0,0,1,1]));}else if(algorithm==='knn')result=new KNN(csr,[0,0,1,1],{k:1});else if(algorithm==='kmeans')result=kmeans(csr,2,{maxIterations:2,seed:42});else result=new PCA(csr);return{status:'inconclusive',acceptedRawObject:true,verifiedSparseSolve:false,resultType:typeof result};}catch(e){return{status:'blocked',acceptedRawObject:false,verifiedSparseSolve:false,error:{name:e.name,message:e.message},convertedToDense:false};}}
