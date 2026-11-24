import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {parseNative,HOME,CAREERS} from './parser.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261120.json.gz',import.meta.url))))
const text=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
const home=text(fixture.packets.find(packet=>packet.requestedURL===HOME)),careers=text(fixture.packets.find(packet=>packet.requestedURL===CAREERS))
async function replay(t,change){
 const calls=[],mutations=[]
 t.mock.method(globalThis,'fetch',()=>{throw Error('Only retained original regional Epson bytes are available')})
 try{
  const jobs=await run({transport:async url=>{
   calls.push(url);const original=fixture.packets.find(packet=>packet.requestedURL===url);assert.ok(original)
   const packet={...structuredClone(original),body:text(original),bodyComplete:true}
   const before=JSON.stringify(packet);change?.(packet,url)
   if(JSON.stringify(packet)!==before)mutations.push(url)
   return{...packet,body:Buffer.from(packet.body)}
  }})
  return{jobs,calls,mutations}
 }catch(error){return{error,calls,mutations}}
}

test('one current unqualified country row preserves two complete independently qualified India roles',async t=>{
 const parsed=parseNative(home,careers)
 assert.equal(parsed.roles.length,3);assert.deepEqual(parsed.errors.map(error=>error.code),['country-unverified-or-conflicting'])
 const result=await replay(t);assert.ifError(result.error);assert.equal(result.jobs.length,2)
 const expected=parsed.roles.filter(role=>role.countryEvidence.country==='India')
 assert.deepEqual(result.jobs.map(job=>job.nativeFacts),expected)
 assert.ok(result.jobs.every(job=>job.country==='India'&&job.nativeLegalEmployer===null&&job.postingDate===null&&job.nativeClosingDate===null))
 const evidence=result.jobs[0].nativeCollectionEvidence
 assert.equal(evidence.observedArticleCount,3);assert.equal(evidence.roles.length,3)
 assert.equal(evidence.heldRoles.length,1);assert.equal(evidence.heldRoles[0].role.locationOriginal,'Coimbatore')
 assert.equal(evidence.heldRoles[0].role.countryEvidence.country,null)
 assert.equal(evidence.cleanupAllowed,false);assert.equal(evidence.verifiedZeroInventory,false)
 assert.equal(readInventoryEvidence(result.jobs).listingComplete,false)
 assert.deepEqual(result.calls,[HOME,CAREERS])
})

test('a conflicting country stays held without changing an unrelated full India role',async t=>{
 const result=await replay(t,(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replace(/(<article\b[^>]*>)/,'$1<meta itemprop="addressCountry" content="SG">')})
 assert.ifError(result.error);assert.ok(result.mutations.length>0);assert.equal(result.jobs.length,1)
 assert.equal(result.jobs[0].nativeFacts.locationOriginal,'Delhi')
 assert.equal(result.jobs[0].nativeCollectionEvidence.heldRoles.length,2)
 assert.ok(!result.jobs.some(job=>job.nativeFacts.countryEvidence.nativeStructuredAddressCountry==='SG'))
})

for(const[name,change]of[
 ['all country rows unresolved',(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replace(/(<article\b[^>]*>)/g,'$1<meta itemprop="addressCountry" content="SG">')}],
 ['regional publisher identity missing',(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replace(/(<h1\b[^>]*>)[\s\S]*?(<\/h1>)/,'$1Another Employer vacancies$2')}],
 ['unknown role schema',(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replace(/(<article\b[^>]*>)/,'$1<time itemprop="datePosted">2026-11-20</time>')}],
 ['foreign application criteria',(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replaceAll('careers@eid.epson.co.in','careers@another.example')}],
 ['unaccounted structured role',(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replace('</body>','<script type="application/ld+json">{"@type":"JobPosting","title":"unreviewed"}</script></body>')}],
 ['incomplete original publication',(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replace('</html>','')}],
 ['unknown pagination',(packet,url)=>{if(url===CAREERS)packet.body=packet.body.replace('</body>','<a rel="next" href="?page=2">Next</a></body>')}],
 ['unbound homepage handoff',(packet,url)=>{if(url===HOME)packet.body=packet.body.replaceAll('/careers','/unqualified')}],
 ['publisher denial',(packet,url)=>{if(url===CAREERS)packet.status=403}],
])test('partial country recovery does not admit '+name,async t=>{
 const result=await replay(t,change);assert.ok(result.mutations.length>0)
 assert.equal(result.error?.code,'EPSON_NATIVE_INCOMPLETE')
 assert.equal(result.error.nativeEvidence.cleanupAllowed,false)
 assert.equal(result.error.nativeEvidence.verifiedZeroInventory,false)
})
