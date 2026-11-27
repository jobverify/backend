import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import { isHexRoleURL, readCurrentHexInventory, inspectCurrentHexRole } from './currentPublished20261120.js'

const packet = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-listing-20261125.json.gz', import.meta.url))))
const observedURL = 'https://hex.tech/careers/engineering-director-agent-%26-analytics/'

test('Hex accepts the current declared percent-encoded ampersand within its own role path', () => {
  assert.equal(isHexRoleURL(observedURL), true)
})

test('Hex current native listing still reconciles every advertised role and the finite count', () => {
  const inventory = readCurrentHexInventory(packet.body)
  assert.equal(inventory.total, 43)
  assert.equal(inventory.cards.length, 43)
  assert.ok(inventory.cards.some(row => row.url === observedURL && row.title === 'Engineering Director, Agent & Analytics'))
})

const role = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-ampersand-role-20261125.json.gz', import.meta.url))))

test('Hex reconciles its observed literal ampersand metadata with the same encoded advertised role', () => {
  const row = readCurrentHexInventory(packet.body).cards.find(card => card.url === observedURL)
  const detail = inspectCurrentHexRole(role.body, row)
  assert.equal(detail.url, observedURL)
  assert.equal(detail.title, 'Engineering Director, Agent & Analytics')
  assert.deepEqual(detail.countries, ['United States'])
  assert.ok(detail.description.length > 1000)
  assert.equal(detail.companyScopeComplete, false)
})

test('Hex ampersand alias cannot qualify different native metadata paths or queries', () => {
  const row = readCurrentHexInventory(packet.body).cards.find(card => card.url === observedURL)
  for (const replacement of ['engineering-director-other-&-analytics', 'engineering-director-agent-&-analytics/?country=India']) {
    const changed = role.body.replaceAll('engineering-director-agent-&amp;-analytics/', replacement.replaceAll('&', '&amp;') + '/')
    assert.ok(changed !== role.body, 'Modify actual native HTML metadata')
    assert.throws(() => inspectCurrentHexRole(changed, row), /canonical|URL|publisher/)
  }
})

for (const url of [
  observedURL.replace('hex.tech', 'other.example'),
  observedURL + '?location=India',
  observedURL + '#apply',
  observedURL.replace('%26', '%2f'),
  observedURL.replace('%26', '%2526'),
  observedURL.replace('%26', '%00'),
]) test('Hex still rejects an unqualified role URL: ' + url, () => {
  assert.equal(isHexRoleURL(url), false)
})
