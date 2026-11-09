import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { activeHead, readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readVisibleNativeDocument } from '../../scraper-support/utils/visibleNativeHtml.js'
import { NISUM_CATALOG } from './catalog.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = NISUM_CATALOG
export const SOURCE = NISUM_CATALOG.source
export const COMPANY = NISUM_CATALOG.companyName
export const HOMEPAGE_URL = NISUM_CATALOG.homepageUrl
export const CAREERS_LANDING_URL = NISUM_CATALOG.officialCareersLandingUrl
export const INDIA_CAREERS_URL = NISUM_CATALOG.companyCareerPage
export const CEIPAL_WIDGET_SCRIPT_URL = NISUM_CATALOG.ceipalWidgetScriptUrl
// Historical widget identifiers are neither credentials nor current binding proof.
// Rediscover the public identifiers from the current official page in memory.
export const CEIPAL_API_KEY = null
export const CEIPAL_CAREER_PORTAL_ID = null
const WIDGET_HANDOFF_URL = 'https://careerapi.ceipal.com/careerPortalWidget/'
const APP_URL = 'https://jobsapi.ceipal.com/APISource/v3/js/app.min.js'
const norm = value => String(value ?? '').replace(/\s+/g, ' ').trim() || null
const numericEntities = value => String(value ?? '').replace(/&#(x[0-9a-f]+|\d+);/gi, (match, value) => {
  const code = value[0].toLowerCase() === 'x' ? parseInt(value.slice(1), 16) : Number(value)
  return code >= 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? match : '\ufffd'
})
const documentFor = value => readVisibleNativeDocument(numericEntities(value))
// Nisum uses CSS animation/transition selectors on html/body. The shared
// conservative stylesheet projection hides this entire corporate document.
// Binding inspects active native markup (excluding templates/hidden ancestors),
// while job-description visibility keeps the conservative stylesheet handling.
const bindingDocument = value => readNativeDocument(numericEntities(value))
const visibleText = html => {
  const doc = bindingDocument(html)
  return doc.text(doc.nodes(node => node.tag === 'root')[0])
}

export const readNisumDescription = value => {
  const doc = documentFor(value)
  const block = new Set(['p','div','section','article','h1','h2','h3','h4','h5','h6','ul','ol','li','br','tr'])
  const render = node => {
    if (typeof node === 'string') {
      const fragment = documentFor(node.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
      return fragment.text(fragment.nodes(child => child.tag === 'root')[0])
    }
    if (node.inert || ['script','style','title'].includes(node.tag)) return ''
    const text = node.children.map(render).join(' ')
    return block.has(node.tag) ? `\n${text}\n` : text
  }
  return render(doc.nodes(node => node.tag === 'root')[0]).split('\n').map(line => line.replace(/\s+/g,' ').trim()).filter(Boolean).join('\n') || null
}

export const normalizeNisumDate = value => {
  const text = norm(value)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text || '')) return null
  const date = new Date(`${text}T00:00:00Z`)
  return Number.isFinite(+date) && date.toISOString().slice(0,10) === text ? text : null
}
const workplace = value => value === 0 || value === '0' ? 'On-site' : value === 1 || value === '1' ? 'Remote' : value === 2 || value === '2' ? 'Hybrid' : null
const cleanNativeFields = value => {
  if (Array.isArray(value)) return value.map(cleanNativeFields)
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).filter(([key]) => !/^(?:api_?key|token|access_token|refresh_token|authorization|cookie|set-cookie)$/i.test(key)).map(([key,item]) => [key,cleanNativeFields(item)]))
}

// Inspection of legacy listing rows is deliberately partial. run() does not
// promote them to current full details or publishable jobs.
export const extractIndiaJobsFromJobPostingsPayload = (payload = {}, { scrapedAt = new Date().toISOString() } = {}) => {
  if (!Array.isArray(payload?.results)) throw new Error('Nisum CEIPAL job postings require a results array')
  return payload.results.filter(item => /^india$/i.test(norm(item?.country) || '')).map(item => {
    const location = norm(item.multpile_job_location)?.replace(/\)\s*,\s*\(/g,'; ').replace(/[()]/g,'')
      || norm([item.city,item.state,item.country].filter(Boolean).join(', '))
    const sourceUrl = norm(item.campus_portal_job_details_url), applyUrl = norm(item.apply_job)
    const html = norm(item.public_job_desc) ? item.public_job_desc : item.requistion_description
    return {
      title:norm(item.public_job_title || item.position_title),company:COMPANY,department:null,
      location,city:norm(item.city) || norm(location?.split(';')[0]?.split(',')[0]),state:norm(item.state),country:'India',
      workplaceType:workplace(item.remote_opportunities),jobId:norm(item.job_id),requisitionId:null,
      sourceUrl,applyUrl,link:applyUrl,employmentType:norm(item.tax_terms),experienceRequired:norm(item.experience),
      postingDate:null,originalPostingDate:null,nativeCreatedDate:norm(item.created),modifiedDate:norm(item.modified),
      closingDate:null,jobDescription:readNisumDescription(html),jobDescriptionHtml:typeof html === 'string' ? html : null,
      nativePostingFields:cleanNativeFields(item),jobCode:norm(item.job_code),requiredSkills:[],source:SOURCE,scrapedAt,
      sourceListingComplete:false,sourceDetailComplete:false,
    }
  }).filter(job => job.title && job.jobId)
}

