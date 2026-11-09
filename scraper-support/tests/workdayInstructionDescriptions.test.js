import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'

const sources=[
 ['commonwealthbankofaustralia','native-20261021.json.gz',72],
 ['cmegroup','native-20261021.json.gz',16],
 ['ciena','native-20261021.json.gz',8],
 ['carelonglobalsolutions','runtime-native-20261021.json.gz',15],
 ['chrobinson','native-20261021.json.gz',4],
]
const instructions=[
 'Please click the Apply now button to access the complete details about this position, the requirements, the application instructions and the recruitment process. Please submit your application to view further information.',
 'Select the Apply button to view the complete responsibilities and required qualifications for this opportunity. Complete your application to access further information about the position and the recruitment process.',
 'The full job description is available after you submit your application. Please complete the application process to access all responsibilities, qualifications and details about this role.',
]

async function replay(t,source,fixtureName,description){
 const fixtureURL=new URL(`../../scraper/${source}.workday/fixtures/${fixtureName}`,import.meta.url)
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(fixtureURL)))
 const {run}=await import(`../../scraper/${source}.workday/script.js`)
 const checkedAt=fixture.capturedTrial?.completedAt??fixture.checkedAt??'2026-10-21T13:05:07.749Z'
 t.mock.method(globalThis,'fetch',async(url,init={})=>{
  // Earlier fixtures hold one copy of each actual detail response. Workday's
  // initial and final detail checks intentionally replay those same responses.
  const original=fixture.packets.find(p=>p.url===String(url)&&p.method===(init.method??'GET')&&(p.requestBody??null)===(init.body??null))
  assert.ok(original,'Uncaptured native request '+url)
  const packet=structuredClone(original)
  if(description&&packet.url.includes('/job/')){
   const body=JSON.parse(packet.body)
   body.jobPostingInfo.jobDescription=description(body.jobPostingInfo.jobDescription)
   packet.body=JSON.stringify(body)
  }
  const response=new Response(packet.body,{status:packet.status})
  Object.defineProperty(response,'url',{value:packet.finalURL})
  return response
 })
 return run({now:checkedAt,requestScheduler:{acquire:async()=>()=>{},recordRateLimit(){},minIntervalMs:0},retryBaseDelayMs:0})
}

for(const[source,fixtureName,count]of sources){
 test(source+' preserves the actual native descriptions and partial inventory',async t=>{
  const jobs=await replay(t,source,fixtureName)
  assert.equal(jobs.length,count)
  assert.ok(jobs.every(j=>j.sourceDetailComplete===true&&j.sourceListingComplete===false))
 })
 for(const[index,instruction]of instructions.entries())test(source+' rejects application instructions without role details '+(index+1),async t=>{
  await assert.rejects(()=>replay(t,source,fixtureName,()=>'<p>'+instruction+'</p>'),/description|instruction/i)
 })
 test(source+' preserves a full native JD followed by application instructions',async t=>{
  const jobs=await replay(t,source,fixtureName,jd=>jd+'<p>'+instructions.join(' ')+'</p>')
  assert.equal(jobs.length,count)
  assert.ok(jobs.every(j=>j.sourceDetailComplete===true))
 })
}
