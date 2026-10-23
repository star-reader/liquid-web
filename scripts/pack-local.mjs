import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

mkdirSync(new URL('../release/', import.meta.url), { recursive: true });
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(npm, ['pack', './dist', '--pack-destination', './release'], {
  cwd: new URL('../', import.meta.url),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
