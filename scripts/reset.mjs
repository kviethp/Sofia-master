import fs from 'node:fs/promises';
import path from 'node:path';

const rootDir = process.cwd();
const targets = [
  path.join(rootDir, '.sofia', 'tmp'),
  path.join(rootDir, '.sofia', 'reports')
];

for (const target of targets) {
  await fs.rm(target, {recursive: true, force: true});
  await fs.mkdir(target, {recursive: true});
}

console.log(
  JSON.stringify(
    {
      status: 'ok',
      resetTargets: targets
    },
    null,
    2
  )
);
