import assert from 'node:assert/strict'
import test from 'node:test'
import { createByteridgeScraper } from './script.js'
import { nativeOptions } from './fixtures/options.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../../scraper-support/utils/normalizeScrapedJob.js'

const ID='34756b57-fd21-4591-b34c-6e2c91cb7f02'
const API='https://thapi-stage0.azurewebsites.net/api/publicjobs/'+ID
const PROXY='https://byteridge.com/wp-json/turbohire/v1/careerpagejobs'
const run=options=>createByteridgeScraper().run(options)
const mutateJSON=(packet,fn)=>{const value=JSON.parse(packet.body);fn(value);packet.body=JSON.stringify(value)}
const mutatePosting=(packet,fn)=>{packet.body=packet.body.replace(/(<script[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const value=JSON.parse(raw);fn(value);return start+JSON.stringify(value)+end})}
const target=jobs=>jobs.find(job=>job.jobId===ID)
test.beforeEach(t=>{t.mock.method(globalThis,'fetch',async()=>{throw Error('Network prohibited in Byteridge criteria tests')})})

for(const field of ['qualifications','educationRequirements','experienceRequirements','responsibilities','eligibilityToWorkRequirement','physicalRequirement','sensoryRequirement','securityClearanceRequirement','competencyRequired','jobBenefits']) {
  test('native '+field+' text is preserved in full published criteria',async()=>{
    const value='ADDED_NATIVE_'+field.toUpperCase()
    const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j[field]=value})}))
    const job=target(jobs)
    assert.ok(job)
    assert.ok(job.sourceDescription.includes(value))
    assert.ok(job.jobDescription.includes(value))
    assert.equal(job.nativeStructuredCriteria[field],value)
    assert.equal(job.sourceDetailComplete,true)
  })
}

test('native criteria arrays retain every supplied text item and their source shape',async()=>{
  const values=['Bachelor degree & practical experience','ADDED_NATIVE_SECOND_QUALIFICATION']
  const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j.qualifications=values})}))
  const job=target(jobs)
  assert.ok(job)
  assert.deepEqual(job.nativeStructuredCriteria.qualifications,values)
  assert.match(job.sourceDescription,/Bachelor degree &amp; practical experience/)
  assert.match(job.sourceDescription,/ADDED_NATIVE_SECOND_QUALIFICATION/)
})

for(const value of [{ '@type':'EducationalOccupationalCredential',credentialCategory:'bachelor degree' },42,[null,'ADDED_NATIVE_ITEM']]) {
  test('unsupported structured criteria shape remains partial instead of silently disappearing: '+JSON.stringify(value),async()=>{
    const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j.educationRequirements=value})}))
    assert.equal(target(jobs),undefined)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
}

for(const employmentType of ['PART_TIME',['PART_TIME'],42,'UNKNOWN_NATIVE_EMPLOYMENT']) {
  test('supplied schema employment cannot silently conflict with Full Time: '+JSON.stringify(employmentType),async()=>{
    const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j.employmentType=employmentType})}))
    assert.equal(target(jobs),undefined)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
}

for(const employmentType of ['FULL_TIME',['FULL_TIME'],'Full-Time']) {
  test('coherent supplied schema employment respects primary JobTypeV2 over UNSPECIFIED: '+JSON.stringify(employmentType),async()=>{
    const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j.employmentType=employmentType})}))
    assert.equal(target(jobs).employmentType,'Full Time')
    assert.equal(target(jobs).sourceDetailComplete,true)
    assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  })
}

