import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createMacreqScraper,SOURCE,COMPANY,HOMEPAGE_URL} from './script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-20261117.json.gz',import.meta.url))))
test('Macreq factory exposes original native404 instead of an obsolete apply-only empty-board assumption',async()=>{const r=fixture.responses[0],calls=[];await assert.rejects(createMacreqScraper().run({fetchPage:async url=>{calls.push(url);return {...r,url:r.url??url,body:Buffer.from(r.bodyBase64,'base64').toString()}}}),e=>e.httpStatus===404&&e.recruitmentObservations.companyIndiaTotal===null&&e.recruitmentObservations.observedVacancyCount===null);assert.deepEqual(calls,[HOMEPAGE_URL]);assert.equal(SOURCE,'macreq');assert.equal(COMPANY,'Macreq Manufacturing Services Private Ltd')})
test('Macreq body-only callbacks cannot certify an unavailable employer or inventory',async()=>{let calls=0;await assert.rejects(createMacreqScraper().run({fetchText:async()=>{calls++;return 'Macreq'}}),/Original HTTP metadata/);assert.equal(calls,0)})
test('Macreq preserves exact native404 before absent entity metadata could mask it',async()=>{await assert.rejects(createMacreqScraper().run({fetchPage:async url=>({status:404,url,headers:{'content-type':'text/html'},bodyUnavailable:true})}),e=>e.httpStatus===404&&e.recruitmentObservations.originalResponses[0].bodyComplete===false)})
