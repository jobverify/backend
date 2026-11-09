import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as finolex from '../../scraper/finolexindustrieslimited/script.js'
import {run as runGoodnotes} from '../../scraper/goodnotes/script.js'
import {createCurrentNativeReader} from '../native-sources/boundedCurrentNativeRead20261106.js'
import {boundedDeclaredPublicGet} from '../native-sources/boundedDeclaredPublicGet.js'
import {readOriginalNativeCriteria} from '../native-sources/currentNativeCriteria20261106.js'
import {getScraperCatalog,createCatalogScraper,decorateJobsWithProviderMetadata} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C27/capture.json.gz',import.meta.url))))
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/currentNative20261106C27/expectations.json',import.meta.url),'utf8'))
const sha=value=>createHash('sha256').update(value).digest('hex'),compact=value=>value.replace(/\s/g,''),failure=message=>new Error(message)
const career='https://www.finolexpipes.com/career/',client='https://www.finolexpipes.com/site/templates/assets/js/career-new.js',listing='https://www.finolexpipes.com/apis/joblist/'
function transport({mutate=(_,value)=>value,seen=[]}={}){
 return async(url,init={})=>{
  seen.push({url,method:init.method??'GET',body:init.body??null})
  const original=fixture.responses.find(row=>row.requestedUrl===url)
  assert.ok(original,'Unexpected original URL: '+url)
  const row=mutate(url,structuredClone(original),seen)
  // html is included solely so the untouched legacy scraper can reproduce its
  // false empty result. New readers require the original body/HTTP metadata.
  return {status:row.status,url:row.finalUrl,finalUrl:row.finalUrl,headers:row.headers,body:row.body,html:row.body}
 }
}
let finolexPromise,goodnotesPromise
const currentFinolex=()=>finolexPromise??=finolex.createFinolexIndustriesLimitedScraper().run({fetchPage:transport()})
const currentGoodnotes=()=>goodnotesPromise??=runGoodnotes({fetchPage:transport()})

