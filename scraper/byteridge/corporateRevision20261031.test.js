import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { corporateContract, CAREER_PAGE_URL, FRAME_URL } from './nativeContract.js'
import { run } from './script.js'
import { nativeOptions } from './fixtures/options.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const { corporate } = JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/corporate-20261031.json.gz', import.meta.url))))
const currentOptions = mutate => nativeOptions((packet, url) => {
  if (url === CAREER_PAGE_URL) packet.body = mutate ? mutate(corporate.body) : corporate.body
})

test('October 31 WordPress asset revision preserves the visible Byteridge careers delegation', () => {
  const result = corporateContract(corporate.body)
  assert.deepEqual(result.frames, [FRAME_URL])
  assert.deepEqual(result.reasons, [])
})

test('current Byteridge corporate HTML reconciles the complete captured native inventory', async () => {
  const jobs = await run(currentOptions())
  assert.equal(jobs.length, 7)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
  assert.equal(jobs.nativeInventoryEvidence.observedGlobalRecords, 7)
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.legalEmployer === 'Byteridge Software Private Limited'))
})

test('rotated Elementor nonces retain only the already reviewed configuration semantics', () => {
  const html = corporate.body.replace(/("(?:floatingButtonsClickTracking|atomicFormsSendForm|nonce)":")[a-f0-9]{10}("?)/g, '$1abcdef0123$2')
  assert.notEqual(html, corporate.body)
  assert.deepEqual(corporateContract(html).reasons, [])
})

for (const [label, change] of [
  ['changed Elementor configuration', html => html.replace('"global_image_lightbox":"yes"', '"global_image_lightbox":"no"')],
  ['invalid numeric nonce configuration', html => html.replace(/"nonce":"[a-f0-9]{10}"/, '"nonce":1234567890')],
  ['executable code appended to a nonce configuration', html => html.replace('//# sourceURL=elementor-frontend-js-before', 'window.moreJobs="/jobs";\n//# sourceURL=elementor-frontend-js-before')],
]) test(label + ' retains partial Byteridge scope', () => {
  const html = change(corporate.body)
  assert.notEqual(html, corporate.body)
  assert.ok(corporateContract(html).reasons.includes('unreviewed-corporate-inline-client'))
})

for (const [label, change] of [
  ['hidden iframe', html => html.replace('<iframe id="dynamic-iframe"', '<iframe hidden id="dynamic-iframe"')],
  ['CSS-hidden iframe', html => html.replace('<iframe id="dynamic-iframe"', '<iframe class="e-search-close" id="dynamic-iframe"')],
  ['CSS-hidden ancestor', html => html.replace('<iframe id="dynamic-iframe"', '<div class="e-search-close"><iframe id="dynamic-iframe"').replace('scrolling="no" style="overflow: auto;"></iframe>', 'scrolling="no" style="overflow: auto;"></iframe></div>')],
  ['another employer delegation', html => html.replace(FRAME_URL, 'https://another-employer.example/jobs')],
  ['unreviewed stylesheet revision', html => html.replace('style.css?ver=7.1.4', 'style.css?ver=unreviewed')],
]) test('current Byteridge ' + label + ' cannot establish official delegation', () => {
  const html = change(corporate.body)
  assert.notEqual(html, corporate.body)
  assert.throws(() => corporateContract(html), /missing visible official careers iframe|unreviewed corporate stylesheet visibility/)
})
