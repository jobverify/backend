import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { run as runLegacy, createDelineaScraper as createLegacyScraper } from './native.js'
import { runCurrentNative } from './currentNative20261120.js'
export * from './native.js'

// Explicit historical text/JSON transports keep their existing fixture API.
// Ordinary imports and native fetch use today's independently published channel.
export const run = options => options?.fetchText || options?.fetchJson || options?.transport
  ? runLegacy(options) : runCurrentNative(options)
export const createDelineaScraper = options => ({run: runOptions => {
  const merged={...options,...runOptions}
  return merged.fetchText || merged.fetchJson || merged.transport
    ? createLegacyScraper(options).run(runOptions) : runCurrentNative(merged)
}})

// Preserve the existing CLI entry point; catalog imports do not load persistence.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if (isDryRun) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, 'delinea')
}
