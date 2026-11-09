import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import test from 'node:test'
import * as source from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const homepage = await fs.readFile(new URL('./fixtures/current-home.html', import.meta.url), 'utf8')
const form = await fs.readFile(new URL('./fixtures/current-career-form.html', import.meta.url), 'utf8')
const fetchCurrent = (requests, changes = {}) => async (url, options) => {
 requests.push({ url, options })
 if (url === source.HOMEPAGE_URL) return { status:200, url, html:homepage, ...changes.homepage }
 if (url === source.CAREER_PAGE_URL) return { status:200, url, html:form, ...changes.form }
 return { status:changes.guessedStatus ?? 503, url, html:'Unpublished guessed route is unavailable' }
}
test('current general application form is discovery-only with unknown vacancy counts and no expiry authority', async () => {
 const requests=[]
 const jobs=await source.run({ fetchPage:fetchCurrent(requests,{guessedStatus:404}), now:()=> '2026-10-09T00:00:00.000Z' })
 assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence?.status,'discovery-only')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.pagesFetched,2)
 assert.equal(evidence.verifiedAt,'2026-10-09T00:00:00.000Z')
 assert.match(evidence.reason,/application-form.*does-not.*vacancy/i)
})
test('unpublished guessed routes are not mandatory dependencies of verified first-party form discovery', async () => {
 const requests=[]
 await source.run({ fetchPage:fetchCurrent(requests) })
 assert.deepEqual(requests.map(request=>request.url),[source.HOMEPAGE_URL,source.CAREER_PAGE_URL])
})

for (const surface of ['homepage','form']) {
 test('copied branded ' + surface + ' on an off-authority redirect cannot establish employer discovery', async()=>{
  const changes={guessedStatus:404,[surface]:{url:'https://unrelated.example/copied-application'}}
  await assert.rejects(source.run({fetchPage:fetchCurrent([],changes)}),/authority|official|first-party/i)
 })
 test('unavailable ' + surface + ' cannot become successful empty discovery', async()=>{
  const changes={guessedStatus:404,[surface]:{status:503}}
  await assert.rejects(source.run({fetchPage:fetchCurrent([],changes)}),/HTTP 503/)
 })
 for (const [label,addition] of [
  ['new vacancy', '<script type="application/ld+json">{"@type":"JobPosting","title":"Engineer"}</script>'],
  ['new ATS handoff', '<a href="https://jobs.lever.co/new-employer">View jobs</a>'],
 ]) test(surface+' '+label+' requires inventory review rather than the generic-form branch', async()=>{
  const changes={guessedStatus:404,[surface]:{html:(surface==='homepage'?homepage:form)+addition}}
  await assert.rejects(source.run({fetchPage:fetchCurrent([],changes)}),/public.*job|hiring.*surface|handoff/i)
 })
}
test('a newly enumerated position selector cannot be treated as the verified free-text application form', async()=>{
 const html=form.replace(/<input\b(?=[^>]*\bname=["']Position["'])[^>]*>/i,'<select name="Position"><option>Engineer</option></select>')
 assert.notEqual(html,form)
 await assert.rejects(source.run({fetchPage:fetchCurrent([],{guessedStatus:404,form:{html}})}),/first-party.*form|generic.*form/i)
})
test('the native general application form must submit to the verified first-party career path', async()=>{
 const html=form.replace('action="Career.aspx"','action="https://unrelated.example/resume"')
 assert.notEqual(html,form)
 await assert.rejects(source.run({fetchPage:fetchCurrent([],{guessedStatus:404,form:{html}})}),/first-party.*form|application.*authority/i)
})
test('a failed official homepage never falls through to general application discovery', async()=>{
 const requests=[]
 await assert.rejects(source.run({fetchPage:fetchCurrent(requests,{homepage:{html:'<title>Unrelated employer</title>'}})}),/official.*homepage/i)
 assert.deepEqual(requests.map(request=>request.url),[source.HOMEPAGE_URL])
})
test('caller cancellation occurs before public authority requests', async()=>{
 const controller=new AbortController();controller.abort(new Error('stop-Aculife'));let calls=0
 await assert.rejects(source.run({signal:controller.signal,fetchPage:async()=>{calls++;return{}}}),/stop-Aculife/)
 assert.equal(calls,0)
})
test('caller cancellation between official pages cannot return discovery success',async()=>{
 const controller=new AbortController(),requests=[]
 await assert.rejects(source.run({signal:controller.signal,fetchPage:async(url,options)=>{
  requests.push(url);assert.equal(options.signal,controller.signal)
  controller.abort(new Error('stop-before-form'));return{status:200,url,html:homepage}
 }}),/stop-before-form/)
 assert.deepEqual(requests,[source.HOMEPAGE_URL])
})
test('native authority requests have bounded cancellation and never serialize a signal header',async()=>{
 const original=globalThis.fetch,keepAlive=setTimeout(()=>{},1000);let observed
 globalThis.fetch=async(_url,options)=>{
  assert.equal(Object.hasOwn(options.headers,'signal'),false)
  observed=options.signal
  assert.ok(observed instanceof AbortSignal)
  return new Promise((_resolve,reject)=>observed.addEventListener('abort',()=>reject(observed.reason),{once:true}))
 }
 try{await assert.rejects(source.run({requestTimeoutMs:5}),error=>error.name==='TimeoutError');assert.equal(observed.aborted,true)}finally{globalThis.fetch=original;clearTimeout(keepAlive)}
})

for (const surface of ['homepage','form']) for (const [label,addition] of [
 ['Workable link','<a href="https://apply.workable.com/example-employer/">Apply Now</a>'],
 ['careers iframe','<iframe src="https://careers.example/board"></iframe>'],
 ['spaced iframe source','<iframe src = "https://careers.example/board"></iframe>'],
 ['spaced published first-party hiring link','<a href = "/jobs/published">See options</a>'],
]) test(surface+' newly published '+label+' fails closed',async()=>{
 const changes={guessedStatus:404,[surface]:{html:(surface==='homepage'?homepage:form)+addition}}
 await assert.rejects(source.run({fetchPage:fetchCurrent([],changes)}),/public.*job|hiring.*surface|handoff/i)
})
