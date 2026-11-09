import fs from 'node:fs'
import path from 'node:path'
import { fork } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { classifyProviderImplementation } from './reportScriptCatalogTopology.js'

const backend = fileURLToPath(new URL('../', import.meta.url))
const worker = fileURLToPath(new URL('./catalogExtractionWorker.js', import.meta.url))

export function resolveExtractionAuditTimeout(value = 45000) {
  const timeout = Number(value)
  if (!Number.isInteger(timeout) || timeout < 1000 || timeout > 600000) throw new Error('Audit timeout must be between1,000 and600,000 milliseconds')
  return timeout
}

export function isExtractionAuditCacheReusable(row, { now = Date.now(), capturePublicAts = false } = {}) {
  const age = now - new Date(row?.completedAt).getTime()
  return age >= 0 && age < 48 * 3600000
    && (!capturePublicAts || (Array.isArray(row.retainedNativeApiEvidence) && row.retainedNativeApiEvidence.length > 0))
}

export function selectCatalogExtractionAuditProviders(catalog, {
  runtime = null, sourceIds = null, includePublished = false, classifyImplementation = classifyProviderImplementation,
} = {}) {
  if (sourceIds?.some(source => !catalog.some(provider => provider.source === source))) {
    throw new Error(`Unknown source requested: ${sourceIds.filter(source => !catalog.some(provider => provider.source === source)).join(', ')}`)
  }
  const inventory = new Map((runtime?.databaseAvailable === true && Array.isArray(runtime.inventory)
    ? runtime.inventory : []).map(row => [row.source, row]))
  return catalog.filter(provider => (!sourceIds || sourceIds.includes(provider.source))
    && (includePublished || !(inventory.get(provider.source)?.visibleJobs > 0))
    && ['script', 'shared-adapter'].includes(classifyImplementation(provider).type))
    .sort((a, b) => Number(b.adapter !== 'script') - Number(a.adapter !== 'script') || a.source.localeCompare(b.source))
}

export function runIsolatedExtraction(provider, { outputDirectory, timeoutMs = 45000, capturePublicAts = false } = {}) {
  timeoutMs = resolveExtractionAuditTimeout(timeoutMs)
  const attemptedAt = new Date().toISOString()
  fs.mkdirSync(outputDirectory, { recursive: true })
  return new Promise(resolve => {
    let settled = false
    const child = fork(worker, [], {
      cwd: backend,
      // Filesystem mutations are confined to this source's audit directory;
      // child processes, workers and native addons are denied by Node.
      execArgv: ['--use-system-ca', '--permission', `--allow-fs-read=${backend}`, `--allow-fs-read=${outputDirectory}`, `--allow-fs-write=${outputDirectory}`],
      stdio: ['ignore', 'ignore', 'ignore', 'ipc'],
      env: { ...process.env, MONGO_URI: 'mongodb://127.0.0.1:1/audit-disabled',
        MONGODB_URI: 'mongodb://127.0.0.1:1/audit-disabled', SCRAPER_AUDIT: 'true' },
    })
    const finish = result => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      child.kill()
      resolve(result)
    }
    const failure = outcome => ({ source: provider.source, attemptedAt, completedAt: new Date().toISOString(), outcome,
      mode: 'isolated-direct-live-extraction-no-database', productionWrites: false,
      rawJobs: null, rawJobsBasis: 'unavailable-failed-attempt', indiaJobs: null, eligibleJobs: null, inventoryEvidence: null })
    const timer = setTimeout(() => finish(failure('extraction-timeout')), timeoutMs)
    child.once('message', finish)
    child.once('error', () => finish(failure('audit-process-failed')))
    child.once('exit', (exitCode, signal) => finish({ ...failure('audit-process-exited-without-result'),
      auditProcessExit: { exitCode: Number.isInteger(exitCode) ? exitCode : null, signal: signal || null } }))
    child.send({ provider, outputDirectory: path.resolve(outputDirectory), capturePublicAts })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = key => { const i = args.indexOf(key); return i < 0 ? null : args[i + 1] }
  const runtime = option('--runtime') ? JSON.parse(fs.readFileSync(path.resolve(option('--runtime')), 'utf8')) : null
  const output = path.resolve(option('--output') || '../artifacts/catalog-extractions')
  const concurrency = Number(option('--concurrency') || 8)
  if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 12) throw new Error('Concurrency must be between 1 and 12')
  const timeoutMs = resolveExtractionAuditTimeout(option('--timeout-ms') ?? undefined)
  if (option('--sources') && option('--sources-file')) throw new Error('Choose --sources or --sources-file')
  const ids = option('--sources-file') ? JSON.parse(fs.readFileSync(path.resolve(option('--sources-file')), 'utf8')) : option('--sources')?.split(',')
  if (ids && (!Array.isArray(ids) || ids.some(id => typeof id !== 'string'))) throw new Error('Source IDs must be a JSON string array')
  const providers = selectCatalogExtractionAuditProviders(getScraperCatalog(), {
    runtime, sourceIds: ids, includePublished: args.includes('--include-published'),
  })
  const capturePublicAts = args.includes('--capture-public-ats')
  if (capturePublicAts && (!ids?.length || providers.some(provider => provider.adapter !== 'publicAts'))) {
    throw new Error('--capture-public-ats requires explicit publicAts source IDs')
  }
  fs.mkdirSync(path.join(output, 'sources'), { recursive: true })
  const completed = new Map()
  for (const provider of providers) {
    const file = path.join(output, 'sources', `${provider.source}.json`)
    if (!args.includes('--refresh') && fs.existsSync(file)) {
      const row = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (isExtractionAuditCacheReusable(row, { capturePublicAts })) completed.set(provider.source, row)
    }
  }
  const summarize = () => {
    const value = { generatedAt: new Date().toISOString(), selectedSources: providers.length,
      completedSources: completed.size, remainingSources: providers.length - completed.size,
      state: completed.size === providers.length ? 'review-required' : 'running', productionWrites: false,
      runtimePublicationAvailable: runtime?.databaseAvailable === true && Array.isArray(runtime.inventory),
      outcomeCounts: [...completed.values()].reduce((a, row) => { a[row.outcome] = (a[row.outcome] || 0) + 1; return a }, {}) }
    fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify(value, null, 2) + '\n')
    return value
  }
  let index = 0
  console.log(JSON.stringify(summarize()))
  const timer = setInterval(() => console.log(JSON.stringify(summarize())), 30000)
  try {
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (index < providers.length) {
        const provider = providers[index++]
        if (completed.has(provider.source)) continue
        const result = await runIsolatedExtraction(provider, { outputDirectory: path.join(output, 'isolated', provider.source), timeoutMs, capturePublicAts })
        fs.writeFileSync(path.join(output, 'sources', `${provider.source}.json`), JSON.stringify(result, null, 2) + '\n')
        completed.set(provider.source, result)
      }
    }))
  } finally {
    clearInterval(timer)
    fs.writeFileSync(path.join(output, 'outcomes.json'), JSON.stringify([...completed.values()].map(({ jobs, ...row }) => row), null, 2) + '\n')
    console.log(JSON.stringify(summarize()))
  }
}
