import assert from 'node:assert/strict'
import test from 'node:test'
import { assertMappedInventoryEvidence } from './helpers/assertMappedInventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-17T14:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Careers</h1>
      <p>We’re a fintech with scale, legacy and proof.</p>
      <a href="https://ig.wd103.myworkdayjobs.com/EXT_IG">Find a role you love</a>
      <p>Imagine, ideate, innovate.</p>
    </main>
  </body>
</html>
`

const contactPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Contact</h1>
      <h2>Bengaluru</h2>
      <p>IG Infotech India Private Limited</p>
      <p>Anjenaya Infinity, 2nd Floor</p>
      <p>Domlur, Bengaluru 560071</p>
      <p>Tel: +91 80 6818 8000</p>
    </main>
  </body>
</html>
`

const workdayListingHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <article class="job-card">
        <a href="https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Bangalore-India/Head-of-Workforce-Management_R_17283">Head Of Workforce Management</a>
        <span class="job-location">Bangalore, India</span>
      </article>
      <article class="job-card">
        <a href="https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Content-Producer_R_17451">Content Producer</a>
        <span class="job-location">Bangalore, India</span>
      </article>
      <article class="job-card">
        <a href="https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Web---SEO-Copywriter_R_16566">Web & SEO Copywriter</a>
        <span class="job-location">Bangalore, India</span>
      </article>
      <article class="job-card">
        <a href="https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/London-UK/Enterprise-Change-Manager_R_19999">Enterprise Change Manager</a>
        <span class="job-location">London, UK</span>
      </article>
    </main>
  </body>
