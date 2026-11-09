import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFirstPartyHTMLScraper, createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativePostingJobs } from '../../scraper-support/shared/nativeJobPosting.js'
import { createSourceConfig, HOME } from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "avanade"
export const COMPANY = "Avanade"
export const CAREERS_URL = HOME
export const DISPOSITION = "official-Coveo-India-native"
export const VERIFIED_ON = "2026-10-23"
export const VERIFIED_SURFACE_SUMMARY = "Official Avanade careers client binds public native India search and role data. Complete pagination,original posting epochs,full descriptions/qualifications and application hrefs retained. Whole-employer/legal scope and production remain unverified;cleanup forbidden."

export const run = (options = {}) => {
  const config = createSourceConfig(options), stop = new AbortController()
  const signal = options.signal ? AbortSignal.any([options.signal, stop.signal]) : stop.signal
  const fetchImpl = options.fetchImpl || globalThis.fetch
  const raw = options.transport || createHTMLTransport(config, { ...options, signal,
    fetchImpl: (url, request) => fetchImpl(url, { ...request, ...config.readRequest(url) }),
  })
  const transport = async (url, request) => {
    const nativeRequest = config.readRequest(url)
    const packet = await raw(url, { ...request, ...nativeRequest })
    if ([401,403,429].includes(packet?.status)) stop.abort(Object.assign(Error('Avanade public upstream access/rate limit;no further requests'), { code:'NATIVE_PUBLIC_READ_STOPPED' }))
    if (!packet || typeof packet !== 'object') return packet
    return { ...packet, provenance: { ...packet.provenance, nativeReadRequest: {
      method: nativeRequest.method, body: nativeRequest.body ?? null,
      publicClientSearchKeyUsed: nativeRequest.method === 'POST', publicClientSearchKeyValueLogged: false,
      purpose: nativeRequest.method === 'POST' ? 'anonymous read-only public vacancy search' : 'anonymous public read;script assets treated only as text',
    } } }
  }
  config.projectJobs = result => nativePostingJobs(result, config).map(job => ({ ...job,
    requisitionId: job.jobId, jobDescription: job.nativeFacts.nativeDescriptionHTML, sourceDescription: job.nativeFacts.nativeDescriptionHTML,
    nativeDescriptionOrigin: job.nativeFacts.nativeDescriptionOrigin,
    nativeOriginalPostingEpoch: job.nativeFacts.nativeOriginalPostingEpoch,
    nativeCreatedOn: job.nativeFacts.nativeCreatedOn, nativeUpdatedOn: job.nativeFacts.nativeUpdatedOn, nativeIndexedDate: job.nativeFacts.nativeIndexedDate,
    city: job.nativeFacts.nativeAPIRecord.raw.jobcityname, state: job.nativeFacts.nativeAPIRecord.raw.state,
    location: job.nativeFacts.nativeAPIRecord.raw.jobcityname+', '+job.nativeFacts.nativeAPIRecord.raw.state+', India',
    minimumQualification: job.nativeFacts.nativeAPIRecord.raw.qualification,
    requiredSkills: [job.nativeFacts.nativeAPIRecord.raw.skill1, job.nativeFacts.nativeAPIRecord.raw.skill2, job.nativeFacts.nativeAPIRecord.raw.skill3].filter(Boolean),
    department: job.nativeFacts.nativeAPIRecord.raw.jobareaofexpertise || null,
  }))
  return createFirstPartyHTMLScraper(config).run({ ...options, signal, transport })
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
