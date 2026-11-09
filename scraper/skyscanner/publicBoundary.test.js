import test from 'node:test'
import assert from 'node:assert/strict'
import {runPublicCollection} from './publicBoundary.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
test('collection deadline bounds an abort-ignoring collaborator',async()=>{
 await assert.rejects(runPublicCollection('skyscanner',{collectionTimeoutMs:15},async boundary=>boundary.read('https://www.skyscanner.com/jobs/current-jobs',()=>new Promise(()=>{}))),error=>error.name==='TimeoutError'&&error.abortRetries===true)
})
test('caller opaque abort reason retains identity and blocks later public requests',async()=>{
 const controller=new AbortController(),reason={opaque:true};let calls=0
 const pending=runPublicCollection('canva',{signal:controller.signal},async boundary=>{await boundary.read('https://www.lifeatcanva.com/en/jobs/',()=>{calls++;return new Promise(()=>{})});return[]});setTimeout(()=>controller.abort(reason),5)
 await assert.rejects(pending,error=>error===reason);assert.equal(calls,1)
})
test('received denial retains status, retry-after and unknown totals and blocks another path on that host',async()=>{
 let calls=0
 await assert.rejects(runPublicCollection('bnpparibas',{},async boundary=>{await boundary.read('https://group.bnpparibas/en/careers/all-job-offers/bnp-paribas-india-solutions',async()=>{calls++;return{status:429,url:'https://group.bnpparibas/en/careers/all-job-offers/bnp-paribas-india-solutions',headers:{'retry-after':'60'},html:'Rate limited'}});await boundary.read('https://group.bnpparibas/another-path',async()=>{calls++;return{status:200}})}),error=>error.status===429&&error.abortRetries===true&&error.retryDelayMs===60000&&error.inventoryEvidence.reportedTotal===null&&error.inventoryEvidence.indiaFacetCount===null)
 assert.equal(calls,1)
})
test('a received403 is retained even when its body cancellation never settles',async()=>{
 let bodies=0
 await assert.rejects(runPublicCollection('atherenergy',{collectionTimeoutMs:50},async boundary=>boundary.fetchPage('https://careers.atherenergy.com/',async(url,options)=>({url,status:403,headers:new Headers(),body:{cancel:()=>new Promise(()=>{})},text:()=>{bodies++;throw Error('denied body must not be read')}}))),error=>error.status===403&&error.abortRetries===true)
 assert.equal(bodies,0)
})
test('unqualified successful arrays never acquire complete or empty inventory authority',async()=>{
 const jobs=await runPublicCollection('canva',{},async()=>[]),evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})
for(const source of['skyscanner','canva','atherenergy','bnpparibas'])test(source+' original corporate response bytes preserve denial or unverified handoff; no fake zero',async()=>{
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../'+source+'/test-data/public-boundary-evidence-20261103.json.gz',import.meta.url)))),rows=fixture.responses;assert.equal(fixture.diagnosticOnly,true);assert.ok(rows.length)
 for(const row of rows)assert.equal(createHash('sha256').update(Buffer.from(row.bodyBase64,'base64')).digest('hex'),row.sha256)
 const operation=async boundary=>{for(const row of rows)await boundary.read(row.url,async()=>({url:row.finalURL,status:row.status,headers:row.headers,html:Buffer.from(row.bodyBase64,'base64').toString('utf8')}));return[]}
 if(source==='bnpparibas'){const jobs=await runPublicCollection(source,{},operation);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)}
 else await assert.rejects(runPublicCollection(source,{},operation),error=>error.status===403&&error.abortRetries===true&&error.inventoryEvidence.reportedTotal===null)
})
