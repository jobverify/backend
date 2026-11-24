import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { recruitmentBatchProviders } from '../../scraper-support/utils/recruitmentBatch20261103.js'
import { createVerifiedRecruitmentScraper } from '../../scraper-support/utils/verifiedRecruitment.js'
import { requireNativeHttpResponse } from '../../scraper-support/shared/nativeHttpResponse.js'
import { disposeResponseBody } from '../../scraper-support/shared/responseBodyDisposal.js'
import { isHttpAccessChallenge } from '../../scraper-support/utils/fetch.js'

export const SOURCE = "carlsberggroup"
export const COMPANY = "Carlsberg Group"
export const CAREERS_URL = "https://www.carlsberggroup.com/careers/"
export const DISPOSITION = 'runtime-verified-recruitment'
// Current own corporate /careers/ redirects to careers.carlsberg.com, whose
// literal publisher title is Carlsberg. The native portal also names Carlsberg
// Group in its authored metadata. Keep the configured group and native labels.
export const currentConfiguration = () => {
  const registered = recruitmentBatchProviders().find(provider => provider.source === SOURCE)
  if (!registered || registered.companyName !== COMPANY || registered.companyCareerPage !== CAREERS_URL
      || registered.companyDomain !== 'carlsberggroup.com') throw new Error('Carlsberg Group registered corporate identity changed')
  return { ...registered, publisherNames: [...new Set([...(registered.publisherNames || []), 'Carlsberg'])] }
}
export const run = async (options = {}) => {
  options.signal?.throwIfAborted()
  if (options.fetchText || options.fetchPage || options.fetchJson) throw new Error('Carlsberg Group requires original HTTP metadata through fetchImpl')
  const started = performance.now(), limit = options.sourceTimeoutMs ?? 90000, receipts = [], unreadStoppedRequests = [], ownedAdmissions = new Set()
  let terminalFailure
  const timeout = () => { if (performance.now() - started >= limit) throw new DOMException('Carlsberg Group source deadline exceeded', 'TimeoutError') }
  const attach = target => { if (target && typeof target === 'object') try { Object.defineProperty(target, 'nativeAuthorityResponseReceipts', { value: receipts, configurable: true }); Object.defineProperty(target, 'nativeAuthorityUnobservedRequests', { value: unreadStoppedRequests, configurable: true }) } catch {} }
  const admitResponse = async (url, init) => {
    options.signal?.throwIfAborted()
    const requested = new URL(url)
    if (requested.searchParams.has('login_ns') || requested.searchParams.get('loginFlowRequired') === 'true'
        || /(?:^|\/)(?:login|signin|register|registration|forgot[_-]?(?:pwd|password)|reset[_-]?password)(?:\/|$)/i.test(requested.pathname)) {
      unreadStoppedRequests.push({ requestedURL: requested.origin + requested.pathname, observed: false, status: null, reason: 'native account/login/register/password navigation is outside vacancy extraction' })
      terminalFailure ??= Object.assign(new Error('Carlsberg Group native account navigation remains unread; vacancy scope is unverified'), { softFailure: true, failureKind: 'coverage_gap', abortRetries: true, lifecycleCleanupAllowed: false, sourceScopeComplete: false }); throw terminalFailure
    }
    if (terminalFailure) { unreadStoppedRequests.push({ requestedURL: url, observed: false, status: null, reason: 'source stopped after original publisher denial/TLS failure or unread account-navigation boundary' }); throw terminalFailure }
    let response
    try { response = await (options.fetchImpl || globalThis.fetch)(url, init) }
    catch (error) { if (/CERT|TLS|SSL|SELF_SIGNED|UNABLE_TO_VERIFY|DEPTH_ZERO/.test(error?.cause?.code ?? error?.code ?? '')) terminalFailure = error; throw error }
    try {
      options.signal?.throwIfAborted()
      receipts.push({ requestedURL: url, method: init?.method ?? 'GET', finalURL: response.url,
        status: response.status, headers: Object.fromEntries(response.headers), bodyReadByAdmission: false })
      // The generic crawler follows authored corporate redirects. Its original
      // body reader predates metadata-first denial handling; admit errors here.
      if (response.status !== 200 || isHttpAccessChallenge(response)) {
        try { await requireNativeHttpResponse({ status: response.status, url: response.url, headers: response.headers, body: null }, url,
          { context: 'Carlsberg Group current recruitment', signal: init?.signal, callerSignal: options.signal ?? null }) }
        catch (error) { if ([401, 402, 403, 406, 407, 429, 451].includes(response.status) || isHttpAccessChallenge(response)) terminalFailure = error; throw error }
      }
      options.signal?.throwIfAborted(); init?.signal?.throwIfAborted()
      return response
    } catch (error) {
      // Always settle our bounded ownership before the response is discarded,
      // even when cancellation occurred synchronously as fetch resolved.
      try { await disposeResponseBody(response, { bestEffort: true, reason: error }) } catch {}
      options.signal?.throwIfAborted(); throw error
    }
  }
  const fetchImpl = (url, init) => {
    const pending = admitResponse(url, init); ownedAdmissions.add(pending)
    pending.then(() => ownedAdmissions.delete(pending), () => ownedAdmissions.delete(pending))
    return pending
  }
  try {
    const configuration = currentConfiguration(); timeout()
    const jobs = await createVerifiedRecruitmentScraper(configuration).run({ ...options, fetchImpl })
    if (terminalFailure) {
      // The delegated reader may return held observations before discovering an
      // account handoff. Retain that own data audit on the explicit boundary.
      const descriptor = Object.getOwnPropertyDescriptor(jobs, 'nativeCollectionEvidence')
      if (descriptor && Object.hasOwn(descriptor, 'value')) try { Object.defineProperty(terminalFailure, 'recruitmentObservations', { value: descriptor.value, configurable: true }) } catch {}
      throw terminalFailure
    }
    attach(jobs); options.signal?.throwIfAborted(); timeout(); return jobs
  } catch (error) {
    options.signal?.throwIfAborted()
    const failure = terminalFailure ?? error
    if (failure !== error && error && typeof error === 'object') {
      const descriptor = Object.getOwnPropertyDescriptor(error, 'recruitmentObservations')
      if (descriptor && Object.hasOwn(descriptor, 'value')) try { Object.defineProperty(failure, 'recruitmentObservations', descriptor) } catch {}
    }
    attach(failure); throw failure
  }
  finally {
    // A caller can win the delegated crawler's race before our already-owned
    // response has finished its bounded disposal. Settle that ownership first.
    if (ownedAdmissions.size) {
      let timer
      try { await Promise.race([Promise.allSettled([...ownedAdmissions]), new Promise(resolve => { timer = setTimeout(resolve, 1100) })]) }
      finally { clearTimeout(timer) }
    }
    options.signal?.throwIfAborted()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
