import {runB021Checks,setupB021,outputB021,stageB021,commitB021} from '../../tests/fixtures/b021.mjs';
import {LocalStore} from '../../apps/web/src/local/store.ts';
import {hashBytes} from '../../packages/data-format/src/index.mjs';
Object.assign(globalThis,{b021:{runB021Checks,setupB021,outputB021,stageB021,commitB021,LocalStore,hashBytes}});
