import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {validateEnvelope,validateRow,validateDetail} from './nativeContract.js'
const f=JSON.parse(fs.readFileSync(new URL('./fixtures/native-20261020.json',import.meta.url))),now='2026-10-20T23:40:00Z'
test('actual public successful empty error object is validated before shared adapter normalization',()=>assert.ok(validateEnvelope(f.page).data))
test('four actual India rows and full details preserve exact native identity and geography',()=>{for(const row of f.indiaRows){assert.equal(validateRow(row,{now}).india,true);const d=validateDetail(f.details[row.id],row,{now});assert.equal(d.sourceDetailComplete,true);assert.ok(d.jobDescription.length>1000)}})
for(const [name,mutate]of [['error message',p=>p.error.message='Failure'],['bad status',p=>p.status=500],['array status',p=>p.status=[200]],['success false',p=>p.success=false],['fallback metadata',p=>p.metadata={isFallback:true}],['error array',p=>p.errors=['failure']],['conflicting status code',p=>p.statusCode=500]])test('rejects '+name,()=>{const p=structuredClone(f.page);mutate(p);assert.throws(()=>validateEnvelope(p))})
for(const [name,mutate]of [['array ID',p=>p.id=[p.id]],['wrong public URL',p=>p.positionUrl='/careers/job/123'],['future date',p=>p.postedTs=4102444800],['unknown location',p=>p.locations=['Global Remote']],['country contradiction',p=>p.standardizedLocations=['New York, NY, US']],['city contradiction',p=>p.standardizedLocations=['Seattle, WA, IN']],['secondary India unresolved',p=>p.locations[0]+=', India-Pune']])test('row rejects '+name,()=>{const p=structuredClone(f.indiaRows[0]);mutate(p);assert.throws(()=>validateRow(p,{now}))})
for(const [name,mutate]of [['wrong ID',p=>p.data.id++],['wrong title',p=>p.data.name='Other role'],['wrong employer URL',p=>p.data.publicUrl='https://other.eightfold.ai/careers/job/'+p.data.id],['forbidden application',p=>p.data.positionUserActions.applyAction.status='denied'],['conflicting locations',p=>p.data.locations=['Seattle, United States | N/A']]])test('detail rejects '+name,()=>{const row=f.indiaRows[0],p=structuredClone(f.details[row.id]);mutate(p);assert.throws(()=>validateDetail(p,row,{now}))})
test('hidden or placeholder-only source descriptions retain missing detail health',()=>{for(const text of ['<p>NA</p>','<div hidden>Build technology</div>','<script>Build software</script>']){const row=f.indiaRows[0],p=structuredClone(f.details[row.id]);p.data.jobDescription=text;assert.equal(validateDetail(p,row,{now}).sourceDetailComplete,false)}})
test('known native absent secondary marker does not invent an unresolved location',()=>{const row=structuredClone(f.foreignRows[0]);row.locations[0]='Arden Hills US-MN, United States | US-MN-Arden Hills, N/A';assert.equal(validateRow(row,{now}).india,false)})
test('native US state CA is corroborated by standardized state and country rather than treated as Canada',()=>{const row=structuredClone(f.foreignRows[0]);row.locations=['Modesto, CA, USA'];row.standardizedLocations=['Modesto, CA, US'];assert.equal(validateRow(row,{now}).india,false)})
test('native India state and comma city continuation must corroborate the primary and standardized city',()=>{
 const row=structuredClone(f.indiaRows[0]);row.locations=['Gurgaon, India | India-Haryana, Gurgaon'];row.standardizedLocations=['Gurugram, HR, IN']
 const scope=validateRow(row,{now});assert.equal(scope.india,true);assert.deepEqual(scope.indiaLocations,[{location:'Gurgaon, India',city:'Gurgaon'}])
 for(const [raw,standard]of[['Gurgaon, India | India-Haryana, Pune','Gurugram, HR, IN'],['Gurgaon, India | India-Haryana, Gurgaon','Gurugram, MH, IN'],['Gurgaon, India | India-Haryana, Gurgaon, Remote','Gurugram, HR, IN']]){
  assert.throws(()=>validateRow({...row,locations:[raw],standardizedLocations:[standard]},{now}))
 }
})
test('native named secondary Turkey remains a known foreign country',()=>{const row=structuredClone(f.foreignRows[0]);row.locations=['Dubai AE-DU, United Arab Emirates | Turkey-Istanbul, United Arab Emirates-Dubai'];row.standardizedLocations=['Dubai, Dubai, AE'];assert.equal(validateRow(row,{now}).india,false)})
test('unbounded composite location cannot be certified foreign by an appended country',()=>{for(const location of ['Global Remote, United States | N/A','Worldwide, United States | N/A']){const row=structuredClone(f.foreignRows[0]);row.locations=[location];assert.throws(()=>validateRow(row,{now}),/unbounded/i)}})

for(const[name,mutate]of[
 ['uppercase error',p=>{p.Error='Server failure'}],['uppercase success failure',p=>{p.Success=false}],['uppercase status failure',p=>{p.StatusCode=500}],
 ['fallback string',p=>{p.metadata={isFallback:'true'}}],['fallback number',p=>{p.metadata={isFallback:1}}],['fallback array',p=>{p.metadata={isFallback:[true]}}],
])test(`native envelope rejects ${name}`,()=>{const p=structuredClone(f.page);mutate(p);assert.throws(()=>validateEnvelope(p))})
