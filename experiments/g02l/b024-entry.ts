import {runB024Checks,setupB024,disposeB024,fakeAck} from '../../tests/fixtures/b024.mjs';
import {SyncCoordinator} from '../../apps/web/src/local/sync.ts';
import {LocalStore} from '../../apps/web/src/local/store.ts';
import {outputB021,commitB021} from '../../tests/fixtures/b021.mjs';
Object.assign(globalThis,{b024:{runB024Checks,setupB024,disposeB024,fakeAck,SyncCoordinator,LocalStore,outputB021,commitB021}});
