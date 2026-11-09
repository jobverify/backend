import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { AMICORP_CATALOG } from './catalog.js'
import {readAmicorpDetail} from './nativeContract.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = AMICORP_CATALOG.source
export const COMPANY = AMICORP_CATALOG.companyName
export const OFFICIAL_BRAND_NAME = AMICORP_CATALOG.officialBrandName
export const VERIFIED_ON = AMICORP_CATALOG.verifiedOn
export const VERIFIED_SURFACE_SUMMARY = AMICORP_CATALOG.verifiedSurfaceSummary
export const PROVIDER_METADATA = AMICORP_CATALOG
export const HOMEPAGE_URL = AMICORP_CATALOG.homepageUrl
export const CAREERS_URL = AMICORP_CATALOG.careersPageUrl
export const PAGE_SITEMAP_URL = AMICORP_CATALOG.pageSitemapUrl
export const TRUSTED_APPLY_FORM_URL = AMICORP_CATALOG.trustedApplyFormUrl

const TRUSTED_HOSTS = new Set(['amicorp.com', 'www.amicorp.com'])
const CAREERS_PATH_PREFIX = '/ami-news/careers/'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const HTML_ENTITY_MAP = new Map([
  ['&nbsp;', ' '],
  ['&amp;', '&'],
  ['&quot;', '"'],
  ['&apos;', "'"],
  ['&#39;', "'"],
  ['&#8217;', "'"],
  ['&rsquo;', "'"],
  ['&lsquo;', "'"],
  ['&#8211;', '-'],
  ['&ndash;', '-'],
  ['&mdash;', '-'],
])

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 10)))
  .replace(/&#x([a-f0-9]+);/gi, (_, codePoint) => String.fromCodePoint(Number.parseInt(codePoint, 16)))
  .replace(/&[a-z#0-9]+;/gi, (entity) => HTML_ENTITY_MAP.get(entity) ?? entity)

const stripHtml = (value) => decodeHtmlEntities(String(value ?? '').replace(/<[^>]+>/g, ' '))

const normalizeWhitespace = (value) => stripHtml(value)
  .replace(/\u00a0/g, ' ')
  .replace(/\s+/g, ' ')
  .trim()

const normalizeUrlKey = (value) => String(value ?? '')
  .trim()
  .replace(/\/+$/g, '')
  .toLowerCase()

const toAbsoluteUrl = (value, baseUrl = CAREERS_URL) => {
  try {
    return new URL(value, baseUrl).toString()
  } catch {
    return null
  }
}

const isTrustedCareerDetailUrl = (value) => {
  try {
    const url = new URL(value)
    return TRUSTED_HOSTS.has(url.hostname)
      && url.protocol === 'https:'
      && url.pathname.startsWith(CAREERS_PATH_PREFIX)
      && normalizeUrlKey(url.toString()) !== normalizeUrlKey(CAREERS_URL)
  } catch {
    return false
  }
}

const defaultFetchText = async (url, {signal} = {}) => {
  signal?.throwIfAborted()
  const response = await fetch(url, {
    signal,
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  signal?.throwIfAborted()
  if(response.url && response.url !== url) throw new Error('Amicorp native response redirected away from the requested surface')
  const html=await response.text()
  signal?.throwIfAborted()
  return html
}

export const extractCareerListings = (html) => {
  const doc=readVisibleNativeDocument(String(html??''),{strict:true})
  const within=(node,predicate)=>node.inert?[]:[...(predicate(node)?[node]:[]),...node.children.filter(child=>typeof child!=='string').flatMap(child=>within(child,predicate))]
  const seen = new Set()
  const listings = []

  for (const anchor of doc.nodes(node=>node.tag==='a'&&doc.hasClass(node,'gem-infotext-wrap'))) {
    const titles=within(anchor,node=>node.tag==='div'&&(node.attrs.class||'').split(/\s+/).some(name=>name.startsWith('title-customize')))
    const subtitles=within(anchor,node=>node.tag==='div'&&(node.attrs.class||'').split(/\s+/).some(name=>name.startsWith('subtitle-customize')))
    if(titles.length!==1||subtitles.length!==1)continue
    const sourceUrl = toAbsoluteUrl(anchor.attrs.href)
    const title = doc.text(titles[0])
    const subtitle = doc.text(subtitles[0])

    if (!sourceUrl || !title || !subtitle || !isTrustedCareerDetailUrl(sourceUrl)) {
      continue
    }

    const key = normalizeUrlKey(sourceUrl)
    if (seen.has(key)) continue
    seen.add(key)

    listings.push({ title, subtitle, sourceUrl })
  }

  return listings
}

export const extractIndiaListings = (html) =>
  extractCareerListings(html).filter((listing) => /\bIndia\b/i.test(listing.subtitle))

export const getCareerDetailUrlsFromSitemap = (xml) => Array.from(
  String(xml ?? '').matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi),
)
  .map((match) => toAbsoluteUrl(match[1], HOMEPAGE_URL))
  .filter((url) => isTrustedCareerDetailUrl(url))

export const hasOfficialCareersSurface = (html) => {
  const page = String(html ?? '')

  return /<title>\s*Careers\s*-\s*Amicorp\s*<\/title>/i.test(page)
    && /<link rel="canonical" href="https:\/\/amicorp\.com\/ami-news\/careers\/"\s*\/?>/i.test(page)
    && /<meta property="og:site_name" content="Amicorp"\s*\/?>/i.test(page)
    && extractCareerListings(page).length > 0
}

export const hasOfficialPageSitemapSurface = (xml) => {
  const text = String(xml ?? '')

  return /<urlset/i.test(text)
    && /<loc>\s*https:\/\/amicorp\.com\/ami-news\/careers\/\s*<\/loc>/i.test(text)
    && getCareerDetailUrlsFromSitemap(text).length >= 2
}

const extractPostingDate = (html) => {
  const match = String(html ?? '').match(
    /<meta[^>]+property=["'](?:article:published_time|og:updated_time)["'][^>]+content=["']([^"']+)["']/i,
  )

  return match ? normalizeWhitespace(match[1]) : null
}

const extractHeaderMeta = (html) => {
  const match = String(html ?? '').match(
    /<span class="colored"[^>]*>\s*([^<]+?)\s*<\/span>\s*<span class="colored"[^>]*>\s*\(([^<]+?)\)\s*<\/span>\s*<span>\s*(JD\d+)\s*<\/span>/i,
  )

  if (!match) return null

  return {
    locationLabel: normalizeWhitespace(match[1]),
    displayDate: normalizeWhitespace(match[2]),
    requisitionId: normalizeWhitespace(match[3]),
  }
}

const parseLocationLabel = (value) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) {
    return {
      location: null,
      city: null,
      state: null,
      country: null,
    }
  }

  const match = normalized.match(/^(.*?)\s*\(([^)]+)\)$/)
  if (!match) {
    return {
      location: normalized,
      city: null,
      state: null,
      country: null,
    }
  }

  const city = normalizeWhitespace(match[1])
  const country = normalizeWhitespace(match[2])

  return {
    location: city && country ? `${city}, ${country}` : normalized,
    city: city || null,
    state: null,
    country: country || null,
  }
}

const extractApplyFormUrl = (html) => {
  const match = String(html ?? '').match(
    /<iframe[^>]+src=["']([^"']*CareerPageForm[^"']+)["']/i,
  )

  return match ? decodeHtmlEntities(match[1]) : null
}

const extractFirstDescriptionParagraph = (html) => {
  const match = String(html ?? '').match(
    /href="#form"[\s\S]*?<p>([\s\S]*?)<\/p>/i,
  )

  return match ? normalizeWhitespace(match[1]) : null
}

export const extractJobDetail = ({ listing, html }) => {
  if (!listing?.sourceUrl || !isTrustedCareerDetailUrl(listing.sourceUrl)) {
    throw new Error('Amicorp detail page is outside the trusted first-party careers surface')
  }

  const native=readAmicorpDetail(html,listing)

  return {
    title: listing.title,
    company: COMPANY,
    department: null,
    ...native,
    sourceUrl: listing.sourceUrl,
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    closingDate: null,
    remoteStatus: null,
  }
}

export const createAmicorpScraper = ({
  maxJobs = null,
  now = () => new Date().toISOString(),
  sourceTimeoutMs = 180000,
} = {}) => ({
  async run({ fetchText = defaultFetchText, signal: callerSignal, onAudit } = {}) {
    const signal=AbortSignal.any([AbortSignal.timeout(sourceTimeoutMs),...(callerSignal?[callerSignal]:[])])
    const wait=promise=>new Promise((resolve,reject)=>{
      const finish=(fn,value)=>{signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason)
      signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()
    })
    let pagesFetched=0
    const read=async url=>{
      signal?.throwIfAborted()
      try{const html=await wait(fetchText(url,{signal}));signal.throwIfAborted();pagesFetched++;return html}
      catch(error){signal?.throwIfAborted();throw error}
    }
    const careersHtml = await read(CAREERS_URL)
    if (!hasOfficialCareersSurface(careersHtml)) {
      throw new Error('Response is not the verified official Amicorp careers page')
    }

    const pageSitemapXml = await read(PAGE_SITEMAP_URL)
    if (!hasOfficialPageSitemapSurface(pageSitemapXml)) {
      throw new Error('Response is not the verified Amicorp page sitemap surface')
    }

    const sitemapDetailUrls = new Set(
      getCareerDetailUrlsFromSitemap(pageSitemapXml).map((url) => normalizeUrlKey(url)),
    )

    const indiaListings = extractIndiaListings(careersHtml)
    const selectedListings = Number.isInteger(maxJobs) && maxJobs > 0
      ? indiaListings.slice(0, maxJobs)
      : indiaListings

    let jobs = []
    const failures=[]
    for (const listing of selectedListings) {
      if (!sitemapDetailUrls.has(normalizeUrlKey(listing.sourceUrl))) {
        throw new Error(`Amicorp page sitemap no longer advertises the verified detail URL: ${listing.sourceUrl}`)
      }

      const detailHtml = await read(listing.sourceUrl)
      try{
        const job=extractJobDetail({listing,html:detailHtml})
        if(job.sourceDetailComplete===false&&job.sourceDetailFailureKind==='identity-mismatch'){
          failures.push({stage:'native-detail',nativeJobId:job.requisitionId||job.jobId,sourceUrl:listing.sourceUrl,
            failureKind:'identity-mismatch',identityEvidence:job.rawNativeRoleEvidence})
        }else jobs.push(job)
      }catch(error){
        if(error?.code!=='AMICORP_NATIVE_PUBLICATION_DATE_CONFLICT')throw error
        failures.push({stage:'native-detail',nativeJobId:error.nativeJobId,sourceUrl:listing.sourceUrl,
          failureKind:'native-publication-date-conflict',listingDate:error.listingDate,detailDate:error.detailDate})
      }
    }

    let closingInventoryMatches=false
    if(maxJobs===null){
      try{
        const closingHtml=await read(CAREERS_URL),closingSitemap=await read(PAGE_SITEMAP_URL)
        const signature=rows=>JSON.stringify([...rows].sort((a,b)=>a.sourceUrl.localeCompare(b.sourceUrl)))
        const closingListings=extractIndiaListings(closingHtml),closingByURL=new Map(closingListings.map(row=>[row.sourceUrl,JSON.stringify(row)]))
        closingInventoryMatches=hasOfficialCareersSurface(closingHtml)&&hasOfficialPageSitemapSurface(closingSitemap)
          &&signature(extractCareerListings(closingHtml))===signature(extractCareerListings(careersHtml))
          &&JSON.stringify(getCareerDetailUrlsFromSitemap(closingSitemap).sort())===JSON.stringify(getCareerDetailUrlsFromSitemap(pageSitemapXml).sort())
        jobs=jobs.filter(job=>{
          const listing=indiaListings.find(row=>row.sourceUrl===job.sourceUrl)
          if(closingByURL.get(job.sourceUrl)===JSON.stringify(listing))return true
          failures.push({stage:'native-detail',nativeJobId:job.requisitionId||job.jobId,sourceUrl:job.sourceUrl,failureKind:'native-closing-role-removed-or-changed'})
          return false
        })
      }catch(error){signal.throwIfAborted();failures.push({stage:'native-inventory',failureKind:'native-closing-inventory-unavailable',message:error.message})}
    }
    if(jobs.length)jobs[0].nativeCollectionEvidence={source:SOURCE,candidateDetails:selectedListings.length,
      extractedDetailJobs:jobs.length,jobs:jobs.map(job=>({id:job.jobId})),exclusions:[],failures,
      listingPaginationComplete:false,closingInventoryMatches,sourceScopeComplete:false,
      observedNativeCardCount:extractCareerListings(careersHtml).length,observedIndiaCardCount:indiaListings.length}
    if(onAudit)await wait(onAudit({source:SOURCE,observedNativeCardCount:extractCareerListings(careersHtml).length,
      observedIndiaCardCount:indiaListings.length,returned:jobs.length,closingInventoryMatches,failures,productionWrites:false}))

    return attachInventoryEvidence(jobs.map((job) => ({
      ...job,
      source: SOURCE,
      link: job.applyUrl,
      scrapedAt: now(),
    })),{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:false,pagesFetched,
      reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:`Current native careers cards and sitemap checked; closing card/sitemap models matched:${closingInventoryMatches}; company-wide channels and independent pagination total unproven`
        +(failures.length?'; unqualified-native-details:'+failures.map(failure=>failure.nativeJobId+':'+failure.failureKind).join(','):'')})
  },
})

export const run = async (options = {}) => createAmicorpScraper(options).run(options)

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
