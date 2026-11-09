import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'
import { postScrapeInput } from '../../src/services/postScrapeClassification.js'

const FIXED_SCRAPED_AT = '2026-07-15T12:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>High-Quality Building Material Manufacturer | Everest Industries</title>
  </head>
  <body>
    <nav>
      <a href="https://www.everestind.com/about">About</a>
      <a class="submenuactive" href="https://www.everestind.com/careerateverest" data-text="#CareerAtEverest">#CareerAtEverest</a>
      <a href="https://www.everestind.com/careerateverest#Careers" rel="Careers" data-text="Careers @ Everest">Careers @ Everest</a>
    </nav>
    <main>
      <h1>Everest Industries - Leading Building Material Manufacturer</h1>
      <p>To improve people's lives by reimagining spaces.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Everest Industries Careers: Check for Job Vacancies at Everest</title>
  </head>
  <body>
    <section>
      <h1>#CareerAtEverest</h1>
      <h2>Careers @ Everest</h2>
      <p>Can’t find a suitable role?</p>
      <p>Click here to Submit your resume to our Talent Database for future opportunities.</p>
    </section>
    <ul id="jobs_slider" class="owl-carousel owl-theme dash sliderarrowbtn">
      <li>
        <div class="fw job">
          <div class="fw desc">
            <a href="https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a699eb89c55aca___apply=1" target="_blank">
              <h5><span>FINANCE - JOB744</span><br>Corporate - F&amp;A</h5>
            </a>
            <p>Mumbai</p>
          </div>
        </div>
        <div class="fw job">
          <div class="fw desc">
            <a href="https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a6a34e6d72f946___apply=1" target="_blank">
              <h5><span>ROOFING - JOB827</span><br>Territory Sales Officer</h5>
            </a>
            <p>Meerut</p>
          </div>
        </div>
        <div class="fw job">
          <div class="fw desc">
            <a href="https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a6a3e77b1d1e5a___apply=1" target="_blank">
              <h5><span>ESBS - JOB836</span><br>Site Manager - CMG</h5>
            </a>
            <p>Dahej</p>
          </div>
        </div>
      </li>
    </ul>
    <section>
      <h3>Submit Your Resume</h3>
      <p>Everest does not ask candidates for any fee, deposit, or traveling expenses linked to job opportunities.</p>
      <p>Upon receiving a communication such as this, please contact our HR team at careers@everestind.com to verify the details.</p>
    </section>
  </body>
