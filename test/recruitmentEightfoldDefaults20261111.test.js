import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { declaredEightfoldRecruitment, readEightfoldRecruitment } from '../scraper-support/utils/recruitmentEightfold.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/recruitment-eightfold-bayer-defaults-20261111.json.gz', import.meta.url))))
const captures = new Map()
for (const row of fixture.responses) {
  const body = Buffer.from(row.bodyBase64, 'base64')
  assert.equal(createHash('sha256').update(body).digest('hex'), row.bodySHA256)
  const rows = captures.get(row.requestedURL) || []
  rows.push({ ...row, body: body.toString('utf8') }); captures.set(row.requestedURL, rows)
}
const HOME = fixture.responses.find(row => row.label === 'corporate').url
const BOARD = fixture.responses.find(row => row.label === 'board').url
const headAmpersandRole = 'https://talent.bayer.com/careers/job/562949978807035'
const config = { source: 'bayer', companyName: 'Bayer', companyCareerPage: HOME }
const replay = (mutate = (_url, value) => value) => {
  const calls = [], jobs = [], records = [], inventories = [], unresolved = []
  const counts = new Map([[HOME, 1], [BOARD, 1]])
  const pageOf = row => ({ url: row.finalURL, status: row.status, html: row.body })
  const openingCorporate = pageOf(captures.get(HOME)[0]), openingBoard = pageOf(captures.get(BOARD)[0])
  const descriptor = declaredEightfoldRecruitment(openingBoard, config)
  const request = async url => {
    assert.ok(calls.length < 46, 'The default48-read budget includes the two actual corporate/native opening pages')
    const count = (counts.get(url) || 0) + 1, rows = captures.get(url)
    assert.ok(rows && count <= rows.length, 'No undeclared/repeated public request: ' + url)
    counts.set(url, count); calls.push({ url, count })
    return mutate(url, structuredClone(rows[count - 1]), count, calls)
  }
  const readPage = async url => pageOf(await request(url))
  const context = { readPage, readRenderer: readPage,
    readNativeJson: async url => { const row = await request(url); return { url: row.finalURL, status: row.status, text: row.body } },
    permit: () => {}, matchingEmployer: name => name === 'Bayer', addJob: value => jobs.push(value),
    recordRead: value => records.push(value), inventoryRead: value => inventories.push(value), unresolved: value => unresolved.push(value),
    maxPages: 8, maxDetails: 20, remainingRequests: () => 46 - calls.length, now: fixture.completedAt,
    officialBinding: { officialURL: HOME, declaredURL: BOARD + '#upload-resume-button', page: openingCorporate },
    recheckOfficialBinding: async binding => readPage(binding.officialURL) }
  return { calls, jobs, records, inventories, unresolved, run: () => readEightfoldRecruitment(descriptor, context) }
}

test('normal default budget reconciles six actual full India roles, including the publisher entity-spelled title', async () => {
  const r = replay()
  await r.run()
  assert.equal(r.jobs.length, 6)
  assert.equal(r.calls.length, 42)
  assert.equal(r.records.length, 10)
  assert.equal(r.inventories[0].reportedTotal, 30)
  const job = r.jobs.find(row => row.id === '562949978807035')
  assert.ok(captures.get(headAmpersandRole)[0].body.includes('PET &amp; Nuclear Imaging'))
  assert.equal(job.title, 'Business Development Manager - PET & Nuclear Imaging')
  for (const job of r.jobs) {
    const own = captures.get('https://talent.bayer.com/api/apply/v2/jobs/' + job.id + '?domain=bayer.com')[0]
    assert.equal(job.description, JSON.parse(own.body).job_description)
    assert.equal(job.country, 'India')
    assert.equal(job.employer.name, 'Bayer')
    assert.equal(job.posted, null)
    assert.equal(job.closing, null)
    assert.equal(job.remoteStatus, null)
    assert.equal(job.legalEmployer, null)
    assert.equal(job.sourcePublicationDateUnavailable, true)
    assert.equal(job.sourceRemoteStatusUnresolved, true)
    assert.equal(job.record.sourceScopeComplete, false)
    assert.equal(job.record.lifecycleCleanupAllowed, false)
  }
})

test('a genuinely different own page title withholds the actual default multi-role selection', async () => {
  const r = replay((url, packet) => {
    if (url !== headAmpersandRole) return packet
    const body = packet.body.replace(/<title>([\s\S]*?)<\/title>/, (_whole, title) => '<title>' + title.replace('&amp;', 'and') + '</title>')
    assert.notEqual(body, packet.body)
    return { ...packet, body }
  })
  await assert.rejects(r.run(), /page title/i)
  assert.equal(r.jobs.length, 0)
})

test('an earlier full criterion changed during later acquisition must be rechecked before any default job is emitted', async () => {
  const firstOwn = 'https://talent.bayer.com/api/apply/v2/jobs/562949978833200?domain=bayer.com'
  let laterAcquired = false, firstRecheckedAfterLater = false
  const r = replay((url, packet, count) => {
    if (/\/api\/apply\/v2\/jobs\/\d+\?/.test(url) && url !== firstOwn && count === 1) laterAcquired = true
    if (url === firstOwn && count === 2 && laterAcquired) {
      firstRecheckedAfterLater = true
      const job = JSON.parse(packet.body)
      job.job_description += '<p>Additional current mandatory requirement: ten years of regulated manufacturing experience.</p>'
      return { ...packet, body: JSON.stringify(job) }
    }
    return packet
  })
  await assert.rejects(r.run(), /criteria|description|closing/i)
  assert.equal(firstRecheckedAfterLater, true, 'Every selected full role must have a closing read after the acquisition phase')
  assert.equal(r.jobs.length, 0)
})
