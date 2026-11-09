import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<html>
  <head><title>Careers - Paltech: Elevating Performance</title></head>
  <body>
    <div class="header-txt">
      <p style="position: absolute; top: -9999px;">casino bonus fara depunere</p>
    </div>
    <div id="open-positions" class="section careers-page_jobs">
      <div class="careers-page_jobs--list">
        <div class="careers-page_jobs--item">
          <h3><a href="https://pal-tech.com/jobs/business-analyst/">Business Analyst</a></h3>
          <div class="careers-page_jobs--item-extras">
            <span>Arlington, VA</span>
            <span>Project Management/Business Analysis</span>
            <span>Jan 4 2023</span>
          </div>
        </div>
      </div>
    </div>
    <div id="closed-positions" class="section careers-page_jobs">
      <div class="careers-page_jobs--item">
        <h3><a href="https://pal-tech.com/jobs/closed/">Closed Role</a></h3>
      </div>
    </div>
  </body>
</html>
`

const loadPaltechModule = async () => import('./script.js')

test('PalTech extracts only the verified open-positions section from the official careers page', async () => {
  const paltech = await loadPaltechModule()
  const jobs = paltech.extractOpenPositionListings(careersHtml)

  assert.equal(paltech.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(jobs, [
    {
      title: 'Business Analyst',
      company: 'PalTech',
      department: 'Project Management/Business Analysis',
      location: 'Arlington, VA, United States',
      city: 'Arlington',
      country: 'United States',
      jobId: 'business-analyst',
      requisitionId: 'business-analyst',
      sourceUrl: 'https://pal-tech.com/jobs/business-analyst/',
      applyUrl: 'https://pal-tech.com/jobs/business-analyst/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2023-01-04',
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('PalTech run decorates the official open role with shared runner fields', async () => {
  const paltech = await loadPaltechModule()
  const jobs = await paltech.createPaltechScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async () => careersHtml,
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'paltech')
  assert.equal(jobs[0].link, 'https://pal-tech.com/jobs/business-analyst/')
  assert.equal(jobs[0].scrapedAt, '2026-07-18T00:00:00.000Z')
})
