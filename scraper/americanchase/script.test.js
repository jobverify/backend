import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
  <html>
    <head><title>American Chase Careers</title></head>
    <body>
      <script>
        window.khConfig = {
          identifier: '01234567-89ab-cdef-0123-456789abcdef',
          domain: 'https://americanchase.keka.com/careers/'
        };
      </script>
    </body>
  </html>
`

const documentBackedCareerShellHtml = `
  <html>
    <body>
      <div id="content-container"></div>
      <script>
        fetch('/ats/documents/f73fa96c-c65b-451f-8bb4-f076c26d6f83/careerportal/7f832415efcf4aa0926c52588af8920c.html')
          .then((response) => response.text())
          .then((html) => { document.getElementById('content-container').innerHTML = html; });
      </script>
    </body>
  </html>
`

test('American Chase Keka scraper validates its portal and handles a public empty jobs response', async () => {
  const americanChase = await loadModule()
  assert.ok(americanChase, 'American Chase scraper module should load')

  const {
    CAREER_PAGE_URL,
    buildActiveJobsUrl,
    createAmericanChaseScraper,
    extractCareerConfig,
  } = americanChase
  const careerConfig = extractCareerConfig(careerPageHtml)

  assert.equal(CAREER_PAGE_URL, 'https://americanchase.keka.com/careers/')
  assert.deepEqual(careerConfig, {
    identifier: '01234567-89ab-cdef-0123-456789abcdef',
    domain: 'https://americanchase.keka.com/careers/',
    portalName: 'default',
  })
  assert.equal(
    buildActiveJobsUrl(careerConfig),
    'https://americanchase.keka.com/careers/api/embedjobs/default/active/01234567-89ab-cdef-0123-456789abcdef',
  )

  const requestedUrls = []
  const jobs = await createAmericanChaseScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, CAREER_PAGE_URL)
      return careerPageHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, buildActiveJobsUrl(careerConfig))
      return []
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    buildActiveJobsUrl(careerConfig),
  ])
  assert.deepEqual(jobs, [])
})

test('American Chase Keka scraper follows the current document-backed careers shell', async () => {
  const americanChase = await loadModule()
  assert.ok(americanChase, 'American Chase scraper module should load')

  const {
    CAREER_PAGE_URL,
    buildActiveJobsUrl,
    createAmericanChaseScraper,
    extractCareerDocumentUrl,
    extractCareerConfig,
  } = americanChase
  const documentUrl =
    'https://americanchase.keka.com/ats/documents/f73fa96c-c65b-451f-8bb4-f076c26d6f83/careerportal/7f832415efcf4aa0926c52588af8920c.html'

  assert.equal(
    extractCareerDocumentUrl(documentBackedCareerShellHtml, CAREER_PAGE_URL),
    documentUrl,
  )

  const requestedUrls = []
  const jobs = await createAmericanChaseScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREER_PAGE_URL) return documentBackedCareerShellHtml
      if (url === documentUrl) return careerPageHtml
      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, buildActiveJobsUrl(extractCareerConfig(careerPageHtml)))
      return [{
        id: 150901,
        title: 'Network Administrator',
        departmentName: 'IT',
        jobType: 2,
        publishedOn: '2026-07-13T12:11:16.730Z',
        jobLocations: [{ city: 'Indore', state: 'MP', countryCode: 'IN', countryName: 'India' }],
      }]
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREER_PAGE_URL,
    documentUrl,
    buildActiveJobsUrl(extractCareerConfig(careerPageHtml)),
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Network Administrator')
  assert.equal(jobs[0].source, 'americanchase')
})

test('American Chase Keka scraper rejects an unexpected careers page', async () => {
  const americanChase = await loadModule()
  assert.ok(americanChase, 'American Chase scraper module should load')

  await assert.rejects(
    americanChase.createAmericanChaseScraper().run({
      fetchText: async () => '<html><title>Unavailable</title></html>',
    }),
    /Unable to resolve American Chase Keka embed configuration/,
  )
})

test('American Chase Keka scraper maps only India jobs without inventing a posting date', async () => {
  const americanChase = await loadModule()
  assert.ok(americanChase, 'American Chase scraper module should load')
  const { CAREER_PAGE_URL, extractSearchResults } = americanChase

  assert.deepEqual(extractSearchResults([{
    id: 88834,
    title: 'Associate System Engineer',
    departmentName: 'Engineering',
    jobType: 2,
    jobLocations: [{ city: 'Indore', state: 'Madhya Pradesh', countryCode: 'IN' }],
  }, {
    id: 88835,
    title: 'US Recruiter',
    jobLocations: [{ city: 'Portland', countryCode: 'US' }],
  }], { domain: CAREER_PAGE_URL }), [{
    title: 'Associate System Engineer',
    company: 'American Chase',
    department: 'Engineering',
    location: 'Indore, Madhya Pradesh, India',
    city: 'Indore',
    country: 'India',
    jobId: '88834',
    requisitionId: '88834',
    sourceUrl: 'https://americanchase.keka.com/careers/jobdetails/88834',
    applyUrl: 'https://americanchase.keka.com/careers/jobdetails/88834',
    employmentType: 'Full Time',
    sourceEmploymentType: 'Full Time',
    experienceRequired: null,
    sourceExperienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
  }])
})

test('American Chase employer facts survive normalization and reach the model without inferred labels', async () => {
  const { extractSearchResults, CAREER_PAGE_URL } = await loadModule()
  const { normalizeScrapedJob } = await import('../../scraper-support/utils/normalizeScrapedJob.js')
  const { buildClassificationInput } = await import('../../src/services/jobClassificationPolicy.js')
  const [job] = extractSearchResults([{
    id: 88834, title: 'Associate System Engineer', jobType: 2, experience: 0,
    description: 'Batch Required Graduate 2025. Full Time (Night Shift).',
    jobLocations: [{ city: 'Indore', countryCode: 'IN' }],
  }], { domain: CAREER_PAGE_URL })
  assert.equal(job.sourceEmploymentType, 'Full Time')
  assert.equal(job.sourceExperienceRequired, '0')
  const input = buildClassificationInput(normalizeScrapedJob(job))
  assert.equal(input.sourceEmploymentType, 'Full Time')
  assert.equal(input.sourceFields.experienceRequired, '0')
  assert.match(input.body, /Required professional experience:\n0/)
})
