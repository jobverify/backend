import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
export const APOLLO_CORPORATE_CAREERS='https://corporate.apollotyres.com/careers/'
const HOME='https://apollotyres.csod.com/ux/ats/careersite/1/home?c=apollotyres',API='https://uk.api.csod.com/rec-job-search/external/jobs'
const UA='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36'
const check=(ok,message)=>{if(!ok)throw Error('Apollo native CSOD: '+message)}
const corporate=html=>{
 const document=readNativeDocument(html)
 check(activeHead(html).titles.includes('Careers | Apollo Tyres Corporate'),'current official employer identity changed')
 check(document.nodes(node=>node.tag==='a'&&node.attrs.href===HOME&&document.text(node)==='Click here to explore current job vacancies').length===1,'current official employer-to-CSOD handoff missing')
}
const context=html=>{
 const document=readNativeDocument(html),candidates=[]
 for(const node of document.nodes(node=>node.tag==='script'&&!node.attrs.src&&(!node.attrs.type||node.attrs.type==='text/javascript'))){
  const match=node.raw?.match(/^\s*if\s*\(!csod\.context\s*\|\|\s*!csod\.context\.token\)\s*csod\.context=(\{[\s\S]*\});\s*$/)
  if(match){let value;try{value=JSON.parse(match[1])}catch{throw Error('Apollo native CSOD: invalid public context JSON')};candidates.push(value)}
 }
 check(candidates.length===1,'anonymous public native context missing or ambiguous')
 const value=candidates[0]
 check(value.corp==='apollotyres'&&value.user===-100&&value.cultureID===1&&value.cultureName==='en-US','native employer tenant or anonymous context changed')
 check(value.endpoints?.cloud==='https://uk.api.csod.com/'&&value.endpoints.api==='/'&&value.serviceBase==='/','native public search endpoint context changed')
 check(typeof value.token==='string'&&value.token.length>20&&value.token.length<20000&&!/[\r\n]/.test(value.token),'native public anonymous bearer missing')
 check(/^\/player-career-site\/\d+\.\d+\.\d+\/$/.test(value.basePath||''),'native public client version invalid')
 const clients=document.nodes(node=>node.tag==='script'&&node.attrs.src===value.basePath+'pages/home.controls.js')
 check(clients.length===1,'native declared search client missing')
 return{token:value.token,client:new URL(clients[0].attrs.src,HOME).href,identity:{corp:value.corp,user:value.user,cultureId:value.cultureID,cultureName:value.cultureName,cloud:value.endpoints.cloud,clientBase:value.basePath}}
}
const client=code=>check(typeof code==='string'&&code.includes('rec-job-search/external/jobs')&&code.includes('careerSiteId:e,careerSitePageId:e,pageNumber:t,pageSize:n')
 &&code.includes('countryCodes:')&&code.includes('postingsWithinDays:')&&code.includes('customFieldCheckboxKeys:'),'native anonymous unfiltered search client contract changed')