test('Finolex reads the native inventory instead of certifying an empty render template',async()=>{
 const jobs=await currentFinolex();assert.equal(jobs.length,14)
 assert.deepEqual(jobs.map(row=>row.jobId),['43','44','45','46','47','48','49','50','51','52','53','54','55','56'])
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,14)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Finolex preserves all native criteria including the two short distinct vendor vacancies',async()=>{
 const jobs=await currentFinolex();assert.equal(jobs.length,14)
 for(const want of expected.finolex){
  const got=jobs.find(row=>row.jobId===want.id);assert.ok(got,'Missing native ID '+want.id)
  assert.equal(sha(got.sourceDescriptionHTML),want.htmlSHA256)
  assert.equal(sha(compact(got.jobDescription)),want.compactTextSHA256)
  assert.equal(got.sourceDetailComplete,true)
  assert.equal(sha(JSON.stringify(got.sourceNativeJobRecord)),sha(JSON.stringify(want.native)))
 }
 assert.equal(jobs.find(row=>row.jobId==='55').sourceDetailComplete,true)
 assert.equal(jobs.find(row=>row.jobId==='56').sourceDetailComplete,true)
})
test('Finolex does not invent country, formal requisition, publication date or a per-role URL',async()=>{
 const jobs=await currentFinolex();assert.equal(jobs.length,14)
 for(const row of jobs){
  assert.equal(row.country,null);assert.equal(row.sourceCountryScopeUnresolved,true)
  assert.equal(row.requisitionId,null);assert.equal(row.postingDate,null);assert.equal(row.nativeDisplayDate,'2026-04-24')
  assert.equal(row.applyUrl,career);assert.equal(row.applicationUrlIsGeneric,true);assert.equal(row.lifecycleCleanupAllowed,false)
 }
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,14)
})
test('exported Finolex run forwards an already aborted caller without requesting a document',async()=>{
 const controller=new AbortController(),reason=new Error('caller stopped Finolex'),seen=[];controller.abort(reason)
 await assert.rejects(finolex.run({signal:controller.signal,fetchPage:transport({seen})}),error=>error===reason)
 assert.equal(seen.length,0)
})
test('Finolex rejects HTTP 500 even when old empty markers and a server-error phrase coexist',async()=>{
 await assert.rejects(finolex.createFinolexIndustriesLimitedScraper().run({fetchPage:transport({mutate:(url,row)=>url===career?{...row,status:500,body:row.body+'<!--500 Internal Server Error-->'}:row})}),/HTTP 500/)
})
test('Finolex never turns a native Error object into an authoritative empty inventory',async()=>{
 await assert.rejects(finolex.createFinolexIndustriesLimitedScraper().run({fetchPage:transport({mutate:(url,row)=>url===listing?{...row,body:'{"Status":"Error"}'}:row})}),/record|array|listing/i)
})
test('a successful empty Finolex array retains unresolved company scope and current request receipts',async()=>{
 const jobs=await finolex.createFinolexIndustriesLimitedScraper().run({fetchPage:transport({mutate:(url,row)=>url===listing?{...row,body:'[]'}:row})})
 assert.equal(jobs.length,0);assert.ok(jobs.nativeCollectionEvidence)
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,0);assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.reader.receipts.filter(row=>row.method==='POST').length,2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Goodnotes reads the current board and all role pages before projecting explicit countries',async()=>{
 const jobs=await currentGoodnotes();assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,'6216615004');assert.equal(jobs[0].country,null)
 assert.equal(jobs[0].requisitionId,'433');assert.equal(jobs[0].postingDate,'2026-10-06T04:14:31-04:00')
 assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,5)
 assert.equal(jobs.nativeCollectionEvidence.observedForeignCount,4);assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,1)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.closingReconciled,true)
 assert.equal(readSourceObservationEvidence(jobs,'goodnotes').recordKind,'vacancy-rows')
 assert.equal(readSourceObservationEvidence(jobs,'goodnotes').observedVacancyCount,5)
})
test('Goodnotes retains full original introduction, criteria and conclusion for the unresolved-country role',async()=>{
 const jobs=await currentGoodnotes();assert.equal(jobs.length,1)
 const want=expected.goodnotes.find(row=>row.id==='6216615004'),got=jobs[0]
 assert.equal(sha(got.sourceDescriptionHTML),want.htmlSHA256)
 assert.equal(sha(compact(got.jobDescription)),want.compactTextSHA256)
 assert.equal(got.sourceDetailComplete,true);assert.equal(got.company,'Goodnotes');assert.equal(got.legalEmployer,null)
 assert.equal(got.applyUrl,'https://job-boards.greenhouse.io/goodnotes/jobs/6216615004')
 assert.equal(got.applicationUrlIsGeneric,false)
})
test('the default catalog uses current runtime metadata for all four repaired sources',()=>{
 const catalog=getScraperCatalog()
 for(const source of ['finolexindustrieslimited','goodnotes','dentalkart','dhan']){
  const provider=catalog.find(row=>row.source===source);assert.ok(provider)
  assert.equal(provider.verifiedPublicJobCount,null,source+' must not advertise a historical verified zero')
  assert.equal(provider.verifiedIndiaJobCount,null,source+' has no qualified current company-wide India total')
  assert.equal(provider.verifiedOn,null);assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
 }
 const custom=getScraperCatalog({providerExtensions:[{source:'goodnotes',catalogOverride:true,companyName:'Explicit override',companyCareerPage:'https://www.goodnotes.com/careers',adapter:'script',modulePath:'../../scraper/goodnotes/script.js'}]}).find(row=>row.source==='goodnotes')
 assert.equal(custom.companyName,'Explicit override')
})
test('the default configured Finolex scraper runs the current protocol and preserves unknown country',async()=>{
 const provider=getScraperCatalog().find(row=>row.source==='finolexindustrieslimited')
 const jobs=await createCatalogScraper(provider).run({fetchPage:transport()})
 assert.equal(jobs.length,14);assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('provider decoration retains native closing holds and full original records for review',async()=>{
 const native=await currentFinolex(),provider=getScraperCatalog().find(row=>row.source==='finolexindustrieslimited')
 const decorated=decorateJobsWithProviderMetadata(native,provider)
 assert.ok(decorated.nativeCollectionEvidence,'Default configured runs must retain the native evidence')
 assert.equal(decorated.nativeCollectionEvidence.originalOpeningRecords.length,14)
 assert.equal(decorated.nativeCollectionEvidence.originalClosingRecords.length,14)
 assert.equal(decorated.nativeCollectionEvidence.reader.receipts.filter(row=>row.method==='POST').length,2)
 assert.equal(decorated.nativeCollectionEvidence, native.nativeCollectionEvidence)
})
test('source-declared read-only POST uses its actual method/body and honest receipts',async()=>{
 const reader=createCurrentNativeReader({fetchPage:async(url,init)=>{
  assert.equal(init.method,'POST');assert.equal(init.body,'Activity=joblist');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  return {status:200,finalUrl:url,headers:{'content-type':'application/json'},body:'[]'}
 }},{source:'finolexindustrieslimited',admitted:[[listing,'json']],requests:[[listing,{method:'POST',body:'Activity=joblist'}]]})
 try{assert.equal((await reader.read(listing)).body,'[]');const receipt=reader.stats().receipts[0]
  assert.equal(receipt.method,'POST');assert.equal(receipt.requestBodySHA256,'d65b5b4a6659d4b78666a8b3d1a42650745d18f7ab1106a2b3f5cc7a11497803')
 }finally{reader.close()}
})
test('the strict GET wrapper never adopts a caller-supplied POST descriptor',async()=>{
 const response=await boundedDeclaredPublicGet('https://example.test/original',{request:{method:'POST',body:'Activity=sendmail'},overflowError:Error('overflow'),fetchImpl:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.body,undefined)
  const response=new Response('ok');Object.defineProperty(response,'url',{value:url});return response
 }})
 assert.equal(Buffer.from(response.bodyBase64,'base64').toString(),'ok')
})
test('a source-bound complete short original summary is retained while placeholders remain incomplete',()=>{
 const short=expected.finolex.find(row=>row.id==='55').html
 assert.equal(readOriginalNativeCriteria(short,failure,{minimumChars:1}).sourceDetailComplete,true)
 assert.equal(readOriginalNativeCriteria(short,failure).sourceDetailComplete,false)
 assert.equal(readOriginalNativeCriteria('NA',failure,{minimumChars:1}).sourceDetailComplete,false)
})
test('native criteria cannot carry event programs or delegated document attributes',()=>{
 const html=expected.finolex[0].html
 assert.throws(()=>readOriginalNativeCriteria('<div onclick="replaceRole()">'+html+'</div>',failure),/executable|program|delegated/i)
 assert.throws(()=>readOriginalNativeCriteria('<div srcdoc="replacement">'+html+'</div>',failure),/executable|program|delegated/i)
})
