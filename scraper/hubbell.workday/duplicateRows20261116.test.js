import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,NATIVE_CONFIG} from './script.js'
import {parseRmkListing} from '../../scraper-support/shared/successFactorsRmk.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const files=JSON.parse(readFileSync(new URL('../../scraper-support/tests/fixtures/rmkNativePair/native-capture.json',import.meta.url))).sources.hubbell
const read=name=>gunzipSync(Buffer.from(files[name].gzipBase64,'base64')).toString()
const first=read('003-search-hop0.body')
const htmlRows=html=>[...html.matchAll(/<tr\b[^>]*class="[^"]*\bdata-row\b[^"]*"[^>]*>[\s\S]*?<\/tr>/gi)].map(m=>m[0])
const firstRows=parseRmkListing(first,NATIVE_CONFIG).jobs
const selected=firstRows.findIndex(row=>row.countryCode!=='IN'&&row.expectedLocationCount===row.locations.length)
assert.ok(selected>=0,'Fixture must include a fully typed foreign row')
const duplicate=htmlRows(first)[selected]
function replay(mode='identical'){
 const map=new Map(),calls=[];let initial=true
 for(const name of Object.keys(files).filter(n=>n.endsWith('.json'))){const packet=JSON.parse(read(name));if(packet.requestedURL&&packet.status===200){const file=packet.bodyFile??packet.hops?.at(-1)?.bodyFile;if(file)map.set(packet.requestedURL,read(file))}}
 const fetchText=async url=>{
  calls.push(url)
  if(url===NATIVE_CONFIG.origin+'/search/'){const body=read(initial?'003-search-hop0.body':'listing-closure-001.body');initial=false;return body}
  assert.ok(map.has(url),'Uncaptured URL '+url)
  const body=map.get(url)
  if(new URL(url).searchParams.get('startrow')==='30'){
   const row=htmlRows(body)[0]
   if(mode==='identical')return body.replace(row,duplicate)
   if(mode==='conflicting')return body.replace(row,duplicate.replaceAll(firstRows[selected].title,firstRows[selected].title+' changed'))
   if(mode==='total')return body.replace(/of <b>\d+<\/b>/g,'of <b>9999</b>')
  }
  return body
 }
 return{fetchText,calls,now:JSON.parse(read('003-search.json')).startedAt}
}
test('Hubbell retains one copy of identical native records repeated across pages and keeps coverage incomplete',async()=>{
 const fixture=replay(),jobs=await run(fixture),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,19)
 assert.equal(new Set(jobs.map(j=>j.nativePublicJobId)).size,jobs.length)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(isVerifiedEmptyEvidence(evidence),false)
 assert.match(evidence.reason,/repeated-identical-native-rows:1/)
 assert.ok(jobs.every(j=>j.sourceListingComplete===false&&j.sourceScopeComplete===false))
})
test('Hubbell rejects conflicting titles under a repeated native ID',async()=>{
 await assert.rejects(run(replay('conflicting')),/conflicting|Duplicate native public ID/i)
})
test('Hubbell rejects changed native totals even when observed rows repeat',async()=>{
 await assert.rejects(run(replay('total')),/total|range/i)
})
