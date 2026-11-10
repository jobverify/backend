import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-continuation-20261110.json.gz',import.meta.url))))
const corporate='https://www.gitbook.com/careers'
async function replay({pageMutation,programMutation,jsonMutation}={}){
 const calls=[]
 const read=async(url,kind)=>{
  calls.push({url,kind});const n=calls.filter(c=>c.url===url).length,row=capture.responses.filter(r=>r.url===url)[n-1]
  assert.ok(row,'Unexpected public URL or excess request: '+url)
  const packet={url:row.finalUrl,status:row.status,html:row.body,contentType:row.contentType}
  return kind==='program'&&programMutation?programMutation(packet,url,n):kind==='page'&&pageMutation?pageMutation(packet,url,n):packet
 }
 const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source==='gitbook')).run({now:()=>capture.completedAt,fetchPage:url=>read(url,'page'),fetchProgram:url=>read(url,'program'),fetchJson:async url=>{const value=JSON.parse((await read(url,'json')).html);return jsonMutation?jsonMutation(value,calls.filter(c=>c.url===url).length):value}})
 return{jobs,calls,audit:jobs.nativeCollectionEvidence}
}
test('Nov10 afternoon GitBook deployment retains the three complete global roles and unresolved country',async()=>{
 assert.equal(capture.responses.length,30)
 for(const r of capture.responses){assert.equal(createHash('sha256').update(r.body).digest('hex'),r.sha256);assert.equal(Buffer.byteLength(r.body),r.bytes)}
 const{jobs,calls,audit}=await replay()
 assert.deepEqual(jobs.map(j=>j.title),['Global Field Marketing Manager','Technical Support Specialist','Enterprise Account Executive'])
 assert.equal(calls.length,30);assert.equal(audit.employerScopeStable,true);assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.employerOpening.declaredProgramProofs.length,10)
 assert.ok(audit.detailProofs.every(p=>p.complete&&p.reasons.length===0))
 for(const job of jobs){assert.equal(job.company,'GitBook');assert.equal(job.country,null);assert.equal(job.sourceDetailComplete,true);assert.equal(job.nativeAddressCountry,'Remote');assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.ok(job.jobDescription.length>1000)}
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
for(const [label,mutation]of[
 ['new hiring text',html=>html.replace('Open roles','Unreviewed open roles')],
 ['hidden role handoffs',html=>html.replaceAll('href="https://jobs.ashbyhq.com/GitBook/','hidden href="https://jobs.ashbyhq.com/GitBook/')],
 ['new hiding stylesheet',html=>html.replace('</head>','<style>a{display:none}</style></head>')],
])test('Nov10 afternoon GitBook rejects '+label,async()=>{await assert.rejects(replay({pageMutation:(p,u)=>u===corporate?{...p,html:mutation(p.html)}:p}),/scope changed|binding unavailable|role handoff unavailable/)})
test('Nov10 afternoon GitBook rejects changed closing declared program bytes',async()=>{await assert.rejects(replay({programMutation:(p,u,n)=>n===2?{...p,html:p.html+'\n;'}:p}),/program.*changed/)})
test('Nov10 afternoon GitBook rejects a changed closing inventory',async()=>{await assert.rejects(replay({jsonMutation:(value,n)=>{if(n===2)value.jobs.pop();return value}}),/closing-inventory-changed/)})
test('Nov10 afternoon GitBook revokes completeness for an altered native bootstrap',async()=>{const{jobs,audit}=await replay({pageMutation:(p,u)=>u.startsWith('https://jobs.ashbyhq.com/')?{...p,html:p.html.replace('const ENTRY_KEY = "index.html";','const ENTRY_KEY = "index.html";window.unreviewed=true;')}:p});assert.ok(jobs.every(j=>j.sourceDetailComplete===false));assert.ok(audit.detailProofs.every(p=>p.reasons.some(r=>/reviewed-bootstrap/.test(r))))})
