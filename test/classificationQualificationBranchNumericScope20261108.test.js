import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolvePostScrapeClassification,postScrapeInput} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'

const fixture=JSON.parse(readFileSync(new URL('./fixtures/classificationQualificationBranchNumericScope20261108.json',import.meta.url)))
const row=fixture.sourceRecord,now=new Date('2026-11-07T12:00:00Z')
const labels=['Full-time Experienced','Full-time Fresher','Contract']
const classify=(job,modelLabel)=>resolvePostScrapeClassification(job,{modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel ? .97 : .01]))},{now,mode:'policy'})
for(const label of labels)test('complete qualification-branch numeric scope/'+row.id+'/'+label,()=>{
  assert.equal(createHash('sha256').update(row.originalText).digest('hex'),'a90adf995202d7a244d73a855c44d1c386508a948a1525eedcdef00df438a01f')
  const job={title:row.title,company:row.company,sourceDescription:row.originalText,...row.sourceFields},before=structuredClone(job),inputHash=postScrapeInput(job,{now}).inputHash
  const result=classify(job,label)
  assert.deepEqual(job,before)
  assert.equal(result.inputHash,inputHash)
  assert.equal(result.resolved.jobType,'Full-time Experienced')
  assert.equal(result.status,'uncertain')
  assert.ok(result.reviewReasons.includes('qualification_branch_experience'))
  assert.equal(result.resolved.employerExperienceProfile.minimumYears,null)
  assert.equal(result.resolved.employerExperienceProfile.maximumYears,null)
  assert.deepEqual(result.resolved.experienceYears,[])
  assert.equal(result.resolved.experienceRequired,null)
  const applied=applyClassification({...job,classification:result})
  assert.deepEqual(applied.experienceYears,[])
  assert.equal(applied.experienceRequired,null)
})
const cases=[
  ['single bachelor route','Required qualifications:\nBachelor’s degree with 8 years of professional experience.',8,null],
  ['separate degree and required work','Education:\nMaster’s degree.\nRequired experience:\n8 years of professional experience.',8,null],
  ['preferred education alternative','Required qualifications:\n3 years of professional experience.\nPreferred qualifications:\nMaster’s degree\nOR\nBachelor’s degree with 8 years of experience.',3,8],
  ['independent universal floor matches branch','Required qualifications:\nMaster’s degree\nOR\nBachelor’s degree with 8 years of experience.\nAll candidates must have 8 years of professional experience.',8,null],
]
for(const[name,sourceDescription,minimum,preferred]of cases)for(const label of labels)test('qualification-branch numeric boundary/'+name+'/'+label,()=>{
  const job={title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription},before=structuredClone(job),result=classify(job,label)
  assert.deepEqual(job,before)
  assert.equal(result.reviewReasons.includes('qualification_branch_experience'),false)
  assert.equal(result.resolved.jobType,'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
  assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears,preferred)
})
