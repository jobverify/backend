import assert from 'node:assert/strict'
import test from 'node:test'

const loadAltenIndiaModule = async () => {
  try {
    return await import('../../scraper/altenindia/script.js')
  } catch {
    assert.fail('Expected ALTEN India scraper module at ../../scraper/scraper/altenindia/script.js')
  }
}

const sampleCompanyHtml = `
<html>
  <head><title>ALTEN India | LinkedIn</title></head>
  <body>
    <meta content="urn:li:organization:2312703">
  </body>
</html>
`

const sampleSearchHtml = `
<div class="base-card base-card--link job-search-card" data-entity-urn="urn:li:jobPosting:4277770012">
  <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/software-engineer-at-alten-india-4277770012?trk=public_jobs_topcard-title">
    <h3 class="base-search-card__title">Software Engineer</h3>
  </a>
  <h4 class="base-search-card__subtitle">
    <a>ALTEN India</a>
  </h4>
  <span class="job-search-card__location">Bengaluru, Karnataka, India</span>
  <time class="job-search-card__listdate" datetime="2026-06-25"></time>
</div>
`

const sampleDetailHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "JobPosting",
  "title": "Software Engineer",
  "description": "<p>Design and develop engineering software systems for aerospace and mobility clients while partnering with validation, integration, and delivery teams across the full product lifecycle.</p>",
  "datePosted": "2026-06-25",
  "employmentType": "FULL_TIME",
  "hiringOrganization": {
    "@type": "Organization",
    "name": "ALTEN India"
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
`

test('extractSearchResults maps ALTEN India LinkedIn guest results into conservative job records', async () => {
  const alten = await loadAltenIndiaModule()
  const listings = alten.extractSearchResults(sampleSearchHtml)
  const detail = alten.extractJobDetail(sampleDetailHtml)

  assert.equal(alten.pageIndicatesAltenIndiaCompany(sampleCompanyHtml), true)
  assert.equal(listings.length, 1)
  assert.deepEqual(
    {
      ...listings[0],
      ...Object.fromEntries(
        Object.entries(detail).filter(([, value]) => value != null),
      ),
    },
    {
      title: 'Software Engineer',
      company: 'ALTEN India',
      department: null,
      location: 'Bengaluru, Karnataka, India',
      city: 'Bengaluru',
      country: 'India',
      jobId: '4277770012',
      requisitionId: '4277770012',
      sourceUrl: 'https://www.linkedin.com/jobs/view/software-engineer-at-alten-india-4277770012?trk=public_jobs_topcard-title',
      applyUrl: 'https://www.linkedin.com/jobs/view/software-engineer-at-alten-india-4277770012?trk=public_jobs_topcard-title',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '2026-06-25',
      closingDate: null,
      jobDescription: 'Design and develop engineering software systems for aerospace and mobility clients while partnering with validation, integration, and delivery teams across the full product lifecycle.',
      publicExperienceChecked: true,
    },
  )
})

test('run fetches ALTEN India company, search, and detail pages and decorates openings', async () => {
  const alten = await loadAltenIndiaModule()
  const requestedUrls = []
  const scraper = alten.createAltenIndiaScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === alten.LINKEDIN_COMPANY_PAGE_URL) return sampleCompanyHtml
      if (url === alten.LINKEDIN_INDIA_JOBS_URL) return sampleSearchHtml
      if (url === 'https://www.linkedin.com/jobs/view/software-engineer-at-alten-india-4277770012?trk=public_jobs_topcard-title') {
        return sampleDetailHtml
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      alten.LINKEDIN_COMPANY_PAGE_URL,
      alten.LINKEDIN_INDIA_JOBS_URL,
      'https://www.linkedin.com/jobs/view/software-engineer-at-alten-india-4277770012?trk=public_jobs_topcard-title',
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'altenindia')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('run keeps ALTEN India listing data when LinkedIn detail pages are rate-limited', async () => {
  const alten = await loadAltenIndiaModule()
  const requestedUrls = []

  const jobs = await alten.createAltenIndiaScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === alten.LINKEDIN_COMPANY_PAGE_URL) return sampleCompanyHtml
      if (url === alten.LINKEDIN_INDIA_JOBS_URL) return sampleSearchHtml
      if (url === 'https://www.linkedin.com/jobs/view/software-engineer-at-alten-india-4277770012?trk=public_jobs_topcard-title') {
        throw new Error(`HTTP 429 for ${url}`)
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(
    requestedUrls,
    [
      alten.LINKEDIN_COMPANY_PAGE_URL,
      alten.LINKEDIN_INDIA_JOBS_URL,
      'https://www.linkedin.com/jobs/view/software-engineer-at-alten-india-4277770012?trk=public_jobs_topcard-title',
    ],
  )
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].source, 'altenindia')
})
