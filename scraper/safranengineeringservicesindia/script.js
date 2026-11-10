import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../../scraper-support/utils/loadConfig.js'
import {readNativeDocument,activeHead} from '../../scraper-support/utils/activeNativeHtml.js'
import {readVisibleNativeDocument} from '../../scraper-support/utils/visibleNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const config = loadConfig(currentDir)

export const SOURCE = 'safranengineeringservicesindia'
export const COMPANY = 'Safran Engineering Services India'
export const PUBLIC_COMPANY_NAME = 'Safran Engineering Services'
export const VERIFIED_ON = '2026-08-14'
export const CAREERS_HOST = 'https://careers.safran-group.com'
export const SEARCH_KEYWORDS = 'Safran Engineering Services'
export const SEARCH_URL =
  `${CAREERS_HOST}/offre-de-emploi/liste-toutes-offres.aspx?Keywords=Safran%20Engineering%20Services&LCID=1033`

const INDIA = 'India'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36'

const SAFRAN_HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
}

const decodeHtmlEntities = (value) => String(value ?? '')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number.parseInt(code, 10)))
  .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;|&#8217;/gi, "'")
  .replace(/[\u2018\u2019]/g, "'")
  .replace(/&ldquo;|&rdquo;|&#8220;|&#8221;/gi, '"')
  .replace(/[\u201c\u201d]/g, '"')
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

const stripTags = (value) => String(value ?? '')
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/ul|\/ol)\b[^>]*>/gi, ' ')
  .replace(/<li\b[^>]*>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')

const normalizeWhitespace = (value) => {
  const normalized = decodeHtmlEntities(stripTags(value))
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const normalizeSearchText = (value) => normalizeWhitespace(value)
  ?.normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  || ''

const normalizeSlashDate = (value) => {
  const normalized = normalizeWhitespace(value)
  const match = normalized?.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) return null

  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

const toAbsoluteUrl = (value, baseUrl = SEARCH_URL) => {
  const normalized = normalizeWhitespace(value)
  if (!normalized) return null

  try {
    return new URL(normalized, baseUrl).toString()
  } catch {
    return null
  }
}

const extractTitleText = (html) =>
  normalizeWhitespace(String(html ?? '').match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1])

const extractMetaDescription = (html) =>
  decodeHtmlEntities(
    String(html ?? '').match(/<meta[^>]+name="Description"[^>]+content="([^"]+)"/i)?.[1] ?? '',
  ).trim() || null

const extractFieldById = (html, fieldId) =>
  normalizeWhitespace(String(html ?? '').match(new RegExp(`<p id="${fieldId}">([\\s\\S]*?)<\\/p>`, 'i'))?.[1])

const extractFieldListById = (html, fieldId) => [...String(html ?? '').matchAll(
  new RegExp(`<p id="${fieldId}">([\\s\\S]*?)<\\/p>`, 'gi'),
)]
  .map((match) => normalizeWhitespace(match[1]))
  .filter(Boolean)

const extractOfferIdFromUrl = (value) =>
  normalizeWhitespace(String(value ?? '').match(/_(\d+)\.aspx(?:\?|$)/i)?.[1])

const extractCountry = (geographicalArea) => {
  const parts = normalizeWhitespace(geographicalArea)
    ?.split(',')
    .map((part) => normalizeWhitespace(part))
    .filter(Boolean)
    || []

  return parts.at(-1) || null
}

const buildLocation = (city, country) => {
  const normalizedCity = normalizeWhitespace(city)
  const normalizedCountry = normalizeWhitespace(country)

  if (normalizedCity && normalizedCountry) {
    return `${normalizedCity}, ${normalizedCountry}`
  }

  return normalizedCity || normalizedCountry || null
}

const normalizeEmploymentType = (value) => normalizeWhitespace(value) || null

export const buildSearchUrl = (page = 1) => {
  const normalizedPage = Math.max(1, Number(page) || 1)
  if (normalizedPage <= 1) {
    return SEARCH_URL
  }

  return `${SEARCH_URL}&page=${normalizedPage}`
}

