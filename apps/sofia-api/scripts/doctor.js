import {runDoctor} from '../src/doctor.js';

const report = await runDoctor();
console.log(JSON.stringify(report, null, 2));
