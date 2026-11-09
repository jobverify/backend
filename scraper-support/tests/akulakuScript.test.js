import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as akulaku from '../../scraper/akulaku/script.js'
import {reducedBoard} from '../../scraper/akulaku/test-data/reducedNativeHarness.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
globalThis.fetch=()=>{throw Error('Offline Akulaku legacy/current contract tripwire')}
const packets=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/akulaku/test-data/native-20261103.json.gz',import.meta.url)))),page=url=>structuredClone(packets.find(row=>row.requestedUrl===url||row.url===url))
test('Akulaku source metadata identifies its current corporate and native board without stale maintenance counts',()=>{
 assert.equal(akulaku.SOURCE,'akulaku');assert.equal(akulaku.COMPANY,'Akulaku');assert.equal(akulaku.VERIFIED_ON,null)
 assert.equal(akulaku.OFFICIAL_JOBS_BOARD_URL,'https://akulaku.zhiye.com/')
 assert.equal(akulaku.hasFirstPartyCareersSignal(page(akulaku.FIRST_PARTY_CAREERS_URL).html),true)
 assert.equal(akulaku.extractOfficialJobsBoardUrl(page(akulaku.FIRST_PARTY_CAREERS_URL).html),akulaku.OFFICIAL_JOBS_BOARD_URL)
 assert.equal(akulaku.hasOfficialJobsBoardSignal(page(akulaku.OFFICIAL_JOBS_BOARD_URL).html),true)
 assert.equal(akulaku.PROVIDER_METADATA.verifiedIndiaJobCount,null)
})
test('Akulaku actual original native helpers retain distinct posting IDs, full criteria and precise next anchors',()=>{
 const cards=akulaku.extractJobCards(page(akulaku.JOB_LISTINGS_URL).html)
 assert.equal(cards.length,15);assert.equal(cards[0].detailId,'311197705');assert.equal(cards[2].detailId,'311197580');assert.equal(cards[0].requisitionId,cards[2].requisitionId)
 assert.equal(akulaku.extractNextPageUrl(page(akulaku.JOB_LISTINGS_URL+'&PageIndex=2').html,akulaku.JOB_LISTINGS_URL+'&PageIndex=2'),akulaku.JOB_LISTINGS_URL+'&PageIndex=3')
 assert.ok(akulaku.extractJobDescription(page(cards[0].detailUrl).html).includes('英语具备良好的听说能力'))
})
test('Akulaku maintenance or an unsupported publisher is never a verified empty board',async()=>{
 const fixture=reducedBoard(),fetchPage=async(url,request)=>url===akulaku.OFFICIAL_JOBS_BOARD_URL?{status:200,url,html:'<title>Document</title><p>System Upgrade Maintenance</p>'}:fixture.fetchPage(url,request)
 await assert.rejects(akulaku.run({fetchPage}),error=>error.code==='AKULAKU_NATIVE_MODEL')
})
test('Akulaku temporary transport failures preserve their exact original cause',async()=>{
 const cause=Object.assign(Error('connect timeout'),{code:'UND_ERR_CONNECT_TIMEOUT'}),reason=new TypeError('fetch failed',{cause})
 await assert.rejects(akulaku.run({fetchPage:async()=>{throw reason}}),error=>error===reason&&error.cause===cause)
})
test('Akulaku reduced native future India proof preserves original criteria and date-only precision',async()=>{
 const fixture=reducedBoard({india:true});let audit
 const jobs=await akulaku.createAkulakuScraper({maxJobs:0}).run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,2);assert.ok(jobs.every(row=>row.country==='India'&&row.city===null&&row.state===null&&row.sourcePostingDatePrecision==='date-only'&&row.closingDate===null&&row.sourceDetailComplete))
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(audit.sourceCompanyWideScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.privateApplicationRequests,0)
})
test('Akulaku native city-only roles remain full observations with unknown countries',async()=>{
 const fixture=reducedBoard();let audit
 const jobs=await akulaku.run({fetchPage:fixture.fetchPage,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0);assert.equal(audit.observedDetails.length,2);assert.ok(audit.observedDetails.every(row=>row.sourceDetailComplete&&row.country===null));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Akulaku one malformed public role preserves other identity-qualified healthy details',async()=>{
 const fixture=reducedBoard({india:true}),bad=fixture.cards[1].detailUrl;let audit
 const jobs=await akulaku.run({fetchPage:async(url,request)=>url===bad?{status:200,url,html:'<title>Unexpected</title>'}:fixture.fetchPage(url,request),onAudit:value=>{audit=value}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,fixture.cards[0].detailId);assert.equal(audit.observedDetails.length,2);assert.ok(audit.failures.some(row=>row.id===fixture.cards[1].detailId));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Akulaku a changed corporate board declaration is held before reading any undeclared URL',async()=>{
 let reads=0;const html=page(akulaku.FIRST_PARTY_CAREERS_URL).html.replaceAll('https://akulaku.zhiye.com/','https://example.com/jobs')
 await assert.rejects(akulaku.run({fetchPage:async url=>{reads++;return{status:200,url,html}}}),error=>error.code==='AKULAKU_NATIVE_MODEL');assert.equal(reads,1)
})
