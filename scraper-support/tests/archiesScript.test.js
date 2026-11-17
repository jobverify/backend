import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {SOURCE,COMPANY,OFFICIAL_BRAND_NAME,HOMEPAGE_URL,ABOUT_URL,createArchiesScraper,run} from '../../scraper/archies/script.js'
import {readCurrentArchiesCorporate} from '../../scraper/archies/currentNative20261117.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/archies/fixtures/native-20261117.json.gz',import.meta.url))))
const original=url=>fixture.responses.find(r=>r.url===url),body=r=>Buffer.from(r.bodyBase64,'base64').toString()
function replay(edit=(row,text)=>text){const calls=[],counts=new Map();return {calls,fetchImpl:async(url,init)=>{const row=original(url);assert.ok(row,'Only actual declared own document '+url);calls.push(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const count=(counts.get(url)??0)+1;counts.set(url,count);return Object.defineProperty(new Response(edit(row,body(row),count),{status:row.status,headers:row.headers}),'url',{value:row.url})}}}
test('Archies current corporate identity uses own structured employer and active About link rather than historical LinkedIn or exact raw title entity syntax',()=>{
 assert.equal(SOURCE,'archies');assert.equal(COMPANY,'Archies');assert.equal(OFFICIAL_BRAND_NAME,'Archies Online')
 const home=readCurrentArchiesCorporate(body(original(HOMEPAGE_URL)),HOMEPAGE_URL),about=readCurrentArchiesCorporate(body(original(ABOUT_URL)),ABOUT_URL)
 assert.equal(home.structuredData[0].name,'Archies Online');assert.equal(home.nativeAboutDeclaration.attrs.href,'/pages/about');assert.ok(about.wholeAboutText.includes('Archies Limited'))
 assert.ok(about.wholeAboutText.includes('a friend celebrating a new job'));assert.equal(about.recruitmentDeclarations.length,0);assert.equal(home.storefrontATSStudioIsRecruitingATS,false)
})
test('Archies full current corporate originals remain held with zero observed vacancies and no guessed career routes or company-zero inference',async()=>{
 const {calls,fetchImpl}=replay(),jobs=await createArchiesScraper({fetchImpl}).run({maxJobs:1}),audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
 assert.deepEqual(calls,[HOMEPAGE_URL,ABOUT_URL,HOMEPAGE_URL,ABOUT_URL]);assert.equal(jobs.length,0);assert.equal(readSourceObservationEvidence(jobs,SOURCE).observedVacancyCount,0)
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.nativeInventoryQualified,false);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.activeApplyVerified,false);assert.equal(audit.legacyGuessedCareerRouteRequests,0)
 assert.ok(audit.nativeOpening.home.programDeclarations.length>20);assert.equal(audit.nativeOpening.wholeOriginalAboutHTML,body(original(ABOUT_URL)))
})
test('Archies a new declared recruitment link remains a single unqualified hiring observation rather than an invented country or complete board',async()=>{
 const {fetchImpl}=replay((row,text)=>text.replace('</body>','<a href="/careers">Careers</a></body>')),jobs=await run({fetchImpl}),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.observedRecordCount,1);assert.equal(audit.observedVacancyCount,0);assert.equal(audit.observations[0].country,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Archies closing full About content and active navigation reject passive native changes',async()=>{
 for(const mode of ['about','navigation']){const {fetchImpl}=replay((row,text,count)=>count===2?mode==='about'&&row.url===ABOUT_URL?text.replace('A mother sending love','A changed native criterion sending love'):mode==='navigation'?text.replace('href="/pages/about"','href="/pages/other-about"'):text:text)
  await assert.rejects(run({fetchImpl}),/Closing|About declaration/i,mode)
 }
})
test('Archies corporate canonical and structured employer remain exact native identity requirements',()=>{
 const home=body(original(HOMEPAGE_URL))
 assert.throws(()=>readCurrentArchiesCorporate(home.replace('href="https://archiesonline.com/"','href="https://foreign.invalid/"'),HOMEPAGE_URL),/canonical/i)
 assert.throws(()=>readCurrentArchiesCorporate(home.replace('"name": "Archies Online"','"name": "Other Employer"'),HOMEPAGE_URL),/employer/i)
})
test('Archies body-only callbacks do not qualify metadata and caller pre-abort keeps its exact frozen reason first',async()=>{
 let reads=0;await assert.rejects(run({fetchText:async()=>{reads++}}),/Original HTTP metadata/);assert.equal(reads,0)
 const controller=new AbortController(),reason=Object.freeze({owner:'archies-preabort'});controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,maxJobs:0,fetchText:async()=>{reads++}}),error=>error===reason);assert.equal(reads,0)
})
test('Archies fulfilled and rejected in-flight caller cancellation cannot be replaced by native model or audit errors',async()=>{
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'archies-'+mode});let calls=0
  await assert.rejects(run({signal:controller.signal,fetchImpl:async url=>{calls++;controller.abort(reason);if(mode==='reject')throw Error('transport');return Object.defineProperty(new Response('opaque'), 'url',{value:url})}}),error=>error===reason);assert.equal(calls,1)
 }
})
test('Archies original202 WAF challenge wins before body acquisition with no alternate source',async()=>{
 let calls=0,reads=0
 await assert.rejects(run({fetchImpl:async url=>{calls++;return {status:202,url,headers:new Headers({'x-amzn-waf-action':'challenge'}),body:{getReader(){reads++;assert.fail('No challenge body read')},cancel:async()=>{}}}}}),error=>error.httpStatus===202&&error.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)
})
