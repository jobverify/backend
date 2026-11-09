import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'
import { attachInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { MAVEN_WAVE_PARTNERS_CATALOG } from './catalog.js'
const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const PROVIDER_METADATA = MAVEN_WAVE_PARTNERS_CATALOG
export const SOURCE = PROVIDER_METADATA.source
export const HOMEPAGE_URL = PROVIDER_METADATA.homepageUrl
export const CAREERS_URL = 'https://jobs.jobvite.com/maven-wave-partners/jobs'
export const ALERTS_URL = 'https://jobs.jobvite.com/maven-wave-partners/jobAlerts'
const USER_AGENT = 'Mozilla/5.0'
const normalizeWhitespace = value => String(value ?? '').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim()
const failure = (message,code='MAVEN_WAVE_SURFACE_CHANGED') => Object.assign(new Error('Maven Wave '+message),{code,softFailure:true,abortRetries:true,failureKind:'surface_drift_or_fail_closed'})
export const hasVerifiedHomepageRedirectSignal = html => /Atos/.test(normalizeWhitespace(html)) && /accelerate intelligence/i.test(normalizeWhitespace(html))
export const hasJobAlertsSignal = html => { const text=normalizeWhitespace(html); return text.includes('Maven Wave Partners Careers') && text.includes('Get notified about new jobs that match your skills') && text.includes('Select Job Locations') && text.includes('Chandigarh') && text.includes('Gurgaon') && text.includes('India') }
const stripHtmlComments = html => String(html ?? '').replace(/<!--[\s\S]*?-->/g, '')
const assertTenantIdentity = html => {
  const page = stripHtmlComments(html)
  const title = page.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]
  const headings = [...page.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)]
  const scripts = [...page.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)]
    .map(([,script]) => script.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, ''))
  const configs = scripts.flatMap(script => [...script.matchAll(/\.constant\(\s*['"]preloadedData['"]/g)])
  const published = scripts.map(script => script.match(/angular\.module\(\s*'preloadedData',\s*\[\]\s*\)\.constant\(\s*'preloadedData',\s*\{([\s\S]*?)\}\s*\)\.constant\(\s*'i18n'/)?.[1]).filter(Boolean)
  const field = name => [...(published[0] ?? '').matchAll(new RegExp('\\b'+name+':\\s*([\"\'])([^\"\']*)\\1','g'))].map(match => match[2])
  const sameField = (name, expected) => { const values = field(name); return values.length === 1 && values[0] === expected }
  if (normalizeWhitespace(title) !== 'Maven Wave Partners Careers'
    || headings.length !== 1 || normalizeWhitespace(headings[0][1]) !== 'Maven Wave Partners Careers'
    || configs.length !== 1 || published.length !== 1
    || !sameField('companyEId', 'qWH9Vfwr')
    || !sameField('baseUrl', '/maven-wave-partners')
    || !sameField('careersiteName', 'maven-wave-partners')
    || !normalizeWhitespace(page).includes('Powered by Jobvite')) {
    throw failure('Jobvite employer identity no longer matches the verified tenant')
  }
}
const assertHandoff = html => {
  const targets=[...html.matchAll(/href=["']([^"']+)["']/gi)].map(([,href])=>{try{return new URL(href,ALERTS_URL)}catch{return null}}).filter(url=>url?.pathname.endsWith('/jobs'))
  if(!targets.length || targets.some(url=>url.href!==CAREERS_URL || url.username || url.password)) throw failure('current-openings handoff no longer matches the trusted Jobvite board')
}
const assertEmptyInventory = html => {
  const page = stripHtmlComments(html).replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '')
  const body = page.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[0]
  const articles = [...(body ?? '').matchAll(/<article\b[^>]*class=["'][^"']*\bjv-page-body\b[^"']*["'][^>]*>([\s\S]*?)<\/article>/gi)]
  const main = articles.length === 1 ? articles[0][1] : null
  const paragraphs = [...(main ?? '').matchAll(/<p\s+class=(["'])jv-text-center\1\s*>([\s\S]*?)<\/p>/gi)]
  const empty = paragraphs.filter(match => normalizeWhitespace(match[2]) === 'There are currently no open jobs.').length === 1
  const roles = /<a\b[^>]*href=["'][^"']*\/job\//i.test(page) || /jv-job-list|JobPosting/i.test(page)
  const inventoryPrefix = body?.slice(0, body.indexOf(articles[0]?.[0] ?? '') + (articles[0]?.[0].length ?? 0)) ?? ''
  const hidden = /<[^>]*\shidden(?:\s|=|>)/i.test(inventoryPrefix)
    || /<[^>]*\saria-hidden\s*=\s*["']true["']/i.test(inventoryPrefix)
    || /<[^>]*\sstyle\s*=\s*["'][^"']*(?:display\s*:\s*none|visibility\s*:\s*hidden)/i.test(inventoryPrefix)
  if (!body || !/<body[^>]*class=["'][^"']*\bjv-page-jobs\b[^"']*["']/i.test(body)
    || !main || !/<h2[^>]*>\s*Open Positions\s*<\/h2>/i.test(main) || !empty || roles || hidden) {
    throw failure('current inventory is not verified-empty; current roles or incomplete markup require re-verification')
  }
}
const guardedFetch = fetchImpl => async(url,options={}) => {
  if(![ALERTS_URL,CAREERS_URL].includes(String(url))) throw failure('request identity does not match the trusted board')
  const response=await fetchImpl(url,{...options,redirect:'manual'})
  if(response.status>=300 && response.status<400) throw failure('Jobvite redirect requires re-verification')
  if(response.url!==String(url)) throw failure('Jobvite response identity does not match the requested board')
  return response
}
export const createMavenWavePartnersScraper = () => ({
  async run({fetchText,fetchImpl,signal}={}) {
    signal?.throwIfAborted()
    const getText=fetchImpl || !fetchText ? url=>fetchTextWithRetry(url,{fetchImpl:guardedFetch(fetchImpl??globalThis.fetch),signal,headers:{'User-Agent':USER_AGENT,Accept:'text/html'},label:SOURCE,timeoutMs:15000}) : fetchText
    const alerts=await getText(ALERTS_URL); signal?.throwIfAborted()
    assertTenantIdentity(alerts)
    if(!hasJobAlertsSignal(alerts)) throw failure('Jobvite alerts identity no longer matches the verified source')
    assertHandoff(alerts)
    const openings=await getText(CAREERS_URL);signal?.throwIfAborted()
    assertTenantIdentity(openings)
    assertEmptyInventory(openings)
    return attachInventoryEvidence([],{status:'verified-empty',surface:CAREERS_URL,firstParty:true,listingComplete:true,pagesFetched:1,reportedTotal:0,indiaFacetCount:0,verifiedAt:new Date().toISOString(),reason:'The linked branded unfiltered Jobvite board explicitly reports no open jobs.'})
  }
})
export const run = async(options={}) => createMavenWavePartnersScraper().run(options)
if(process.argv[1]===fileURLToPath(import.meta.url)) {
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if(process.argv.includes('--dry-run')) saveToFile(jobs,path.join(currentDir,'jobs.json'))
  else await saveToDB(jobs,SOURCE)
}
