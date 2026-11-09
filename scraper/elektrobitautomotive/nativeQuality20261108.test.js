import assert from 'node:assert/strict'
import test from 'node:test'
import { createElektrobitAutomotiveScraper, CAREERS_URL, JOBS_BROWSE_URL, INDIA_JOBS_URL, buildIndiaJobsApiUrl } from './script.js'

// Synthetic projection controls, not captured public HTTP or current inventory.
const home = 'Move the world with us! Careers at Elektrobit <a href="https://jobs.elektrobit.com/jobs">Open Elektrobit Jobs</a>'
const board = '<title>Elektrobit Automotive GmbH</title>Find Jobs See jobs by: Categories Brands Locations<search-app></search-app><script src="https://app.jibecdn.com/prod/search/main.js"></script>'
const india = board + `<link rel="canonical" href="${INDIA_JOBS_URL}"><script>page_type: '/jobs/locations/country/India'</script>`
const clock = '2026-11-07T16:31:32.899Z'
const native = () => ({ slug:'100',req_id:'100',title:'Native quality control',country:'India',country_code:'IN',city:'Bengaluru',state:'Karnataka',
 full_location:'Bengaluru, India',short_location:'Bengaluru, India',employment_type:'FULL_TIME',posted_date:'2026-08-13T09:20:00+0000',posting_expiry_date:null,
 apply_url:'https://careers-elektrobit.icims.com/jobs/100/login',description:'<p>Build reliable customer systems and preserve the entire original overview text.</p>',
 responsibilities:'<ul><li>Operate the production service and investigate failures.</li></ul>',qualifications:'<ul><li>Experience with testing and maintaining production systems.</li></ul>' })
