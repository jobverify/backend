import {createHash} from 'node:crypto'
import {fileURLToPath} from 'node:url'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {requireNativeHttpResponse} from '../../scraper-support/shared/nativeHttpResponse.js'
import {disposeResponseReader} from '../../scraper-support/shared/responseBodyDisposal.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const SOURCE = 'thoughtworks'
export const COMPANY = 'Thoughtworks'
export const CAREERS_URL = 'https://www.thoughtworks.com/careers/jobs'
export const API_URL = 'https://www.thoughtworks.com/rest/careersv2/jobs'
const JOB_PAGE = CAREERS_URL + '/job'
const EMBED_URL = 'https://jobs.ashbyhq.com/thoughtworks/embed?version=2'
const PROGRAMS = new Map([
  ['https://www.thoughtworks.com/etc.clientlibs/thoughtworks/clientlibs/clientlib-dependencies.min.ACSHASH98b303aa154c88d2e4ebb4d69e017a8c.js','df4a780e8c889b42d04a45e72b8677a2a72248769be85b4045fd7be115b0977f'],
  ['https://www.thoughtworks.com/etc.clientlibs/thoughtworks/clientlibs/clientlib-site.min.ACSHASHcd7ae47b40bfdf01d0e39d27f6ad6c0d.js','adbd6323eff4b93893a1440c51e91b1f32eea3d72cae6d701b93df3b905ba336'],
  ['https://www.thoughtworks.com/etc.clientlibs/thoughtworks/clientlibs/clientlib-base.min.ACSHASH54deaba82fce1c05c0585d5487b6e40d.js','149f0e7768819cdf7cab6a1ed8d0f50653acf4d768a9118db0f59340a022f575'],
])
const MAX_BYTES = 4 * 1024 * 1024
const norm = value => typeof value === 'string' ? value.replace(/\s+/g,' ').trim() : ''
const hash = value => createHash('sha256').update(value).digest('hex')
const stable = value => JSON.stringify(value,(_,item)=>item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.entries(item).sort(([a],[b])=>a.localeCompare(b))) : item)
const requireNative = (value,message) => { if (!value) throw Object.assign(new Error('Thoughtworks native: ' + message),{
  failureKind:'parser_or_contract_error',abortRetries:true,sourceScopeComplete:false,lifecycleCleanupAllowed:false,
}) }
const one = (values,label) => { requireNative(values.length === 1,'expected one active ' + label); return values[0] }
const executable = node => node.tag === 'script' && node.attrs.src && !Object.hasOwn(node.attrs,'nomodule')
  && ['', 'module','text/javascript','application/javascript'].includes((node.attrs.type || '').toLowerCase())
