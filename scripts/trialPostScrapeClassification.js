import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { parseArgs, runResilientScrape } from './resilientLocalScrape.js'

// Capture only. Classification is a separate command, after this exits.
export async function captureTrial({ count = 100, concurrency = 10, directory }) {
  if (count !== 'all' && (!Number.isSafeInteger(count) || count < 1)) throw new Error('Invalid scraper count')
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 10) throw new Error('Invalid scraper concurrency')
  const runDir = path.resolve(directory)
  fs.mkdirSync(runDir, { recursive: true })
  const manifestPath = path.join(runDir, 'sources.json')
  const catalog = getScraperCatalog()
  const sources = (count === 'all' ? catalog : catalog.slice(0, count)).map(provider => provider.name || provider.source)
  if (sources.some(source => typeof source !== 'string' || !source) || new Set(sources).size !== sources.length) {
    throw new Error('Trial requires unique scraper source identifiers')
  }
  if (fs.existsSync(manifestPath)) {
    const manifest = JSON.parse(fs.readFileSync(manifestPath))
    if (manifest.sources.some(source => !source)) {
      const checkpoint = JSON.parse(fs.readFileSync(path.join(runDir, 'run-state.json')))
      if (JSON.stringify(checkpoint.catalogSources) !== JSON.stringify(sources)) throw new Error('Catalog changed; use a new trial directory')
      fs.writeFileSync(manifestPath, JSON.stringify({ ...manifest, sources, manifestUpgradedAt: new Date() }, null, 2))
    } else if (JSON.stringify(manifest.sources) !== JSON.stringify(sources)) {
      throw new Error('Catalog changed; use a new trial directory')
    }
  } else fs.writeFileSync(manifestPath, JSON.stringify({ count, concurrency, sources, startedAt: new Date() }, null, 2))
  const env = {
    ...process.env,
    MONGO_URI: '', TELEGRAM_ENABLED: 'false', JOB_DESCRIPTION_REWRITE_MODE: 'off', SCRAPER_FIRST_N: count === 'all' ? '' : String(count),
    SCRAPER_ONLY: '', SCRAPER_START_AT: '', SCRAPER_START_AFTER: '',
    SCRAPER_CONCURRENCY: String(concurrency), SCRAPER_FAILURE_ABORT_THRESHOLD: String(sources.length + 1),
    SCRAPER_DRY_RUN_OUTPUT_DIRECTORY: path.join(runDir, 'snapshots'),
    SCRAPER_LOCAL_JOB_OUTBOX_DIRECTORY: path.join(runDir, 'outbox'),
    SCRAPER_RAW_CAPTURE_DIRECTORY: path.join(runDir, 'raw'),
    SCRAPER_DRY_RUN_MAX_JOBS_TO_ENRICH: 'all',
    WORKDAY_DETAIL_ENRICHMENT_BUDGET_MS: '480000',
    WORKDAY_SCRAPER_TIMEOUT_MS: '600000', WORKDAY_DETAIL_FETCH_CONCURRENCY: '2',
    WORKDAY_REQUEST_TIMEOUT_MS: '20000', SCRAPER_SOURCE_LIFECYCLE_TIMEOUT_MS: '1200000',
  }
  return runResilientScrape(parseArgs(['--run-dir', runDir, '--dry-run', '--parallel',
    '--max-restarts', '3', '--restart-delay-seconds', '15']), { env })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const count = process.argv[3] === 'all' ? 'all' : Number(process.argv[3] || 100)
  const concurrency = Number(process.argv[4] || 10)
  if (!process.argv[2]) throw new Error('Usage: node scripts/trialPostScrapeClassification.js RUN_DIRECTORY [COUNT|all] [CONCURRENCY]')
  const result = await captureTrial({ directory: process.argv[2], count, concurrency })
  process.exitCode = typeof result === 'number' ? result : result?.exitCode || 0
}
