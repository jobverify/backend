import test from 'node:test'
import assert from 'node:assert/strict'
import {postScrapeInput,resolvePostScrapeClassification} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'

const labels=['Full-time Experienced','Full-time Fresher','Contract']
const now=new Date('2026-11-07T12:00:00Z')
const zero="Master's degree without experience OR Bachelor's degree with 8 years of experience."
const noPrior="Master's degree with no prior professional experience required OR Bachelor's degree with 8 years of experience."
const customer="Master's degree OR Bachelor's degree with 8 years of experience is required for the customers you screen."
const cases=[
  ['master first without work','Required qualifications:\n'+zero,'Full-time Fresher',0,0],
  ['master first explicitly no prior professional work','Required qualifications:\n'+noPrior,'Full-time Fresher',0,0],
  ['separate professional floor survives waiver','Required qualifications:\n'+zero+'\nAll applicants must have 5 years of professional experience.','Full-time Experienced',5,5],
  ['authoritative native floor survives waiver','Required qualifications:\n'+zero,'Full-time Experienced',5,5,{sourceExperienceRequired:'5 years'}],
  ['preferred zero route does not waive own required work','Required qualifications:\n4 years of professional experience.\nPreferred qualifications:\n'+zero,'Full-time Experienced',4,4],
  ['duties zero route does not waive own required work','Required qualifications:\n4 years of professional experience.\nResponsibilities:\n'+zero,'Full-time Experienced',4,4],
  ['specific tool waiver is not a zero-work route',"Required qualifications:\nMaster's degree with no experience with Python OR Bachelor's degree with 8 years of experience.",'Full-time Experienced',null,null,{},true],
  ['negated master route does not create zero-work eligibility',"Required qualifications:\nMaster's degree without experience is not accepted OR Bachelor's degree with 8 years of experience.",'Full-time Experienced',null,null,{},true],
  ['customer education branches under duties are not own requirements','Required qualifications:\n4 years of professional experience.\nResponsibilities:\n'+customer,'Full-time Experienced',4,4],
  ['explicit screened-customer scope remains foreign in qualifications','Required qualifications:\n4 years of professional experience.\n'+customer,'Full-time Experienced',4,4],
  ['same-line own requirement survives customer clause','Responsibilities:\n'+customer+' All applicants must have 3 years of professional experience.','Full-time Experienced',3,3],
  ['independent native work floor survives customer masking','Responsibilities:\n'+customer,'Full-time Experienced',8,8,{sourceExperienceRequired:'8 years'}],
  ['bare own education alternative remains ambiguous',"Required qualifications:\nMaster's degree OR Bachelor's degree with 8 years of experience.",'Full-time Experienced',null,null,{},true],
  ['own professional screening experience remains required','Required qualifications:\n4 years of professional experience screening customers with degrees.','Full-time Experienced',4,4],
]

for(const[name,sourceDescription,category,min,max,extra={},ambiguous=false]of cases)for(const modelLabel of labels)test('master-first and third-party degree/'+name+'/'+modelLabel,()=>{
  const job={title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription,...extra}
  const before=structuredClone(job),input=postScrapeInput(job,{now})
  const result=resolvePostScrapeClassification(job,{modelLabel,fullDescriptionCovered:true,windows:1,
    scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel ? .97 : .01]))},{now,mode:'policy'})
  assert.deepEqual(job,before)
  assert.equal(result.inputHash,input.inputHash)
  assert.equal(result.resolved.jobType,category)
  assert.equal(result.resolved.experienceProfile.minimumYears,min)
  assert.equal(result.resolved.experienceProfile.maximumYears,max)
  assert.equal(result.reviewReasons.includes('qualification_branch_experience'),ambiguous)
  const applied=applyClassification({...job,classification:result})
  assert.equal(applied.sourceDescription,before.sourceDescription)
  assert.equal(applied.sourceExperienceRequired,before.sourceExperienceRequired)
  assert.deepEqual(applied.experienceYears,result.resolved.experienceYears)
})
