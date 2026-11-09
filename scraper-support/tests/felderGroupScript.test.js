import assert from 'node:assert/strict'
import test from 'node:test'

const loadFelderModule = async () => {
  try {
    return await import('../../scraper/feldergroup/script.js')
  } catch {
    assert.fail('Expected FELDER Group scraper module at ../../scraper/feldergroup/script.js')
  }
}

const listingHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section class="job-vacancies">
      <article class="job-item">
        <a class="job-link" href="/en/jobs/software-engineer-india_j50123">Software Engineer</a>
        <div class="job-category">IT</div>
        <div class="job-location">Bengaluru - India</div>
      </article>
      <article class="job-item">
        <a class="job-link" href="/en/jobs/service-technician-canada_j4809647">Service Technician</a>
        <div class="job-category">Customer service</div>
        <div class="job-location">Toronto - Canada</div>
      </article>
    </section>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Software Engineer',
        datePosted: '2026-07-09',
        validThrough: '2026-08-09',
        description: '<p>Build internal systems for FELDER Group India operations.</p>',
        employmentType: 'FULL_TIME',
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Bengaluru',
            addressCountry: 'India',
          },
        },
      })}
    </script>
  </head>
  <body>
    <a class="apply-now" href="/en/application?jobId=50123">Apply now</a>
  </body>
</html>
`

test('extractSearchResults keeps FELDER Group on the public vacancies page and filters to India roles', async () => {
  const { SEARCH_URL, extractSearchResults } = await loadFelderModule()

  assert.equal(SEARCH_URL, 'https://felder-group.jobs/en/job-vacancies')
  assert.deepEqual(extractSearchResults(listingHtml), [{
    title: 'Software Engineer',
    category: 'IT',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '50123',
    requisitionId: '50123',
    sourceUrl: 'https://felder-group.jobs/en/jobs/software-engineer-india_j50123',
  }])
})

test('run keeps FELDER Group on the public listing/detail/apply flow and extracts JSON-LD fields', async () => {
  const {
    SEARCH_URL,
    createFelderGroupScraper,
  } = await loadFelderModule()
  const requestedUrls = []

  const jobs = await createFelderGroupScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === SEARCH_URL) return listingHtml
      if (url === 'https://felder-group.jobs/en/jobs/software-engineer-india_j50123') return detailHtml
      throw new Error(`Unexpected FELDER URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://felder-group.jobs/en/job-vacancies',
    'https://felder-group.jobs/en/jobs/software-engineer-india_j50123',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Software Engineer',
    company: 'FELDER Group',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    link: 'https://felder-group.jobs/en/application?jobId=50123',
    applyUrl: 'https://felder-group.jobs/en/application?jobId=50123',
    sourceUrl: 'https://felder-group.jobs/en/jobs/software-engineer-india_j50123',
    source: 'feldergroup',
    jobId: '50123',
    requisitionId: '50123',
    department: 'IT',
    employmentType: 'Full-time',
    experienceRequired: null,
    postingDate: '2026-07-09',
    closingDate: '2026-08-09',
    jobDescription: 'Build internal systems for FELDER Group India operations.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    remoteStatus: 'On-site',
    scrapedAt: jobs[0].scrapedAt,
  })
})