</html>
`

const darwinboxJobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Everest Industries</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/everestindustries/script.js')
  } catch {
    assert.fail('Expected Everest Industries scraper module at ../../scraper/everestindustries/script.js')
  }
}

test('listing-only Everest cards leave description evidence missing and allow later recovery', async () => {
  const everestIndustries = await loadModule()
  for (const job of everestIndustries.extractJobs(careersHtml)) {
    assert.equal(job.jobDescription, null)
    assert.equal(job.preserveExistingSourceContent, true)
    const normalized = normalizeScrapedJob({ ...job, source: everestIndustries.SOURCE })
    assert.equal(normalized.sourceDescription, '')
    assert.equal(normalized.jobDescription, null)
    assert.equal(normalized.experienceRequired, null)
    const input = postScrapeInput(normalized, { now: new Date(FIXED_SCRAPED_AT) })
    assert.equal(input.body, '')
    assert.equal(input.incomplete, true)
  }
})

test('Everest Industries helpers stay pinned to the verified homepage, careers page, job cards, and Darwinbox shell routes', async () => {
  const everestIndustries = await loadModule()

  assert.equal(everestIndustries.SOURCE, 'everestindustries')
  assert.equal(everestIndustries.COMPANY, 'Everest Industries')
  assert.equal(everestIndustries.OFFICIAL_BRAND_NAME, 'Everest Industries Limited')
  assert.equal(everestIndustries.VERIFIED_ON, '2026-07-15')
  assert.equal(everestIndustries.HOMEPAGE_URL, 'https://www.everestind.com/')
  assert.equal(everestIndustries.CAREERS_URL, 'https://www.everestind.com/careerateverest')
  assert.equal(everestIndustries.DARWINBOX_JOBS_URL, 'https://oneeverest.darwinbox.in/jobs')
  assert.equal(
    everestIndustries.DARWINBOX_HOME_URL,
    'https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/home',
  )
  assert.equal(
    everestIndustries.DARWINBOX_ALL_JOBS_URL,
    'https://oneeverest.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(everestIndustries.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    everestIndustries.extractCareersUrl(homepageHtml),
    everestIndustries.CAREERS_URL,
  )
  assert.equal(everestIndustries.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(
    everestIndustries.isVerifiedDarwinboxHomeRoute({
      status: 200,
      url: everestIndustries.DARWINBOX_HOME_URL,
      html: darwinboxJobsPageHtml,
    }),
    true,
  )
  assert.equal(
    everestIndustries.isVerifiedDarwinboxAllJobsShell({
      status: 200,
      url: everestIndustries.DARWINBOX_ALL_JOBS_URL,
      html: darwinboxJobsPageHtml,
    }),
    true,
  )

  const jobs = everestIndustries.extractJobs(careersHtml)
  assert.deepEqual(jobs, [
    {
      title: 'FINANCE - JOB744 Corporate - F&A',
      company: 'Everest Industries',
      department: 'FINANCE',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'a699eb89c55aca',
      requisitionId: 'JOB744',
      sourceUrl: 'https://www.everestind.com/careerateverest',
      applyUrl: 'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a699eb89c55aca___apply=1',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
    },
    {
      title: 'ROOFING - JOB827 Territory Sales Officer',
      company: 'Everest Industries',
      department: 'ROOFING',
      location: 'Meerut, India',
      city: 'Meerut',
      country: 'India',
      jobId: 'a6a34e6d72f946',
      requisitionId: 'JOB827',
      sourceUrl: 'https://www.everestind.com/careerateverest',
      applyUrl: 'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a6a34e6d72f946___apply=1',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
    },
    {
      title: 'ESBS - JOB836 Site Manager - CMG',
      company: 'Everest Industries',
      department: 'ESBS',
      location: 'Dahej, India',
      city: 'Dahej',
      country: 'India',
      jobId: 'a6a3e77b1d1e5a',
      requisitionId: 'JOB836',
      sourceUrl: 'https://www.everestind.com/careerateverest',
      applyUrl: 'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a6a3e77b1d1e5a___apply=1',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
    },
  ])
})

test('run validates the verified first-party Everest careers surface and returns inline public openings', async () => {
  const everestIndustries = await loadModule()
  const requestedUrls = []

  const jobs = await everestIndustries.createEverestIndustriesScraper({
    now: () => FIXED_SCRAPED_AT,
    maxJobs: 2,
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === everestIndustries.HOMEPAGE_URL) {
        return {
          status: 200,
          url,
          html: homepageHtml,
        }
      }

      if (url === everestIndustries.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: careersHtml,
        }
      }

      if (url === everestIndustries.DARWINBOX_JOBS_URL) {
        return {
          status: 200,
          url: everestIndustries.DARWINBOX_HOME_URL,
          html: darwinboxJobsPageHtml,
        }
      }

      if (url === everestIndustries.DARWINBOX_ALL_JOBS_URL) {
        return {
          status: 200,
          url,
          html: darwinboxJobsPageHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    everestIndustries.HOMEPAGE_URL,
    everestIndustries.CAREERS_URL,
    everestIndustries.DARWINBOX_JOBS_URL,
    everestIndustries.DARWINBOX_ALL_JOBS_URL,
  ])
  assert.deepEqual(jobs, [
    {
      title: 'FINANCE - JOB744 Corporate - F&A',
      company: 'Everest Industries',
      department: 'FINANCE',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'a699eb89c55aca',
      requisitionId: 'JOB744',
      sourceUrl: 'https://www.everestind.com/careerateverest',
      applyUrl: 'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a699eb89c55aca___apply=1',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
      source: 'everestindustries',
      link: 'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a699eb89c55aca___apply=1',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'ROOFING - JOB827 Territory Sales Officer',
      company: 'Everest Industries',
      department: 'ROOFING',
      location: 'Meerut, India',
      city: 'Meerut',
      country: 'India',
      jobId: 'a6a34e6d72f946',
      requisitionId: 'JOB827',
      sourceUrl: 'https://www.everestind.com/careerateverest',
      applyUrl: 'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a6a34e6d72f946___apply=1',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      preserveExistingSourceContent: true,
      publicExperienceChecked: true,
      source: 'everestindustries',
      link: 'https://oneeverest.darwinbox.in/ms/candidate/candidate/login?redirect=/ms/candidate/careers/a6a34e6d72f946___apply=1',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('run fails closed when the verified homepage, careers page, or Darwinbox shell drifts', async () => {
  const everestIndustries = await loadModule()

  await assert.rejects(
    everestIndustries.createEverestIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === everestIndustries.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Everest</title></head><body><h1>Everest</h1></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches/i,
  )

  await assert.rejects(
    everestIndustries.createEverestIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === everestIndustries.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === everestIndustries.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml.replace('careers@everestind.com', 'hr@example.com'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page no longer matches/i,
  )

  await assert.rejects(
    everestIndustries.createEverestIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === everestIndustries.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === everestIndustries.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: careersHtml,
          }
        }

        if (url === everestIndustries.DARWINBOX_JOBS_URL) {
          return {
            status: 200,
            url: 'https://oneeverest.darwinbox.in/unexpected',
            html: darwinboxJobsPageHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Darwinbox public portal route changed/i,
  )
})
