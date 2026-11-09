import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from '../../scraper/22ndcenturytechnologies/script.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const {packet}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261107/22ndcentury-original-packet.json.gz',import.meta.url))))
test('22nd Century native contract entries remain staffing intake observations without fabricated vacancies',async()=>{
 assert.equal(source.CAREERS_URL,packet.url);assert.equal(source.hasOfficialCareersSignal(packet.body),true)
 const extracted=source.extractJobCards(packet.body);assert.equal(extracted.length,0);assert.equal(extracted.nativeCollectionEvidence.observedStaffingCategories.length,70)
 const chain=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261107/22ndcentury-current-public-chain.json.gz',import.meta.url)))).packets
 const calls=[],jobs=await source.create22ndCenturyTechnologiesScraper().run({fetchText:async url=>{calls.push(url);const p=chain.find(p=>p.requestedURL===url);assert.ok(p);const raw=Buffer.from(p.bodyBase64,'base64');return{url:p.finalURL,status:p.status,headers:p.headers,body:p.headers['content-type'].includes('gzip')?null:raw.toString('utf8'),rawBodyBase64:p.bodyBase64,bodyComplete:true}},now:()=> '2026-11-07T00:00:00.000Z'})
 assert.deepEqual(calls,chain.map(p=>p.requestedURL));assert.equal(jobs.nativeCollectionEvidence.incompleteCollectionFailure.status,302);assert.equal(jobs.length,0);assert.deepEqual(readSourceObservationEvidence(jobs,source.SOURCE),{source:source.SOURCE,recordKind:'hiring-signals',observedRecordCount:70,observedVacancyCount:0,sourceScopeComplete:false,companyGlobalTotal:null,companyIndiaTotal:null})
 assert.equal(jobs.nativeCollectionEvidence.observedStaffingCategories[0].title,'Basic Clerical');assert.equal(jobs.nativeCollectionEvidence.observedStaffingCategories[10].region,'Region 2');assert.equal(jobs.nativeCollectionEvidence.observedStaffingCategories[0].nativeVacancyId,null)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
