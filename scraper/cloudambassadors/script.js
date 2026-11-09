import {readRoles,advertisedAssets,rendererProof,evaluateRendering,finish,nativeFetch} from './native.js'
import {runCurrentCloudAmbassadors} from './currentReader.js'
import {transport,cap,budget} from './currentTransport.js'
import {need} from './currentErrors.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence,readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parse } from 'acorn'

import { fetchTextWithRetry } from '../../scraper-support/utils/fetch.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'cloudambassadors'
export const CAREERS_URL = 'https://cloudambassadors.com/careers'
export const APPLICATION_URL = 'https://cloudambassadors.com/careers/apply'

const normalizeWhitespace = (value) => {
  const normalized = String(value ?? '')
    .replace(/<!--[^]*?-->/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return normalized || null
}

const toJobId = (title) => normalizeWhitespace(title)
  ?.toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')

const extractOpenRolesSection = (html) => {
  const text = String(html ?? '')
  const openRolesIndex = text.search(/>\s*Open Roles\s*</i)
  if (openRolesIndex < 0) return ''

  const sectionEnd = text.indexOf('</section>', openRolesIndex)
  return text.slice(openRolesIndex, sectionEnd < 0 ? undefined : sectionEnd)
}

export const hasSharedApplicationSignal = (html) => {
  const text = normalizeWhitespace(html) || ''

  return /<title>\s*Cloud Ambassadors[^<]*Maximizing Cloud Impact\s*<\/title>/i.test(String(html ?? ''))
    && /Role &amp; Experience/i.test(String(html ?? ''))
    && /\bLocation\b/i.test(text)
    && /\bEmail\b/i.test(text)
}

export const extractCareerListings = readRoles

const defaultFetchText = nativeFetch

// Read literal employer data, never evaluate a downloaded application bundle.
export const extractStaticRoleDescriptions = (javascript, jobs) => {
  if (typeof javascript !== 'string' || javascript.length > 1500000 || !jobs.length) return null
  let ast
  try { ast = parse(javascript, { ecmaVersion: 'latest', sourceType: 'script' }) } catch { return null }
  const expected = new Set(jobs.map(job => job.title)), matches = [], pending = [ast]
  const string = node => node?.type === 'Literal' && typeof node.value === 'string' ? node.value : null
  while (pending.length) {
    const node = pending.pop()
    if (node.type === 'ArrayExpression' && node.elements.length === expected.size) {
      const roles = node.elements.map(element => {
        if (element?.type !== 'ObjectExpression' || element.properties.length !== 4) return null
        const values = new Map()
        for (const property of element.properties) {
          if (property.type !== 'Property' || property.computed || property.method || property.kind !== 'init') return null
          const key = property.key.type === 'Identifier' ? property.key.name : string(property.key)
          if (!['name', 'title', 'bio', 'arr'].includes(key) || values.has(key)) return null
          values.set(key, property.value)
        }
        const name = string(values.get('name')), title = string(values.get('title')), bio = string(values.get('bio'))
        const requirements = values.get('arr')
        if (!expected.has(name) || !title || !bio || bio.length < 80 || requirements?.type !== 'ArrayExpression'
          || !requirements.elements.length || requirements.elements.length > 50) return null
        const items = requirements.elements.map(string)
        if (items.some(item => !item?.trim())) return null
        return { title: name, description: [title, bio, ...items].join('\n\n'), nativeFields:{name,title,bio,arr:items} }
      })
      if (roles.every(Boolean) && new Set(roles.map(role => role.title)).size === expected.size) matches.push(roles)
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) {
        for (const child of value) if (child?.type) pending.push(child)
      } else if (value?.type) pending.push(value)
    }
  }
  return matches.length === 1 ? matches[0] : null
}

export const linkedCareerAssets = advertisedAssets

const defaultFetchAsset = (url,{signal})=>nativeFetch(url,{signal,metadata:true})

