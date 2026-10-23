import { readFileSync } from 'node:fs';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8')
);

const config = {
  version: packageJson.version,
  date: getDate(),
  root: './',
};

function getDate() {
  const date = new Date();
  const options = { year: 'numeric', month: 'long', day: '2-digit' };
  return date.toLocaleDateString('en-US', options);
}

export default config;
