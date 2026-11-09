import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'
import { publicPostingDescription } from '../../rewriting/publicPostingDescription.js'
import { attachInventoryEvidence, readInventoryEvidence } from './inventoryEvidence.js'

// Listing-only providers must fetch employer content before attempt diagnostics
// are recorded. Failed details remain explicit partial results, without replacing
// listing identity or giving an incomplete listing cleanup authority.
export async function hydrateSourceDescriptions(jobs, {
  fetchDetail, signal, concurrency = 4, detailEnrichmentBudgetMs,
} = {}) {
  signal?.throwIfAborted()
  const workers = Math.min(8, Math.max(1, Math.floor(Number(concurrency)) || 1))
  const requested = Number(detailEnrichmentBudgetMs)
  const budget = detailEnrichmentBudgetMs != null && Number.isFinite(requested) && requested >= 0
    ? requested : Math.min(120000, 30000 + Math.ceil(jobs.length / workers) * 1000)
  const output = jobs.map(job => hasSourceDescription(job) ? { ...job } : {
    ...job, sourceDetailComplete: false, sourceDetailFailureKind: 'budget-exhausted',
  })
  const inventory = readInventoryEvidence(jobs)
  if (inventory) attachInventoryEvidence(output, inventory)
  const pending = output.map((job, index) => hasSourceDescription(job) ? -1 : index).filter(index => index >= 0)
  if (!pending.length || budget === 0) return output

  const controller = new AbortController()
  const detailSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal
  const timer = setTimeout(() => controller.abort(new Error('Source description budget exhausted')), budget)
  let cursor = 0
  try {
    await Promise.all(Array.from({ length: Math.min(workers, pending.length) }, async () => {
      while (!detailSignal.aborted && cursor < pending.length) {
        const index = pending[cursor++]
        try {
          const detail = await fetchDetail(output[index], { signal: detailSignal })
          detailSignal.throwIfAborted()
          const description = detail?.sourceDescription ?? detail?.jobDescription ?? detail?.description
          if (typeof description !== 'string' || !hasSourceDescription({ sourceDescription: description })) {
            output[index].sourceDetailFailureKind = 'missing-authoritative-jobposting'
            continue
          }
          // The callback validates native role identity; only its source content
          // is promoted here. It cannot change the listed employer, job or URL.
          output[index] = {
            ...output[index], sourceDescription: description,
            jobDescription: description,
            sourceDetailComplete: true, sourceDetailVerifiedAt: new Date().toISOString(),
          }
          delete output[index].sourceDetailFailureKind
        } catch {
          signal?.throwIfAborted()
          if (detailSignal.aborted) return
          output[index].sourceDetailFailureKind = 'upstream'
        }
      }
    }))
  } finally {
    clearTimeout(timer)
  }
  signal?.throwIfAborted()
  return output
}

export function sourceDescriptionFromPosting(job, response, options) {
  const html = typeof response === 'string' ? response : response?.html
  // Source-local injected transports can provide text fixtures. Production
  // transports supply the actual status and final URL to reject redirects.
  const url = typeof response === 'string' ? job.sourceUrl
    : response?.status >= 200 && response.status < 300 ? response.url : null
  const posting = publicPostingDescription(job, html, url, options)
  return posting ? { sourceDescription: posting.description } : null
}
