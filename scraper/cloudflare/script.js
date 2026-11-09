import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'
import { hasNativeIndiaLocation, selectGreenhouseLocation } from '../../scraper-support/utils/greenhouseLocations.js'
import { attachGreenhouseSourceEvidence, normalizeGreenhouseSourceRoleUrl } from '../../scraper-support/utils/greenhouseSourceEvidence.js'

export const SOURCE = 'cloudflare'
export const COMPANY = 'Cloudflare'
export const CAREERS_URL = 'https://www.cloudflare.com/careers/'
export const GREENHOUSE_API_URL = 'https://boards-api.greenhouse.io/v1/boards/cloudflare/jobs?content=true'
const defaultFetchJson = (url, options) => fetchJsonWithRetry(url, { ...options, timeoutMs: 20000, label: SOURCE })

export const createCloudflareScraper = () => ({
  async run({ fetchJson = defaultFetchJson, signal, now = () => new Date().toISOString() } = {}) {
    signal?.throwIfAborted()
    const payload = await fetchJson(GREENHOUSE_API_URL, { signal })
    signal?.throwIfAborted()
    if (!Array.isArray(payload?.jobs)) throw new Error('Cloudflare native inventory listing is unavailable')
    const jobs = payload.jobs.flatMap(record => {
      if (record?.company_name && record.company_name !== COMPANY) throw new Error('Cloudflare native employer identity conflicts')
      const location = selectGreenhouseLocation(record || {})
      if (!hasNativeIndiaLocation(location)) return []
      if (!record.title || !normalizeGreenhouseSourceRoleUrl(record.absolute_url, {
        jobId: record.id, boardToken: SOURCE, companyCareerPage: CAREERS_URL,
      })) throw new Error('Cloudflare native role URL identity is invalid')
      const workMode = String(record.location?.name || '')
      return [{ title: record.title, company: COMPANY, source: SOURCE, jobId: record.id,
        requisitionId: record.requisition_id || null, department: record.departments?.[0]?.name || null,
        location, city: location.split(',')[0].trim(), country: 'India',
        sourceUrl: record.absolute_url, applyUrl: record.absolute_url, link: record.absolute_url,
        jobDescription: record.content || null, postingDate: record.first_published || null,
        closingDate: record.application_deadline || null,
        remoteStatus: /hybrid/i.test(workMode) ? 'Hybrid' : /distributed|remote/i.test(workMode) ? 'Remote'
          : /in[- ]office|on[- ]site/i.test(workMode) ? 'On-site' : null,
        scrapedAt: now(),
      }]
    })
    return attachGreenhouseSourceEvidence(jobs, { source: SOURCE, companyName: COMPANY,
      companyCareerPage: CAREERS_URL, boardToken: SOURCE, payload, signal })
  },
})

export const run = options => createCloudflareScraper().run(options)
