import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'

// Synthetic boundary controls derived from the captured current Hilton and
// Subaru CX_1 redirects. They make no claim about current employer inventories.
const origin='https://tenant.fa.us2.oraclecloud.com'
const oldBoard=origin+'/hcmUI/CandidateExperience/en/sites/CX_1'
const newBoard=origin+'/hcmUI/CandidateExperience/en/sites/CX_1009'
const corporate='https://example-hotels.test/careers'
const description='<p>Develop and maintain reliable production software services, review engineering designs, investigate incidents and work with the product engineering team on performance and availability.</p>'
const provider={source:'oracle-alias-control',companyName:'Example Hotels',companyDomain:'example-hotels.test',
 companyCareerPage:corporate,officialHomepageUrl:corporate,requireCorporateIdentityMatch:true,allowVerifiedCorporateRedirects:true}
const run=async(changes={})=>{
 const calls=[]
 const promise=createVerifiedRecruitmentScraper({...provider,...changes.provider}).run({
  now:()=> '2026-11-07T00:00:00.000Z',
  fetchPage:async url=>{
   if(url===corporate)return {url,status:200,html:'<h1>Example Hotels Careers</h1>'+(changes.noHandoff?'':'<a href="'+oldBoard+'">Open jobs</a>')}
   assert.equal(url,oldBoard)
   return {url:changes.finalURL||newBoard,status:changes.status||200,
    html:'<title>'+(changes.publisher||'Example Hotels')+'</title><base href="'+(changes.base||newBoard)+'" data-sitenumber="'+(changes.site||'CX_1009')+'" data-apibaseurl="'+(changes.api||origin)+'">'}
  },
  fetchJson:async url=>{
   calls.push(url)
   assert.ok(url.startsWith(origin+'/hcmRestApi/resources/latest/'))
   assert.ok(url.includes('siteNumber=CX_1009'))
   return url.includes('recruitingCEJobRequisitionDetails')?
    {count:1,hasMore:false,items:[{Id:'12345',Title:'Software Engineer',PrimaryLocationCountry:'IN',
     PrimaryLocation:'Bengaluru',LegalEmployer:'Example Hotels',ExternalDescriptionStr:description,
     ExternalPostedStartDate:'2026-11-01',ExternalPostedEndDate:'2026-12-31',...changes.detail}]}:
    {count:1,hasMore:false,items:[{SiteNumber:'CX_1009',Offset:0,Limit:20,TotalJobsCount:1,
     requisitionList:[{Id:'12345',Title:'Software Engineer',PrimaryLocationCountry:'IN',...changes.row}]}]}
  }
 })
 return {jobs:await promise,calls}
}
test.beforeEach(t=>t.mock.method(globalThis,'fetch',()=>assert.fail('Oracle alias controls forbid network')))

test('a current corporate Oracle handoff follows its same-tenant native published alias',async()=>{
 const {jobs,calls}=await run()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].sourceDescription,description)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].nativeHiringOrganization.name,'Example Hotels')
 assert.equal(jobs[0].applyUrl,newBoard+'/job/12345')
 assert.equal(jobs[0].closingDate,'2026-12-31')
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(calls.length,2)
 const redirect=jobs[RECRUITMENT_OBSERVATIONS].nativeCandidateSiteRedirects[0]
 assert.equal(redirect.requestedURL,oldBoard)
 assert.equal(redirect.finalURL,newBoard)
 assert.equal(redirect.publisher,'Example Hotels')
 assert.equal(redirect.method,'current-corporate-handoff-and-native-oracle-site-alias')
})

for(const [name,changes] of [
 ['another tenant',{finalURL:'https://other.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1009'}],
 ['another named publisher',{publisher:'Other Company Careers'}],
 ['generic publisher',{publisher:'Candidate Experience site'}],
 ['mismatched native base',{base:oldBoard}],
 ['mismatched native site number',{site:'CX_2000'}],
 ['another API authority',{api:'https://other.fa.us2.oraclecloud.com'}],
 ['a noncandidate route',{finalURL:origin+'/login'}],
 ['unreviewed redirect discovery',{provider:{allowVerifiedCorporateRedirects:false}}],
 ['a missing current corporate handoff',{noHandoff:true}],
])test('Oracle alias discovery does not authorize '+name,async()=>{
 await assert.rejects(run(changes),error=>error.failureKind==='coverage_gap')
})

for(const [name,changes] of [
 ['a foreign work country',{row:{PrimaryLocationCountry:'US'},detail:{PrimaryLocationCountry:'US'}}],
 ['an unknown work country',{row:{PrimaryLocationCountry:null},detail:{PrimaryLocationCountry:null}}],
 ['another native employer',{detail:{LegalEmployer:'Other Company'}}],
 ['a short description',{detail:{ExternalDescriptionStr:'Apply now'}}],
 ['an expired role',{detail:{ExternalPostedEndDate:'2026-10-31'}}],
])test('a verified alias retains role qualification for '+name,async()=>{
 const {jobs}=await run(changes)
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].sourceScopeComplete,false)
 assert.equal(jobs[RECRUITMENT_OBSERVATIONS].lifecycleCleanupAllowed,false)
})

