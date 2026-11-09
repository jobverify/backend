import { createPeopleStrongPairScraper } from '../../scraper-support/shared/peopleStrongNativePair20261027.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const createCurrentAmaraInventory = (defaults = {}) => ({ async run(provided = {}) {
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
  const jobs = await wait(createPeopleStrongPairScraper('amararajaenergymobility').run({ ...options, signal, onReport: value => { report = value } }))
  if (!report) throw Error('Amara current native collection report missing')
  const observations = report.roles.map(role => ({ ...role, company: role.nativeRoleCompany,
    sourceCatalogCompany: 'Amara Raja Energy & Mobility Ltd', productionWrites: false }))
  const evidence = readInventoryEvidence(jobs)
  const reason = `Current declared Amara group board; group-native-reported:${report.nativeGroupReportedTotal};target-employer-observed:${report.targetEmployerCount}; excluded-sibling-employers:${report.excludedEmployerCount}; full-native-details:${report.renderedFullDetails}; opening-closing-match:${report.closingMatches}; exact-employer-delegation:${report.delegation.exactEmployerDelegation}; target recruiting coverage remains unknown unless explicitly qualified; no whole-group relabelling or company-wide claim`
  attachInventoryEvidence(jobs, { ...evidence, reason })
  if (options.onRecords) await wait(options.onRecords(structuredClone(observations)))
  if (options.onReport) await wait(options.onReport({ ...report, roles: observations, inventoryEvidence: readInventoryEvidence(jobs) }))
  signal.throwIfAborted()
  return jobs
} })
