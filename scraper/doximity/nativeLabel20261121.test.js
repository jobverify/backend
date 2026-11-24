import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import http from 'node:http'
import https from 'node:https'
import test, { after } from 'node:test'

// These are unchanged retained November19 responses, never a new acquisition.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-label-originals-20261119.json.gz',import.meta.url))))
const originals=fixture.responses.map(row=>{
 const bytes=Buffer.from(row.bodyBase64,'base64')
 assert.equal(bytes.length,row.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)
 assert.equal(row.status,200);assert.equal(row.method,'GET')
 return {...row,bytes}
})
assert.equal(originals.length,58)
const actual=fixture.originalRow.sourceNativePrimaryLocation.name
assert.equal(actual,'Remote, U.S. (New York or New Jersey Strongly Preferred)')
let networkCalls=0
const saved={fetch:globalThis.fetch,hr:http.request,hg:http.get,sr:https.request,sg:https.get}
const blocked=()=>{networkCalls++;throw Error('Doximity retained-regression network fence')}
globalThis.fetch=blocked;http.request=http.get=https.request=https.get=blocked
after(()=>{globalThis.fetch=saved.fetch;http.request=saved.hr;http.get=saved.hg;https.request=saved.sr;https.get=saved.sg;assert.equal(networkCalls,0)})
const moduleURL=new URL('./nativeLabel20261121.js',import.meta.url)
const labelModule=fs.existsSync(moduleURL)?await import(moduleURL.href):null
const read=label=>{
 assert.equal(typeof labelModule?.parseDoximityPrimaryLabel,'function','Doximity native primary-label parser is not implemented')
 return labelModule.parseDoximityPrimaryLabel(label)
}
const qualify=row=>{
 assert.equal(typeof labelModule?.qualifyDoximityPrimaryLabel,'function','Doximity native primary-label qualification is not implemented')
 return labelModule.qualifyDoximityPrimaryLabel(row)
}

test('actual authored U.S. worksite keeps the complete parenthesized OR preference',()=>{
 const value=read(actual)
 assert.equal(value.originalLabel,actual);assert.equal(value.balanced,true)
 assert.equal(value.country,'United States');assert.equal(value.resolved,true)
 assert.equal(value.alternatives.length,1)
 assert.equal(value.alternatives[0].originalLabel,actual)
 assert.deepEqual(value.alternatives[0].preferences,['New York or New Jersey Strongly Preferred'])
})

test('true outside-parenthesis OR alternatives are preserved independently',()=>{
 const label='Remote, U.S. (New York preferred) or Remote, U.S. (New Jersey preferred)'
 const value=read(label)
 assert.equal(value.originalLabel,label);assert.equal(value.resolved,true);assert.equal(value.country,'United States')
 assert.equal(value.alternatives.length,2)
 assert.deepEqual(value.alternatives.map(v=>v.preferences),[['New York preferred'],['New Jersey preferred']])
})

test('a genuine coequal India alternative cannot be suppressed by a U.S. prefix',()=>{
 const value=read('Remote, U.S. or Remote, India')
 assert.deepEqual(value.countries,['United States','India'])
 assert.equal(value.country,null);assert.equal(value.resolved,false);assert.equal(value.alternatives.length,2)
})

test('an unknown coequal worksite preserves uncertainty',()=>{
 const value=read('Remote, U.S. or Undisclosed')
 assert.equal(value.country,null);assert.equal(value.resolved,false)
 assert.equal(value.alternatives.length,2);assert.equal(value.alternatives[1].country,null)
})

test('city-only labels do not supply country evidence',()=>{
 const value=read('New York or New Jersey')
 assert.equal(value.country,null);assert.equal(value.resolved,false)
 assert.deepEqual(value.countries,[])
})

test('unbalanced parenthesis variants retain the whole label without country certainty',()=>{
 for(const label of [actual.slice(0,-1),actual+')']){
  const value=read(label)
  assert.equal(value.originalLabel,label);assert.equal(value.balanced,false)
  assert.equal(value.country,null);assert.equal(value.resolved,false)
 }
})

