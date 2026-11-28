import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {CAREERS_URL, PROXY_URL, GRAPHQL_URL} from './native.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-prefix-20261128.json.gz',import.meta.url))))
for(const packet of capture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const official=capture.packets.find(p=>p.requestedUrl===CAREERS_URL)
const proxy=JSON.parse(capture.packets.find(p=>p.requestedUrl===PROXY_URL).body)
const original=JSON.parse(capture.packets.find(p=>p.requestedUrl===GRAPHQL_URL).body)
const rows=payload=>payload[0].data.oatsExternalJobPostings.jobPostings
const departments=payload=>payload[0].data.oatsExternalJobPostingsFilters.filter(f=>f.type==='DEPARTMENT')
const unassigned=payload=>rows(payload).find(row=>row.job.department===null)

async function attempt(mutate=()=>{}) {
  const payload=structuredClone(original)
  mutate(payload)
  const details=[]
  let error
  try { await run({now:()=>capture.completedAt,
    fetchPage:async url=>{assert.equal(url,CAREERS_URL);return{status:official.status,finalUrl:official.url,html:official.body}},
    fetchJson:async(url,init)=>{
      if(url===PROXY_URL)return structuredClone(proxy)
      assert.equal(url,GRAPHQL_URL)
      const [operation]=JSON.parse(init.body)
      assert.equal(operation.variables.boardId,'accellor')
      if(operation.operationName==='ExternalJobPosting') {
        details.push(operation.variables.extId)
        throw Error('CONTROLLED_UNCAPTURED_CURRENT_NATIVE_DETAIL '+operation.variables.extId)
      }
      assert.equal(operation.operationName,'JobBoardList')
      return structuredClone(payload)
    },
  }) } catch(caught) { error=caught }
  assert.ok(error,'The uncaptured remainder cannot establish a complete current inventory')
  return{error,details}
}

test('genuine current Accellor null department is an unassigned posting, not a truncated department partition',async()=>{
  assert.equal(rows(original).length,20)
  assert.equal(departments(original).reduce((sum,f)=>sum+f.count,0),19)
  assert.equal(rows(original).filter(row=>Object.hasOwn(row.job,'department')&&row.job.department===null).length,1)
  assert.equal(unassigned(original).title,'Salesforce BA')
  const result=await attempt()
  assert.match(result.error.message,/^CONTROLLED_UNCAPTURED_CURRENT_NATIVE_DETAIL /)
  assert.deepEqual(result.details,['am9icG9zdDoXMfRciKsZ1J6gCWm4aPfw'])
})

for(const[label,mutate]of[
  ['a missing department property',p=>{delete unassigned(p).job.department}],
  ['an empty department object',p=>{unassigned(p).job.department={}}],
  ['a foreign assigned department',p=>{rows(p)[0].job.department.extId='foreign-department'}],
  ['a contradictory department name',p=>{rows(p)[0].job.department.name='Other Department'}],
  ['an extra count concealing the unassigned posting',p=>{departments(p).find(f=>f.count>0).count++}],
  ['an omitted assigned-department filter',p=>{const filters=p[0].data.oatsExternalJobPostingsFilters;filters.splice(filters.findIndex(f=>f.type==='DEPARTMENT'&&f.rawValue===rows(p)[0].job.department.extId),1)}],
  ['a repeated department identity',p=>{p[0].data.oatsExternalJobPostingsFilters.push(structuredClone(departments(p).find(f=>f.count===0)))}],
  ['an invalid negative department count',p=>{departments(p)[0].count=-1}],
  ['a truncated native tail even when department counts reconcile',p=>{rows(p).splice(rows(p).indexOf(unassigned(p)),1)}],
  ['a duplicate native posting',p=>{rows(p).push(structuredClone(rows(p)[0]))}],
  ['an unknown native country',p=>{rows(p)[0].locations[0].isoCountry='ZZZ'}],
])test('Accellor still refuses '+label+' before any current native detail',async()=>{
  const result=await attempt(mutate)
  assert.ok(!result.error.message.startsWith('CONTROLLED_UNCAPTURED_CURRENT_NATIVE_DETAIL'),result.error.message)
  assert.deepEqual(result.details,[])
})
