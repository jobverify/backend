import test from 'node:test'
import assert from 'node:assert/strict'
import {resolvePostScrapeClassification,postScrapeInput} from '../src/services/postScrapeClassification.js'
import {applyClassification} from '../src/services/jobClassificationPolicy.js'
const now=new Date('2026-11-07T12:00:00Z'),labels=['Full-time Experienced','Full-time Fresher','Contract']
for(const[native,category]of [
 ['Non-contractual permanent employment','Full-time Experienced'],
 ['Non contractual permanent employment','Full-time Experienced'],
 ['Not contractual, permanent employment','Full-time Experienced'],
 ['Contractual','Contract'],
 ['Non-permanent contractual employment','Contract'],
 ['Permanent contract','Full-time Experienced'],
])for(const modelLabel of labels)test('native contractual negation/'+native+'/'+modelLabel,()=>{
 const job={title:'Engineer',sourceEmploymentType:native,sourceDescription:'Required qualifications:\n4 years of professional experience.\n'},before=structuredClone(job),inputHash=postScrapeInput(job,{now}).inputHash
 const result=resolvePostScrapeClassification(job,{modelLabel,fullDescriptionCovered:true,windows:1,scores:Object.fromEntries([...labels,'Intern'].map(label=>[label,label===modelLabel?.97:.01]))},{now,mode:'policy'})
 assert.deepEqual(job,before);assert.equal(result.inputHash,inputHash)
 assert.equal(result.resolved.jobType,category);assert.equal(result.resolved.employerExperienceProfile.minimumYears,4)
 assert.equal(applyClassification({...job,classification:result}).jobType,category)
})
