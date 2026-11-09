import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLY_HANDOFF_URL,
  CAMPUS_URL,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createVeltrikEvScraper,
  extractJobsFromCareersPage,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>Cutting Edge R&amp;D for Electric Vehicles | Veltrik.ev | VELTRIK.EV</title>
    </head>
    <body>
      <nav>
        <a href="/">Home</a>
        <a href="/campus">Campus Hiring</a>
        <a href="/careers">Careers</a>
        <a href="/contact">Contact</a>
      </nav>
      <main>
        <h1>Innovative Solutions for Electric Vehicle Design and Development</h1>
        <p>Leading B2B services for automotive electric vehicle innovation.</p>
        <p>
          At Veltrik.EV, we specialize in cutting-edge R&D, co-design, and vehicle testing
          for electric vehicles across the USA, Europe, India, and East Asia.
        </p>
        <a href="/careers">Careers</a>
      </main>
      <footer>
        <a href="mailto:info@veltrik.com">info@veltrik.com</a>
      </footer>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Join Our Team: Automotive Careers in Software Development | VELTRIK.EV</title>
    </head>
    <body>
      <nav>
        <a href="/campus">Campus Hiring</a>
        <a href="/careers">Careers</a>
      </nav>
      <main>
        <h1>Join Our Team</h1>
        <p>Explore exciting career opportunities in automotive software development and functional safety engineering with us.</p>
        <p>Explore exciting career opportunities in the automotive domain. We're looking for talented individuals to innovate with us.</p>
        <a href="https://veltrik.in/campus-hiring.html">Apply</a>
        <h3>Careers Page</h3>
        <label>Which Job are you interested to Apply For?*</label>
        <form>
          <label class="select-input"><input type="checkbox"> AUTOSAR Architect (15+ yrs exp)</label>
          <label class="select-input"><input type="checkbox"> Senior AUTOSAR BSW Developer (8+ yrs exp)</label>
          <label class="select-input"><input type="checkbox"> Software Integration Engineer (5+ yrs exp)</label>
          <label class="select-input"><input type="checkbox"> Functional Safety Engineer (3+ yrs exp)</label>
          <label class="select-input"><input type="checkbox"> Cybersecurity Engineer (3+ yrs exp)</label>
          <label class="select-input"><input type="checkbox"> Senior Firmware Developer (5+ yrs exp)</label>
          <label class="select-input"><input type="checkbox"> Firmware Developer (2+ yrs exp)</label>
          <label class="select-input"><input type="checkbox"> Graduate Engineering Trainee Software (0-1 yrs)</label>
          <label>Your Message*</label>
        </form>
        <button>Submit Your Application</button>
        <p>Bengaluru, India</p>
        <p>9 AM - 5 PM IST</p>
      </main>
      <footer>
        <a href="mailto:info@veltrik.com">info@veltrik.com</a>
      </footer>
    </body>
  </html>
`

test('recognizes the verified VELTRIK.EV homepage and careers surfaces', () => {
  assert.equal(SOURCE, 'veltrikev')
  assert.equal(COMPANY, 'VELTRIK.EV')
  assert.equal(HOMEPAGE_URL, 'https://veltrik.com/')
  assert.equal(CAREERS_URL, 'https://veltrik.com/careers')
  assert.equal(CAMPUS_URL, 'https://veltrik.com/campus')
  assert.equal(APPLY_HANDOFF_URL, 'https://veltrik.in/campus-hiring.html')

  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><title>Other Company</title></html>'), false)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialCareersSignal('<html><body>No roles here</body></html>'), false)
})

test('extractJobsFromCareersPage parses the verified inline role list into jobs', () => {
  const jobs = extractJobsFromCareersPage(careersHtml)

  assert.equal(jobs.length, 8)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'AUTOSAR Architect',
      'Senior AUTOSAR BSW Developer',
      'Software Integration Engineer',
      'Functional Safety Engineer',
      'Cybersecurity Engineer',
      'Senior Firmware Developer',
      'Firmware Developer',
      'Graduate Engineering Trainee Software',
    ],
  )

  assert.equal(jobs[0].experienceRequired, '15+ yrs exp')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].applyUrl, CAREERS_URL)
  assert.equal(jobs[0].sourceUrl, CAREERS_URL)
  assert.equal(jobs[7].employmentType, null)
  assert.match(jobs[7].jobId, /^veltrikev-graduate-engineering-trainee-software$/)
})

test('extractJobsFromCareersPage fails closed when the verified role selector disappears', () => {
  assert.throws(
    () => extractJobsFromCareersPage(careersHtml.replace('Which Job are you interested to Apply For?*', 'Open roles')),
    /verified inline role selector|verified careers page|trusted first-party hiring surface/i,
  )
})

test('run scrapes the official careers page roles and decorates the output', async () => {
  const requestedUrls = []
  const scraper = createVeltrikEvScraper({ now: () => '2026-07-13T00:00:00.000Z' })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === HOMEPAGE_URL) {
        return homepageHtml
      }

      if (url === CAREERS_URL) {
        return careersHtml
      }

      throw new Error(`Unexpected URL ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(jobs.length, 8)
  assert.equal(jobs[0].company, COMPANY)
  assert.equal(jobs[0].source, SOURCE)
  assert.equal(jobs[0].companyCareerPage, CAREERS_URL)
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, CAREERS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-13T00:00:00.000Z')
})

test('run fails closed when the homepage no longer matches the verified official surface', async () => {
  await assert.rejects(
    createVeltrikEvScraper().run({
      fetchText: async () => '<html><title>Maintenance</title><body>Coming soon</body></html>',
    }),
    /verified official homepage/i,
  )
})

test('run fails closed when the careers page no longer exposes the verified inline roles', async () => {
  await assert.rejects(
    createVeltrikEvScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return homepageHtml
        }

        return careersHtml.replace(/<label>Which Job are you interested to Apply For\?\*<\/label>[\s\S]*?<\/form>/i, '<div>No roles listed right now</div>')
      },
    }),
    /verified inline role selector|verified careers page/i,
  )
})