test('an actual foreign country inside preference text remains an explicit conflict',()=>{
 for(const label of ['Remote, U.S. (India strongly preferred)','Remote, U.S. (New York or India strongly preferred)']){
  const value=read(label)
  assert.equal(value.originalLabel,label);assert.equal(value.country,null);assert.equal(value.resolved,false)
  assert(value.preferenceCountries.includes('India'))
  assert(value.conflicts.length>0)
 }
})

test('unknown or worldwide preference scope cannot quietly become U.S. certainty',()=>{
 for(const label of ['Remote, U.S. (Unknown location preferred)','Remote, U.S. (Worldwide preferred)']){
  const value=read(label)
  assert.equal(value.originalLabel,label);assert.equal(value.country,null);assert.equal(value.resolved,false)
 }
})

test('primary parsing cannot clear a separate unknown assigned-worksite alternative',()=>{
 const row=structuredClone(fixture.originalRow)
 row.sourceNativeCountryEvidence.assignedOffices[1].country=null
 const exact=JSON.stringify(row),value=qualify(row)
 assert.equal(value.qualified,false)
 assert.equal(JSON.stringify(row),exact,'Pure qualification must preserve the original row')
 assert.equal(row.sourceCountryScopeUnresolved,true)
})

test('primary parsing cannot clear an explicit native-country conflict',()=>{
 const row=structuredClone(fixture.originalRow)
 row.sourceNativeCountryConflict=true
 row.sourceNativeCountryEvidence.conflicts.push({reason:'controlled-native-country-conflict',country:'India'})
 const value=qualify(row)
 assert.equal(value.qualified,false)
 assert.equal(row.sourceCountryScopeUnresolved,true)
})

test('the unchanged genuine58 default-factory replay excludes the explicit U.S. role while inventory remains held',async()=>{
 const {createDoximityNativeScraper}=await import('./native20261108.js')
 const byURL=new Map(),calls=[]
 for(const row of originals){if(!byURL.has(row.requestedUrl))byURL.set(row.requestedUrl,[]);byURL.get(row.requestedUrl).push(row)}
 const jobs=await createDoximityNativeScraper().run({rateLimitMs:0,maxRequests:58,
  sourceTimeoutMs:120000,now:()=>new Date('2026-11-19T02:59:26.974Z'),
  fetchPage:async(url,init)=>{
   assert.equal((init?.method??'GET').toUpperCase(),'GET')
   const row=byURL.get(String(url))?.shift()
   assert(row,'No additional, synthetic or live response may satisfy '+url)
   calls.push(row.index)
   return {url:row.url,status:row.status,headers:row.headers,bodyBase64:row.bodyBase64}
  },
 })
 assert.equal(calls.length,58);assert.equal(new Set(calls).size,58)
 assert([...byURL.values()].every(rows=>rows.length===0))
 const audit=jobs.nativeCollectionEvidence,row=audit.observations.find(v=>v.jobId==='8337921')
 assert(row);assert.equal(audit.observations.length,11)
 assert.equal(row.sourceCountryScopeUnresolved,false,'Actual authored U.S. worksite is still split into unresolved preference pieces')
 assert.equal(row.country,'United States');assert.equal(row.city,null)
 assert.equal(row.sourceNativePrimaryLocation.name,actual)
 assert.equal(row.sourceNativePrimaryLabelEvidence.analysis.originalLabel,actual)
 assert.equal(row.requisitionId,'661-SPH');assert.equal(row.postingDate,'2026-11-04T20:01:07-05:00')
 assert.equal(row.sourceNativeRecord.location.name,actual)
 assert.equal(row.sourceNativePublishedModel.job_post_location,actual)
 assert.match(row.sourceNativeOwnDescription,/Location: Remote U\.S\./)
 assert.equal(jobs.length,0)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(row.activeApplyVerified,false);assert.equal(row.applicationVisited,false)
})
