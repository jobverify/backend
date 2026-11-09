import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolvePostScrapeClassification} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'

const fixture=JSON.parse(readFileSync(new URL('./fixtures/classificationOwnContractualAppointment20261108.json',import.meta.url)))
const row=fixture.sourceRecord
const now=new Date('2026-11-07T12:00:00Z')
const labels=['Full-time Experienced','Full-time Fresher','Contract']
const prediction=modelLabel=>({modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel ? .97 : .01]))})
const classify=(job,label)=>resolvePostScrapeClassification(job,prediction(label),{now,mode:'policy'})
const job={title:row.title,company:row.company,source:row.source,sourceUrl:row.sourceUrl,applyUrl:row.applyUrl,sourceDescription:row.originalText,...row.sourceFields}

for(const label of labels)test('complete own contractual appointment/'+row.id+'/'+label,()=>{
  assert.equal(createHash('sha256').update(row.originalText).digest('hex'),'9fcefbde3d5eb1a0de9e5bbb2a75bc9e529fc5879e1104774e27905771850a95')
  assert.equal(row.originalTextSha256,'9fcefbde3d5eb1a0de9e5bbb2a75bc9e529fc5879e1104774e27905771850a95')
  const before=structuredClone(job),result=classify(job,label)
  assert.deepEqual(job,before)
  assert.equal(result.resolved.jobType,'Contract')
  assert.equal(result.resolved.employerExperienceProfile.minimumYears,null)
  assert.equal(result.resolved.employerExperienceProfile.maximumYears,null)
  assert.equal(applyClassification({...job,classification:result}).jobType,'Contract')
})

const required='Required qualifications:\n4 years of professional experience.\n'
const controls=[
  ['customer contractual duties',required+'Responsibilities:\nManage contractual positions and obligations with suppliers.','Full-time Experienced'],
  ['negated own appointment',required+'This is not a contractual position.','Full-time Experienced'],
  ['other vacancy scope',required+'Other vacancy:\nThis is a contractual position.\nCurrent vacancy:\nThis role is permanent.','Full-time Experienced'],
  ['withdrawn own statement',required+'This is a contractual position, but this statement has been withdrawn.','Full-time Experienced'],
  ['own appointment with unrelated negative',required+'This is a contractual position, with no relocation requirement.','Contract'],
  ['conditional selection into another vacancy',required+'This is a contractual position only if selected for another vacancy.','Full-time Experienced'],
]
for(const[name,sourceDescription,expected]of controls)for(const label of labels)test('own contractual appointment scope/'+name+'/'+label,()=>{
  const control={title:'Engineer',sourceDescription},before=structuredClone(control),result=classify(control,label)
  assert.deepEqual(control,before)
  assert.equal(result.resolved.jobType,expected)
  assert.equal(result.resolved.employerExperienceProfile.minimumYears,4)
  assert.equal(applyClassification({...control,classification:result}).jobType,expected)
})
