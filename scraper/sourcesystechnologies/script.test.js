import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {SOURCE,COMPANY,HOMEPAGE_URL,CHECKED_NO_JOBS_ROUTE_URLS,createSourcesysTechnologiesScraper} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
test('SourceSys registration retains identity and historical route exports without using guessed routes',()=>{assert.equal(SOURCE,'sourcesystechnologies');assert.equal(COMPANY,'Sourcesys Technologies');assert.equal(HOMEPAGE_URL,'https://www.sourcesys.co/');assert.equal(CHECKED_NO_JOBS_ROUTE_URLS.length,4)})
test('SourceSys current full parked root and literal lander retain unknown employer inventory',async()=>{const calls=[];await assert.rejects(createSourcesysTechnologiesScraper().run({fetchPage:async url=>{calls.push(url);const row=fixture.responses.find(r=>(r.requestedURL??r.requestedUrl)===url);assert.ok(row,url);return {status:row.status,url:row.url??row.finalUrl??url,headers:row.headers,body:Buffer.from(row.bodyBase64,'base64').toString()}}}),e=>e.failureKind==='source_identity_unverified'&&e.recruitmentObservations.nativeClosing.lander.parkingConfirmed===true&&e.recruitmentObservations.observedVacancyCount===null&&e.recruitmentObservations.companyIndiaTotal===null&&e.recruitmentObservations.lifecycleCleanupAllowed===false);assert.equal(calls.length,4);assert.ok(!calls.some(u=>CHECKED_NO_JOBS_ROUTE_URLS.includes(u)))})
test('SourceSys old body-only corporate homepage cannot establish current native HTTP identity',async()=>{await assert.rejects(createSourcesysTechnologiesScraper().run({fetchPage:async url=>({status:200,url,html:'Sourcesys Global Software'})}),/metadata/i)})