const execute = async (row=native(),jsonError) => {
 const requests=[]
 const jobs=await createElektrobitAutomotiveScraper({now:()=>clock}).run({fetchPage:async url=>{
  requests.push(url);const pages=new Map([[CAREERS_URL,home],[JOBS_BROWSE_URL,board],[INDIA_JOBS_URL,india]])
  assert.ok(pages.has(url));return{status:200,url,html:pages.get(url)}
 },fetchJson:async url=>{requests.push(url);assert.equal(url,buildIndiaJobsApiUrl());if(jsonError!==undefined)throw jsonError;return{totalCount:1,count:1,jobs:[{data:row}]}}})
 assert.deepEqual(requests,[CAREERS_URL,JOBS_BROWSE_URL,INDIA_JOBS_URL,buildIndiaJobsApiUrl()]);return jobs
}
for (const [label,change] of [
 ['foreign own country despite India display',r=>{r.country='United States'}],
 ['India country and foreign code',r=>{r.country_code='US'}],
 ['foreign country and IN code',r=>{r.country='United States';r.country_code='IN'}],
 ['unknown country code',r=>{r.country_code='ZZ'}],
 ['nonstring country',r=>{r.country={name:'India'}}],
 ['nonstring code',r=>{r.country_code={value:'IN'}}],
 ['code-only country',r=>{delete r.country}],
 ['location-only country',r=>{delete r.country;delete r.country_code}],
 ['inherited country',r=>{delete r.country;Object.setPrototypeOf(r,{country:'India'})}],
 ['inherited country_code',r=>{delete r.country_code;Object.setPrototypeOf(r,{country_code:'IN'})}],
]) test(label+' cannot become India through location prose',async()=>{const r=native();change(r);await assert.rejects(execute(r),/country filter|native quality/i)})
for (const [label,change] of [
 ['missing',r=>{delete r.city}],['empty',r=>{r.city='  '}],
]) test(label+' native city remains null',async()=>{const r=native();change(r);const[job]=await execute(r);assert.equal(job.city,null);assert.equal(job.country,'India');assert.equal(job.location,'Bengaluru, India')})
test('malformed nonstring native city fails closed',async()=>{const r=native();r.city=['Bengaluru'];await assert.rejects(execute(r),/native quality/i)})
for(const code of [undefined,''])test('explicit legacy India name with '+String(code)+' code remains supported',async()=>{const r=native();r.country='  inDIA  ';if(code===undefined)delete r.country_code;else r.country_code=code;assert.equal((await execute(r))[0].country,'India')})
test('nonempty code must be exact IN',async()=>{for(const code of ['in',' IN ',' ',null,0]){const r=native();r.country_code=code;await assert.rejects(execute(r),/country filter|native quality/i)}})
test('country getter cannot be invoked as authority',async()=>{let calls=0;const r=native();Object.defineProperty(r,'country',{get(){calls++;return'India'}});await assert.rejects(execute(r),/country filter|native quality/i);assert.equal(calls,0)})
test('complete description includes all three own field boundaries without truncation',async()=>{
 const r=native();r.qualifications='<ul>'+Array.from({length:16},(_,i)=>'<li>Qualification clause number '+(i+1)+'</li>').join('')+'</ul>'
 const[job]=await execute(r)
 for(const text of ['Description:', 'Responsibilities:', 'Qualifications:','entire original overview','Operate the production service','Qualification clause number 16'])assert.ok(job.jobDescription.includes(text),text)
 assert.equal(job.sourceDescription,job.jobDescription)
 assert.equal(job.minimumQualification,null);assert.equal(job.preferredQualification,null);assert.deepEqual(job.requiredSkills,[])
 const fields=job.sourceNativeCriteriaEvidence.fields
 assert.deepEqual(fields.map(x=>x.field),['description','responsibilities','qualifications'])
 for(const f of fields){assert.equal(f.rawValue,r[f.field]);assert.equal(f.present,true)}
})
test('first optional qualification and responsibilities are not minimum or required skills',async()=>{
 const r=native();r.qualifications='<ul><li>Optional community volunteering is welcome.</li><li>Preferred experience is useful.</li></ul>'
 const[job]=await execute(r);assert.equal(job.minimumQualification,null);assert.equal(job.preferredQualification,null);assert.deepEqual(job.requiredSkills,[])
 assert.ok(job.jobDescription.includes('Optional community volunteering'));assert.ok(job.jobDescription.includes('Preferred experience'))
})
for(const [label,fragment] of [
 ['hidden','<p hidden>Additional mandatory skill</p>'],['inert','<div inert>Additional mandatory skill</div>'],
 ['template','<template>Additional mandatory skill</template>'],['hidden style','<p style="display:none">Additional mandatory skill</p>'],
 ['country attribute','<p data-work-location-country="US">Additional mandatory skill</p>'],
 ['semantic meta','<meta itemprop="addressCountry" content="US">'],['script','<script>untrusted()</script>'],
 ['link authority','<link itemprop="hiringOrganization" href="https://unrelated.invalid/">'],
 ['malformed attribute','<p style="unterminated>Additional mandatory skill</p>'],['malformed entity','<p>&#1114112;</p>'],
 ['duplicate attribute','<p style="font-size: 12pt;" style="display:none">Additional mandatory skill</p>'],
])test('own criteria reject '+label+' instead of silently losing it',async()=>{const r=native();r.qualifications+=fragment;await assert.rejects(execute(r),/native quality/i)})
test('native field getter and nonstring criteria are rejected without reading getter',async()=>{
 const r=native();let count=0;Object.defineProperty(r,'qualifications',{get(){count++;return'<p>Wrong</p>'}})
 await assert.rejects(execute(r),/native quality/i);assert.equal(count,0)
 const other=native();other.responsibilities={html:'unreviewed'};await assert.rejects(execute(other),/native quality/i)
})
test('empty optional field evidence is honest and no criteria can yield a successful model',async()=>{
 const r=native();delete r.qualifications;r.responsibilities='';const[job]=await execute(r)
 assert.equal(job.sourceNativeCriteriaEvidence.fields[2].present,false);assert.equal(job.sourceNativeCriteriaEvidence.fields[1].rawValue,'')
 const noText=native();noText.description='';noText.responsibilities='';noText.qualifications='';await assert.rejects(execute(noText),/native quality/i)
})
test('raw fields remain distinct even with repeated prose or escaped markup',async()=>{
 const r=native();r.description='<p>Literal &lt;policy&gt; text belongs to the original description.</p>';r.responsibilities='<p>Same repeated requirement.</p>';r.qualifications='<p>Same repeated requirement.</p>'
 const[job]=await execute(r);assert.ok(job.jobDescription.includes('Literal <policy> text'));assert.equal(job.jobDescription.split('Same repeated requirement.').length-1,2)
 assert.equal(job.sourceNativeCriteriaEvidence.fields[0].rawValue,r.description)
})
test('native identity, routes, employment and dates stay unchanged',async()=>{
 const r=native();const[job]=await execute(r)
 assert.deepEqual([job.jobId,job.requisitionId,job.title,job.company,job.applyUrl,job.sourceUrl,job.employmentType,job.postingDate,job.closingDate,job.scrapedAt],['100','100',r.title,'Elektrobit Automotive',r.apply_url,'https://jobs.elektrobit.com/jobs/100','Full-time','2026-08-13',null,clock])
})
test('foreign transport error remains the exact original object',async()=>{const reason=Object.freeze({caller:'unchanged'});await assert.rejects(execute(native(),reason),e=>e===reason)})

