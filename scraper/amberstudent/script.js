import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import {createBoundedPublicCareerTransport} from '../../scraper-support/utils/boundedPublicCareerTransport.js'
import {readNativeDocument,extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeCountryName,nativeLocationCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
export const SOURCE = 'amberstudent'
export const COMPANY = 'Amberstudent'
export const VERIFIED_ON = '2026-11-05'
export const CAREERS_URL = 'https://amberstudent.com/career'
export const JOB_OPENING_URL = 'https://amberstudent.com/job-opening'
export const KEKA_BOARD_URL = 'https://amberstudent.keka.com/careers/'
export const KEKA_IDENTIFIER = '228f83f5-48b3-474a-b753-4fce2be7524f'
export const KEKA_INFO_URL = `${KEKA_BOARD_URL}api/organization/default/careerportalinfo`
export const KEKA_JOBS_URL = `${KEKA_BOARD_URL}api/embedjobs/default/active/${KEKA_IDENTIFIER}`
const ASSET_ROOT = 'https://cdn-static-assets.amberstudent.com/amber-user-website/build/assets/'
const clean = value => String(value ?? '').replace(/<[^>]+>/g, ' ')
  .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;|&rsquo;/gi, "'").replace(/\s+/g, ' ').trim()
const escaped = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const hasOfficialCareersSignal = html => {
  const doc=readNativeDocument(html)
  return doc.nodes(n=>n.tag==='title'&&/^Careers \| Amber$/i.test(n.raw?.trim()||'')).length===1
    && doc.nodes(n=>n.tag==='a'&&['/job-opening',JOB_OPENING_URL].includes(n.attrs.href)
      && /Explore Open Roles/i.test(doc.text(n))).length>0
}

// Read the public webpack route/chunk mapping as text; never evaluate downloaded code.
export const resolveJobsChunkUrl = main => {
  const variable = main.match(/path:"\/job-opening",exact:!0,component:([\w$]+)\.A/)?.[1]
  const moduleId = variable && main.match(new RegExp(escaped(variable) + '=[\\w$]+\\((\\d+)\\)'))?.[1]
  const start = moduleId ? main.indexOf(`${moduleId}:function`) : -1
  if (start < 0) throw new Error('Amber current jobs route module handoff is missing')
  const block = main.slice(start, start + 8000)
  const imports = block.match(/chunkName:\(\)=>"Jobs"[\s\S]*?importAsync:\(\)=>Promise\.all\(\[([^\]]+)\]/)?.[1]
  const ids = [...String(imports || '').matchAll(/\.e\("(\d+)"\)/g)].map(match => match[1])
  const chunkId = ids.at(-1)
  const runtime = main.slice(main.indexOf('.u=function(e){return"js/"'))
  const hash = chunkId && runtime.match(new RegExp('(?:\\{|,)' + chunkId + ':"([a-f0-9]+)"'))?.[1]
  if (!hash || !runtime.includes('[e]+".desktop.js"')) throw new Error('Amber current jobs chunk handoff is missing')
  return `${ASSET_ROOT}js/${chunkId}.${hash}.desktop.js`
}

// Reviewed 2026-11-05: this exact declared module fetches the account's complete
// active array and renders its description/location fields. Never execute it or
// grant account identity to isolated endpoint strings in comments/unused code.
export const hasVerifiedKekaJobsChunk = chunk => createHash('sha256').update(chunk).digest('hex')
  === 'a472be8a949a7c2accb6791e14739bfef6ecc102b7e1011f01a213ce4541193a'

