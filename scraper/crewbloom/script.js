import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createEmployerBoundWorkableScraper } from '../../scraper-support/utils/workableEmployerInventory.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "crewbloom"
export const COMPANY = "CrewBloom"
export const CAREERS_URL = "https://crewbloom.com/"
export const DISPOSITION = "source-local-employer-bound-workable-native"
export const VERIFIED_ON = "2026-07-29"
export const VERIFIED_SURFACE_SUMMARY = "Uses a mandatory source-local Workable profile with current corporate full-board handoff, reciprocal account, unfiltered cursor/detail and independent closing checks. Unavailable corporate pages and incomplete native evidence do not prove an empty company."

const REQUIRED_PROFILE = Object.freeze({
  source: SOURCE,
  company: COMPANY,
  tenant: 'crewbloom',
  accountUid: '53568b5e-6585-43a9-930b-705aec25df28',
  careersUrl: CAREERS_URL,
  companyDomain: 'crewbloom.com',
  reciprocalWebsiteUrl: 'https://crewbloom.com/',
  reconcileClosingInventory: true,
})
const ACCOUNT_URL = 'https://apply.workable.com/api/v1/accounts/crewbloom'
const LISTING_URL = 'https://apply.workable.com/api/v3/accounts/crewbloom/jobs'
const DETAIL_PREFIX = 'https://apply.workable.com/api/v2/accounts/crewbloom/jobs/'
const invalid = (code, message) => Object.assign(new Error(`[${SOURCE}] ${message}`), {
  code, abortRetries: true, partial: true, sourceScopeComplete: false,
  sourceListingComplete: false, lifecycleCleanupAllowed: false,
})

const nativeProfile = signal => {
  signal?.throwIfAborted()
  let profile
  try {
    profile = JSON.parse(readFileSync(path.join(currentDir, 'config.json'), 'utf8'))
  } catch {
    throw invalid('CREWBLOOM_SOURCE_CONFIG_INVALID', 'mandatory native source profile unavailable')
  }
  if (!profile || typeof profile !== 'object' || Array.isArray(profile)
    || Object.keys(profile).length !== Object.keys(REQUIRED_PROFILE).length
    || Object.entries(REQUIRED_PROFILE).some(([key, value]) => !Object.hasOwn(profile, key) || profile[key] !== value)) {
    throw invalid('CREWBLOOM_SOURCE_CONFIG_INVALID', 'mandatory native source profile changed')
  }
  signal?.throwIfAborted()
  return Object.freeze(profile)
}

const nativeRequest = (url, options = {}) => {
  const method = options.method === undefined ? 'GET' : options.method
  if (url === ACCOUNT_URL && method === 'GET' && options.body === undefined) {
    return { url: ACCOUNT_URL + '?full=true', options }
  }
  if (url === LISTING_URL && method === 'POST' && typeof options.body === 'string') {
    let body
    try { body = JSON.parse(options.body) } catch {}
    const fields = ['query', 'location', 'department', 'worktype', 'remote']
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || fields.some(key => !Object.hasOwn(body, key))
      || Object.keys(body).some(key => !fields.includes(key) && key !== 'token')
      || body.query !== ''
      || fields.slice(1).some(key => !Array.isArray(body[key]) || body[key].length !== 0)
      || (Object.hasOwn(body, 'token') && (typeof body.token !== 'string' || !body.token.trim()))) {
      throw invalid('CREWBLOOM_NATIVE_REQUEST_INVALID', 'unrecognized native listing request')
    }
    // The captured public client declares workplace[], not the legacy remote[].
    // Its nextPage value is inserted unchanged as token for the following page.
    const nativeBody = { query: '', department: [], location: [], workplace: [], worktype: [],
      ...(Object.hasOwn(body, 'token') ? { token: body.token } : {}) }
    return { url, options: { ...options, body: JSON.stringify(nativeBody) } }
  }
  if (typeof url === 'string' && url.startsWith(DETAIL_PREFIX)
    && /^[A-Z0-9]{6,32}$/.test(url.slice(DETAIL_PREFIX.length))
    && method === 'GET' && options.body === undefined) return { url, options }
  throw invalid('CREWBLOOM_NATIVE_REQUEST_INVALID', 'unrecognized native account, listing or detail request')
}

const fetchNativeJson = async (url, options = {}) => {
  const signal = options.signal
  signal?.throwIfAborted()
  const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(30000)])
  const checkRequest = () => {
    signal?.throwIfAborted()
    requestSignal.throwIfAborted()
  }
  let response
  try {
    checkRequest()
    response = await fetch(url, { ...options, redirect: 'follow', signal: requestSignal,
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)', ...options.headers } })
    checkRequest()
    if (response.status !== 200 || response.url !== url) {
      throw Object.assign(new Error(`[${SOURCE}] Workable native HTTP status or redirect identity changed: ${url}`), { status: response.status })
    }
    const payload = await response.json()
    checkRequest()
    return payload
  } finally {
    try {
      if (response?.body && !response.bodyUsed) await response.body.cancel()
    } catch {}
    checkRequest()
  }
}

export const run = async (options = {}) => {
  const signal = options.signal
  const profile = nativeProfile(signal)
  const loadJson = options.fetchJson || fetchNativeJson
  const nativeDetails = new Map()
  try {
    const jobs = await createEmployerBoundWorkableScraper(profile).run({ ...options,
      fetchJson: async (url, init) => {
        signal?.throwIfAborted()
        const request = nativeRequest(url, init)
        const payload = await loadJson(request.url, request.options)
        signal?.throwIfAborted()
        if (request.url.startsWith(DETAIL_PREFIX)) {
          nativeDetails.set(request.url.slice(DETAIL_PREFIX.length), structuredClone(payload))
        }
        return payload
      },
    })
    signal?.throwIfAborted()
    for (const job of jobs) job.sourceNativeRecord = structuredClone(nativeDetails.get(job.jobId))
    return jobs
  } finally {
    signal?.throwIfAborted()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