export const buildWidgetUrl = ({ apiKey,careerPortalId }) => `https://jobsapi.ceipal.com/APISource/v3/index.html?api_key=${encodeURIComponent(apiKey)}&cp_id=${encodeURIComponent(careerPortalId)}`
export const buildJobPostingsApiUrl = ({ apiKey,page = 1 }) => `https://careerapi.ceipal.com/${encodeURIComponent(apiKey)}/CareerPortalJobPostings/?page=${page}`
export const buildJobPostingsPayload = ({ apiKey,careerPortalId,page = 1 }) => ({page:String(page),api_key:apiKey,method:'CareerPortalJobPostings',cp_id:careerPortalId,from_career_portal:'1'})
export const safeNisumUrl = value => {
  try {
    const url = new URL(value)
    if (url.hostname === 'careerapi.ceipal.com' && url.pathname !== '/careerPortalWidget/') url.pathname = url.pathname.replace(/^\/[^/]+\//,'/[public-widget-id]/')
    for (const key of [...url.searchParams.keys()]) url.searchParams.set(key,'[redacted]')
    url.username='';url.password='';url.hash=''
    return url.toString()
  } catch { return null }
}
export const hasOfficialHomepageSignal = html => /building success together/i.test(visibleText(html)) && bindingDocument(html).nodes(node => node.tag === 'a' && ['https://www.nisum.com/careers','/careers'].includes(node.attrs.href)).length > 0
export const hasCareersLandingSignal = html => /where do you want to start your career/i.test(visibleText(html)) && bindingDocument(html).nodes(node => node.tag === 'a' && ['https://www.nisum.com/careers/careers-india','/careers/careers-india'].includes(node.attrs.href)).length > 0
export const extractWidgetConfig = html => {
  const scripts = bindingDocument(html).nodes(node => node.tag === 'script' && node.attrs.src === CEIPAL_WIDGET_SCRIPT_URL)
  if (scripts.length !== 1) return null
  const apiKey=norm(scripts[0].attrs['data-ceipal-api-key']),careerPortalId=norm(scripts[0].attrs['data-ceipal-career-portal-id'])
  return apiKey && careerPortalId ? {apiKey,careerPortalId} : null
}
export const hasIndiaCareersSignal = html => activeHead(numericEntities(html)).titles.some(title => /^Careers India\s*\|\s*Nisum$/i.test(title))
  && /careers in india/i.test(visibleText(html)) && bindingDocument(html).nodes(node => node.attrs.id === 'current-openings').length === 1 && Boolean(extractWidgetConfig(html))

const defaultFetchPage = async (url,options = {}) => {
  const response = await fetch(url,{method:options.method || 'GET',headers:options.headers,body:options.body,redirect:'manual',
    signal:AbortSignal.any([...(options.signal ? [options.signal] : []),AbortSignal.timeout(30000)])})
  return {status:response.status,url:response.url,text:await response.text()}
}
const frameFrom = (html,config) => {
  const frames = documentFor(html).frames().filter(node => node.attrs.id === 'careers_api_source' && !Object.hasOwn(node.attrs,'srcdoc'))
  if (frames.length !== 1) return null
  try {
    const url = new URL(frames[0].attrs.src)
    return url.origin === 'https://jobsapi.ceipal.com' && url.pathname === '/APISource/v3/index.html'
      && url.searchParams.getAll('api_key').length === 1 && url.searchParams.get('api_key') === config.apiKey
      && url.searchParams.getAll('cp_id').length === 1 && url.searchParams.get('cp_id') === config.careerPortalId
      && !url.username && !url.password && !url.searchParams.get('job_id') ? url.toString() : null
  } catch { return null }
}

// Current public browser evidence stops at an explicit listing bot denial.
// No native inventory or detail payload has been verified under that contract.
// This guard cannot establish absence or authorize retiring unseen jobs.
export const createNisumScraper = (defaults = {}) => ({
  async run(options = {}) {
    const settings={...defaults,...options},now=settings.now || (() => new Date().toISOString())
    const fetchPage=settings.fetchPage || (settings.fetchText ? async (url,init) => ({status:200,url,text:await settings.fetchText(url,init)}) : defaultFetchPage)
    const sleep=settings.sleep || (ms => new Promise(resolve => setTimeout(resolve,ms)))
    const evidence={source:SOURCE,partial:true,sourceExtractionImplemented:false,firstPartyVerified:false,
      nativeGlobalCount:null,nativeIndiaCount:null,fullDescriptionCount:null,eligibleCount:null,unknownCount:null,
      listingComplete:false,closingInventoryVerified:false,requests:[],issues:[],observedAt:now()}
    const finish = reason => {
      evidence.issues.push(reason)
      settings.onSourceEvidence?.(evidence)
      return attachInventoryEvidence([],{status:'coverage-gap',surface:INDIA_CAREERS_URL,firstParty:evidence.firstPartyVerified,
        listingComplete:false,pagesFetched:0,reportedTotal:null,indiaFacetCount:null,verifiedAt:now(),reason:`${reason};native-closing-state-unverified`})
    }
    let stoppedReason=null
    const lastAt=new Map()
    const read = async (url,init = {}) => {
      settings.signal?.throwIfAborted()
      const host=new URL(url).hostname,delay=Math.max(0,1000-(Date.now()-(lastAt.get(host)||0)))
      if (delay) await sleep(delay)
      settings.signal?.throwIfAborted();lastAt.set(host,Date.now())
      let page
      try { page=await fetchPage(url,{...init,signal:settings.signal}) } catch {
        settings.signal?.throwIfAborted();stoppedReason='public-request-unavailable';return null
      }
      settings.signal?.throwIfAborted()
      evidence.requests.push({url:safeNisumUrl(url),status:page?.status ?? null,method:init.method || 'GET'})
      if ([401,403,429].includes(page?.status)) {stoppedReason=`public-access-denied-${page.status}`;return null}
      if (!page || typeof page.text !== 'string' || page.url !== url) {stoppedReason='public-response-or-identity-unverified';return null}
      return page
    }
    let config
    for (const [url,check] of [[HOMEPAGE_URL,hasOfficialHomepageSignal],[CAREERS_LANDING_URL,hasCareersLandingSignal],[INDIA_CAREERS_URL,hasIndiaCareersSignal]]) {
      const page=await read(url)
      if (!page) return finish(stoppedReason)
      if (page.status !== 200 || !check(page.text)) return finish('first-party-careers-binding-unverified')
      if (url === INDIA_CAREERS_URL) config=extractWidgetConfig(page.text)
    }
    evidence.firstPartyVerified=true
    const widget=await read(CEIPAL_WIDGET_SCRIPT_URL)
    if (!widget) return finish(stoppedReason)
    if (widget.status !== 200 || !widget.text.includes('https://careerapi.ceipal.com/') || !widget.text.includes('careerPortalWidget/')
      || !widget.text.includes('X-Referer-Host') || !widget.text.includes('https://jobsapi.ceipal.com/')) return finish('current-widget-contract-unverified')
    const handoffUrl=new URL(WIDGET_HANDOFF_URL)
    for (const [key,value] of Object.entries({themeid:'',bgcolor:'',job_id:'',apikey:config.apiKey,cp_id:config.careerPortalId})) handoffUrl.searchParams.set(key,value)
    const handoff=await read(handoffUrl.toString(),{headers:{'X-Referer-Host':'https://jobsapi.ceipal.com/'}})
    if (!handoff) return finish(stoppedReason)
    let frame
    try { frame=handoff.status === 200 && frameFrom(JSON.parse(handoff.text).html,config) } catch { /* Unverified contract. */ }
    if (!frame) return finish('current-public-iframe-binding-unverified')
    const client=await read(frame)
    if (!client) return finish(stoppedReason)
    if (client.status !== 200 || !documentFor(client.text).nodes(node => node.tag === 'script' && node.attrs.src === 'js/app.min.js').length) return finish('current-public-client-unverified')
    const app=await read(APP_URL)
    if (!app) return finish(stoppedReason)
    if (app.status !== 200 || !app.text.includes('https://careerapi.ceipal.com/') || !/CareerPortalJobPostings\/\?page=/.test(app.text)
      || !/type:\s*["']POST["']/.test(app.text) || !/fdata\.append\(['"]from_career_portal['"],\s*1\)/.test(app.text)) return finish('current-readonly-listing-contract-unverified')
    const body=new FormData()
    for (const [key,value] of Object.entries(buildJobPostingsPayload(config))) body.append(key,value)
    const listing=await read(buildJobPostingsApiUrl(config),{method:'POST',body})
    if (!listing) return finish(stoppedReason)
    let payload
    try {payload=JSON.parse(listing.text)} catch {return finish('native-public-listing-contract-unverified')}
    if (/bot access is not allowed/i.test(payload?.message || '')) return finish('native-bot-access-denied')
    if (/not allowed from outside of the Career Portal/i.test(payload?.message || '')) return finish('native-public-client-context-denied')
    if (listing.status !== 200) return finish(`native-listing-http-${listing.status}`)
    return finish('native-detail-and-inventory-unverified')
  },
})
export const run = async (options = {}) => createNisumScraper().run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB,saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs,path.join(currentDir,'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