test('country denial retains exact own raw carriers and false cleanup scope',async()=>{
 const r=native();r.country_code='US'
 await assert.rejects(execute(r),error=>{
  assert.equal(error.failureKind,'coverage_gap');assert.equal(error.softFailure,true);assert.equal(error.abortRetries,true)
  assert.equal(error.sourceScopeComplete,false);assert.equal(error.sourceListingComplete,false);assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.nativeQualityEvidence.country.rawValue,'India');assert.equal(error.nativeQualityEvidence.country_code.rawValue,'US')
  for(const field of error.sourceNativeCriteriaEvidence.fields)assert.equal(field.rawValue,r[field.field])
  assert.equal(error.sourceNativeCriteriaEvidence.fields.length,3);return true
 })
})
test('malformed criteria keeps full raw field and parser cause through coverage gap',async()=>{
 const r=native();r.qualifications+='<p>&#1114112;</p>'
 await assert.rejects(execute(r),error=>{
  assert.equal(error.failureKind,'coverage_gap');assert.equal(error.softFailure,true);assert.equal(error.abortRetries,true);assert.equal(error.lifecycleCleanupAllowed,false)
  assert.equal(error.nativeQualityEvidence.field,'qualifications');assert.equal(error.nativeQualityEvidence.rawValue,r.qualifications)
  assert.equal(error.cause?.name,'RangeError')
  for(const field of error.sourceNativeCriteriaEvidence.fields)assert.equal(field.rawValue,r[field.field])
  assert.equal(error.sourceNativeCriteriaEvidence.fields.length,3);return true
 })
})


// Review successor: synthetic entity controls. Raw API fields remain untouched.
import { projectElektrobitNativeQuality } from './nativeQuality20261108.js'
const onceVectors = [
 ['&amp;bull;', '&bull;'], ['&amp;rsquo;', '&rsquo;'],
 ['&#38;bull;', '&bull;'], ['&#x26;rsquo;', '&rsquo;'],
 ['&amp;#8226;', '&#8226;'], ['&#38;#x2019;', '&#x2019;'],
 ['&amp;amp;bull;', '&amp;bull;'], ['&amp;lt;policy&amp;gt;', '&lt;policy&gt;'],
]
for(const field of ['description','responsibilities','qualifications']){
 test('single decoding pure helper preserves nested references in '+field,()=>{
  for(const [raw,expected]of onceVectors){
   const r=native();r[field]='<p>Literal '+raw+' authored criterion.</p>'
   const result=projectElektrobitNativeQuality(r),evidence=result.sourceNativeCriteriaEvidence.fields.find(x=>x.field===field)
   assert.equal(evidence.text,'Literal '+expected+' authored criterion.')
   assert.equal(evidence.rawValue,r[field]);assert.ok(result.jobDescription.includes(evidence.text));assert.equal(result.sourceDescription,result.jobDescription)
  }
 })
 test('single decoding real wrapper preserves nested references in '+field,async()=>{
  for(const [raw,expected]of onceVectors){
   const r=native();r[field]='<p>Literal '+raw+' authored criterion.</p>'
   const[job]=await execute(r),evidence=job.sourceNativeCriteriaEvidence.fields.find(x=>x.field===field)
   assert.equal(evidence.text,'Literal '+expected+' authored criterion.')
   assert.equal(evidence.rawValue,r[field]);assert.ok(job.jobDescription.includes(evidence.text));assert.equal(job.sourceDescription,job.jobDescription)
  }
 })
 test('single encoded references still decode exactly once in '+field,async()=>{
  const r=native();r[field]='<p>Actual &bull; &rsquo; &#8226; &#x2019; &lt;policy&gt; &amp; text.</p>'
  for(const result of [projectElektrobitNativeQuality(r),(await execute(r))[0]]){
   const evidence=result.sourceNativeCriteriaEvidence.fields.find(x=>x.field===field)
   assert.equal(evidence.text,['Actual',String.fromCodePoint(0x2022),String.fromCodePoint(0x2019),String.fromCodePoint(0x2022),String.fromCodePoint(0x2019),'<policy> & text.'].join(' '))
   assert.equal(evidence.rawValue,r[field])
  }
 })
}
test('decoding does not recurse across nested markup or turn escaped markup into a DOM carrier',async()=>{
 const r=native();r.description='<p>Outer &amp;bull; <strong>Inner &#38;rsquo;</strong> &lt;script&gt; literal.</p>'
 const[job]=await execute(r)
 assert.equal(job.sourceNativeCriteriaEvidence.fields[0].text,'Outer &bull; Inner &rsquo; <script> literal.')
 assert.equal(job.sourceNativeCriteriaEvidence.fields[0].rawValue,r.description)
})
test('unknown references remain literal and do not hide authored text',async()=>{
 const r=native();r.qualifications='<p>Preserve &UnreviewedEntity; and &amp;UnreviewedEntity; literal criteria.</p>'
 const[job]=await execute(r)
 assert.equal(job.sourceNativeCriteriaEvidence.fields[2].text,'Preserve &UnreviewedEntity; and &UnreviewedEntity; literal criteria.')
 assert.equal(job.sourceNativeCriteriaEvidence.fields[2].rawValue,r.qualifications)
})