const appendEligibility=(packet,url,html,{proxyCoherent=true}={})=>{
  if(url===API)mutateJSON(packet,j=>{j.EligibilityV2=html;j.Eligibility=html})
  if(proxyCoherent&&url===PROXY)mutateJSON(packet,j=>{const row=j.Result.find(r=>r.JobId===ID);row.EligibilityV2=html;row.Eligibility=html})
  if(url.includes('/job/publicjobs/'+ID))mutatePosting(packet,j=>{j.description+=html})
}
for(const [label,hidden]of[
  ['hidden attribute','<div hidden>HIDDEN_CRITERION</div>'],
  ['inert ancestor','<div inert><span>HIDDEN_CRITERION</span></div>'],
  ['display none','<div style="display:none">HIDDEN_CRITERION</div>'],
  ['opacity zero','<div style="opacity:0">HIDDEN_CRITERION</div>'],
  ['visibility hidden','<div style="visibility:hidden">HIDDEN_CRITERION</div>'],
  ['template','<template>HIDDEN_CRITERION</template>'],
  ['noscript fallback','<noscript>HIDDEN_CRITERION</noscript>'],
  ['textarea raw body','<textarea>HIDDEN_CRITERION</textarea>'],
]) {
  for(const proxyCoherent of [true,false])test('mixed '+label+' eligibility cannot leak through published HTML; proxy coherent='+proxyCoherent,async()=>{
    const html='<p>Visible extra eligibility.</p>'+hidden
    const jobs=await run(nativeOptions((p,u)=>appendEligibility(p,u,html,{proxyCoherent})))
    assert.equal(target(jobs),undefined)
    assert.equal(JSON.stringify(jobs.map(j=>({jobDescription:j.jobDescription,sourceDescription:j.sourceDescription}))).includes('HIDDEN_CRITERION'),false)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
}

test('coherent fully visible extra eligibility is retained as healthy public criteria',async()=>{
  const html='<p>Visible extra eligibility.</p>'
  const jobs=await run(nativeOptions((p,u)=>appendEligibility(p,u,html)))
  assert.match(target(jobs).sourceDescription,/Visible extra eligibility\./)
  assert.equal(target(jobs).sourceDetailComplete,true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

for(const [label,markup] of [
  ['unquoted opacity','<div style=opacity:0>HIDDEN_CRITERION</div>'],
  ['comment before opacity zero',"<div style='opacity:/**/0'>HIDDEN_CRITERION</div>"],
  ['comment after opacity zero',"<div style='opacity:0/*x*/'>HIDDEN_CRITERION</div>"],
  ['decoded numeric opacity',"<div style='opacity:&#48;'>HIDDEN_CRITERION</div>"],
  ['decoded unquoted numeric opacity','<div style=opacity:&#x30;>HIDDEN_CRITERION</div>'],
  ['non-rendering title','<title>HIDDEN_CRITERION</title>'],
]) {
  test('parsed '+label+' cannot publish mixed hidden eligibility',async()=>{
    const jobs=await run(nativeOptions((p,u)=>appendEligibility(p,u,'<p>VISIBLE_CONTROL</p>'+markup)))
    assert.equal(target(jobs),undefined)
    assert.equal(JSON.stringify(jobs.map(j=>({sourceDescription:j.sourceDescription,jobDescription:j.jobDescription}))).includes('HIDDEN_CRITERION'),false)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
  test('parsed '+label+' cannot publish hidden structured criteria',async()=>{
    const jobs=await run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j.qualifications='<p>VISIBLE_CONTROL</p>'+markup})}))
    assert.equal(target(jobs),undefined)
    assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  })
}

for(const style of ['opacity:/**/1','opacity:0.5','opacity:&#49;'])test('nonzero parsed opacity preserves genuinely visible criteria: '+style,async()=>{
  const jobs=await run(nativeOptions((p,u)=>appendEligibility(p,u,'<p style="'+style+'">VISIBLE_CONTROL</p>')))
  assert.match(target(jobs).sourceDescription,/VISIBLE_CONTROL/)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

for(const style of ['opacity:0','opacity:/**/0','opacity:0/*x*/','opacity:&#48;']) {
  test('parsed unquoted opacity cannot hide the official iframe: '+style,async()=>{
    await assert.rejects(run(nativeOptions((p,u)=>{if(u==='https://byteridge.com/careers/')p.body=p.body.replace('style="overflow: auto;"','style='+style)})))
  })
  test('parsed unquoted opacity cannot hide the native application root: '+style,async()=>{
    await assert.rejects(run(nativeOptions((p,u)=>{if(u.includes('/job/publicjobs/'))p.body=p.body.replace('<div id="root">','<div id="root" style='+style+'>')})))
  })
}

for(const variant of ['empty-object','absent-container','null-container','null-career-entry'])test('active public careers roles support optional expiry: '+variant,async()=>{
  const jobs=await run(nativeOptions((p,u)=>{
    const apply=obj=>{if(variant==='empty-object')obj.ExpiryDates={};if(variant==='absent-container')delete obj.ExpiryDates;if(variant==='null-container')obj.ExpiryDates=null;if(variant==='null-career-entry')obj.ExpiryDates={CAREERPAGE:null}}
    if(u===API)mutateJSON(p,apply)
    if(u.includes('filteredjobs'))mutateJSON(p,j=>apply(j.Result.find(r=>r.JobId===ID)))
    if(u===PROXY)mutateJSON(p,j=>{j.Result.find(r=>r.JobId===ID).PromotionExpiryDate=null})
  }))
  const job=target(jobs)
  assert.ok(job)
  assert.equal(job.closingDate,null)
  assert.equal(job.nativeExpiryRaw,null)
  assert.equal(job.nativeExpiryPrecision,null)
  assert.equal(job.sourceClosingDateIsExact,false)
  assert.equal(job.sourceAvailabilityVerified,true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('absent API expiry cannot silently discard a supplied schema expiry',async()=>{
  const jobs=await run(nativeOptions((p,u)=>{
    if(u===API)mutateJSON(p,j=>{j.ExpiryDates={}})
    if(u.includes('filteredjobs'))mutateJSON(p,j=>{j.Result.find(r=>r.JobId===ID).ExpiryDates={}})
    if(u===PROXY)mutateJSON(p,j=>{j.Result.find(r=>r.JobId===ID).PromotionExpiryDate=null})
    if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j.validThrough='2020-01-01T00:00:00Z'})
  }))
  assert.equal(target(jobs),undefined)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const frame of ['<iframe srcdoc="&lt;a href=https://jobs.ashbyhq.com/byteridge&gt;Jobs&lt;/a&gt;"></iframe>','<iframe></iframe>'])test('unresolved active corporate frame retains partial scope: '+frame,async()=>{
  const options=nativeOptions((p,u)=>{if(u==='https://byteridge.com/careers/')p.body=p.body.replace('</body>',frame+'</body>')})
  const jobs=await run(options)
  assert.equal(jobs.length,7)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(jobs.nativeInventoryEvidence.sourceFrameContexts.opening.length,2)
  assert.ok(options.calls.every(call=>!call.url.includes('ashbyhq')))
})

test('multi-country roles publish only their proven India locations while retaining every native address',async()=>{
  const addresses=[{Address:'Toronto, Ontario, Canada',PlaceId:null},{Address:'Mumbai, Maharashtra, India',PlaceId:null}]
  const location=JSON.stringify(addresses)
  const jobs=await run(nativeOptions((p,u)=>{
    if(u===API)mutateJSON(p,j=>{j.Location=location})
    if(u.includes('filteredjobs'))mutateJSON(p,j=>{j.Result.find(r=>r.JobId===ID).Location=location})
    if(u===PROXY)mutateJSON(p,j=>{j.Result.find(r=>r.JobId===ID).Location=location})
    if(u.includes('/job/publicjobs/'+ID))mutatePosting(p,j=>{j.jobLocation=addresses.map((a,i)=>({'@type':'Place',address:{'@type':'PostalAddress',addressLocality:a.Address,addressCountry:i===0?'Canada':'India'}}))})
  }))
  const job=target(jobs)
  assert.equal(job.location,'Mumbai, Maharashtra, India')
  assert.equal(job.city,'Mumbai')
  assert.equal(job.country,'India')
  assert.deepEqual(job.nativeLocationAddresses,addresses.map(a=>a.Address))
  const normalized=normalizeScrapedJob(job,{source:'byteridge',companyName:'Byteridge'})
  assert.equal(normalized.city,'Mumbai')
  assert.equal(normalized.location,'Mumbai, Maharashtra, India')
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
