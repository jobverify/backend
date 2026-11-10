import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {preload,validateInventory} from './nativeContract.js'
import {run} from './script.js'

// Original publisher responses are an offline regression, not a claim about
// current vacancies. All eight channels remain part of the real source run.
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-current-20261110.json.gz',import.meta.url))))
const NOW=packets[0].startedAt
const INDIA='73f15a77-9b84-46de-bd9e-bf76f70b6d84'
const DESIGNER='32e46154-b911-475c-af05-a2b283beec5e'
const UNKNOWN='69c3e74e-c264-4e8a-a34b-3122d028f9c2'
const payload=()=>JSON.parse(packets[3].body)
const board=()=>preload(packets[2].body)
const row=p=>p.jobs.find(r=>r.id===DESIGNER)
const brief=b=>b.jobBoard.jobPostings.find(r=>r.id===DESIGNER)

async function replay(mutate=()=>{}){
 const originals=structuredClone(packets);mutate(originals);let calls=0
 const jobs=await run({now:NOW,fetch:async(url,init)=>{
  const p=originals[calls++]
  assert.ok(p,'only the eight captured publisher channels are admitted')
  assert.equal(url,p.url)
  assert.equal(init.method,'GET')
  assert.equal(init.redirect,'error')
  assert.ok(init.signal instanceof AbortSignal)
  return{status:p.status,url:p.finalURL,text:async()=>p.body}
 }})
 assert.equal(calls,8,'secondary country qualification must not skip role, application, or closing reads')
 return jobs
}

test('Credo AI qualifies the captured typed-US secondary scope while keeping the independent India selection',()=>{
 const p=payload(),b=board()
 assert.equal(createHash('sha256').update(packets[3].body).digest('hex'),'6b355f441efef64dd2d79e2f9709ba2c8c518cf2e0097024d6da245e3f851e85')
 assert.deepEqual(validateInventory(p,b,NOW).map(r=>r.id),[INDIA])
 assert.equal(row(p).secondaryLocations[0].address.postalAddress.addressCountry,'United States')
 assert.equal(brief(b).secondaryLocations[0].locationName,'USA Remote')
})

test('Credo AI returns the full captured India role and retains all foreign and unknown native observations',async()=>{
 const jobs=await replay()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].jobId,INDIA)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDetailComplete,true)
 assert.ok(jobs[0].sourceDescription.length>1000)
 assert.match(jobs[0].sourceDescription,/Minimum Qualifications/)
 assert.equal(jobs[0].postingDate,'2026-09-26T02:01:08.473+00:00')
 assert.equal(jobs[0].nativeLegalEmployer,null)
 assert.equal(jobs[0].nativeBrand,'Credo.AI')
 assert.equal(jobs[0].nativeObservedBoardCount,8)
 assert.deepEqual(jobs[0].nativeUnknownLocationIds,[UNKNOWN])
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(jobs[0].sourceScopeComplete,false)
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,null)
 assert.equal(evidence.indiaFacetCount,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeRecords,payload().jobs)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativePayload,payload())
 assert.equal(Object.getOwnPropertyDescriptor(jobs,'nativeCollectionEvidence').enumerable,false)
})

for(const[name,mutate]of[
 ['missing own secondary country',(p)=>{row(p).secondaryLocations[0].address=null}],
 ['different own secondary country',(p)=>{row(p).secondaryLocations[0].address.postalAddress.addressCountry='Canada'}],
 ['generic remote secondary label',(p,b)=>{row(p).secondaryLocations[0].location='Global Remote';brief(b).secondaryLocations[0].locationName='Global Remote'}],
 ['cross-country secondary India',(p,b)=>{row(p).secondaryLocations[0]={location:'India Remote',address:{postalAddress:{addressCountry:'India'}}};brief(b).secondaryLocations[0].locationName='India Remote'}],
 ['mismatched board secondary label',(p,b)=>{brief(b).secondaryLocations[0].locationName='Another US office'}],
 ['missing board secondary identity',(p,b)=>{delete brief(b).secondaryLocations[0].locationId}],
 ['malformed board secondary identity',(p,b)=>{brief(b).secondaryLocations[0].locationId='-'.repeat(36)}],
 ['unreviewed secondary country field',(p)=>{row(p).secondaryLocations[0].countryCode='IN'}],
 ['unreviewed board secondary country field',(p,b)=>{brief(b).secondaryLocations[0].countryCode='IN'}],
 ['repeated secondary identity',(p,b)=>{row(p).secondaryLocations.push(structuredClone(row(p).secondaryLocations[0]));brief(b).secondaryLocations.push(structuredClone(brief(b).secondaryLocations[0]))}],
])test('Credo AI still rejects '+name,()=>{
 const p=payload(),b=board();mutate(p,b)
 assert.throws(()=>validateInventory(p,b,NOW),/secondary scope|secondary country/)
})

test('Credo AI does not extend the foreign-only secondary qualification to an India role',()=>{
 const p=payload(),b=board(),r=p.jobs.find(r=>r.id===INDIA),v=b.jobBoard.jobPostings.find(r=>r.id===INDIA)
 r.secondaryLocations=structuredClone(row(p).secondaryLocations)
 v.secondaryLocations=structuredClone(brief(b).secondaryLocations)
 assert.throws(()=>validateInventory(p,b,NOW),/secondary scope|secondary country/)
})

test('Credo AI still compares the full held native role at closing',async()=>{
 await assert.rejects(replay(p=>{const v=JSON.parse(p[6].body);row(v).descriptionHtml+='<p>Additional mandatory certificate.</p>';p[6].body=JSON.stringify(v)}),/Native inventory changed during extraction/)
})

test('Credo AI still requires the India application page to agree on full original criteria',async()=>{
 await assert.rejects(replay(p=>{p[5].body=p[5].body.replaceAll('Minimum Qualifications','Changed Minimum Qualifications')}),/Native full content drift/)
})

test('Credo AI still rejects a foreign native employer account',async()=>{
 await assert.rejects(replay(p=>{p[2].body=p[2].body.replace('"organizationId":"79a3b1bb-4ea1-4fa0-8f3c-bffc3aac9be9"','"organizationId":"00000000-0000-4000-8000-000000000000"')}),/Wrong native organization/)
})
