import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { reconcileOfficeScope } from './officeScope.js'

// Separate real observations compose an offline protocol fixture. They are
// not an atomic live inventory; production must collect its own closing proof.
const native = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/current-native-20261101.json.gz', import.meta.url))))
const officeCapture = JSON.parse(gunzipSync(readFileSync(new URL('./native-captures/offices-20261101.json.gz', import.meta.url))))
const originalOffices = JSON.parse(Buffer.from(officeCapture.rawBodyBase64, 'base64').toString('utf8'))
const inputs = () => ({ payload: structuredClone(native.audit.openingPayload), offices: structuredClone(originalOffices) })
const briefKeys = ['absolute_url', 'data_compliance', 'internal_job_id', 'location', 'metadata', 'id', 'updated_at',
  'requisition_id', 'title', 'company_name', 'first_published', 'language', 'application_deadline']
const removeMembership = (offices, id) => { for (const office of offices.offices) for (const department of office.departments) department.jobs = department.jobs.filter(job => job.id !== id) }
const futureIndia = () => {
  const data = inputs(), row = data.payload.jobs[0]
  const india = data.offices.offices.find(office => office.name === 'India, Remote')
  row.location = { name: 'Bengaluru, India' }
  row.offices = [{ id: india.id, name: india.name, location: india.location, parent_id: india.parent_id, child_ids: india.child_ids }]
  removeMembership(data.offices, row.id)
  const department = india.departments.find(item => item.id === row.departments[0].id)
  assert.ok(department)
  department.jobs.push(Object.fromEntries(briefKeys.map(key => [key, structuredClone(row[key])])))
  return data
}

test('current native office forest and every published role assignment prove the 16-role India exclusion', () => {
  const data = inputs(), before = structuredClone(data), proof = reconcileOfficeScope(data.payload, data.offices)
  assert.equal(proof.complete, true)
  assert.deepEqual(proof.reasons, [])
  assert.equal(proof.observedNativeRoles, 16)
  assert.equal(proof.observedOfficeRows, 105)
  assert.equal(proof.officePublishedRoleIds.length, 16)
  assert.deepEqual(proof.indiaRoleIds, [])
  assert.deepEqual(data, before, 'country proof never rewrites original geography or native criteria')
})

test('a future explicitly native India role is preserved without interpreting a city dictionary', () => {
  const data = futureIndia(), proof = reconcileOfficeScope(data.payload, data.offices)
  assert.equal(proof.complete, true)
  assert.deepEqual(proof.indiaRoleIds, [String(data.payload.jobs[0].id)])
  assert.equal(proof.roles.find(role => role.jobId === String(data.payload.jobs[0].id)).india, true)
})

for (const [label, alter] of [
  ['missing referenced office', d => { d.offices.offices = d.offices.offices.filter(office => office.id !== d.payload.jobs[1].offices[0].id) }],
  ['duplicate office identity', d => { d.offices.offices.push(structuredClone(d.offices.offices[0])) }],
  ['missing parent/child reciprocity', d => { d.offices.offices.find(office => office.name === 'Americas').child_ids.pop() }],
  ['changed office country', d => { d.offices.offices.find(office => office.name === 'United States, Remote').name = 'India, Remote' }],
  ['unknown office country field', d => { d.offices.offices[0].countryEligibility = ['India'] }],
  ['non-array office children', d => { d.offices.offices[0].child_ids = {} }],
  ['office job membership changed', d => { removeMembership(d.offices, d.payload.jobs[1].id) }],
  ['office role criteria metadata changed', d => { for (const office of d.offices.offices) for (const dept of office.departments) for (const row of dept.jobs) if (row.id === d.payload.jobs[1].id) row.title += ' changed' }],
  ['upstream reported count changed', d => { d.payload.meta.total++ }],
  ['new native pagination', d => { d.payload.hasMore = true }],
  ['unknown geographic field', d => { d.payload.jobs[1].locations = ['Worldwide'] }],
]) test(label + ' leaves valid India positives but cannot certify full scope', () => {
  const data = futureIndia(); alter(data)
  const proof = reconcileOfficeScope(data.payload, data.offices)
  assert.equal(proof.complete, false)
  assert.ok(proof.reasons.length)
  assert.ok(proof.indiaRoleIds.includes(String(data.payload.jobs[0].id)))
})

test('a broad office that newly includes India cannot establish foreign-only role eligibility', () => {
  const data = inputs(), region = data.offices.offices.find(office => office.name === 'Europe, Middle East, and Africa')
  const india = data.offices.offices.find(office => office.name === 'India, Remote')
  data.offices.offices.find(office => office.id === india.parent_id).child_ids = data.offices.offices.find(office => office.id === india.parent_id).child_ids.filter(id => id !== india.id)
  india.parent_id = region.id; region.child_ids.push(india.id)
  const row = data.payload.jobs.find(job => job.offices.some(office => office.id === region.id))
  row.offices[0].child_ids = [...region.child_ids]
  const proof = reconcileOfficeScope(data.payload, data.offices)
  assert.equal(proof.complete, false)
  assert.deepEqual(proof.indiaRoleIds, [], 'a regional parent including India is not an explicit role-level India worksite')
})

test('unqualified Remote and bare Indian city names do not become certified India roles', () => {
  for (const location of ['Remote', 'Bengaluru']) {
    const data = inputs(), row = data.payload.jobs[0]
    row.location = { name: location }
    for (const office of data.offices.offices) for (const dept of office.departments) for (const brief of dept.jobs) if (brief.id === row.id) brief.location = { name: location }
    const proof = reconcileOfficeScope(data.payload, data.offices)
    assert.equal(proof.complete, false)
    assert.deepEqual(proof.indiaRoleIds, [])
  }
})

test('a global empty response cannot conceal roles still present in the office protocol', () => {
  const data = inputs(), proof = reconcileOfficeScope({ jobs: [], meta: { total: 0 } }, data.offices)
  assert.equal(proof.complete, false)
})

test('matching globally empty public protocols can prove an empty native inventory', () => {
  const data = inputs()
  for (const office of data.offices.offices) for (const dept of office.departments) dept.jobs = []
  const proof = reconcileOfficeScope({ jobs: [], meta: { total: 0 } }, data.offices)
  assert.equal(proof.complete, true)
  assert.deepEqual(proof.indiaRoleIds, [])
})
