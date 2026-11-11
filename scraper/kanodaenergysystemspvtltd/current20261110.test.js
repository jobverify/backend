import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {extractJobs,run,hasOfficialCareersSignal,hasOfficialHomepageSignal,CAREERS_URL,HOMEPAGE_URL} from './script.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {isIndiaJob} from '../../scraper-support/utils/indiaLocationFilter.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current20261110.json.gz',import.meta.url))))
for(const packet of capture.packets){
 const bytes=Buffer.from(packet.bodyBase64,'base64')
 assert.equal(bytes.length,packet.bodyBytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.bodySHA256)
 assert.equal(packet.status,200)
 assert.equal(packet.url,packet.requestedUrl)
}
const original=url=>Buffer.from(capture.packets.find(p=>p.requestedUrl===url).bodyBase64,'base64').toString('utf8')
const html=original(CAREERS_URL)
const fetchText=async url=>original(url)
const ownPanel='<div id="collapseOne" class="collapse" aria-labelledby="headingOne" data-parent="#accordionExample">'
assert.ok(html.includes(ownPanel))

test('Kanoda genuine numbered responsibilities retain the whole own Junior Engineer criteria',()=>{
 const jobs=extractJobs(html),junior=jobs.find(j=>j.title==='Junior Design Engineer (Solar Design)')
 assert.equal(jobs.length,4)
 assert.match(junior.jobDescription,/Validate Site Survey forms and photographs/)
 assert.match(junior.jobDescription,/Perform Shadow analysis/)
 assert.match(junior.jobDescription,/PVSyst/)
 assert.match(junior.jobDescription,/Punctuality and self-discipline/)
 assert.match(junior.minimumQualification,/Bachelors/)
 assert.ok(jobs.every(j=>j.requisitionId===null))
})
test('Kanoda matching own literal worksite/address supports India without defaulting unknown countries',()=>{
 const jobs=extractJobs(html)
 assert.equal(jobs.filter(isIndiaJob).length,4)
 const changed=html.replaceAll('Gujarat - India','Gujarat')
 const unresolved=extractJobs(changed)
 assert.ok(unresolved.every(j=>j.country===null&&j.sourceCountryScopeUnresolved===true))
 assert.equal(unresolved.filter(isIndiaJob).length,0)
})
test('Kanoda missing own worksite never acquires the company address country',()=>{
 const changed=html.replace(/(>Location<\/div>[\s\S]*?class="right-side[^"]*">\s*)Ahmedabad/,'$1')
 assert.notEqual(changed,html)
 const jobs=extractJobs(changed)
 assert.ok(jobs.some(j=>j.country===null&&j.sourceCountryScopeUnresolved===true))
})
test('Kanoda foreign own worksite remains foreign',()=>{
 const changed=html.replace(/(>Location<\/div>[\s\S]*?class="right-side[^"]*">\s*)Ahmedabad/,'$1Toronto, Canada')
 assert.notEqual(changed,html)
 const jobs=extractJobs(changed)
 assert.ok(jobs.some(j=>j.country==='Canada'&&j.location==='Toronto, Canada'))
})
for(const [label,open,close] of [['hidden','<div hidden>','</div>'],['template','<template>','</template>'],['quoted','<blockquote>','</blockquote>']]){
 test('Kanoda '+label+' document cannot supply publisher or own criteria',()=>{
  assert.equal(hasOfficialCareersSignal(open+html+close),false)
  assert.throws(()=>extractJobs(open+html+close),/careers|native|verified/i)
 })
}
test('Kanoda wrong own accordion handoff cannot borrow neighboring criteria',()=>{
 assert.throws(()=>extractJobs(html.replace('data-target="#collapseFour"','data-target="#collapseThree"')),/native|card|panel|binding/i)
})
test('Kanoda own foreign employer is excluded while native observations are retained',async()=>{
 const changed=html.replace('Kanoda Energy Systems Pvt. Ltd. (KESPL)','Different Employer Limited')
 const jobs=await run({fetchText:async url=>url===CAREERS_URL?changed:original(url)})
 assert.equal(jobs.length,3)
 assert.equal(readSourceObservationEvidence(jobs,'kanodaenergysystemspvtltd').observedVacancyCount,4)
 assert.ok(jobs.every(j=>j.company==='Kanoda Energy Systems Pvt. Ltd.'))
})
test('Kanoda preserves all observed rows and source holds after an explicit zero limit',async()=>{
 const jobs=await run({fetchText,maxJobs:0})
 assert.equal(jobs.length,0)
 assert.equal(readSourceObservationEvidence(jobs,'kanodaenergysystemspvtltd').observedVacancyCount,4)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('Kanoda legacy callbacks remain transport-unverified with explicit source holds',async()=>{
 const jobs=await run({fetchText})
 assert.equal(readInventoryEvidence(jobs).firstParty,false)
 assert.ok(jobs.every(j=>j.sourceListingComplete===false&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
})
for(const kind of ['request','source']){
 test('Kanoda '+kind+' deadline bounds an uncooperative callback',async()=>{
  let timer
  try{
   const result=await Promise.race([run({sourceTimeoutMs:kind==='source'?5:1000,requestTimeoutMs:kind==='request'?5:1000,fetchText:()=>new Promise(()=>{})}).then(()=>null,e=>e),new Promise(resolve=>{timer=setTimeout(()=>resolve('missing deadline'),250)})])
   assert.equal(result?.name,'TimeoutError')
  }finally{clearTimeout(timer)}
 })
}
test('Kanoda caller cancellation preserves the exact reason',async()=>{
 const controller=new AbortController(),reason=new Error('Kanoda caller stop');let timer
 try{
  const result=await Promise.race([run({signal:controller.signal,fetchText:()=>{controller.abort(reason);return new Promise(()=>{})}}).then(()=>null,e=>e),new Promise(resolve=>{timer=setTimeout(()=>resolve('missing cancellation'),250)})])
  assert.equal(result,reason)
 }finally{clearTimeout(timer)}
})
test('Kanoda capture retains exact current own public URLs',()=>{
 assert.deepEqual(capture.packets.map(p=>p.requestedUrl),[HOMEPAGE_URL,CAREERS_URL])
})
for(const statement of ['Employer: Different Employer Limited','You will be employed by Different Employer Limited.']){
 for(const [label,open,close] of [['paragraph','<p>','</p>'],['loose','',''],['aside','<aside>','</aside>'],['main','<main>','</main>']]){
  test('Kanoda own '+label+' employer contradiction excludes the affected role: '+statement,()=>{
   const jobs=extractJobs(html.replace(ownPanel,ownPanel+open+statement+close))
   assert.equal(jobs.length,3)
   assert.equal(readSourceObservationEvidence(jobs,'kanodaenergysystemspvtltd').observedVacancyCount,4)
  })
 }
}
for(const [label,open,close] of [['paragraph','<p>','</p>'],['loose','',''],['aside','<aside>','</aside>'],['main','<main>','</main>']]){
 test('Kanoda own '+label+' foreign worksite contradicts the literal India address proof',()=>{
  const jobs=extractJobs(html.replace(ownPanel,ownPanel+open+'Work Location: Toronto, Canada'+close))
  const admin=jobs.find(job=>job.title.startsWith('Admin Executive'))
  assert.equal(admin.country,null)
  assert.equal(admin.sourceCountryScopeUnresolved,true)
  assert.equal(admin.nativeWorkCountryEvidence,null)
  assert.equal(isIndiaJob(admin),false)
 })
}
for(const [label,open,close] of [['quoted','<blockquote>','</blockquote>'],['hidden','<div hidden>','</div>'],['template','<template>','</template>']]){
 test('Kanoda '+label+' declarations cannot contradict active own employer or worksite',()=>{
  const jobs=extractJobs(html.replace(ownPanel,ownPanel+open+'<p>Employer: Different Employer Limited</p><p>Work Location: Toronto, Canada</p>'+close))
  assert.equal(jobs.length,4)
  assert.ok(jobs.every(job=>job.country==='India'))
 })
}
test('Kanoda active base cannot change the own homepage careers delegation',()=>{
 assert.equal(hasOfficialHomepageSignal(original(HOMEPAGE_URL).replace('<head>','<head><base href="https://foreign.example/">')),false)
 assert.equal(hasOfficialHomepageSignal(original(HOMEPAGE_URL).replace('<head>','<head><template><base href="https://foreign.example/"></template>')),true)
})
test('Kanoda explicit country evidence never attaches a different worksite address',()=>{
 const changed=html.replace(/(>Location<\/div>[\s\S]*?class="right-side[^"]*">\s*)Ahmedabad/,'$1Mumbai, India')
 const admin=extractJobs(changed).find(job=>job.title.startsWith('Admin Executive'))
 assert.equal(admin.country,'India')
 assert.equal(admin.nativeWorkCountryEvidence.kind,'own-explicit-written-country')
 assert.equal(admin.nativeWorkCountryEvidence.nativeText,'Mumbai, India')
})
for(const declaration of ['Our overview<address>Employer: Different Employer Limited</address>','<p>Employer:</p><p>Different Employer Limited</p>','<p>Kanoda Energy Systems Pvt. Ltd. is not your employer.</p>','<p>Your employer is not Kanoda Energy Systems Pvt. Ltd.</p>']){
 test('Kanoda split, address or denied own employer cannot qualify a source role: '+declaration,()=>{
  const jobs=extractJobs(html.replace(ownPanel,ownPanel+declaration))
  assert.equal(jobs.length,3)
  assert.equal(readSourceObservationEvidence(jobs,'kanodaenergysystemspvtltd').observedVacancyCount,4)
 })
}
for(const declaration of ['Our overview<address>Work Location: Toronto, Canada</address>','<p>Work Location:</p><p>Toronto, Canada</p>','<p>Work Location: Not India</p>']){
 test('Kanoda split, address or denied India worksite remains country-unresolved: '+declaration,()=>{
  const admin=extractJobs(html.replace(ownPanel,ownPanel+declaration)).find(job=>job.title.startsWith('Admin Executive'))
  assert.equal(admin.country,null)
  assert.equal(isIndiaJob(admin),false)
 })
}
for(const statement of ['You will not be employed by Kanoda Energy Systems Pvt. Ltd.','You are not employed by Kanoda Energy Systems Pvt. Ltd.',"You won't be employed by Kanoda Energy Systems Pvt. Ltd."]){
 test('Kanoda own named employment denial excludes that source role: '+statement,()=>{
  assert.equal(extractJobs(html.replace(ownPanel,ownPanel+'<p>'+statement+'</p>')).length,3)
  assert.equal(extractJobs(html.replace(ownPanel,ownPanel+'<blockquote>'+statement+'</blockquote>')).length,4)
 })
}
