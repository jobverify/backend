import test from 'node:test'
import assert from 'node:assert/strict'
import {resolvePostScrapeClassification,postScrapeInput} from '../src/services/postScrapeClassification.js'
import {collectRecruitmentFacts} from '../src/services/jobRecruitmentPolicy.js'

const labels=['Full-time Experienced','Full-time Fresher','Contract']
const now=new Date('2026-11-07T12:00:00Z')
const cases=[
  ['experience field within preferred qualifications','Preferred qualifications:\nExperience: 5-8 years of professional experience.',null,null,5],
  ['experience field within required qualifications','Required qualifications:\nExperience: 3-5 years of professional experience.',3,5,null],
  ['separate required experience ends preferred qualifications','Preferred qualifications:\nExperience: 5-8 years of professional experience.\nRequired experience:\n2-4 years of professional experience.',2,4,5],
]
for(const[name,sourceDescription,minimum,maximum,preferred]of cases)for(const modelLabel of labels)test('preferred qualification experience label/'+name+'/'+modelLabel,()=>{
  const job={title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription},before=structuredClone(job)
  const prediction={modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel ? .97 : .01]))}
  const result=resolvePostScrapeClassification(job,prediction,{now,mode:'policy'})
  assert.deepEqual(job,before)
  assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
  assert.equal(result.resolved.employerExperienceProfile.maximumYears,maximum)
  assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears,preferred)
  if(minimum===null){
    const facts=collectRecruitmentFacts(postScrapeInput(job,{now}))
    assert.equal(Boolean(facts.requiredProfessionalExperience),false)
    assert.equal(Boolean(facts.requiredPriorHistory),false)
  }else assert.equal(result.resolved.jobType,'Full-time Experienced')
})
