import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'kathirsudhirautomation',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')

const LIVE_STYLE_APPLY_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSdYI3l27XLVXdhVuKXHhhQq-ztYM2rszdBr5geuDO8A6kB1sg/viewform'

const buildLiveStyleJobBlock = ({
  title,
  qualifications,
  experience,
  salary = '18000 CTC',
  responsibilities = [
    'Identify new customers and business opportunities',
    'Communicate product value to prospects',
  ],
  responsibilitiesHtml = null,
}) => `
  <section class="elementor-section">
    <div class="elementor-widget-heading">
      <h3 class="elementor-heading-title elementor-size-default">
        <h3 data-elementor-setting-key="title">Job Title:&nbsp;<span>${title}</span></h3>
      </h3>
    </div>
  </section>
  <section class="elementor-section">
    <div class="elementor-widget-text-editor">
      <p><b>Job detail&nbsp;&#8211;</b></p>
      <p><b>Qualifications:</b></p>
      <p>${qualifications}</p>
      <p><b>Roles and Responsibilities:</b></p>
      ${responsibilitiesHtml ?? `<ul>${responsibilities.map((item) => `<li>${item}</li>`).join('')}</ul>`}
      <p><b>Experience :&nbsp;</b></p>
      <p>${experience}</p>
      <p><b>Salary range&nbsp; :</b></p>
      <p>${salary}</p>
    </div>
  </section>
  <section class="elementor-section">
    <div class="elementor-widget-button">
      <a class="elementor-button elementor-button-link elementor-size-sm" href="${LIVE_STYLE_APPLY_URL}">
        <span class="elementor-button-text">apply here </span>
      </a>
    </div>
  </section>
`

const liveStyleCareersHtml = `
  <html>
    <head>
      <title>Career opportunities in Electronics Core Company in Chennai</title>
    </head>
    <body>
      <h2>Electronics Core Company Jobs</h2>
      ${buildLiveStyleJobBlock({
        title: 'Sales &amp; Business Development Executive',
        qualifications: 'Any Degree Preferred , MBA/BBA/MSC /BSC/',
        experience: '0-3 years / Freshers can apply',
      })}
      ${buildLiveStyleJobBlock({
        title: 'Marketing and sales',
        qualifications: 'Any Degree Preferred',
        experience: '0-1 years / Freshers can apply',
      })}
      ${buildLiveStyleJobBlock({
        title: 'Graduate Engineer Trainee (GET)',
        qualifications: 'BE ECE/EEE/ E&amp;I, Mechatronics , BSc/MSc Electronics',
        experience: '0-1 years / Freshers can apply',
        responsibilitiesHtml: `
          <div>&gt; To involve in production, service, projects, stores, purchase, logistics and all related activities</div>
        `,
      })}
      ${buildLiveStyleJobBlock({
        title: 'Accounts &amp; Customer Support Executive',
        qualifications: 'Bcom (any) preferred Zoho Books Knowledge',
        experience: '0-1 years / Freshers can apply',
        salary: '17000 CTC',
        responsibilitiesHtml: `
          <div>&gt; Accounts maintenance, Payments, Receivables</div>
          <div>&gt; Customers interaction for Quotation, Invoice, Payment, Materials, Service Item, QA, and Digital review</div>
          <div>&gt; Manage Customer Enquiries and Calls</div>
        `,
      })}
      ${buildLiveStyleJobBlock({
        title: 'SCM Engineer &amp; Lead',
        qualifications: 'Any Degree',
        experience: '0-1 years / Freshers can apply',
        responsibilitiesHtml: `
          <div>&gt; Handle Stores, Purchase and Logistics functions</div>
          <div>&gt; Optimize inventory levels &amp; lead times</div>
          <div>&gt; Develop &amp; implement supply plans using SCM tools</div>
        `,
      })}
      <p>Contact: hr@kathirsudhirautomation.com</p>
    </body>
  </html>
`

const currentNoListingsCareersHtml = `
  <html>
    <head>
      <title>Career opportunities in Electronics Core Company in Chennai</title>
      <link rel="canonical" href="https://www.kathirsudhirautomation.com/career" />
      <script type="application/ld+json">
        {"@type":"Organization","name":"Kathir Sudhir Automation India Pvt Ltd","url":"https://www.kathirsudhirautomation.com/"}
      </script>
    </head>
    <body>
      <h1>Career</h1>
      <h2>Electronics Core Company Jobs</h2>
      <p>Open Positions — Kathir Sudhir Automation</p>
      <footer>For Job : 9025118989 / <a href="mailto:hr@kathirsudhirautomation.com">hr@kathirsudhirautomation.com</a></footer>
    </body>
  </html>
`

const loadKathirSudhirAutomationModule = async () => {
  try {
    return await import('../../scraper/kathirsudhirautomation/script.js')
  } catch {
    assert.fail('Expected Kathir Sudhir Automation scraper module at ../../scraper/kathirsudhirautomation/script.js')
  }
}

