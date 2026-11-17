import assert from 'node:assert/strict'
import test from 'node:test'
import {auditCurrentWorkdayRawScope} from '../shared/workdayCurrentSourceScope.js'
import {runCurrentLexmarkInventory} from '../../scraper/lexmarkinternational/nativeCurrent.js'
import {run as runSunrun,BOARD_URL as SUNRUN_BOARD} from '../../scraper/sunrun/script.js'
import {runAllegionNative} from '../../scraper/allegion.workday/nativeRun.js'
import {runCarrierNative,API as CARRIER_API} from '../../scraper/carrier.workday/nativeRun.js'
import {run as runCarrierGlobal} from '../../scraper/carrierglobal.workday/script.js'
import {classifyScraperError} from '../utils/failureClassification.js'

const accelyaBoard='https://accelya.wd103.myworkdayjobs.com/Careers'
const accelyaAPI='https://accelya.wd103.myworkdayjobs.com/wday/cxs/accelya/Careers/jobs'
const lexmarkBoard='https://lexmark.wd1.myworkdayjobs.com/Lexmark'
const allegionBoard='https://allegion.wd5.myworkdayjobs.com/careers'
const lexmarkOfficial='https://www.lexmark.com/en_us/about-us/careers.html'
const lexmarkCorporate=()=>Object.defineProperty(new Response('<html><head><title>Lexmark Careers</title></head><body><a href="'+lexmarkBoard+'">Search all jobs</a></body></html>',{
 status:200,headers:{'content-type':'text/html'},
}),'url',{value:lexmarkOfficial})
const response=(url,status,finalUrl=url)=>Object.defineProperty(new Response('<html><body>Request unavailable</body></html>',{
 status,headers:{'content-type':'text/html; charset=UTF-8','retry-after':'7'},
}),'url',{value:finalUrl})
const carrierHome='https://www.carrier.com/us/en/'
const carrierRole='https://jobs.carrier.com/en/job/hyderabad/http-check/29289/1000000000'
const carrierPages={
 'https://www.corporate.carrier.com/':{url:carrierHome,title:'Intelligent Climate and Energy Solutions | Carrier',body:'Carrier Global Corporation (NYSE: CARR)<a href="'+carrierHome+'careers/">Careers</a><a href="'+carrierHome+'privacy-notice/">Privacy</a>'},
 [carrierHome+'privacy-notice/']:{body:'Carrier Global Corporation and its subsidiaries and affiliates (collectively, "Carrier")<a href="'+carrierHome+'careers/">Careers</a>'},
 [carrierHome+'careers/']:{title:'Careers | Carrier',body:'<a href="https://jobs.carrier.com/en">Careers</a>'},
 'https://jobs.carrier.com/en':{title:'Working at Carrier',body:'<a href="https://carrier.wd5.myworkdayjobs.com/jobs/login">Login</a><form method="get" action="/en/search-jobs"><input name="k" type="search"></form>'},
 'https://jobs.carrier.com/en/search-jobs?k=India':{title:'Search our Job Opportunities at Carrier',body:'<a href="'+carrierRole+'"><h2>HTTP Check</h2>Hyderabad, India</a>'},
 [carrierRole]:{title:'HTTP Check at Carrier',body:'<h1>HTTP Check</h1><meta name="job-ats-req-id" content="30212345"><span class="job-id">Job ID 30212345</span><a href="https://carrier.wd5.myworkdayjobs.com/jobs/job/India/HTTP-Check_30212345/apply">Apply</a>'},
}
const carrierPage=async url=>{
 const page=carrierPages[url];assert.ok(page,'Unexpected official Carrier request '+url)
 return{status:200,url:page.url||url,body:'<html><head><title>'+(page.title||'Carrier')+'</title><link rel="canonical" href="'+(page.url||url)+'"></head><body>'+page.body+'</body></html>'}
}

