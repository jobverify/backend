import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {SOURCE,COMPANY,HOMEPAGE_URL,createOtipyScraper} from '../../scraper/otipy/script.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/otipy/fixtures/native-20261117.json.gz',import.meta.url))))
test('Otipy registration retains the exact configured root without inventing a new tenant or host',()=>{assert.equal(SOURCE,'otipy');assert.equal(COMPANY,'Otipy');assert.equal(HOMEPAGE_URL,'https://otipy.com/')})
test('Otipy source-backed current connection timeout is not a verified blocked empty board',async()=>{const observed=fixture.transportOriginals[0],reason=Object.assign(new TypeError(observed.error),{cause:{...observed.cause}}),calls=[];await assert.rejects(createOtipyScraper().run({fetchImpl:async url=>{calls.push(url);throw reason}}),e=>e===reason&&e.cause.code==='UND_ERR_CONNECT_TIMEOUT'&&e.recruitmentObservations.originalResponses[0].status===null&&e.recruitmentObservations.lifecycleCleanupAllowed===false&&e.recruitmentObservations.companyGlobalTotal===null);assert.deepEqual(calls,[HOMEPAGE_URL])})
test('Otipy original denied HTTP status stays a failure instead of becoming empty inventory',async()=>{await assert.rejects(createOtipyScraper().run({fetchImpl:async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:null})}),e=>e.httpStatus===403&&e.recruitmentObservations.observedVacancyCount===null)})
