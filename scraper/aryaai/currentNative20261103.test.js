import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,HOMEPAGE_URL,CAREERS_URL} from './script.js'
import {getScraperCatalog} from '../../scraper-support/providers/index.js'
const ROLE='https://wellfound.com/jobs/3542202-senior-data-scientist'
globalThis.fetch=async()=>{throw Error('Offline source tests prohibit live requests')}
const fixture=label=>gunzipSync(readFileSync(new URL('./test-data/current-20261103/'+label+'.html.gz',import.meta.url))).toString('utf8')
const response=(url,html,status=200)=>({url,status,html})
const reader=(calls=[],change)=>async(url,options)=>{
 calls.push({url,options})
 const label=url===HOMEPAGE_URL?'home':url===CAREERS_URL?'careers':url===ROLE?'declared-role':null
 if(label){const page=response(url,fixture(label),label==='declared-role'?410:200);return change?change(page,calls):page}
 // Synthetic old route fixtures allow the former collector to finish so the
 // red result exposes its brief-to-vacancy promotion, rather than a fixture miss.
 if(url==='https://arya.ai/sitemap.xml')return response(url,'<urlset><url><loc>https://arya.ai/careers</loc></url></urlset>')
 return response(url,'<html><head><title>Not Found</title></head></html>',404)
}
test('the real corporate brief and gone native application detail stay observations with unknown countries',async()=>{
 const calls=[],audits=[],jobs=await run({fetchPage:reader(calls),onAudit:a=>audits.push(a)})
 assert.equal(jobs.length,0);assert.equal(audits.length,1)
 const row=audits[0].observations[0]
 assert.equal(row.title,'Senior Data Scientist');assert.equal(row.jobId,'3542202');assert.equal(row.requisitionId,null)
 assert.equal(row.country,null);assert.equal(row.location,null);assert.equal(row.workMode,'On-site')
 assert.equal(row.sourceDetailComplete,false);assert.equal(row.nativeDetail.status,410)
 assert(row.sourceSummary.includes('Senior Research Scientist'))
 assert.equal(audits[0].inventoryEvidence.reportedTotal,null);assert.equal(audits[0].lifecycleCleanupAllowed,false)
 assert.deepEqual(calls.map(r=>r.url),[HOMEPAGE_URL,CAREERS_URL,ROLE,HOMEPAGE_URL,CAREERS_URL])
})
test('a changed closing brief is held before any stale role can be emitted',async()=>{
 let careers=0
 await assert.rejects(run({fetchPage:reader([],page=>page.url===CAREERS_URL&&++careers===2?{...page,html:page.html.replace('production-grade AI modules','new public qualification')}:page)}))
})
test('a hidden or inert current role cannot establish an empty or active vacancy',async()=>{
 for(const body of ['<template>'+fixture('careers')+'</template>',fixture('careers').replace('class="car_item"','class="car_item" hidden')])await assert.rejects(run({fetchPage:reader([],page=>page.url===CAREERS_URL?{...page,html:body}:page)}))
})
test('an off-domain role link is rejected without fetching it',async()=>{
 const calls=[]
 await assert.rejects(run({fetchPage:reader(calls,page=>page.url===CAREERS_URL?{...page,html:page.html.replace(ROLE,'https://example.com/jobs/3542202')}:page)}))
 assert(!calls.some(row=>row.url.includes('example.com')))
})
test('a nonstandard port is outside the exact declared native origin',async()=>{
 const calls=[]
 await assert.rejects(run({fetchPage:reader(calls,page=>page.url===CAREERS_URL?{...page,html:page.html.replace(ROLE,ROLE.replace('wellfound.com','wellfound.com:444'))}:page)}))
 assert(!calls.some(row=>row.url.includes(':444')))
})
test('the same native numeric ID cannot become two roles through different slugs',async()=>{
 const {inspectCurrentAryaCareers}=await import('./currentNative.js')
 // Both cards retain their own complete structural wrappers; only the public
 // route slug differs. The native numeric identity remains the same.
 const body=fixture('careers'),start=body.indexOf('<div class="car_item">'),tail=body.indexOf('<div class="car_contract">',start),end=body.indexOf('</div></div></div>',tail)
 assert(start>=0&&tail>start&&end>tail)
 const card=body.slice(start,end+'</div></div>'.length)
 assert.throws(()=>inspectCurrentAryaCareers(body.replace('</body>',card.replace('3542202-senior-data-scientist','3542202-different-native-slug')+'</body>')))
})
test('public retry-after metadata survives a source-local 429 without retrying',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async url=>{calls++;return{...response(url,'denied',429),headers:new Headers({'retry-after':'90'})}}}),e=>e.status===429&&e.retryDelayMs===90000&&e.abortRetries===true)
 assert.equal(calls,1)
})
for(const status of [401,403,429])test('corporate HTTP '+status+' remains a source-local access error',async()=>{
 let calls=0
 await assert.rejects(run({fetchPage:async url=>{calls++;return response(url,'denied',status)}}),e=>e.status===status&&e.abortRetries===true&&!e.isPipelineFatal&&!e.abortPipeline)
 assert.equal(calls,1)
})
test('a denied exact external detail is retained once without an access bypass or false full criteria',async()=>{
 const calls=[],audits=[],jobs=await run({fetchPage:reader(calls,page=>page.url===ROLE?{...page,status:403}:page),onAudit:a=>audits.push(a)})
 assert.equal(jobs.length,0);assert.equal(calls.filter(r=>r.url===ROLE).length,1)
 assert.equal(audits[0].observations[0].nativeDetail.status,403);assert.equal(audits[0].observations[0].sourceDetailComplete,false)
})
test('bare text and wrong final URLs cannot supply authoritative response identity',async()=>{
 for(const fetchPage of [async()=>fixture('home'),async()=>response('https://example.com/',fixture('home'))])await assert.rejects(run({fetchPage}))
})
test('ignored public readers and observers have a source deadline',{timeout:1000},async()=>{
 for(const options of [{fetchPage:()=>new Promise(()=>{})},{fetchPage:reader(),onAudit:()=>new Promise(()=>{})}])await assert.rejects(run({...options,collectionBudgetMs:25}),e=>e.name==='TimeoutError')
})
test('caller cancellation preserves the original reason and signal identity',async()=>{
 const controller=new AbortController(),reason={cancelled:true};let supplied
 await assert.rejects(run({signal:controller.signal,fetchPage:async(url,options)=>{supplied=options.signal;controller.abort(reason);return response(url,fixture('home'))}}),e=>e===reason)
 assert.equal(supplied,controller.signal)
})
test('catalog removes historical current-surface and whole-inventory promises',()=>{
 const row=getScraperCatalog().find(r=>r.source==='aryaai')
 assert.equal(row.verifiedOn,null);assert.equal(row.verifiedPublicJobCount,null)
 assert.equal(row.zeroResultPolicy,'evidence-required');assert.equal(row.sourceScopeComplete,false)
})
