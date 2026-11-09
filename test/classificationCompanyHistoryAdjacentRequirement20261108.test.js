import test from 'node:test'
import assert from 'node:assert/strict'
import {resolvePostScrapeClassification,postScrapeInput} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'
const now=new Date('2026-11-07T12:00:00Z'),labels=['Full-time Experienced','Full-time Fresher','Contract']
const cases=[
 ['semicolon own requirement','Our company has 11 years of experience; this role requires 3 years of professional experience.',3],
 ['comma own requirement','Our company has 11 years of experience, while this role requires 3 years of professional experience.',3],
 ['same quantity applicant requirement','Our company has 11 years of experience; applicants must have 11 years of professional experience.',11],
 ['same quantity role requirement','Our company has 11 years of experience, while this role requires 11 years of professional experience.',11],
]
for(const[name,body,minimum]of cases)for(const modelLabel of labels)test('company history retains adjacent own requirement/'+name+'/'+modelLabel,()=>{
 const job={title:'Support Specialist',sourceEmploymentType:'Full-time',sourceExperienceRequired:'11 years',sourceDescription:'Company overview:\n'+body},before=structuredClone(job),inputHash=postScrapeInput(job,{now}).inputHash
 const result=resolvePostScrapeClassification(job,{modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel?.97:.01]))},{now,mode:'policy'})
 assert.deepEqual(job,before);assert.equal(result.inputHash,inputHash)
 assert.equal(result.resolved.jobType,'Full-time Experienced');assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
 assert.equal(result.resolved.experienceProfile.minimumYears,minimum)
 const applied=applyClassification({...job,classification:result});assert.equal(applied.experienceProfile.minimumYears,minimum);assert.equal(applied.sourceExperienceRequired,'11 years')
})
