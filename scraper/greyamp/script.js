import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {createHash} from 'node:crypto'
import {document,norm} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {activeHead,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {isNativeBareCityInPublicScope} from '../../scraper-support/shared/nativeCityScope.js'
import {getValidIndiaCityForJob,isJobInPublicLocationScope} from '../../src/utils/publicJobLocationScope.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = 'greyamp'
export const COMPANY = 'Greyamp'
export const FIRST_PARTY_CAREERS_URL = 'https://www.greyamp.com/careers'

export const NATIVE_API_URL='https://www.greyamp.com/api/job-openings'
const CLIENT_URL='https://www.greyamp.com/_next/static/chunks/2rrquw9a_28mi.js'
const CLIENT_SHA256='04672a075565f5936087599dc1e72271425079dff8edbd9c1e4c7549e048593f'
const foreignState=/(?:^|,)\s*(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming|Ontario|British Columbia|Alberta|Manitoba|Saskatchewan|Quebec|Nova Scotia|New Brunswick|Newfoundland|Queensland|Victoria|New South Wales|Tasmania|Western Australia|South Australia|CA|NY|NJ|TX|WA|MA|IL|FL|AZ|CO|CT|MD|MI|NC|NH|NV|OH|PA|RI|SC|VA|VT|WI|DC)(?:\s+\d{5}(?:-\d{4})?)?\s*(?:,|$)/i
const check=(ok,message)=>{if(!ok)throw Error('Greyamp: '+message)}
const activeDocument=html=>{
  const doc=document(html)
  const prune=(node,inherited=false)=>{
    node.inactive ||= inherited||/(?:^|;)\s*content-visibility\s*:\s*hidden\s*(?:!important\s*)?(?:;|$)/i.test(node.attrs?.style||'')
    node.children.filter(c=>typeof c!=='string').forEach(child=>prune(child,node.inactive))
  }
  prune(doc.root);return doc
}
const prose=(html,title)=>{
  if(typeof html!=='string')return null
  const doc=activeDocument(html),value=extractActiveDescription(doc.text(doc.root))
  const stripped=activeDocument(html.replace(/<(h[1-6]|strong|b)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,''))
  const core=extractActiveDescription(stripped.text(stripped.root))
  const key=value=>norm(value).toLowerCase().replace(/[^\p{L}\p{N}]/gu,'')
  return value&&core&&key(core)!==key(title)&&!/^(?:JD|job description|responsibilities|requirements)\s*[:.!]*$/i.test(core)?value:null
}
export const inspectInventory=async({fetchImpl=fetch,signal,timeoutMs=45000,now=()=>new Date().toISOString()}={})=>{
  signal?.throwIfAborted()
  check(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=120000,'invalid aggregate timeout')
  const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal
  const deadline=performance.now()+timeoutMs
  const checkBudget=()=>{
    if(!combined.aborted&&performance.now()>=deadline)controller.abort(Error('Greyamp aggregate fetch/body/parsing deadline exceeded'))
    combined.throwIfAborted()
  }
  let listener,timer,pagesFetched=0
  const stopped=new Promise((_,reject)=>{
    listener=()=>reject(combined.reason);combined.addEventListener('abort',listener,{once:true})
    timer=setTimeout(()=>controller.abort(Error('Greyamp aggregate deadline exceeded')),timeoutMs)
  })
  const collect=async()=>{
    const read=async url=>{
      checkBudget()
      const response=await fetchImpl(url,{signal:combined,redirect:'error',headers:{Accept:'text/html,application/json','User-Agent':'Mozilla/5.0'}})
      const cancelBody=reason=>{void Promise.resolve().then(()=>response?.body?.cancel?.(reason)).catch(()=>{})}
      try{checkBudget()}catch(error){cancelBody(error);throw error}
      if(response?.status!==200||response.url!==url){const error=Error('Greyamp: native HTTP status or identity redirect changed');cancelBody(error);throw error}
      if(!response.body?.getReader){const error=Error('Greyamp: bounded native source stream unavailable');cancelBody(error);throw error}
      const reader=response.body.getReader(),chunks=[];let bytes=0
      const cancel=()=>{void reader.cancel(combined.reason).catch(()=>{})}
      combined.addEventListener('abort',cancel,{once:true})
      let body
      try{
        while(true){
          checkBudget();const {done,value}=await reader.read();checkBudget()
          if(done)break
          bytes+=value.byteLength
          if(bytes>5000000){void reader.cancel().catch(()=>{});throw Error('Greyamp: native streamed body exceeds byte limit')}
          chunks.push(Buffer.from(value))
        }
        body=Buffer.concat(chunks).toString('utf8')
      }finally{combined.removeEventListener('abort',cancel);reader.releaseLock()}
      checkBudget()
      check(typeof body==='string'&&body.trim()&&Buffer.byteLength(body)<=5000000,'native body missing or oversized')
      pagesFetched++;return body
    }
    const official=await read(FIRST_PARTY_CAREERS_URL),head=activeHead(official),doc=activeDocument(official)
    check(head.titles.length===1&&head.titles[0]==='Greyamp'&&doc.nodes(n=>n.tag==='h2'&&doc.text(n)==='Open Positions').length===1,'official careers identity changed')
    check(doc.nodes(n=>n.tag==='script'&&new URL(n.attrs.src||'/',FIRST_PARTY_CAREERS_URL).href===CLIENT_URL).length===1,'reviewed official inventory client no longer linked')
    const client=await read(CLIENT_URL)
    check(createHash('sha256').update(client).digest('hex')===CLIENT_SHA256,'unreviewed inventory pagination contract')
    const rows=JSON.parse(await read(NATIVE_API_URL))
    check(Array.isArray(rows)&&rows.length<=5000,'invalid native whole-array inventory')
    const keys=new Set(['_id','title','level','experience','location','type','skills','description','applyLink','roleOverview','keyResponsibilities','sortOrder'])
    const ids=new Set(),jobs=[]
    for(const row of rows){
      check(row&&Object.keys(row).every(key=>keys.has(key)),'unreviewed native schema or additional geographic scope')
      check(typeof row._id==='string'&&/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(row._id)&&!ids.has(row._id),'invalid or duplicate native identity')
      ids.add(row._id);check(norm(row.title)&&typeof row.location==='string'&&norm(row.location),'missing native title or primary location')
      const knownCountries=row.location.split(',').map(part=>nativeCountryName(part.trim())).filter(Boolean)
      check(new Set(knownCountries).size<=1,'contradictory native geographic countries')
      // This exact reviewed suffix describes travel, not another base office.
      // Retain the full note for users while inspecting the advertised base.
      const travelMatch=/^(.+), travel to client locations based on requirement$/.exec(row.location)
      const nativeBaseLocation=travelMatch?travelMatch[1]:row.location
      const country=nativeLocationCountryName(nativeBaseLocation)
      check(!country||knownCountries.every(value=>value===country),'contradictory native country scope')
      check(country!=='India'||!foreignState.test(row.location),'contradictory native geographic state')
      const apply=new URL(row.applyLink)
      check(apply.origin==='https://docs.google.com'&&/^\/forms\/d\/e\/[A-Za-z0-9_-]+\/viewform$/.test(apply.pathname)&&!apply.search&&!apply.hash,'unreviewed native application target')
      const fields=[row.description,...['roleOverview','keyResponsibilities'].flatMap(key=>{
        check(row[key]==null||Array.isArray(row[key])&&row[key].every(value=>typeof value==='string'),'invalid native description array')
        return row[key]||[]
      })].map(value=>prose(value,row.title)).filter(Boolean)
      const description=fields.length?fields.join('\n\n'):null
      const city=country?null:isNativeBareCityInPublicScope(nativeBaseLocation)?getValidIndiaCityForJob({country:null,location:nativeBaseLocation}):null
      jobs.push({source:SOURCE,company:COMPANY,jobId:row._id,title:norm(row.title),sourceUrl:FIRST_PARTY_CAREERS_URL,
        applyUrl:apply.href,link:apply.href,applicationUrlIsGeneric:true,country:country||null,city,state:null,location:norm(row.location),
        nativePrimaryLocation:row.location,nativeBaseLocation,nativeTravelRequirement:travelMatch?'travel to client locations based on requirement':null,nativeCountry:country||null,sourceGeographyComplete:Boolean(country),
        employmentType:norm(row.type)||null,experienceRequired:norm(row.experience)||null,level:norm(row.level)||null,
        skills:row.skills,jobDescription:description,sourceDescription:description,postingDate:null,postedAt:null,
        sourceDetailComplete:Boolean(description),sourceDetailFailureKind:description?null:'missing-content',sourceListingComplete:false,scrapedAt:now()})
    }
    for(const url of new Set(jobs.map(job=>job.applyUrl))){
      const formHtml=await read(url),form=activeDocument(formHtml),titles=activeHead(formHtml).titles
      check(titles.length===1&&norm(titles[0])==='Job Application Form - Greyamp Consulting','native application employer identity changed')
      const visible=form.text(form.root)
      check(jobs.filter(job=>job.applyUrl===url).every(job=>visible.includes(job.title)),'native role absent from employer application choices')
    }
    const result={jobs,reportedTotal:rows.length,unknownCountryCount:jobs.filter(job=>!job.country).length,pagesFetched,verifiedAt:now()}
    checkBudget()
    return result
  }
  try{return await Promise.race([collect(),stopped])}
  finally{clearTimeout(timer);combined.removeEventListener('abort',listener);controller.abort(Error('Greyamp inspection ended'))}
}
export const run=async options=>{
  const inventory=await inspectInventory(options),jobs=inventory.jobs.filter(job=>{
    if(job.country)return job.country==='India'&&isJobInPublicLocationScope({country:job.country,location:job.nativeBaseLocation})
    return isNativeBareCityInPublicScope(job.nativeBaseLocation)
  })
  const complete=inventory.unknownCountryCount===0&&inventory.jobs.every(job=>job.sourceDetailComplete)
  jobs.forEach(job=>{job.sourceListingComplete=complete})
  return attachInventoryEvidence(jobs,{status:complete?inventory.reportedTotal===0?'verified-empty':'complete-inventory':'coverage-gap',
    firstParty:true,surface:NATIVE_API_URL,listingComplete:complete,pagesFetched:inventory.pagesFetched,reportedTotal:inventory.reportedTotal,
    indiaFacetCount:null,verifiedAt:inventory.verifiedAt,reason:complete?'Current official client, whole native array and employer application reconciled.':`${inventory.reportedTotal} native roles observed; ${inventory.unknownCountryCount} lack explicit country. ${jobs.length} satisfy the existing public location policy with unknown countries preserved; native travel notes retained. No zero-India claim.`})
}
export const createGreyampScraper=()=>({run})

const isDirectExecution = process.argv[1]
  ?.replaceAll('\\', '/')
  .endsWith('/scraper/greyamp/script.js')

if (isDirectExecution) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()
  if(!jobs.length&&readInventoryEvidence(jobs)?.listingComplete!==true)throw Error('Greyamp incomplete inventory cannot replace persisted jobs')

  if (isDryRun) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