const createLegacyCloudAmbassadorsScraper = () => ({
 async run({fetchText=defaultFetchText,fetchAsset=defaultFetchAsset,signal,detailEnrichmentBudgetMs=45000,now=()=>new Date().toISOString()}={}){
  signal?.throwIfAborted();const careersHtml=await fetchText(CAREERS_URL,{signal}),jobs=readRoles(careersHtml),rawCandidates=jobs.nativeRoleCandidates,assets=advertisedAssets(careersHtml),candidates=[],failures=[]
  if(jobs.some(job=>job.applyUrl)){const application=await fetchText(APPLICATION_URL,{signal});if(!hasSharedApplicationSignal(application))throw Object.assign(Error('Cloud Ambassadors native application landing changed'),{abortRetries:true})}
  const requested=Number(detailEnrichmentBudgetMs),budget=Number.isFinite(requested)?Math.max(0,Math.min(120000,requested)):45000,controller=new AbortController(),assetSignal=signal?AbortSignal.any([signal,controller.signal]):controller.signal,timer=budget>0?setTimeout(()=>controller.abort(),budget):null
  let acquiredAssets=0
  try{if(budget>0)for(const url of assets){if(assetSignal.aborted)break;try{const response=await fetchAsset(url,{signal:assetSignal});signal?.throwIfAborted();assetSignal.throwIfAborted();if(response?.status!==200||response?.url!==url){failures.push({kind:'native-role-client-unavailable',url,status:response?.status??null});break}acquiredAssets++;const roles=extractStaticRoleDescriptions(response.html,rawCandidates);if(roles)candidates.push({url,roles,proof:rendererProof(response.html)})}catch(error){signal?.throwIfAborted();failures.push({kind:error.code||'native-role-client-unavailable',url,status:error.status??null,message:error.message});break}}}finally{if(timer)clearTimeout(timer)}
  signal?.throwIfAborted();const candidate=candidates.length===1?candidates[0]:null,roles=new Map((candidate?.roles||[]).map(role=>[role.title,role])),rendering=evaluateRendering(careersHtml,jobs,candidate?.proof),result=jobs.filter(job=>rendering.visible.has(job.title)).map(job=>{const role=roles.get(job.title),qualified=Boolean(role)&&rendering.qualified.has(job.title);return {...job,jobDescription:qualified?role.description:null,sourceDescription:qualified?role.description:null,source:SOURCE,link:job.applyUrl||job.sourceUrl,scrapedAt:now(),rawNativeRoleEvidence:{...job.rawNativeRoleEvidence,nativeRendererQualified:qualified,renderingQualification:rendering.reason,nativeDescriptionClient:candidate?.url||null,nativeDescriptionFields:role?.nativeFields||null,unqualifiedNativeDescription:qualified?null:role?.description||null,jobSpecificApplicationIdentityQualified:false}}})
  return finish(result,{recordKind:result.length===rawCandidates.length?'vacancy-rows':result.length?'mixed':'hiring-signals',observedRecordCount:rawCandidates.length,observedVacancyCount:result.length,unqualifiedRoleCandidates:rawCandidates.filter(row=>!result.some(job=>job.title===row.title&&job.jobDescription)).map(row=>({...row,description:roles.get(row.title)?.description||null,renderingQualified:false})),nativeDiscoveryFailures:failures,pagesFetched:1+(jobs.some(job=>job.applyUrl)?1:0)+acquiredAssets,now})
 }
})

export const createCloudAmbassadorsScraper=()=>({
 async run(options={}){
  const maxJobs=cap(options.maxJobs,'job cap'),maxPages=cap(options.maxPages,'page cap')
  if(maxJobs===0||maxPages===0||options.fetchResponse||options.fetchImpl||!options.fetchText)return runCurrentCloudAmbassadors(options)
  for(const k of ['onAudit','onRecords'])if(options[k]!==undefined&&typeof options[k]!=='function')throw TypeError('Cloud Ambassadors invalid '+k)
  const io=transport(options),{control}=io;let total=0
  try{
   control.check();const readMs=budget(options.readTimeoutMs,15000,'read timeout'),bounded=read=>async(url,init={})=>control.gate(async()=>{const value=await read(url,{...init,signal:control.signal});control.check();const text=typeof value==='string'?value:value?.html;need(typeof text==='string'&&Buffer.byteLength(text)<=4*1024*1024,'invalid or oversized legacy text');total+=Buffer.byteLength(text);need(total<=32*1024*1024,'legacy aggregate text limit exceeded');return value},readMs,'legacy read/body')
   const jobs=await createLegacyCloudAmbassadorsScraper().run({...options,signal:control.signal,fetchText:bounded(options.fetchText),fetchAsset:bounded(options.fetchAsset||defaultFetchAsset)});control.check()
   if(options.onAudit)await io.observe(()=>options.onAudit(structuredClone({source:SOURCE,records:jobs,legacyTextOnly:true,wholeNativeModelsClosingReconciled:false,qualifiedIndiaRecords:0,sourceScopeComplete:false,lifecycleCleanupAllowed:false})))
   if(options.onRecords)await io.observe(()=>options.onRecords(structuredClone(jobs)));control.check()
   const out=attachInventoryEvidence(jobs.slice(0,maxJobs),readInventoryEvidence(jobs));Object.defineProperty(out,'nativeCollectionEvidence',{value:structuredClone(jobs.nativeCollectionEvidence)});return attachSourceObservationEvidence(out,readSourceObservationEvidence(jobs,SOURCE))
  }catch(e){throw control.fail(e)}finally{control.dispose()}
 }
})

export const run = async (options = {}) => createCloudAmbassadorsScraper().run(options)

export const runStandalone = async ({
  argv = process.argv,
  fetchText,
  saveToFile,
  saveToDB,
} = {}) => {
  const jobs = await createCloudAmbassadorsScraper().run(fetchText===undefined?{}:{fetchText})

  if (argv.includes('--dry-run')) {
    const writeJobsToFile = saveToFile
      ?? (await import('../../scraper-support/utils/saveToDB.js')).saveToFile
    writeJobsToFile(jobs, path.join(currentDir, 'jobs.json'))
    return jobs
  }

  const persistJobsToDb = saveToDB
    ?? (await import('../../scraper-support/utils/saveToDB.js')).saveToDB
  await persistJobsToDb(jobs, SOURCE)
  return jobs
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await runStandalone()
}
