import assert from'node:assert/strict'
import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import test from'node:test'
import{verifyCapitalOneHandoff,activeLinks}from'../scraper/capitalone.workday/nativeBinding.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/capitalOne/native-handoff-001.json.gz',import.meta.url))))
const run=async(mutate=()=>{})=>{const f=fixture();mutate(f);const used=[];const proof=await verifyCapitalOneHandoff({fetchText:async url=>{const p=f.packets.find(p=>p.url===url);assert.ok(p,'Uncaptured URL '+url);used.push(url);return p.body}});return{proof,used}}
test('current official corporate, careers, India and role pages bind the exact public Capital_One application',async()=>{
  const{proof,used}=await run();assert.equal(used.length,4)
  assert.equal(proof.nativeRequisitionId,'R1004124')
  assert.equal(proof.applyUrl,'https://capitalone.wd12.myworkdayjobs.com/Capital_One/job/Bangalore-In/Principal-Associate--Software-Engineering_R1004124-1/apply')
  assert.equal(proof.nativeEmployer,null);assert.equal(proof.companyCoverageComplete,false)
})
test('hidden, inert and unrelated links cannot establish the current official handoff',async()=>{
  for(const body of ['<template><a href="https://www.capitalonecareers.com/">Careers</a></template>',
    '<div hidden><a href="https://www.capitalonecareers.com/">Careers</a></div>',
    '<div aria-hidden="true"><a href="https://www.capitalonecareers.com/">Careers</a></div>',
    '<script><a href="https://www.capitalonecareers.com/">Careers</a></script>',
    '<a href="https://unrelated.example/careers">Careers</a>'])await assert.rejects(run(f=>{f.packets[0].body=body}))
  await assert.rejects(run(f=>{f.packets[3].body='<a href="https://other.wd12.myworkdayjobs.com/Capital_One/job/x_R1004124/apply">Apply</a>'}))
})
test('closing tags inside inert templates cannot escape hidden ancestors',()=>{
  const href='https://capitalone.wd12.myworkdayjobs.com/Capital_One/job/x_R1004124/apply'
  assert.deepEqual(activeLinks('<div hidden><template></div><a href="'+href+'">Apply</a></template></div>','https://www.capitalonecareers.com/'),[])
  assert.deepEqual(activeLinks('<div style="display:none"><template></div><a href="'+href+'">Apply</a></template></div>','https://www.capitalonecareers.com/'),[])
})
test('a failed official page cannot qualify from prior successful evidence',async()=>{
  await assert.rejects(verifyCapitalOneHandoff({fetchText:async()=>{throw Error('current HTTP503')}}),/503/)
})
