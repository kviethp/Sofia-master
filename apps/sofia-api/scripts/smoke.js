import {runSmoke} from '../src/smoke.js';

const smoke = await runSmoke();
console.log(JSON.stringify(smoke, null, 2));
