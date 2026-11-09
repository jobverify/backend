import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolvePostScrapeClassification,postScrapeInput} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'
const fixture=JSON.parse(readFileSync(new URL('./fixtures/classificationCompanyHistoryNativeExperience20261108.json',import.meta.url))),row=fixture.sourceRecord
const now=new Date('2026-11-07T12:00:00Z'),labels=['Full-time Experienced','Full-time Fresher','Contract']
const run=(job,modelLabel)=>resolvePostScrapeClassification(job,{modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel?.97:.01]))},{now,mode:'policy'})
for(const modelLabel of labels)test('complete own company-history native provenance/'+row.id+'/'+modelLabel,()=>{
 assert.equal(createHash('sha256').update(row.originalText).digest('hex'),'eafe8b606754c76b9682ce20a81c63e581f1d63a3f6e30005c6a7068828e75ec')
 const job={title:row.title,company:row.company,sourceDescription:row.originalText,...row.sourceFields},before=structuredClone(job),inputHash=postScrapeInput(job,{now}).inputHash,result=run(job,modelLabel)
 assert.deepEqual(job,before);assert.equal(result.inputHash,inputHash);assert.equal(result.resolved.jobType,'Full-time Experienced')
 assert.equal(result.resolved.employerExperienceProfile.minimumYears,1);assert.equal(result.resolved.employerExperienceProfile.maximumYears,null)
 assert.equal(result.resolved.experienceProfile.minimumYears,1);assert.doesNotMatch(result.resolved.experienceRequired,/\b11\b/)
 assert.ok(result.sourceEvidenceRepairs.some(repair=>repair.code==='company_history_experience_field_ignored'))
 const applied=applyClassification({...job,classification:result});assert.equal(applied.experienceProfile.minimumYears,1);assert.doesNotMatch(applied.experienceRequired,/\b11\b/);assert.equal(applied.sourceExperienceRequired,'11 years')
})
const cases=[
 ['explicit company subject','Company overview:\nOur company has 11 years of experience providing contact-center services.\nRequired qualifications:\nMinimum of 1 year of customer-service work experience.',1,true],
 ['independent native without a corporate copy','Required qualifications:\nMinimum of 1 year of customer-service work experience.',11,false],
 ['same quantity independently required','Company overview:\nOur company has 11 years of experience providing contact-center services.\nRequired qualifications:\nApplicants must have 11 years of professional experience.',11,false],
 ['candidate subject is own history','Required qualifications:\nApplicants must have 11 years of professional experience managing customer-service teams.',11,false],
 ['company-only native is not a public requirement','Company overview:\nOur company has 11 years of experience providing contact-center services.',null,true],
]
for(const[name,sourceDescription,minimum,repair]of cases)for(const modelLabel of labels)test('native company-history boundary/'+name+'/'+modelLabel,()=>{
 const job={title:'Customer Support Specialist',sourceEmploymentType:'Full-time',sourceDescription,sourceExperienceRequired:'11 years'},before=structuredClone(job),inputHash=postScrapeInput(job,{now}).inputHash,result=run(job,modelLabel)
 assert.deepEqual(job,before);assert.equal(result.inputHash,inputHash)
 assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
 assert.equal(Boolean(result.sourceEvidenceRepairs?.some(r=>r.code==='company_history_experience_field_ignored')),repair)
 const applied=applyClassification({...job,classification:result})
 if(repair){assert.doesNotMatch(applied.experienceRequired||'',/\b11\b/);if(minimum===null){assert.equal(applied.experienceRequired,null);assert.equal(applied.experienceProfile.minimumYears,null)}}
 else assert.equal(applied.experienceProfile.minimumYears,11)
 assert.equal(job.sourceExperienceRequired,'11 years')
})
