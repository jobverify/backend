import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import manifest from './test-data/manifest-20261103.js'
import {createAdvariskScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
const zipped=fs.readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))
assert.equal(createHash('sha256').update(zipped).digest('hex'),manifest.fixtureSha256)
const captures=JSON.parse(gunzipSync(zipped))
for(const row of captures)assert.equal(createHash('sha256').update(row.html).digest('hex'),row.sha256)
const source="advarisk",home=null,careers="https://advarisk.com/careers/"
const page=async(url,options)=>{
 const row=captures.findLast(row=>row.requestedUrl===url)
 assert.ok(row,'unexpected ordinary public request '+url)
 return row.html
}
const run=(reader=page,options={})=>createAdvariskScraper().run({fetchText:reader,...options})
const modify=(value,transform)=>typeof value==='string'?transform(value):{...value,html:transform(value.html),text:transform(value.text)}

test(source+' retains current public hiring interest with unknown vacancy inventory and an exact closing model',async()=>{
 let audit;const requests=[]
 const jobs=await run(async(url,options)=>{requests.push(url);return page(url,options)},{onAudit:async value=>{audit=value}})
 const evidence=readInventoryEvidence(jobs),observed=readSourceObservationEvidence(jobs,source)
 assert.equal(jobs.length,0)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(evidence.listingComplete,false)
 assert.deepEqual(requests,home?[home,careers,home,careers]:[careers,careers])
 assert.equal(observed.recordKind,'hiring-signals')
 assert.equal(observed.observedVacancyCount,0)
 assert.equal(observed.observedRecordCount,1)
 assert.equal(audit.observations.length,1)
 assert.equal(audit.observations[0].country,null)
 assert.equal(audit.observations[0].vacancy,false)
 assert.equal(audit.closingMatches,true)
 assert.ok(audit.publicPages.every(row=>row.html&&row.sha256))
 if(source==='advarisk'){assert.equal(audit.observations[0].unsupportedCounterText,'7 open positions');assert.equal(audit.observations[0].confirmedVacancyCount,null)}
})

test(source+' never promotes commented, template or unrevealed hidden role markup into vacancy observations',async()=>{
 let audit
 const hidden='<!-- <article class="job-card">Commented Engineer</article> --><template><article class="job-card">Template Engineer</article></template><div hidden><a href="/jobs/hidden-engineer">Hidden Engineer</a></div><div style="display:none"><article class="job-card">Invisible Engineer</article></div>'
 const jobs=await run(async(url,options)=>modify(await page(url,options),html=>url===careers?html+hidden:html),{onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0)
 assert.equal(audit.observations.length,1)
 assert.equal(audit.possibleVacancyMarkup.length,0)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test(source+' retains new active role discovery and fails closed until a native role collector is implemented',async()=>{
 let audit
 await assert.rejects(run(async(url,options)=>modify(await page(url,options),html=>url===careers?html+'<article class="job-card"><h2>Current Native Engineer</h2><a href="/jobs/current-native-engineer">View role details</a></article>':html),{onAudit:value=>{audit=value}}),/public.*(?:job|vacanc).*collector/i)
 assert.ok(audit.possibleVacancyMarkup.length)
 assert.equal(audit.inventoryEvidence.listingComplete,false)
})

test(source+' rejects a foreign response even if it copies the branded public page',async()=>{
 await assert.rejects(run(async(url,options)=>{const value=await page(url,options);return {status:200,url:'https://unrelated.invalid/careers',html:typeof value==='string'?value:value.html}}),/first-party|response identity/i)
})

test(source+' retains initial observations when its closing hiring entry model changes',async()=>{
 let reads=0,audit
 await assert.rejects(run(async(url,options)=>{
  const value=await page(url,options)
  return url===careers&&++reads===2?modify(value,html=>html.replace(/careers@abmindia.com|jobs@ananthtech.com|7\s+open\s+positions|Upload Your Resume/gi,'REMOVED NATIVE INTAKE')):value
 },{onAudit:value=>{audit=value}}),/closing.*(?:changed|reconcile)/i)
 assert.equal(audit.observations.length,1)
 assert.equal(audit.closingMatches,false)
})

test(source+' caller abort settles an injected reader that ignores its signal',async()=>{
 const controller=new AbortController(),reason={opaque:source+' caller read'};let timer
 try{
 const result=await Promise.race([run((_url,options)=>{assert.equal(options.signal,controller.signal);controller.abort(reason);return new Promise(()=>{})},{signal:controller.signal}).then(()=>({}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),150)})])
 assert.equal(result.error,reason)
 }finally{clearTimeout(timer)}
})

test(source+' caller abort settles an observer and preserves its exact reason',async()=>{
 const controller=new AbortController(),reason={opaque:source+' observer abort'};let timer,calls=0
 try{
 const result=await Promise.race([run(page,{signal:controller.signal,onAudit:()=>{calls++;controller.abort(reason);return new Promise(()=>{})}}).then(()=>({}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),250)})])
 assert.equal(result.error,reason)
 assert.equal(calls,1)
 }finally{clearTimeout(timer)}
})

test(source+' rejected observers propagate once without changing their identity',async()=>{
 const reason={opaque:source+' observer rejection'};let calls=0
 await assert.rejects(run(page,{onAudit:async()=>{calls++;throw reason}}),error=>error===reason)
 assert.equal(calls,1)
})

test(source+' rejects an entirely unrevealed hidden careers surface',async()=>{
 await assert.rejects(run(async(url,options)=>modify(await page(url,options),html=>url===careers?'<div class="d-none">'+html+'</div>':html)),/official careers.*(?:identity|entry)/i)
})

test(source+' collection budget settles an observer even without a caller signal',async()=>{
 let timer
 try{
 const result=await Promise.race([run(page,{collectionBudgetMs:30,onAudit:()=>new Promise(()=>{})}).then(()=>({}),error=>({error})),new Promise(resolve=>{timer=setTimeout(()=>resolve({pending:true}),250)})])
 assert.equal(result.error?.name,'TimeoutError')
 assert.equal(result.error?.code,'PUBLIC_HIRING_COLLECTION_TIMEOUT')
 }finally{clearTimeout(timer)}
})
