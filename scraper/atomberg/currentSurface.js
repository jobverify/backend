import{createHash}from'node:crypto'
import{readNativeDocument,decodeNativeEntities}from'../../scraper-support/utils/activeNativeHtml.js'
import{attachInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
import{attachSourceObservationEvidence}from'../../scraper-support/utils/sourceObservationEvidence.js'
const clean=value=>String(value??'').replace(/\s+/g,' ').trim()
export function createSurfaceReader(source,{fetchImpl=fetch,signal,timeoutMs=120000,requestTimeoutMs=20000}={},allowed){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0||!Number.isFinite(requestTimeoutMs)||requestTimeoutMs<=0)throw Error(source+' invalid public budget')
 const clock=new AbortController(),timer=setTimeout(()=>clock.abort(Error(source+' public collection deadline exceeded')),timeoutMs),active=signal?AbortSignal.any([signal,clock.signal]):clock.signal,responses=[],deniedHosts=new Map()
 const fail=(message,status)=>Object.assign(Error(source+' '+message),{abortRetries:true,...(status?{status}:{}),failureKind:[401,403,429].includes(status)?'blocked_or_access_denied':'parser_or_contract_error'})
 const wait=(operation,s=active)=>new Promise((resolve,reject)=>{const abort=()=>{s.removeEventListener('abort',abort);reject(signal?.aborted?signal.reason:s.reason)};if(s.aborted){abort();return}s.addEventListener('abort',abort,{once:true});Promise.resolve().then(operation).then(value=>{s.removeEventListener('abort',abort);s.aborted?abort():resolve(value)},error=>{s.removeEventListener('abort',abort);s.aborted?abort():reject(error)})})
 const read=async(url,{redirectTo}={})=>{
  active.throwIfAborted();if(!allowed(url))throw fail('unreviewed public URL');const host=new URL(url).host;if(deniedHosts.has(host))throw fail('public host unavailable',deniedHosts.get(host))
  const requestClock=new AbortController(),requestTimer=setTimeout(()=>requestClock.abort(Error(source+' public request deadline exceeded')),requestTimeoutMs),requestSignal=AbortSignal.any([active,requestClock.signal])
  try{
   let response;try{response=await wait(()=>fetchImpl(url,{method:'GET',redirect:'manual',signal:requestSignal,headers:{Accept:'text/html,application/javascript','User-Agent':'JobverifyScraper/1.0'}}),requestSignal)}catch(error){if(requestSignal.aborted)throw error;throw fail('public transport unavailable')}
   if([401,403,429].includes(response.status)){deniedHosts.set(host,response.status);Promise.resolve().then(()=>response.body?.cancel?.()).catch(()=>{});throw fail('public HTTP '+response.status,response.status)}
   if(response.url!==url)throw fail('response URL identity changed')
   if(response.status!==200&&!(redirectTo&&[301,302,307,308].includes(response.status)))throw fail('public HTTP '+response.status,response.status)
   let body;try{body=await wait(()=>response.text(),requestSignal)}catch(error){if(requestSignal.aborted)throw error;throw fail('public response body unavailable')}
   if(typeof body!=='string'||Buffer.byteLength(body)>8*1024*1024)throw fail('public response exceeds reviewed bound')
   const row={url,status:response.status,body,sha256:createHash('sha256').update(body).digest('hex'),completedAt:new Date().toISOString()};responses.push(row)
   if(response.status!==200){let target;try{target=new URL(response.headers?.get?.('location'),url).href}catch{}if(target!==redirectTo)throw fail('configured careers redirect binding changed')}
   return row
  }finally{clearTimeout(requestTimer)}
 }
 return{read,responses,wait,fail,signal:active,dispose:()=>clearTimeout(timer)}
}
const emailFromHex=value=>{if(!/^(?:[a-f\d]{2}){3,}$/i.test(value??''))return null;const key=parseInt(value.slice(0,2),16);return value.slice(2).match(/../g).map(char=>String.fromCharCode(parseInt(char,16)^key)).join('')}
const ats=/\b(?:ashbyhq|greenhouse|lever|workdayjobs|myworkdayjobs|keka|darwinbox|peoplestrong|oraclecloud|smartrecruiters)\./i
function inspect(c,body,fail){
 const d=readNativeDocument(body),root=d.nodes(n=>n.tag==='root')[0],titles=d.nodes(n=>n.tag==='title'),canonical=d.nodes(n=>n.tag==='link'&&n.attrs.rel==='canonical')
 if(titles.length!==1||!c.title.test(decodeNativeEntities(titles[0].raw))||canonical.length>1||canonical.length===1&&canonical[0].attrs.href!==c.canonicalUrl||canonical.length===0&&c.requireCanonical!==false)throw fail('current employer canonical/title binding changed')
 const visibleText=d.text(root),links=d.nodes(n=>n.tag==='a'&&n.attrs.href).map(n=>{try{return{url:new URL(n.attrs.href,c.canonicalUrl).href,label:clean(d.text(n))}}catch{return null}}).filter(Boolean)
 if(!visibleText.includes(c.companySignal))throw fail('current employer visible identity changed')
 const addresses=[...links.filter(row=>row.url.startsWith('mailto:')).map(row=>row.url.slice(7).split('?')[0]),...d.nodes(n=>n.attrs['data-cfemail']).map(n=>emailFromHex(n.attrs['data-cfemail']))].filter(Boolean)
 if(c.email&&(!addresses.includes(c.email)||!c.recruitingCopy.test(visibleText)))throw fail('current public hiring contact binding changed')
 const additionalHiringChannels=links.filter(row=>ats.test(new URL(row.url).hostname)||new URL(row.url).origin===new URL(c.canonicalUrl).origin&&/^\/(?:careers?|jobs?|openings?)\/.+/i.test(new URL(row.url).pathname)).filter(row=>![c.url,c.canonicalUrl].includes(row.url))
 const inactiveObservations=[]
 if(c.source==='avanse')for(const comment of body.matchAll(/<!--([\s\S]*?)-->/g))if(comment[1].includes('/public/api/getAllJobs')){const inner=readNativeDocument(comment[1]);inactiveObservations.push({active:false,classification:'commented-out-jobs-template-and-native-client',nativePublicApiPath:'/public/api/getAllJobs',titles:inner.nodes(n=>n.tag==='h5').map(n=>inner.text(n)),originalComment:comment[1]})}
 const activeJobClientPresent=d.nodes(n=>n.tag==='script'&&!n.attrs.src&&/getAllJobs|renderJobs/.test(n.raw??'')).length>0
 const jobSchemas=[];for(const s of d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json')){let value;try{value=JSON.parse(s.raw)}catch{continue}const walk=v=>{if(!v||typeof v!=='object')return;if(v['@type']==='JobPosting'||Array.isArray(v['@type'])&&v['@type'].includes('JobPosting'))jobSchemas.push(v);for(const child of Object.values(v))if(child&&typeof child==='object')walk(child)};walk(value)}
 return{url:c.canonicalUrl,title:decodeNativeEntities(titles[0].raw),visibleText,hiringSignals:[{classification:c.email?'generic-email-recruitment-contact':'employer-careers-culture-page',url:c.canonicalUrl,applicationEmail:c.email??null,workCountry:null,vacancyCount:null,publicRecruitingCopy:c.email?visibleText.match(c.recruitingCopy)?.[0]??null:null}],additionalHiringChannels,inactiveObservations,activeJobClientPresent,unreviewedNativeJobSchemas:jobSchemas}
}
export function createCurrentSurfaceScraper(c,defaults={}){
 const collect=async(options={})=>{
  const o={...defaults,...options};if(o.fetchText||o.fetchPage)throw Error(c.source+' requires observed status/final URL fetchImpl')
  const reader=createSurfaceReader(c.source,o,url=>[c.url,c.canonicalUrl].includes(url))
  const snapshot=async()=>{const response=await reader.read(c.url,{redirectTo:c.canonicalUrl});return inspect(c,response.status===200?response.body:(await reader.read(c.canonicalUrl)).body,reader.fail)}
  try{const opening=await snapshot(),closing=await snapshot(),jobs=[],closingStable=JSON.stringify(opening.hiringSignals)===JSON.stringify(closing.hiringSignals)&&JSON.stringify(opening.additionalHiringChannels)===JSON.stringify(closing.additionalHiringChannels)&&opening.activeJobClientPresent===closing.activeJobClientPresent
   const evidence={status:'coverage-gap',surface:c.canonicalUrl,firstParty:true,listingComplete:false,pagesFetched:reader.responses.length,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString(),reason:c.source+'-current-public-'+(c.email?'generic-hiring-contact':'culture-page-with-commented-native-jobs')+';active-vacancy-inventory-work-country-and-whole-company-scope-unresolved'+(!closingStable?';closing-surface-changed':'')}
   attachInventoryEvidence(jobs,evidence);attachSourceObservationEvidence(jobs,{source:c.source,recordKind:'hiring-signals',observedRecordCount:opening.hiringSignals.length,observedVacancyCount:0,sourceScopeComplete:false})
   const result={jobs,...opening,closing,closingStable,responses:reader.responses,inventoryEvidence:evidence,companyGlobalTotal:null,companyIndiaTotal:null,sourceScopeComplete:false,lifecycleCleanupAllowed:false}
   if(o.onAudit)await reader.wait(()=>o.onAudit(result));return result
  }finally{reader.dispose()}
 }
 return{collect,run:async options=>(await collect(options)).jobs}
}
