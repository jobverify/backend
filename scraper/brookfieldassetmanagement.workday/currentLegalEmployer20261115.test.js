import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { run } from './script.js'
import { readNativeDocument } from '../../scraper-support/utils/activeNativeHtml.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const fixture = () => JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz', import.meta.url))))
function replay(data, transform = (_url, body) => body) {
  const reads = new Map()
  return { reads, options: { now: () => new Date().toISOString(), fetchImpl: async (input, init = {}) => {
    const url = String(input), count = (reads.get(url) || 0) + 1
    reads.set(url, count)
    let packet
    if (url.endsWith('/wday/cxs/brookfield/brookfield/jobs')) {
      const query = JSON.parse(init.body)
      assert.equal(query.offset, 0)
      const india = Object.keys(query.appliedFacets).length > 0
      packet = data.responses.find(row => row.requestedUrl === url && JSON.parse(row.body).total === (india ? 5 : 144))
    } else packet = data.responses.find(row => row.requestedUrl === url)
    assert.ok(packet, 'Only the current corporate-declared native URLs may be read: ' + url)
    const body = transform(url, packet.body, count, init)
    const response = new Response(body, { status: packet.status, headers: { 'Content-Type': packet.headers['content-type'] } })
    Object.defineProperty(response, 'url', { value: packet.url })
    return response
  } } }
}

test('Brookfield retains exact reviewed native legal-employer India roles after fresh full closing checks', async () => {
  const data = fixture(), { reads, options } = replay(data)
  const jobs = await run(options)
  assert.equal(jobs.length, 5)
  for (const job of jobs) {
    assert.equal(job.company, 'Brookfield Asset Management')
    assert.equal(job.nativeHiringOrganization.name, 'Brooksolutions Global Services Pvt Ltd')
    assert.equal(job.nativeLegalEmployer, 'Brooksolutions Global Services Pvt Ltd')
    assert.equal(job.country, 'India')
    assert.equal(job.nativeSourceRecord.jobPostingInfo.country.descriptor, 'India')
    assert.equal(job.nativeSourceRecord.jobPostingInfo.jobRequisitionLocation.country.descriptor, 'India')
    assert.equal(job.jobDescription, job.nativeSourceRecord.jobPostingInfo.jobDescription)
    assert.deepEqual(job.nativeSourceRecord, job.nativeClosingSourceRecord)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
    assert.equal(job.sourceOfficialBinding.currentHandoffRechecked, true)
    assert.equal(job.sourceNativeClosingContext.eachFullRoleRechecked, true)
    assert.equal(job.nativeLegalEmployerRelationshipEvidence.documentSha256, data.primary.receipt.sha256)
    const native = data.responses.find(row => row.requestedUrl.includes('/wday/cxs/')
      && row.requestedUrl.includes('/job/') && JSON.parse(row.body).jobPostingInfo.jobReqId === job.requisitionId)
    assert.equal(reads.get(native.requestedUrl), 2)
  }
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(reads.get('https://www.brookfield.com/careers/career-opportunities'), 2)
  assert.equal(reads.get('https://brookfield.wd5.myworkdayjobs.com/wday/cxs/brookfield/brookfield/jobs'), 3)
  const assessment = assessSoftFailureAcquisition({ source: 'brookfieldassetmanagement', zeroResultPolicy: 'evidence-required' }, jobs)
  assert.equal(assessment.runnerOutcome.success, true)
  assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
})

test('the reviewed legal employer is present in the issuer-filed consolidated subsidiary list', () => {
  const data = fixture(), { receipt, body } = data.primary
  assert.equal(receipt.status, 200)
  assert.equal(receipt.url, 'https://www.sec.gov/Archives/edgar/data/1937926/000162828026013098/exhibit211.htm')
  assert.equal(Buffer.byteLength(body), receipt.bytes)
  assert.ok(receipt.bytes < 512 * 1024)
  assert.equal(createHash('sha256').update(body).digest('hex'), receipt.sha256)
  const document = readNativeDocument(body)
  const text = document.text(document.nodes(node => node.tag === 'root')[0])
  assert.match(text, /consolidated results of Brookfield Asset Management Ltd\. as of December 31, 2025/)
  assert.match(text, /Brooksolutions Global Services Private Limited India/)
})

test('the Brookfield brand itself cannot replace the exact reviewed own legal employer', async () => {
  const { options } = replay(fixture(), (url, body) => {
    if (!url.includes('/wday/cxs/') || !url.includes('/job/')) return body
    const payload = JSON.parse(body)
    payload.hiringOrganization.name = 'Brookfield Asset Management'
    return JSON.stringify(payload)
  })
  await assert.rejects(run(options), /legal employer is outside the exact reviewed names/)
})

test('untyped secondary Brookfield locations stay present with their country uncertainty explicit', async () => {
  const { options } = replay(fixture(), (url, body) => {
    if (!url.includes('/wday/cxs/') || !url.includes('/job/')) return body
    const payload = JSON.parse(body)
    payload.jobPostingInfo.additionalLocations = ['Unqualified secondary office']
    return JSON.stringify(payload)
  })
  const jobs = await run(options)
  assert.equal(jobs.length, 5)
  for (const job of jobs) {
    assert.ok(job.locations.includes('Unqualified secondary office'))
    assert.deepEqual(job.nativeLocationEvidence.secondaryLocations, ['Unqualified secondary office'])
    assert.equal(job.sourceAdditionalLocationCountryScopeUnresolved, true)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.lifecycleCleanupAllowed, false)
  }
})

for (const mutation of ['wrong-employer', 'missing-employer', 'foreign-country', 'closing-description', 'closing-handoff']) {
  test('Brookfield does not qualify ' + mutation + ' as a reviewed India role', async () => {
    const data = fixture()
    const { options } = replay(data, (url, body, count) => {
      if (mutation === 'closing-handoff' && url === 'https://www.brookfield.com/careers/career-opportunities' && count === 2)
        return body.replaceAll('https://brookfield.wd5.myworkdayjobs.com', 'https://unrelated.wd5.myworkdayjobs.com')
      if (!url.includes('/wday/cxs/') || !url.includes('/job/')) return body
      const payload = JSON.parse(body)
      if (mutation === 'wrong-employer') payload.hiringOrganization.name = 'Brookfield Business Partners'
      if (mutation === 'missing-employer') payload.hiringOrganization.name = ''
      if (mutation === 'foreign-country') {
        payload.jobPostingInfo.country = { descriptor: 'United States of America', id: 'bc33aa3152ec42d4995f4791a106ed09' }
        payload.jobPostingInfo.jobRequisitionLocation.country = payload.jobPostingInfo.country
      }
      if (mutation === 'closing-description' && count === 2) payload.jobPostingInfo.jobDescription += '<p>Changed native criteria.</p>'
      return JSON.stringify(payload)
    })
    const jobs = await run(options)
    assert.equal(jobs.length, 0)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    const assessment = assessSoftFailureAcquisition({ source: 'brookfieldassetmanagement', zeroResultPolicy: 'evidence-required' }, jobs)
    assert.equal(assessment.runnerOutcome.success, false)
    assert.deepEqual(assessment.cleanupOptions, { replaceExisting: false })
  })
}
