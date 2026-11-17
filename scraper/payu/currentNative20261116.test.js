import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,CAREERS_URL} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261116.json.gz',import.meta.url))))
const board='https://careers.payu.in/PayU/go/_/514880/'
async function replay(mutate,capture=fixture){
 const calls=[]
 const jobs=await run({fetchPage:async url=>{calls.push(url);const p=capture.packets.find(p=>p.requestedURL===(url===CAREERS_URL?board:url));assert.ok(p,'Captured original response '+url);const page={status:p.status,url:p.url,html:Buffer.from(p.bodyBase64,'base64').toString('utf8')};return mutate?.(page,url)||page}})
 return{jobs,calls}
}
test('current PayU follows all six native pages but admits only three literal role-owned India placements',async()=>{
 const{jobs,calls}=await replay();assert.equal(jobs.length,3)
 assert.deepEqual(jobs.map(j=>j.nativePublicJobId).sort(),['53413680','53993980','54196180'])
 assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete&&j.sourceScopeComplete===false&&j.originalPublicationDate===null));assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,141);assert.equal(jobs.nativeCollectionEvidence.nativeFullCriteriaCount,129);assert.equal(jobs.nativeCollectionEvidence.placeholderCriteriaCount,12)
 assert.equal(jobs.nativeCollectionEvidence.explicitIndiaPlacementCount,3);assert.equal(jobs.nativeCollectionEvidence.countryCodeSemanticsVerified,false)
 assert.equal(jobs.nativeCollectionEvidence.countryUnknownRecords.length,137);assert.deepEqual(jobs.nativeCollectionEvidence.explicitPlacementConflicts.map(p=>p.publicId),['53562080'])
 assert.ok(jobs.nativeCollectionEvidence.countryUnknownRecords.some(p=>p.publicId==='53516480'&&p.criteriaComplete===false))
 assert.ok(calls.includes(board+'125/'));assert.ok(calls.every(u=>!u.includes('/talentcommunity/')))
})
test('current PayU accepts only captured complete paired subscription-control ID variants',async()=>{
 const closing=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-closing-20261116.json.gz',import.meta.url))))
 const partial=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/default-first-detail-20261116.json.gz',import.meta.url))))
 const packets=closing.packets.map(p=>partial.packets.find(q=>q.url===p.url&&q.url.includes('/job/'))||p)
 const{jobs}=await replay(undefined,{packets});assert.equal(jobs.length,3)
})
for(const[label,mutate]of[
 ['wrong employer',(p,u)=>u.includes('/job/')?{...p,html:p.html.replace('content="PayU Payments"','content="Other Employer"')}:p],
 ['wrong tenant',(p,u)=>u===CAREERS_URL?{...p,html:p.html.replace("'payupaymen'","'other-employer'")}:p],
 ['new native program',(p,u)=>u.includes('/job/')?{...p,html:p.html.replace('</head>','<script>unreviewed()</script></head>')}:p],
 ['removed explicit India placement',(p,u)=>u.includes('/53413680/')?{...p,html:p.html.replace('India — Hybrid','Canada — Hybrid')}:p],
 ['contradictory native address',(p,u)=>u.includes('/54196180/')?{...p,html:p.html.replace('content="Mumbai, IN"','content="Mumbai, US"')}:p],
 ['mixed country alternatives',(p,u)=>u.includes('/54196180/')?{...p,html:p.html.replace('content="Mumbai, IN"','content="Mumbai, IN / US"')}:p],
 ['changed pagination total',(p,u)=>u.endsWith('/25/')?{...p,html:p.html.replace('of <b>141</b>','of <b>140</b>')}:p],
 ['foreign redirect',(p,u)=>u.endsWith('/25/')?{...p,url:'https://unrelated.example/jobs'}:p],
 ['unpaired generated control ownership',(p,u)=>u.includes('/job/')?{...p,html:p.html.replace(/for="j_idt\d+"/,'for="j_idt999"')}:p],
])test('current PayU rejects '+label,async()=>assert.rejects(replay(mutate)))