function nativeInventory(payload,observedAt){
  if (!Array.isArray(payload)) throw new Error('Amber invalid Keka inventory: expected a complete jobs array')
  const jobs=[],seen=new Set(),unknownCountryIds=[],countryConflictIds=[]
  for (const row of payload) {
    const id = clean(row?.id), title = clean(row?.title), description = extractActiveDescription(row?.description)
    if (!/^\d+$/.test(id) || !title || !description || !Array.isArray(row.jobLocations)) throw new Error('Amber incomplete Keka inventory: invalid job')
    if (seen.has(id)) throw new Error('Amber incomplete Keka inventory: duplicate job ID')
    seen.add(id)
    if (!row.jobLocations.length || row.jobLocations.some(place=>{
      const code=nativeCountryName(place?.countryCode),name=nativeCountryName(place?.countryName)
      return (!code&&!name)||(clean(place?.countryCode)&&!code)||(clean(place?.countryName)&&!name)
    })){unknownCountryIds.push(id);continue}
    if(row.jobLocations.some(place=>{
      const code=nativeCountryName(place.countryCode),name=nativeCountryName(place.countryName)
      return code&&name&&code!==name
    })){countryConflictIds.push(id);continue}
    const locations=row.jobLocations.filter(place=>(nativeCountryName(place.countryCode)||nativeCountryName(place.countryName))==='India')
    if (!locations.length) continue
    const doc=readNativeDocument(row.description)
    const descriptionLocations=[...new Set(doc.nodes(n=>['div','p','li'].includes(n.tag)).map(n=>doc.text(n))
      .filter(text=>/^(?:Job\s+)?Location\s*[:\-]/i.test(text)&&text.length<240)
      .map(text=>text.replace(/^(?:Job\s+)?Location\s*[:\-]\s*/i,'')))]
    const remote=locations.every(place=>/^remote$/i.test(clean(place.city||place.name)))
    if(descriptionLocations.some(label=>{
      const country=nativeCountryName(label)||nativeLocationCountryName(label)
      return country&&country!=='India'||remote&&!/^remote(?:\b|$)/i.test(label)&&country!=='India'
    })){countryConflictIds.push(id);continue}
    const cities=[...new Set(locations.map(place=>clean(place.city)).filter(city=>city&&!/^remote$/i.test(city)))]
    const labels=[...new Set(locations.map(place=>[clean(place.name)||clean(place.city),'India'].filter(Boolean).join(', ')))]
    const sourceUrl = `${KEKA_BOARD_URL}jobdetails/${id}`
    const rawPosted=typeof row.publishedOn==='string'?row.publishedOn:null
    const validPosted=rawPosted&&/^\d{4}-\d{2}-\d{2}T/.test(rawPosted)&&Number.isFinite(Date.parse(rawPosted))
      &&(!observedAt||Date.parse(rawPosted)<=Date.parse(observedAt))
    jobs.push({
      title, company: COMPANY, source: SOURCE, jobId: id, requisitionId:null,legalEmployer:null,nativeLegalEmployer:null,
      location:labels.join(' / '),locations:labels,city:cities.length===1?cities[0]:null,country:'India',state:null,
      department: clean(row.departmentName) || null,
      sourceUrl, applyUrl: `${KEKA_BOARD_URL}applyjob/${id}`, link: sourceUrl,
      postingDate:validPosted?rawPosted:null,postedAt:validPosted?rawPosted:null,sourcePostedDateRaw:rawPosted,
      sourceDatePrecision:validPosted?'instant':null,sourcePostingDateUnresolved:!validPosted,firstEverPublication:null,closingDate:null,
      employmentType: row.jobType === 2 ? 'Full-time' : null,
      experienceRequired: clean(row.experience) || null,
      requiredSkills: Array.isArray(row.skillNames) ? row.skillNames.map(clean).filter(Boolean) : [],
      minimumQualification:null,preferredQualification:null,remoteStatus:remote?'Remote':null,
      jobDescription:description,sourceDescription:description,sourceRawDescription:row.description,sourceDetailComplete:true,
      nativeSourceRecord:structuredClone(row),nativeCountryLocations:structuredClone(row.jobLocations),
      nativeDescriptionLocations:descriptionLocations,sourceNativeJobType:row.jobType??null,applicationVisited:false,
      sourceClosingQualified:false,sourceScopeComplete:false,sourceListingComplete:false,lifecycleCleanupAllowed:false,
      companyCareerPage: CAREERS_URL, companyDomain: 'amberstudent.com', atsPlatform: 'keka',
    })
  }
  return {jobs,unknownCountryIds,countryConflictIds,total:payload.length}
}
export const extractKekaJobs=payload=>nativeInventory(payload).jobs

