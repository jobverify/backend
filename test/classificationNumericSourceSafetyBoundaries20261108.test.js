import test from 'node:test'
import assert from 'node:assert/strict'
import {resolvePostScrapeClassification} from '../src/services/postScrapeClassification.js'
import {postScrapeInput} from '../src/services/postScrapeClassification.js'

const labels=['Full-time Experienced','Full-time Fresher']
const now=new Date('2026-11-07T12:00:00Z')
const prediction=modelLabel=>({modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern','Contract'].map(label=>[label,label===modelLabel ? .97 : .01]))})
const controls=[
 {name:'supplier history after duties does not erase required applicant years',description:'Required qualifications:\nApplicants must have 5 years of professional experience.\nResponsibilities:\nVerify that suppliers have 1 2 + years of professional experience.',minimum:5,maximum:5,code:null},
 {name:'required experience heading preserves unresolved own number',description:'Required experience:\n1 2 + years of software engineering experience.\n3-6+ years of experience managing engineering teams.',minimum:null,maximum:null,code:'fragmented_experience_number'},
 {name:'EEO footer does not hide conflicting own closing range',description:'Required qualifications:\n9-12+ years of overall IT experience.\n4-7 Years.\nWe are an equal opportunity employer.',minimum:null,maximum:null,code:'conflicting_experience_ranges'},
]
for(const control of controls)for(const modelLabel of labels)test('numeric source ownership and footer/'+control.name+'/'+modelLabel,()=>{
 const job={title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription:control.description},before=structuredClone(job)
 const input=postScrapeInput(job,{now}),result=resolvePostScrapeClassification(job,prediction(modelLabel),{now,mode:'policy'})
 assert.deepEqual(job,before)
 assert.equal(postScrapeInput(job,{now}).inputHash,input.inputHash)
 assert.equal(result.resolved.jobType,'Full-time Experienced')
 assert.equal(result.resolved.experienceProfile.minimumYears,control.minimum)
 assert.equal(result.resolved.experienceProfile.maximumYears,control.maximum)
 assert.equal(result.resolved.employerExperienceProfile.minimumYears,control.minimum)
 assert.equal(result.resolved.employerExperienceProfile.maximumYears,control.maximum)
 if(control.code){
  assert(result.numericSourceIssues.some(issue=>issue.code===control.code))
  assert(result.reviewReasons.includes(control.code))
  assert(result.sourceQualityIssues.includes(control.code))
  assert.equal(result.status,'uncertain')
  assert.deepEqual(result.resolved.experienceYears,[])
  assert.equal(result.resolved.experienceRequired,null)
 }else{
  assert(!result.numericSourceIssues?.length)
  assert(!result.reviewReasons.includes('fragmented_experience_number'))
 }
})
