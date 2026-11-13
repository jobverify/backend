import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { readCareers, readClient, readRole, makeJob } from './nativeModels.js'

const currentCareers = () => gunzipSync(fs.readFileSync(new URL('./fixtures/careers-20261113.html.gz', import.meta.url))).toString('utf8')

test('Unosecur reconciles repeated CMS filter locations with each visible native location tag', () => {
  const result = readCareers(currentCareers())
  assert.deepEqual(result.rows.map(row => [row.title, row.nativeLocationLabel]), [
    ['Head of Marketing', 'Berlin, Germany'],
    ['AI Engineer', 'Bangalore, India'],
    ['Software Development Engineer II', 'Bangalore, India'],
    ['Solutions Engineer (Sales)', 'Bangalore, India'],
    ['Finance Manager', 'Bangalore, India'],
  ])
})

test('Unosecur rejects conflicting duplicate native CMS locations', () => {
  const html = currentCareers().replace('fs-cmsfilter-field="location" class="hide-2">Berlin, Germany', 'fs-cmsfilter-field="location" class="hide-2">Bangalore, India')
  assert.throws(() => readCareers(html), /location/)
})

test('Unosecur rejects a corporate location visible label that contradicts its CMS fields', () => {
  const html = currentCareers().replace('fs-cmsfilter-field="teams" class="text-block-738">Berlin, Germany', 'fs-cmsfilter-field="teams" class="text-block-738">Bangalore, India')
  assert.throws(() => readCareers(html), /location/)
})

test('Unosecur qualifies the reviewed current declared client read and render contract', () => {
  const source = gunzipSync(fs.readFileSync(new URL('./fixtures/client-20261113.js.gz', import.meta.url))).toString('utf8')
  const url = fs.readFileSync(new URL('./fixtures/client-20261113.url.txt', import.meta.url), 'utf8')
  const client = readClient(source, url)
  assert.equal(client.bodySHA256, '8121c21c565097351e9ee508c1016485bc6835d398936b338c64ab8bb8ce7fab')
  assert.equal(client.apiBaseURL, 'https://app.reczee.com/api/v1')
  assert.equal(client.companyParameter, 'company_slug')
  assert.equal(client.payload, 'data.requisition')
  assert.equal(client.descriptionField, 'job_description')
  assert.equal(client.publicVisibilityField, 'open_for_careers_page')
  assert.equal(client.programExecuted, false)
  assert.throws(() => readClient(source.replace('requisitions/from-slug/', 'requisitions/from-other/'), url), /changed declared client/)
})

test('Unosecur preserves the explicitly unset native EEOC configuration without inferring eligibility', () => {
  const unpack = name => gunzipSync(fs.readFileSync(new URL('./fixtures/' + name, import.meta.url))).toString('utf8')
  const careers = readCareers(currentCareers()), row = careers.rows[0]
  const role = readRole(unpack('role-marketing-20261113.html.gz'), row)
  const client = readClient(unpack('client-20261113.js.gz'), fs.readFileSync(new URL('./fixtures/client-20261113.url.txt', import.meta.url), 'utf8'))
  const raw = unpack('role-marketing-api-20261113.json.gz')
  const job = makeJob(raw, row, role, careers, client, '2026-11-13T06:00:00.000Z')
  assert.equal(job.nativeApplicationRequirements.eeocQuestionsEnabled, null)
  assert.equal(job.country, null)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.activeApplyVerified, false)
  assert.ok(job.sourceDescription.length > 300)
  const invalid = JSON.parse(raw); invalid.data.eeoc_questions_enabled = 'false'
  assert.throws(() => makeJob(JSON.stringify(invalid), row, role, careers, client, '2026-11-13T06:00:00.000Z'), /application requirements/)
})
