import {runPublicLinkedIn,fetchPublicPage} from './publicLinkedIn.js'
import { fetchJsonWithRetry } from '../../scraper-support/utils/fetch.js'

const GRAPHQL_URL = 'https://wtcfns.hubspot.com/careers/graphql'
const CAREERS_URL = 'https://www.hubspot.com/careers/jobs'

const JOBS_QUERY = `
  query Jobs {
    jobs {
      id
      title
      location { name }
      department { name }
      office { location }
    }
  }
`

const JOB_QUERY = `
  query Job($id: ID!) {
    job(id: $id) {
      id
      title
      content
      department { name }
      office { location }
      location { name }
    }
  }
`

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;|&#160;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&quot;/gi, '"')
  .replace(/\s+/g, ' ')
  .trim()

const locationCandidates = (job = {}) => [job.office?.location, job.location?.name]
  .map(stripTags)
  .filter(Boolean)
const locationFor = (job = {}) => locationCandidates(job)[0] || null
const indiaLocationFor = (job = {}) => locationCandidates(job)
  .filter((location) => /\bindia\b/i.test(location))
  .sort((left, right) => {
    const leftGeneric = /^india$/i.test(left) ? 1 : 0
    const rightGeneric = /^india$/i.test(right) ? 1 : 0
    return leftGeneric - rightGeneric || right.length - left.length
  })[0] || null
const isIndiaJob = (job = {}) => Boolean(indiaLocationFor(job))

const defaultFetchGraphql = async (query, variables) => {
  const payload = await fetchJsonWithRetry(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Origin: 'https://www.hubspot.com',
      Referer: `${CAREERS_URL}/`,
    },
    body: JSON.stringify({ query, ...(variables ? { variables } : {}) }),
    label: 'hubspot',
    timeoutMs: 20000,
  })
  if (payload?.errors?.length) {
    throw new Error(`[hubspot] GraphQL error: ${payload.errors.map((error) => error.message).join('; ')}`)
  }
  return payload?.data || payload
}

const workModeFor = (location) => {
  if (/hybrid/i.test(location)) return 'Hybrid'
  if (/remote/i.test(location)) return 'Remote'
  if (/^office\s*-/i.test(location) || /\bon-?site\b/i.test(location)) return 'On-site'
  return null
}

export const createHubSpotGraphqlScraper = ({ now = () => new Date().toISOString() } = {}) => ({
  async run({ fetchGraphql = defaultFetchGraphql } = {}) {
    const listing = await fetchGraphql(JOBS_QUERY)
    if (!Array.isArray(listing?.jobs)) {
      throw new Error('[hubspot] GraphQL listing no longer exposes a jobs array')
    }
    const summaries = listing.jobs
    const seenIds = new Set()
    for (const [index, summary] of summaries.entries()) {
      const id = stripTags(summary?.id)
      const title = stripTags(summary?.title)
      const location = locationFor(summary)
      if (!id || !title || !location) {
        throw new Error(`[hubspot] malformed listing job at index ${index}`)
      }
      if (seenIds.has(id)) {
        throw new Error(`[hubspot] duplicate listing job identity: ${id}`)
      }
      seenIds.add(id)
    }
    const jobs = []

    for (const summary of summaries.filter(isIndiaJob)) {
      const summaryId = stripTags(summary.id)
      const result = await fetchGraphql(JOB_QUERY, { id: summaryId })
      const detail = result?.job
      if (!detail || typeof detail !== 'object') {
        throw new Error(`[hubspot] detail response is missing job ${summaryId}`)
      }
      const detailId = stripTags(detail.id)
      if (!detailId || detailId !== summaryId) {
        throw new Error(`[hubspot] detail identity mismatch for job ${summaryId}`)
      }
      const detailLocations = locationCandidates(detail)
      if (detailLocations.length > 0 && !detailLocations.some((value) => /\bindia\b/i.test(value))) {
        throw new Error(`[hubspot] detail location contradicts India listing job ${summaryId}`)
      }
      const merged = { ...summary, ...detail }
      const title = stripTags(merged.title)
      const location = indiaLocationFor(merged) || indiaLocationFor(summary)
      if (!title || !location) {
        throw new Error(`[hubspot] malformed India detail for job ${summaryId}`)
      }
      const cityCandidate = location
        .replace(/^Office\s*-\s*/i, '')
        .split(',')[0]
        ?.trim()
      const city = cityCandidate && !/^(?:india|remote(?:\s*-\s*india)?|india\s*-\s*remote)$/i.test(cityCandidate)
        ? cityCandidate
        : null
      const sourceUrl = `${CAREERS_URL}/${encodeURIComponent(summaryId)}`

      jobs.push({
        title,
        company: 'HubSpot',
        location,
        city,
        country: 'India',
        link: sourceUrl,
        sourceUrl,
        applyUrl: sourceUrl,
        jobId: summaryId,
        requisitionId: summaryId,
        department: stripTags(merged.department?.name) || null,
        employmentType: null,
        remoteStatus: workModeFor(location),
        jobDescription: stripTags(merged.content) || null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        source: 'hubspot',
        scrapedAt: now(),
      })
    }

    return jobs
  },
})

export const createHubSpotScraper = ({now=()=>new Date().toISOString()}={})=>({
 async run(options={}){
  if(options.fetchGraphql&&!options.fetchPage&&!options.fetchText)return createHubSpotGraphqlScraper({now}).run(options)
  const fetchPage=options.fetchPage||(options.fetchText?async(url,context)=>({status:200,url,html:await options.fetchText(url,context)}):fetchPublicPage)
  return runPublicLinkedIn({...options,fetchPage,now:options.now||now})
 }
})
export const run = (options={})=>createHubSpotScraper().run(options)
