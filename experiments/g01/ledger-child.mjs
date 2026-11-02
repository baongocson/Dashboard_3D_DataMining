// Deliberately terminates after fsync; only writes a synthetic run's own ledger.
import {open} from 'node:fs/promises';
const [file,entry]=process.argv.slice(2);
const handle=await open(file,'a');await handle.writeFile(entry+'\n');await handle.sync();await handle.close();
process.exit(42);
