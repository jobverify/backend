import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runRecruitmentBatchSource } from '../../scraper-support/utils/recruitmentBatch20261103.js'

export const SOURCE = "carlsberg"
export const COMPANY = "Carlsberg"
export const CAREERS_URL = "https://www.carlsberggroup.com/careers/"
export const DISPOSITION = 'runtime-verified-recruitment'
// Public pages declare account handoffs through /career query modes as well as
// explicit account paths. Refuse each handoff without stopping other public jobs.
export const withPublicRecruitmentBoundary = transport => function (...args) {
  const requested = new URL(args[0])
  let pathname = requested.pathname
  try { pathname = decodeURIComponent(pathname) } catch {}
  const accountQuery = [...requested.searchParams].some(([key, value]) =>
    key.toLowerCase() === 'login_ns'
    || key.toLowerCase() === 'loginflowrequired' && value.toLowerCase() === 'true')
  if (accountQuery || /(?:^|\/)(?:login|sign[-_]?in|register|registration|forgot[_-]?(?:pwd|password)|reset[_-]?password)(?:\/|$)/i.test(pathname)) {
    throw Object.assign(new Error('Carlsberg account navigation is outside public vacancy extraction'), {
      softFailure: true, failureKind: 'coverage_gap', abortRetries: true,
      sourceScopeComplete: false, lifecycleCleanupAllowed: false,
      unreadNativeAccountRequest: { requestedURL: requested.origin + requested.pathname, observed: false, status: null },
    })
  }
  return Reflect.apply(transport, this, args)
}
export const run = (options = {}) => {
  const guarded = { ...options, fetchImpl: withPublicRecruitmentBoundary(options.fetchImpl || globalThis.fetch) }
  for (const name of ['fetchPage', 'fetchJson', 'fetchText']) if (options[name]) {
    guarded[name] = withPublicRecruitmentBoundary(function (...args) { return Reflect.apply(options[name], options, args) })
  }
  return runRecruitmentBatchSource(SOURCE, guarded)
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(path.dirname(fileURLToPath(import.meta.url)), 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
