import config from './currentConfig.json' with {type:'json'}
import baselines from './current.scope.json' with {type:'json'}
import {runCurrentKeka} from './currentKeka.js'
import {readNativeDocument,decodeNativeEntities} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence,readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {createPublicReader} from '../birlanu/publicRead.js'

const placementUrl='https://acciojob.com/jobs',mentorUrl='https://acciojob.com/become-a-mentor'
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
const nativeBaselines=Object.fromEntries(Object.entries(baselines).filter(([url])=>url==='$renderers'||url.startsWith('https://acciojob.keka.com/')))
const nativeConfig={...config,additionalPages:[],scopeLimitations:[]}
export function createCurrentEmployeeScraper(defaults={}){
 const collect=async(options={})=>{
  const o={...defaults,...options},scopeGaps=new Set(),ownHiringSignals=[],classifications=[]
  const {maxJobs,...nativeOptions}=o
  if(maxJobs!=null&&(!Number.isSafeInteger(maxJobs)||maxJobs<0))throw Error('acciojob invalid job cap')
  if(o.fetchText||o.fetchPage)throw Error('acciojob requires observed status/final URL fetchImpl')
  const reader=createPublicReader({...o,source:'acciojob',allowedUrl:(url,init)=>(init.method??'GET')==='GET'&&!init.body&&(url===config.officialUrl||url===placementUrl||url===mentorUrl||url===config.shellUrl||url.startsWith(config.root)||url===config.documentUrl)})
  let studentPlacementProduct
  const currentBinding=async html=>{
   const doc=readNativeDocument(html),root=doc.nodes(n=>n.tag==='root')[0],title=doc.nodes(n=>n.tag==='title'),links=doc.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>{try{return{url:new URL(n.attrs.href,config.officialUrl).href,label:clean(doc.text(n))}}catch{return null}}).filter(Boolean)
   if(title.length!==1||!decodeNativeEntities(title[0].raw).includes('AccioJob')||!links.some(link=>link.url===config.shellUrl&&link.label==='Careers'))throw reader.fail('current corporate employee Careers handoff binding changed')
   const productLinked=links.some(link=>['/jobs','/jobs.html'].includes(new URL(link.url).pathname)&&new URL(link.url).origin===new URL(config.officialUrl).origin)
   if(productLinked){const body=await(await reader.read(placementUrl,{method:'GET'})).text(),d=readNativeDocument(body),visibleText=d.text(d.nodes(n=>n.tag==='root')[0]);if(!/Hiring Partners/i.test(visibleText)||!/graduates|students/i.test(visibleText))throw reader.fail('advertised jobs product classification changed');studentPlacementProduct={url:placementUrl,classification:'third-party-student-placement-product',visibleText};classifications.push(studentPlacementProduct)}
   if(links.some(link=>link.url===mentorUrl)){
    const body=await(await reader.read(mentorUrl,{method:'GET'})).text(),d=readNativeDocument(body),visibleText=d.text(d.nodes(n=>n.tag==='root')[0]);if(!/AccioJob/i.test(visibleText)||!/Roles & Eligibility/i.test(visibleText)||!/earning potential/i.test(visibleText))throw reader.fail('own mentor public hiring surface changed')
    // This is paid recruitment by AccioJob. Its India mission, student market
    // and rupee earning example do not identify a mentor's work country or an
    // enumerable current vacancy total. Preserve the entire public criteria.
    const signal={url:mentorUrl,classification:'own-paid-mentor-hiring-signal',visibleText,workCountry:null,vacancyCount:null}
    if(!ownHiringSignals.length)ownHiringSignals.push(signal)
    else if(ownHiringSignals[0].visibleText!==visibleText)scopeGaps.add('own-mentor-public-criteria-changed-during-collection')
    scopeGaps.add('own-paid-mentor-hiring-signal-work-country-and-vacancy-scope-unresolved')
   }
   for(const link of links){const u=new URL(link.url)
    if(link.url===config.shellUrl||link.url===mentorUrl||u.hostname==='placement.acciojob.com'||u.origin===new URL(config.officialUrl).origin&&['/jobs','/jobs.html'].includes(u.pathname))continue
    if(/(?:ashbyhq|greenhouse|lever|workday|darwinbox|keka)\./i.test(u.hostname)||u.origin===new URL(config.officialUrl).origin&&/\/(?:careers?|openings?|vacanc(?:y|ies)|recruitment|jobs?)(?:\/|$)/i.test(u.pathname))scopeGaps.add('additional-employer-channel:'+link.url)
   }
   return{url:config.officialUrl,handoffUrl:config.shellUrl,visibleText:doc.text(root)}
  }
  const bindings=[]
  try{
   const execute=()=>runCurrentKeka(nativeConfig,nativeBaselines,{...nativeOptions,signal:reader.signal,fetchImpl:async(url,init)=>{
    const response=await reader.read(url,init)
    if(url===config.officialUrl)bindings.push(await currentBinding(await response.text()))
    return response
   }})
   const active=config.root+'api/embedjobs/default/active/'+config.identifier
   const raw=()=>JSON.parse(reader.responses.filter(r=>r.url===active).at(-1).body)
   const jobs=await execute(),nativeRoles=raw(),closingJobs=await execute(),closingNativeRoles=raw(),closing=new Map(closingNativeRoles.map(row=>[String(row.id),row])),heldRoles=[]
   for(let index=jobs.length-1;index>=0;index--){const job=jobs[index],native=job.sourceNativePayload,second=closingJobs.find(row=>row.jobId===job.jobId)
    if(JSON.stringify(native)!==JSON.stringify(closing.get(job.jobId))||!second||job.jobDescription!==second.jobDescription){heldRoles.push({jobId:job.jobId,reason:'closing-native-role-or-public-criteria-changed',nativeListing:native});jobs.splice(index,1)}}
   const stable=JSON.stringify(nativeRoles)===JSON.stringify(closingNativeRoles)
   if(!stable)scopeGaps.add('declared-employee-board-changed-during-full-detail-closing')
   const nativeEmployeeBoard=readInventoryEvidence(closingJobs),gaps=[...scopeGaps]
   for(const job of jobs){job.sourceScopeComplete=false;job.lifecycleCleanupAllowed=false;job.sourceUnreconciledOwnHiringSignals=ownHiringSignals}
   // A complete declared employee board and company-wide absence are separate
   // claims. The real own mentor channel remains unresolved rather than being
   // hidden among third-party student placement products.
   attachInventoryEvidence(jobs,gaps.length?{...nativeEmployeeBoard,status:'coverage-gap',listingComplete:false,reportedTotal:null,indiaFacetCount:null,reason:gaps.join(';')}:nativeEmployeeBoard)
   attachSourceObservationEvidence(jobs,{source:'acciojob',recordKind:ownHiringSignals.length?'mixed':'vacancy-rows',observedRecordCount:nativeRoles.length+ownHiringSignals.length,observedVacancyCount:nativeRoles.length,sourceScopeComplete:false})
   const result={jobs,nativeRoles,closingNativeRoles,heldRoles,nativeEmployeeBoard,studentPlacementProduct,ownHiringSignals,scopeGaps:gaps,bindings,responses:reader.responses,sourceScopeComplete:false,lifecycleCleanupAllowed:false,inventoryEvidence:readInventoryEvidence(jobs)}
   if(maxJobs>0&&jobs.length>maxJobs){jobs.splice(maxJobs);attachInventoryEvidence(jobs,{...result.inventoryEvidence,status:'discovery-only',listingComplete:false,reason:'caller-job-cap-after-full-native-reconciliation'});result.inventoryEvidence=readInventoryEvidence(jobs)}
   for(const job of jobs)job.sourceListingComplete=result.inventoryEvidence.listingComplete
   if(o.onAudit)await reader.waitFor(()=>o.onAudit(result));return result
  }finally{reader.dispose()}
 }
 return{collect,run:async options=>(await collect(options)).jobs}
}
