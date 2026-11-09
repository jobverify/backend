import assert from 'node:assert/strict'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { readInventoryEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'

const provider = getScraperCatalog().find(p => p.source === 'conduktor')
const careers = '<title>Careers - Join Our Team | Conduktor</title><h1>Join a Team of Builders</h1><a href="/careers/open-roles">Open Roles</a>'
const shell = content => `<title>Open Roles | Conduktor</title><h1>Open Roles</h1>${content}`
const empty = '<h2>No Open Roles Right Now</h2><p>We don\'t have any open positions at the moment</p>'
const anchor = '<a href="https://jobs.lever.co/conduktor/role-1">Apply</a>'
const run = (html, fetchJson = async () => assert.fail('an empty or unbound page must not fetch a guessed board')) =>
  createCatalogScraper(provider).run({
    fetchPage: async url => ({ status: 200, url, html: url === provider.companyCareerPage ? careers : shell(html) }), fetchJson,
  })
const role = (id, location = 'Bengaluru, India') => ({
  id, text: 'Software Engineer', categories: { location },
  hostedUrl: `https://jobs.lever.co/conduktor/${id}`,
  applyUrl: `https://jobs.lever.co/conduktor/${id}/apply`,
  descriptionPlain: 'Build native employer streaming infrastructure.',
})

test('Conduktor supplies current verified-empty evidence for its explicit official no-open-roles state', async () => {
  const jobs = await run(empty)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
  assert.equal(readInventoryEvidence(jobs).surface, 'https://www.conduktor.io/careers/open-roles')
})

test('Conduktor follows an active exact-employer handoff and extracts native India roles', async () => {
  const jobs = await run(anchor, async url => {
    assert.equal(url, 'https://api.lever.co/v0/postings/conduktor?mode=json')
    return [role('role-1'), role('role-2', 'Boston, United States')]
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'role-1')
  assert.equal(jobs[0].company, 'Conduktor')
  assert.match(jobs[0].jobDescription, /streaming infrastructure/)
  assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs)), true)
})

test('Conduktor never uses a commented, hidden, script-only or wrong-employer handoff', async () => {
  for (const html of [`<!-- ${anchor} -->`, `<div hidden>${anchor}</div>`, `<script>${JSON.stringify(anchor)}</script>`,
    '<a href="https://jobs.lever.co/other/role-1">Apply</a>']) {
    await assert.rejects(run(html), /Conduktor.*(?:binding|surface|public jobs)/i)
  }
})

test('Conduktor hidden empty-state text cannot certify an empty inventory', async () => {
  for (const html of [`<div hidden>${empty}</div>`, `<script>${JSON.stringify(empty)}</script>`, `<!-- ${empty} -->`]) {
    await assert.rejects(run(html), /Conduktor.*(?:surface|empty|inventory)/i)
  }
})

test('Conduktor conflicting empty and active recruiting states cannot certify completion', async () => {
  await assert.rejects(run(empty + anchor), /Conduktor.*(?:conflict|contradict)/i)
})

test('Conduktor native feed failures propagate without becoming empty inventory', async () => {
  await assert.rejects(run(anchor, async () => { throw new Error('HTTP 503 native feed') }), /503/)
})

test('Conduktor rejects native roles bound to another employer or another role identity', async () => {
  for (const urls of [
    { hostedUrl: 'https://jobs.lever.co/other/role-1', applyUrl: 'https://jobs.lever.co/other/role-1/apply' },
    { hostedUrl: 'https://jobs.lever.co/conduktor/other-role' },
    { applyUrl: 'https://jobs.lever.co/conduktor/other-role/apply' },
    { applyUrl: 'https://user@jobs.lever.co/conduktor/role-1/apply' },
  ]) await assert.rejects(run(anchor, async () => [{ ...role('role-1'), ...urls }]), /identity|board|URL/i)
})

test('Conduktor active role links must reconcile with the complete delegated inventory', async () => {
  for (const rows of [[], [role('different-role')]]) {
    await assert.rejects(run(anchor, async () => rows), /Conduktor.*(?:contradict|reconcil)/i)
  }
  // A visible foreign role still reconciles, even though it is excluded from India output.
  const jobs = await run(anchor, async () => [role('role-1', 'Boston, United States')])
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).status, 'complete-inventory')
})

test('Conduktor retains supported employer apostrophe forms in its active empty state', async () => {
  for (const apostrophe of ['&rsquo;', '&#8217;', '’']) {
    const jobs = await run(empty.replace("don't", `don${apostrophe}t`))
    assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  }
})
