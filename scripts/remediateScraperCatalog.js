import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { getScraperCatalog } from '../scraper-support/providers/index.js'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import { analyzePublishableJobs } from '../scraper-support/utils/publishableJobMetrics.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { classifyProviderImplementation } from './reportScriptCatalogTopology.js'
import { classifyScraperError } from '../scraper-support/utils/failureClassification.js'
import { identifyPublicAtsBoard } from '../scraper-support/utils/publicAtsIdentity.js'
import { discoverOfficialAtsBoards, defaultFetchJson } from '../scraper-support/utils/officialAtsDiscovery.js'
export { discoverOfficialAtsBoards } from '../scraper-support/utils/officialAtsDiscovery.js'
export { identifyPublicAtsBoard }

export const auditCatalogProvider = async (provider, options = {}) => {
  const attemptedAt = new Date().toISOString()
  const discovery = await discoverOfficialAtsBoards(provider, options)
  const base = { source: provider.source, companyName: provider.companyName || provider.source, attemptedAt,
    implementation: classifyProviderImplementation(provider), discovery,
    rawJobs: null, eligibleJobs: null, jobs: null, inventoryEvidence: null }
  if (discovery.boards.length !== 1) return { ...base, outcome: discovery.boards.length > 1 ? 'ambiguous-official-boards' : discovery.reason, completedAt: new Date().toISOString() }
  const binding = discovery.boards[0]
  const candidate = { ...provider, ...binding, adapter: 'publicAts', countryFilter: 'India',
    catalogOverride: true, zeroResultPolicy: 'evidence-required', backfillMode: 'live-parser',
    companyCareerPage: binding.bindingEvidence.officialURL,
    extractionStrategy: 'verified-official-binding+validated-public-ats-inventory+explicit-india-location+role-descriptions' }
  try {
    const jobs = options.scrape ? await options.scrape(candidate) : await createPublishingGapAtsScraper(candidate).run({
      fetchJson: options.fetchJson || defaultFetchJson,
    })
    const analysis = analyzePublishableJobs(jobs)
    const inventoryEvidence = readInventoryEvidence(jobs)
    if (!isFreshCompleteInventoryEvidence(inventoryEvidence)) throw new Error('incomplete-inventory-evidence')
    return { ...base, outcome: analysis.eligibleJobs.length ? 'ready-for-validation' : jobs.length ? 'jobs-rejected' : 'verified-zero-india',
      candidate, rawJobs: jobs.length, eligibleJobs: analysis.eligibleJobs.length, jobs, inventoryEvidence,
      filterCounts: analysis.filterCounts, completedAt: new Date().toISOString() }
  } catch (error) {
    return { ...base, outcome: 'extraction-failed', candidate,
      failureKind: error?.name === 'TimeoutError' ? 'network_or_timeout' : classifyScraperError(error).failureKind,
      completedAt: new Date().toISOString() }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  const args = process.argv.slice(2)
  const option = name => { const index = args.indexOf(name); return index < 0 ? null : args[index + 1] }
  const output = path.resolve(option('--output') || '../artifacts/catalog-remediation')
  const runtimePath = option('--runtime')
  const runtime = runtimePath ? JSON.parse(fs.readFileSync(path.resolve(runtimePath), 'utf8')) : null
  if (!runtime?.databaseAvailable || !Array.isArray(runtime.inventory)) throw new Error('A current runtime snapshot is required; unavailable inventory must not count as zero')
  const inventory = new Map(runtime.inventory.map(row => [row.source, row]))
  const sourceIds = option('--sources')?.split(',').filter(Boolean)
  const catalog = getScraperCatalog().filter(p => !sourceIds || sourceIds.includes(p.source))
    .sort((a, b) => Number(/greenhouse|ashby|lever/i.test(b.atsPlatform)) - Number(/greenhouse|ashby|lever/i.test(a.atsPlatform)) || a.source.localeCompare(b.source))
  const limit = option('--limit') ? Number(option('--limit')) : catalog.length
  const concurrency = Number(option('--concurrency') || 8)
  if (!Number.isInteger(limit) || limit < 1 || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 16) throw new Error('Positive limit and concurrency between 1 and 16 required')
  const selected = catalog.slice(0, limit)
  fs.mkdirSync(path.join(output, 'sources'), { recursive: true })
  const completed = new Map()
  for (const provider of selected) {
    const file = path.join(output, 'sources', `${provider.source}.json`)
    if (fs.existsSync(file) && !args.includes('--refresh')) {
      const row = JSON.parse(fs.readFileSync(file, 'utf8'))
      const age = Date.now() - new Date(row.completedAt).getTime()
      if (age >= 0 && age < 48 * 3600000 && !(args.includes('--include-published') && row.outcome === 'already-published-not-rechecked')) completed.set(provider.source, row)
    }
  }
  let index = 0
  const summary = () => {
    const counts = [...completed.values()].reduce((acc, row) => { acc[row.outcome] = (acc[row.outcome] || 0) + 1; return acc }, {})
    const value = { generatedAt: new Date().toISOString(), state: completed.size === selected.length ? 'review-required' : 'scanning',
      selectedSources: selected.length, completedSources: completed.size, remainingSources: selected.length - completed.size, outcomeCounts: counts,
      productionWrites: false, sourceChangesApplied: false }
    fs.writeFileSync(path.join(output, 'progress.json'), JSON.stringify(value, null, 2) + '\n')
    return value
  }
  summary()
  const timer = setInterval(() => console.log(JSON.stringify(summary())), 30000)
  try {
    await Promise.all(Array.from({ length: concurrency }, async () => {
      while (index < selected.length) {
        const provider = selected[index++]
        if (completed.has(provider.source)) continue
        const live = inventory.get(provider.source)
        const result = !args.includes('--include-published') && live?.visibleJobs > 0
          ? { source: provider.source, companyName: provider.companyName, outcome: 'already-published-not-rechecked',
            visibleJobs: live.visibleJobs, completedAt: new Date().toISOString() }
          : await auditCatalogProvider(provider)
        fs.writeFileSync(path.join(output, 'sources', `${provider.source}.json`), JSON.stringify(result, null, 2) + '\n')
        completed.set(provider.source, result)
      }
    }))
  } finally {
    clearInterval(timer)
    const rows = [...completed.values()].sort((a, b) => a.source.localeCompare(b.source))
    fs.writeFileSync(path.join(output, 'catalog-outcomes.json'), JSON.stringify(rows.map(({ jobs, ...row }) => row), null, 2) + '\n')
    fs.writeFileSync(path.join(output, 'candidate-providers.json'), JSON.stringify(rows.filter(row => row.outcome === 'ready-for-validation' || row.outcome === 'verified-zero-india').map(row => row.candidate), null, 2) + '\n')
    console.log(JSON.stringify(summary()))
  }
}
