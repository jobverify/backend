import test from 'node:test'
import assert from 'node:assert/strict'
import {postScrapeInput,resolvePostScrapeClassification} from '../src/services/postScrapeClassification.js'
import {buildClassificationInput,resolveClassification} from '../src/services/jobClassificationPolicy.js'

const now=new Date('2026-11-07T12:00:00Z'),labels=['Full-time Experienced','Full-time Fresher','Contract']
const foreign="Bachelor's degree with 8 years of professional experience is required for the customers you screen"
const cases=[
  ['rejected degree route stays unresolved',"Required qualifications:\nMaster's degree without experience OR Bachelor's degree with 8 years of experience is not an accepted qualification route.",null,null,true],
  ['duration shared by customers and own applicants survives','Required qualifications:\n'+foreign+' and for all applicants to this role.',8,8,false],
  ['separate own history survives foreign degree condition','Required qualifications:\n4 years of professional experience.\nResponsibilities:\n'+foreign+'.',4,4,false],
  ['same-sentence independent own history survives foreign condition','Responsibilities:\n'+foreign+' and all applicants must have 3 years of professional experience.',3,3,false],
]
for(const[name,sourceDescription,min,max,ambiguous]of cases)for(const modelLabel of labels)test('degree rejection/shared subject/'+name+'/'+modelLabel,()=>{
  const job={title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription},before=structuredClone(job),inputHash=postScrapeInput(job,{now}).inputHash
  const r=resolvePostScrapeClassification(job,{modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(l=>[l,l===modelLabel ? .97 : .01]))},{now,mode:'policy'})
  assert.deepEqual(job,before);assert.equal(r.inputHash,inputHash)
  assert.equal(r.resolved.jobType,'Full-time Experienced')
  assert.equal(r.resolved.experienceProfile.minimumYears,min);assert.equal(r.resolved.experienceProfile.maximumYears,max)
  assert.equal(r.reviewReasons.includes('qualification_branch_experience'),ambiguous)
})
test('exclusively screened customer requirement supplies no own source history',()=>{
  const job={title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription:'Responsibilities:\n'+foreign+'.'},before=structuredClone(job)
  const hash=buildClassificationInput(job,{now}).inputHash,r=resolveClassification(job,null,{now,mode:'policy'})
  assert.deepEqual(job,before);assert.equal(r.inputHash,hash)
  assert.equal(r.resolved.jobType,'Unspecified')
  assert.equal(r.resolved.experienceProfile.minimumYears,null)
  assert.equal(r.resolved.experienceProfile.maximumYears,null)
  assert.deepEqual(r.resolved.experienceYears,[])
})
