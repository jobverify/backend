import assert from 'node:assert/strict'
import test from 'node:test'

const loadRoyalEnfieldModule = async () => {
  try {
    return await import('../../scraper/royalenfield/script.js')
  } catch {
    assert.fail('Expected Royal Enfield scraper module at ../../scraper/royalenfield/script.js')
  }
}

const ROYAL_ENFIELD_SEARCH_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <div id="csrfToken">not-required-for-html-scrape</div>
    <script>
      phApp.ddo = ${JSON.stringify({
        siteConfig: {
          data: {
            refineSearchAPIUrl: 'https://careers.royalenfield.com/widgets',
          },
        },
        eagerLoadRefineSearch: {
          totalHits: 2,
          hits: 10,
          data: {
            jobs: [
              {
                reqId: 'P-101057',
                jobId: 'P-101057',
                title: 'Canteen Incharge',
                cityStateCountry: 'Chennai, Tamil Nadu, India',
                country: 'India',
                category: 'Operations',
                type: 'Regular Full-Time',
                descriptionTeaser: 'Own canteen operations and vendor coordination for plant teams.',
                postedDate: '2026-07-05T00:00:00.000+0000',
                ml_skills: ['Vendor Management', 'Operations'],
              },
              {
                reqId: 'P-101099',
                jobId: 'P-101099',
                title: 'UK Market Lead',
                cityStateCountry: 'London, England, United Kingdom',
                country: 'United Kingdom',
                category: 'Sales',
                type: 'Regular Full-Time',
                descriptionTeaser: 'Drive growth across UK retail channels.',
                postedDate: '2026-07-05T00:00:00.000+0000',
              },
            ],
            aggregations: [
              {
                field: 'country',
                value: {
                  India: 1,
                  'United Kingdom': 1,
                },
              },
            ],
          },
        },
      })};
    </script>
  </body>
</html>
`

const ROYAL_ENFIELD_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge">
    <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Canteen Incharge',
        datePosted: '2026-07-06',
        description: '<p>Lead canteen operations for our Chennai manufacturing campus.</p><p><strong>Required Skills</strong></p><ul><li>Vendor Management</li><li>Operations</li></ul>',
        employmentType: 'FULL_TIME',
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Chennai',
            addressRegion: 'Tamil Nadu',
            addressCountry: 'India',
          },
        },
      })}
    </script>
  </head>
  <body>
    <script>
      phApp.ddo = ${JSON.stringify({
        jobDetail: {
          data: {
            job: {
              jobId: 'P-101057',
              reqId: 'P-101057',
              title: 'Canteen Incharge',
              location: 'Chennai, Tamil Nadu, India',
              category: 'Operations',
              job_type_fields: {
                job_type: 'Regular Full-Time',
              },
              experience_sentences: ['4+ years of experience in facilities or food services operations.'],
              education_sentences: ['Bachelor degree in Hospitality or related field.'],
              ml_Description: '<p>Lead canteen operations for our Chennai manufacturing campus.</p><p><strong>Required Skills</strong></p><ul><li>Vendor Management</li><li>Operations</li></ul>',
              applyUrl: 'https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge/apply',
            },
          },
        },
      })};
    </script>
  </body>
</html>
`

test('buildSearchResultsPageUrl keeps Royal Enfield listings on the verified public Phenom search route', async () => {
  const { buildSearchResultsPageUrl } = await loadRoyalEnfieldModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.royalenfield.com/us/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://careers.royalenfield.com/us/en/search-results?from=10',
  )
})

test('run keeps Royal Enfield on the public India Phenom lane and enriches jobs with detail/apply links', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadRoyalEnfieldModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 5,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buildSearchResultsPageUrl()) {
        return ROYAL_ENFIELD_SEARCH_HTML
      }

      if (url === 'https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge') {
        return ROYAL_ENFIELD_DETAIL_HTML
      }

      throw new Error(`Unexpected Royal Enfield fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.royalenfield.com/us/en/search-results',
    'https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0].requiredSkills, ['Vendor Management', 'Operations'])
  assert.equal(jobs[0].company, 'Royal Enfield')
  assert.equal(jobs[0].source, 'royalenfield')
  assert.equal(jobs[0].jobId, 'P-101057')
  assert.equal(jobs[0].requisitionId, 'P-101057')
  assert.equal(jobs[0].department, 'Operations')
  assert.equal(jobs[0].location, 'Chennai, Tamil Nadu, India')
  assert.equal(jobs[0].city, 'Chennai')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge',
  )
  assert.equal(
    jobs[0].applyUrl,
    'https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge/apply',
  )
  assert.equal(
    jobs[0].link,
    'https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge/apply',
  )
  assert.equal(jobs[0].postingDate, '2026-07-06')
  assert.match(jobs[0].experienceRequired, /4\+ years/i)
  assert.match(jobs[0].minimumQualification, /Bachelor degree/i)
  assert.match(jobs[0].jobDescription, /Chennai manufacturing campus/i)
})

test('run passes the caller abort signal to Royal Enfield page fetches', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadRoyalEnfieldModule()
  const controller = new AbortController()
  const signals = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 1,
    signal: controller.signal,
    fetchText: async (url, options = {}) => {
      signals.push(options.signal)

      if (url === buildSearchResultsPageUrl()) {
        return ROYAL_ENFIELD_SEARCH_HTML
      }

      if (url === 'https://careers.royalenfield.com/us/en/job/P-101057/Canteen-Incharge') {
        return ROYAL_ENFIELD_DETAIL_HTML
      }

      throw new Error(`Unexpected Royal Enfield fixture URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(signals.length, 2)
  assert.ok(signals.every(signal => signal instanceof AbortSignal && !signal.aborted))
  const reason = new Error('Caller stopped after requests')
  controller.abort(reason)
  assert.ok(signals.every(signal => signal.aborted && signal.reason === reason))
})
