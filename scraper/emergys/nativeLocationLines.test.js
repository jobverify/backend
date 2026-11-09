import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { parseDetail, parseListing } from './parser.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz', import.meta.url))))
const board = 'https://www.emergys.com/careers/'
const roleURL = board + 'pp-qm-ds-consultant/'
const body = url => Buffer.from(fixture.inputs.find(packet => packet.url === url).bodyBase64, 'base64').toString('utf8')
const listing = parseListing(body(board), board)
const row = listing.records.find(record => record.url === roleURL)
const original = body(roleURL)
const field = '<span style="color: #000000;"><strong>Location</strong></span> : Pune'
const now = '2026-10-23T17:30:00.000Z'
const parse = html => parseDetail(html, structuredClone(row), now)
const change = replacement => {
  assert.equal(original.split(field).length, 2)
  return original.replace(field, () => replacement)
}

test('Emergys reads the captured location line after a native br without inferring its country', () => {
  const fact = parse(original)
  assert.equal(fact.location, 'Pune')
  assert.equal(fact.country, null)
  assert.equal(fact.excluded, true)
  assert.equal(fact.exclusionReason, 'native-country-unknown')
  assert.equal(fact.legalEmployer, null)
  assert.equal(fact.firstEverPublication, null)
  assert.equal(fact.nativePublication.raw, '2026-08-19T09:38:37+00:00')
})

test('Emergys limits an authored location field to its br-delimited line', () => {
  const fact = parse(change(field + '<br>Must have: Native role qualifications.'))
  assert.equal(fact.location, 'Pune')
  assert.equal(fact.country, null)
  assert.ok(fact.descriptionHTML.includes('Must have: Native role qualifications.'))
})

test('Emergys recognizes explicit India only when it occurs in the location field', () => {
  const fact = parse(change(field + ', India'))
  assert.equal(fact.location, 'Pune, India')
  assert.equal(fact.country, 'India')
  assert.equal(fact.excluded, undefined)
})

test('Emergys does not inherit India from another authored line', () => {
  const fact = parse(change(field + '<br>Client market: India'))
  assert.equal(fact.location, 'Pune')
  assert.equal(fact.country, null)
  assert.equal(fact.exclusionReason, 'native-country-unknown')
})

test('Emergys rejects two visible location lines instead of choosing the first', () => {
  assert.throws(() => parse(change(field + '<br>Location: Mumbai, India')), /location/i)
})

test('Emergys ignores an inert alternative location line', () => {
  const fact = parse(change(field + '<span hidden><br>Location: Mumbai, India</span><template><p>Location: India</p></template>'))
  assert.equal(fact.location, 'Pune')
  assert.equal(fact.country, null)
})

test('Emergys does not treat a source-format newline as a rendered field boundary', () => {
  const changed = change(field).replace('DS<br />\n' + field, 'DS\n' + field)
  assert.notEqual(changed, original)
  assert.throws(() => parse(changed), /location/i)
})

test('Emergys requires an anchored nonempty native location label', () => {
  assert.throws(() => parse(change('Preferred client Location: Pune')), /location/i)
  assert.throws(() => parse(change('<strong>Location</strong>: ')), /location|workplace/i)
})

for (const [name, prefix, hidden] of [
  ['opacity', '', '<span style="opacity:0">Location: Pune, India</span>'],
  ['author stylesheet', '<style>.native-location-hidden{display:none}</style>', '<span class="native-location-hidden">Location: Pune, India</span>'],
]) {
  test('Emergys rejects a location label hidden by ' + name, () => {
    assert.throws(() => parse(prefix + change(hidden)), /location|visible/i)
  })
  test('Emergys preserves the visible location beside an alternative hidden by ' + name, () => {
    const fact = parse(prefix + change(field + '<br>' + hidden))
    assert.equal(fact.location, 'Pune')
    assert.equal(fact.country, null)
    assert.equal(fact.exclusionReason, 'native-country-unknown')
  })
}
