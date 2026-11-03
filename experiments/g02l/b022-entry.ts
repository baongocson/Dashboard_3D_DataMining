import {WriterCoordinator,ProfileScope} from '../../apps/web/src/local/writer.ts';
import {TaskWorker} from '../../apps/web/src/local/worker.ts';
import {LocalStore} from '../../apps/web/src/local/store.ts';
import {setupB021,outputB021} from '../../tests/fixtures/b021.mjs';
import {hashCanonical} from '../../packages/data-format/src/index.mjs';
Object.assign(globalThis,{b022:{WriterCoordinator,ProfileScope,TaskWorker,LocalStore,setupB021,outputB021,hashCanonical}});
