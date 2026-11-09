import{createHash}from'node:crypto'
import{activeHead,readNativeDocument}from'../../scraper-support/utils/activeNativeHtml.js'
import{attachInventoryDelegationEvidence}from'../../scraper-support/utils/inventoryDelegationEvidence.js'
import{attachInventoryEvidence,readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{runCurrentBounteous,CAREER_PAGE_URL,LEVER_ENDPOINT,TURBOHIRE_ENDPOINT}from'../bounteous/currentNative.js'

export const CURRENT_COMPANY_URL='https://www.bounteous.com/about/company-news'
export const MERGER_URL='https://www.bounteous.com/insights/2024/02/01/press-release-bounteous-and-accolite-join-forces-forming-global-leader-digital/'
const check=(ok,message)=>{if(!ok)throw Error('Accolite canonical delegation: '+message)}
const text=html=>{const doc=readNativeDocument(html);return doc.nodes(node=>node.tag==='body').map(doc.text).join(' ')}
function corporate(html,url){
 const value=text(html),titles=activeHead(html).titles
 if(url===CURRENT_COMPANY_URL)check(titles.includes('Company News | Bounteous')&&value.includes('In 2024, a pivotal milestone reshaped our trajectory. The merger with Accolite Digital brought together'),'current official employer merger relationship/continuity changed')
 else check(titles.includes('Bounteous and Accolite Join Forces | Bounteous')&&value.includes('February 1, 2024')&&/Bounteous\s*,.*Accolite Digital\s*,.*have announced their merger/.test(value),'official original merger statement identity/continuity changed')
}
function observationClock(value,now){
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value))return null
 const at=Date.parse(value),[year,month,day]=value.slice(0,10).split('-').map(Number),calendar=new Date(Date.UTC(year,month-1,day))
 return Number.isFinite(at)&&at>0&&at<=now&&calendar.getUTCFullYear()===year&&calendar.getUTCMonth()===month-1&&calendar.getUTCDate()===day?at:null
}
export async function runCurrentAccoliteDelegation(options={}){
 const signal=AbortSignal.any([AbortSignal.timeout(Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:300000),...(options.signal?[options.signal]:[])])
 const wait=promise=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,value)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(value)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(promise).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 signal.throwIfAborted();const attemptStartedAt=Date.now(),observations=[]
 const observe=async page=>{observations.push({url:page.url,finalUrl:page.finalUrl,status:page.status,sha256:page.sha256,capturedAt:page.capturedAt,requestedAt:page.requestedAt,completedAt:page.completedAt});if(options.onResponse)await wait(Promise.resolve().then(()=>options.onResponse(page)));signal.throwIfAborted()}
 const read=async url=>{
  signal.throwIfAborted();const requestedAt=new Date().toISOString(),packet=await wait(Promise.resolve().then(async()=>{
   if(options.fetchPage)return options.fetchPage(url,{signal,headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html'}})
   const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(30000)]),response=await fetch(url,{signal:requestSignal,headers:{'User-Agent':'Mozilla/5.0',Accept:'text/html'},redirect:'manual'}),body=await response.text();requestSignal.throwIfAborted();return{status:response.status,url:response.url,body,capturedAt:new Date().toISOString()}
  }));signal.throwIfAborted();check(packet?.status===200&&packet.url===url,'current original corporate HTTP status/final URL identity changed')
  check(typeof packet.body==='string'&&Buffer.byteLength(packet.body)<=3000000,'invalid original corporate body')
  corporate(packet.body,url);await observe({url,finalUrl:packet.url,status:packet.status,sha256:createHash('sha256').update(packet.body).digest('hex'),body:packet.body,requestedAt,completedAt:new Date().toISOString(),capturedAt:Object.getOwnPropertyDescriptor(packet,'capturedAt')?.value||null})
 }
 await read(CURRENT_COMPANY_URL);await read(MERGER_URL)
 let childAudit
 const jobs=await runCurrentBounteous({...options,signal,onAudit:audit=>{childAudit=audit},onResponse:observe})
 await read(CURRENT_COMPANY_URL);await read(MERGER_URL)
 check(jobs.every(job=>job.source==='bounteous'&&job.company==='Bounteous'),'canonical returned source/employer identity changed')
 const relevant=observations.filter(page=>[CURRENT_COMPANY_URL,MERGER_URL,CAREER_PAGE_URL,LEVER_ENDPOINT,TURBOHIRE_ENDPOINT].includes(page.url)),now=Date.now(),clocks=relevant.map(page=>observationClock(page.capturedAt,now))
 const withinAttempt=relevant.every((page,index)=>{const requested=observationClock(page.requestedAt,now),completed=observationClock(page.completedAt,now),captured=clocks[index];return requested!==null&&completed!==null&&captured!==null&&requested>=attemptStartedAt&&requested<=captured&&captured<=completed&&completed<=now})
 const qualified=relevant.length===10&&withinAttempt&&[CURRENT_COMPANY_URL,MERGER_URL,CAREER_PAGE_URL,LEVER_ENDPOINT,TURBOHIRE_ENDPOINT].every(url=>relevant.filter(page=>page.url===url).length===2)
 let proof=null
 if(qualified){proof={source:'accolitedigital',sources:['bounteous'],preservesChildSourceAndCompany:true,verifiedAt:new Date(Math.min(...clocks)).toISOString(),evidence:{method:'official-current-bounteous-merger-canonical-delegation',url:CURRENT_COMPANY_URL,responses:relevant.map(({url,finalUrl,status,sha256})=>({url,finalUrl,status,sha256}))}};attachInventoryDelegationEvidence(jobs,proof)}
 else attachInventoryEvidence(jobs,{...readInventoryEvidence(jobs),status:'coverage-gap',listingComplete:false,reason:'Canonical Bounteous details retained; original corporate/board/feed clocks do not all fall within their actual request windows in this extraction attempt/cohort.'})
 const audit={...childAudit,source:'accolitedigital',canonicalSource:'bounteous',preservesChildSourceAndCompany:true,inventoryDelegationEvidence:proof,
  sourceScopeComplete:qualified&&childAudit.sourceDeclaredBoardScopeComplete,sourceDeclaredBoardScopeComplete:qualified&&childAudit.sourceDeclaredBoardScopeComplete,
  sourceCompanyWideScopeComplete:false,sourceLifecycleCleanupVerified:false,delegationResponses:relevant,delegationCohort:{attemptStartedAt:new Date(attemptStartedAt).toISOString(),completedAt:new Date(now).toISOString(),responseCount:relevant.length,currentAttemptQualified:withinAttempt},
  reason:'Historical Accolite Digital now uses the current combined Bounteous brand/declared careers inventory. Returned canonical employer/source/identity remain unchanged; no assertion of a separate current Accolite legal hiring entity.'}
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
