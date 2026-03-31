import {runConformance} from '../src/conformance.js';

const report = await runConformance();
console.log(JSON.stringify(report, null, 2));
