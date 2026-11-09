import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'

import { verifyCarrierBinding, validateCarrierMappedJobs, ROLE } from './nativeBinding.js'
import { toPlainText } from '../../scraper-support/detailExtractors/shared.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/current-binding-20261031.json.gz', import.meta.url))))
for (const packet of fixture.packets) assert.equal(createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const search = fixture.packets.find(packet => packet.filename === '006-search.txt.gz')
const publicRole = fixture.packets.find(packet => packet.filename === '007-current-role.txt.gz')
const detail = JSON.parse(fixture.packets.find(packet => packet.filename === '008-current-detail.txt.gz').body)
const fetchPage = change => async url => {
  const packet = structuredClone(fixture.packets.find(packet => packet.url === url && packet.method === 'GET'))
  assert.ok(packet, 'Only the captured current official requests are permitted: ' + url)
  change?.(packet)
  return { status: packet.status, url: packet.finalURL, body: packet.body }
}
const mapped = () => {
  const info = detail.jobPostingInfo
  return [{ source: 'carrier', company: 'Carrier', jobId: info.jobReqId, requisitionId: info.jobReqId,
    title: info.title, link: info.externalUrl, nativeEmployer: detail.hiringOrganization.name,
    country: 'India', sourceDescription: info.jobDescription, jobDescription: toPlainText(info.jobDescription),
    sourceDetailComplete: true, sourceListingComplete: false }]
}

test('Carrier binds a currently advertised India role after the fixed sentinel closes', async () => {
  assert.equal(fixture.packets.find(packet => packet.url === ROLE).finalURL, 'https://jobs.carrier.com/en')
  const binding = await verifyCarrierBinding({ fetchPage: fetchPage(), now: fixture.capturedAt })
  assert.equal(binding.publicRoleURL, publicRole.url)
  assert.equal(binding.nativeRequisitionId, '30221429')
  assert.equal(binding.nativeCanonicalURL, detail.jobPostingInfo.externalUrl)
  assert.equal(binding.companyScopeComplete, false)
  assert.equal(validateCarrierMappedJobs(mapped(), binding).length, 1)
})

for (const [name, change] of [
  ['hidden search results', packet => { if (packet.url === search.url) packet.body = '<div hidden>' + packet.body + '</div>' }],
  ['foreign public role origin', packet => { if (packet.url === search.url) packet.body = packet.body.replaceAll('/en/job/', 'https://unrelated.example/en/job/') }],
  ['conflicting application requisition', packet => { if (packet.url === publicRole.url) packet.body = packet.body.replaceAll('_30221429/apply', '_99999999/apply') }],
  ['missing visible requisition', packet => { if (packet.url === publicRole.url) packet.body = packet.body.replace('Job ID</b> 30221429', 'Job ID</b> 99999999') }],
]) test('current Carrier discovery rejects ' + name, async () => {
  await assert.rejects(verifyCarrierBinding({ fetchPage: fetchPage(change), now: fixture.capturedAt }))
})

test('a fresh public role still has to match the exact native inventory role', async () => {
  const binding = await verifyCarrierBinding({ fetchPage: fetchPage(), now: fixture.capturedAt })
  for (const change of [job => { job.title += ' changed' }, job => { job.link += '-changed' },
    job => { job.requisitionId = '99999999' }]) {
    const jobs = mapped()
    change(jobs[0])
    assert.throws(() => validateCarrierMappedJobs(jobs, binding), /identity disagree/)
  }
})
