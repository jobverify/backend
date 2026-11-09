import {createHash} from 'node:crypto'
import {setTimeout as delay} from 'node:timers/promises'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {publicRead,structure,stable,bounded} from '../bizongo/publicRead.js'
import {projectPublicClient} from './publicClient.js'
import reviewedPublicClient from './public-client-20261103.js'

export const SOURCE='brihaspathi'
export const COMPANY='Brihaspathi Technologies Limited'
export const CAREERS_URL='https://brihaspathi.com/careers'
export const CLIENT_URL='https://brihaspathi.com/_next/static/chunks/42s4mc2c2afza.js'
export const JOBS_API_URL='https://brihaspathi.com/strapi/api/job-openings?sort=createdAt:desc&pagination[pageSize]=100&filters[isActive][$eq]=true'
export const CLIENT_SHA256='a6077cf32ec4f8e788f694cfa20bc9fda138039338d2b0ef5bbc102667b78f37'
export const sha256=value=>createHash('sha256').update(value).digest('hex')
const check=(ok,message)=>{if(!ok)throw Error('Brihaspathi current native: '+message)}
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():null
const timestamp=(value,label)=>{
 if(value==null)return null
 check(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)&&Number.isFinite(Date.parse(value)),'invalid CMS '+label+' timestamp')
 check(new Date(value).toISOString().slice(0,10)===value.slice(0,10),'invalid CMS '+label+' timestamp')
 return value
}

export function inspectNativePage(html,client){
 check(typeof html==='string'&&typeof client==='string','page/client must be text')
 const doc=readNativeDocument(html)
 check(doc.nodes(n=>n.tag==='title').some(n=>/^Brihaspathi technologies limited$/i.test(clean(n.raw)||'')),'official employer title changed')
 const organizations=doc.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').flatMap(n=>{try{return[JSON.parse(n.raw)]}catch{return[]}})
 check(organizations.some(n=>n['@type']==='Organization'&&n.name===COMPANY&&n.url==='https://brihaspathi.com/'),'official employer organization missing')
 const clientNodes=structure(html).scripts.filter(n=>n.attrs.src===new URL(CLIENT_URL).pathname&&n.executable)
 check(clientNodes.length===1,'current executable client delegation missing')
 const publicContract=projectPublicClient(client)
 check(stable(publicContract)===stable(reviewedPublicClient),'reviewed public client contract changed; re-review required')
 check(doc.nodes(n=>n.attrs.id==='vacancies').length===1,'native open roles section missing')
 // The reviewed React client renders API strings as plain text, filters postedBy
 // globally and opens an application modal bound to the numeric posting id.
 // It exposes no full JD or role country/publication/expiry/requisition UI.
 return{employer:COMPANY,clientVerified:true,clientSha256:sha256(client),publicContract,sourceScopeComplete:false}
}

const regionNames=new Intl.DisplayNames(['en'],{type:'region',fallback:'none'}),countryCodes=new Map(),countryNames=new Map()
for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){
 const code=String.fromCharCode(a,b),name=regionNames.of(code)
 if(name&&!['ZZ','XA','XB','UN','EU','EZ','QO'].includes(code)){countryCodes.set(code,name);countryNames.set(name.toLowerCase(),code)}
}
for(const [name,code]of[['usa','US'],['united states of america','US'],['uk','GB'],['uae','AE']])countryNames.set(name,code)
function countryEvidence(row,location){
 const country=clean(row.country),code=clean(row.countryCode)
 check((row.country==null||Boolean(country))&&(row.countryCode==null||Boolean(code)),'malformed native country')
 const named=country&&(countryNames.get(country.toLowerCase())||(countryCodes.has(country.toUpperCase())?country.toUpperCase():null)),typed=code?.toUpperCase()
 check(!country||Boolean(named),'unrecognized native country name')
 check(!typed||countryCodes.has(typed),'unrecognized native country code')
 const fromLocation=location.split(/[,;|]/).map(value=>countryNames.get(value.trim().toLowerCase())).filter(Boolean)
 const codes=[...new Set([named,typed,...fromLocation].filter(Boolean))],conflict=codes.length>1,resolved=conflict?null:codes[0]||null
 return{country:resolved?countryCodes.get(resolved):null,countryCode:resolved,reasons:conflict?['conflicting-native-country']:resolved?[]:['native-work-country-unpublished']}
}

