import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNative } from './native.js';
export const SOURCE = 'garena';
export const COMPANY = 'Garena';
export const CAREERS_URL = 'https://careers.garena.com/global/careers';
export const DISPOSITION = 'first-party-garena-nuxt-html';
export const run = options => runNative(options);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js');
  const jobs = await run();
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'));
  else await saveToDB(jobs, SOURCE);
}
