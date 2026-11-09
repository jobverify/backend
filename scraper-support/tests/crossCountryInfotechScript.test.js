import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T08:30:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Join Our Community at CCI</h1>
    <h2>Currently open positions</h2>
    <section>
      <h3>Team Lead - BPO (Female Preferred)</h3>
      <div>Must have skills</div>
      <p>Team Lead, International BPO experience in Voice and Non-Voice Process</p>
      <div>Notice Period</div>
      <p>Immediate joiners preferred or maximum up to 45 days</p>
      <div>Experience</div>
      <p>6 - 11 years</p>
      <div>Work location</div>
      <p>Work from office, Pune MH</p>
      <p>US Shift</p>
      <a href="/careers/apply/team-lead-bpo">Apply Now</a>
    </section>
    <section>
      <h3>Project Manager PMO</h3>
      <div>Must have skills</div>
      <p>PMO Governance, Technical Project Manager with SDLC, Jira/Confluence, Scrum/Agile</p>
      <div>Experience</div>
      <p>10 to 15 Years</p>
      <div>Work location</div>
      <p>Pune MH</p>
      <a href="/careers/apply/project-manager-pmo">Apply Now</a>
    </section>
    <footer>CCICareers@crosscountry.com</footer>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/crosscountryinfotech/script.js')
  } catch {
    assert.fail('Expected Cross Country Infotech scraper module at ../../scraper/crosscountryinfotech/script.js')
  }
}

test('Cross Country Infotech helpers stay pinned to the verified first-party careers shell', async () => {
  const cci = await loadModule()

  assert.equal(cci.SOURCE, 'crosscountryinfotech')
  assert.equal(cci.COMPANY, 'Cross Country Infotech')
  assert.equal(cci.CAREERS_URL, 'https://www.crosscountry.in/careers')
  assert.equal(cci.VERIFIED_ON, '2026-07-18')
  assert.equal(cci.hasOfficialCareersSignal(careersHtml), true)
})

test('Cross Country Infotech run parses unique openings from the first-party careers page', async () => {
  const cci = await loadModule()
  const jobs = await cci.createCrossCountryInfotechScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, cci.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].company, 'Cross Country Infotech')
  assert.equal(jobs[0].source, 'crosscountryinfotech')
  assert.equal(jobs[0].location, 'Pune MH, India')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].applyUrl, 'https://www.crosscountry.in/careers/apply/team-lead-bpo')
  assert.equal(jobs[1].title, 'Project Manager PMO')
})

test('Cross Country Infotech fails closed when the trusted careers shell changes materially', async () => {
  const cci = await loadModule()

  await assert.rejects(
    cci.createCrossCountryInfotechScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified Cross Country Infotech careers shell/i,
  )
})
