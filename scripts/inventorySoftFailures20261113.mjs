import fs from 'node:fs/promises'
import path from 'node:path'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const analysis = path.resolve('../scraper-log-analysis-20261113')
const output = path.join(analysis, 'soft-repair-evidence')
const statePath = path.join(analysis, 'scraper/data/run-state.json')
const state = JSON.parse(await fs.readFile(statePath, 'utf8'))
const catalog = new Map(getScraperCatalog().map(provider => [provider.source, provider]))
const family = result => {
  const error = result.error || ''
  if (error.includes('empty-only-recruitment-recovery')) return 'empty-only-discovery'
  if (error.includes('runtime-first-party-recruitment;source-scope-unverified')) return 'generic-runtime-scope'
  if (error.includes('(unverified-zero)')) return 'missing-current-zero-proof'
  if (result.failureKind === 'coverage_gap') return 'other-inventory-coverage'
  if (result.failureKind === 'surface_drift_or_fail_closed') return 'current-surface-contract'
  if (['blocked_or_access_denied', 'public_access_denied'].includes(result.failureKind)) return 'public-access'
  if (result.failureKind === 'network_or_timeout') return 'network-or-tls'
  return result.failureKind || 'unknown'
}
const profileFields = [
  'source', 'companyName', 'companyDomain', 'companyCareerPage', 'officialHomepageUrl',
  'adapter', 'modulePath', 'atsPlatform', 'countryFilter', 'zeroResultPolicy',
  'sourceScopeComplete', 'lifecycleCleanupAllowed', 'extractionStrategy', 'paginationStrategy',
]
const sources = Object.entries(state.completed).filter(([, entry]) =>
  entry.result?.success === false && entry.result?.softFailure === true).map(([source, entry]) => {
  const provider = catalog.get(source)
  return { source, resolution: 'pending', original: entry.result, diagnosticFamily: family(entry.result),
    provider: provider ? Object.fromEntries(profileFields.filter(key => provider[key] !== undefined)
      .map(key => [key, provider[key]])) : null, attempts: [] }
})
if (sources.length !== 2938 || new Set(sources.map(row => row.source)).size !== 2938) {
  throw Error('Original soft-failure source set differs from reviewed run; inspect before continuing')
}
const count = key => Object.fromEntries([...sources.reduce((map, row) => {
  const value = key(row)
  map.set(value, (map.get(value) || 0) + 1)
  return map
}, new Map())].sort((a, b) => b[1] - a[1]))
const summary = { observedAt: new Date().toISOString(), originalRunId: state.runId,
  originalEvidence: statePath, sources: sources.length,
  byFailureKind: count(row => row.original.failureKind || 'unknown'),
  byDiagnosticFamily: count(row => row.diagnosticFamily),
  byAdapter: count(row => row.provider?.adapter || 'missing-catalog'),
  missingCatalogSources: sources.filter(row => !row.provider).map(row => row.source) }
await fs.mkdir(output, { recursive: true })
// Never overwrite a repair ledger with a fresh pending inventory.
await fs.writeFile(path.join(output, 'inventory.json'), JSON.stringify({ ...summary, sources }, null, 2) + '\n', { flag: 'wx' })
await fs.writeFile(path.join(output, 'summary.json'), JSON.stringify(summary, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
