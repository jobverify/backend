import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'

const root='https://careers.example.test/hcmUI/CandidateExperience/en/sites/CX_1'
const backend='https://tenant.fa.us2.oraclecloud.com'
const description='<p>Develop reliable production services, collaborate with engineers on system designs, investigate incidents and improve operational availability and performance.</p>'
async function run({api=backend,publisher='Example Careers',nativeBase=true,country='IN',employer='Example',protectedName=true}={}){
 const calls=[]
 const promise=createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyCareerPage:root,
  companyDomain:'careers.example.test',officialHomepageUrl:root,requireCorporateIdentityMatch:true,requireNativeEmployerName:protectedName}).run({
  fetchPage:async url=>({status:200,url,html:`<title>${publisher}</title>${nativeBase?`<base href="${root}" data-sitenumber="CX_1" data-apibaseurl="${api}">`:''}`}),
  fetchJson:async url=>{
   calls.push(url)
   assert.ok(url.startsWith(backend+'/hcmRestApi/resources/latest/'))
   return url.includes('recruitingCEJobRequisitionDetails')?{count:1,hasMore:false,items:[{Id:'123',Title:'Engineer',PrimaryLocationCountry:country,PrimaryLocation:'Bangalore',LegalEmployer:employer,ExternalDescriptionStr:description}]}
    :{count:1,hasMore:false,items:[{SiteNumber:'CX_1',Offset:0,Limit:20,TotalJobsCount:1,requisitionList:[{Id:'123',Title:'Engineer',PrimaryLocationCountry:country}]}]}
  },
 })
 return {jobs:await promise,calls}
}

test('a current official Oracle vanity page binds its explicitly declared Oracle API and exact native role',async()=>{
 const {jobs,calls}=await run()
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].nativeHiringOrganization.name,'Example')
 assert.equal(jobs[0].sourceDescription,description)
 assert.equal(jobs[0].applyUrl,root+'/job/123')
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(calls.length,2)
})

for(const [label,settings]of [
 ['another API publisher',{api:'https://other.test'}],['insecure API',{api:'http://tenant.fa.us2.oraclecloud.com'}],
 ['API credentials',{api:'https://user@tenant.fa.us2.oraclecloud.com'}],['no native contract',{nativeBase:false}],
 ['generic unverified publisher',{publisher:'Candidate Experience site'}],['wrong publisher',{publisher:'Other Company Careers'}],
])test('a vanity path cannot authorize '+label,async()=>{
 await assert.rejects(run(settings),error=>error.failureKind==='coverage_gap')
})

test('vanity discovery retains native employer and country qualification',async()=>{
 for(const settings of [{employer:'Other Company'},{employer:null},{country:'US'},{country:null}]){
  const {jobs}=await run(settings)
  assert.equal(jobs.length,0)
  assert.equal(jobs[RECRUITMENT_OBSERVATIONS].sourceScopeComplete,false)
 }
})
