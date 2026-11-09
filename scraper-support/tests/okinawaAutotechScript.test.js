import assert from 'node:assert/strict'
import test from 'node:test'
import { readFile } from 'node:fs/promises'

import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head><title>Careers | Okinawa</title></head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Current Openings</h2>
      <article class="career-card">
        <h3>AM/Manager Dealer Development</h3>
        <p>Department Dealer Development</p>
        <p>Location Gurugram</p>
        <p>Experience Required: 7-12 years</p>
        <p>Job Code: DD-01</p>
        <a href="/applynow.aspx?jobid=11&amp;mpgid=45&amp;pgidtrail=45">Apply Now</a>
      </article>
    </main>
    <footer>Copyright Okinawa Autotec Private Limited (formerly known as Okinawa Autotech Internationall Private Limited)</footer>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/okinawaautotech/script.js')
  } catch {
    assert.fail('Expected Okinawa Autotech scraper module at ../../scraper/okinawaautotech/script.js')
  }
}

test('Okinawa Autotech is registered as an exact-company official careers provider', () => {
  const provider = getScraperCatalog().find((item) => item.source === 'okinawaautotech')
  const scraper = buildScrapers().find((item) => item.name === 'okinawaautotech')

  assert.ok(provider)
  assert.ok(scraper)
  assert.equal(provider.companyName, 'Okinawa Autotech')
  assert.equal(provider.exactCompanyMatchOnly, true)
  assert.equal(provider.companyDomain, 'okinawascooters.com')
  assert.equal(provider.companyCareerPage, 'https://okinawascooters.com/career')
  assert.match(scraper.dryRunFile, /okinawaautotech[\\/]jobs\.json$/i)

  const report = generateCompanyCoverageReport({
    csvText: 'company_name\nOkinawa Autotech\nOkinawa Autotech Pvt Ltd\n',
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, 1)
  assert.deepEqual(report.matched.map(({ companyName, source }) => [companyName, source]), [
    ['Okinawa Autotech', 'okinawaautotech'],
  ])
  assert.deepEqual(report.unmatched.map(({ companyName }) => companyName), ['Okinawa Autotech Pvt Ltd'])
})

test('Okinawa Autotech extracts only official first-party career cards', async () => {
  const okinawa = await loadScriptModule()

  assert.equal(okinawa.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.deepEqual(okinawa.extractJobCards(CAREERS_HTML), [{
    title: 'AM/Manager Dealer Development',
    department: 'Dealer Development',
    location: 'Gurugram',
    experienceRequired: '7-12 years',
    jobId: 'DD-01',
    applyUrl: 'https://okinawascooters.com/applynow.aspx?jobid=11&mpgid=45&pgidtrail=45',
  }])

  const jobs = await okinawa.createOkinawaAutotechScraper().run({
    fetchText: async (url) => {
      if (url.includes('careerdetail.aspx')) return readFile(new URL('../../scraper/okinawaautotech/fixtures/current-detail.html', import.meta.url), 'utf8')
      if (url.includes('applynow.aspx')) return readFile(new URL('../../scraper/okinawaautotech/fixtures/current-application.html', import.meta.url), 'utf8')
      return CAREERS_HTML.replace('</article>', '<a href="/careerdetail.aspx?jobid=11">View Detail</a></article>')
    },
    now: () => '2026-07-26T00:00:00.000Z',
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Okinawa Autotech')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'okinawaautotech')
})

test('Okinawa Autotech fails closed when the official career surface drifts or links away', async () => {
  const okinawa = await loadScriptModule()

  await assert.rejects(
    okinawa.createOkinawaAutotechScraper().run({
      fetchText: async () => '<html><body><h1>Current Openings</h1></body></html>',
    }),
    /trusted first-party surface/i,
  )

  await assert.rejects(
    okinawa.createOkinawaAutotechScraper().run({
      fetchText: async () => CAREERS_HTML.replace(
        '/applynow.aspx?jobid=11&amp;mpgid=45&amp;pgidtrail=45',
        'https://example.com/jobs/11',
      ),
    }),
    /official first-party apply URL/i,
  )
})
