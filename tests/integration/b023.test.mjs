import test from 'node:test';
import assert from 'node:assert/strict';
import {runB023Checks} from '../fixtures/b023.mjs';
import {checkGenerated} from '../../packages/contracts/scripts/check-generated.mjs';
await checkGenerated();
for(const result of await runB023Checks())test(result.id,()=>assert.equal(result.status,'passed',JSON.stringify(result.actual)));
