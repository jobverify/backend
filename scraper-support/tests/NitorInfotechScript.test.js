import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-03T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Nitor Infotech, an Ascendion Company</title>
  </head>
  <body>
    <h1>Careers at Nitor Infotech, an Ascendion Company</h1>
    <a href="/opening">View Our Current Openings</a>
  </body>
</html>
`

const openingsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Work With Us</h1>
    <div class="sec-part" id="engineering-manager-section">
      <h6 class="job-title">Engineering Manager</h6>
      <p class="job-location">Pune, India</p>
      <p class="job-experience">10+ Years</p>
      <p class="job-skill">Leadership, Java, Delivery</p>
      <input id="desc-text" class="hidden" value="Lead cross-functional teams building modern data and cloud platforms." />
    </div>
    <div class="sec-part" id="devops-architect-section">
      <h6 class="job-title">DevOps Architect</h6>
      <p class="job-location">Pune, India</p>
      <p class="job-experience">12+ Years</p>
      <p class="job-skill">AWS, Terraform</p>
      <input id="desc-text" class="hidden" value="Own platform automation and reliability architecture." />
    </div>
    <div class="sec-part" id="canada-role-section">
      <h6 class="job-title">Data Platform Consultant</h6>
      <p class="job-location">Toronto, Canada</p>
      <p class="job-experience">8+ Years</p>
      <input id="desc-text" class="hidden" value="Should be filtered out." />
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/nitorinfotech/script.js')
  } catch {
    assert.fail('Expected Nitor Infotech scraper module at ../../scraper/nitorinfotech/script.js')
  }
}

test('Nitor Infotech validates the verified openings page and keeps only India roles', async () => {
  const nitor = await loadModule()

  assert.equal(nitor.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(nitor.extractOpeningsUrl(careersHtml), nitor.OPENINGS_URL)
  assert.equal(nitor.hasOpeningsPageSignal(openingsHtml), true)

  const jobs = await nitor.createNitorInfotechScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      if (url === nitor.CAREERS_URL) return careersHtml
      if (url === nitor.OPENINGS_URL) return openingsHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [
    {
      title: 'Engineering Manager',
      company: 'Nitor Infotech, an Ascendion company',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'engineering-manager',
      requisitionId: 'engineering-manager',
      sourceUrl: 'https://careers.nitorinfotech.com/opening',
      applyUrl: 'https://careers.nitorinfotech.com/opening',
      employmentType: null,
      experienceRequired: '10+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Leadership', 'Java', 'Delivery'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead cross-functional teams building modern data and cloud platforms.',
      source: 'nitorinfotech',
      companyCareerPage: 'https://careers.nitorinfotech.com/',
      companyDomain: 'nitorinfotech.com',
      atsPlatform: 'official-company-careers',
      link: 'https://careers.nitorinfotech.com/opening',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'DevOps Architect',
      company: 'Nitor Infotech, an Ascendion company',
      department: null,
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'devops-architect',
      requisitionId: 'devops-architect',
      sourceUrl: 'https://careers.nitorinfotech.com/opening',
      applyUrl: 'https://careers.nitorinfotech.com/opening',
      employmentType: null,
      experienceRequired: '12+ Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['AWS', 'Terraform'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Own platform automation and reliability architecture.',
      source: 'nitorinfotech',
      companyCareerPage: 'https://careers.nitorinfotech.com/',
      companyDomain: 'nitorinfotech.com',
      atsPlatform: 'official-company-careers',
      link: 'https://careers.nitorinfotech.com/opening',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Nitor Infotech fails closed when the openings shell changes materially', async () => {
  const nitor = await loadModule()

  await assert.rejects(
    nitor.createNitorInfotechScraper().run({
      fetchText: async (url) => {
        if (url === nitor.CAREERS_URL) return careersHtml
        return '<html><body><h1>Openings</h1></body></html>'
      },
    }),
    /trusted public jobs surface/i,
  )
})
