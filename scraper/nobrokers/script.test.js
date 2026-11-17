import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createNobrokersScraper,SOURCE,COMPANY,CAREERS_URL,JOB_FEED_URL} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
test('NoBroker source factory preserves actual feed originals and unknown criteria instead of manufacturing eligible jobs',async()=>{
 const scraper=createNobrokersScraper({maxJobs:1}),jobs=await scraper.run({fetchPage:async url=>{const r=fixture.responses.find(r=>(r.url??r.finalUrl)===url||(r.requestedURL??r.requestedUrl)===url);assert.ok(r,url);return {...r,url:r.url??r.finalUrl??url,body:Buffer.from(r.bodyBase64??'','base64').toString()}}})
 assert.equal(SOURCE,'nobrokers');assert.equal(COMPANY,'NoBroker');assert.equal(CAREERS_URL,'https://www.nobroker.in/careers');assert.equal(JOB_FEED_URL,'https://no-broker-cbaa4.firebaseio.com/jobOpeningSheet.json');assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,6);assert.equal(jobs.nativeCollectionEvidence.observations[0].nativeRecord.Id,1);assert.equal(jobs.nativeCollectionEvidence.publicApplicationEligibilityQualified,false)
})
test('NoBroker body-only callbacks cannot certify employer HTTP identity or metadata-only eligibility',async()=>{let calls=0;await assert.rejects(createNobrokersScraper().run({fetchText:async()=>{calls++;return 'NoBroker'}}),/Original HTTP metadata/);assert.equal(calls,0)})
test('NoBroker actual-home employer canonical mismatch fails before programmes/feed acquisition',async()=>{const r=fixture.responses[0];let calls=0;await assert.rejects(createNobrokersScraper().run({fetchPage:async url=>{calls++;return {status:r.status,url,headers:r.headers,body:Buffer.from(r.bodyBase64,'base64').toString().replace('rel="canonical" href="https://www.nobroker.in"','rel="canonical" href="https://another.example"')}}}),/canonical/);assert.equal(calls,1)})
