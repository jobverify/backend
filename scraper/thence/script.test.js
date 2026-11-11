import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as thence from './script.js'
const discovery=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current20261111.json.gz',import.meta.url))))
const live=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/live20261111.json.gz',import.meta.url))))
const body=index=>Buffer.from(discovery.responses[index].bodyBase64,'base64').toString('utf8')
const replay=(mutate)=>{let index=0;return async(url)=>{const p=live.originalPages[index++];assert.equal(url,p.url);const response=new Response(Buffer.from(p.rawBodyBase64,'base64'),{status:mutate?.(p)??p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.finalUrl});return response}}
test('public Thence pure exports validate genuine current publisher and preserve application choices',()=>{
 assert.equal(thence.SOURCE,'thence');assert.equal(thence.COMPANY,'Thence Private Limited');assert.equal(thence.HOMEPAGE_URL,'https://thence.co');assert.equal(thence.CAREERS_URL,'https://www.thence.digital/careers');assert.equal(thence.hasOfficialHomepageSignal(body(2)),true);assert.equal(thence.extractCareersUrlFromHomepage(body(2)),thence.CAREERS_URL);assert.equal(thence.hasOfficialCareersSignal(body(4)),true)
 const choices=thence.extractOpenRoles(body(4));assert.equal(choices.length,16);assert.equal(choices[0].jobId,'thence-product-data-analyst');assert.ok(choices.every(j=>j.country===null&&j.requisitionId===null&&j.jobDescription===null&&j.publicExperienceChecked===false&&j.skipPublicExperienceEnrichment===true))
})
test('public scraper factory consumes actual complete HTTP responses and keeps unresolved candidate fields',async()=>{
 const jobs=await thence.createThenceScraper().run({fetchImpl:replay()});assert.equal(jobs.length,16);assert.equal(jobs[0].source,thence.SOURCE);assert.equal(jobs[0].link,thence.APPLY_URL);assert.equal(jobs.sourceAudit.observedApplicationRoleChoices,16);assert.equal(jobs.sourceAudit.confirmedNativeVacancyTotal,null);assert.ok(jobs.every(j=>j.sourceCountryScopeUnresolved===true&&j.country===null))
})
test('retired-route classifier does not authorize a verified empty result or foreign404',async()=>{
 assert.equal(thence.isRetiredCareersRouteError({status:404,url:thence.CAREERS_URL}),true);assert.equal(thence.isRetiredCareersRouteError({status:404,url:'https://other.example/'}),false)
 await assert.rejects(thence.createThenceScraper().run({fetchImpl:replay(p=>p.url===thence.CAREERS_URL?404:p.status)}),e=>e.status===404&&e.abortRetries===true)
})
