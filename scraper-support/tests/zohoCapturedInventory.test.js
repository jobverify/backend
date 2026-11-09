import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { zohoBoardHtml, zohoSourceSpecs } from './fixtures/zohoNativeOptions.js'
const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/zoho-native-20261026.json.gz', import.meta.url))))
for (const [source, expectedCount] of [['agilisium', 4], ['npci', 92], ['fasal', 0]]) test(`${source} replays its captured complete native record set`, async () => {
  const packet = fixture.packets[source], spec = zohoSourceSpecs[source]
  let boards = 0, arrays = 0, fullRecords = 0
  const jobs = await (await import(`../../scraper/${source}/script.js`)).run({
    now: () => '2026-10-26T10:00:00.000Z',
    fetchPage: async url => {
      if (url === spec.official) return { status: 200, url, html: `<a href="${spec.board}">Careers</a>${packet.extraRecruitingScopeObserved ? '<a href="https://another.zohorecruit.com/jobs/Careers">Other openings</a>' : ''}` }
      assert.equal(url, packet.boardUrl)
      const current = boards++ === 0 ? packet.initialBoard : packet.closingBoard
      return { status: 200, url, html: zohoBoardHtml(current.meta, current.jobs) }
    },
    fetchJson: async url => {
      const parsed = new URL(url)
      assert.equal(parsed.origin, new URL(packet.boardUrl).origin)
      if (parsed.pathname === '/recruit/v2/public/Job_Openings') return packet.arrays[arrays++]
      const id = parsed.pathname.split('/').at(-1)
      assert.ok(packet.details[id], 'Native detail ID must exist in the captured packet')
      fullRecords++
      return packet.details[id]
    },
  })
  assert.equal(jobs.length, expectedCount)
  assert.deepEqual(jobs.map(job => job.jobId), packet.expectedJobs.map(job => job.id))
  for (const job of jobs) {
    const expected = packet.expectedJobs.find(item => item.id === job.jobId)
    assert.equal(job.postingDate, expected.posted)
    assert.equal(job.applyUrl, expected.apply)
    assert.equal(createHash('sha256').update(job.jobDescription).digest('hex'), expected.descriptionSHA256)
    if (source === 'npci') assert.equal(job.nativeEmployerEntity, 'NPCI')
  }
  assert.equal(readInventoryEvidence(jobs).status, packet.expectedStatus)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, packet.initialBoard.jobs.length)
  assert.equal(boards, 2); assert.equal(arrays, 2)
  assert.equal(fullRecords, Object.keys(packet.details).length)
})
