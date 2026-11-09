import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { SIMPLIFY3X_SOFTWARE_CATALOG } from './catalog.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readEightfoldLocationScope } from '../../scraper-support/apiPortal/eightfoldLocations.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const PROVIDER_METADATA = SIMPLIFY3X_SOFTWARE_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const COMPANY = PROVIDER_METADATA.companyName
export const HOMEPAGE_URL = 'https://simplify3x.com.my/'
export const LIFE_PAGE_URL = 'https://simplify3x.com.my/life.html'
export const ABOUT_URL = 'https://simplify3x.com.my/about.html'
export const CONTACT_URL = 'https://simplify3x.com.my/contact.html'
export const CAREERS_URL = 'https://www.hire3x.com/careers'
export const LISTING_URL = 'https://api-website.hire3x.com/careers/jobs/?version=v2'
export const DETAIL_BASE = 'https://recruitment-api.hire3x.com/jd/public-job/?jobID='
export const AVAILABILITY_BASE = 'https://recruitment-api.hire3x.com/cus/v2/externalCandidate/?jobID='
export const NO_PUBLIC_JOB_ROUTE_URLS = [
  'https://simplify3x.com/careers',
  'https://simplify3x.com/jobs',
]

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36'

const normalizeWhitespace = (value) => String(value ?? '')
  .replace(/<br\s*\/?>/gi, '\n')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/gi, ' ')
  .replace(/&amp;/gi, '&')
  .replace(/\s+/g, ' ')
  .trim()

const defaultFetchPage = async (url, { signal } = {}) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: url.startsWith('https://recruitment-api.hire3x.com/') || url.startsWith('https://api-website.hire3x.com/')
        ? 'application/json' : 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
    },
    redirect: 'follow',
    signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(20000)]) : AbortSignal.timeout(20000),
  })

  return {
    status: response.status,
    url: response.url,
    html: await response.text(),
  }
}

export const hasOfficialHomepageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Simplify3x\s*-\s*AI-Driven Technology Solutions for Enterprise Transformation\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Turning complex problems into simple solutions')
    && normalized.includes('info@simplify3x.com')
}

export const hasOfficialLifePageSignal = (html = '') => {
  const normalized = normalizeWhitespace(html)

  return /<title>\s*Life at Simplify3x\s*-\s*Where Innovation Meets People\s*<\/title>/i.test(String(html ?? ''))
    && normalized.includes('Life at Simplify3x')
    && normalized.includes('Driven by Innovation, United by Purpose')
}

