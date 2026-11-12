import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { parseNativeBoard } from '../scraper/arcadia/nativeBoard.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/arcadia-native-beacon-20261112.json.gz', import.meta.url))))
const observations = fixture.responses.filter(row => row.url === 'https://ats.rippling.com/arcadiacareers/jobs?pageSize=1000')
const beaconURL = 'https://static.cloudflareinsights.com/beacon.min.js/vce701823e78c4301a35b7e07294d87301792088814092'
const integrity = 'sha512-UKNk8GbxkABxKcXYuLkO16EleLGUkcvJWtpSNmExE0Too3ZaFAxTscNWEc1OdAv5/BikHawapSCaiD2XCmp+Bw=='

test('Arcadia qualifies all four genuine current native board observations with the explicitly reviewed SRI-pinned telemetry declarations', () => {
  assert.equal(observations.length, 4)
  const profiles = new Set()
  for (const response of observations) {
    assert.equal(createHash('sha256').update(response.body).digest('hex'), response.hash)
    const parsed = parseNativeBoard(response.body)
    assert.equal(parsed.observedPublisherRows, 22)
    assert.equal(parsed.observedDistinctRoles, 21)
    profiles.add(parsed.declarationProof.profileSHA256)
    assert.equal(parsed.declarationProof.declarationCount, 41)
    assert.equal(parsed.declarationProof.complete, true)
  }
  assert.deepEqual([...profiles].sort(), [
    'e29174e325b8ee24e1b24f00b368fb3665fadcff4f5f7c795316eac105cb468d',
    'e60b4f8706125f159d1bf68ba3324cb46b8444568681aa2e5acff1b1901d6705',
  ])
})

test('Arcadia retains exact public executable bytes matching the reviewed board integrity declaration', () => {
  const response = fixture.responses.find(row => row.url === beaconURL)
  assert.ok(response)
  assert.equal(createHash('sha256').update(response.body).digest('hex'), response.hash)
  assert.equal('sha512-' + createHash('sha512').update(response.body).digest('base64'), integrity)
  assert.ok(observations.every(row => row.body.includes(integrity) && row.body.includes(beaconURL)))
})

for (const [variant, response] of [observations[0], observations[2]].entries()) for (const [label, edit] of [
  ['resource URL', html => html.replace(beaconURL, 'https://static.cloudflareinsights.com/unreviewed-careers.js')],
  ['integrity declaration', html => html.replace(integrity, integrity.replace('UKNk', 'AAAA'))],
  ['beacon configuration', html => html.replace('"spa":2', '"spa":0')],
]) test('Arcadia rejects changed reviewed telemetry ' + label + ' in genuine variant ' + variant, () => {
  const changed = edit(response.body)
  assert.ok(changed !== response.body, 'The negative control must change the observed declaration')
  assert.throws(() => parseNativeBoard(changed), /declarations changed/)
})

for (const [variant, response] of [observations[0], observations[2]].entries()) for (const [label, declaration] of [
  ['executable', '<script src="https://example.invalid/additional-jobs.js"></script>'],
  ['form', '<form action="https://example.invalid/jobs"><button>More openings</button></form>'],
]) test('Arcadia reviewed telemetry profile still rejects an additional unreviewed ' + label + ' in genuine variant ' + variant, () => {
  assert.throws(() => parseNativeBoard(response.body.replace('</body>', declaration + '</body>')), /declarations changed/)
})
