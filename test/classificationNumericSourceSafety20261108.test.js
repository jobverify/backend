import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolvePostScrapeClassification} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'

const fixture=JSON.parse(readFileSync(new URL('./fixtures/classificationNumericSourceSafety20261108.json',import.meta.url)))
const now=new Date('2026-11-07T12:00:00Z')
const labels=['Full-time Experienced','Full-time Fresher']
const prediction=modelLabel=>({modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern','Contract'].map(label=>[label,label===modelLabel ? .97 : .01]))})
const classify=(job,label)=>resolvePostScrapeClassification(job,prediction(label),{now,mode:'policy'})
const checkWithheld=(result,code)=>{
 assert.equal(result.resolved.jobType,'Full-time Experienced')
 assert.equal(result.status,'uncertain')
 assert(result.reviewReasons.includes(code))
 assert(result.sourceQualityIssues.includes(code))
 assert(result.numericSourceIssues.some(issue=>issue.code===code))
 assert.deepEqual(result.resolved.experienceYears,[])
 assert.equal(result.resolved.experienceBucket,'unspecified')
 assert.equal(result.resolved.experienceRequired,null)
 assert.equal(result.resolved.experienceBasis,'unspecified')
 for(const name of ['experienceProfile','employerExperienceProfile']){
  assert.equal(result.resolved[name].minimumYears,null)
  assert.equal(result.resolved[name].maximumYears,null)
 }
}

for(const row of fixture.cases)for(const label of labels){
 test('complete numeric source safety/'+row.sourceRecord.id+'/'+label,()=>{
  assert.equal(createHash('sha256').update(row.sourceRecord.originalText).digest('hex'),row.sourceRecord.originalTextSha256)
  assert.equal(row.job.sourceDescription,row.sourceRecord.originalText)
  const before=structuredClone(row.job),result=classify(row.job,label)
  assert.deepEqual(row.job,before)
  assert.equal(result.resolved.jobType,row.expectedCategory)
  if(row.expectedNumericIssue)checkWithheld(result,row.expectedNumericIssue)
  else{
   assert.equal(result.resolved.experienceProfile.minimumYears,5)
   assert.equal(result.resolved.experienceProfile.maximumYears,10)
   assert.equal(result.resolved.experienceProfile.isOpenEnded,false)
   assert.equal(result.resolved.employerExperienceProfile.minimumYears,5)
   assert.equal(result.resolved.employerExperienceProfile.maximumYears,10)
   assert.deepEqual(result.resolved.experienceYears,[5,6,7,8,9,10])
   assert.equal(result.resolved.experienceRequired,'5-10 years')
   assert(!result.reviewReasons.includes('conflicting_experience_ranges'))
  }
 })
}

const controls=[
 ['valid overall upper-open range and managerial subset','Required qualifications:\n10-15+ years of overall professional experience.\nMinimum 5 years in a managerial leadership position.',10,null],
 ['preferred fragmented number is not a required ambiguity','Required qualifications:\n10+ years of professional experience.\nPreferred qualifications:\n1 2 + years of software engineering experience.',10,null],
 ['company biography is not an applicant quantity','About our company:\nWe have 1 2 + years of professional experience.\nRequired qualifications:\n5 years of professional experience.',5,5],
 ['overlapping overall and unscoped ranges are not disjoint','Required qualifications:\n9-12+ years of overall IT experience.\n10-15 Years',9,null],
 ['scoped specialty range is not a competing overall field','Required qualifications:\n9-12+ years of overall IT experience.\nJava skills: 4-7 Years',9,null],
 ['ordinary complete closed interval stays intact','Required qualifications:\n3-5 years of professional experience.',3,5],
]
for(const[name,description,minimum,maximum]of controls)for(const label of labels){
 test('numeric source scope boundary/'+name+'/'+label,()=>{
  const result=classify({title:'Engineer',sourceEmploymentType:'Full-time',sourceDescription:description},label)
  assert.equal(result.resolved.jobType,'Full-time Experienced')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears,minimum)
  assert.equal(result.resolved.employerExperienceProfile.maximumYears,maximum)
  assert(!result.reviewReasons.includes('fragmented_experience_number'))
  assert(!result.reviewReasons.includes('conflicting_experience_ranges'))
 })
}

for(const row of fixture.cases.filter(row=>row.expectedNumericIssue))for(const label of labels){
 test('ambiguous native years cannot reappear through public fallback/'+row.sourceRecord.id+'/'+label,()=>{
  const job={...row.job,sourceExperienceRequired:row.expectedNumericIssue==='fragmented_experience_number'?'2+ years':'4-7 years'}
  const before=structuredClone(job),result=classify(job,label)
  checkWithheld(result,row.expectedNumericIssue)
  const applied=applyClassification({...job,classification:result})
  assert.equal(applied.jobType,'Full-time Experienced')
  assert.equal(applied.experienceRequired,null)
  assert.deepEqual(applied.experienceYears,[])
  assert.equal(applied.sourceExperienceRequired,job.sourceExperienceRequired)
  assert.equal(applied.sourceDescription,job.sourceDescription)
  assert.deepEqual(job,before)
 })
}
