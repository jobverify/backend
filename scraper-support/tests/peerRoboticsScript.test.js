import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {SOURCE,COMPANY,HOMEPAGE_URL,COMPANY_URL,CAREERS_URL,createPeerRoboticsScraper,run} from '../../scraper/peerrobotics/script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/peerrobotics/fixtures/native-20261117.json.gz',import.meta.url))))
const body=row=>Buffer.from(row.bodyBase64,'base64').toString(),original=url=>fixture.requests.find(row=>row.url===url)
function replay(edit=(row,text)=>text){const calls=[],counts=new Map();return {calls,fetchImpl:async(url,init)=>{const row=original(String(url));assert.ok(row,'Only actual own native path '+url);calls.push(String(url));assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');assert.equal(init.body,undefined);const count=(counts.get(String(url))??0)+1;counts.set(String(url),count);return Object.defineProperty(new Response(edit(row,body(row),count),{status:row.status,headers:row.headers}),'url',{value:row.url})}}}
test('Peer Robotics current exports and factory use the verified current own company and Notion careers routes',()=>{
 assert.equal(SOURCE,'peerrobotics');assert.equal(COMPANY,'Peer Robotics');assert.equal(HOMEPAGE_URL,'https://www.peerrobotics.ai/');assert.equal(COMPANY_URL,HOMEPAGE_URL+'company');assert.equal(CAREERS_URL,'https://careers.peerrobotics.ai/');assert.equal(typeof createPeerRoboticsScraper().run,'function')
})
test('Peer Robotics observes one employer hiring signal and zero bound vacancies while native and company inventory stay unknown',async()=>{
 const {calls,fetchImpl}=replay(),jobs=await createPeerRoboticsScraper({fetchImpl}).run({maxJobs:1}),audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs),summary=readSourceObservationEvidence(jobs,SOURCE)
 assert.equal(calls.length,6);assert.equal(jobs.length,0);assert.equal(summary.recordKind,'hiring-signals');assert.equal(summary.observedRecordCount,1);assert.equal(summary.observedVacancyCount,0)
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(audit.companyIndiaZeroProven,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.activeApplyVerified,false)
 assert.equal(audit.observations[0].country,null);assert.equal(audit.observations[0].jobId,null);assert.equal(audit.observations[0].criteria,null);assert.equal(audit.observations[0].applyUrl,null);assert.equal(audit.legacyWellfoundFallbackUsed,false);assert.equal(audit.legacyCityCountryInferenceUsed,false)
 assert.ok(calls.every(url=>!url.includes('wellfound')&&!url.includes('/api/')&&!url.includes('/mcp/')))
})
test('Peer Robotics whole current hiring and Notion closing models include passive copy, literal metadata, full shell and programmes',async()=>{
 for(const mode of ['hiring','theme','programme','passive']){
  const {fetchImpl}=replay((row,text,count)=>count!==2?text:mode==='hiring'&&row.url===COMPANY_URL?text.replace('Our team is growing fast','Our team has changed eligibility'):row.url===CAREERS_URL?mode==='theme'?text.replace('{"mode":"light"}','{"mode":"dark"}'):mode==='programme'?text.replace('window.__webStartTime=','window.PEER_PASSIVE_CHANGE=true;window.__webStartTime='):mode==='passive'?text.replace('</body>','<aside>New native requirement</aside></body>'):text:text)
  await assert.rejects(run({fetchImpl}),/Closing.*native.*changed/i,mode)
 }
})
test('Peer Robotics current structured employer and exact response authority remain mandatory',async()=>{
 for(const mode of ['employer','canonical','response']){
  const {fetchImpl}=replay((row,text)=>row.url===HOMEPAGE_URL?mode==='employer'?text.replace('"name": "Peer Robotics"','"name": "Other Robotics"'):mode==='canonical'?text.replace('href="https://www.peerrobotics.ai" rel="canonical"','href="https://foreign.invalid/" rel="canonical"'):text:text)
  if(mode==='response')await assert.rejects(run({fetchImpl:async()=>Object.defineProperty(new Response('foreign',{headers:{'content-type':'text/html'}}),'url',{value:'https://foreign.invalid/'})}),error=>error.failureKind==='parser_or_contract_error')
  else await assert.rejects(run({fetchImpl}),/employer|canonical/i)
 }
})
test('Peer Robotics current declared page metadata cannot be promoted to vacancy country or criteria',async()=>{
 const {fetchImpl}=replay((row,text)=>row.url===COMPANY_URL?text.replace('Our team is growing fast','Our team is growing fast in India'):text),jobs=await run({fetchImpl})
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations[0].country,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
test('Peer Robotics refuses body-only callbacks without issuing a native request',async()=>{
 let calls=0
 await assert.rejects(run({fetchText:async()=>{calls++}}),/Original HTTP metadata/);assert.equal(calls,0)
})
test('Peer Robotics frozen opaque caller pre-abort precedes callbacks and invalid output limits',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'peer-preabort'});controller.abort(reason);let calls=0
 await assert.rejects(run({signal:controller.signal,maxJobs:0,fetchText:async()=>{calls++}}),error=>error===reason);assert.equal(calls,0)
})
test('Peer Robotics fulfilled and rejected in-flight cancellation retain the exact frozen caller reason',async()=>{
 for(const mode of ['fulfil','reject']){const controller=new AbortController(),reason=Object.freeze({owner:'peer-inflight-'+mode});let calls=0
  const fetchImpl=async url=>{calls++;controller.abort(reason);if(mode==='reject')throw Error('masked transport failure');return Object.defineProperty(new Response('not a model',{headers:{'content-type':'text/html'}}),'url',{value:String(url)})}
  await assert.rejects(run({signal:controller.signal,fetchImpl}),error=>error===reason);assert.equal(calls,1)
 }
})
test('Peer Robotics current native202 WAF challenge stops before body acquisition and never calls a replacement source',async()=>{
 let calls=0,reads=0
 const fetchImpl=async url=>{calls++;return {status:202,url:String(url),headers:new Headers({'content-type':'text/html','x-amzn-waf-action':'challenge'}),body:{getReader(){reads++;assert.fail('No challenge body consumption')},cancel:async()=>{}}}}
 await assert.rejects(run({fetchImpl}),error=>error.httpStatus===202&&error.failureKind==='blocked_or_access_denied');assert.equal(calls,1);assert.equal(reads,0)
})
