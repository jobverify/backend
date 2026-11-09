import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lekhawirelesssolutions',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Lekha Wireless Solutions Private Limited</title>
  </head>
  <body>
    <nav>
      <a href="https://www.lekhawireless.com/company/contact-us/careers/">Careers</a>
    </nav>
    <main>
      <h1>The future of seamless mobile wireless connectivity</h1>
      <p>Lekha designs and manufactures 5G, 4G and IEEE 802.16 ("dot16") RAN infrastructure for private, public and defense networks.</p>
      <p>We are a founding member of the Bharat 6G Alliance.</p>
    </main>
  </body>
</html>
`

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers – Lekha Wireless Solutions Private Limited</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Shape the Future with Lekha</p>
    <p>Ready to make a real difference?</p>
    <label>Upload your Resume</label>
    <label>Years of experience</label>
    <input type="file" name="your-attachment" />
    <div class="elementor-accordion-item">
      <a class="elementor-accordion-title">Hardware Design - Lead Engineer</a>
      <div id="elementor-tab-content-100" class="elementor-tab-content">
        <p>Job Overview</p>
      </div>
    </div>
  </body>
</html>
`

const loadLekhaWirelessSolutionsModule = async () => {
  try {
    return await import('../../scraper/lekhawirelesssolutions/script.js')
  } catch {
    assert.fail('Expected Lekha Wireless Solutions scraper module at ../../scraper/lekhawirelesssolutions/script.js')
  }
}

test('Lekha Wireless Solutions scraper recognizes the verified homepage and first-party careers surface', async () => {
  const lekhaWirelessSolutions = await loadLekhaWirelessSolutionsModule()

  assert.equal(lekhaWirelessSolutions.SOURCE, 'lekhawirelesssolutions')
  assert.equal(lekhaWirelessSolutions.COMPANY, 'Lekha Wireless Solutions')
  assert.equal(lekhaWirelessSolutions.HOMEPAGE_URL, 'https://www.lekhawireless.com/')
  assert.equal(
    lekhaWirelessSolutions.CAREERS_URL,
    'https://www.lekhawireless.com/company/contact-us/careers/',
  )
  assert.equal(lekhaWirelessSolutions.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(lekhaWirelessSolutions.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(lekhaWirelessSolutions.hasOfficialCareersSignal(verifiedCareersHtml), true)
  assert.equal(lekhaWirelessSolutions.hasOfficialCareersSignal(currentCareersHtml), true)

  const jobs = lekhaWirelessSolutions.extractPublicJobs(verifiedCareersHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Hardware Design - Lead Engineer',
      'Electromechanical / Mechanical design Engineer (1 to 5 year)',
      'Antenna Lead/Sr.Lead',
      'Production Manager/ Sr.Lead',
      'LTE Testing - Er/Sr.Er',
      'RF Firmware Engineer/Sr. Engineer/Lead',
    ],
  )
  assert.ok(
    jobs.every((job) =>
      job.company === 'Lekha Wireless Solutions'
      && job.location === 'India'
      && job.country === 'India'
      && job.applyUrl === 'https://www.lekhawireless.com/company/contact-us/careers/#wpcf7-f5550-p3795-o1'
      && job.sourceUrl.startsWith('https://www.lekhawireless.com/company/contact-us/careers/#lekhawirelesssolutions-')
      && job.jobDescription.includes('Apply via the official Lekha Wireless careers page.')),
  )
  assert.ok(
    jobs.some((job) =>
      job.title === 'Antenna Lead/Sr.Lead'
      && job.jobDescription.includes('Minimum 5-8 years experience')),
  )
  assert.ok(
    jobs.some((job) =>
      job.title === 'Production Manager/ Sr.Lead'
      && job.jobDescription.includes('10+ years of experience')),
  )
})

test('Lekha Wireless Solutions scraper returns the public first-party roles from the verified careers page', async () => {
  const lekhaWirelessSolutions = await loadLekhaWirelessSolutionsModule()
  const requestedUrls = []

  const jobs = await lekhaWirelessSolutions.createLekhaWirelessSolutionsScraper({
    now: () => '2026-07-11T06:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === lekhaWirelessSolutions.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === lekhaWirelessSolutions.CAREERS_URL) return verifiedCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lekhaWirelessSolutions.HOMEPAGE_URL,
    lekhaWirelessSolutions.CAREERS_URL,
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'lekhawirelesssolutions')
  assert.equal(jobs[0].company, 'Lekha Wireless Solutions')
  assert.equal(
    jobs[0].companyCareerPage,
    'https://www.lekhawireless.com/company/contact-us/careers/',
  )
  assert.equal(jobs[0].companyDomain, 'lekhawireless.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T06:30:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('Lekha Wireless Solutions scraper fails closed when the verified homepage or careers surface drifts', async () => {
  const lekhaWirelessSolutions = await loadLekhaWirelessSolutionsModule()

  await assert.rejects(
    lekhaWirelessSolutions.createLekhaWirelessSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === lekhaWirelessSolutions.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    lekhaWirelessSolutions.createLekhaWirelessSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === lekhaWirelessSolutions.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          'Shape the Future with Lekha',
          'Shape the Future Together',
        )
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    lekhaWirelessSolutions.createLekhaWirelessSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === lekhaWirelessSolutions.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          'class="elementor-accordion-title"',
          'class="elementor-accordion-heading"',
        )
      },
    }),
    /verified public job accordion changed shape/i,
  )
})