const scriptDeclarations = (doc,base) => doc.nodes(executable).map(node=>{
  let url
  try { url = new URL(node.attrs.src,base).href } catch { requireNative(false,'invalid declared program URL') }
  return {url,attrs:node.attrs}
})
const requiredPrograms = (doc,base) => {
  const scripts = scriptDeclarations(doc,base)
  requireNative([...PROGRAMS.keys()].every(url=>scripts.filter(script=>script.url===url).length===1), 'current declared program set changed')
  const nativeClients = scripts.filter(script=>/\/clientlib-(?:dependencies|site|base)\.min\./.test(script.url))
  requireNative(nativeClients.length===3 && nativeClients.every(script=>PROGRAMS.has(script.url)), 'unreviewed current producer program declaration')
  return scripts
}
const canonical = (doc,url) => {
  const node = one(doc.nodes(n=>n.tag==='link' && n.attrs.rel==='canonical'),'canonical identity')
  requireNative(node.attrs.href===url,'current canonical role/company identity changed')
  return node.attrs.href
}
const corporate = html => {
  const doc = readNativeDocument(html),owner = one(doc.nodes(n=>doc.hasClass(n,'cmp-job-search__container')),'jobs producer owner')
  requireNative(norm(one(doc.nodes(n=>n.tag==='title'),'corporate title').raw)==='Search jobs | Thoughtworks','corporate title identity changed')
  canonical(doc,CAREERS_URL)
  const attrs = owner.attrs
  requireNative(attrs['data-country-code']==='global' && attrs['data-runmode']==='publish'
    && attrs['data-jobs-url']===API_URL && attrs['data-job-page-path']===JOB_PAGE,'corporate producer endpoint or publish context changed')
  requireNative(Object.keys(attrs).sort().join('|')==='class|data-country-code|data-job-page-path|data-jobs-url|data-runmode','unreviewed corporate producer attributes')
  return {attrs,canonical:CAREERS_URL,programs:requiredPrograms(doc,CAREERS_URL)}
}
const record = value => value && typeof value==='object' && !Array.isArray(value)
const strings = value => Array.isArray(value) && value.length<=2000 && value.every(item=>typeof item==='string' && norm(item))
const stringMap = (value,arrays) => record(value) && Object.entries(value).every(([key,item])=>norm(key) && (arrays ? strings(item) : typeof item==='string' && norm(item)))
const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(value)
const nativeListing = payload => {
  requireNative(record(payload) && Object.keys(payload).sort().join('|')==='countriesLocationsMap|countryMapping|jobFunctionsRolesMap|jobs|locationTypes'
    && Array.isArray(payload.jobs) && payload.jobs.length<=2000 && stringMap(payload.countriesLocationsMap,true)
    && stringMap(payload.jobFunctionsRolesMap,true) && stringMap(payload.countryMapping,false) && strings(payload.locationTypes),'unreviewed native listing envelope/schema')
  const ids = new Set()
  for (const row of payload.jobs) {
    requireNative(record(row) && Object.keys(row).sort().join('|')==='country|jobFunctions|location|locationType|name|role|sourceSystemId|updatedAt'
      && uuid(row.sourceSystemId) && !ids.has(row.sourceSystemId),'duplicate or invalid native role identity/schema')
    ids.add(row.sourceSystemId)
    requireNative(['name','location','locationType','role','updatedAt'].every(key=>typeof row[key]==='string' && norm(row[key]))
      && (row.country===null || typeof row.country==='string') && strings(row.jobFunctions)
      && payload.locationTypes.includes(row.locationType),'invalid native role field types')
  }
  return payload.jobs
}
const publication = (raw,checkedAt) => {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(raw)
  requireNative(match,'invalid explicit native publication date')
  const [,month,day,year] = match.map(Number),date = new Date(Date.UTC(year,month-1,day))
  requireNative(year>=2000 && date.getUTCFullYear()===year && date.getUTCMonth()===month-1 && date.getUTCDate()===day
    && date.getTime()<=checkedAt,'invalid explicit native publication calendar/future date')
  return date.toISOString()
}
const assignedLocations = (row,payload) => {
  const locations = row.location.split(';').map(norm)
  requireNative(locations.length>0 && locations.every(Boolean) && new Set(locations).size===locations.length
    && payload.countryMapping.in==='India' && strings(payload.countriesLocationsMap.India)
    && locations.every(location=>payload.countriesLocationsMap.India.includes(norm(location.split(',')[0]))),'native India assigned-location/country mapping conflicts')
  return locations
}
const detailModel = (html,row,locations,checkedAt) => {
  const url = CAREERS_URL + '/' + row.sourceSystemId,doc = readNativeDocument(html,{sourceRanges:true})
  canonical(doc,url)
  const header = one(doc.nodes(n=>doc.hasClass(n,'cmp-job-details-header')),'role header')
  const title = doc.text(one(doc.nodes(n=>n.tag==='h1' && doc.hasClass(n,'cmp-job-details-header__content__title'),header),'role title'))
  requireNative(title===norm(row.name),'current detail title/listing identity conflicts')
  const subtitle = doc.text(one(doc.nodes(n=>doc.hasClass(n,'cmp-job-details-header__content__subtitle'),header),'role assigned subtitle'))
  const entries = doc.nodes(n=>doc.hasClass(n,'cmp-job-details__summary-item')).map(item=>{
    const label=one(doc.nodes(n=>doc.hasClass(n,'cmp-job-details__summary-label') && n.attrs.role==='term',item),'native metadata label')
    const value=one(doc.nodes(n=>doc.hasClass(n,'cmp-job-details__summary-value') && n.attrs.role==='definition',item),'native metadata value')
    return {label:doc.text(label),value:doc.text(value),html:html.slice(item.sourceStart,item.sourceEnd)}
  })
  const metadata = Object.fromEntries(entries.map(entry=>[entry.label,entry.value]))
  requireNative(entries.length===6 && Object.keys(metadata).sort().join('|')==='Country|Date Posted|Employment Type|Industry|Location|Location type'
    && entries.every(entry=>entry.label && entry.value),'native detail metadata schema changed')
  const primary = metadata.Location.split(';').map(norm)
  requireNative(row.country==='India' && metadata.Country==='India' && primary.every(location=>locations.includes(location))
    && subtitle===primary[0]+', India' && metadata['Location type']===row.locationType,'native detail country/assigned location/type conflicts')
  const date = publication(metadata['Date Posted'],checkedAt)
  const main = one(doc.nodes(n=>doc.hasClass(n,'cmp-job-details__main')),'authored criteria owner')
  requireNative(Number.isInteger(main.sourceOpenEnd) && Number.isInteger(main.sourceCloseStart),'unbounded native authored criteria')
  const criteria = html.slice(main.sourceOpenEnd,main.sourceCloseStart)
  requireNative(extractActiveDescription(criteria),'native authored criteria unavailable')
  const application = one(doc.nodes(n=>n.attrs.id==='apply-job'),'application navigation target')
  const applicationLocation = one(doc.nodes(n=>doc.hasClass(n,'cmp-job-application__iframe'),application),'native application country declaration')
  requireNative(applicationLocation.attrs['data-country']===metadata.Country,'native application country conflicts with role country')
  const embed = one(doc.nodes(n=>n.attrs.id==='ashby_embed',application),'same-role application identity declaration')
  requireNative(embed.attrs['data-jid']===row.sourceSystemId && doc.nodes(n=>n.tag==='a' && n.attrs.href==='#apply-job').length>0,'native role/application navigation identity conflicts')
  const inline = doc.nodes(n=>n.tag==='script' && !n.attrs.src,application).map(n=>n.raw||'')
  const embedScript = one(doc.nodes(n=>executable(n) && n.attrs.id==='ashby-script',application),'declared application embed program')
  // These two complete static programs configure source tracking/form-only mode
  // and defer the embed load. They are inspected as data, never executed.
  requireNative(embedScript.attrs.src===EMBED_URL && inline.length===2
    && hash(inline[0])==='de34d1e872b38e85a2de8627f38ad6db7ffe733257c8827326385bf1608d38dd'
    && hash(inline[1])==='d18a576f71549b49979bc69f3519e20ae0d06ab1eecbd852adc5bac3d66fe844','unreviewed native application embed declaration')
  // The fragment is a same-page navigation target, not a qualified application
  // form. Never fetch the embed or execute any of this publisher code.
  const proof = {url,title,subtitle,entries,criteria,applicationAttrs:application.attrs,applicationCountryAttrs:applicationLocation.attrs,embedAttrs:embed.attrs,
    embedDeclaration:{url:embedScript.attrs.src,inline},programs:requiredPrograms(doc,url)}
  return {proof,title,metadata,criteria,date,html,url,primaryLocations:primary}
}
const defaultFetchPage = (url,init) => fetch(url,init)

