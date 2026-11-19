import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run, PROVIDER_METADATA } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { assessSoftFailureAcquisition } from '../../scripts/softFailureAssessment20261113.mjs'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261119/current-native.json.gz', import.meta.url))))
const root = 'https://www.sparxitsolutions.com/career.shtml'
const client = 'https://www.sparxitsolutions.com/assets-style/js/custom.js'
const options = (change = (_url, body) => body) => {
  const counts = new Map()
  return { now: () => '2026-11-19T03:12:00.000Z',
    fetchText: async url => change(url, fixture.packets.find(packet => packet.requestUrl === url)?.body, 0),
    fetchImpl: async (url, init) => {
      assert.equal(init.method, 'GET')
      assert.doesNotMatch(url, /mailto:|apply|submit|candidate/i)
      const packet = fixture.packets.find(packet => packet.requestUrl === url)
      assert.ok(packet, 'Only current declared public documents: ' + url)
      const count = (counts.get(url) || 0) + 1; counts.set(url, count)
      return Object.defineProperty(new Response(change(url, packet.body, count), { status: packet.status,
        headers: { 'content-type': packet.contentType } }), 'url', { value: packet.url })
    } }
}

test('Sparx follows the current reviewed accordion owner and retains all twelve full native role observations', async () => {
  const jobs = await run(options())
  assert.equal(jobs.length, 12)
  assert.equal(jobs[0].jobId, 'senior-android-developer')
  assert.equal(jobs[0].sourceNativeJobId, null, 'The publisher does not issue native IDs for these blocks')
  assert.equal(jobs[0].requisitionId, null, 'A title-derived internal key is not an employer requisition')
  assert.ok(jobs.every(job => job.country === 'India' && job.city === 'Noida' && job.state === 'Uttar Pradesh'
    && job.sourceDetailComplete === true && job.sourceListingComplete === false && job.sourceScopeComplete === false
    && job.lifecycleCleanupAllowed === false && job.applyUrl === 'mailto:talent@sparxitsolutions.com'))
  assert.match(jobs[0].jobDescription, /SUMMARY:/)
  assert.match(jobs[0].jobDescription, /Opsgenie, Bugfender/)
  assert.match(jobs[1].jobDescription, /Master/)
  assert.match(jobs[1].jobDescription, /Political Science/)
  assert.equal(readSourceObservationEvidence(jobs, 'sparxitsolutions').observedRecordCount, 12)
  assert.equal(jobs.nativeCollectionEvidence.originalRecords.length, 12)
  assert.ok(jobs.nativeCollectionEvidence.originalRecords.every(row => row.originalCriteria.children.length > 0))
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.deepEqual(assessSoftFailureAcquisition(PROVIDER_METADATA, jobs).cleanupOptions, { replaceExisting: false })
})

test('Sparx qualifies only exact native Noida labels and holds missing, mixed, remote or foreign geography', async () => {
  for (const location of ['', 'Remote', 'Noida / London', 'Noida, United States', 'Noida, Sector 63 (Remote)']) {
    const jobs = await run(options((url, body) => url === root ? body.replace('Location: Noida (Sector 63)', 'Location: ' + location) : body))
    assert.equal(jobs.length, 11, location)
    assert.equal(jobs.nativeCollectionEvidence.originalRecords.length, 12)
    assert.equal(jobs.nativeCollectionEvidence.unqualifiedRoleIds[0], 'senior-android-developer')
  }
})

test('Sparx independently holds foreign detail geography, absent full criteria, closure and changed native application binding', async () => {
  const insert = (body, value) => body.replace('<strong class="post-pos">SUMMARY:</strong>', '<strong class="post-pos">SUMMARY:</strong>' + value)
  for (const change of [
    body => insert(body, '<p>Work Location: London, United Kingdom</p>'),
    body => insert(body, '<p>Job Location: Noida / Remote</p>'),
    body => insert(body, '<p>This position is no longer accepting applications.</p>'),
    body => body.replace('href="mailto:talent@sparxitsolutions.com" class="btn-apply"', 'href="mailto:talent@foreign.test" class="btn-apply"'),
    body => body.replace('href="mailto:talent@sparxitsolutions.com" class="btn-apply"', 'href="mailto:talent@sparxitsolutions.com" aria-disabled="TRUE" class="btn-apply"'),
    body => body.replace('<div class="key-prepration">', '<div class="key-prepration" hidden>'),
  ]) {
    const jobs = await run(options((url, body) => url === root ? change(body) : body))
    assert.equal(jobs.length, 11)
    assert.equal(jobs.nativeCollectionEvidence.originalRecords.length, 12)
    assert.equal(jobs.nativeCollectionEvidence.unqualifiedRoleIds[0], 'senior-android-developer')
  }
})

test('Sparx refuses a changed executable program, dormant renderer, foreign publisher or duplicate role identity', async () => {
  for (const [name, target, update] of [
    ['changed click program', client, body => body.replace('.slideToggle("fast")', '.slideUp("fast")')],
    ['dormant program', root, body => body.replace('src="' + client + '"', 'type="text/plain" src="' + client + '"')],
    ['foreign canonical', root, body => body.replace(/<link\b[^>]*rel=["']canonical["'][^>]*>/i, '<link rel="canonical" href="https://foreign.test/career.shtml">')],
    ['duplicate identity', root, body => body.replace('Profile: Research Intern', 'Profile: Senior Android Developer')],
  ]) await assert.rejects(run(options((url, body) => {
    if (url !== target) return body
    const changed = update(body); assert.notEqual(changed, body, name + ' must mutate the actual capture')
    return changed
  })), /native|program|renderer|canonical|identity|publisher/i, name)
})

test('Sparx rejects closing full-criteria changes before releasing staged roles', async () => {
  await assert.rejects(run(options((url, body, count) => {
    if (url !== root || count !== 2) return body
    assert.match(body, /Opsgenie, Bugfender/)
    return body.replace('Opsgenie, Bugfender.', 'Opsgenie, Sentry.')
  })), /Closing native inventory or full criteria changed/)
})

test('Sparx caller caps preserve the complete original configured observations and cleanup hold', async () => {
  const jobs = await run({ ...options(), maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs.nativeCollectionEvidence.originalRecords.length, 12)
  assert.equal(readSourceObservationEvidence(jobs, 'sparxitsolutions').observedVacancyCount, 12)
  assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed, false)
})

test('Sparx positive observations with wholly unqualified geography cannot certify an empty source', async () => {
  const jobs = await run(options((url, body) => url === root ? body.replaceAll('Location: Noida', 'Location: Remote') : body))
  assert.equal(jobs.length, 0)
  assert.equal(jobs.nativeCollectionEvidence.originalRecords.length, 12)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  const assessed = assessSoftFailureAcquisition(PROVIDER_METADATA, jobs)
  assert.equal(assessed.zeroJobEvidence, 'coverage-gap')
  assert.deepEqual(assessed.cleanupOptions, { replaceExisting: false })
})
