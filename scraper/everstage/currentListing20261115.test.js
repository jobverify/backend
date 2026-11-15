import assert from 'node:assert/strict'
import fs from 'node:fs'
import test from 'node:test'
import { gunzipSync } from 'node:zlib'
import * as native from './nativeRun.js'

const html = gunzipSync(fs.readFileSync(new URL('./fixtures/current-listing-20261115.html.gz', import.meta.url))).toString('utf8')
const changed = mutate => html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/, (_match, before, raw, after) => {
  const data = JSON.parse(raw)
  mutate(data.props.pageProps.dehydratedState.queries.find(query => query.queryKey?.[2] === 'job-posts').queryKey)
  return before + JSON.stringify(data) + after
})

test('Everstage current locale-qualified listing retains all India role and location observations', () => {
  const listing = native.parseEverstageListing(html, 200)
  assert.equal(listing.items.length, 5)
  assert.equal(listing.groups.length, 4)
  assert.ok(listing.groups.every(group => group.india === true))
  assert.equal(listing.groups.find(group => group.identity.id === '81087ce5-8949-4a11-8db7-795cf78b84f4').locations.length, 2)
  assert.deepEqual(listing.pagination, { page: 0, pageSize: 20, totalItems: 5, totalPages: 1 })
})

for (const [label, mutate] of [
  ['foreign locale', query => { query[5] = 'fr-FR' }],
  ['extra query component', query => { query.push('unqualified') }],
  ['country filter', query => { query[4].country = 'IN' }],
  ['changed page', query => { query[4].page = 1 }],
]) test(`Everstage locale-qualified query rejects ${label}`, () => {
  assert.throws(() => native.parseEverstageListing(changed(mutate), 200), /Native unqualified filter\/pagination query changed/)
})