const request=token=>({method:'POST',headers:{'User-Agent':UA,Accept:'application/json, text/plain, */*','Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({careerSiteId:1,careerSitePageId:1,pageNumber:1,pageSize:20,cultureId:1,cultureName:'en-US',searchText:'',states:'',countryCodes:'',cities:'',placeID:'',radius:0,postingsWithinDays:0,customFieldCheckboxKeys:[],customFieldDropdowns:[],customFieldRadios:[]})})
const inventory=payload=>{
 const data=payload?.data
 check(payload?.status==='Success'&&Number.isSafeInteger(data?.totalCount)&&data.totalCount>=0&&data.totalCount<=100000
  &&Array.isArray(data.requisitions)&&Array.isArray(data.filters)&&Array.isArray(data.customFieldFilters),'native search inventory status, total or arrays invalid')
 check(data.requisitions.length===Math.min(data.totalCount,20),'native first-page identity count contradicts total')
 check(data.requisitions.every(row=>Number.isSafeInteger(row?.requisitionId)&&row.requisitionId>0)&&new Set(data.requisitions.map(row=>row.requisitionId)).size===data.requisitions.length,'native requisition identities missing or repeated')
 return{reportedTotal:data.totalCount,uniqueRequisitionIds:data.requisitions.map(row=>String(row.requisitionId)),nativeFirstPage:structuredClone(data.requisitions),filters:structuredClone(data.filters),customFieldFilters:structuredClone(data.customFieldFilters)}
}
export async function runCurrentApollo(options={}){
 const timeout=Number.isSafeInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:120000,signal=AbortSignal.any([AbortSignal.timeout(timeout),...(options.signal?[options.signal]:[])])
 const wait=value=>new Promise((resolve,reject)=>{let done=false;const finish=(fn,result)=>{if(done)return;done=true;signal.removeEventListener('abort',abort);fn(result)},abort=()=>finish(reject,signal.reason);signal.addEventListener('abort',abort,{once:true});Promise.resolve(value).then(value=>finish(resolve,value),error=>finish(reject,error));if(signal.aborted)abort()})
 let requests=0
 const read=async(url,json=false,init={})=>{
  signal.throwIfAborted();requests++
  const result=await wait(Promise.resolve().then(async()=>{
   const override=json?options.fetchJson:options.fetchText
   if(override)return override(url,{...init,signal:options.signal||signal})
   const requestSignal=AbortSignal.any([signal,AbortSignal.timeout(25000)]),response=await fetch(url,{...init,signal:requestSignal,redirect:'manual',headers:init.headers||{'User-Agent':UA,Accept:'text/html,application/javascript'}})
   check(response.status===200&&(!response.url||response.url===url),'native HTTP status or endpoint identity changed at '+url)
   const text=await response.text();requestSignal.throwIfAborted();check(Buffer.byteLength(text)<=5000000,'native public response exceeds page budget');return json?JSON.parse(text):text
  }));signal.throwIfAborted();return result
 }
 corporate(await read(APOLLO_CORPORATE_CAREERS))
 const openingContext=context(await read(HOME)),openingClient=await read(openingContext.client);client(openingClient)
 const opening=inventory(await read(API,true,request(openingContext.token)))
 const closingContext=context(await read(HOME)),closingClient=await read(closingContext.client);client(closingClient)
 const closing=inventory(await read(API,true,request(closingContext.token)));corporate(await read(APOLLO_CORPORATE_CAREERS))
 const stable=JSON.stringify(openingContext.identity)===JSON.stringify(closingContext.identity)&&openingClient===closingClient&&JSON.stringify(opening)===JSON.stringify(closing)
 const complete=stable&&opening.reportedTotal===0&&closing.reportedTotal===0
 const failures=complete?[]:[{stage:'native-current-inventory',message:opening.reportedTotal||closing.reportedTotal?'Positive native requisitions require full same-ID public details, explicit country and original-date qualification before publication; no India or full-description default is used.':'Current employer/client or opening/closing native inventory changed.'}]
 const audit={source:'apollo',observedListingCount:opening.reportedTotal,observedIndiaListingCount:complete?0:null,candidateDetails:opening.nativeFirstPage.length,extractedDetailJobs:0,
  opening,closing,openingContext:openingContext.identity,closingContext:closingContext.identity,closingInventoryMatches:stable,listingPaginationComplete:complete,
  sourceScopeComplete:complete,sourceDeclaredBoardScopeComplete:complete,sourceCompanyWideScopeComplete:false,failures,jobs:[]}
 const jobs=attachInventoryEvidence([],{firstParty:true,surface:HOME,status:complete?'verified-empty':'coverage-gap',listingComplete:complete,reportedTotal:opening.reportedTotal,indiaFacetCount:complete?0:null,
  pagesFetched:requests,verifiedAt:new Date().toISOString(),reason:complete?'Current active Apollo Tyres corporate careers handoff binds anonymous tenant apollotyres/CSOD careersite1; declared native client unfiltered public search explicitly returns Success,totalCount0,empty IDs at opening and closing; company-wide recruiting channels remain unknown'
   :'Current declared Apollo CSOD inventory is incomplete: '+failures.map(row=>row.message).join('; ')})
 if(options.onAudit)await wait(Promise.resolve().then(()=>options.onAudit(audit)))
 signal.throwIfAborted();return jobs
}
