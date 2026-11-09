import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { extractRoleSummaries, hasVerifiedCareersPageSignal, createLinearScraper } from '../../scraper/linear/script.js'

const html = gunzipSync(readFileSync(new URL('../../scraper/linear/test-data/careers-20261031.html.gz', import.meta.url))).toString('utf8')

test('Linear rejects the old synthetic anchor-only zero contract without sending a native request', async () => {
  const legacy = '<title>We are hiring - Linear</title><h1>Help us craft high-quality tools</h1><h2>Open roles</h2><a href="/careers/29f7d3fe-a25a-4725-b4cb-2f48f56133b0"><span>Engineer</span><span>Europe</span></a>'
  assert.equal(hasVerifiedCareersPageSignal(legacy), false)
  assert.throws(() => extractRoleSummaries(legacy), /careers runtime handoff/i)
  let reads = 0
  await assert.rejects(createLinearScraper().run({ transport: async url => {
    reads++
    assert.equal(url, 'https://linear.app/careers')
    return { url, status: 200, headers: { 'content-type': 'text/html' }, body: Buffer.from(legacy), bodyComplete: true }
  } }), /careers runtime handoff/i)
  assert.equal(reads, 1)
})

test('Linear cannot establish a listing from valid data after its rendered role groups disappear', () => {
  const hidden = html.replace(/<a\b[^>]*href="\/careers\/[^"#?]+"[^>]*>[\s\S]*?<\/a>/gi, '')
  assert.notEqual(hidden, html)
  assert.equal(hasVerifiedCareersPageSignal(hidden), false)
  assert.throws(() => extractRoleSummaries(hidden), /visible role groups/i)
})
