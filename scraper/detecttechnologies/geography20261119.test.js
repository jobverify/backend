import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {extractCurrentListings,extractCurrentDetail,CURRENT_URL} from './currentNative.js'
import {run} from './script.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
const listingHTML=Buffer.from(fixture.responses.find(r=>r.requestedUrl===CURRENT_URL).bodyBase64,'base64').toString()
const listings=()=>extractCurrentListings(listingHTML)
const detail=row=>Buffer.from(fixture.responses.find(r=>r.requestedUrl===row.sourceUrl).bodyBase64,'base64').toString()
const replay=change=>{let index=0;return{reads:()=>index,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
 const row=fixture.responses[index++];assert.ok(row);assert.equal(url,row.requestedUrl)
 assert.equal(init.redirect,'manual');assert.equal(init.method??'GET',row.method)
 const html=Buffer.from(row.bodyBase64,'base64').toString(),body=change?change(row,html,index):html
 return Object.defineProperty(new Response(body,{status:row.status,headers:row.headers}),'url',{value:row.url})
}}}}

test('six full own roles at exact Chennai or Mumbai - Chembur qualify with the original countryless schema retained and cleanup held',async()=>{
 const io=replay(),jobs=await run(io.options),india=jobs.filter(j=>j.country==='India')
 assert.equal(india.length,6)
 assert.equal(jobs.filter(j=>j.sourceCountryScopeUnresolved).length,2)
 assert.ok(india.every(j=>j.sourceDetailComplete&&j.sourceCountryEvidence.kind==='reviewed-whole-native-workplace-geography'))
 assert.ok(india.every(j=>j.sourceNativeJobPosting.jobLocation.address.addressCountry===undefined&&j.jobDescription.length>300))
 assert.ok(india.every(j=>j.postingDate===j.sourceNativeJobPosting.datePosted&&j.closingDate===null&&j.nativeLegalEmployer===null))
 const assessed=assessSoftFailureAcquisition({source:'detecttechnologies',companyName:'Detect Technologies'},jobs)
 assert.equal(assessed.indiaJobs,6);assert.equal(assessed.runnerOutcome.success,true);assert.equal(assessed.cleanupOptions.replaceExisting,false)
 assert.equal(io.reads(),21)
})

test('unreviewed mixed or foreign whole workplace labels never inherit a city match',()=>{
 for(const label of ['Chennai / Singapore','Chennai, USA','Greater Chennai (Worldwide Remote)','Mumbai - Chembur / London']){
  const rows=extractCurrentListings(listingHTML.replaceAll('Chennai',label).replaceAll('Mumbai - Chembur',label))
  assert.ok(rows.every(row=>row.country!=='India'))
 }
})

test('an explicit foreign structured country contradicting an exact India worksite is rejected',()=>{
 const row=listings().find(r=>r.location==='Chennai'),html=detail(row)
 const changed=html.replace(/"addressLocality"\s*:\s*"Chennai"/,'"addressLocality":"Chennai","addressCountry":"US"')
 assert.notEqual(changed,html)
 assert.throws(()=>extractCurrentDetail(changed,row),/country conflict/)
})

test('full own criteria reject explicit foreign country, workplace, employer and closure declarations',()=>{
 const row=listings().find(r=>r.location==='Chennai'),html=detail(row)
 for(const line of ['Country: United States','Location: Houston, Texas','Employer: Another Company','Applications are closed.','Candidates must reside in United States.']){
  const changed=html.replace('Job Type : Full-Time','Job Type : Full-Time</p><p>'+line)
  assert.notEqual(changed,html)
  assert.throws(()=>extractCurrentDetail(changed,row),/country|workplace|employer|closed/i,line)
 }
})

test('changed closing own criteria do not publish otherwise qualifying India records',async()=>{
 const io=replay((row,html,index)=>index>11&&row.requestedUrl.includes('/careers/')?html.replace('Job Type : Full-Time','Job Type : Full-Time updated'):html)
 await assert.rejects(run(io.options),/Closing native role criteria/)
})

test('exact caller cancellation still wins before native geography acquisition',async()=>{
 const controller=new AbortController(),reason=Object.freeze({owner:'detect-geography'});controller.abort(reason)
 await assert.rejects(run({signal:controller.signal,fetchImpl:async()=>assert.fail('No fetch after 