import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentGoal20261107/aloha-current.json.gz',import.meta.url)))),packets=new Map(fixture.packets.map(p=>[p.requestedURL,p])),provider=getScraperCatalog().find(p=>p.source==='alohatechnology')
async function replay(options={}){
 const calls=[];let audit,jobs,error
 const fetchPage=async url=>{calls.push(url);const p=packets.get(url);assert.ok(p,'Only declared retained public pages');return{url,status:p.status,headers:new Headers(p.headers),body:Buffer.from(p.bodyBase64,'base64').toString('utf8')}}
 try{jobs=await createCatalogScraper(provider).run({fetchPage,onAudit:a=>{audit=a},...options})}catch(e){error=e}
 return{calls,audit,jobs,error}
}
test('Aloha registered observations keep whole native criteria while missing identity/country remains unqualified',async()=>{
 const r=await replay();assert.equal(r.error,undefined);assert.equal(r.jobs.length,6);assert.equal(r.calls.length,6)
 for(let i=0;i<r.jobs.length;i++){const j=r.jobs[i],expected=fixture.independentOracle.roles[i];assert.equal(j.title,expected.title);assert.equal(j.nativeCriteriaText,expected.criteria);assert.equal(j.fullNativeCriteriaAvailable,true);assert.equal(j.sourceDetailComplete,false);assert.equal(j.sourceDetailFailureKind,'native-country-and-posting-identity-unavailable');assert.equal(j.country,null);assert.equal(j.jobId,null);assert.equal(j.requisitionId,null);assert.equal(j.remoteStatus,null);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.ok(j.jobDescription)}
 assert.equal(r.audit.fullNativeCriteriaRecords,6);assert.equal(r.audit.closingReconciled,true);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readSourceObservationEvidence(r.jobs,'alohatechnology').observedRecordCount,6)
})
test('Aloha caller zero cap performs no public reads or observation-clock calls',async()=>{const r=await replay({maxJobs:0,now:()=>{throw Error('unused clock')}});assert.equal(r.error,undefined);assert.equal(r.jobs.length,0);assert.equal(r.calls.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(r.jobs).listingComplete,false);assert.equal(readSourceObservationEvidence(r.jobs,'alohatechnology').observedRecordCount,0)})
test('Aloha positive output cap retains the complete closing six-card observation',async()=>{const r=await replay({maxJobs:1});assert.equal(r.error,undefined);assert.equal(r.jobs.length,1);assert.equal(r.calls.length,6);assert.equal(r.audit.observations.length,6);assert.equal(r.audit.closingReconciled,true);assert.equal(readSourceObservationEvidence(r.jobs,'alohatechnology').observedRecordCount,6)})