export function inspectNativePayload(payload,{expectedPage=1}={}){
 check(payload&&Array.isArray(payload.data)&&payload.meta?.pagination,'malformed native job-openings payload')
 // Numeric zero defaults cannot override an explicit native failure or an
 // announced continuation elsewhere in this public response envelope.
 const pending=[payload]
 while(pending.length){const envelope=pending.pop();for(const[key,value]of Object.entries(envelope)){
  if(envelope===payload&&key==='data')continue
  const label=key.toLowerCase().replace(/[^a-z0-9]/g,'')
  if(['error','errors','exception','fault'].includes(label))check(value==null||value===false||value===''||Array.isArray(value)&&value.length===0,'native error envelope; inventory unavailable')
  if(['success','ok'].includes(label))check(value!==false,'native error envelope; inventory unavailable')
  if(label==='status')check(!(typeof value==='number'&&value>=400)&&!(typeof value==='string'&&/^(?:error|failed|failure|unavailable)$/i.test(value)),'native error status; inventory unavailable')
  if(['hasmore','hasnext','hasnextpage','more','next','nextpage','nextcursor','nexturl','continuation','continuationtoken'].includes(label))check(value==null||value===false||value==='','native continuation contradicts the reviewed page-count enumeration')
  if(value&&typeof value==='object')pending.push(...(Array.isArray(value)?value.filter(v=>v&&typeof v==='object'):[value]))
 }}
 const p=payload.meta.pagination
 check([p.page,p.pageSize,p.pageCount,p.total].every(Number.isSafeInteger)&&p.page===expectedPage&&p.pageSize===100&&p.total>=0&&p.pageCount===Math.ceil(p.total/p.pageSize)&&p.page<=Math.max(1,p.pageCount),'invalid native pagination metadata')
 check(payload.data.length===Math.min(Math.max(p.total-(p.page-1)*p.pageSize,0),p.pageSize),'native returned cardinality does not match total')
 const ids=new Set(),rows=payload.data.map(row=>{
  check(row&&typeof row==='object'&&!Array.isArray(row),'invalid native row')
  const v=row.attributes?{id:row.id,...row.attributes}:row
  check(Number.isSafeInteger(v.id)&&v.id>0&&!ids.has(v.id),'invalid or duplicate native posting identity');ids.add(v.id)
  for(const key of ['title','department','location','experience','description'])check(Boolean(clean(v[key])),'missing native '+key+'; frontend defaults are not evidence')
  check(v.isActive===true,'inactive or ambiguous native record returned by active filter')
  check(v.required_skills==null||typeof v.required_skills==='string'||Array.isArray(v.required_skills)&&v.required_skills.every(s=>typeof s==='string'),'malformed native required skills')
  check(v.postedBy==null||typeof v.postedBy==='string','malformed postedBy')
  check(v.posted_by==null||typeof v.posted_by==='string','malformed posted_by')
  const location=clean(v.location),country=countryEvidence(v,location)
  return{title:clean(v.title),company:COMPANY,department:clean(v.department),location,city:null,country:country.country,countryCode:country.countryCode,
   jobId:String(v.id),requisitionId:null,sourceUrl:'https://brihaspathi.com/careers#vacancies',applyUrl:'https://brihaspathi.com/careers#vacancies',
   applicationContext:{kind:'native-job-opening-modal',jobOpeningId:v.id,submissionPerformed:false},
   employmentType:null,experienceRequired:clean(v.experience),minimumQualification:null,preferredQualification:null,
   requiredSkills:(Array.isArray(v.required_skills)?v.required_skills:v.required_skills==null?[]:[v.required_skills]).map(clean).filter(Boolean),
   postingDate:null,closingDate:null,remoteStatus:null,jobDescription:clean(v.description),sourceDetailComplete:false,fullNativeCriteriaAvailable:false,
   nativeCmsPublication:timestamp(v.publishedAt,'publishedAt'),nativeCmsCreatedAt:timestamp(v.createdAt,'createdAt'),nativeCmsUpdatedAt:timestamp(v.updatedAt,'updatedAt'),
   nativePostedBy:clean(v.postedBy||v.posted_by),nativeHasPoster:Boolean(v.postedBy||v.posted_by),sourceScopeReasons:country.reasons,sourceListingComplete:false}
 })
 const hasPoster=rows.some(row=>row.nativeHasPoster)
 const records=hasPoster?rows.filter(row=>['hr','human resources','human-resource'].includes(row.nativePostedBy?.toLowerCase())):rows
 const apiPageComplete=p.total<=p.pageSize
 return{records,allRecords:rows,pagination:{...p},apiPageComplete,reportedTotal:p.total,rawReturnedRecords:rows.length,filteredNonHrRecords:rows.length-records.length,
  confirmedIndiaRecords:records.filter(r=>r.countryCode==='IN').length,unknownCountryRecords:records.filter(r=>!r.countryCode).length,
  reasons:['native-cards-only;full-criteria-unpublished','job-publication-expiry-and-formal-requisition-unpublished','whole-company-hiring-scope-unverified',
   ...(!apiPageComplete?['native-client-first-100-record-ceiling']:[]),...new Set(records.flatMap(r=>r.sourceScopeReasons))]}
}

