import {createHash} from 'node:crypto'
import {qualifiedFirstPartyHTML,clean,nativeText} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {boundedDeclaredPublicGet} from '../../scraper-support/native-sources/boundedDeclaredPublicGet.js'
import {firstPartyFailure} from '../../scraper-support/native-sources/boundedFirstPartyDocuments.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {composeLeverDescription} from '../../scraper-support/utils/leverDescription.js'
import {getValidIndiaCityForJob} from '../../src/utils/publicJobLocationScope.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
const HOME='https://www.famapp.in/',CAREERS=HOME+'careers/',API='https://api.lever.co/v0/postings/fampay?mode=json'
const CLIENT=HOME+'_next/static/chunks/2cyegqtq_3d48.js',HASH='57524cd1c9585b13a5aa22189602a6b489e6eac70cb1278d6043092b13199dcd'
const countryNames=new Intl.DisplayNames(['en'],{type:'region'})
const knownCountry=code=>typeof code==='string'&&/^[A-Z]{2}$/i.test(code)&&!['EU','EZ','UN','QO','ZZ','XA','XB'].includes(code.toUpperCase())&&countryNames.of(code.toUpperCase())!==code.toUpperCase()
export const hasCurrentFamHome=html=>String(html).includes('FamApp: Lightning fast UPI payments with bank &amp; wallet')
export const hasCurrentFamCareers=html=>String(html).includes('/_next/static/chunks/2cyegqtq_3d48.js')
export async function runCurrentFam(options={}){
 const {source,company,fetchImpl=globalThis.fetch}=options
 const failure=message=>firstPartyFailure(source,message,{nativeAuthorityFailure:true})
 const need=(ok,message)=>{if(!ok)throw failure(message)}
 need(['famapp','fampay'].includes(source)&&typeof company==='string'&&company,'Unverified native source identity')
 const timeoutMs=options.timeoutMs??120000
 need(Number.isSafeInteger(timeoutMs)&&timeoutMs>0&&timeoutMs<=300000,'Invalid native source deadline')
 const signal=AbortSignal.any([AbortSignal.timeout(timeoutMs),...(options.signal?[options.signal]:[])])
 const verifiedAt=typeof options.now==='function'?options.now():options.now??new Date().toISOString()
 need(typeof verifiedAt==='string'&&Number.isFinite(Date.parse(verifiedAt)),'Invalid native check time')
 let requests=0
 const read=async(url,type)=>{
  signal.throwIfAborted();requests++
  const response=await boundedDeclaredPublicGet(url,{fetchImpl,signal,overflowError:failure('Native response exceeds bounded entity size')})
  need(response.status===200&&response.url===url,'Native HTTP status or final URL changed')
  need((type==='json'?/application\/json/i:type==='js'?/(?:text|application)\/(?:java|ecma)script/i:/text\/html/i).test(response.headers['content-type']??''),'Native entity content type changed')
  return new TextDecoder('utf-8',{fatal:true}).decode(Buffer.from(response.bodyBase64,'base64'))
 }
 const bind=async()=>{
  // This publisher's current homepage has no canonical link. Qualify its
  // actual head, exact og:url and static route metadata rather than inventing
  // a canonical or accepting arbitrary homepage copy.
  const home=readNativeDocument(await read(HOME,'html'))
  const heads=home.nodes(n=>n.tag==='head'),bodies=home.nodes(n=>n.tag==='body'),roots=home.nodes(n=>n.tag==='html')
  need(heads.length===1&&bodies.length===1&&roots.length===1&&roots[0].children.includes(heads[0])&&roots[0].children.includes(bodies[0]),'Current native homepage document identity changed')
  const all=node=>[node,...node.children.filter(n=>typeof n!=='string').flatMap(all)]
  need(!all(roots[0]).some(n=>n.tag==='base'||n.tag==='link'&&n.attrs.rel==='canonical'),'Current native homepage base or canonical profile changed')
  const titles=heads[0].children.filter(n=>typeof n!=='string'&&n.tag==='title'&&!n.inert)
  need(titles.length===1&&clean(decodeNativeEntities(titles[0].raw))==='FamApp: Lightning fast UPI payments with bank & wallet','Current native employer title changed')
  const og=heads[0].children.filter(n=>typeof n!=='string'&&n.tag==='meta'&&n.attrs.property==='og:url'&&!n.inert)
  need(og.length===1&&og[0].attrs.content==='https://famapp.in','Current native homepage origin identity changed')
  const homeData=home.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json')
  need(homeData.length===1&&JSON.parse(homeData[0].raw).page==='/','Current native homepage route changed')
  need(home.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/').length>0,'Missing current native careers handoff')
  const page=qualifiedFirstPartyHTML(await read(CAREERS,'html'),'https://famapp.in/careers/',failure)
  need(page.title==='Careers at Fam: come hang at FamHQ','Current native careers title changed')
  const data=page.raw.nodes(n=>n.tag==='script'&&n.attrs.id==='__NEXT_DATA__'&&n.attrs.type==='application/json')
  need(data.length===1,'Ambiguous current native careers page identity')
  const metadata=JSON.parse(data[0].raw)
  need(metadata.page==='/careers'&&metadata.isFallback===false&&Object.keys(metadata.query??{}).length===0,'Filtered or fallback current native page')
  need(page.raw.nodes(n=>n.tag==='script'&&n.attrs.src===new URL(CLIENT).pathname&&!n.inert).length===1,'Current native careers client declaration changed')
  need(clean(nativeText(page.body)).includes('Careers at Fam.'),'Missing current native careers region')
  const code=await read(CLIENT,'js')
  // This reviewed publisher configuration declares the Fampay tenant, public
  // postings feed and native role URL builder. Static game sample roles and the
  // separate application POST endpoint never supply vacancy records.
  need(createHash('sha256').update(code).digest('hex')===HASH,'Current native recruiting client profile requires review')
 }
 const inventory=async()=>{
  const rows=JSON.parse(await read(API,'json'))
  need(Array.isArray(rows)&&rows.length<=5000,'Native inventory is not a bounded posting array')
  const ids=new Set()
  for(const row of rows){
   need(row&&typeof row==='object'&&/^[a-f\d-]{36}$/i.test(row.id??'')&&!ids.has(row.id)&&clean(row.text)&&row.categories&&clean(row.categories.location),'Incomplete or duplicate native role identity')
   ids.add(row.id)
   for(const[field,suffix]of[['hostedUrl',''],['applyUrl','/apply']])need(row[field]==='https://jobs.lever.co/fampay/'+row.id+suffix,'Native tenant or role URL identity changed')
   need(row.country===null||typeof row.country==='string','Native country type changed')
   need(row.lists==null||Array.isArray(row.lists)&&row.lists.every(section=>section&&typeof section.content==='string'),'Native full criteria sections changed')
  }
  return rows.sort((a,b)=>a.id.localeCompare(b.id))
 }
 await bind();const opening=await inventory();await bind();const closing=await inventory()
 need(JSON.stringify(opening)===JSON.stringify(closing),'Native closing inventory or full criteria changed')
 const unknown=opening.filter(row=>!knownCountry(row.country)).map(row=>row.id)
 const india=opening.filter(row=>row.country?.toUpperCase()==='IN'),missing=[]
 let jobs=india.flatMap(row=>{
  const description=composeLeverDescription(row)
  if(!description){missing.push(row.id);return[]}
  const location=clean(row.categories.location)
  return[{source,company,legalEmployer:null,title:clean(row.text),jobId:row.id,requisitionId:row.id,sourceNativeJobId:row.id,
   country:'India',location:/\bIndia\b/i.test(location)?location:location+', India',city:getValidIndiaCityForJob({location})??null,state:null,
   department:clean(row.categories.department??row.categories.team)||null,sourceUrl:row.hostedUrl,applyUrl:row.applyUrl,link:row.applyUrl,
   employmentType:clean(row.categories.commitment)||null,experienceRequired:null,minimumQualification:null,preferredQualification:null,requiredSkills:[],
   postingDate:Number.isFinite(row.createdAt)&&row.createdAt>0?new Date(row.createdAt).toISOString():null,closingDate:null,
   remoteStatus:row.workplaceType??null,jobDescription:description,sourceDescription:description,sourceNativeJobRecord:row,
   sourceDetailComplete:true,sourceDetailStatus:'complete-published-native-criteria',sourceScopeComplete:false,lifecycleCleanupAllowed:false,
   sourceEmployerScope:'current-declared-native-Fampay-postings-channel',scrapedAt:verifiedAt}]
 })
 const maxJobs=options.maxJobs??null
 need(maxJobs===null||maxJobs===Infinity||Number.isSafeInteger(maxJobs)&&maxJobs>=0,'Invalid native job cap')
 const capped=maxJobs!==null&&maxJobs!==Infinity&&maxJobs<jobs.length
 if(capped)jobs=jobs.slice(0,maxJobs)
 const complete=!unknown.length&&!missing.length&&!capped
 for(const job of jobs)job.sourceListingComplete=complete
 attachSourceObservationEvidence(jobs,{source,recordKind:'vacancy-rows',observedRecordCount:opening.length,observedVacancyCount:opening.length,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 return attachInventoryEvidence(jobs,{status:complete?(opening.length?'complete-inventory':'verified-empty'):'coverage-gap',surface:API,firstParty:true,listingComplete:complete,pagesFetched:requests,reportedTotal:opening.length,indiaFacetCount:india.length,verifiedAt,
  reason:'current-declared-native-client-and-full-postings-reconciled-at-closing;whole-company-scope-unqualified;unknown-country:'+unknown.join(',')+';missing-criteria:'+missing.join(',')+(capped?';caller-cap':'')})
}
