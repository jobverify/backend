import { createPeopleStrongPairScraper } from '../../scraper-support/shared/peopleStrongNativePair20261027.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const createCurrentAnthemInventory = (defaults = {}) => ({ async run(provided = {}) {
  const options = { ...defaults, ...provided }
  const signal = AbortSignal.any([AbortSignal.timeout(180000), ...(options.signal ? [options.signal] : [])])
  const wait = promise => new Promise((resolve, reject) => {
    const finish = (fn, value) => { signal.removeEventListener('abort', abort); fn(value) }, abort = () => finish(reject, signal.reason)
    signal.addEventListener('abort', abort, { once: true })
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error))
    if (signal.aborted) abort()
  })
  signal.throwIfAborted()
  let report
  const jobs = await wait(createPeopleStrongPairScraper('anthem').run({ ...options, signal, onReport: value => { report = value } }))
  if (!report) throw Error('Anthem current native collection report missing')
  const evidence = readInventoryEvidence(jobs)
  const reason = `Current declared Anthem board; corporate-advertised:${report.delegation.advertisedCount ?? 'unknown'};native-reported:${report.reportedNativeTotal}; opening-closing-match:${report.closingMatches}; complete-full-native-details:${report.renderedFullDetails}; unresolved-countries:${report.unknownCountryCount}; corporate-count-conflict:${report.advertisedCountMismatch}; declared-board-only scope`
  attachInventoryEvidence(jobs, { ...evidence, reason })
  if (options.onRecords) await wait(options.onRecords(structuredClone(report.roles)))
  if (options.onReport) await wait(options.onReport({ ...report, inventoryEvidence: readInventoryEvidence(jobs) }))
  signal.throwIfAborted()
  return jobs
} })
