import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolvePostScrapeClassification} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'

const fixture=JSON.parse(readFileSync(new URL('./fixtures/classificationExplicitEmploymentExperienceRange20261108.json',import.meta.url)))
const now=new Date('2026-11-07T12:00:00Z')
const labels=['Full-time Experienced','Full-time Fresher','Contract']
const prediction=modelLabel=>({modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel ? .97 : .01]))})
const classify=(job,label)=>resolvePostScrapeClassification(job,prediction(label),{now,mode:'policy'})

for(const row of fixture.cases)for(const label of labels){
  test('complete explicit employment/experience range/'+row.sourceRecord.id+'/'+label,()=>{
    assert.equal(createHash('sha256').update(row.sourceRecord.originalText).digest('hex'),row.sourceRecord.originalTextSha256)
    assert.equal(row.job.sourceDescription,row.sourceRecord.originalText)
    const before=structuredClone(row.job),result=classify(row.job,label)
    assert.deepEqual(row.job,before)
    assert.equal(result.resolved.jobType,row.expectedCategory)
    const minimum=row.expectedCategory==='Contract' ? 0 : 5
    const maximum=row.expectedCategory==='Contract' ? 2 : 15
    assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
    assert.equal(result.resolved.employerExperienceProfile.maximumYears,maximum)
    assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears,null)
    const applied=applyClassification({...row.job,classification:result})
    assert.equal(applied.jobType,row.expectedCategory)
    assert.equal(applied.sourceDescription,row.job.sourceDescription)
    assert.equal(applied.sourceEmploymentType,row.job.sourceEmploymentType)
    assert.equal(applied.sourceExperienceRequired,row.job.sourceExperienceRequired)
  })
}

const controls=[
  ['permanent contract remains permanent',{sourceEmploymentType:'Permanent contract',sourceDescription:'Required qualifications:\n5 years of professional experience.'},5,5,null],
  ['contractual duties do not establish own contract',{sourceEmploymentType:'Full-time',sourceDescription:'Responsibilities:\nManage contractual obligations with suppliers.\nRequired qualifications:\n5 years of professional experience.'},5,5,null],
  ['explicit preferred experience range stays optional',{sourceEmploymentType:'Full-time',sourceDescription:'Required qualifications:\n2 years of professional experience.\nPreferred experience range: 8-12 years of professional experience.'},2,2,8],
  ['experience range prose does not reset a preferred section',{sourceEmploymentType:'Full-time',sourceDescription:'Preferred qualifications:\nExperience range in this specialty: 5-15 years of professional experience.'},null,null,5],
]
for(const[name,fields,minimum,maximum,preferred]of controls)for(const label of labels){
  test('explicit employment/experience range boundary/'+name+'/'+label,()=>{
    const job={title:'Engineer',...fields},before=structuredClone(job),result=classify(job,label)
    assert.deepEqual(job,before)
    assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
    assert.equal(result.resolved.employerExperienceProfile.maximumYears,maximum)
    assert.equal(result.resolved.employerExperienceProfile.preferredMinimumYears,preferred)
    if(minimum!==null)assert.equal(result.resolved.jobType,'Full-time Experienced')
  })
}
