import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{createAirAsiaIndiaScraper}from'./script.js'
import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const rows=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url)))),pages=new Map(rows.map(row=>[row.requestedUrl,row]))
const search='https://careers.airindia.com/aix/search/?q=&locationsearch=',board='https://careers.airindia.com/aix',model='https://www.airindiaexpress.com/content/airindiaexpress/en/careers.model.json'
const seam=(change=()=>{})=>{const visits=new Map(),requests=[];return{requests,fetchPage:async(url,request)=>{assert.ok(pages.has(url),'fixture missing '+url);requests.push(url);const page=structuredClone(pages.get(url)),visit=(visits.get(url)||0)+1;visits.set(url,visit);await change(page,{url,visit,request});return page}}}
const run=async(change,options={})=>{let audit;const injected=seam(change),jobs=await createAirAsiaIndiaScraper().run({...injected,...options,onAudit:value=>{audit=value;return options.onAudit?.(value)}});return{jobs,audit,requests:injected.requests}}
test('historical AirAsia India follows the current AIX corporate model and declared brand board to an explicit closing zero',async()=>{
 const{jobs,audit,requests}=await run(),proof=readInventoryEvidence(jobs);assert.equal(jobs.length,0);assert.equal(proof.status,'verified-empty');assert.equal(proof.listingComplete,true)
 assert.equal(proof.surface,search);assert.equal(proof.reportedTotal,0);assert.equal(proof.indiaFacetCount,0)
 assert.equal(audit.currentEmployer,'Air India Express');assert.equal(audit.nativeBrand,'aix');assert.equal(audit.sourceDeclaredBoardScopeComplete,true)
 assert.equal(audit.sourceCompanyWideScopeComplete,false);assert.equal(audit.sourceLifecycleCleanupVerified,false)
 assert.equal(requests.filter(url=>url===search).length,2);assert.ok(!requests.some(url=>url.includes('airasia.com')||url.includes('aixconnect.in')))
})
test('an Air India global brand search cannot substitute for the declared AIX brand',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===search)page.body=page.body.replace('"brand"          : "aix"','"brand"          : ""')}),/brand|AIX/)
})
test('a filtered native keyword search cannot certify AIX zero inventory',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===search)page.body=page.body.replace("'q'              : ''","'q'              : 'engineer'")}),/blank|filter|query/i)
})
test('a missing no-open-positions sentence is unknown even when a fallback zero sentence remains',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===search)page.body=page.body.replace('There are currently no open positions matching','Search results are loading matching')}),/explicit|zero|empty/i)
})
test('active role links alongside stale zero copy remain unqualified positive inventory',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===search)page.body=page.body.replace('</body>','<a href="/aix/job/Gurgaon-Engineer/12345/">Engineer</a></body>')}),/positive|role|posting/i)
})
test('a corporate model handoff to broad Air India is not an AIX binding',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===model)page.body=page.body.replace('https://careers.airindia.com/aix','https://careers.airindia.com/')}),/handoff|scope|AIX/)
})
test('a new native department channel cannot hide behind a stale unfiltered zero',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===board)page.body=page.body.replace('</body>','<a href="https://jobs.example.com/other">New Jobs</a></body>')}),/channel|department|handoff/i)
})
test('closing AIX changes cannot retain verified-empty evidence',async()=>{
 await assert.rejects(run((page,{url,visit})=>{if(url===search&&visit===2)page.body=page.body.replace('The 0 most recent jobs posted','The 1 most recent jobs posted')}),/zero|count/i)
})
test('HTTP200 marketing and error shells cannot certify zero',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===search)page.body='<html><title>Air India Careers Jobs</title><p>Welcome to careers</p></html>'}),/native|AIX|brand|zero/i)
})
test('AIX cancellation preserves caller reason and makes no reads',async()=>{
 const controller=new AbortController(),reason=Error('cancel AIX');controller.abort(reason);const injected=seam()
 await assert.rejects(createAirAsiaIndiaScraper().run({...injected,signal:controller.signal}),error=>error===reason);assert.equal(injected.requests.length,0)
})
test('AIX deadline bounds a noncooperative HTTP read and audit callback',async()=>{
 await assert.rejects(createAirAsiaIndiaScraper().run({timeoutMs:20,fetchPage:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
 await assert.rejects(run(undefined,{timeoutMs:300,onAudit:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
})
