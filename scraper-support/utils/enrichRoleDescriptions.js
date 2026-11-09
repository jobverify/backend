import { publicPostingDescription } from '../../rewriting/publicPostingDescription.js'
import { visiblePostingProfile } from '../../rewriting/visiblePostingDescription.js'
import { mapWithConcurrency } from './mapWithConcurrency.js'

/** Capture only an exactly identified role's content; keep listing identities on detail failure. */
export const enrichRoleDescriptions = (jobs, { fetchText, signal, concurrency = 4 } = {}) =>
  mapWithConcurrency(jobs, concurrency, async job => {
    signal?.throwIfAborted()
    let description = null
    const url = job.sourceUrl || job.applyUrl || job.link
    try {
      const parsed = new URL(url)
      if (visiblePostingProfile(job, url) && !parsed.username && !parsed.password) {
        const response = await fetchText(url, { signal, includeResponseMetadata: true })
        signal?.throwIfAborted()
        if (response && typeof response === 'object' && response.status >= 200 && response.status < 300) {
          description = publicPostingDescription(job, response.html, response.url)?.description || null
        }
      }
    } catch {
      signal?.throwIfAborted()
    }
    return { ...job, sourceDescription: description, jobDescription: description }
  })
