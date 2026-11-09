import assert from 'node:assert/strict'
import test from 'node:test'

const loadSunMobilityModule = async () => {
  try {
    return await import('../../scraper/sunmobility/script.js')
  } catch {
    assert.fail('Expected Sun Mobility scraper module at ../../scraper/sunmobility/script.js')
  }
}

const officialSiteHtml = `
  <div class="s-banner-text">
    <a
      href="https://www.linkedin.com/jobs/sun-mobility-jobs-worldwide?f_C=13365611&trk=top-card_top-card-primary-button-top-card-primary-cta&position=1&pageNum=0"
      target="_blank"
      class="green-btn"
    >See all Opportunities</a>
  </div>
  <p>
    We encourage you to still apply by sending your resume to
    careers@sunmobility.com and mentioning your areas of interest.
  </p>
`

const searchResultsHtml = `
  <section class="two-pane-serp-page__results-list">
    <ul class="jobs-search__results-list">
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4433812958">
          <a class="base-card__full-link" href="https://in.linkedin.com/jobs/view/embedded-software-engineer-at-sun-mobility-4433812958?position=1&amp;pageNum=0"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Embedded Software Engineer</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/sun-mobility/">SUN Mobility</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
              <time class="job-search-card__listdate" datetime="2026-07-03">1 week ago</time>
            </div>
          </div>
        </div>
      </li>
      <li>
        <div class="base-card base-search-card job-search-card" data-entity-urn="urn:li:jobPosting:4433812999">
          <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/regional-operations-manager-at-sun-mobility-4433812999"></a>
          <div class="base-search-card__info">
            <h3 class="base-search-card__title">Regional Operations Manager</h3>
            <h4 class="base-search-card__subtitle">
              <a class="hidden-nested-link" href="https://www.linkedin.com/company/sun-mobility/">SUN Mobility</a>
            </h4>
            <div class="base-search-card__metadata">
              <span class="job-search-card__location">Makati, National Capital Region, Philippines</span>
              <time class="job-search-card__listdate" datetime="2026-07-02">1 week ago</time>
            </div>
          </div>
        </div>
      </li>
    </ul>
  </section>
`

const detailHtml = `
  <html>
    <head>
      <title>SUN Mobility hiring Embedded Software Engineer in Bengaluru, Karnataka, India | LinkedIn</title>
      <script type="application/ld+json">
        {
          "@context": "http://schema.org",
          "@type": "JobPosting",
          "datePosted": "2026-07-03T04:09:09.000Z",
          "employmentType": "FULL_TIME",
          "description": "&lt;p&gt;&lt;strong&gt;Build battery-swapping control software&lt;/strong&gt;&lt;/p&gt;&lt;p&gt;Own embedded Linux and connectivity features across vehicle platforms.&lt;/p&gt;",
          "title": "Embedded Software Engineer",
          "hiringOrganization": {
            "@type": "Organization",
            "name": "SUN Mobility"
          },
          "jobLocation": {
            "@type": "Place",
            "address": {
              "@type": "PostalAddress",
              "addressLocality": "Bengaluru",
              "addressRegion": "Karnataka",
              "addressCountry": "IN"
            }
          }
        }
      </script>
    </head>
    <body></body>
  </html>
`

test('extractSearchResults keeps only India jobs from the public LinkedIn page linked by Sun Mobility careers', async () => {
  const sunMobility = await loadSunMobilityModule()
  const jobs = sunMobility.extractSearchResults(searchResultsHtml)

  assert.equal(sunMobility.CAREER_PAGE_URL, 'https://www.sunmobility.com/career/')
  assert.equal(
    sunMobility.LINKEDIN_JOBS_URL,
    'https://www.linkedin.com/jobs/sun-mobility-jobs-worldwide?f_C=13365611&trk=top-card_top-card-primary-button-top-card-primary-cta&position=1&pageNum=0',
  )
  assert.equal(sunMobility.pageIndicatesLinkedinJobs(officialSiteHtml), true)
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Embedded Software Engineer',
    company: 'SUN Mobility',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '4433812958',
    requisitionId: '4433812958',
    sourceUrl: 'https://in.linkedin.com/jobs/view/embedded-software-engineer-at-sun-mobility-4433812958?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/embedded-software-engineer-at-sun-mobility-4433812958?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-03',
    closingDate: null,
    jobDescription: null,
  })
})

test('extractJobDetail enriches a public LinkedIn detail page using JobPosting JSON-LD', async () => {
  const sunMobility = await loadSunMobilityModule()
  const detail = sunMobility.extractJobDetail(detailHtml)

  assert.deepEqual(detail, {
    company: 'SUN Mobility',
    location: 'Bengaluru, Karnataka, IN',
    city: 'Bengaluru',
    country: 'India',
    employmentType: 'Full-time',
    postingDate: '2026-07-03',
    jobDescription: 'Build battery-swapping control software Own embedded Linux and connectivity features across vehicle platforms.',
  })
})

test('run validates the official Sun Mobility LinkedIn handoff and decorates India jobs', async () => {
  const sunMobility = await loadSunMobilityModule()
  const requestedUrls = []
  const scraper = sunMobility.createSunMobilityScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === sunMobility.CAREER_PAGE_URL) return officialSiteHtml
      if (url === sunMobility.LINKEDIN_JOBS_URL) return searchResultsHtml
      if (url.startsWith('https://in.linkedin.com/jobs/view/embedded-software-engineer-at-sun-mobility-4433812958')) {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sunMobility.CAREER_PAGE_URL,
    sunMobility.LINKEDIN_JOBS_URL,
    'https://in.linkedin.com/jobs/view/embedded-software-engineer-at-sun-mobility-4433812958?position=1&pageNum=0',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'sunmobility')
  assert.equal(jobs[0].company, 'SUN Mobility')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].link, 'https://in.linkedin.com/jobs/view/embedded-software-engineer-at-sun-mobility-4433812958?position=1&pageNum=0')
})

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const execFileAsync = promisify(execFile)

test('Sun Mobility parses current new-date LinkedIn cards without blocking the event loop', async () => {
  const moduleUrl = new URL('../../scraper/sunmobility/script.js', import.meta.url).href
  const fixturePath = fileURLToPath(new URL('../../scraper/sunmobility/fixtures/linkedin-search-current.html', import.meta.url))
  const code = [
    'import fs from "node:fs/promises"',
    'import { extractSearchResults } from ' + JSON.stringify(moduleUrl),
    'const jobs = extractSearchResults(await fs.readFile(' + JSON.stringify(fixturePath) + ', "utf8"))',
    'console.log(JSON.stringify(jobs.map(({ jobId, title, postingDate }) => ({ jobId, title, postingDate }))))',
  ].join(';')
  const { stdout } = await execFileAsync(process.execPath, ['--input-type=module', '-e', code], {
    timeout: 3000,
    killSignal: 'SIGKILL',
    windowsHide: true,
  })
  assert.deepEqual(JSON.parse(stdout), [
    { jobId: '4426606139', title: 'Embedded Application Developer', postingDate: '2026-06-11' },
    { jobId: '4470858240', title: 'Associate – Company Secretary', postingDate: '2026-09-28' },
    { jobId: '4477120207', title: 'Senior Vehicle Integration Specialist (Electrical Focus)', postingDate: '2026-10-08' },
  ])
})
