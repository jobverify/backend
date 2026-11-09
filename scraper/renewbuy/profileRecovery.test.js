import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { document } from '../../scraper-support/shared/rmkNativePairHtml.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { run, PROFILE_URL, JOBS_URL } from './script.js'

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url)))
const receipts = [...fixture('official-responses'), ...fixture('native-profile-recovery-20261106').responses]
const nativeRole = url => new URL(url).pathname.startsWith('/jobs/view/')
const options = (transform = row => row, calls = []) => ({
  now: () => '2026-11-06T06:56:00.000Z', maxJobs: 3,
  fetchImpl: async url => {
    calls.push(url)
    const receipt = receipts.find(row => row.url === url || nativeRole(url) && new URL(row.url).origin === new URL(url).origin && new URL(row.url).pathname === new URL(url).pathname)
    assert.ok(receipt, 'Uncaptured public URL ' + url)
    const row = transform({ ...receipt, url, body: receipt.body })
    return { status: row.status, url, body: new Response(row.body).body, headers: new Headers() }
  },
})
const mutateSchema = (html, change) => {
  const doc = document(html)
  const node = doc.nodes(n => n.tag === 'script' && n.attrs.type === 'application/ld+json').find(n => JSON.parse(n.raw)['@type'] === 'JobPosting')
  const value = JSON.parse(node.raw); change(value)
  return html.replace(node.raw, JSON.stringify(value))
}

for (const status of [403, 429]) test(`RenewBuy recovers three current native roles with strict employer self-identification after profile HTTP ${status}`, async () => {
  const jobs = await run(options(row => row.url === PROFILE_URL ? { ...row, status } : row))
  assert.deepEqual(jobs.map(job => job.jobId), ['4457850766', '4457857705', '4457866682'])
  assert.ok(jobs.every(job => job.company === 'RenewBuy' && job.country === 'India' && job.sourceDetailComplete && job.sourceScopeComplete === false && job.lifecycleCleanupAllowed === false))
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.firstParty, false)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 138)
  assert.match(evidence.reason, new RegExp('profile HTTP ' + status))
  assert.match(evidence.reason, /D2C Insurance Broking Private Limited/)
})

test('RenewBuy default recovery stops after three independently verified roles', async () => {
  const calls = [], config = options(undefined, calls)
  delete config.maxJobs
  const jobs = await run(config)
  assert.equal(jobs.length, 3)
  assert.equal(calls.filter(nativeRole).length, 3)
})

for (const [label, description] of [
  ['an identity-only description', 'Company: RenewBuy.com (D2C Insurance Broking Private Limited)'],
  ['headings plus employer identity without substantive role content', '<h2>Responsibilities and qualifications for this position</h2><p>Company: RenewBuy.com (D2C Insurance Broking Private Limited)</p>'],
]) test(`RenewBuy unavailable-profile recovery rejects ${label}`, async () => {
  await assert.rejects(run(options(row => {
    if (!nativeRole(row.url)) return row
    let html = mutateSchema(row.body, s => { s.description = description })
    const doc = document(html)
    for (const node of doc.nodes(n => n.tag === 'div' && doc.hasClass(n, 'show-more-less-html__markup'))) html = html.replace(doc.inner(node), description)
    return { ...row, body: html }
  })), /native substantive description/)
})

const cases = [
  ['wrong native company ID', html => html.replace('name="companyId" content="9350817"', 'name="companyId" content="1234567"'), /native detail company ID/],
  ['duplicate native company ID', html => html.replace('</head>', '<meta name="companyId" content="9350817"></head>'), /native detail company ID/],
  ['wrong legal name', html => html.replaceAll('D2C Insurance Broking Private Limited', 'Unrelated Insurance Private Limited'), /native legal employer/],
  ['wrong company domain', html => html.replaceAll('RenewBuy.com', 'Unrelated.example'), /native legal employer/],
  ['domain suffix masquerade', html => html.replaceAll('RenewBuy.com', 'RenewBuy.com.unrelated.example'), /native legal employer/],
  ['wrong employer profile', html => mutateSchema(html, s => { s.hiringOrganization.sameAs = 'https://in.linkedin.com/company/unrelated' }), /employer identity/],
  ['contradictory country', html => mutateSchema(html, s => { s.jobLocation.address.addressCountry = 'US' }), /country conflict/],
  ['future publication', html => mutateSchema(html, s => { s.datePosted = '2027-01-01T00:00:00Z' }), /posting date conflict/],
  ['missing publication', html => mutateSchema(html, s => { delete s.datePosted }), /date/i],
  ['different role title', html => mutateSchema(html, s => { s.title = 'Unrelated position' }), /employer\/title conflict/],
  ['missing native application', html => html.replace('id="topbar-apply"', 'id="removed-apply"'), /native application/],
  ['hidden employer self-identification', html => html.replace('class="show-more-less-html__markup', 'hidden class="show-more-less-html__markup'), /native legal employer/],
]
for (const [label, change, reason] of cases) test(`RenewBuy unavailable-profile recovery rejects ${label}`, async () => {
  await assert.rejects(run(options(row => nativeRole(row.url) ? { ...row, body: change(row.body) } : row)), reason)
})

test('RenewBuy does not use fallback after successful profile content changes', async () => {
  const calls = []
  await assert.rejects(run(options(row => row.url === PROFILE_URL ? { ...row, status: 200, body: '<h1>Unrelated employer</h1>' } : row, calls)), /company canonical/)
  assert.equal(calls.includes(JOBS_URL), false)
})

test('RenewBuy does not use fallback for profile HTTP 503', async () => {
  const calls = []
  await assert.rejects(run(options(row => row.url === PROFILE_URL ? { ...row, status: 503 } : row, calls)), error => error.status === 503 && error.requestUrl === PROFILE_URL)
  assert.equal(calls.includes(JOBS_URL), false)
})

test('RenewBuy unavailable-profile recovery keeps failed listing HTTP status and surface', async () => {
  await assert.rejects(run(options(row => row.url === JOBS_URL ? { ...row, status: 403, body: 'Forbidden' } : row)), error => error.status === 403 && error.requestUrl === JOBS_URL && error.inventoryEvidence.status === 'coverage-gap' && error.inventoryEvidence.reportedTotal === null)
})
