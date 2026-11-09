import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import * as cognus from '../../scraper/cognustechnology/script.js'

const fixture = name => readFileSync(new URL(`./fixtures/cognustechnology/${name}`, import.meta.url), 'utf8')
const listing = fixture('listing.html')
const expected = [
  { id: '61921000006650070', title: 'Fractional Head of Engineering', date: '2026-09-14', country: 'Cognus', state: 'Udaipur', text: /Drive engineering execution across Gradding and MySIPOnline/ },
  { id: '61921000006710038', title: 'Operations Executive', date: '2026-10-22', country: 'Gradding', state: 'Rajasthan', text: /Tutor Management/ },
  { id: '61921000006581008', title: 'Sales Executive', date: '2026-08-11', country: 'Cognus', state: 'Udaipur', text: /mutual fund sales, SIP registrations/ },
]
const nativeUrl = role => `${cognus.CAREERS_URL}/${role.id}/${role.title.replaceAll(' ', '-')}?source=CareerSite`
const homepage = `<nav>Life At Cognus <a href="${cognus.CAREERS_URL}">Join Us</a></nav>`
const replay = (overrides = {}) => cognus.run({
  fetchText: async url => {
    if (url === cognus.HOMEPAGE_URL) return homepage
    if (url === cognus.CAREERS_URL) return listing
    assert.fail(`Unexpected listing request: ${url}`)
  },
  fetchDetail: async url => {
    const role = expected.find(role => nativeUrl(role) === url)
    assert.ok(role, `Unverified detail URL: ${url}`)
    return { status: 200, url, html: fixture(`detail-${role.id}.html`) }
  },
  now: () => '2026-10-29T17:32:02.977Z',
  ...overrides,
})

test('Cognus recovers all three exact native bodies and requisition opening dates while holding unknown country and publication', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 3)
  for (const role of expected) {
    const job = jobs.find(job => job.requisitionId === role.id)
    assert.match(job.sourceDescription, role.text)
    assert.match(job.sourceDescription, /Requirements/)
    assert.equal(job.postingDate, null)
    assert.equal(job.nativeDateOpened, role.date)
    assert.equal(job.sourceDateEvidence, 'native-requisition-date-opened;publication-date-unknown')
    assert.equal(job.sourceUrl, nativeUrl(role))
    assert.equal(job.sourceDetailUrl, nativeUrl(role))
    assert.equal(job.country, null)
    assert.equal(job.nativeLocationEvidence.Country, role.country)
    assert.equal(job.location, null)
    assert.equal(job.state, null)
    assert.equal(job.city, null)
    assert.equal(job.postalCode, null)
    assert.equal(job.nativeLocationEvidence.State, role.state)
    assert.equal(job.nativeLocationEvidence.City, 'Udaipur')
    assert.equal(job.nativeLocationEvidence.Zip_Code, '313001')
    assert.equal(job.sourceDetailContentComplete, true)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.sourceDetailFailureKind, 'malformed-native-country')
    assert.equal(job.publicationEligible, undefined)
  }
})

test('Cognus ignores unrelated/nested jobs data and rejects wrong tenant, canonical URL, id or title', async () => {
  const first = expected[0], original = fixture(`detail-${first.id}.html`)
  const variants = [
    original.replace('var jobs =', 'function unused(){ var jobs =').replace('</script>', '}</script>'),
    original.replaceAll('cognustechnology.zohorecruit.in', 'other.zohorecruit.in'),
    original.replace('company_name":"Cognus Technology"', 'company_name":"Other Company"'),
    original.replace('61921000000214518', '61921000000999999'),
    original.replaceAll(first.id, '61921000009999999'),
    original.replaceAll('Fractional Head of Engineering', 'Unrelated Engineering Position'),
    original.replace('var jobs =', 'var unrelatedJobs ='),
    original.replace('</script>', ';var jobs=[];</script>'),
  ]
  for (const changed of variants) {
    const jobs = await replay({ fetchDetail: async url => ({ status: 200, url, html: changed }) })
    const job = jobs.find(job => job.requisitionId === first.id)
    assert.equal(job.sourceDescription, null)
    assert.equal(job.postingDate, null)
    assert.equal(job.sourceDetailComplete, false)
  }
})

