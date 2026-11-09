import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

const root='https://example.test/global/en/search-results'
const app={widgetApiEndpoint:'https://example.test/widgets',country:'global',deviceType:'desktop',locale:'en_global',refNum:'EXAMPLE1',
 baseUrl:'https://example.test/global/en/',baseDomain:'https://example.test',pageName:'search-results',siteType:'external'}
const siteConfig={status:'success',data:{refNum:'EXAMPLE1',urlMap:{'search-results':'search-results',job:'job/:jobId/:title'},refineSearch:{sort:{field:'postedDate'}}}}
const listing={jobId:'R1',jobSeqNo:'EXAMPLE1R1EXTERNAL',title:'Software Engineer',country:'India',siteType:'external',visibilityType:'External'}
const description='<p>Develop reliable production software, collaborate on technical designs, maintain distributed systems, investigate incidents and improve service performance and availability.</p>'
const role={...listing,uniqueValue:{jobId:'R1',refNum:'EXAMPLE1',siteType:'external'},companyName:'Example',description,city:'Bangalore',postedDate:'2026-11-01'}
const html=(config,ddo)=>`<h1>Example Careers</h1><script>var phApp=phApp||${JSON.stringify(config)};phApp.ddo=${JSON.stringify(ddo)};</script>`
const search=html(app,{siteConfig,eagerLoadRefineSearch:{status:200,hits:1,totalHits:101,data:{jobs:[{...listing,jobId:'US1',country:'United States'}],aggregations:[{field:'country',value:{India:1,'United States':100}}]}}})
const source={source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:root,discoverLiteralRecruitmentData:true,prioritizeRecruitmentSearch:true}
async function run({record=role,listed=listing,searchHTML=search,total=1,allowCoverageGap=false,posting=null}={}){
 const requests=[]
 const jobs=await createVerifiedRecruitmentScraper(source).run({fetchPage:async url=>{
  requests.push({url,method:'GET'})
  return {status:200,url,html:url.includes('/job/')?html({...app,pageName:'job'},{siteConfig,jobDetail:{status:200,hits:1,totalHits:1,data:{job:record}}})+(posting?`<script type="application/ld+json">${JSON.stringify(posting)}</script>`:''):searchHTML}
 },fetchJson:async(url,init)=>{
  requests.push({url,...init})
  assert.equal(url,app.widgetApiEndpoint)
  const query=JSON.parse(init.body)
  assert.deepEqual(query.selected_fields,{country:['India']})
  assert.equal(init.method,'POST')
  return {refineSearch:{status:200,totalHits:total,hits:1,data:{jobs:[listed]}}}
 }}).catch(error=>{if(allowCoverageGap&&error.failureKind==='coverage_gap')return [];throw error})
 return {jobs,requests}
}

test('reads the published Phenom India filter and verifies the exact own native role detail',async()=>{
 const {jobs,requests}=await run()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDescription,description)
 assert.equal(jobs[0].nativeSourceRecord.jobId,'R1')
 assert.equal(requests.filter(r=>r.method==='POST').length,1)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const [label,changes]of [
 ['foreign detail',{country:'United States'}],['unknown detail country',{country:'Bangalore'}],
 ['conflicting detail country',{standardisedCountry:'United States'}],['other employer',{companyName:'Other'}],
 ['other account',{uniqueValue:{...role.uniqueValue,refNum:'OTHER'}}],['other role',{jobId:'R2'}],
 ['changed title',{title:'Different Engineer'}],['internal detail',{visibilityType:'Internal'}],['teaser',{description:'Join us'}],
])test('Phenom India candidate cannot qualify with '+label,async()=>{
 const {jobs}=await run({record:{...role,...changes}})
 assert.equal(jobs.length,0)
})

test('a hidden declaration or a locale cannot supply the native country filter',async()=>{
 for(const searchHTML of [`<div hidden>${search}</div>`,search.replace('"India":1,','')]){
  const {jobs,requests}=await run({searchHTML,allowCoverageGap:true})
  assert.equal(jobs.length,0)
  assert.equal(requests.filter(r=>r.method==='POST').length,0)
 }
})

