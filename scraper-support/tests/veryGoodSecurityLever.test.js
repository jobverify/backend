import {fixture,replay,editJSON,editHTML,mutateNativePost} from '../native-sources/publicLeverChannels/fixtureReplay.js'
import {syntheticPaginatedVgs} from '../native-sources/publicLeverChannels/testSupport.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { run, CAREERS_URL, LEVER_BOARD_URL } from '../../scraper/verygoodsecurityindia/script.js'
const foreign=JSON.parse(readFileSync(new URL('./fixtures/verygoodsecurityindia/current-lever.json',import.meta.url),'utf8'))
const careers='<title>Careers | VGS</title><h1>It Takes Exceptional People to Build VGS</h1><h2>What We Look For In Every Teammate</h2><h2>Discover Opportunities</h2><a href="#lever-jobs-container">Open Roles</a><div id="lever-jobs-container"></div>'
const board=records=>'<title>VGS</title><meta property="og:url" content="https://jobs.lever.co/verygoodsecurity">Location type Location Team Work type Powered by Lever'+records.map(row=>'<a href="'+row.hostedUrl+'">'+row.text+'</a>').join('')
const runWith=(fetchJson,records=foreign)=>run({fetchText:async url=>url===CAREERS_URL?careers:url===LEVER_BOARD_URL?board(records):assert.fail('Unexpected source URL'),fetchJson})
const indiaRole=()=>({...foreign[0],id:'india-role',text:'Software Engineer',country:'IN',categories:{...foreign[0].categories,location:'Bengaluru, India',allLocations:['Bengaluru, India']},hostedUrl:'https://jobs.lever.co/verygoodsecurity/india-role',applyUrl:'https://jobs.lever.co/verygoodsecurity/india-role/apply'})
test("VGS validates all current foreign native observations without employer-wide zero authority",async()=>{
   const r=replay(),jobs=await run(r.options);assert.equal(jobs.length,0)
   assert.equal(r.audits[0].observations.length,18);assert.equal(r.audits[0].closing.nativeListingComplete,true)
   assert.equal(r.audits[0].sourceScopeComplete,false);assert.equal(r.audits[0].authoritativeIndiaFacetCount,null)
  
})
test("VGS preserves a supported explicit India role with its full own criteria and original application URI",async()=>{
   const original=fixture.oracle.verygoodsecurityindia.records[0],id=original.id
   const r=replay(mutateNativePost('verygoodsecurityindia',id,row=>{row.country='IN';row.categories.location='Bengaluru, India';row.categories.allLocations=['Bengaluru, India']},schema=>{schema.jobLocation=[{'@type':'Place',address:{'@type':'PostalAddress',addressLocality:'Bengaluru',addressCountry:'IN'}}]}))
   const jobs=await run(r.options),job=jobs.find(row=>row.jobId===id);assert.ok(job)
   assert.equal(job.country,'India');assert.equal(job.city,'Bengaluru');assert.equal(job.location,'Bengaluru, India')
   assert.equal(job.applyUrl,original.originalNative.applyUrl)
   for(const fact of original.criteriaFacts)assert.ok(job.jobDescription.includes(fact))
  
})
test("VGS keeps explicit secondary India worksite evidence without assigning India to foreign worksites",async()=>{
   const id=fixture.oracle.verygoodsecurityindia.records[0].id
   const r=replay(mutateNativePost('verygoodsecurityindia',id,row=>{row.country='US';row.categories.location='United States';row.categories.allLocations=['United States','Bengaluru, India']},schema=>{schema.jobLocation=[{address:{addressLocality:'United States',addressCountry:'US'}},{address:{addressLocality:'Bengaluru',addressCountry:'IN'}}]}))
   const jobs=await run(r.options),job=jobs.find(row=>row.jobId===id);assert.ok(job)
   assert.equal(job.country,'India');assert.equal(job.city,'Bengaluru');assert.deepEqual(job.locations,['Bengaluru, India'])
   assert.ok(job.sourceNativeCountries.includes('United States'))
  
})
test("VGS holds malformed and conflicting identities while retaining unknown places as unresolved observations",async()=>{
   const original=fixture.oracle.verygoodsecurityindia.records[0],id=original.id
   const duplicate=replay((url,page)=>url.includes('/verygoodsecurity?mode=json&skip=')?editJSON(page,rows=>rows.push(structuredClone(rows[0]))):page)
   await run(duplicate.options);const duplicated=duplicate.audits[0].observations.find(row=>row.jobId===id)
   assert.equal(duplicated.sourceCurrentNativePostingIdentityQualified,false);assert.equal(duplicated.sourceNativeListingConflicts.length,2)
   const wrong='https://jobs.lever.co/unrelated/'+id
   const tenant=replay(mutateNativePost('verygoodsecurityindia',id,row=>{row.hostedUrl=wrong}))
   await run(tenant.options);assert.equal(tenant.audits[0].observations.find(row=>row.jobId===id).sourceCurrentNativePostingIdentityQualified,false)
   assert.ok(!tenant.requests.includes(wrong))
   const unknown=replay(mutateNativePost('verygoodsecurityindia',id,row=>{row.country=null;row.categories.location='Remote';row.categories.allLocations=['Remote']},schema=>{schema.jobLocation=[{address:{addressLocality:'Remote'}}]}))
   await run(unknown.options);const observed=unknown.audits[0].observations.find(row=>row.jobId===id)
   assert.equal(observed.country,null);assert.equal(observed.sourceCountryScopeUnresolved,true)
  
})
test("VGS detects native index truncation without losing independently paired board/group postings",async()=>{
   const r=replay((url,page)=>url.includes('/verygoodsecurity?mode=json&skip=')?editJSON(page,rows=>rows.shift()):page)
   await run(r.options);const a=r.audits[0]
   assert.equal(a.closing.nativeListingComplete,false);assert.equal(a.observations.length,18)
   assert.ok(a.observations.every(row=>row.sourceNativeDetailQualified&&row.sourceCurrentNativePostingIdentityQualified))
   assert.equal(a.authoritativeSourceTotal,null)
  
})
test("VGS paginates valid UUID records before country reconciliation and holds duplicate repeated pages",async()=>{
   const complete=syntheticPaginatedVgs();await run(complete.options)
   assert.equal(complete.audits[0].observations.length,101);assert.equal(complete.audits[0].closing.nativeListingComplete,true)
   assert.equal(complete.requests.filter(url=>url===complete.next).length,2)
   const repeated=syntheticPaginatedVgs(true);await run(repeated.options)
   assert.equal(repeated.audits[0].closing.nativeListingComplete,false)
   assert.ok(repeated.audits[0].observations.some(row=>row.sourceNativeListingConflicts.length===2&&!row.sourceCurrentNativePostingIdentityQualified))
  
})
test('VGS cancellation stops before either public transport is invoked',async()=>{
 const reason=new Error('cancel VGS');await assert.rejects(run({signal:AbortSignal.abort(reason),fetchText:()=>assert.fail('aborted'),fetchJson:()=>assert.fail('aborted')}),error=>error===reason)
})

test("VGS holds an unrelated application URI without substituting the native hosted role URI",async()=>{
   const id=fixture.oracle.verygoodsecurityindia.records[0].id,wrong='https://jobs.lever.co/unrelated/'+id+'/apply'
   const r=replay(mutateNativePost('verygoodsecurityindia',id,row=>{row.applyUrl=wrong}))
   await run(r.options);const job=r.audits[0].observations.find(row=>row.jobId===id)
   assert.equal(job.sourceCurrentNativePostingIdentityQualified,false);assert.ok(!r.requests.includes(wrong))
  
})