test('Cognus parses JSON.parse string literals and static arrays without executing downloaded scripts', async () => {
  const jobs = await replay({ fetchDetail: async url => {
    const role = expected.find(role => nativeUrl(role) === url)
    return { status: 200, url, html: fixture(`detail-${role.id}.html`).replace('<script>', '<script>throw new Error("never execute");') }
  } })
  assert.equal(jobs.filter(job => job.sourceDetailContentComplete).length, 3)
  const literal = `<script>var jobs=[${JSON.stringify({ id: expected[0].id, Posting_Title: expected[0].title,
    Job_Opening_Name: expected[0].title, Publish: true, Is_Locked: false, Country: 'India', City: 'Udaipur',
    State: 'Rajasthan', Zip_Code: '313001', Date_Opened: '2026-09-14',
    Job_Description: '<h2>Responsibilities</h2><p>Drive engineering execution across Gradding and MySIPOnline with its technology lead and engineering teams.</p>' })}];
    var meta=${JSON.stringify({ org_info: { company_name: cognus.COMPANY, id: '61921000000214518' },
      page_id: '61921000000214664', list_url: cognus.CAREERS_URL, detail_url: nativeUrl(expected[0]) })};
    var moduleMeta=[{api_name:'Job_Openings',id:'61921000000002481',fields:[]}];</script>`
  const staticJobs = await replay({ fetchDetail: async url => ({ status: 200, url, html: literal }) })
  assert.equal(staticJobs[0].sourceDetailContentComplete, true)
  assert.equal(staticJobs[0].sourceDetailComplete, true)
  assert.equal(staticJobs[0].country, 'India')
  assert.match(staticJobs[0].sourceDescription, /Drive engineering execution/)
  const dynamic = await replay({ fetchDetail: async url => ({ status: 200, url,
    html: literal.replace('var jobs=[', 'var jobs=loadJobs([').replace('];\n    var meta=', ']);\n    var meta=') }) })
  assert.ok(dynamic.every(job => !job.sourceDetailContentComplete))
})

test('Cognus retains listing rows with explicit failure on HTTP denial, redirect, or unavailable detail', async () => {
  for (const fetchDetail of [
    async () => { throw new Error('network unavailable') },
    async url => ({ status: 403, url, html: fixture(`detail-${expected[0].id}.html`) }),
    async () => ({ status: 200, url: 'https://foreign.example/job', html: fixture(`detail-${expected[0].id}.html`) }),
  ]) {
    const jobs = await replay({ fetchDetail })
    assert.equal(jobs.length, 3)
    assert.ok(jobs.every(job => job.sourceDescription === null && job.postingDate === null && !job.sourceDetailComplete && job.sourceDetailFailureKind))
    assert.ok(jobs.every(job => job.country !== 'India'))
  }
})

test('Cognus native HTTP requests prohibit automatic redirects and include a cancellation deadline', async context => {
  const requests = []
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url, options })
    const role = expected.find(role => nativeUrl(role) === url)
    return { ok: true, status: 200, url, headers: new Headers(), text: async () => fixture(`detail-${role.id}.html`) }
  })
  const jobs = await replay({ fetchDetail: undefined })
  assert.ok(jobs.every(job => job.sourceDetailContentComplete && job.sourceDescription))
  assert.equal(requests.length, 3)
  for (const { url, options } of requests) {
    assert.ok(expected.some(role => nativeUrl(role) === url))
    assert.equal(options.redirect, 'manual')
    assert.ok(options.signal instanceof AbortSignal)
  }
})