test('a repeated Phenom page stops pagination and preserves the verified role with incomplete scope',async()=>{
 const {jobs,requests}=await run({total:3})
 assert.equal(jobs.length,1)
 assert.equal(requests.filter(r=>r.method==='POST').length,2)
 assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-phenom-pagination-repeated-role'))
})

const employerPosting={'@type':'JobPosting',identifier:{value:'R1'},title:role.title,description,
 url:'https://example.test/global/en/job/R1/Software-Engineer',jobLocation:{address:{addressCountry:'India'}},
 hiringOrganization:{name:'Example',url:'https://example.test/global/en/job/R1/Software-Engineer'}}
test('reads the native Phenom legal company field when companyName is absent',async()=>{
 const {jobs}=await run({record:{...role,companyName:undefined,company:'Example'}})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].nativeHiringOrganization.name,'Example')
 assert.equal(jobs[0].nativeSourceRecord.company,'Example')
})
test('correlates own JobPosting employer by native role ID, title, country and role URL',async()=>{
 const {jobs}=await run({record:{...role,companyName:undefined},posting:employerPosting})
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].nativeHiringOrganization.name,'Example')
 assert.deepEqual(jobs[0].nativeHiringOrganizationRecord,employerPosting)
})
for(const [label,changes]of [
 ['other identity',{identifier:{value:'OTHER'}}],['other title',{title:'Other Engineer'}],
 ['other account',{url:'https://other.test/global/en/job/R1/Software-Engineer'}],
 ['other country',{jobLocation:{address:{addressCountry:'United States'}}}],
 ['other employer',{hiringOrganization:{name:'Other',url:employerPosting.url}}],
 ['unrelated organization URL',{hiringOrganization:{name:'Example',url:'https://example.test/global/en/job/OTHER/Software-Engineer'}}],
])test('a JobPosting with '+label+' cannot donate an employer to Phenom',async()=>{
 const {jobs}=await run({record:{...role,companyName:undefined},posting:{...employerPosting,...changes}})
 assert.equal(jobs.length,0)
})
test('JobPosting fallback cannot override a different explicit native Phenom employer',async()=>{
 const {jobs}=await run({record:{...role,companyName:'Other'},posting:employerPosting})
 assert.equal(jobs.length,0)
})

test('native On Hold roles are excluded without imposing an Open status whitelist',async()=>{
 for(const field of ['atsStatus','jobStatus','postingStatus']){
  const {jobs}=await run({record:{...role,[field]:'On Hold'}})
  assert.equal(jobs.length,0,field)
  assert.ok(jobs[RECRUITMENT_OBSERVATIONS].exclusions.some(e=>e.reason==='native-role-on-hold'))
 }
 for(const status of ['Success','Updated','Open']){
  const {jobs}=await run({record:{...role,postingStatus:status}})
  assert.equal(jobs.length,1,status)
 }
})

test('a visible JobPosting on the same Phenom page cannot bypass its own On Hold state',async()=>{
 const url=employerPosting.url,record={...role,postingStatus:'On Hold'}
 const body=html({...app,pageName:'job'},{siteConfig,jobDetail:{status:200,hits:1,totalHits:1,data:{job:record}}})
  .replace('<h1>Example Careers</h1>',`<h1>${role.title}</h1>${description}`)
  +`<script type="application/ld+json">${JSON.stringify(employerPosting)}</script>`
 const jobs=await createVerifiedRecruitmentScraper({...source,companyCareerPage:url}).run({maxPages:1,
  fetchPage:async requested=>({status:200,url:requested,html:body})})
 assert.equal(jobs.length,0)
 assert.ok(jobs[RECRUITMENT_OBSERVATIONS].exclusions.some(e=>e.reason==='native-role-on-hold'))
})
