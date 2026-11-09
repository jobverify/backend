import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {run,extractSearchResults} from '../../scraper/uptiqai/script.js'
import {generateFingerprint} from '../utils/saveToDB.js'
const html=readFileSync(new URL('./fixtures/uptiqai/current-openings.html',import.meta.url),'utf8')
test('Uptiq recovers every current India role linked to the official career form',async()=>{
 const jobs=await run({fetchText:async()=>html});assert.equal(jobs.length,3)
 assert.ok(jobs.every(job=>job.country==='India'&&job.applicationUrlIsGeneric===true))
 assert.equal(new Set(jobs.map(generateFingerprint)).size,3)
 assert.ok(jobs.every(job=>job.applyUrl==='https://www.uptiq.ai/careers#Positions'))
})
test('Uptiq rejects a missing card title instead of dropping a role',async()=>{
 await assert.rejects(run({fetchText:async()=>html.replace('Site Reliability Engineer</h3>','</h3>')}),/incomplete/i)
})
test('Uptiq rejects an unparsed role after the card class changes',async()=>{
 await assert.rejects(run({fetchText:async()=>html.replace('class="position-card"','class="different-card"')}),/incomplete/i)
})
test('Uptiq requires the first-party career application form',async()=>{
 await assert.rejects(run({fetchText:async()=>html.replace(/<form[\s\S]*?<\/form>/,'')}),/form|surface/i)
})
test('Uptiq keeps uncertain country explicit and preserves the previous snapshot',async()=>{
 const changed=html.replace('<div>India</div>','<div>Toronto</div>');assert.equal(extractSearchResults(changed)[0].country,null)
 const jobs=await run({fetchText:async()=>changed});assert.equal(jobs.length,2)
 assert.ok(jobs.every(job=>job.sourceListingComplete===false))
})
test('Uptiq stops before fetching on source cancellation',async()=>{
 let calls=0;const reason=new Error('Source cancelled')
 await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:async()=>{calls++;return html}}),error=>error===reason)
 assert.equal(calls,0)
})

for (const location of ['Remote','Bangalore, United States','Pune, Canada']) {
 test('Uptiq does not infer India from '+location, async()=>{
  const jobs=await run({fetchText:async()=>html.replace('<div>India</div>','<div>'+location+'</div>')})
  assert.equal(jobs.length,2);assert.ok(jobs.every(job=>job.sourceListingComplete===false))
 })
}
test('Uptiq inventories role application links independently of card and heading CSS',async()=>{
 const changed=html.replace('class="position-card"','class="current-position"').replace('class="position-card-title"','class="current-position-title"')
 await assert.rejects(run({fetchText:async()=>changed}),/incomplete/i)
})
test('Uptiq reads the whole Positions section when a role has a nested section',async()=>{
 const changed=html.replace('<div class="position-wrap">','<div class="position-wrap"><section>').replace('</div></div><div class="position-card">','</div></div></section><div class="position-card">')
 const jobs=await run({fetchText:async()=>changed});assert.equal(jobs.length,3)
})
