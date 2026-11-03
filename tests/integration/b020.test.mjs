import test from 'node:test';
import assert from 'node:assert/strict';
import {runB020Checks} from '../fixtures/b020.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();
const results=await runB020Checks();
for(const result of results)test(result.id,()=>assert.equal(result.status,'passed',JSON.stringify(result.actual)));
