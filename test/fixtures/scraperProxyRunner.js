import { registerHooks } from 'node:module'
const target = new URL(process.argv[2])
if (target.protocol !== 'http:' || target.hostname !== '127.0.0.1' || !target.port || target.pathname !== '/jobs') throw new Error('Loopback fixture target required')
globalThis.scraperProxyFixture = { saves: 0, source: { name: 'proxy-fixture', run: async () => {
  const response = await fetch(target, { signal: AbortSignal.timeout(5000) })
  if (!(await response.json()).ok) throw new Error('Unexpected loopback response')
  return [{ jobId: 'proxy-role', title: 'Engineer', location: 'Bengaluru, India',
    applyUrl: 'https://example.test/jobs/proxy-role', description: 'Build and maintain software for customers.' }]
} } }
const stubs = new Map([
  [new URL('../../scraper-support/providers/index.js', import.meta.url).href,
    'export const buildScrapers = () => [globalThis.scraperProxyFixture.source]'],
  [new URL('../../scraper-support/utils/saveToDB.js', import.meta.url).href, `
    export const saveToDB = async () => { globalThis.scraperProxyFixture.saves++; return {inserted:1} }
    export const saveDryRunSnapshot = async () => { throw new Error('Unexpected snapshot') }
    export const purgeExpiredJobsForQuotaRecovery = async () => { throw new Error('Unexpected purge') }
  `],
  [new URL('../../scraper-support/utils/scraperPersistence.js', import.meta.url).href, `
    export const ensureScrapersSeeded = async () => {}
    export const markPipelineRunStarted = async () => {}
    export const markPipelineRunFinished = async () => {}
    export const readPreviousScraperRun = async () => null
    export const upsertScraperStatus = async () => {}
    export const writeScraperRun = async () => {}
  `],
  [new URL('../../scraper-support/utils/rawCapture.js', import.meta.url).href, `
    export const saveRawSourceCapture = async () => null
    export const saveRawSourceFailure = async () => null
  `],
  [new URL('../../src/models/ScraperStatus.js', import.meta.url).href,
    'export default {findOne:()=>({lean:()=>({exec:async()=>({isActive:true})})})}'],
  [new URL('../../src/services/jobDatasetSummaryService.js', import.meta.url).href,
    'export const refreshJobDatasetSummary = async () => {}'],
])
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === 'dotenv') return { url: 'data:text/javascript,export default {config(){}}', shortCircuit: true }
    return next(specifier, context)
  },
  load(url, context, next) {
    return stubs.has(url) ? { format: 'module', source: stubs.get(url), shortCircuit: true } : next(url, context)
  },
})
for (const key of Object.keys(process.env)) if (key.startsWith('SCRAPER_')) delete process.env[key]
process.env.MONGO_URI = 'mongodb://127.0.0.1:1/no-connection-fixture'
process.env.SCRAPER_CONCURRENCY = '1'
console.log = console.warn = console.error = () => {}
const { runAll } = await import('../../scraper-support/runner.js')
const summary = await runAll()
process.stdout.write(JSON.stringify({ summary, saves: globalThis.scraperProxyFixture.saves }))
