import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog,createCatalogScraper } from '../providers/index.js'
import { nativeOptions } from '../../scraper/ola/fixtures/options.js'
import { syntheticRole } from '../../scraper/ola/fixtures/syntheticRole.js'
import { FILTERED_JOBS_URL,jobURL,publicJobURL } from '../../scraper/ola/nativeContract.js'

const now='2026-10-26T22:30:00.000Z'
test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Review regression attempted network')}))

async function registeredRole({source='ola',mutate=()=>{}}={}) {
  const role=syntheticRole(source)
  role.row.JobTypeV2=role.dto.JobTypeV2='FullTime'
  role.row.Type=role.dto.Type='FTE'
  role.posting.employmentType='FULL_TIME'
  mutate(role)
  const requests=[],options=nativeOptions({source,requests,mutate:({url,response})=>{
    if(url===FILTERED_JOBS_URL)return{body:JSON.stringify({Total:1,Result:[role.row]}),contentType:'application/json'}
    if(url===jobURL(role.row.JobId))return{body:role.render(),contentType:'text/html'}
    if(url===publicJobURL(role.row.JobId))return{body:JSON.stringify(role.dto),contentType:'application/json'}
    return response
  }})
  let evidence
  const jobs=await createCatalogScraper(getScraperCatalog().find(p=>p.source===source)).run({...options,now,onEvidence:e=>{evidence=e}})
  assert.equal(requests.filter(r=>r.url===FILTERED_JOBS_URL).length,2)
  assert.equal(requests.filter(r=>r.url===publicJobURL(role.row.JobId)).length,2)
  return {role,jobs,evidence}
}
const excluded=result=>{
  assert.equal(result.jobs.length,0)
  assert.equal(result.evidence.nativeBoardIdentityComplete,true)
  assert.equal(result.evidence.nativeBoardComplete,false)
  assert.equal(result.evidence.unresolvedRecords,1)
  assert.equal(result.evidence.sourceScopeComplete,false)
  assert.equal(result.evidence.lifecycleCleanupAllowed,false)
}

test('registered coherent public role remains healthy before reviewing extra structured criteria',async()=>{
  const {jobs,evidence}=await registeredRole()
  assert.equal(jobs.length,1);assert.equal(jobs[0].employmentType,'FullTime')
  assert.equal(evidence.healthyGlobalRecords,1);assert.equal(evidence.nativeBoardComplete,true)
})
test('registered Ola Electric preserves supported schema qualification and education text verbatim',async()=>{
  const qualifications='At least three years building production APIs.',education='<p>Bachelor of Engineering or equivalent professional experience.</p>'
  const {jobs}=await registeredRole({source:'olaelectric',mutate:s=>{s.posting.qualifications=qualifications;s.posting.educationRequirements=education}})
  assert.equal(jobs.length,1)
  assert.deepEqual(jobs[0].nativeStructuredCriteria,{qualifications,educationRequirements:education})
  for(const value of [qualifications,education]){
    assert.ok(jobs[0].jobDescription.includes(value))
    assert.ok(jobs[0].sourceDescription.includes(value))
  }
  assert.ok(jobs[0].minimumQualification.includes(qualifications))
  assert.ok(jobs[0].minimumQualification.includes(education))
})
test('registered supported schema qualification string arrays preserve every criterion',async()=>{
  const qualifications=['Production JavaScript experience','Strong distributed systems knowledge']
  const {jobs}=await registeredRole({mutate:s=>{s.posting.qualifications=qualifications}})
  assert.equal(jobs.length,1);assert.deepEqual(jobs[0].nativeStructuredCriteria.qualifications,qualifications)
  for(const value of qualifications)assert.ok(jobs[0].sourceDescription.includes(value))
})
for(const [key,value]of [
  ['qualifications',{degree:'Unsupported structured qualification'}],
  ['educationRequirements',{'@type':'EducationalOccupationalCredential',credentialCategory:'degree'}],
  ['qualifications',42],
  ['experienceRequirements',{'@type':'OccupationalExperienceRequirements',monthsOfExperience:72}],
])test('registered unsupported schema criterion remains partial: '+key+' '+JSON.stringify(value),async()=>{
  excluded(await registeredRole({mutate:s=>{s.posting[key]=value}}))
})
test('registered schema employment type must agree with the DTO and listing FullTime type',async()=>{
  excluded(await registeredRole({mutate:s=>{s.posting.employmentType='PART_TIME'}}))
})
test('registered schema employment type also reconciles the legacy native Type',async()=>{
  excluded(await registeredRole({mutate:s=>{s.row.Type=s.dto.Type='PTE'}}))
})
test('registered unreviewed multiple schema employment types remain partial',async()=>{
  excluded(await registeredRole({mutate:s=>{s.posting.employmentType=['FULL_TIME','PART_TIME']}}))
})
for(const hidden of [
  '<div hidden>HIDDEN CRITERION</div>',
  '<template>INERT CRITERION</template>',
  '<div inert>INERT CRITERION</div>',
  '<div style="display:none">HIDDEN CRITERION</div>',
  '<div style="opacity:0">HIDDEN CRITERION</div>',
  '<!-- HIDDEN CRITERION -->',
])test('registered mixed visible/inactive full section cannot publish raw inactive criteria: '+hidden,async()=>{
  excluded(await registeredRole({mutate:s=>{s.dto.EligibilityV2='<p>Visible eligibility.</p>'+hidden;s.posting.description=s.dto.JobDescriptionV2+'\n'+s.dto.EligibilityV2}}))
})
test('registered schema-only hidden description content cannot silently claim complete criteria',async()=>{
  excluded(await registeredRole({mutate:s=>{s.posting.description+='<div hidden>HIDDEN SCHEMA CRITERION</div>'}}))
})
test('registered supported structured criteria cannot publish hidden HTML',async()=>{
  excluded(await registeredRole({mutate:s=>{s.posting.qualifications='<p>Visible qualification.</p><div hidden>HIDDEN SCHEMA CRITERION</div>'}}))
})

