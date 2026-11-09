import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { run as runOkta } from '../okta/script.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { attachInventoryDelegationEvidence } from '../../scraper-support/utils/inventoryDelegationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "auth0"
export const COMPANY = "Auth0"
export const CAREERS_URL = 'https://auth0.com/careers'
export const CANONICAL_SOURCE = 'okta'
export const OKTA_CAREERS_URL = 'https://www.okta.com/company/careers/'
export const OKTA_BOARD_URL = OKTA_CAREERS_URL + 'job-listing/'
export const DISPOSITION = 'current-official-redirect-to-canonical-okta-source'
export const VERIFIED_ON = null
export const VERIFIED_SURFACE_SUMMARY = 'Recheck the current official Auth0 careers redirect and active Okta careers-to-board binding before executing the canonical native Okta extractor. Child source/company and partial inventory evidence are retained. Separate Auth0 employer inventory is unverified.'

const unavailable = (message, cause) => Object.assign(Error('Auth0 current recruiting delegation: ' + message, { cause }), {
  softFailure: true, failureKind: 'source_identity_unverified', abortRetries: true,
})
const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, { redirect: 'manual',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
    headers: { Accept: 'text/html', 'User-Agent': 'Mozilla/5.0' } })
  const body = await response.text()
  return { status: response.status, url: response.url, headers: Object.fromEntries(response.headers), body,
    capturedAt: new Date().toISOString() }
}

export const run = async ({ fetchPage = defaultFetchPage, oktaRun = runOkta, signal, ...options } = {}) => {
  signal?.throwIfAborted()
  if (options.maxJobs != null) throw new TypeError('Auth0 delegation requires the complete supported native inventory')
  const nativeResponses = []
  const read = async url => {
    signal?.throwIfAborted()
    const page = await fetchPage(url, { signal })
    signal?.throwIfAborted()
    if ((page?.finalUrl ?? page?.url) !== url) throw unavailable('unexpected public response URL')
    nativeResponses.push({ ...page, requestedUrl: url })
    return page
  }
  try {
    const redirect = await read(CAREERS_URL)
    const destination = redirect.headers?.get?.('location') ?? redirect.headers?.location
    if (redirect.status !== 308 || destination !== OKTA_CAREERS_URL) throw unavailable('official careers redirect changed or is unavailable')
    const landing = await read(OKTA_CAREERS_URL)
    if (landing.status !== 200 || typeof landing.body !== 'string') throw unavailable('canonical careers page unavailable')
    const doc = readNativeDocument(landing.body)
    const canonicals = doc.nodes(node => node.tag === 'link' && node.attrs.rel === 'canonical')
    if (canonicals.length !== 1 || canonicals[0].attrs.href !== OKTA_CAREERS_URL
      || !doc.nodes(node => node.tag === 'title').some(node => /\bCareers\b[\s\S]*\bOkta\b/i.test(node.raw))
      || !doc.nodes(node => node.tag === 'a' && node.attrs.href === OKTA_BOARD_URL).some(node => doc.text(node))) {
      throw unavailable('active canonical company careers and job-board binding missing')
    }
  } catch (error) {
    signal?.throwIfAborted()
    if (error.failureKind === 'source_identity_unverified') throw error
    throw unavailable('native relationship read failed', error)
  }
  const jobs = await oktaRun({ ...options, signal })
  signal?.throwIfAborted()
  // Injected historic packets keep their actual observation clock. Untimed
  // legacy fixture transports cannot create a fresh runtime relationship proof.
  if (nativeResponses.every(page => typeof page.capturedAt === 'string' && Number.isFinite(Date.parse(page.capturedAt))
    && Date.parse(page.capturedAt) <= Date.now() && typeof page.body === 'string')) {
    attachInventoryDelegationEvidence(jobs, { source: SOURCE, sources: [CANONICAL_SOURCE],
      verifiedAt: new Date(Math.min(...nativeResponses.map(page => Date.parse(page.capturedAt)))).toISOString(),
      preservesChildSourceAndCompany: true, evidence: { method: 'official-careers-redirect', url: CAREERS_URL,
        responses: nativeResponses.map(page => ({ url: page.requestedUrl, finalUrl: page.finalUrl ?? page.url,
          status: page.status, sha256: createHash('sha256').update(page.body).digest('hex') })) } })
  }
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, CANONICAL_SOURCE)
  }
}
