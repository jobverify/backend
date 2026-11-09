import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/darwinbox-current-client-20261105.json.gz',import.meta.url))))
const hash=value=>createHash('sha256').update(value).digest('hex')
const main='main.819c4120b20f8091.js',runtime='runtime.aef58315a4bbce97.js'
const oldMain='main.71bd301266b6050c.js'
const counts={keyence:5,perfios:2,stanplus:20,datapatterns:13}

// Only the candidate assets are replaced here. Native API and corporate bodies
// stay in their retained October fixtures: this is a compatibility replay.
function transport(source,change=()=>{},freshNative=false){
 const date=['keyence','datapatterns'].includes(source)?'20261029':'20261030'
 const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL(`../scraper/${source}/fixtures/native-${date}.json.gz`,import.meta.url))))
 const calls=[];let phase='opening',companyReads=0
 return {calls,fetchImpl:async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted()
  const matches=packets.filter(p=>p.url===url&&(p.method||'GET')===(init.method||'GET'))
  const seeded=url.includes('/ms/candidatev2/')&&!init.headers
  let row
  if(url.endsWith('/'+main))row={url,status:200,contentType:'application/javascript',body:current.client}
  else {
   const packet=matches.find(p=>seeded?p.bodyConsumed===false:init.headers?.['User-Agent']?.includes('Chrome/')&&matches.some(x=>x.scripts)?Boolean(p.scripts):p.bodyConsumed!==false)||matches[0]
   assert.ok(packet,'No retained compatibility receipt for '+url);row=structuredClone(packet)
   if(url.includes('/ms/candidatev2/')&&!url.endsWith('.js')&&init.headers?.['User-Agent']?.includes('Chrome/'))row.body=current.shell
  }
  if(freshNative&&url.includes('/ms/candidateapi/')){
   const path=url.split('/ms/candidateapi/')[1]
   if(path.startsWith('getCompanyConfig?'))phase=++companyReads===1?'opening':'closing'
   const native=current.native[source][phase]
   const payload=path.startsWith('getCompanyConfig?')?native.company:path.startsWith('groupcompanycareersetting?')?native.group:path.startsWith('job?page=')?native.payloads[Number(new URL(url).searchParams.get('page'))-1]:path.startsWith('job/')?native.detailPayloads.find(p=>p.message.job[0].id===path.slice(4).split('?')[0]):null
   if(payload)row.body=JSON.stringify(payload)
  }
  change(row,calls);calls.push(url)
  const response=new Response(row.body||'',{status:row.status,headers:{'Content-Type':row.contentType||'text/html','Set-Cookie':'fixture-public=1; Path=/'}})
  Object.defineProperty(response,'url',{value:row.finalUrl||row.url});return response
 }}
}

test('fresh candidate assets have exact public receipt digests for each evidenced source',()=>{
 for(const result of current.results){
  assert.equal(hash(current.client),result.client.sha256)
  assert.equal(hash(current.runtime),result['runtime-client'].sha256)
  const shell=current.receipts.find(r=>r.source===result.source&&r.artifact.endsWith('-shell.html'))
  assert.equal(hash(current.shell),shell.sha256)
 }
})

for(const source of Object.keys(counts))test(`${source} accepts the exact November release with retained native/corporate compatibility receipts`,async()=>{
 const http=transport(source),{run}=await import(`../scraper/${source}/script.js`),jobs=await run(http)
 assert.equal(jobs.length,counts[source]);assert.ok(jobs.every(j=>j.country==='India'))
 assert.equal(http.calls.filter(url=>url.endsWith('/'+main)).length,2)
 assert.equal(http.calls.some(url=>url.endsWith('/'+oldMain)),false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,['keyence','datapatterns'].includes(source))
})

for(const source of Object.keys(counts))test(`${source} current native API criteria replay keeps all closing drift and blank-description gaps`,async()=>{
 const http=transport(source,()=>{},true),{run}=await import(`../scraper/${source}/script.js`),jobs=await run(http),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,{keyence:4,perfios:2,stanplus:20,datapatterns:7}[source])
 assert.equal(evidence.listingComplete,source==='keyence')
 if(source!=='keyence')assert.match(evidence.reason,/closing-native-inventory-or-full-details-changed/)
})

for(const [label,change,expected]of [
 ['unknown main filename',row=>{if(row.body===current.shell)row.body=row.body.replace(main,'main.0000000000000000.js')},/active candidate client changed/],
 ['foreign main URL',row=>{if(row.body===current.shell)row.body=row.body.replace('src="'+main+'"','src="https://unbound.example/'+main+'"')},/active candidate client changed/],
 ['current filename with changed client bytes',row=>{if(row.url.endsWith('/'+main))row.body+=';/* unreviewed */'},/reviewed public API client changed/],
])test('release gate rejects '+label,async()=>{
 const http=transport('keyence',change),{run}=await import('../scraper/keyence/script.js')
 await assert.rejects(run(http),expected)
})

for(const [label,addition]of [
 ['mismatched runtime filename',body=>body.replace(runtime,'runtime.70a35d9c3eae92d3.js')],
 ['unknown extra runtime',body=>body+'<script src="runtime.unknown.js"></script>'],
 ['unreviewed hiring script',body=>body+'<script src="https://jobs.ashbyhq.com/another/embed.js"></script>'],
])test('release gate preserves incomplete source scope for '+label,async()=>{
 const http=transport('keyence',row=>{if(row.body===current.shell)row.body=addition(row.body)}),{run}=await import('../scraper/keyence/script.js'),jobs=await run(http)
 assert.equal(jobs.length,5);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(readInventoryEvidence(jobs).reason,/unreviewed-native-candidate-shell/)
 assert.ok(jobs.every(job=>job.lifecycleCleanupAllowed===false))
})

test('the exact current shell cannot certify a closing change back to the retained release',async()=>{
 let reads=0
 const oldShell=current.shell.replace(main,oldMain).replace(runtime,'runtime.70a35d9c3eae92d3.js')
 const http=transport('keyence',row=>{if(row.body===current.shell&&++reads===2)row.body=oldShell}),{run}=await import('../scraper/keyence/script.js'),jobs=await run(http)
 assert.equal(jobs.length,5);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(readInventoryEvidence(jobs).reason,/closing-native-candidate-shell-changed/)
})