export const run = async ({fetchPage=defaultFetchPage,signal,now=()=>new Date().toISOString(),onRecords,onAudit}={}) => {
  signal?.throwIfAborted()
  const checkedAt = new Date(now()).getTime()
  requireNative(Number.isFinite(checkedAt),'invalid observation clock')
  let requests=0
  const request = async url => {
    signal?.throwIfAborted()
    const deadline = signal ? AbortSignal.any([signal,AbortSignal.timeout(25000)]) : AbortSignal.timeout(25000)
    try {
      const response = await fetchPage(url,{method:'GET',credentials:'omit',redirect:'error',signal:deadline,
        headers:{Accept:'application/json,text/html,application/javascript,*/*'}})
      signal?.throwIfAborted();deadline.throwIfAborted();requests++
      const wrapped = typeof response.body==='string' ? {status:response.status,url:response.url,headers:new Headers(response.headers),body:null,bodyUsed:true} : response
      await requireNativeHttpResponse(wrapped,url,{context:'Thoughtworks native HTTP',signal:deadline,callerSignal:signal??null})
      signal?.throwIfAborted();deadline.throwIfAborted()
      if (typeof response.body==='string') { requireNative(Buffer.byteLength(response.body)<=MAX_BYTES,'public response byte limit exceeded'); return response.body }
      const reader=response.body?.getReader(),chunks=[]
      requireNative(reader,'public response body reader unavailable')
      let bytes=0,complete=false
      try {
        while (true) {
          const part=await reader.read();signal?.throwIfAborted();deadline.throwIfAborted()
          if (part.done) break
          bytes+=part.value.byteLength;requireNative(bytes<=MAX_BYTES,'public response byte limit exceeded')
          chunks.push(Buffer.from(part.value))
        }
        complete=true
      } finally {
        try { await disposeResponseReader(reader,{signal:deadline,bestEffort:!complete}) }
        finally { reader.releaseLock() }
      }
      signal?.throwIfAborted();deadline.throwIfAborted()
      return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))
    } catch (error) { signal?.throwIfAborted();throw error }
  }
  const jsonAt = async () => {
    const body=await request(API_URL);signal?.throwIfAborted()
    try { return JSON.parse(body) } catch { requireNative(false,'invalid native JSON') }
  }
  const homeHTML=await request(CAREERS_URL),home=corporate(homeHTML)
  for (const [url,expected] of PROGRAMS) {
    const body=await request(url);signal?.throwIfAborted()
    requireNative(hash(body)===expected,'whole current producer program changed: '+url)
    if (url.includes('clientlib-site.min.')) requireNative(body.includes('fetch(e,{method:"GET",headers:{"Content-Type":"application/json"}})')
      && body.includes('t.allOpenJobs=t.jobResults=e.jobs') && body.includes('e.substring(0,e.lastIndexOf("/")+1).concat(t)'), 'current native GET/whole-array/UUID consumer program changed')
  }
  const payload=await jsonAt(),rows=nativeListing(payload),observations=[],opened=new Map(),jobs=[]
  const reasons=new Set(['browser-rendering-unqualified','native-legal-employer-unqualified','application-controls-unqualified','company-scope-unqualified'])
  for (const row of rows) {
    const observation={listingRecord:row,detailHTML:null,criteriaHTML:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
    observations.push(observation)
    if (row.country!=='India') {
      observation.holdReason='native-country-not-explicit-single-India'
      if (row.country===null || !norm(row.country) || /[;,/|]/.test(row.country)) reasons.add('native-country-unresolved:'+row.sourceSystemId)
      continue
    }
    const locations=assignedLocations(row,payload),model=detailModel(await request(CAREERS_URL+'/'+row.sourceSystemId),row,locations,checkedAt)
    opened.set(row.sourceSystemId,model)
    Object.assign(observation,{detailHTML:model.html,criteriaHTML:model.criteria,nativeMetadata:model.metadata,primaryLocations:model.primaryLocations})
    jobs.push({source:SOURCE,company:COMPANY,nativeEmployerBrand:COMPANY,jobId:row.sourceSystemId,requisitionId:row.sourceSystemId,
      title:model.title,country:'India',city:null,location:row.location,locations,sourceUrl:model.url,applyUrl:model.url+'#apply-job',link:model.url+'#apply-job',
      postingDate:model.date,closingDate:null,department:row.jobFunctions.join('; '),employmentType:model.metadata['Employment Type'],
      remoteStatus:null,experienceRequired:null,requiredSkills:[],minimumQualification:null,preferredQualification:null,
      jobDescription:model.criteria,sourceDescription:model.criteria,jobDescriptionHtml:model.criteria,
      sourceNativeRecord:row,sourceNativeDetail:{html:model.html,metadata:model.metadata,primaryLocations:model.primaryLocations},
      sourceNativePublication:{field:'Date Posted',raw:model.metadata['Date Posted'],value:model.date},
      sourceNativeEmployerEvidence:{brand:COMPANY,legalEmployer:null,source:CAREERS_URL,legalEmployerQualified:false},
      sourceNativeApplicationEvidence:{navigationTarget:'#apply-job',roleId:row.sourceSystemId,embedDeclaration:EMBED_URL,navigationOnly:true,applicationAuthority:false},
      sourceDetailComplete:false,sourceListingComplete:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:new Date(now()).toISOString()})
  }
  const closingPayload=await jsonAt(),closing=nativeListing(closingPayload)
  requireNative(stable(payload)===stable(closingPayload),'closing full raw native listing changed')
  const closingDetails=[]
  for (const row of rows.filter(row=>opened.has(row.sourceSystemId))) {
    const model=detailModel(await request(CAREERS_URL+'/'+row.sourceSystemId),row,assignedLocations(row,closingPayload),new Date(now()).getTime())
    requireNative(stable(model.proof)===stable(opened.get(row.sourceSystemId).proof),'closing native title/metadata/authored criteria/authority changed')
    closingDetails.push({sourceSystemId:row.sourceSystemId,html:model.html,criteriaHTML:model.criteria,metadata:model.metadata})
  }
  const closingHomeHTML=await request(CAREERS_URL),closingHome=corporate(closingHomeHTML)
  requireNative(stable(home)===stable(closingHome),'closing current corporate producer/program authority changed')
  signal?.throwIfAborted()
  attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,sourceScopeComplete:false})
  const audit={source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:rows.length,observedVacancyCount:rows.length,
    sourceScopeComplete:false,lifecycleCleanupAllowed:false,companyGlobalTotal:null,companyIndiaTotal:null,inventoryComplete:false,
    applicationAuthority:false,legalEmployerQualified:false,browserRenderingQualified:false,fullCriteriaQualified:false,
    observations,closingRecords:closing,openingPayload:payload,closingPayload,closingDetails,homeHTML,closingHomeHTML,
    producerPrograms:[...PROGRAMS].map(([url,sha256])=>({url,sha256})),producerProgramsReadAgainAtClosing:false,reasons:[...reasons]}
  Object.defineProperty(jobs,'nativeCollectionEvidence',{value:audit,configurable:true})
  if (typeof onRecords==='function') await onRecords(structuredClone(observations))
  signal?.throwIfAborted()
  if (typeof onAudit==='function') await onAudit(structuredClone(audit))
  signal?.throwIfAborted()
  return attachInventoryEvidence(jobs,{status:'discovery-only',surface:CAREERS_URL,firstParty:true,listingComplete:false,lifecycleCleanupAllowed:false,
    reportedTotal:null,indiaFacetCount:null,pagesFetched:requests,verifiedAt:now(),reason:'thoughtworks-current-native-partial:'+[...reasons].join(';')})
}

if (process.argv[1]===fileURLToPath(import.meta.url)) {
  const {saveToDB,saveToFile}=await import('../../scraper-support/utils/saveToDB.js')
  const jobs=await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs,fileURLToPath(new URL('./jobs.json',import.meta.url)))
  else await saveToDB(jobs,SOURCE)
}
