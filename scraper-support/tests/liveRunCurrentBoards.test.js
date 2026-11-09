import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as rnf from '../../scraper/rnftechnologies/script.js'
import * as morrisons from '../../scraper/morrisonslifecare/script.js'
import { buildScrapers } from '../providers/index.js'
const fixture = (source, name='current-openings.html') => readFileSync(new URL('./fixtures/'+source+'/'+name, import.meta.url),'utf8')
const rnfHtml=fixture('rnftechnologies')
const morrisonsHtml=fixture('morrisonslifecare')
test('RNF validates and extracts all seven current role cards',()=>{
 assert.equal(rnf.hasOfficialListingsSignal(rnfHtml),true)
 const jobs=rnf.extractJobListings(rnfHtml);assert.equal(jobs.length,7);assert.equal(jobs[0].title,'React Developer');assert.equal(jobs[0].country,'India')
})
test('RNF rejects missing listing records instead of accepting a partial snapshot',()=>{
 assert.throws(()=>rnf.extractJobListings(rnfHtml.replace(/<div class="rl-row"[^>]*>[\s\S]*?<\/div>/,'')),/incomplete/i)
})
test('RNF reads current structured detail and rejects wrong employer or job identity',()=>{
 const detail=fixture('rnftechnologies','current-detail.html')
 const listing={title:'React Developer',sourceUrl:'https://rnftechnologies.com/join-our-team/current-openings/react-developer',jobId:'react-developer',location:'Noida, Uttar Pradesh, India',country:'India'}
 const job=rnf.extractJobDetail(detail,listing);assert.equal(job.postingDate,'2026-09-09');assert.match(job.jobDescription,/client requirements/i);assert.equal(job.applyUrl,listing.sourceUrl)
 assert.throws(()=>rnf.extractJobDetail(detail.replaceAll('"name":"RNF Technologies"','"name":"Different Company"'),listing),/identity|employer/i)
 assert.throws(()=>rnf.extractJobDetail(detail.replaceAll('"value":"react-developer"','"value":"different-job"'),listing),/identity|identifier/i)
})
test('Morrisons extracts all32 current Chennai cards',()=>{
 const jobs=morrisons.extractJobCards(morrisonsHtml);assert.equal(jobs.length,32);assert.equal(jobs[0].title,'Sales and Marketing Executive');assert.equal(jobs[0].location,'Chennai, India')
})
test('Morrisons rejects incomplete cards and unrelated detail HTML',()=>{
 assert.throws(()=>morrisons.extractJobCards(morrisonsHtml.replace('32 roles open','33 roles open')),/incomplete/i)
 assert.throws(()=>morrisons.extractJobDetail('<h1>Careers</h1>',{title:'Engineer',sourceUrl:'https://www.morrisonslifecare.com/careers/engineer/'}),/identity|detail/i)
})

test('RNF resolves city-only listings from structured detail before India filtering', async () => {
 const html = rnfHtml.replaceAll('Noida, Uttar Pradesh, India', 'Noida')
 assert.equal(rnf.extractJobListings(html).length, 7)
 const jobs = await rnf.createRNFTechnologiesScraper({maxJobs:1}).run({fetchText: async url=>url===rnf.CAREERS_URL?html:fixture('rnftechnologies','current-detail.html')})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceListingComplete,false)
})
for (const name of ['rnftechnologies','morrisonslifecare','capitalnumbersinfotech','systechsolutions','3pillarglobal']) {
 test(name+' does not start requests after source cancellation', async () => {
  const source=buildScrapers().find(item=>item.name===name);let requests=0
  const cancelled=new Error('Source deadline expired')
  const unexpected=async()=>{requests++;throw new Error('Unexpected request after source cancelled')}
  await assert.rejects(source.run({signal:AbortSignal.abort(cancelled),fetchText:unexpected,fetchJson:unexpected}), error=>error===cancelled)
  assert.equal(requests,0)
 })
}
test('RNF stops its detail queue when the source is cancelled during a response', async () => {
 const controller=new AbortController();const cancelled=new Error('Source deadline expired');let requests=0
 await assert.rejects(rnf.run({signal:controller.signal,fetchText:async(url,options)=>{
  requests++;assert.equal(options?.signal,controller.signal)
  if(url===rnf.CAREERS_URL)return rnfHtml
  controller.abort(cancelled);return fixture('rnftechnologies','current-detail.html')
 }}),error=>error===cancelled)
 assert.equal(requests,2)
})

test('Morrisons retains distinct identities for roles sharing its application form', async()=>{
 const {generateFingerprint}=await import('../utils/saveToDB.js')
 const jobs=await morrisons.createMorrisonsLifecareScraper({maxJobs:1}).run({fetchText:async url=>url===morrisons.CAREERS_URL?morrisonsHtml:fixture('morrisonslifecare','current-detail.html')})
 assert.equal(jobs[0].applicationUrlIsGeneric,true);assert.equal(jobs[0].sourceListingComplete,false)
 const first=jobs[0],second={...jobs[0],title:'Second Role',jobId:'second-role',requisitionId:'second-role'}
 assert.notEqual(generateFingerprint(first),generateFingerprint(second))
})
