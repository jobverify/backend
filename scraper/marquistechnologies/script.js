import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createBrowserFetchSession } from '../../scraper-support/shared/browserFetch.js'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

import provider from './provider.js'
import {readNativeDocument,extractActiveDescription,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {qualifiedFirstPartyHTML,nativeText,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = provider
export const SOURCE = provider.source
export const COMPANY = provider.companyName
export const HOMEPAGE_URL = provider.homepageUrl
export const CAREERS_URL = provider.companyCareerPage
export const APPLY_URL = 'https://www.marquistech.com/apply-for-job/'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&#8211;|&#8212;/gi, '-')
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchText = (url) => fetchTextWithRetry(url, {
  headers: {
    'User-Agent': USER_AGENT,
    Accept: 'text/html,application/xhtml+xml',
  },
  label: SOURCE,
  timeoutMs: 15000,
})

const isBrowserFallbackError = (error) =>
  /HTTP (?:403|429)\b|fetch failed|timed out|timeout|could not connect|und_err_connect_timeout|ssl\/tls secure channel|econnreset|unable to/i
    .test(String(error?.message ?? error ?? ''))

const findErrorInChain = (error, predicate) => {
  const seen = new Set()
  let current = error

  while (current && !seen.has(current)) {
    seen.add(current)
    if (predicate(current)) return current
    current = current?.cause
  }

  return null
}

const hasAnyHttpStatus = (error, statuses) => Boolean(
  findErrorInChain(error, (candidate) => statuses.includes(Number(candidate?.status))),
)

const createBlockedAccessError = (url, cause) => {
  const routeLabel = url === HOMEPAGE_URL ? 'homepage' : 'route'
  return Object.assign(
    new Error(`Marquis Technologies ${routeLabel} is currently blocked by upstream access controls`, {
      cause,
    }),
    {
      code: 'MARQUIS_SITE_BLOCKED',
      failureKind: 'blocked_or_access_denied',
      softFailure: true,
      upstreamOutage: true,
      abortRetries: true,
    },
  )
}

export const hasOfficialHomepageSignal = (html = '') => {
  const page = String(html ?? '')
  const text = normalizeWhitespace(page)

  return /Leader in Software Testing on different Platforms/i.test(page)
    && /Telecom Testing/i.test(text)
    && /Mobile-Device Testing/i.test(text)
    && /GCF Certification/i.test(text)
    && /job-openings/i.test(page)
}

export const hasCompromisedCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return /NABUNG77/i.test(text)
    || /BADAK178/i.test(text)
    || /SLOT ONLINE/i.test(text)
    || /\.pages\.dev/i.test(text)
}

export const extractOpeningUrls = (html = '') => {
  const urls = new Set()

  for (const match of String(html ?? '').matchAll(/https:\/\/www\.marquistech\.com\/openings\/[^"'?#\s<]+\/?/gi)) {
    urls.add(match[0].replace(/\/+$/, '/'))
  }

  return [...urls]
}

export const hasOfficialCareersSignal = (html = '') => {
  const text = normalizeWhitespace(html)

  return text.includes('Jobs')
    && text.includes('Apply for Job')
    && extractOpeningUrls(html).length > 0
}

const DETAIL_LABELS = [
  'Job Category',
  'Job Sub Category',
  'Job Type',
  'Job Location',
  'Designation',
  'Experience',
  'Education',
  'Job Overview',
  'Contact Email',
  'Company Description',
  'Key Responsibilities',
  'Requirements',
]

const extractFieldValue = (text, label) => {
  const token = `${label}:`
  const start = text.indexOf(token)
  if (start < 0) return null

  const valueStart = start + token.length
  const end = DETAIL_LABELS
    .filter((candidate) => candidate !== label)
    .map((candidate) => text.indexOf(`${candidate}:`, valueStart))
    .filter((index) => index >= valueStart)
    .sort((left, right) => left - right)[0] ?? text.length

  return normalizeWhitespace(text.slice(valueStart, end)) || null
}

const extractTitle = (html = '', fallbackUrl = '') => {
  const titleMatch = String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  const title = normalizeWhitespace(titleMatch?.[1] ?? '').replace(/\s*-\s*Welcome to Marquistech$/i, '')
  if (title) return title

  return fallbackUrl.replace(/\/+$/, '').split('/').filter(Boolean).at(-1)?.replace(/-/g, ' ') || null
}

const extractJobId = (url) =>
  url.replace(/\/+$/, '').split('/').filter(Boolean).at(-1) || null

const extractIndiaLocations = (rawLocation = '') => {
  const normalized = normalizeWhitespace(rawLocation)
  if (!normalized) return []

  const explicitIndiaLocations = [...normalized.matchAll(/([A-Za-z][A-Za-z .-]*?)\s*\(IND\)/gi)]
    .map((match) => normalizeWhitespace(match[1]))
    .filter(Boolean)

  if (explicitIndiaLocations.length > 0) {
    const remainder = normalizeWhitespace(normalized.replace(/([A-Za-z][A-Za-z .-]*?)\s*\(IND\)/gi, ''))
    return remainder
      ? [...explicitIndiaLocations, remainder]
      : explicitIndiaLocations
  }

  return /\bIndia\b/i.test(normalized) ? [normalized] : []
}

const toNormalizedLocation = (rawLocation) => {
  const locations = extractIndiaLocations(rawLocation)
  if (locations.length === 0) return null

  return locations.map((location) => /india/i.test(location) ? location : `${location}, India`).join('; ')
}

const toCity = (location) => normalizeWhitespace(location).split(';')[0]?.split(',')[0] || null

const extractDescription = (text) => {
  const jobOverviewToken = 'Job Overview:'
  const firstOverviewIndex = text.indexOf(jobOverviewToken)
  const secondOverviewIndex = firstOverviewIndex >= 0
    ? text.indexOf(jobOverviewToken, firstOverviewIndex + jobOverviewToken.length)
    : -1
  const companyDescriptionIndex = text.indexOf('Company Description:')

  if (secondOverviewIndex >= 0) {
    return normalizeWhitespace(text.slice(secondOverviewIndex + jobOverviewToken.length)) || null
  }

  if (companyDescriptionIndex >= 0) {
    return normalizeWhitespace(text.slice(companyDescriptionIndex + 'Company Description:'.length)) || null
  }

  return extractFieldValue(text, 'Job Overview')
}

const parseJobDetail = (html, sourceUrl) => {
  const document=readNativeDocument(html),postings=[]
  for(const script of document.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){
    const value=JSON.parse(script.raw)
    if(value?.['@type']==='JobPosting')postings.push(value)
  }
  if(postings.length){
    const fail=message=>new Error('Marquis native '+message+': '+sourceUrl),need=(ok,message)=>{if(!ok)throw fail(message)}
    qualifiedFirstPartyHTML(html,sourceUrl,fail)
    need(postings.length===1,'ambiguous role identity')
    const job=postings[0],title=clean(decodeNativeEntities(job.title)),headings=document.nodes(n=>n.tag==='h1')
    need(job.hiringOrganization?.name==='Marquistech Pvt. Ltd.'&&job.hiringOrganization?.sameAs==='https://www.marquistech.com','employer identity changed')
    need(headings.length===1&&clean(nativeText(headings[0]))===title,'title identity changed')
    const places=Array.isArray(job.jobLocation)?job.jobLocation:[job.jobLocation]
    const locations=places.map(place=>place?.address).filter(address=>typeof address==='string'&&/\(IND\)\s*$/.test(address)).map(address=>address.replace(/\s*\(IND\)\s*$/,'')+', India')
    if(!locations.length)return null
    const description=extractActiveDescription(String(job.description??'').replace(/\[\/?(?:vc_row|vc_column|vc_column_text)(?:\s[^\]]*)?\]/g,''))
    need(description,'full native criteria unavailable')
    need(!job.validThrough||Number.isFinite(Date.parse(job.validThrough))&&Date.parse(job.validThrough)>Date.now(),'native closing date expired or malformed')
    return{title,company:COMPANY,legalEmployer:null,jobId:extractJobId(sourceUrl),requisitionId:extractJobId(sourceUrl),sourceUrl,applyUrl:APPLY_URL,
      applicationUrlIsGeneric:true,country:'India',location:locations.join('; '),city:locations[0].split(',')[0],state:null,department:null,
      employmentType:job.employmentType??null,postingDate:job.datePosted??null,closingDate:job.validThrough??null,jobDescription:description,sourceDescription:description,
      sourceNativeJobRecord:job,sourceDetailComplete:true,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
  }
  const text = normalizeWhitespace(html)
  const rawLocation = extractFieldValue(text, 'Job Location')
  const location = toNormalizedLocation(rawLocation)
  if (!location) return null

  const departmentParts = [
    extractFieldValue(text, 'Job Category'),
    extractFieldValue(text, 'Job Sub Category'),
  ].filter(Boolean)

  const jobId = extractJobId(sourceUrl)

  return {
    title: extractTitle(html, sourceUrl),
    company: COMPANY,
    department: departmentParts.join(' / ') || null,
    location,
    city: toCity(location),
    country: 'India',
    jobId,
    requisitionId: jobId,
    sourceUrl,
    applyUrl: APPLY_URL,
    employmentType: extractFieldValue(text, 'Job Type'),
    experienceRequired: extractFieldValue(text, 'Experience'),
    minimumQualification: extractFieldValue(text, 'Education'),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: extractDescription(text),
  }
}

export const createMarquisTechnologiesScraper = () => ({
  async run({ fetchText = defaultFetchText, fetchBrowserText } = {}) {
    let browserSession = null

    const getBrowserSession = async () => {
      if (!browserSession) {
        browserSession = await createBrowserFetchSession({ userAgent: USER_AGENT })
      }

      return browserSession
    }

    const browserTextFetcher = fetchBrowserText || (async (url) => {
      const session = await getBrowserSession()
      return session.fetchText(url)
    })

    const fetchPageText = async (url) => {
      try {
        return await fetchText(url)
      } catch (error) {
        if (hasAnyHttpStatus(error, [307])) {
          throw createBlockedAccessError(url, error)
        }

        if (!isBrowserFallbackError(error)) {
          throw error
        }

        try {
          return await browserTextFetcher(url)
        } catch (fallbackError) {
          if (hasAnyHttpStatus(fallbackError, [307])) {
            throw createBlockedAccessError(url, fallbackError)
          }
          throw fallbackError
        }
      }
    }

    try {
      const homepageHtml = await fetchPageText(HOMEPAGE_URL)
      if (!hasOfficialHomepageSignal(homepageHtml)) {
        throw new Error('Marquis Technologies homepage no longer matches the verified first-party surface')
      }

      const careersHtml = await fetchPageText(CAREERS_URL)
      if (hasCompromisedCareersSignal(careersHtml)) {
        return []
      }
      if (!hasOfficialCareersSignal(careersHtml)) {
        throw new Error('Marquis Technologies compromised careers route no longer matches the verified first-party openings surface')
      }

      const jobs = []
      for (const openingUrl of extractOpeningUrls(careersHtml)) {
        const detailHtml = await fetchPageText(openingUrl)
        const job = parseJobDetail(detailHtml, openingUrl)
        if (!job) {
          continue
        }

        if (!job?.title || !job.jobId || !job.jobDescription) {
          throw new Error(`Marquis Technologies opening detail no longer matches the verified contract: ${openingUrl}`)
        }

        jobs.push(job)
      }

      return jobs
    } finally {
      if (browserSession) {
        await browserSession.close()
      }
    }
  },
})

export const run = async (options = {}) => createMarquisTechnologiesScraper().run(options)

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
