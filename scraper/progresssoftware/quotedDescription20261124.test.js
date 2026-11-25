import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseNativeListing, parseNativeDetail } from './native.js'

const packet = name => JSON.parse(gunzipSync(readFileSync(new URL('./test-data/' + name + '-20261124.json.gz', import.meta.url))))
const listing = packet('listing')
const detail = packet('role-ocV7Afwy')
const row = parseNativeListing(listing.body).records.find(value => value.jobId === 'ocV7Afwy')
const changeSchema = update => detail.body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g, (whole, open, raw, close) => {
  const value = JSON.parse(raw)
  if (value['@type'] !== 'JobPosting') return whole
  update(value)
  return open + JSON.stringify(value) + close
})

test('Progress retains the full visible Hyderabad criteria when schema omits paired prose quotation marks', () => {
  const job = parseNativeDetail(detail.body, row)
  assert.equal(job.jobId, 'ocV7Afwy')
  assert.equal(job.title, 'Technical Support Engineer, Senior 1')
  assert.equal(job.country, 'India')
  assert.equal(job.location, 'Hyderabad, India')
  assert.equal(job.sourceDetailComplete, true)
  assert.match(job.jobDescription, /assigned as a "Guide" to new team members/)
})

test('Progress still rejects a substantive schema criterion change alongside quotation differences', () => {
  const changed = changeSchema(schema => { schema.description = schema.description.replace('Guide', 'Manager') })
  assert.throws(() => parseNativeDetail(changed, row), /description mismatch/)
})

test('Progress does not treat numeric measurement quotation marks as prose emphasis', () => {
  const changed = changeSchema(schema => { schema.description = schema.description.replace('Guide', '6') })
    .replaceAll('&quot;Guide&quot;', '6&quot;')
  assert.ok(changed.includes('as a 6&quot; to new team members'))
  assert.throws(() => parseNativeDetail(changed, row), /description mismatch/)
})
