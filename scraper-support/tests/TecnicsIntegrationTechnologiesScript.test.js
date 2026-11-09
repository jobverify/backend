import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/tecnicsintegrationtechnologies/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
const directory = new URL('./fixtures/tecnics/', import.meta.url)
const text = (name) => readFileSync(new URL(name + '.txt', directory), 'utf8')
const bodies = { 'https://tecnics.com/': text('current-home'), 'https://tecnics.com/robots.txt': text('robots'), 'https://tecnics.com/sitemap.xml': text('sitemap'), 'https://tecnics.com/company/about': text('current-about'), 'https://tecnics.com/contact': text('current-contact') }
const requests = []
const execute = (mutate = (body) => body, failUrl = null) => source.run({ fetchText: async (url) => {
  requests.push(url)
  if (url === failUrl) throw new Error('HTTP503 ' + url)
  if (!Object.hasOwn(bodies, url)) throw new Error('Unexpected Tecnics discovery URL ' + url)
  return mutate(bodies[url], url)
} })

test('Tecnics validates the migrated company site instead of retrying retired APAC job cards', () => {
  assert.equal(source.hasOfficialHomepageSignal(text('current-home')), true)
  assert.equal(source.CAREERS_URL, 'https://tecnics.com/')
  assert.equal(source.APPLY_URL, null)
  assert.equal(source.VERIFIED_ON, '2026-10-08')
})

test('Tecnics returns discovery-only incomplete evidence with unknown job counts from the current site and49-URL sitemap', async () => {
  requests.length = 0
  const jobs = await execute()
  assert.equal(jobs.length, 0)
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.firstParty, true)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.match(evidence.reason, /49.*sitemap.*not.*job inventory/i)
  assert.ok(!requests.some((url) => url.includes('/careers')))
  assert.equal(requests.length, 5)
})

test('Tecnics fails if current identity or published sitemap continuity changes', async () => {
  for (const mutate of [
    (body, url) => url === source.CAREERS_URL ? body.replace(/Identity Security &amp; Managed IAM Services/g, 'Another company') : body,
    (body, url) => url.endsWith('/robots.txt') ? body.replace('https://tecnics.com/sitemap.xml', 'https://other.example/sitemap.xml') : body,
    (body, url) => url.endsWith('/sitemap.xml') ? body.replace('https://tecnics.com/contact', 'https://other.example/contact') : body,
    (body, url) => url.endsWith('/sitemap.xml') ? body.replace(/<url>[\s\S]*?<\/url>/, '') : body,
  ]) await assert.rejects(execute(mutate), /Tecnics.*(?:identity|sitemap|discovery|surface)/i)
})

test('Tecnics requires re-verification when a new public careers route or ATS handoff appears', async () => {
  await assert.rejects(execute((body, url) => url.endsWith('/sitemap.xml') ? body.replace('</urlset>', '<url><loc>https://tecnics.com/company/careers</loc></url></urlset>') : body), /Tecnics.*(?:careers|recruit|handoff|jobs)/i)
  await assert.rejects(execute((body, url) => url === source.CAREERS_URL ? body.replace('</body>', '<a href="https://jobs.lever.co/tecnics">Jobs</a></body>') : body), /Tecnics.*(?:careers|recruit|handoff|jobs)/i)
})

test('Tecnics keeps required discovery transport failures and cancellation as failures', async () => {
  await assert.rejects(execute(undefined, 'https://tecnics.com/sitemap.xml'), /HTTP503/)
  const controller = new AbortController()
  controller.abort(new Error('cancel Tecnics discovery'))
  requests.length = 0
  await assert.rejects(source.run({ signal: controller.signal, fetchText: async (url) => { requests.push(url) } }), /cancel Tecnics discovery/)
  assert.equal(requests.length, 0)
})