const sources=[
 ['Accelya raw CXS',accelyaAPI,t=>auditCurrentWorkdayRawScope({apiUrl:accelyaAPI,boardUrl:accelyaBoard,schema:{},signal:t.signal})],
 ['Lexmark board',lexmarkBoard,t=>runCurrentLexmarkInventory({signal:t.signal})],
 ['Sunrun board',SUNRUN_BOARD,(t,make)=>runSunrun({signal:t.signal,
  fetchPage:async url=>url===SUNRUN_BOARD?{url:make(url).url,status:make(url).status,html:'<html><body>Request unavailable</body></html>'}:{url,status:200,html:'<html><body><a href="'+SUNRUN_BOARD+'">Search jobs</a></body></html>'},
 })],
 ['Allegion board',allegionBoard,t=>runAllegionNative({signal:t.signal,now:()=>new Date().toISOString()})],
 ['Carrier CXS',CARRIER_API,t=>runCarrierNative({signal:t.signal,now:new Date().toISOString()})],
 ['Carrier Global delegated CXS',CARRIER_API,t=>runCarrierGlobal({signal:t.signal,fetchPage:carrierPage})],
]
test('Accelya raw CXS rejects an explicit HTTP 200 access challenge before accepting a zero payload',async t=>{
 t.mock.method(globalThis,'fetch',async()=>Object.defineProperty(new Response('{"total":0,"jobPostings":[]}',{
  status:200,headers:{'content-type':'application/json','cf-mitigated':'challenge'},
 }),'url',{value:accelyaAPI}))
 await assert.rejects(auditCurrentWorkdayRawScope({apiUrl:accelyaAPI,boardUrl:accelyaBoard,
  schema:{listingPayloadFields:['total','jobPostings']},signal:t.signal,
 }),error=>{
  assert.equal(error.status,200)
  assert.equal(error.accessChallenge,true)
  assert.equal(error.failureKind,'blocked_or_access_denied')
  assert.equal(error.softFailure,true)
  assert.equal(error.abortRetries,true)
  assert.equal(error.requestedUrl,accelyaAPI)
  assert.equal(error.lifecycleCleanupAllowed,false)
  return true
 })
})
for(const[name,target,run]of sources){
 for(const status of [429,403,503])test(name+' preserves unavailable HTTP '+status+' without certifying empty inventory',async t=>{
  const make=url=>response(url,status)
  t.mock.method(globalThis,'fetch',async url=>{
   if(url===target)return make(url)
   assert.equal(name,'Lexmark board','Unexpected request '+url)
   assert.equal(url,lexmarkOfficial,'Uncaptured corporate request '+url)
   return lexmarkCorporate()
  })
  await assert.rejects(run(t,make),error=>{
   assert.equal(error.status,status)
   assert.equal(error.httpStatus,status)
   assert.equal(error.requestedUrl,target)
   assert.equal(error.responseUrl,target)
   assert.equal(error.lifecycleCleanupAllowed,false)
   assert.match(error.message,new RegExp('HTTP '+status))
   assert.equal(classifyScraperError(error).softFailure,true)
   assert.equal(classifyScraperError(error).failureKind,status===503?'network_or_timeout':'blocked_or_access_denied')
   if(status===429&&name!=='Sunrun board')assert.equal(error.retryDelayMs,7000)
   return true
  })
 })
 test(name+' keeps HTTP 200 at an unrelated response URL a hard identity failure',async t=>{
  const make=url=>{const r=response(url,200,'https://unrelated.example/board');r.headers.set('cf-mitigated','challenge');return r}
  t.mock.method(globalThis,'fetch',async url=>{
   if(url===target)return make(url)
   assert.equal(url,lexmarkOfficial,'Uncaptured corporate request '+url)
   return lexmarkCorporate()
  })
  await assert.rejects(run(t,make),error=>{
   assert.equal(error.status,200)
   assert.equal(error.requestedUrl,target)
   assert.equal(error.responseUrl,'https://unrelated.example/board')
   assert.equal(error.softFailure,false)
   assert.equal(classifyScraperError(error).failureKind,'parser_or_contract_error')
   return true
  })
 })
}
