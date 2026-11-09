import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { nativeSurfaceContract, assetContract, FILTERED_JOBS_URL, publicJobURL, jobURL, NOAUTH_TOKEN_URL, ORIGIN } from '../../scraper/ola/nativeContract.js'
import { nativeOptions } from '../../scraper/ola/fixtures/options.js'
import { syntheticRole } from '../../scraper/ola/fixtures/syntheticRole.js'

const root = new URL('./test-data/ats-followup-20261107/', import.meta.url)
const packets = name => JSON.parse(gunzipSync(fs.readFileSync(new URL(name + '.json.gz', root))))
const retained = source => packets(source).map(row => {
  assert.equal(createHash('sha256').update(row.body).digest('hex'), row.sha256)
  assert.equal(Buffer.byteLength(row.body), row.bytes)
  assert.equal(row.status, 200)
  return row
})
const registered = source => createCatalogScraper(getScraperCatalog().find(row => row.source === source))
const replayText = (source, change = body => body) => {
  const captures = retained(source)
  return async url => {
    const found = captures.find(row => row.requestUrl === url)
    assert.ok(found, 'Uncaptured first-party request ' + url)
    return change(found.body, url)
  }
}

test('registered Panacea preserves all eleven captured native roles when Whitefield Bangalore uses a whitespace separator', async () => {
  const jobs = await registered('panaceamedicaltechnologiespvtltd').run({ fetchText: replayText('panaceamedicaltechnologiespvtltd') })
  assert.equal(jobs.length, 11)
  const pcb = jobs.find(job => job.title === 'PCB Layout Engineer')
  assert.equal(pcb.location, 'Whitefield Bangalore / Malur (Kolar District) 25 Km from Bangalore')
  assert.equal(pcb.country, 'India')
  assert.match(pcb.jobDescription, /PCB|layout/i)
  assert.equal(pcb.sourceUrl, 'https://www.panaceamedical.in/careers/jobs/pcb-layout-engineer-2/')
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 11)
})

for (const changed of ['Whitefield Bangalore, United States / Malur', 'WhitefieldBangalore / Malur', 'Whitefield Bangalore / Malur / Canada']) {
  test('Panacea still rejects the complete native workplace when it contains ' + changed, async () => {
    const read = replayText('panaceamedicaltechnologiespvtltd', (body, url) => url.includes('/pcb-layout-engineer-2/')
      ? body.replaceAll('Whitefield Bangalore / Malur (Kolar District) 25 Km from Bangalore', changed) : body)
    await assert.rejects(registered('panaceamedicaltechnologiespvtltd').run({ fetchText: read }), /unverified India job location scope/)
  })
}

test('the four current remote-only Muvi roles keep their unknown work country despite an India telephone selector', async () => {
  const calls = [], read = replayText('muvientertainment')
  await assert.rejects(registered('muvientertainment').run({ fetchText: async url => { calls.push(url); return read(url) } }), /unverified India country scope/)
  assert.equal(calls.length, 6)
  const details = retained('muvientertainment').filter(row => /\/job-listings\/[^/]+\//.test(new URL(row.url).pathname))
  assert.equal(details.length, 4)
  assert.ok(details.every(row => /<div class="location">Remote<\/div>/.test(row.body)))
})

const ola = retained('olaelectric').find(row => row.url.endsWith('/dashboardv2'))
const assets = new Map(retained('ola-assets').map(row => [row.url, row]))
const direct = [...ola.body.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match => new URL(match[1], ORIGIN).href).filter(url => url.startsWith(ORIGIN + '/'))

test('the exact current public Ola board selects its reviewed executable client while company scope remains unqualified', () => {
  assert.deepEqual(nativeSurfaceContract(ola.body).nativeClientURLs, direct)
  for (const [url, row] of assets) assert.doesNotThrow(() => assetContract(url, row.body))
})

test('Ola rejects an unreviewed executable added to the current public native shell', () => {
  assert.throws(() => nativeSurfaceContract(ola.body.replace('</body>', '<script src="/unreviewed-public-client.js"></script></body>')), /executable client/)
})

const currentScripts = body => body.replace(/(?:runtime-main\.[a-f0-9]+\.js|18\.[a-f0-9]+\.chunk\.js|main\.[a-f0-9]+\.chunk\.js)/g,
  value => new URL(direct.find(url => url.includes(value.startsWith('runtime-main.') ? '/runtime-main.' : value.startsWith('18.') ? '/18.' : '/main.'))).pathname.slice(1))
const replayOla = changedMain => {
  // Only the public client is current. A coherent historical-shape role below
  // is an explicit protocol control, never claimed as a live native vacancy.
  const role = syntheticRole('olaelectric'), requests = []
  const options = nativeOptions({ source: 'olaelectric', requests, mutate: ({ url, response }) => {
    if (url === FILTERED_JOBS_URL) return { body: JSON.stringify({ Total: 1, Result: [role.row] }), contentType: 'application/json' }
    if (url === jobURL(role.row.JobId)) return { body: currentScripts(role.render()), contentType: 'text/html' }
    if (url === publicJobURL(role.row.JobId)) return { body: JSON.stringify(role.dto), contentType: 'application/json' }
    if (url === ORIGIN + '/dashboardv2') return { body: ola.body, contentType: ola.contentType }
    return response
  } })
  const original = options.fetchImpl
  options.fetchImpl = async (url, init) => {
    if (!assets.has(url)) return original(url, init)
    requests.push({ url, method: init.method })
    const row = assets.get(url)
    return { status: 200, url, contentType: row.contentType, body: row.body + (changedMain && url.includes('/main.') ? '\nwindow.unreviewedHiringPath="/other-jobs";' : '') }
  }
  return { options, requests, role }
}

test('registered Ola Electric checks current client bytes before anonymous session and preserves all role guards across closing snapshots', async () => {
  const { options, requests, role } = replayOla(false)
  const jobs = await registered('olaelectric').run(options)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].legalEmployer, 'Ola Electric Mobility Ltd')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceDescription, role.dto.JobDescriptionV2)
  assert.equal(jobs[0].sourceScopeComplete, false)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(requests.filter(row => row.url === FILTERED_JOBS_URL).length, 2)
  assert.equal(requests.filter(row => row.url === publicJobURL(role.row.JobId)).length, 2)
  const token = requests.findIndex(row => row.url === NOAUTH_TOKEN_URL)
  assert.ok(token > requests.findIndex(row => row.url === direct.at(-1)))
})

test('Ola rejects changed bytes of the current native main client before any anonymous token read', async () => {
  const { options, requests } = replayOla(true)
  await assert.rejects(registered('olaelectric').run(options), /asset bytes changed/)
  assert.equal(requests.some(row => row.url === NOAUTH_TOKEN_URL), false)
})