export async function runNativeBrihaspathi(options={}){
 const maxJobs=options.maxJobs??Infinity,interval=options.requestIntervalMs??500
 check(maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'invalid caller cap')
 check(Number.isSafeInteger(interval)&&interval>=0&&(interval>=500||options.fetchPage||options.fetchImpl),'invalid request pacing')
 return publicRead({source:SOURCE,company:COMPANY},options,async({read,stamp,audit,signal,signals,publicPages})=>{
  const verifiedAt=stamp();let previous=0
  const get=async(url,phase,kind)=>{
   const remaining=interval-(Date.now()-previous);if(remaining>0)await delay(remaining,undefined,{signal});previous=Date.now()
   const body=await read(url,{phase,kind}),receipt=publicPages.at(-1)
   check(receipt?.status===200&&receipt.finalUrl===url&&receipt.responseIdentity==='validated-public-response','public HTTP response identity is required; bare text cannot qualify native inventory')
   return body
  }
  const snapshot=async phase=>{
   const page=inspectNativePage(await get(CAREERS_URL,phase,'html'),await get(CLIENT_URL,phase,'javascript')),payloads=[],parsed=[]
   const parsePage=async(url,expectedPage)=>{const body=await get(url,phase,'json');let payload;try{payload=JSON.parse(body)}catch{check(false,'native JSON invalid')};payloads.push(payload);const current=inspectNativePayload(payload,{expectedPage});parsed.push(current);return current}
   const first=await parsePage(JOBS_API_URL,1)
   for(let page=2;page<=first.pagination.pageCount;page++){
    const url=new URL(JOBS_API_URL);url.searchParams.set('pagination[page]',String(page));const current=await parsePage(url.href,page)
    check(current.reportedTotal===first.reportedTotal&&current.pagination.pageCount===first.pagination.pageCount,'native pagination changed total during enumeration')
   }
   const allRecords=parsed.flatMap(p=>p.allRecords)
   check(allRecords.length===first.reportedTotal&&new Set(allRecords.map(r=>r.jobId)).size===allRecords.length,'native inventory contains duplicate or missing posting identities')
   return{page,payloads,...first,allRecords,apiPagesEnumerated:parsed.length}
  }
  const first=await snapshot('initial'),last=await snapshot('closing')
  check(stable({contract:first.page.publicContract,payloads:first.payloads})===stable({contract:last.page.publicContract,payloads:last.payloads}),'native closing snapshot changed identities, fields, visibility or pagination')
  const complete=first.reportedTotal===0,reasons=complete?[]:[...first.reasons,'native-description-is-line-clamped-without-public-full-criteria-reveal',...(Number.isFinite(maxJobs)?['caller-cap-after-reconciliation']:[])]
  const observations=first.allRecords.map((row,index)=>({...row,kind:'native-active-api-record',publiclyRendered:index<100&&first.records.some(r=>r.jobId===row.jobId),originalDescription:row.jobDescription,descriptionSha256:sha256(row.jobDescription),jobDescription:null,criteriaComplete:false,sourceDetailComplete:false,jobId:row.jobId,postingDate:null,closingDate:null,applicationSubmitted:false}))
  const native={...first,reasons,observations,receipts:publicPages.map(({requestedUrl,sha256,phase})=>({url:requestedUrl,sha256,phase})),verifiedAt,observedNativeRecords:first.records.length,
   fullNativeDescriptionRecords:0,fullNativeHealthyIndiaJobs:0,eligibleFullIndiaJobs:0,closingReconciled:true,declaredBoardComplete:complete,declaredBoardIndiaAbsenceProven:complete,sourceScopeComplete:false,indiaAbsenceProven:false,lifecycleCleanupAllowed:false}
  const evidence={status:complete?'verified-empty':'coverage-gap',surface:CAREERS_URL,firstParty:true,listingComplete:complete,pagesFetched:publicPages.length,reportedTotal:complete?0:null,indiaFacetCount:complete?0:null,verifiedAt,reason:complete?'declared-active-native-total-zero;all-public-default-filters-and-closing-reconciled':reasons.join(';')}
  if(options.onNativeEvidence)await bounded(()=>options.onNativeEvidence(native),signals)
  await audit({...native,inventoryEvidence:evidence,companyGlobalTotal:null,companyIndiaTotal:null})
  const jobs=attachInventoryEvidence([],evidence);Object.defineProperty(jobs,'nativeInventoryEvidence',{value:native,enumerable:false})
  return complete?jobs:attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'mixed',observedRecordCount:observations.length,observedVacancyCount:first.records.length,sourceScopeComplete:false})
 })
}
