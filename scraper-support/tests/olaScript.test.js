import assert from 'node:assert/strict'
import test from 'node:test'
import { CAREER_PAGE_ID,CAREER_PAGE_URL,FILTERED_JOBS_URL,NOAUTH_TOKEN_URL,createOlaScraper,extractSearchResults } from '../../scraper/ola/script.js'
import { nativeOptions } from '../../scraper/ola/fixtures/options.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

test('Ola public constants retain the explicitly delegated shared tenant',()=>{
  assert.equal(CAREER_PAGE_ID,'e0c1eb37-eb7a-4ca4-bcc5-d59ce4ce9212')
  assert.equal(CAREER_PAGE_URL,'https://olacareers.turbohire.co/careerpage/'+CAREER_PAGE_ID)
  assert.equal(NOAUTH_TOKEN_URL,'https://thapi.azurewebsites.net/api/token/noauth')
  assert.equal(FILTERED_JOBS_URL,'https://thapi.azurewebsites.net/api/careerpagev2/filteredjobs?orgId='+CAREER_PAGE_ID+'&pageType=0')
  assert.deepEqual(extractSearchResults({Total:0,Result:[]}),[])
})
test('Ola obtains the anonymous session only after validating the current native public client',async t=>{
  t.mock.method(globalThis,'fetch',async()=>{throw Error('Hermetic Ola test attempted network')})
  const requests=[],jobs=await createOlaScraper().run(nativeOptions({requests}))
  const tokenIndex=requests.findIndex(r=>r.url===NOAUTH_TOKEN_URL),clientIndex=requests.findIndex(r=>r.url.endsWith('main.a1c3fd4c0aa3133cad6a.chunk.js'))
  assert.ok(tokenIndex>clientIndex&&clientIndex>=0)
  assert.equal(requests.filter(r=>r.url===FILTERED_JOBS_URL).length,2)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(jobs.nativeInventoryEvidence.nativeBoardEmpty,true)
})
