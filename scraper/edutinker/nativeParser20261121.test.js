import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {CAREERS_URL,createEdutinkerScraper,extractJobDetail,extractListings,hasOfficialCareersSignal} from './script.js'

// Genuine Nov19 originals exercise parsing only. They are neither a fresh
// collection nor a qualified company inventory/India/zero publication proof.
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/native-parser-originals-20261119.json.gz',import.meta.url))))
const responses=fixture.responses.map(r=>{
 const bytes=Buffer.from(r.bodyBase64,'base64')
 assert.equal(bytes.length,r.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256)
 assert.equal(r.status,200);assert.equal(r.method,'GET')
 return {...r,html:new TextDecoder('utf-8',{fatal:true}).decode(bytes)}
})
const home=responses[0].html
const records=[
 {index:1,slug:'python-developer',title:'Python Developer (3-6 years experience)',posted:'2022-02-28T01:43:30.000Z',raw:'2022-02-28T07:13:30+05:30'},
 {index:2,slug:'react-developer',title:'React Developer (3-5 years experience)',posted:'2022-02-28T01:39:57.000Z',raw:'2022-02-28T07:09:57+05:30'},
]
const listing=r=>({title:r.title,jobId:r.slug,requisitionId:r.slug,sourceUrl:responses[r.index].requestedUrl,applyUrl:responses[r.index].requestedUrl})
const detail=r=>extractJobDetail(responses[r.index].html,listing(r))

for(const r of records){
 test(`${r.slug}: title belongs to the actual role, not the Digital Content navigation heading`,()=>{
  assert.equal(detail(r).title,r.title)
 })
 test(`${r.slug}: Remote Job supplies no country or city and retains actual specifications`,()=>{
  const j=detail(r)
  assert.equal(j.country,null);assert.equal(j.city,null);assert.equal(j.remoteStatus,'Remote')
  assert.equal(j.location,'Remote Job');assert.equal(j.department,'Development');assert.equal(j.employmentType,'Full Time')
  assert.equal(j.sourceCountryScopeUnresolved,true)
 })
 test(`${r.slug}: earliest original 2022 publication survives later webpage modification`,()=>{
  const j=detail(r)
  assert.equal(j.postingDate,r.posted);assert.equal(j.closingDate,null)
  assert.equal(j.sourceNativeDates.datePostedRaw,r.raw)
  assert(j.sourceNativeDates.recognizedPostingFields.some(f=>f.raw===r.raw))
  assert(j.sourceNativeDates.recognizedPostingFields.some(f=>f.field==='WebPage.datePublished'))
 })
 test(`${r.slug}: authored criteria exclude schema serialization, navigation, related content and application form`,()=>{
  const j=detail(r)
  assert.match(j.jobDescription,/Job Brief/i);assert.match(j.jobDescription,/Responsibilities/i);assert.match(j.jobDescription,/Requirements/i)
  assert.doesNotMatch(j.jobDescription,/Digital Content|Fee Management|Apply for this position|jp-relatedposts|schema\.org|"@type"/i)
  assert.equal(typeof j.sourceRawDescriptionHtml,'string');assert.match(j.sourceRawDescriptionHtml,/Job Brief/i)
 })
}

test('actual JobPosting employer Test is retained as an issuer conflict, with no legal-employer claim',()=>{
 for(const r of records){
  const j=detail(r)
  assert.equal(j.company,'Edutinker');assert.equal(j.nativeEmployer,'Test');assert.equal(j.sourceEmployerConflict,true)
  assert.equal(j.nativeLegalEmployer,null);assert.equal(j.sourceLegalEmployerUnverified,true)
  assert.equal(j.sourceNativeJobPostings.length,1);assert.equal(j.sourceNativeJobPostings[0].hiringOrganization.name,'Test')
 }
})

test('public job URL slugs never become formal requisition identifiers',()=>{
 const listings=extractListings(home)
 assert.equal(listings.length,2)
 for(const j of listings)assert.equal(j.requisitionId,null)
 for(const r of records){assert.equal(detail(r).jobId,r.slug);assert.equal(detail(r).requisitionId,null)}
})

test('first-party discovery ignores external job-like links and inert same-host jobs',()=>{
 const poison='<a href="https://other-employer.example/jobs/external-role/">External employer role</a><template><a href="https://edutinker.com/jobs/inert-role/">Inert role</a></template>'
 const jobs=extractListings(home.replace('</body>',poison+'</body>'))
 assert.deepEqual(jobs.map(j=>j.jobId).sort(),records.map(r=>r.slug).sort())
})

test('publisher guard does not pin the two historical role slugs',()=>{
 const changed=home.replaceAll('python-developer','new-platform-engineer').replaceAll('react-developer','new-product-engineer')
 assert.equal(hasOfficialCareersSignal(changed),true)
 assert.equal(extractListings(changed).length,2)
})

test('unrelated preceding job-like markup cannot replace the actual selected role facts',()=>{
 const r=records[0],noise='<aside><h1>Unrelated foreign role</h1><div>Job Location: <span>Canada</span></div><h2>Job Brief</h2><p>Unrelated criteria.</p></aside>'
 const html=responses[r.index].html.replace(/(<body\b[^>]*>)/i,'$1'+noise)
 const j=extractJobDetail(html,listing(r)),original=detail(r)
 for(const key of ['title','jobDescription','location','department','employmentType','postingDate','country','city'])assert.equal(j[key],original[key])
})

test('a listing/detail title conflict is retained and held instead of relabeling the role',()=>{
 const r=records[0],j=extractJobDetail(responses[r.index].html,{...listing(r),title:'Different listing role'})
 assert.equal(j.title,r.title);assert.equal(j.sourceIdentityConflict,true)
})

test('missing or ambiguous own role content cannot fall back to a navigation heading',()=>{
 const r=records[0]
 assert.throws(()=>extractJobDetail('<html><body><h2>Digital Content</h2><h3>Job Brief</h3><p>Menu description</p></body></html>',listing(r)),/role|content|missing|ambiguous/i)
 const html=responses[r.index].html.replace('class="awsm-job-entry-content entry-content"','class="former-role-content"')
 assert.notEqual(html,responses[r.index].html)
 assert.throws(()=>extractJobDetail(html,listing(r)),/role|content|missing|ambiguous/i)
})

test('ordinary injected historical read holds both known issuer conflicts and supplies their original observations',async()=>{
 const calls=[]
 await assert.rejects(createEdutinkerScraper().run({fetchText:async url=>{
  calls.push(url);const r=responses.find(r=>r.requestedUrl===url);assert(r,'Exact retained-only URL');return r.html
 }}),error=>{
  assert.match(error.message,/employer|issuer|held|qualif/i)
  assert.equal(error.nativeCollectionEvidence.heldRoles.length,2)
  assert.equal(error.nativeCollectionEvidence.sourceScopeComplete,false)
  assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  assert.equal(error.nativeCollectionEvidence.heldRoles[0].job.nativeEmployer,'Test')
  return true
 })
 assert.deepEqual(calls,[CAREERS_URL,...records.map(r=>responses[r.index].requestedUrl)])
})