export const createDefaultFetchText = ({
  fetchImpl = fetch,
  signal,
} = {}) => async (url) => {
  signal?.throwIfAborted()
  const response = await fetchImpl(url, {
    headers: SAFRAN_HEADERS,
    redirect: 'follow',
    ...(signal ? {signal} : {}),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }
  if (response.url && response.url !== url) throw new Error('Safran detail response identity changed')
  const html = await response.text()
  signal?.throwIfAborted()
  return html
}

export const hasVerifiedSearchPageSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalizedTitle = normalizeSearchText(extractTitleText(rawHtml))

  return normalizedTitle.startsWith(normalizeSearchText('Safran - Search results'))
    && normalizedTitle.includes(normalizeSearchText(`Keywords : ${SEARCH_KEYWORDS}`))
    && /offerRss\.ashx\?lcid=1033&amp;Keywords=Safran%20Engineering%20Services/i.test(rawHtml)
    && /ts-offer-list-item offerlist-item/i.test(rawHtml)
}

export const extractTotalPages = (html = '') => {
  const pageNumbers = [...String(html ?? '').matchAll(/liste-toutes-offres\.aspx\?[^"]*page=(\d+)/gi)]
    .map((match) => Number.parseInt(match[1], 10))
    .filter(Number.isFinite)

  if (!pageNumbers.length) {
    return extractSearchResults(html).length ? 1 : 0
  }

  return Math.max(...pageNumbers)
}

export const extractSearchResults = (html = '') => [...String(html ?? '').matchAll(
  /<li class="ts-offer-list-item offerlist-item[\s\S]*?<ul class="ts-offer-list-item__description [\s\S]*?<\/ul>/gi,
)]
  .map((match) => {
    const block = match[0]
    const titleAnchor = block.match(
      /<a[^>]*class="[^"]*\bts-offer-list-item__title-link\b[^"]*"[^>]*>[\s\S]*?<\/a>/i,
    )?.[0] || ''
    const sourceUrl = toAbsoluteUrl(titleAnchor.match(/href="([^"]+)"/i)?.[1], SEARCH_URL)
    const title = normalizeWhitespace(titleAnchor.match(/>([\s\S]*?)<\/a>/i)?.[1])
    const detailsHtml = block.match(/<ul class="ts-offer-list-item__description [\s\S]*?<\/ul>/i)?.[0] || ''
    const details = [...detailsHtml.matchAll(/<li(?: [^>]*)?>([\s\S]*?)<\/li>/gi)]
      .map((item) => normalizeWhitespace(item[1]))
      .filter(Boolean)
    const city = normalizeWhitespace(details[3])
    const requisitionId = normalizeWhitespace(details[0]?.match(/Ref\.\s*:\s*([A-Z0-9-]+)/i)?.[1])
    const offerId = extractOfferIdFromUrl(sourceUrl)

    if (!sourceUrl || !title || !requisitionId || !offerId || !city) {
      return null
    }

    return {
      title,
      company: COMPANY,
      department: null,
      location: city,
      city,
      country: null,
      jobId: offerId,
      requisitionId,
      sourceUrl,
      applyUrl: sourceUrl,
      employmentType: normalizeEmploymentType(details[2]),
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: normalizeSlashDate(details[1]),
      closingDate: null,
      jobDescription: null,
    }
  })
  .filter(Boolean)

export const hasVerifiedDetailSignal = (html = '') => {
  const rawHtml = String(html ?? '')
  const normalizedTitle = normalizeSearchText(extractTitleText(rawHtml))
  const metaDescription = extractMetaDescription(rawHtml)

  return normalizedTitle.startsWith(normalizeSearchText('Safran - '))
    && metaDescription?.includes(`Offre d'emploi ${PUBLIC_COMPANY_NAME} -`)
    && Boolean(extractFieldById(rawHtml, 'fldjobdescription_jobtitle'))
    && Boolean(extractFieldById(rawHtml, 'fldlocation_location_geographicalareacollection'))
    && Boolean(extractFieldById(rawHtml, 'fldlocation_joblocation'))
}

export const extractJobDetail = (html, listing = {}) => {
  const rawHtml = String(html ?? '')
  const geographicalArea = extractFieldById(rawHtml, 'fldlocation_location_geographicalareacollection')
  const city = extractFieldById(rawHtml, 'fldlocation_joblocation') || listing.city || null
  const country = extractCountry(geographicalArea) || listing.country || null
  const descriptionBlocks = [
    ...extractFieldListById(rawHtml, 'fldjobdescription_description1'),
    ...extractFieldListById(rawHtml, 'fldjobdescription_longtext2'),
    ...extractFieldListById(rawHtml, 'fldjobdescription_description2'),
  ]

  return {
    ...listing,
    title: extractFieldById(rawHtml, 'fldjobdescription_jobtitle') || listing.title || null,
    company: COMPANY,
    department: extractFieldById(rawHtml, 'fldjobdescription_primaryprofile') || listing.department || null,
    location: buildLocation(city, country),
    city,
    country,
    jobId: listing.jobId || extractOfferIdFromUrl(listing.sourceUrl || rawHtml) || null,
    requisitionId: listing.requisitionId || null,
    sourceUrl: listing.sourceUrl || null,
    applyUrl: listing.applyUrl || listing.sourceUrl || null,
    employmentType: normalizeEmploymentType(
      extractFieldById(rawHtml, 'fldjobdescription_contract') || listing.employmentType,
    ),
    experienceRequired: extractFieldById(rawHtml, 'fldapplicantcriteria_experiencelevel'),
    minimumQualification: extractFieldById(rawHtml, 'fldapplicantcriteria_educationlevel'),
    preferredQualification: null,
    requiredSkills: [],
    postingDate: listing.postingDate || null,
    closingDate: null,
    jobDescription: normalizeWhitespace(descriptionBlocks.join('\n\n')) || extractMetaDescription(rawHtml),
  }
}

function boundNativeDetail(html,listing) {
  const document=readNativeDocument(html),visible=readVisibleNativeDocument(html,{strict:true})
  const field=id=>{
    // Current Talentsoft descriptions are divs containing nested paragraphs;
    // identity and workplace fields remain scalar paragraphs.
    const description=/^fldjobdescription_(?:description1|longtext2|description2)$/.test(id)
    const ownsField=node=>(node.tag==='p'||description&&node.tag==='div')&&node.attrs.id===id
    const nodes=visible.nodes(ownsField)
    if(description){
      // The active reader omits inert nodes from nodes(); inspect the original
      // tree too so a hidden field or subtree cannot silently lose criteria.
      const original=[]
      const reveal=node=>typeof node==='string'?node:{...node,inert:false,children:node.children.map(reveal)}
      const visit=node=>{if(typeof node==='string')return;if(ownsField(node))original.push(reveal(node));node.children.forEach(visit)}
      document.nodes(node=>node.tag==='root').forEach(visit)
      if(original.length!==nodes.length||normalizeWhitespace(original.map(node=>document.text(node)).join(' '))
        !==normalizeWhitespace(nodes.map(node=>visible.text(node)).join(' ')))throw Error('Safran detail contains hidden native description criteria')
    }
    if(nodes.length>1)throw Error('Safran detail identity has duplicate native fields')
    return nodes.length===1?normalizeWhitespace(visible.text(nodes[0])):null
  }
  const titles=activeHead(html).titles,metas=document.nodes(node=>node.tag==='meta'&&node.attrs.name?.toLowerCase()==='description')
  const title=field('fldjobdescription_jobtitle'),geography=field('fldlocation_location_geographicalareacollection'),city=field('fldlocation_joblocation')
  const meta=metas.length===1?metas[0].attrs.content:null
  if(titles.length!==1||titles[0]!==`Safran - ${listing.title}`
    ||title!==listing.title||!geography||!city||!meta?.includes(`Ref : ${listing.requisitionId}.`)
    ||!listing.requisitionId.endsWith('-'+listing.jobId))throw Error('The verified Safran Engineering Services detail page identity or native country changed')
  const date=meta.match(/\bDate\s*:\s*(\d{2})\/(\d{2})\/(\d{4})\./)
  const postingDate=date?`${date[3]}-${date[2]}-${date[1]}`:null
  if(!postingDate||!Number.isFinite(Date.parse(postingDate))||new Date(postingDate).toISOString().slice(0,10)!==postingDate
    ||listing.postingDate&&listing.postingDate!==postingDate)throw Error('Safran detail posting date identity changed')
  return {title,geography,city,meta,field,postingDate,description:['description1','longtext2','description2'].map(id=>field('fldjobdescription_'+id)).filter(Boolean)}
}
const inventoryKey=listings=>JSON.stringify(listings.map(row=>[row.jobId,row.title,row.requisitionId,row.sourceUrl]).sort((a,b)=>a[0].localeCompare(b[0])))

export const createSafranEngineeringServicesIndiaScraper = ({
  maxPages = Number.isInteger(config.maxPages) ? config.maxPages : Number.POSITIVE_INFINITY,
  maxJobs = Number.isInteger(config.maxJobs) ? config.maxJobs : Number.POSITIVE_INFINITY,
  now: defaultNow = () => new Date().toISOString(),
} = {}) => ({
  async run(options = {}) {
    const fetchText = options.fetchText || createDefaultFetchText({fetchImpl:options.fetchImpl||fetch,signal:options.signal})
    const readText=async url=>{options.signal?.throwIfAborted();const html=await fetchText(url,{signal:options.signal});options.signal?.throwIfAborted();return html}
    const now = options.now || defaultNow

    const firstPageHtml = await readText(buildSearchUrl(1))
    if (!hasVerifiedSearchPageSignal(firstPageHtml)) {
      throw new Error('The verified accessible Safran Engineering Services search page no longer matches the trusted first-party careers surface')
    }

    const totalPages = Math.min(extractTotalPages(firstPageHtml) || 1, maxPages)
    const jobs = []
    const seenJobIds = new Set()
    const openingPages=[]
    const finish=reason=>attachInventoryEvidence(jobs,{status:'discovery-only',surface:SEARCH_URL,firstParty:true,listingComplete:false,
      pagesFetched:openingPages.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason})

    for (let page = 1; page <= totalPages; page += 1) {
      const pageHtml = page === 1
        ? firstPageHtml
        : await readText(buildSearchUrl(page))

      if (!hasVerifiedSearchPageSignal(pageHtml)) {
        throw new Error(`The verified accessible Safran Engineering Services search page no longer matches the trusted first-party careers surface on page ${page}`)
      }

      const listings = extractSearchResults(pageHtml)
      openingPages.push(inventoryKey(listings))
      if (listings.length === 0) {
        throw new Error('The verified accessible Safran Engineering Services search page no longer exposes company-specific job cards')
      }

      for (const listing of listings) {
        if (!listing.jobId || seenJobIds.has(listing.jobId)) continue
        seenJobIds.add(listing.jobId)

        if(!/^https:\/\/careers\.safran-group\.com\/job\/[^/?#]+_\d+\.aspx$/.test(listing.sourceUrl)
          ||!listing.sourceUrl.endsWith('_'+listing.jobId+'.aspx'))throw Error('Safran detail URL identity changed')
        const detailHtml = await readText(listing.sourceUrl)
        const native=boundNativeDetail(detailHtml,listing)
        if (!hasVerifiedDetailSignal(detailHtml)) {
          // The exact keyword search also returns the German SafranES
          // affiliate. Its own active country and requisition can exclude it;
          // that foreign employer never authorizes an India publication.
          if(native.geography==='Europe, Germany'&&native.meta.startsWith("Offre d'emploi SafranES Donauw"))continue
          throw new Error(`The verified Safran Engineering Services detail page no longer matches the accessible first-party careers surface for ${listing.sourceUrl}`)
        }

        const job = extractJobDetail(detailHtml, listing)
        if(job.country!==extractCountry(native.geography)||job.title!==native.title)throw Error('Safran detail identity or country fields disagree')
        if (job.country !== INDIA) continue
        if(!native.meta.startsWith("Offre d'emploi Safran Engineering Services - India de ")||native.description.join(' ').length<200)throw Error('Safran full native India criteria or employer is unavailable')

        jobs.push({
          ...job,
          city:native.city,
          location:buildLocation(native.city,job.country),
          department:native.field('fldjobdescription_primaryprofile'),
          employmentType:normalizeEmploymentType(native.field('fldjobdescription_contract')),
          postingDate:native.postingDate,
          jobDescription:native.description.join('\n\n'),
          minimumQualification:native.field('fldapplicantcriteria_educationlevel'),
          experienceRequired:native.field('fldapplicantcriteria_experiencelevel'),
          sourceDetailComplete:true,
          sourceListingComplete:false,
          sourceScopeComplete:false,
          lifecycleCleanupAllowed:false,
          source: SOURCE,
          link: job.applyUrl || job.sourceUrl,
          scrapedAt: now(),
        })

        if (jobs.length >= maxJobs) {
          return finish('requested-sample-of-keyword-search; company-wide-inventory-unknown')
        }
      }
    }

    for(let page=1;page<=totalPages;page++){
      const closing=await readText(buildSearchUrl(page))
      if(!hasVerifiedSearchPageSignal(closing)||inventoryKey(extractSearchResults(closing))!==openingPages[page-1])throw Error('Safran closing native search inventory changed')
    }
    return finish('closing-keyword-search-reconciled; company-wide-inventory-unknown')
  },
})

export const run = async (options = {}) => createSafranEngineeringServicesIndiaScraper().run(options)

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