export const createAmberstudentScraper = (configuration={}) => ({
  async run(overrides={}) {
    const options={...configuration,...overrides},cap=options.maxJobs??null
    options.signal?.throwIfAborted()
    if(cap!=null&&(!Number.isSafeInteger(cap)||cap<0))throw Error('Amber invalid result limit')
    const observedAt=new Date((options.now||(()=>new Date().toISOString()))()).toISOString(),failures=[]
    let jobs=[],inventory={total:null,unknownCountryIds:[],countryConflictIds:[]},reads=0,firstParty=false
    const finish=()=>{
      if(inventory.total!==null)attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',
        observedRecordCount:inventory.total,observedVacancyCount:inventory.total,sourceScopeComplete:false,
        companyGlobalTotal:null,companyIndiaTotal:null})
      Object.defineProperty(jobs,Symbol.for('jobverify.verified-recruitment-observations'),{value:{source:SOURCE,
        firstPartyConfirmed:firstParty,nativePostings:inventory.total,closedNativeDetails:jobs.filter(j=>j.sourceClosingQualified).length,
        unknownCountryIds:inventory.unknownCountryIds,countryConflictIds:inventory.countryConflictIds,failures,
        nativeInventoryReads:reads?[{kind:'complete-native-keka-array',pagesFetched:reads,reportedTotal:inventory.total,usable:true}]:[],
        sourceScopeComplete:false,lifecycleCleanupAllowed:false,unresolved:['company-recruitment-scope-unverified',
          ...(inventory.unknownCountryIds.length?['native-country-unproven']:[]),...(inventory.countryConflictIds.length?['native-country-conflicts']:[]),
          ...(failures.length?['closing-native-context-unqualified']:[]),...(cap!=null?['caller-result-limit']:[])]}})
      return attachInventoryEvidence(jobs,{status:'coverage-gap',surface:CAREERS_URL,firstParty,pagesFetched:reads,
        listingComplete:false,reportedTotal:null,indiaFacetCount:null,verifiedAt:observedAt,reason:'current-native-India-positives;company-scope-unverified'})
    }
    if(cap===0)return finish()
    const io=createBoundedPublicCareerTransport({...options,source:SOURCE,allowedURL:(url,method)=>method==='GET'&&(
      [CAREERS_URL,JOB_OPENING_URL,KEKA_INFO_URL,KEKA_JOBS_URL].includes(url)
      ||new RegExp('^'+escaped(ASSET_ROOT)+'js/(?:main|\\d+)\\.[a-f0-9]+\\.desktop\\.js$').test(url))})
    const context=async()=>{
      if(!hasOfficialCareersSignal(await io.fetchText(CAREERS_URL)))throw Error('Amber current first-party careers handoff is unverified')
      const opening=readNativeDocument(await io.fetchText(JOB_OPENING_URL))
      const mains=opening.nodes(n=>n.tag==='script'&&new RegExp('^'+escaped(ASSET_ROOT)+'js/main\\.[a-f0-9]+\\.desktop\\.js$').test(n.attrs.src||''))
      if(mains.length!==1)throw Error('Amber current jobs route has no verified first-party asset handoff')
      const mainURL=mains[0].attrs.src,chunkURL=resolveJobsChunkUrl(await io.fetchScript(mainURL))
      if(!hasVerifiedKekaJobsChunk(await io.fetchScript(chunkURL)))throw Error('Amber current jobs module no longer binds the verified Keka tenant')
      return {mainURL,chunkURL}
    }
    try{
      const opening=await context();firstParty=true
      const info=await io.fetchJson(KEKA_INFO_URL)
      if(info?.name!=='amber'||info?.shortName!=='amber'||info?.careersPortalDomain!=='amberstudent.keka.com')throw Error('Amber Keka tenant identity is unverified')
      const payload=await io.fetchJson(KEKA_JOBS_URL);reads++
      inventory=nativeInventory(payload,observedAt)
      jobs=(cap==null?inventory.jobs:inventory.jobs.slice(0,cap)).map(job=>({...job,scrapedAt:observedAt,nativeAccount:structuredClone(info),
        sourceNativeContract:{...opening,identifier:KEKA_IDENTIFIER,accountURL:KEKA_INFO_URL,inventoryURL:KEKA_JOBS_URL}}))
      const closingPayload=await io.fetchJson(KEKA_JOBS_URL);reads++
      const closing=nativeInventory(closingPayload,observedAt),closingInfo=await io.fetchJson(KEKA_INFO_URL),closingContext=await context()
      if(JSON.stringify(info)!==JSON.stringify(closingInfo)||JSON.stringify(opening)!==JSON.stringify(closingContext))throw Error('Amber current account or route changed at closing')
      const sameIds=payload.length===closingPayload.length&&payload.every(row=>closingPayload.some(other=>other.id===row.id))
      if(!sameIds)throw Error('Amber native closing inventory changed')
      const accepted=new Map(closing.jobs.map(job=>[job.jobId,job]))
      jobs=jobs.filter(job=>{
        const current=accepted.get(job.jobId)
        if(!current||JSON.stringify(current.nativeSourceRecord)!==JSON.stringify(job.nativeSourceRecord)){
          failures.push({id:job.jobId,message:'Amber native role changed at closing'});return false
        }
        job.sourceClosingQualified=true;job.nativeClosingRecord=structuredClone(current.nativeSourceRecord);return true
      })
      return finish()
    }catch(error){
      io.signal.throwIfAborted()
      if(!jobs.length)throw error
      failures.push({message:error.message,status:error.status??null});return finish()
    }finally{io.close()}
  },
})
export const run = options => createAmberstudentScraper(options).run(options)

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const jobs = await run()
  if (process.argv.includes('--dry-run')) saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  else await saveToDB(jobs, SOURCE)
}
