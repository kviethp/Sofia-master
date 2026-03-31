import fs from 'node:fs/promises';
import path from 'node:path';

import {runDoctor} from '../src/doctor.js';
import {getRuntimePaths} from '../src/paths.js';

const runtime = getRuntimePaths();
const doctor = await runDoctor();

const snapshot = {
  timestamp: new Date().toISOString(),
  sofiaVersion: doctor.runtimeSnapshot?.sofiaVersion || null,
  nodeVersion: doctor.runtimeSnapshot?.nodeVersion || null,
  packageManager: doctor.runtimeSnapshot?.packageManager || null,
  routerBaseUrl: doctor.runtime?.routerBaseUrl || null,
  storageMode: doctor.summary?.storageMode || null,
  requiredProfilesPresent: doctor.summary?.requiredProfilesPresent || false,
  routerReachable: doctor.summary?.routerReachable || false,
  openClawConfigValid: doctor.summary?.openClawConfigValid || false,
  approvalTransportReady: doctor.summary?.approvalTransportReady || false,
  modelIds: (doctor.router?.models || []).map((model) => model.id)
};

await fs.mkdir(runtime.reportDir, {recursive: true});
const outputPath = path.join(runtime.reportDir, 'compatibility-snapshot.json');
await fs.writeFile(outputPath, JSON.stringify(snapshot, null, 2), 'utf8');

console.log(JSON.stringify({status: 'ok', outputPath, snapshot}, null, 2));
