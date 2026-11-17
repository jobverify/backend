import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createTursoScraper,SOURCE,COMPANY} from '../../scraper/turso/script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/turso/fixtures/native-20261117.json.gz',import.meta.url))))
test('Turso factory reconciles own current corporate sources without stale Ashby empty-board assumptions',async()=>{const calls=[],jobs=await createTursoScraper().run({fetchPage:async url=>{calls.push(url);const r=fixture.responses.find(r=>(r.requestedURL??r.requestedUrl)===url);assert.ok(r,url);return {...r,url:r.url??r.finalUrl,body:Buffer.from(r.bodyBase64,'base64').toString()}}});assert.equal(SOURCE,'turso');assert.equal(COMPANY,'Turso');assert.equal(calls.length,8);assert.ok(calls.every(u=>u.startsWith('https://turso.tech/')));assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedVacancyCount,0);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null);assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)})
test('Turso incomplete legacy html-only callbacks cannot qualify native identity or inventory',async()=>{await assert.rejects(createTursoScraper().run({fetchPage:async url=>({finalUrl:url,html:'<title>Turso</title>'})}),/HTTP metadata/)})
test('Turso original unavailable HTTP status is preserved before missing entity data',async()=>{await assert.rejects(createTursoScraper().run({fetchPage:async url=>({status:403,url,headers:{'content-type':'text/html'},bodyUnavailable:true})}),e=>e.httpStatus===403&&e.recruitmentObservations.originalResponses[0].bodyComplete===false)})
