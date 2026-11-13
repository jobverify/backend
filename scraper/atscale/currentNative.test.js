import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseAtScaleListing } from './native.js'

const listing = () => gunzipSync(readFileSync(new URL('./fixtures/listing-20261113.html.gz', import.meta.url))).toString('utf8')
const changeData = change => listing().replace(/(<script id="__NEXT_DATA__" type="application\/json">)([\s\S]*?)(<\/script>)/, (_, start, body, end) => {
  const data = JSON.parse(body); change(data); return start + JSON.stringify(data) + end
})

test('AtScale reconciles the current explicitly localized unfiltered Rippling query and all native roles', () => {
  const result = parseAtScaleListing(listing())
  assert.equal(result.reportedTotal, 16)
  assert.equal(result.records.length, 16)
  assert.deepEqual(result.records.filter(row => row.india).map(row => row.raw.name), ['Support Engineer', 'Technical Consultant'])
  assert.equal(result.terminationKnown, true)
})

test('AtScale rejects a foreign query locale or a country-filtered localized query', () => {
  for (const change of [
    data => { data.props.pageProps.dehydratedState.queries[0].queryKey[5] = 'de-DE' },
    data => { data.props.pageProps.dehydratedState.queries[0].queryKey[4].country = 'IN' },
  ]) assert.throws(() => parseAtScaleListing(changeData(change)), /query/)
})
