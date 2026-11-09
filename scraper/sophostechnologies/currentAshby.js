import { fetchJsonWithRetry, fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { createPublishingGapAtsScraper } from '../../scraper-support/utils/publishingGapAts.js'
import { mapJobsWithInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

export const CURRENT_SOPHOS_BOARD = 'https://jobs.ashbyhq.com/sophos'
export const CURRENT_SOPHOS_API = 'https://api.ashbyhq.com/posting-api/job-board/sophos'
const CAREERS = 'https://www.sophos.com/en-us/company/careers'

export async function runCurrentSophosInventory(options = {}) {
  const signal = AbortSignal.any([...(options.signal ? [options.signal] : []), AbortSignal.timeout(90000)])
  signal.throwIfAborted()
  const transport = { signal, fetchImpl: options.fetchImpl || globalThis.fetch, redirect: 'manual', credentials: 'omit',
    label: 'sophostechnologies', timeoutMs: 20000, attempts: 3 }
  const page = await fetchTextWithRetry(CAREERS, { ...transport, includeResponseMetadata: true })
  const document = readNativeDocument(page.html)
  const bound = page.status === 200 && page.url === CAREERS
    && document.nodes(node => node.tag === 'title' && /Sophos.*Careers|Sophos.*Jobs/i.test(node.raw || '')).length === 1
    && document.nodes(node => node.tag === 'a' && node.attrs.href === CURRENT_SOPHOS_BOARD).length > 0
  if (!bound) throw Object.assign(new Error('Sophos current careers Ashby handoff is unavailable'), {
    abortRetries: true, failureKind: 'source_identity_unverified', softFailure: true,
  })
  const payload = await fetchJsonWithRetry(CURRENT_SOPHOS_API, transport)
  let jobs
  try {
    jobs = await createPublishingGapAtsScraper({ source: 'sophostechnologies', companyName: 'Sophos Technologies',
      companyCareerPage: CAREERS, atsPlatform: 'ashby', boardToken: 'sophos', sourceScopeComplete: false,
    }).run({ signal, fetchJson: async () => payload })
  } catch (error) {
    signal.throwIfAborted()
    // Transport failures happen above this boundary. Repeating a validated
    // payload's deterministic schema/account failure cannot recover inventory.
    throw Object.assign(error, { abortRetries: true, softFailure: true,
      upstreamOutage: false, failureKind: 'surface_drift_or_fail_closed' })
  }
  const nativeById = new Map(payload.jobs.map(row => [row.id, row]))
  return mapJobsWithInventoryEvidence(jobs, job => ({ ...job, atsPlatform: 'ashby',
    nativeSourceRecord: structuredClone(nativeById.get(job.jobId)),
    sourceScopeComplete: false, sourceListingComplete: false, lifecycleCleanupAllowed: false,
  }))
}
