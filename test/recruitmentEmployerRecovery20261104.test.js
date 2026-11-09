import assert from 'node:assert/strict'
import test from 'node:test'
import {remainingRecruitmentBatchProvider} from '../scraper-support/utils/remainingRecruitmentBatch20261103.js'
import {recruitmentEmployerMatches} from '../scraper-support/utils/verifiedRecruitment.js'

const names={
 labcorp:['IPL Labcorp Laboratories India Private Limited','IEN Labcorp Early Development India Private Limited'],
 statestreet:['1685 SS CORP SVCS MUMBAI PVT LTD','1391 StateStreet Global Advisors India Private Limited'],
}
for(const [source,employers]of Object.entries(names))test(`${source} accepts only the reviewed legal employers on its current corporate-bound native India roles`,()=>{
 const provider=remainingRecruitmentBatchProvider(source)
 for(const employer of employers)assert.equal(recruitmentEmployerMatches(provider,employer),true,employer)
 for(const employer of [...names[source==='labcorp'?'statestreet':'labcorp'],'Unrelated Employer India Private Limited',...employers.map(n=>n+' Outsourcing')]){
  assert.equal(recruitmentEmployerMatches(provider,employer),false,employer)
 }
 assert.equal(recruitmentEmployerMatches(provider,null),false)
 assert.equal(recruitmentEmployerMatches(provider,''),false)
})
