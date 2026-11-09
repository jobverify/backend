import {createHash} from 'node:crypto'
import {decodeHTML} from 'entities'
import {withCallerSignal} from '../abmknowledgeware/publicIntake.js'
import {activeHead,readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {extractLinkedinJobCards} from '../../scraper-support/utils/linkedinJobCards.js'
import {attachInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {attachSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

export const PROFILE='https://www.linkedin.com/company/ami/'
export const SEARCH='https://www.linkedin.com/jobs/search/?f_C=635771&geoId=102713980'
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const leaf=value=>norm(decodeHTML(String(value??'')))
const fail=(source,message,code='AMI_PUBLIC_ENTRY_CHANGED',status=null)=>Object.assign(Error('AMI public source: '+message),{source,code,status,abortRetries:true,failureKind:[401,403,429].includes(status)?'blocked':'source_inventory_unavailable'})
function model(html,url,source){
 const doc=readNativeDocument(html),head=activeHead(html)
 if(url===PROFILE){
  if(head.titles.length!==1||head.titles[0]!=='AMI | LinkedIn'||doc.nodes(n=>n.tag==='h1'&&doc.text(n)==='AMI').length!==1||doc.nodes(n=>n.tag==='section'&&n.attrs['data-entity-id']==='urn:li:organization:635771').length!==1)throw fail(source,'current public organization identity is unqualified')
  const nativeWebsites=doc.nodes(n=>n.tag==='a'&&n.attrs.href?.startsWith('https://www.linkedin.com/redir/redirect?')).flatMap(n=>{const value=new URL(n.attrs.href).searchParams.get('url');return value&&/^https?:\/\/(?:www\.)?ami\.com\/?$/.test(value)?[value]:[]})
  return{kind:'public-organization-profile',nativeName:'AMI',nativeOrganizationUrn:'urn:li:organization:635771',nativeWebsites:[...new Set(nativeWebsites)],declaredCompleteRoleFeed:false}
 }
 if(head.titles.length!==1||!/^.+AMI.+LinkedIn$/.test(head.titles[0]))throw fail(source,'current configured public guest-search publisher changed')
 const nativeKeywords=[...new Set(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='keywords').map(n=>n.attrs.value??''))],nativeLocations=[...new Set(doc.nodes(n=>n.tag==='input'&&n.attrs.name==='location').map(n=>n.attrs.value??''))],cards=extractLinkedinJobCards(html).map(row=>({postingId:row.id,title:leaf(row.title),nativeEmployer:leaf(row.company),nativeLocation:leaf(row.location),sourceUrl:row.href,nativeDateTime:row.datetime??null})).sort((a,b)=>a.postingId.localeCompare(b.postingId))
 return{kind:'configured-public-guest-search-unqualified-inventory',url:SEARCH,title:head.titles[0],nativeKeywords,nativeLocations,cards,unfilteredEmployerInventoryQualified:false,nativeVacancyTotal:null,indiaVacancyTotal:null}
}
export const createCurrentAmiScraper=(defaults={})=>{
 const source='ami'
 return{async run(passed={}){
  const options={...defaults,...passed},caller=options.signal,budget=options.collectionBudgetMs??60000
  caller?.throwIfAborted();if(!Number.isSafeInteger(budget)||budget<=0||budget>300000)throw TypeError('Invalid AMI collection budget')
  const deadline=new AbortController(),timeout=fail(source,'collection deadline exceeded','AMI_COLLECTION_TIMEOUT'),timer=setTimeout(()=>deadline.abort(timeout),budget),signal=caller?AbortSignal.any([caller,deadline.signal]):deadline.signal,responses=[]
  let previousStart=0
  const read=async(url,phase)=>{
   signal.throwIfAborted();const supplied=options.fetchPage??options.fetchText
   if(!supplied&&Date.now()-previousStart<500)await withCallerSignal(()=>new Promise(resolve=>setTimeout(resolve,500-(Date.now()-previousStart))),signal)
   previousStart=Date.now();const controller=new AbortController(),requestSignal=AbortSignal.any([signal,controller.signal,AbortSignal.timeout(15000)])
   let response,reader
   const discard=async()=>{const body=reader??response?.body;if(body?.cancel)await withCallerSignal(()=>body.cancel(),AbortSignal.timeout(500)).catch(()=>{})}
   try{
    const request={method:'GET',redirect:'manual',signal:requestSignal,headers:{'User-Agent':'Mozilla/5.0 (compatible; JobverifyCareerScraper/1.0)',Accept:'text/html,application/xhtml+xml,*/*;q=0.8'}}
    response=await withCallerSignal(()=>supplied?supplied(url,request):(options.fetchImpl??globalThis.fetch)(url,request),requestSignal)
    const textOnly=typeof response==='string',status=textOnly?null:response?.status,finalUrl=textOnly?null:response?.url
    if([401,403,429].includes(status))throw fail(source,'HTTP '+status+'; stopped without retry or private fallback','AMI_PUBLIC_ACCESS_DENIED',status)
    if(!textOnly&&(status!==200||finalUrl!==url))throw fail(source,'public response status or final URL changed','AMI_PUBLIC_RESPONSE_UNQUALIFIED',status??null)
    let html=textOnly?response:response.html??(typeof response.body==='string'?response.body:undefined),bytes
    if(html===undefined&&response.body?.getReader){reader=response.body.getReader();const parts=[];let size=0;for(;;){const part=await withCallerSignal(()=>reader.read(),requestSignal);if(part.done)break;size+=part.value.byteLength;if(size>2*1024*1024)throw fail(source,'public response exceeds byte limit');parts.push(Buffer.from(part.value))}bytes=Buffer.concat(parts);html=new TextDecoder('utf-8',{fatal:true}).decode(bytes);reader.releaseLock();reader=null}
    else if(html===undefined&&typeof response.text==='function')html=await withCallerSignal(()=>response.text(),requestSignal)
    if(typeof html!=='string'||Buffer.byteLength(html)>2*1024*1024)throw fail(source,'public response body unavailable or oversized')
    const current=model(html,url,source);bytes??=Buffer.from(html);const record={phase,url,finalUrl,status,firstParty:!textOnly,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};responses.push(record)
    if(options.onResponse)await withCallerSignal(()=>options.onResponse({...record,bodyBase64:bytes.toString('base64')}),signal)
    return current
   }finally{controller.abort();await discard()}
  }
  const execute=async()=>{
   const opening={profile:await read(PROFILE,'opening'),search:await read(SEARCH,'opening')},closing={profile:await read(PROFILE,'closing'),search:await read(SEARCH,'closing')},closingReconciled=JSON.stringify(opening)===JSON.stringify(closing)
   const observedCandidates=closing.search.cards.map(row=>({source,company:null,jobId:row.postingId,requisitionId:null,title:row.title,sourceUrl:row.sourceUrl,sourceNativeObservedEmployer:row.nativeEmployer,sourceNativeObservedLocation:row.nativeLocation,sourceNativePostingDateTime:row.nativeDateTime,country:null,postingDate:null,sourceNativeEmployerBindingUnresolved:true,sourceNativeActiveMembershipUnresolved:true,sourceDetailComplete:false,sourceCurrentNativeRoleQualified:false,sourceScopeComplete:false,lifecycleCleanupAllowed:false})),observations=observedCandidates.length?observedCandidates:[{source,company:'AMI',sourceUrl:PROFILE,kind:'public-company-profile-with-unqualified-configured-guest-search',nativeOrganizationUrn:opening.profile.nativeOrganizationUrn,jobId:null,requisitionId:null,country:null,postingDate:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false}],evidence={status:'coverage-gap',surface:SEARCH,firstParty:responses.every(row=>row.firstParty),listingComplete:false,pagesFetched:responses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:'configured-public-guest-search-native-keywords-and-complete-employer-role-inventory-unqualified;no-company-or-India-zero-proof'},audit={source,opening,closing,closingReconciled,observedCandidates,observations,responses,inventoryEvidence:evidence,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,sourceDeclaredBoardScopeComplete:false,sourceCompanyWideScopeComplete:false,lifecycleCleanupAllowed:false,privateApplicationRequests:0,corporateDeniedRouteRetried:false,productionWrites:false}
   if(options.onRecords)await withCallerSignal(()=>options.onRecords(structuredClone(observations)),signal)
   if(options.onAudit)await withCallerSignal(()=>options.onAudit(structuredClone(audit)),signal)
   const jobs=attachInventoryEvidence([],evidence);attachSourceObservationEvidence(jobs,{source,recordKind:observedCandidates.length?'vacancy-rows':'hiring-signals',observedRecordCount:observations.length,observedVacancyCount:observedCandidates.length,sourceScopeComplete:false});signal.throwIfAborted();return jobs
  }
  try{return await withCallerSignal(execute,signal)}finally{clearTimeout(timer);deadline.abort()}
 }}
}
