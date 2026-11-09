import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as iprogrammer from '../../scraper/iprogrammersolutions/script.js'
import * as flexsin from '../../scraper/flexsintechnologies/script.js'
import { isIndiaJob } from '../utils/indiaLocationFilter.js'
const fixture = source => readFileSync(new URL('./fixtures/'+source+'/current-openings.html',import.meta.url),'utf8')
for (const [source,module,total] of [['iprogrammersolutions',iprogrammer,9],['flexsintechnologies',flexsin,36]]) {
 test(source+' accepts the current role inventory without pinning closed role titles', async()=>{
  const jobs=await module.run({fetchText:async()=>fixture(source)})
  assert.equal(jobs.length,total);assert.equal(new Set(jobs.map(j=>j.sourceUrl)).size,total)
 })
 test(source+' rejects a malformed card instead of silently publishing a partial list', async()=>{
  let html=fixture(source)
  html=source==='iprogrammersolutions'?html.replace('AI Practice Head</a>','</a>'):html.replace('Director - Open Source</div>','</div>')
  await assert.rejects(module.run({fetchText:async()=>html}),/incomplete/i)
 })
 test(source+' preserves unknown country instead of relabelling foreign locations', async()=>{
  const html=source==='iprogrammersolutions'
   ? fixture(source).replace(/(<strong>\s*Job Location\s*<\/strong>\s*:\s*)Pune/gi,'$1Toronto')
   : fixture(source).replaceAll('Noida','Toronto')
  const parsed=module.extractJobs(html);assert.equal(isIndiaJob(parsed[0]),false)
  await assert.rejects(module.run({fetchText:async()=>html}),/incomplete country scope/i)
 })
 test(source+' does not fetch after caller cancellation', async()=>{
  const cancelled=new Error('Source cancelled');let calls=0
  await assert.rejects(module.run({signal:AbortSignal.abort(cancelled),fetchText:async()=>{calls++;return fixture(source)}}),error=>error===cancelled)
  assert.equal(calls,0)
 })
}

test('Flexsin marks the missing-location role as unknown and preserves the previous snapshot', async()=>{
 const jobs=await flexsin.run({fetchText:async()=>fixture('flexsintechnologies')})
 const unknown=flexsin.extractJobs(fixture('flexsintechnologies')).find(job=>job.title==='Software Engineer - GoHighLevel (GHL)')
 assert.equal(unknown.location,null);assert.equal(unknown.country,null)
 assert.equal(jobs.filter(isIndiaJob).length,36)
 assert.ok(jobs.every(job=>job.sourceListingComplete===false))
})

test('Flexsin includes role cards with additional CSS classes and preserves unknown scope', async()=>{
 const html=fixture('flexsintechnologies').replace(/(<a\b[^>]*href="[^"]*gohighleve[^"]*"[^>]*class=")inner("[^>]*>)/i,'$1inner active$2')
 assert.ok(html!==fixture('flexsintechnologies'), 'role mutation applied')
 const jobs=await flexsin.run({fetchText:async()=>html});assert.equal(jobs.length,36)
 assert.ok(jobs.every(job=>job.sourceListingComplete===false))
})
test('Flexsin rejects an unparsed first-party role link after markup drift', async()=>{
 const html=fixture('flexsintechnologies').replace(/(<a\b[^>]*href="[^"]*gohighleve[^"]*"[^>]*class=")inner("[^>]*>)/i,'$1role-card$2')
 assert.ok(html!==fixture('flexsintechnologies'), 'role mutation applied')
 await assert.rejects(flexsin.run({fetchText:async()=>html}),/incomplete/i)
})
test('iProgrammer marks caller-limited inventories incomplete', async()=>{
 const jobs=await iprogrammer.createIprogrammerSolutionsScraper({maxJobs:1}).run({fetchText:async()=>fixture('iprogrammersolutions')})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
})

for(const [source,module,before] of [['iprogrammersolutions',iprogrammer,'Pune'],['flexsintechnologies',flexsin,'Noida']]){
 for(const location of ['Remote','Bangalore, United States','Pune, Canada'])test(source+' does not infer India from '+location,()=>{
  const html=source==='iprogrammersolutions'?fixture(source).replace(/(<strong>\s*Job Location\s*<\/strong>\s*:\s*)Pune/gi,'$1'+location):fixture(source).replaceAll(before,location)
  assert.equal(module.extractJobs(html)[0].country,null)
 })
}