</html>
`

const liveWorkdayShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://ig.wd103.myworkdayjobs.com/EXT_IG" />
    <meta
      property="og:description"
      content="Looking for a career at a company that will support you, challenge you and help you grow? IG Group can provide that."
    />
    <script src="/assets/cx-jobs.min.js"></script>
    <script>
      window.workday = { tenant: "ig", siteId: "EXT_IG" }
    </script>
  </head>
  <body></body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/iginfotechindia.workday/script.js')
  } catch {
    assert.fail('Expected IG Infotech India scraper module at ../../scraper/iginfotechindia.workday/script.js')
  }
}

test('IG company decoration retains native Workday inventory authority', async t => {
  const ig = await loadModule()
  await assertMappedInventoryEvidence(t, jobs => ig.createIgInfotechIndiaScraper({
    workdayRunner: async () => jobs,
  }).run({ fetchText: async url => {
    if (url === ig.CAREERS_URL) return careersPageHtml
    if (url === ig.CONTACT_PAGE_URL) return contactPageHtml
    if (url === ig.WORKDAY_LISTING_URL) return liveWorkdayShellHtml
    throw new Error(`Unexpected inventory fixture URL: ${url}`)
  } }), { surface: ig.WORKDAY_LISTING_URL,
    job: { title: 'Engineer', jobId: 'R_17283', country: 'India' } })
})

test('IG Infotech India helpers stay pinned to the verified careers page, Bengaluru entity page, and Workday listing contract', async () => {
  const ig = await loadModule()

  assert.equal(ig.SOURCE, 'iginfotechindia')
  assert.equal(ig.COMPANY, 'IG Infotech India')
  assert.equal(ig.CAREERS_URL, 'https://www.iggroup.com/about-us/careers')
  assert.equal(ig.CONTACT_PAGE_URL, 'https://www.iggroup.com/contact-page')
  assert.equal(ig.WORKDAY_LISTING_URL, 'https://ig.wd103.myworkdayjobs.com/EXT_IG')
  assert.equal(ig.WORKDAY_TENANT_HOST, 'https://ig.wd103.myworkdayjobs.com/')
  assert.equal(ig.VERIFIED_ON, '2026-08-01')
  assert.equal(ig.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(ig.hasOfficialBengaluruEntitySignal(contactPageHtml), true)
  assert.equal(ig.hasOfficialWorkdayListingSignal(workdayListingHtml), true)
  assert.equal(ig.hasOfficialWorkdayListingSignal(liveWorkdayShellHtml), true)
  assert.deepEqual(ig.buildScraperOptions(), {
    company: 'IG Infotech India',
    baseUrl: 'https://ig.wd103.myworkdayjobs.com/EXT_IG',
    locationCountry: 'c4f78be1a8f14da0ab49ce1162348a5e',
    source: 'iginfotechindia',
    scraperDir: ig.buildScraperOptions().scraperDir,
  })
  assert.deepEqual(
    ig.extractIndiaJobsFromWorkdayHtml(workdayListingHtml, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'Head Of Workforce Management',
        company: 'IG Infotech India',
        department: null,
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        sourceUrl: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Bangalore-India/Head-of-Workforce-Management_R_17283',
        applyUrl: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Bangalore-India/Head-of-Workforce-Management_R_17283/apply',
        jobId: 'R_17283',
        requisitionId: 'R_17283',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
        source: 'iginfotechindia',
        link: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Bangalore-India/Head-of-Workforce-Management_R_17283',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Content Producer',
        company: 'IG Infotech India',
        department: null,
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        sourceUrl: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Content-Producer_R_17451',
        applyUrl: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Content-Producer_R_17451/apply',
        jobId: 'R_17451',
        requisitionId: 'R_17451',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
        source: 'iginfotechindia',
        link: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Content-Producer_R_17451',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Web & SEO Copywriter',
        company: 'IG Infotech India',
        department: null,
        location: 'Bangalore, India',
        city: 'Bangalore',
        country: 'India',
        sourceUrl: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Web---SEO-Copywriter_R_16566',
        applyUrl: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Web---SEO-Copywriter_R_16566/apply',
        jobId: 'R_16566',
        requisitionId: 'R_16566',
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: null,
        remoteStatus: null,
        source: 'iginfotechindia',
        link: 'https://ig.wd103.myworkdayjobs.com/en-US/EXT_IG/job/Web---SEO-Copywriter_R_16566',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('IG Infotech India run validates the parent careers page, local entity page, and returns only India jobs', async () => {
  const ig = await loadModule()
  const requestedUrls = []

  const jobs = await ig.createIgInfotechIndiaScraper({
    now: () => FIXED_SCRAPED_AT,
    workdayRunner: async (options) => [
      {
        title: 'Lead Cyber Defence Analyst',
        location: 'Bangalore, India',
        link: 'https://ig.wd103.myworkdayjobs.com/EXT_IG/job/Bangalore-India/Lead-Cyber-Defence-Analyst_R_16420',
        source: 'iginfotechindia',
        scrapedAt: FIXED_SCRAPED_AT,
        runnerOptions: options,
      },
      {
        title: 'Content Producer',
        location: 'Bangalore, India',
        link: 'https://ig.wd103.myworkdayjobs.com/EXT_IG/job/Bangalore-India/Content-Producer_R_16562',
        source: 'iginfotechindia',
        scrapedAt: FIXED_SCRAPED_AT,
        runnerOptions: options,
      },
    ],
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ig.CAREERS_URL) return careersPageHtml
      if (url === ig.CONTACT_PAGE_URL) return contactPageHtml
      if (url === ig.WORKDAY_LISTING_URL) return liveWorkdayShellHtml
      throw new Error(`Unexpected IG URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ig.CAREERS_URL,
    ig.CONTACT_PAGE_URL,
    ig.WORKDAY_LISTING_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [
      job.title,
      job.location,
      job.companyCareerPage,
      job.companyDomain,
      job.atsPlatform,
      job.runnerOptions,
    ]),
    [
      [
        'Lead Cyber Defence Analyst',
        'Bangalore, India',
        'https://www.iggroup.com/about-us/careers',
        'iggroup.com',
        'workday',
        ig.buildScraperOptions(),
      ],
      [
        'Content Producer',
        'Bangalore, India',
        'https://www.iggroup.com/about-us/careers',
        'iggroup.com',
        'workday',
        ig.buildScraperOptions(),
      ],
    ],
  )
})

test('IG Infotech India fails closed when the verified careers page, entity page, or Workday listing contract drifts', async () => {
  const ig = await loadModule()

  await assert.rejects(
    ig.createIgInfotechIndiaScraper().run({
      fetchText: async (url) => {
        if (url === ig.CAREERS_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        if (url === ig.CONTACT_PAGE_URL) return contactPageHtml
        if (url === ig.WORKDAY_LISTING_URL) return workdayListingHtml
        throw new Error(`Unexpected IG URL: ${url}`)
      },
    }),
    /verified IG careers page/i,
  )

  await assert.rejects(
    ig.createIgInfotechIndiaScraper().run({
      fetchText: async (url) => {
        if (url === ig.CAREERS_URL) return careersPageHtml
        if (url === ig.CONTACT_PAGE_URL) return '<html><body><h1>Contact</h1></body></html>'
        if (url === ig.WORKDAY_LISTING_URL) return workdayListingHtml
        throw new Error(`Unexpected IG URL: ${url}`)
      },
    }),
    /verified IG Bengaluru entity page/i,
  )
})
