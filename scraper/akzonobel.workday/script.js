import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createFirstPartyHTMLScraper, createHTMLTransport } from '../../scraper-support/shared/firstPartyHtmlJobs.js'
import { nativePostingJobs } from '../../scraper-support/shared/nativeJobPosting.js'
import { createSourceConfig, HOME } from './parser.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = "akzonobel"
export const COMPANY = "AkzoNobel"
export const CAREERS_URL = HOME
export const DISPOSITION = "official-phenom-native-India-widget"
export const VERIFIED_ON = "2026-10-23"
export const VERIFIED_SURFACE_SUMMARY = "Official AkzoNobel Phenom portal; native India search, full ATS descriptions, explicit country/sequence identifiers and ATS posting dates. On-hold requisitions excluded. Whole-employer inventory and production visibility unverified."

export const run = (options = {}) => {
  const config = createSourceConfig(options), fetchImpl = options.fetchImpl || globalThis.fetch
  const raw = options.transport || createHTMLTransport(config, { ...options,
    fetchImpl: (url, request) => fetchImpl(url, { ...request, ...config.readRequest(url) }),
  })
  const transport = async (url, request) => {
    const nativeRequest = config.readRequest(url), packet = await raw(url, { ...request, ...nativeRequest })
    if (!packet || typeof packet !== 'object') return packet
    return { ...packet, provenance: { ...packet.provenance, nativeReadRequest: {
      method: nativeRequest.method, body: nativeRequest.body ?? null,
      purpose: nativeRequest.method === 'POST' ? 'anonymous read-only public vacancy search' : 'anonymous public read',
    } } }
  }
  config.projectJobs = result => nativePostingJobs(result, config).map(job => ({ ...job,
    ...job.nativeFacts.normalizedAttributes,
    requisitionId: job.nativeFacts.sourceRequisitionID,
    nativePhenomSequenceID: job.nativeFacts.nativePhenomSequenceID,
    applyUrl: job.sourceUrl, link: job.sourceUrl, applicationLinkSource: 'public-role-page-fallback',
    jobDescription: job.nativeFacts.nativeDescriptionHTML, sourceDescription: job.nativeFacts.nativeDescriptionHTML,
    nativeDescriptionOrigin: job.nativeFacts.nativeDescriptionOrigin,
    nativeATSPostedDate: job.nativeFacts.nativeATSPostedDate,
    nativeSchemaDatePosted: job.nativeFacts.nativeSchemaDatePosted,
    state: job.nativeCountryAddresses.length === 1 ? job.nativeCountryAddresses[0].raw.addressRegion || null : null,
  }))
  return createFirstPartyHTMLScraper(config).run({ ...options, transport })
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
