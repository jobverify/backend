import assert from 'node:assert/strict'
import test from 'node:test'
import {createVerifiedRecruitmentScraper,RECRUITMENT_OBSERVATIONS} from '../scraper-support/utils/verifiedRecruitment.js'
const board='https://tenant.fa.ocs.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX'
const description='<p>Develop reliable distributed software services, review system designs with the engineering team, investigate production incidents and improve service performance and operational availability.</p>'
const run=(employer='Example',publisher='Candidate Experience site')=>createVerifiedRecruitmentScraper({source:'example',companyName:'Example',companyDomain:'example.test',companyCareerPage:'https://example.test/careers',requireCorporateIdentityMatch:true}).run({
  fetchPage:async url=>({status:200,url,html:url===board?`<title>${publisher}</title><base href="${board}" data-sitenumber="CX" data-apibaseurl="https://tenant.fa.ocs.oraclecloud.com">`:`<h1>Example Careers</h1><a href="${board}">Jobs</a>`}),
  fetchJson:async url=>url.includes('recruitingCEJobRequisitionDetails')?{count:1,hasMore:false,items:[{Id:'123',Title:'Software Engineer',PrimaryLocationCountry:'IN',LegalEmployer:employer,ExternalDescriptionStr:description}]}:{count:1,hasMore:false,items:[{SiteNumber:'CX',Offset:0,Limit:20,TotalJobsCount:1,requisitionList:[{Id:'123',Title:'Software Engineer',PrimaryLocationCountry:'IN'}]}]},
})
test('generic native Oracle branding requires the exact role employer behind current corporate delegation',async()=>{
  const jobs=await run()
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].nativeHiringOrganization.name,'Example')
  assert.equal(jobs[0].sourceDescription,description)
})
test('generic branding cannot supply a missing legal employer or a different company',async()=>{
  for(const employer of [null,'Other Company']){
    const jobs=await run(employer)
    assert.equal(jobs.length,0)
    assert.ok(jobs[RECRUITMENT_OBSERVATIONS].unresolved.includes('native-employer-mismatch'))
  }
})
test('a different named native publisher remains a coverage failure',async()=>{
  await assert.rejects(run('Example','Other Company Careers'),error=>error.failureKind==='coverage_gap')
})
