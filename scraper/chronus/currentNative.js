import {createHash} from 'node:crypto'
import {qualifiedFirstPartyHTML,nativeText,clean} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {extractActiveDescription} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const SOURCE='chronus',PAGE='https://chronus.com/about-us/careers',API='https://app.recruiterbox.com/widget/8241/openings/'
const countryNames=(()=>{const names=new Set(),display=new Intl.DisplayNames(['en'],{type:'region'});for(let a=65;a<=90;a++)for(let b=65;b<=90;b++){const code=String.fromCharCode(a,b),name=display.of(code);if(!['EU','EZ','UN','QO','ZZ','XA','XB'].includes(code)&&name&&name!==code)names.add(name)}return names})()
const PROGRAMS=new Map([
 ['https://chronus.com/_next/static/immutable/chunks/0ac16jm9wnz4f.js','d426d677069f86855d42395fb6a625a1f3c1000879e698ace163484dc3d16a7e'],
 ['https://w.recruiterbox.com/static/client-src-served/widget/8241/rbox_api.js','46090c10c4c511e8ae7f37534654defbd8709fe44710139db41602be879f326a'],
 ['https://w.recruiterbox.com/static/client-src-served/widget/8241/rbox_impl.js','6d9940397501b4d80cc9ea51ffed3648e744ef562886ee88f062417b792cfeb5'],
])
export const hasCurrentChronusClient=html=>String(html).includes('/_next/static/immutable/chunks/0ac16jm9wnz4f.js')
export async function runCurrentChronus(options={}){
 const failure=message=>firstPartyFailure(SOURCE,message,{nativeAuthorityFailure:true})
 const need=(ok,message)=>{if(!ok)throw failure(message)}
 const timeoutMs=options.timeoutMs??120000
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000,'Invalid native source deadline')
 const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(options.signal?[options.signal]:[])])
 const fetchImpl=options.fetchImpl??globalThis.fetch
 const verifiedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof verifiedAt==='string'&&Number.isFinite(Date.parse(verifiedAt)),'Invalid native check time')
 let requests=0
 const read=async(url,type)=>{
  signal.throwIfAborted();requests++
  const response=await boundedDeclaredPublicGet(url,{fetchImpl,signal,overflowError:failure('Native entity exceeds bounded size')})
  need(response.status===200&&response.url===url,'Native HTTP status or final URL changed')
  need((type==='json'?/application\/json/i:type==='js'?/(?:text|application)\/(?:java|ecma)script/i:/text\/html/i).test(response.headers['content-type']??''),'Native entity content type changed')
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(response.bodyBase64,'base64'))
 }
 const collect=async()=>{
  const page=qualifiedFirstPartyHTML(await read(PAGE,'html'),PAGE,failure)
  need(page.title==='Careers at Chronus','Native employer title changed')
  const region=page.raw.nodes(n=>(n.attrs.class??'').split(/\s+/).includes('job-openings'))
  need(region.length===1&&clean(nativeText(page.body)).includes('Open Positions'),'Missing or ambiguous native recruiting region')
  const client=[...PROGRAMS.keys()][0]
  need(page.raw.nodes(n=>n.tag==='script'&&n.attrs.src===new URL(client).pathname).length===1,'Current native client declaration changed')
  for(const[url,hash]of PROGRAMS)need(createHash('sha256').update(await read(url,'js')).digest('hex')===hash,'Current native recruiting program profile requires review')
  const rows=JSON.parse(await read(API,'json'))
  need(Array.isArray(rows)&&rows.length<=1000,'Native inventory is not a bounded array')
  const ids=new Set()
  for(const row of rows){
   need(row&&typeof row==='object'&&/^[a-z\d_-]+$/i.test(String(row.id??''))&&clean(row.title)&&!ids.has(String(row.id)),'Incomplete or duplicate native role identity')
   ids.add(String(row.id))
   need(!row.company_name||clean(row.company_name)==='Chronus','Native role employer identity changed')
  }
  return rows.sort((a,b)=>String(a.id).localeCompare(String(b.id)))
 }
 const opening=await collect(),closing=await collect()
 need(JSON.stringify(opening)===JSON.stringify(closing),'Native closing inventory or criteria changed')
 const unknown=opening.filter(row=>!countryNames.has(clean(row.location?.country))).map(row=>String(row.id)),unqualified=[]
 let jobs=opening.filter(row=>clean(row.location?.country)==='India').flatMap(row=>{
  const description=extractActiveDescription(row.description)
  let publicUrl
  try{publicUrl=new URL(row.public_url)}catch{}
  // Do not substitute the JSON API or an invented widget fragment for an
  // unavailable native role/application page. Non-empty, unqualified records
  // remain observed inventory and can never produce an empty certificate.
  if(!description||!publicUrl||publicUrl.protocol!=='https:'||publicUrl.hostname!=='chronus.hire.trakstar.com'||publicUrl.username||publicUrl.password||publicUrl.port){unqualified.push(String(row.id));return[]}
  const location=[row.location?.city,row.location?.state,row.location?.country].map(clean).filter(Boolean).join(', ')
  return[{source:SOURCE,company:'Chronus',legalEmployer:null,title:clean(row.title),jobId:String(row.id),requisitionId:clean(row.job_code)||String(row.id),
   sourceNativeJobId:String(row.id),country:'India',location,city:clean(row.location?.city)||null,state:clean(row.location?.state)||null,
   sourceUrl:publicUrl.href,applyUrl:publicUrl.href,link:publicUrl.href,department:clean(row.team)||null,employmentType:clean(row.position_type)||null,
   jobDescription:description,sourceDescription:description,sourceNativeJobRecord:row,sourceDetailComplete:true,sourceDetailStatus:'complete-published-native-criteria',
   sourceScopeComplete:false,lifecycleCleanupAllowed:false,scrapedAt:verifiedAt}]
 })
 const maxJobs=options.maxJobs??null
 need(maxJobs===null||maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'Invalid native job cap')
 const capped=maxJobs!==null&&maxJobs!==Infinity&&maxJobs<jobs.length
 if(capped)jobs=jobs.slice(0,maxJobs)
 const complete=!unknown.length&&!unqualified.length&&!capped
 for(const job of jobs)job.sourceListingComplete=complete
 attachSourceObservationEvidence(jobs,{source:SOURCE,recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{status:complete?(opening.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:API,firstParty:true,listingComplete:complete,pagesFetched:requests,reportedTotal:opening.length,indiaFacetCount:opening.filter(row=>clean(row.location?.country)==='India').length,verifiedAt,
  reason:'current-declared-Chronus-8241-widget-client-and-unfiltered-native-inventory-reconciled-at-closing;whole-company-scope-unqualified;unknown-country:'+unknown.join(',')+';unqualified-role:'+unqualified.join(',')+(capped?';caller-cap':'')})
}
