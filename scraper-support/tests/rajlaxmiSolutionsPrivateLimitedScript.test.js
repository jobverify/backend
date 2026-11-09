import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Us - Rajlaxmi</title>
  </head>
  <body>
    <main class="carrer-page-main" id="open-positions">
      <h2 class="carrer-page-main-h2">Current Openings</h2>
      <section class="carrer-page-job-listings" id="job-listings">
        <article class="carrer-page-job-card">
          <div class="carrer-page-job-head-grp">
            <h3 class="carrer-page-job-head">Accountant</h3>
            <p class="carrer-page-job-loc">Work from Office</p>
          </div>
          <p class="carrer-page-job-p">Experience Required: Minimum 5 years</p>
          <ul class="job-description-list">
            <li>Manage and oversee all aspects of financial accounting</li>
            <li>Finalize accounts, handle scrutiny, compliance, and taxation</li>
            <li>Experience in GST return filing and audits</li>
          </ul>
          <a href="#" class="carrer-page-btn-apply">Apply Now</a>
        </article>
        <article class="carrer-page-job-card">
          <div class="carrer-page-job-head-grp">
            <h3 class="carrer-page-job-head">Bitrix24 Developer</h3>
            <p class="carrer-page-job-loc">Work from Office</p>
          </div>
          <p class="carrer-page-job-p">Experience Required: Minimum 3 years</p>
          <ul class="job-description-list">
            <li>Customize and maintain Bitrix24 CRM workflows</li>
            <li>Develop integrations and automation for customer operations</li>
          </ul>
          <a href="#" class="carrer-page-btn-apply">Apply Now</a>
        </article>
        <article class="carrer-page-job-card">
          <div class="carrer-page-job-head-grp">
            <h3 class="carrer-page-job-head">ITSales Intern</h3>
            <p class="carrer-page-job-loc">Work from Office</p>
          </div>
          <p class="carrer-page-job-p">Experience Required: Fresher</p>
          <ul class="job-description-list">
            <li>Support IT sales outreach and lead qualification</li>
          </ul>
          <a href="#" class="carrer-page-btn-apply">Apply Now</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/rajlaxmisolutionsprivatelimited/script.js')
  } catch {
    assert.fail('Expected Rajlaxmi Solutions Private Limited scraper module at ../../scraper/rajlaxmisolutionsprivatelimited/script.js')
  }
}

test('Rajlaxmi Solutions Private Limited helpers stay pinned to the verified first-party join-us jobs surface', async () => {
  const rajlaxmi = await loadModule()

  assert.equal(rajlaxmi.SOURCE, 'rajlaxmisolutionsprivatelimited')
  assert.equal(rajlaxmi.COMPANY, 'Rajlaxmi Solutions Private Limited')
  assert.equal(rajlaxmi.CAREERS_URL, 'https://rajlaxmiworld.com/join-us/')
  assert.equal(rajlaxmi.VERIFIED_ON, '2026-07-17')
  assert.equal(rajlaxmi.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(rajlaxmi.extractListings(careersHtml), [
    {
      title: 'Accountant',
      locationLabel: 'Work from Office',
      experienceLabel: 'Minimum 5 years',
      descriptionItems: [
        'Manage and oversee all aspects of financial accounting',
        'Finalize accounts, handle scrutiny, compliance, and taxation',
        'Experience in GST return filing and audits',
      ],
    },
    {
      title: 'Bitrix24 Developer',
      locationLabel: 'Work from Office',
      experienceLabel: 'Minimum 3 years',
      descriptionItems: [
        'Customize and maintain Bitrix24 CRM workflows',
        'Develop integrations and automation for customer operations',
      ],
    },
    {
      title: 'ITSales Intern',
      locationLabel: 'Work from Office',
      experienceLabel: 'Fresher',
      descriptionItems: [
        'Support IT sales outreach and lead qualification',
      ],
    },
  ])
})

test('Rajlaxmi Solutions Private Limited run validates the first-party page and returns normalized jobs', async () => {
  const rajlaxmi = await loadModule()

  const jobs = await rajlaxmi.createRajlaxmiSolutionsPrivateLimitedScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, rajlaxmi.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Accountant',
    company: 'Rajlaxmi Solutions Private Limited',
    department: null,
    location: 'Work from Office, India',
    city: null,
    country: 'India',
    jobId: 'accountant',
    requisitionId: 'accountant',
    sourceUrl: 'https://rajlaxmiworld.com/join-us/#accountant',
    applyUrl: 'https://rajlaxmiworld.com/join-us/#accountant',
    employmentType: 'Full-time',
    experienceRequired: 'Minimum 5 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Manage and oversee all aspects of financial accounting Finalize accounts, handle scrutiny, compliance, and taxation Experience in GST return filing and audits',
    remoteStatus: 'On-site',
    source: 'rajlaxmisolutionsprivatelimited',
    link: 'https://rajlaxmiworld.com/join-us/#accountant',
    scrapedAt: FIXED_SCRAPED_AT,
    companyCareerPage: 'https://rajlaxmiworld.com/join-us/',
    companyDomain: 'rajlaxmiworld.com',
    atsPlatform: 'official-company-careers',
  })
  assert.equal(jobs[1].title, 'Bitrix24 Developer')
  assert.equal(jobs[2].employmentType, 'Internship')
  assert.equal(jobs[2].remoteStatus, 'On-site')
})

test('Rajlaxmi Solutions Private Limited fails closed when the verified first-party join-us contract drifts', async () => {
  const rajlaxmi = await loadModule()

  await assert.rejects(
    rajlaxmi.createRajlaxmiSolutionsPrivateLimitedScraper().run({
      fetchText: async () => '<html><body><h1>Join Us</h1></body></html>',
    }),
    /verified Rajlaxmi Solutions Private Limited careers page/i,
  )
})
