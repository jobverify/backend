import test from 'node:test'
import assert from 'node:assert/strict'
import {resolvePostScrapeClassification,postScrapeInput} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'
const now=new Date('2026-11-07T12:00:00Z'),labels=['Full-time Experienced','Full-time Fresher','Contract']
const branch="Master's degree OR Bachelor's degree with 8 years of experience"
const cases=[
 ['same-clause universal',`Required qualifications:\n${branch}, and all applicants must have 8 years of professional experience.`,{},8,false],
 ['independent native universal',`Required qualifications:\n${branch}.`,{sourceExperienceRequired:'8 years'},8,false],
 ['preferred universal is optional',`Required qualifications:\n3 years of professional experience.\n${branch}.\nPreferred qualifications:\nAll applicants must have 8 years of professional experience.`,{},null,true],
 ['vendor applicant requirement is foreign',`Required qualifications:\n3 years of professional experience.\n${branch}.\nVendor applicants must have 8 years of professional experience.`,{},null,true],
]
for(const[name,sourceDescription,native,minimum,review]of cases)for(const modelLabel of labels)test('qualification universal boundary/'+name+'/'+modelLabel,()=>{
 const job={title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription,...native},before=structuredClone(job),inputHash=postScrapeInput(job,{now}).inputHash
 const result=resolvePostScrapeClassification(job,{modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel?.97:.01]))},{now,mode:'policy'})
 assert.deepEqual(job,before);assert.equal(result.inputHash,inputHash)
 assert.equal(result.resolved.jobType,'Full-time Experienced')
 assert.equal(result.reviewReasons.includes('qualification_branch_experience'),review)
 assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
 assert.equal(result.resolved.experienceProfile.minimumYears,minimum)
 const applied=applyClassification({...job,classification:result})
 assert.equal(applied.experienceProfile.minimumYears,minimum)
 if(review)assert.equal(applied.experienceRequired,null)
})