test('Kathir Sudhir Automation scraper validates the verified first-party homepage and careers page', async () => {
  const scraperModule = await loadKathirSudhirAutomationModule()

  assert.equal(scraperModule.SOURCE, 'kathirsudhirautomation')
  assert.equal(scraperModule.COMPANY, 'Kathir Sudhir Automation')
  assert.equal(scraperModule.HOMEPAGE_URL, 'https://www.kathirsudhirautomation.com/')
  assert.equal(scraperModule.CAREERS_URL, 'https://www.kathirsudhirautomation.com/career')
  assert.equal(scraperModule.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(scraperModule.hasOfficialCareersSignal(verifiedCareersHtml), true)

  const jobs = scraperModule.extractPublicJobs(verifiedCareersHtml)

  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Accounts & Customer Support Executive',
      'Graduate Engineer Trainee (GET)',
      'Marketing and sales',
      'Sales & Business Development Executive',
      'SCM Engineer & Lead',
    ],
  )
  assert.deepEqual(
    jobs.map((job) => job.location),
    Array(5).fill('Chennai, Tamil Nadu, India'),
  )
  assert.ok(
    jobs.every((job) =>
      job.company === 'Kathir Sudhir Automation'
      && job.country === 'India'
      && job.city === 'Chennai'
      && job.applyUrl === 'https://docs.google.com/forms/d/e/ksa-apply/viewform'
      && job.sourceUrl.startsWith('https://www.kathirsudhirautomation.com/career#kathirsudhirautomation-')
    ),
  )
  assert.equal(jobs.find((job) => job.title === 'Accounts & Customer Support Executive')?.minimumQualification, 'Bcom (any) preferred Zoho Books Knowledge')
  assert.equal(jobs.find((job) => job.title === 'Sales & Business Development Executive')?.experienceRequired, '0-3 years / Freshers can apply')
})

test('Kathir Sudhir Automation run fetches the verified first-party pages and decorates jobs for persistence', async () => {
  const scraperModule = await loadKathirSudhirAutomationModule()
  const requestedUrls = []

  const jobs = await scraperModule.createKathirSudhirAutomationScraper({
    now: () => '2026-07-11T06:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === scraperModule.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === scraperModule.CAREERS_URL) return verifiedCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [scraperModule.HOMEPAGE_URL, scraperModule.CAREERS_URL])
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].source, 'kathirsudhirautomation')
  assert.equal(jobs[0].companyCareerPage, 'https://www.kathirsudhirautomation.com/career')
  assert.equal(jobs[0].companyDomain, 'kathirsudhirautomation.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T06:00:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Kathir Sudhir Automation fails closed when the verified homepage or careers page drifts', async () => {
  const scraperModule = await loadKathirSudhirAutomationModule()

  await assert.rejects(
    scraperModule.createKathirSudhirAutomationScraper().run({
      fetchText: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) {
          return '<html><title>Unexpected</title><body>No company markers</body></html>'
        }

        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    scraperModule.createKathirSudhirAutomationScraper().run({
      fetchText: async (url) => {
        if (url === scraperModule.HOMEPAGE_URL) return verifiedHomepageHtml

        return verifiedCareersHtml.replace('Electronics Core Company Jobs', 'Open Roles')
      },
    }),
    /verified careers page/i,
  )
})

test('Kathir Sudhir Automation accepts the live-style Elementor careers markup and absolute homepage careers link', async () => {
  const scraperModule = await loadKathirSudhirAutomationModule()

  assert.equal(scraperModule.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(scraperModule.hasOfficialCareersSignal(liveStyleCareersHtml), true)

  const jobs = scraperModule.extractPublicJobs(liveStyleCareersHtml)

  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Accounts & Customer Support Executive',
      'Graduate Engineer Trainee (GET)',
      'Marketing and sales',
      'Sales & Business Development Executive',
      'SCM Engineer & Lead',
    ],
  )
  assert.ok(jobs.every((job) => job.applyUrl === LIVE_STYLE_APPLY_URL))
  assert.equal(
    jobs.find((job) => job.title === 'Accounts & Customer Support Executive')?.minimumQualification,
    'Bcom (any) preferred Zoho Books Knowledge',
  )
  assert.match(
    jobs.find((job) => job.title === 'Graduate Engineer Trainee (GET)')?.jobDescription || '',
    /production, service, projects, stores, purchase, logistics/i,
  )
  assert.match(
    jobs.find((job) => job.title === 'SCM Engineer & Lead')?.jobDescription || '',
    /optimize inventory levels & lead times/i,
  )
})

test('Kathir Sudhir Automation rejects absent inventory and role arrays without verified job geography', async () => {
  const scraperModule = await loadKathirSudhirAutomationModule()
  assert.equal(scraperModule.hasOfficialCareersSignal(currentNoListingsCareersHtml), true)
  assert.throws(() => scraperModule.extractPublicJobs(currentNoListingsCareersHtml), error => error.code === 'KATHIR_INVENTORY_UNAVAILABLE')
  const careers = currentNoListingsCareersHtml + '<script>const jobs=[{title:"Sales Engineer",apply:"https://docs.google.com/forms/d/e/verified/viewform"}];const list=document.getElementById("jobList");</script>'
  assert.throws(() => scraperModule.extractPublicJobs(careers), error => error.code === 'KATHIR_LOCATION_UNVERIFIED' && error.abortRetries === true)
})

test('Kathir Sudhir Automation returns discovery-only evidence when current inline jobs lack verified geography', async () => {
  const scraperModule = await loadKathirSudhirAutomationModule()
  const careers = currentNoListingsCareersHtml + '<script>const jobs=[{title:"Sales Engineer",apply:"https://docs.google.com/forms/d/e/verified/viewform"}];const list=document.getElementById("jobList");</script>'

  const jobs = await scraperModule.createKathirSudhirAutomationScraper({
    now: () => '2026-09-14T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === scraperModule.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === scraperModule.CAREERS_URL) return careers

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, scraperModule.CAREERS_URL)
  assert.equal(evidence?.listingComplete, false)
  assert.equal(evidence?.reason, 'Kathir Sudhir Automation job geography is unverified: current inline role geography has not been validated')
})
