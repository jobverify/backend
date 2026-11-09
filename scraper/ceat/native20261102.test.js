import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import {buildDescriptionSourceUpdate} from '../../src/services/jobDescriptionPolicy.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261102.json.gz',import.meta.url))))
for(const packet of packets)assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const listing=JSON.parse(packets[0].body)
const details=packets.filter(row=>row.key.startsWith('full-detail-')).map(row=>JSON.parse(row.body))
const pages=packets.filter(row=>row.key.startsWith('public-')).map(row=>row.body)
const execute=async({alterDetail=value=>value,alterPage=value=>value,alterClosing=value=>value,alterCorporate=value=>value,alterBoard=value=>value,signal}={})=>{
  const calls=[];let listingsRead=0
  const jobs=await source.run({signal,fetchJson:async(url,init)=>{
    calls.push(url)
    if(url===source.NOAUTH_TOKEN_URL)return {access_token:'fixture-public-token'}
    if(url===source.FILTERED_JOBS_URL)return ++listingsRead===1?structuredClone(listing):alterClosing(JSON.parse(packets.find(row=>row.key==='closing-jobs').body))
    const index=details.findIndex(row=>url===`${source.API_BASE_URL}/api/publicjobs/${row.JobId}?fieldVisibility=CareerPage`)
    assert.ok(index>=0,'Only the native public getJobInfo route may hydrate the role')
    assert.equal(init.headers.Authorization,'Bearer fixture-public-token')
    return alterDetail(structuredClone(details[index]))
  },fetchText:async url=>{
    calls.push(url)
    if(url==='https://www.ceat.com/career-landing.html')return alterCorporate(packets.find(row=>row.key==='corporate').body)
    if(url===source.CAREER_PAGE_URL)return alterBoard(packets.find(row=>row.key==='board').body)
    const index=source.extractSearchResults(listing).findIndex(job=>job.sourceUrl===url)
    assert.ok(index>=0,'Only the advertised public role page may establish workplace country')
    return alterPage(pages[index])
  }})
  return {jobs,calls}
}

test('CEAT hydrates all five full native descriptions instead of truncated 500-character listing HTML',async()=>{
  assert.equal(listing.Result[4].JobDescV2.length,500)
  assert.match(listing.Result[4].JobDescV2,/<strong$/)
  assert.throws(()=>buildDescriptionSourceUpdate(source.extractSearchResults(listing)[4],null),/Unterminated native tag/)
  const {jobs,calls}=await execute()
  assert.equal(jobs.length,5)
  assert.equal(calls.length,15)
  assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete===true))
  assert.match(jobs[0].jobDescription,/Proficiency in SAP and MS Excel/)
  assert.match(jobs[2].jobDescription,/time to time changes in the regulatory framework/)
  assert.match(jobs[4].jobDescription,/Execution Skill/)
  for(const job of jobs){
    assert.ok(job.jobDescription.length>1000)
    assert.doesNotThrow(()=>buildDescriptionSourceUpdate(job,null))
  }
  assert.equal(readInventoryEvidence(jobs).status,'complete-inventory')
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,5)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,5)
  assert.ok(jobs.every(job=>job.sourceListingComplete===true))
})

for(const [label,change] of [
  ['wrong native ID',row=>({...row,JobId:'00000000-0000-0000-0000-000000000000'})],
  ['wrong title',row=>({...row,JobTitle:'Another vacancy'})],
  ['wrong employer',row=>({...row,OrgDetails:{...row.OrgDetails,OrgName:'Another company'}})],
  ['missing full description',row=>({...row,JobDescriptionV2:'',JobDescription:''})],
  ['closed role',row=>({...row,JobStatus:'Closed'})],
])test('CEAT rejects '+label+' instead of promoting the listing preview',async()=>{
  await assert.rejects(execute({alterDetail:change}),/CEAT native/)
})

test('CEAT rejects a public role page whose native workplace conflicts with the exact listed role',async()=>{
  await assert.rejects(execute({alterPage:html=>html.replaceAll('"addressLocality":"Nagpur Plant"','"addressLocality":"Another Plant"')}),/CEAT native/)
})

test('CEAT caller cancellation prevents anonymous token and detail requests',async()=>{
  const reason=Error('Stop CEAT native extraction')
  await assert.rejects(execute({signal:AbortSignal.abort(reason)}),error=>error===reason)
})

for(const [label,change] of [
  ['changed total',payload=>({...payload,Total:6})],
  ['changed role identity',payload=>({...payload,Result:payload.Result.map((row,index)=>index?row:{...row,JobId:'00000000-0000-0000-0000-000000000000'})})],
  ['duplicated role identity',payload=>({...payload,Result:[payload.Result[1],...payload.Result.slice(1)]})],
])test('CEAT closing inventory rejects '+label,async()=>{
  await assert.rejects(execute({alterClosing:change}),/CEAT native/)
})

test('CEAT requires the current first-party corporate handoff to this exact native board',async()=>{
  await assert.rejects(execute({alterCorporate:html=>html.replaceAll('https://ceat.turbohire.co/careerpage/4ae530fb-afba-4926-bdf9-9040b0e8774c','https://ceat.turbohire.co/careerpage/00000000-0000-0000-0000-000000000000')}),/CEAT native/)
})

test('CEAT requires the native board to advertise the exact employer',async()=>{
  await assert.rejects(execute({alterBoard:html=>html.replaceAll('CEAT Limited','Another employer')}),/CEAT native/)
})

test('CEAT cannot certify India inventory from an unknown native role country',async()=>{
  await assert.rejects(execute({alterPage:html=>html.replaceAll('"addressCountry":"India"','"addressCountry":"Unknown"')}),/CEAT native/)
})
