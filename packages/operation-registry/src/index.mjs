import catalog from './catalog.json' with {type:'json'};
function freeze(v){if(v&&typeof v==='object'){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
export const registry=freeze(catalog);
const byId=new Map(registry.operations.map(o=>[o.id,o]));
export function getOperation(id){return byId.get(id)??null;}
export function availability(id){const op=getOperation(id);return op?{operationId:id,...op.capability}:{operationId:id,status:'unavailable',reason:'UNSUPPORTED_OPERATION'};}
export function requireAvailable(id){const value=availability(id);if(value.status!=='available')throw Object.assign(Error('Thao tác chưa được kiểm chứng.'),{code:'UNSUPPORTED_OPERATION',operationId:id});return getOperation(id);}