export const hasPublicJobSignal = (html = '') =>
  /\b(Current Openings|Open Positions|Vacancies|Apply Now)\b/i.test(String(html ?? ''))
  || /href=["'][^"']*\/jobs?\/[^"']*["']/i.test(String(html ?? ''))

export const isVerifiedMissingJobRoute = (page = {}) =>
  [403, 404].includes(Number(page.status))
    && !hasPublicJobSignal(page.html)

const fail = message => { throw new Error('Simplify3x ' + message) }
const parseJson = (page, label) => { try { return JSON.parse(page.html) } catch { fail(label + ' response is not JSON') } }
const hasHandoff = html => /href=["']https:\/\/www\.hire3x\.com\/careers["']/i.test(html)
const brandLinks = html => /href=["']https:\/\/www\.linkedin\.com\/company\/simplify3x\/["']/i.test(html)
 && /mailto:info@simplify3x\.com/i.test(html)
 && /cvstaticfiles\.s3\.ap-south-1\.amazonaws\.com\/website\/Simplify3x\/Simplify3X\+SOC\+2\+Type\+2\+Report\.pdf/.test(html)
const classifyLocation = locations => {
 const unknown = {country:null,city:null,state:null,location:null,nativeGeographyQualified:false}
 if (!Array.isArray(locations) || !locations.length || locations.some(value => typeof value !== 'string' || !value.trim())) return unknown
 const countryFor = value => {
  const scope = readEightfoldLocationScope({locations:[value]})
  return scope.unresolved ? null : scope.country
 }
 const countries = []
 for (const raw of locations) {
  const value = raw.normalize('NFKC').replace(/\s+/g,' ').trim(), parts = value.split(',')
  if (parts.some(part => !part.trim()) || /[;/|\\&]/.test(value)) return unknown
  const country = countryFor(value)
  if (!country) return unknown
  for (const part of parts) {
   const observed = countryFor(part.trim())
   if (observed && observed !== country) return unknown
   if (!observed && /\b(?:and|or|global|worldwide|multiple|anywhere)\b/i.test(part)) return unknown
  }
  countries.push(country)
 }
 if (new Set(countries).size !== 1) return unknown
 return {...unknown,country:countries[0],location:locations.join(', '),nativeGeographyQualified:true}
}
const validateIdentity = job => {
 if (!job || typeof job !== 'object' || !/^L\d{6}A\d{3}CU\d{3}JD\d{3}$/.test(job.jobID || '')
  || job.jobID !== job.customerID + job.jobID.match(/JD\d{3}$/)?.[0] || !job.customerID.startsWith(job.licenseKey || '!')
  || !/^(?:Simplify3x(?: - .+)?|Hire3x)$/.test(job.customerName || '') || !job.title?.trim()
  || !Array.isArray(job.location)) fail('employer or job identity changed')
 // The linked board also publishes a separate Hire3x drive tenant. Its dated events cannot
 // establish current employment, so those rows are reconciled but never imported.
 if (!['L071122A001','L082623A001'].includes(job.licenseKey)) fail('employer license identity changed')
 if (job.licenseKey === 'L082623A001' && job.customerName !== 'Hire3x') fail('drive employer identity changed')
}
const listingRows = body => {
 if (body?.type !== 'Success' || !Array.isArray(body.data) || !body.data.length
  || Object.keys(body).some(key => !['type','data'].includes(key))) fail('listing or pagination contract changed')
 const rows = new Map()
 for (const group of body.data) {
  if (typeof group.categoryName !== 'string' || !Array.isArray(group.jobs)) fail('listing category changed')
  for (const job of group.jobs) {
   validateIdentity(job)
   const previous = rows.get(job.jobID)
   if (previous && JSON.stringify(previous) !== JSON.stringify(job)) fail('conflicting duplicate job')
   rows.set(job.jobID,job)
  }
 }
 if (!rows.size) fail('listing has no verifiable roles')
 return rows
}
const snapshot = rows => JSON.stringify([...rows].sort(([a],[b]) => a.localeCompare(b)))
const hasForm = job => Array.isArray(job.fields) && ['resume','name','email'].every(key => job.fields.some(field => field.key === key && field.mandatory === true && field.hide !== true))
export const createSimplify3xSoftwareScraper = () => ({
 async run({fetchPage = defaultFetchPage, signal, now = () => new Date().toISOString()} = {}) {
  let pagesFetched = 0
  const get = async (url, allowedStatuses = [200]) => {
   signal?.throwIfAborted()
   const page = await fetchPage(url,{signal})
   signal?.throwIfAborted()
   pagesFetched++
   if (!allowedStatuses.includes(Number(page.status))) fail('HTTP ' + page.status + ' for ' + url)
   if (page.url !== url) fail('unexpected redirect for ' + url)
   return page
  }
  const home = await get(HOMEPAGE_URL)
  if (!hasOfficialHomepageSignal(home.html) || !brandLinks(home.html)
   || !/property=["']og:url["']\s+content=["']https:\/\/simplify3x\.com\/["']/i.test(home.html)) fail('homepage identity changed')
  if (!hasHandoff(home.html)) fail('homepage careers handoff changed')
  const life = await get(LIFE_PAGE_URL)
  if (!hasOfficialLifePageSignal(life.html) || !brandLinks(life.html)) fail('life page identity changed')
  if (!hasHandoff(life.html)) fail('life page careers handoff changed')
  const about = await get(ABOUT_URL)
  if (!/About Us - Simplify3x/.test(about.html) || !/Simplify3x Software Private/.test(about.html) || !brandLinks(about.html) || !hasHandoff(about.html)) fail('about page identity or handoff changed')
  const contact = await get(CONTACT_URL)
  if (!/Contact Us - Simplify3x/.test(contact.html) || !brandLinks(contact.html) || !hasHandoff(contact.html)) fail('contact identity or handoff changed')
  const shell = await get(CAREERS_URL)
  if (!/<title>hire3x<\/title>/i.test(shell.html) || !/canonical["']\s+href=["']https:\/\/hire3x\.com["']/i.test(shell.html)) fail('careers shell identity changed')
  const appPath = shell.html.match(/src=["'](\/js\/app\.[a-f0-9]+\.js)["']/)?.[1]
  if (!appPath) fail('published client application changed')
  const app = await get(new URL(appPath,CAREERS_URL).href)
  if (!app.html.includes('https://api-website.hire3x.com/') || !/getJobs:function/.test(app.html)
   || !/url:"careers\/jobs\/",method:"get",params:\{version:"v2"\}/.test(app.html)) fail('published client listing API changed')
  const chunk = app.html.match(/path:"\/careers",name:"Careers",component:\(\)=>\w+\.e\((\d+)\)/)?.[1]
  const hash = chunk && app.html.match(new RegExp(chunk+':"([a-f0-9]+)"'))?.[1]
  if (!chunk || !hash) fail('published careers client route changed')
  const client = await get('https://www.hire3x.com/js/'+chunk+'.'+hash+'.js')
  if (!client.html.includes('https://recruitment.hire3x.com/JobRegistration/')
   || !/getJobs\)\(\)/.test(client.html) || !/this\.jobData=\w+\.data\.data/.test(client.html)
   || !/filteredJobs/.test(client.html)) fail('published careers client rendering changed')
  const first = listingRows(parseJson(await get(LISTING_URL),'listing'))
  const jobs = []
  for (const row of first.values()) {
   const page = await get(DETAIL_BASE+row.jobID,[200,409])
   const body = parseJson(page,'detail')
   if (page.status === 409) {
    if (row.onHold === true && body?.type === 'Fail' && body?.data?.data === 'Job Not found') continue
    fail('active listing has no native detail')
   }
   const detail = body?.data
   if (body?.type !== 'Success') fail('native detail response changed')
   validateIdentity(detail)
   for (const key of ['jobID','licenseKey','customerID','customerName','title','description']) {
    if (detail[key] !== row[key]) fail('native detail identity or content mismatch: ' + key)
   }
   if (JSON.stringify(detail.location) !== JSON.stringify(row.location)) fail('native detail location mismatch')
   if (detail.closed !== false || row.onHold === true) fail('native active status disagrees with listing')
   if (!hasForm(detail)) fail('native application form is missing')
   if (row.licenseKey !== 'L071122A001') continue
   const geography = classifyLocation(detail.location)
   if (geography.nativeGeographyQualified && geography.country !== 'India') continue
   const description = normalizeWhitespace(detail.description)
   if (description.length < 100) fail('native detail description is incomplete')
   const availability = parseJson(await get(AVAILABILITY_BASE+row.jobID),'availability')
   if (availability?.type !== 'Success' || availability?.data?.JobID !== row.jobID || availability?.data?.customerID !== row.customerID) fail('application availability identity changed')
   const applyUrl = 'https://recruitment.hire3x.com/JobRegistration/'+row.jobID
   jobs.push({jobId:row.jobID,title:detail.title,company:COMPANY,companyName:COMPANY,source:SOURCE,
    ...geography,rawNativeWorkplaceEvidence:{source:SOURCE,jobId:row.jobID,sourceUrl:applyUrl,locations:[...detail.location]},description,
    jobUrl:applyUrl,applyUrl,link:applyUrl,sourceUrl:applyUrl,employmentType:detail.jobType,
    postedAt:detail.createdAt,sourceListingComplete:false,scrapedAt:now()})
  }
  const second = listingRows(parseJson(await get(LISTING_URL),'listing'))
  if (snapshot(first) !== snapshot(second)) fail('listing changed during detail verification')
  return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty:true,
   listingComplete:false,pagesFetched,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),
   reason:'Native same-license role observations only. Unqualified workplaces retain raw location evidence without public geography. The linked board mixes client assignments with a separate tenant containing dated recruitment drives; current full source coverage cannot be established.'})
 },
})
export const run = async (options = {}) => createSimplify3xSoftwareScraper().run(options)
if (process.argv[1] === fileURLToPath(import.meta.url)) {
 const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
 const jobs=await run()
 if(process.argv.includes('--dry-run')) saveToFile(jobs,path.join(currentDir,'jobs.json'))
 else await saveToDB(jobs,SOURCE)
}
