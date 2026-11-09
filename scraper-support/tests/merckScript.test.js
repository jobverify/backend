import assert from 'node:assert/strict'
import test from 'node:test'

const loadMerckModule = async () => {
  try {
    return await import('../../scraper/merck/script.js')
  } catch {
    assert.fail('Expected Merck scraper module at ../../scraper/merck/script.js')
  }
}

const MERCK_SEARCH_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      phApp.ddo = ${JSON.stringify({
        siteConfig: {
          data: {
            refineSearchAPIUrl: 'https://careers.merckgroup.com/widgets',
          },
        },
        eagerLoadRefineSearch: {
          totalHits: 2,
          hits: 10,
          data: {
            jobs: [
              {
                reqId: '900001',
                jobId: '900001',
                title: 'Senior Data Scientist',
                cityStateCountry: 'Bengaluru, Karnataka, India',
                country: 'India',
                category: 'Information Technology',
                type: 'Regular Full-Time',
                descriptionTeaser: 'Lead applied machine-learning initiatives for Merck research teams.',
                postedDate: '2026-07-01T00:00:00.000+0000',
                applyUrl: 'https://performancemanager12.successfactors.eu/career?company=merckgroup&career_job_req_id=900001&career_ns=job_listing',
                ml_skills: ['Python', 'Machine Learning'],
              },
              {
                reqId: '900002',
                jobId: '900002',
                title: 'Principal Scientist',
                cityStateCountry: 'Darmstadt, Hesse, Germany',
                country: 'Germany',
                category: 'Research',
                type: 'Regular Full-Time',
                descriptionTeaser: 'Drive the next generation of materials science programs.',
                postedDate: '2026-07-03T00:00:00.000+0000',
                applyUrl: 'https://performancemanager12.successfactors.eu/career?company=merckgroup&career_job_req_id=900002&career_ns=job_listing',
              },
            ],
            aggregations: [
              {
                field: 'country',
                value: {
                  India: 1,
                  Germany: 1,
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

const MERCK_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://careers.merckgroup.com/global/en/job/900001/Senior-Data-Scientist">
    <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Senior Data Scientist',
        datePosted: '2026-07-02',
        description: '<p>Build models that accelerate pharmaceutical discovery.</p><p><strong>Required Skills</strong></p><ul><li>Python</li><li>Machine Learning</li></ul>',
        employmentType: 'FULL_TIME',
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Bengaluru',
            addressRegion: 'Karnataka',
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
              jobId: '900001',
              reqId: '900001',
              title: 'Senior Data Scientist',
              location: 'Bengaluru, Karnataka, India',
              category: 'Information Technology',
              job_type_fields: {
                job_type: 'Regular Full-Time',
              },
              experience_sentences: ['5+ years of experience in data science.'],
              education_sentences: ['Bachelor degree in Computer Science or related field.'],
              ml_Description: '<p>Build models that accelerate pharmaceutical discovery.</p><p><strong>Required Skills</strong></p><ul><li>Python</li><li>Machine Learning</li></ul>',
              applyUrl: 'https://performancemanager12.successfactors.eu/career?company=merckgroup&career_job_req_id=900001&career_ns=job_listing',
            },
          },
        },
      })};
    </script>
  </body>
</html>
`

test('buildSearchResultsPageUrl keeps Merck listings on the official Phenom search route', async () => {
  const { buildSearchResultsPageUrl } = await loadMerckModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.merckgroup.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://careers.merckgroup.com/global/en/search-results?from=10',
  )
})

test('run keeps Merck on the official India Phenom lane and enriches jobs with SuccessFactors apply links', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadMerckModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 5,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buildSearchResultsPageUrl()) {
        return MERCK_SEARCH_HTML
      }

      if (url === 'https://careers.merckgroup.com/global/en/job/900001/Senior-Data-Scientist') {
        return MERCK_DETAIL_HTML
      }

      throw new Error(`Unexpected Merck fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.merckgroup.com/global/en/search-results',
    'https://careers.merckgroup.com/global/en/job/900001/Senior-Data-Scientist',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0].requiredSkills, ['Python', 'Machine Learning'])
  assert.equal(jobs[0].company, 'Merck')
  assert.equal(jobs[0].source, 'merck')
  assert.equal(jobs[0].jobId, '900001')
  assert.equal(jobs[0].requisitionId, '900001')
  assert.equal(jobs[0].department, 'Information Technology')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.merckgroup.com/global/en/job/900001/Senior-Data-Scientist',
  )
  assert.equal(
    jobs[0].applyUrl,
    'https://performancemanager12.successfactors.eu/career?company=merckgroup&career_job_req_id=900001&career_ns=job_listing',
  )
  assert.equal(
    jobs[0].link,
    'https://performancemanager12.successfactors.eu/career?company=merckgroup&career_job_req_id=900001&career_ns=job_listing',
  )
  assert.equal(jobs[0].postingDate, '2026-07-02')
  assert.match(jobs[0].experienceRequired, /5\+ years/i)
  assert.match(jobs[0].minimumQualification, /Bachelor degree/i)
  assert.match(jobs[0].jobDescription, /accelerate pharmaceutical discovery/i)
})
