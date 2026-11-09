import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { extractJobFilterSignals } from '../../src/utils/jobFilterSignals.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {qualifyNativeWspRole,readWspResponse} from './nativeDetails.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INDIA_SITE_URL = 'https://www.wsp.com/en-gl/sites/india'
export const JOBS_PAGE_URL = 'https://www.wsp.com/en-gl/careers/job-opportunities?country=IN'

export const COMPANY = 'WSP India'
export const SOURCE = 'wspindia'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const ORACLE_PREVIEW_LINK_PATTERN =
  /https:\/\/emit\.fa\.ca3\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_2001\/(?:requisitions\/preview\/|job\/)(\d+)/i

const normalizeWhitespace = (value) => {
  if (value == null) return null

  const normalized = String(value)
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;|&ldquo;|&rdquo;/gi, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const stripTags = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<br\b[^>]*>/gi, '\n')
    .replace(/<\/(p|div|li|span|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractVisibleText = (value) => normalizeWhitespace(
  String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/span|\/h[1-6]|\/section|\/article|\/ul|\/ol)\b[^>]*>/gi, '\n')
    .replace(/<(li|p|div|span|section|article|h[1-6])\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '),
)

const extractFirst = (pattern, html) => {
  const match = pattern.exec(String(html ?? ''))
  return match ? stripTags(match[1]) : null
}

const extractStructuredText = (html) =>
  [...String(html ?? '').matchAll(/<(span|div|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(([, , value]) => stripTags(value))
    .filter(Boolean)

const extractCity = (location) => {
  const normalized = normalizeWhitespace(location)
  if (!normalized) return null
  return normalized.split('|')[0]?.trim() || null
}

export const hasOfficialIndiaSiteSignal = (html) => {
  const page = String(html ?? '')
  const doc=readNativeDocument(page),root=doc.nodes(node=>node.tag==='root')[0]
  return /WSP/i.test(doc.text(root))&&/Search and apply/i.test(doc.text(root))
    &&doc.nodes(node=>node.tag==='a'&&node.attrs.href).some(node=>{
      try{return new URL(node.attrs.href,INDIA_SITE_URL).href===JOBS_PAGE_URL}catch{return false}
    })
}

export const hasOfficialJobsPageSignal = (html) => {
  const page = String(html ?? '')
  if (!/emit\.fa\.ca3\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_2001\//i.test(page)) return false
  const legacy = /Find your dream job/i.test(page)
  const current = /<title\b[^>]*>\s*Find your next opportunity\s*\|\s*WSP\s*<\/title>/i.test(page)
    && /<link\b[^>]*rel=["']canonical["'][^>]*href=["']https:\/\/www\.wsp\.com\/en-gl\/careers\/job-opportunities["']/i.test(page)
    && /id=["']jobscontainer["']/i.test(page)
    && extractReportedJobCount(page) != null
  return legacy || current
}

export const extractReportedJobCount = (html) => {
  const heading = extractFirst(/<h2\b[^>]*id=["']dict-title["'][^>]*>([\s\S]*?)<\/h2>/i, html)
  const value = heading?.match(/^Showing\s+([0-9,]+)\s+jobs\b/i)?.[1]
  return value == null ? null : Number.parseInt(value.replace(/,/g, ''), 10)
}

const extractCurrentPageNumber = (html) => {
  const current = String(html ?? '').match(/<div\b[^>]*class=["']pagelist current["'][^>]*>([\s\S]*?)<\/div>/i)?.[1]
  const value = current?.match(/data-value=["'](\d+)["']/i)?.[1]
  return value ? Number.parseInt(value, 10) : null
}

export const hasCloudflareChallengeSignal = (html = '') => {
  const page = String(html ?? '')
  const text = stripTags(page) || ''

  return /<title>\s*Just a moment\.\.\.\s*<\/title>/i.test(page)
    && /cloudflare/i.test(page)
    && (
      text.includes('Please enable cookies')
      || /cdn-cgi\/challenge-platform/i.test(page)
      || /challenges\.cloudflare\.com/i.test(page)
    )
}

export const buildJobsPageUrl = ({ page = 1 } = {}) =>
  Number(page) > 1 ? `${JOBS_PAGE_URL}&page=${Number(page)}` : JOBS_PAGE_URL

export const buildJobDetailsApiUrl = (jobId) =>
  `https://emit.fa.ca3.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails?expand=all&onlyData=true&finder=ById;Id=%22${encodeURIComponent(String(jobId ?? ''))}%22,siteNumber=CX_2001`

export const extractMaxPageNumber = (html) => {
  const pageNumbers = [
    ...[...String(html ?? '').matchAll(/country=IN(?:&amp;|&)page=(\d+)/gi)]
      .map(([, value]) => Number.parseInt(value, 10))
      .filter(Number.isInteger),
    ...[...String(html ?? '').matchAll(/class=["'][^"']*page(?:prev|next)[^"']*["'][^>]*>\s*(\d+)\s*<\/a>/gi)]
      .map(([, value]) => Number.parseInt(value, 10))
      .filter(Number.isInteger),
  ]

  return pageNumbers.length > 0 ? Math.max(...pageNumbers) : 1
}

export const extractJobsFromHtml = (html) => {
  const jobs = []
  const page = String(html ?? '')
  const active=readNativeDocument(page)
  const activeURLs=new Set(active.nodes(node=>node.tag==='a'&&node.attrs.href).map(node=>node.attrs.href))
  const anchorPattern = /<a\b[^>]*href=(["'])(https:\/\/emit\.fa\.ca3\.oraclecloud\.com\/hcmUI\/CandidateExperience\/en\/sites\/CX_2001\/(?:requisitions\/preview\/|job\/)\d+)\1[^>]*>([\s\S]*?)<\/a>/gi

  for (const match of page.matchAll(anchorPattern)) {
    const [, , href, innerHtml] = match
    if(!activeURLs.has(href))continue
    const previewMatch = href.match(ORACLE_PREVIEW_LINK_PATTERN)
    if (!previewMatch) continue

    const segments = extractStructuredText(innerHtml)
    const title = extractFirst(/<h[1-6][^>]*>\s*([\s\S]*?)\s*<\/h[1-6]>/i, innerHtml)
      || normalizeWhitespace(segments[0])
      || stripTags(innerHtml)
    const location = extractFirst(/class=["'][^"']*text-locations[^"']*["'][^>]*>\s*([\s\S]*?)\s*<\/div>/i, innerHtml)
      || normalizeWhitespace(segments.findLast((segment) => segment && segment !== title))
      || null

    if (!title || !location) {
      throw new Error('WSP India job card changed; refusing an incomplete inventory')
    }
    if (/\/sites\/CX_2001\/job\//i.test(href)) {
      const publicCountry = normalizeWhitespace(match[0]).match(/'job_country':\s*'([^']+)'/i)?.[1]
      if (publicCountry !== 'India') {
        throw new Error('WSP India current job card lacks explicit India evidence')
      }
    }

    jobs.push({
      title,
      company: COMPANY,
      location,
      city: extractCity(location),
      sourceUrl: href,
      applyUrl: href,
      jobId: previewMatch[1],
      requisitionId: previewMatch[1],
      jobDescription: null,
    })
  }

  return jobs
}

const inferExperienceFromDescription = (jobDescription) => {
  const normalizedDescription = normalizeWhitespace(jobDescription)
  if (!normalizedDescription) return null

  const experienceProfile = extractJobFilterSignals({
    description: normalizedDescription,
  })?.experienceProfile
  const evidence = normalizeWhitespace(experienceProfile?.evidence)

  if (!evidence || experienceProfile?.confidence !== 'high') {
    return null
  }

  return (
    experienceProfile.minimumYears === 0 && experienceProfile.maximumYears === 0
      ? 'No experience required'
      : evidence
  )
}

const buildDetailDescription = (detailRecord = {}) => {
  const sections = [
    detailRecord.ExternalDescriptionStr,
    detailRecord.ExternalResponsibilitiesStr,
    detailRecord.ExternalQualificationsStr,
  ]
    .map((value) => extractVisibleText(value))
    .filter(Boolean)

  return sections.length > 0 ? [...new Set(sections)].join('\n\n') : null
}

export const enrichJobFromDetailRecord = (job, detailRecord = null) => {
  const detailText = buildDetailDescription(detailRecord) || job.jobDescription || null
  const experienceRequired = inferExperienceFromDescription(detailText)

  return {
    ...job,
    jobDescription: detailText || job.jobDescription || null,
    experienceRequired: experienceRequired || job.experienceRequired || null,
    publicExperienceChecked: Boolean(detailRecord && (detailText || detailRecord.Id)),
  }
}

const defaultFetchPage=(url,options)=>readWspResponse(url,options)
const defaultFetchJson=(url,options)=>readWspResponse(url,{...options,json:true})

export const isCloudflareChallengePage = (page = {}) =>
  Number(page.status) === 403 && hasCloudflareChallengeSignal(page.html)

const mapDetailsInOrder = async (jobs, enrich) => {
  const results = new Array(jobs.length)
  let nextIndex = 0
  let failed = false
  const settled=await Promise.allSettled(Array.from({ length: Math.min(4, jobs.length) }, async () => {
    while (!failed && nextIndex < jobs.length) {
      const index = nextIndex++
      try {
        results[index] = await enrich(jobs[index])
      } catch (error) {
        failed = true
        throw error
      }
    }
  }))
  const rejected=settled.find(row=>row.status==='rejected')
  if(rejected)throw rejected.reason
  return results
}

export const createWspIndiaScraper = ({
  maxPages = null,
  maxJobs = null,
} = {}) => ({
  async run({
    fetchPage = defaultFetchPage,
    fetchJson = defaultFetchJson,
    now = () => new Date().toISOString(),
    signal: callerSignal,
  } = {}) {
    for(const [name,value,min]of [['maxPages',maxPages,1],['maxJobs',maxJobs,0]]){
      if(value!=null&&(!Number.isSafeInteger(value)||value<min))throw Error('WSP India invalid '+name)
    }
    const signal=AbortSignal.any([AbortSignal.timeout(180000),...(callerSignal?[callerSignal]:[])])
    const getPage=async url=>{
      signal.throwIfAborted()
      const page=await fetchPage(url,{signal})
      signal.throwIfAborted()
      if(page?.url!==url)throw Error('WSP India first-party response URL identity changed')
      return page
    }
    const indiaSitePage = await getPage(INDIA_SITE_URL)
    if (isCloudflareChallengePage(indiaSitePage)) throw new Error('WSP India official site is unavailable behind a Cloudflare challenge')
    if (indiaSitePage.status !== 200 || !hasOfficialIndiaSiteSignal(indiaSitePage.html)) {
      throw new Error('WSP India official India site surface changed; refusing to guess the jobs handoff')
    }

    const firstJobsPage = await getPage(buildJobsPageUrl({ page: 1 }))
    if (isCloudflareChallengePage(firstJobsPage)) throw new Error('WSP India jobs page is unavailable behind a Cloudflare challenge')
    if (firstJobsPage.status !== 200 || !hasOfficialJobsPageSignal(firstJobsPage.html)) {
      throw new Error('WSP India official jobs page surface changed; refusing to guess job links')
    }

    const discoveredMaxPages = extractMaxPageNumber(firstJobsPage.html)
    const totalPages = Math.max(1, maxPages ? Math.min(maxPages, discoveredMaxPages) : discoveredMaxPages)
    const reportedTotal = extractReportedJobCount(firstJobsPage.html)
    const jobs = []
    const seenJobs = new Map()
    let listingRows = 0
    let pagesFetched=0
    const heldNativeRoles=[]
    const pageHtmlCache = new Map([[1, firstJobsPage.html]])
    const finish=enumerationComplete=>{
      const audit={source:SOURCE,reportedTotal,listingRows,distinctAdvertisedRoles:seenJobs.size,
        qualifiedIndiaRoles:jobs.length,heldNativeRoles,enumerationComplete,pagesFetched,
        sourceScopeComplete:false,lifecycleCleanupAllowed:false}
      for(const job of jobs)Object.assign(job,{sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
        nativeListingEnumerationComplete:enumerationComplete,nativeUnresolvedRoleCount:heldNativeRoles.length})
      if(jobs.length)jobs[0].sourceNativeCollectionAudit=audit
      Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit})
      return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:JOBS_PAGE_URL,firstParty:true,listingComplete:false,
        pagesFetched,reportedTotal,indiaFacetCount:seenJobs.size,verifiedAt:now(),
        reason:'Current first-party advertised rows enumerated='+enumerationComplete+'; full native India roles='+jobs.length
          +'; unresolved native roles='+heldNativeRoles.length+'; company-wide scope and lifecycle cleanup unqualified'})
    }

    for (let page = 1; page <= totalPages; page += 1) {
      const pageResult = pageHtmlCache.has(page)
        ? { status: 200, url: buildJobsPageUrl({ page }), html: pageHtmlCache.get(page) }
        : await getPage(buildJobsPageUrl({ page }))
      pagesFetched++
      if (isCloudflareChallengePage(pageResult)) throw new Error('WSP India jobs page is unavailable behind a Cloudflare challenge')
      if (pageResult.status !== 200 || !hasOfficialJobsPageSignal(pageResult.html)) {
        throw new Error('WSP India official jobs page surface changed; refusing an incomplete inventory')
      }
      const currentPage = extractCurrentPageNumber(pageResult.html)
      const currentTotal = extractReportedJobCount(pageResult.html)
      if ((currentPage != null && currentPage !== page) || currentTotal !== reportedTotal
        || (reportedTotal != null && discoveredMaxPages > 1
          && (currentPage == null || extractMaxPageNumber(pageResult.html) !== discoveredMaxPages))) {
        throw new Error('WSP India public inventory pagination or reported total changed')
      }
      const pageJobs = extractJobsFromHtml(pageResult.html)
      if (pageJobs.length === 0) throw new Error('WSP India public inventory has no recognized job cards')
      listingRows += pageJobs.length
      const uniquePageJobs = pageJobs.filter(job => {
        const previous = seenJobs.get(job.jobId)
        if (previous) {
          if (['title', 'location', 'sourceUrl', 'applyUrl'].some(field => previous[field] !== job[field])) {
            throw new Error('WSP India public inventory has conflicting repeated requisition cards')
          }
          return false
        }
        seenJobs.set(job.jobId, job)
        return true
      })
      if (uniquePageJobs.length === 0) throw new Error('WSP India public inventory pagination repeated a previous page')
      const selectedPageJobs = maxJobs!=null ? uniquePageJobs.slice(0, Math.max(0, maxJobs - jobs.length)) : uniquePageJobs
      const pageDetails = await mapDetailsInOrder(selectedPageJobs, async job => {
        signal.throwIfAborted()
        const detailPayload = await fetchJson(buildJobDetailsApiUrl(job.jobId),{signal})
        signal.throwIfAborted()
        let normalizedJob
        try{normalizedJob=qualifyNativeWspRole(job,detailPayload,now())}
        catch(error){
          if(error.code!=='WSP_NATIVE_CONTENT_MISSING')throw error
          heldNativeRoles.push({id:job.jobId,title:job.title,sourceUrl:job.sourceUrl,reason:error.message,
            nativeRecord:detailPayload.items[0]})
          return null
        }
        return {
          ...normalizedJob,
          experienceRequired:inferExperienceFromDescription(normalizedJob.sourceRoleDescription),
          publicExperienceChecked:true,
          source: SOURCE,
          link: normalizedJob.applyUrl || normalizedJob.sourceUrl,
          scrapedAt: now(),
        }
      })
      jobs.push(...pageDetails.filter(Boolean))
      if (maxJobs!=null && jobs.length >= maxJobs) {
        return finish(page === discoveredMaxPages && reportedTotal === listingRows
          && selectedPageJobs.length === uniquePageJobs.length)
      }

    }

    if (totalPages < discoveredMaxPages) return finish(false)
    if (reportedTotal != null && listingRows !== reportedTotal) {
      throw new Error('WSP India public inventory does not reconcile with the reported total')
    }
    signal.throwIfAborted()
    return finish(true)
  },
})

export const run = async (options = {}) => createWspIndiaScraper(options).run(options)

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