for(const [name,value]of [['empty expiry map',{}],['explicit null expiry',{CAREERPAGE:null}],['null expiry map',null],['absent expiry map',undefined]])test('registered valid no-expiry role stays healthy: '+name,async()=>{
  const {jobs,evidence}=await registeredRole({mutate:s=>{s.row.ExpiryDates=s.dto.ExpiryDates=value;delete s.posting.validThrough}})
  assert.equal(jobs.length,1);assert.equal(evidence.healthyGlobalRecords,1);assert.equal(evidence.nativeBoardComplete,true)
  assert.equal(jobs[0].closingDate,null);assert.equal(jobs[0].nativeExpiryRaw,null);assert.equal(jobs[0].nativeExpiryPrecision,null)
  assert.equal(jobs[0].sourceClosingDateIsExact,false);assert.equal(jobs[0].sourceAvailabilityVerified,true)
})
test('registered missing DTO expiry cannot contradict a supplied schema validThrough',async()=>{
  excluded(await registeredRole({mutate:s=>{s.row.ExpiryDates=s.dto.ExpiryDates={}}}))
})
test('registered supplied native expiry stays authoritative when optional schema expiry is absent',async()=>{
  const {jobs}=await registeredRole({mutate:s=>{delete s.posting.validThrough}})
  assert.equal(jobs.length,1);assert.equal(jobs[0].closingDate,'2026-11-20')
})
for(const [name,value,schema]of [
  ['past expiry','2026-10-25T00:00:00','2026-10-25'],
  ['ambiguous expiry-day boundary','2026-10-26T00:00:00','2026-10-26'],
  ['contradictory schema expiry','2026-11-20T00:00:00','2026-12-20'],
])test('registered supplied expiry keeps '+name+' guard',async()=>{
  excluded(await registeredRole({mutate:s=>{s.row.ExpiryDates=s.dto.ExpiryDates={CAREERPAGE:value};s.posting.validThrough=schema}}))
})

const inactiveReviewVariants=[
  ['unquoted opacity','<div style=opacity:0>HIDDEN_CRITERION</div>'],
  ['leading CSS comment','<div style="opacity:/**/0">HIDDEN_CRITERION</div>'],
  ['trailing CSS comment','<div style="opacity:0/*x*/">HIDDEN_CRITERION</div>'],
  ['numeric HTML opacity value','<div style="opacity:&#48;">HIDDEN_CRITERION</div>'],
  ['numeric HTML property and value','<div style="opac&#105;ty:&#x30;">HIDDEN_CRITERION</div>'],
  ['non-rendering raw title','<title>HIDDEN_CRITERION</title>'],
]
for(const [name,markup]of inactiveReviewVariants)for(const field of ['DTO eligibility','schema description','schema qualifications'])test('registered parsed visibility rejects '+name+' in '+field,async()=>{
  excluded(await registeredRole({mutate:s=>{
    const visible='<p>Visible eligibility.</p>'
    if(field==='DTO eligibility'){s.dto.EligibilityV2=visible+markup;s.posting.description=s.dto.JobDescriptionV2+'\n'+s.dto.EligibilityV2}
    else if(field==='schema description'){s.dto.EligibilityV2=visible;s.posting.description=s.dto.JobDescriptionV2+'\n'+visible+markup}
    else s.posting.qualifications=visible+markup
  }}))
})
test('registered parsed opacity keeps a coherent visible eligibility control healthy',async()=>{
  const {jobs,evidence}=await registeredRole({mutate:s=>{s.dto.EligibilityV2='<p>Visible eligibility.</p><div style=opacity:1>VISIBLE_CRITERION</div>';s.posting.description=s.dto.JobDescriptionV2+'\n'+s.dto.EligibilityV2}})
  assert.equal(jobs.length,1);assert.equal(evidence.nativeBoardComplete,true)
  assert.ok(jobs[0].sourceDescription.includes('VISIBLE_CRITERION'))
})
