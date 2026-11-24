import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { selectCurrentSignzyDeployment } from './deployment.js'
import { validateClientBinding } from './clientBinding.js'
import observed from './observed.fixture.json' with { type: 'json' }
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const packets = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261120/assets.json.gz', import.meta.url))))
const corporateHtml = packets['https://www.signzy.com/careers'].body

test('Signzy current declared deployment proves its real Flight default page and Keka configuration', () => {
  const deployment = selectCurrentSignzyDeployment(corporateHtml)
  const binding = validateClientBinding({ corporateHtml, routeBody: packets[deployment.routeUrl].body, bridgeBody: packets[deployment.bridgeUrl].body }, deployment)
  assert.equal(binding.configuration.identifier, '54e30b3d-e138-4862-8055-8b2ce8c31009')
  assert.equal(binding.configuration.domain, 'https://signzy.keka.com/careers/')
  assert.equal(binding.configuration.targetContainer, '#khembedjobs')
})

test('Signzy current declaration rejects unknown deployments and changed employer configuration', () => {
  assert.throws(() => selectCurrentSignzyDeployment(corporateHtml.replaceAll('dpl_9DawriRVyZu6V6caS9MG7LAcFqZq', 'dpl_unreviewed')), /unreviewed.*deployment/)
  const deployment = selectCurrentSignzyDeployment(corporateHtml)
  assert.throws(() => validateClientBinding({ corporateHtml, routeBody: packets[deployment.routeUrl].body.replaceAll('54e30b3d-e138-4862-8055-8b2ce8c31009', '00000000-0000-0000-0000-000000000000'), bridgeBody: packets[deployment.bridgeUrl].body }, deployment), /configuration|renderer/)
})

test('Signzy current declaration retains native observations without silently approving unrelated changed assets', async () => {
  const calls = []
  const jobs = await run({ fetchImpl: async value => {
    const url = String(value)
    calls.push(url)
    const packet = packets[url] || (!url.startsWith('https://www.signzy.com/') && observed[url])
    assert.ok(packet, 'Retired or undeclared public URL ' + url)
    return { status: packet.status, url: packet.url || packet.finalUrl, text: async () => packet.body }
  } })
  // The native responses are the historical fixture; this checks current
  // ownership and conservative scope, independently of today's role count.
  assert.equal(jobs.length, 19)
  assert.ok(jobs.every(job => job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.ok(calls.some(url => url.includes('page-17cb46b735a27a21.js')))
  assert.ok(!calls.some(url => url.includes('page-44158628e6d772d3.js')))
})
