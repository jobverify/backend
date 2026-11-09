import assert from 'node:assert/strict'
import test from 'node:test'

const loadTraneModule = async () => {
  try {
    return await import('../../scraper/tranetechnologies/script.js')
  } catch {
    assert.fail('Expected Trane Technologies scraper module at ../../scraper/tranetechnologies/script.js')
  }
}

const TRANE_SEARCH_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      phApp.ddo = ${JSON.stringify({
        siteConfig: {
          data: {
            refineSearchAPIUrl: 'https://careers.tranetechnologies.com/widgets',
          },
        },
        eagerLoadRefineSearch: {
          totalHits: 2,
          hits: 10,
          data: {
            jobs: [
              {
                reqId: 'JR-12345',
                jobId: 'JR-12345',
                title: 'Senior Software Engineer',
                applyUrl: 'https://tranetechnologies.wd12.myworkdayjobs.com/Trane_Technologies_Careers/job/Bengaluru-Karnataka-India/Senior-Software-Engineer_JR-12345/apply',
                cityStateCountry: 'Bengaluru, Karnataka, India',
                country: 'India',
                category: 'Engineering',
                type: 'Regular Full-Time',
                descriptionTeaser: 'Build digital products for Trane Technologies India teams.',
                postedDate: '2026-07-09T00:00:00.000+0000',
                ml_skills: ['Node.js', 'AWS'],
              },
              {
                reqId: 'JR-99999',
                jobId: 'JR-99999',
                title: 'Regional Sales Lead',
                cityStateCountry: 'Davidson, North Carolina, United States',
                country: 'United States',
                category: 'Sales',
                type: 'Regular Full-Time',
                descriptionTeaser: 'Lead regional commercial strategy.',
                postedDate: '2026-07-09T00:00:00.000+0000',
              },
            ],
            aggregations: [
              {
                field: 'country',
                value: {
                  India: 1,
                  'United States': 1,
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

const TRANE_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://careers.tranetechnologies.com/global/en/job/JR-12345/Senior-Software-Engineer">
    <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Senior Software Engineer',
        datePosted: '2026-07-09',
        description: '<p>Build digital products for Trane Technologies India teams.</p><p><strong>Required Skills</strong></p><ul><li>Node.js</li><li>AWS</li></ul>',
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
              jobId: 'JR-12345',
              reqId: 'JR-12345',
              title: 'Senior Software Engineer',
              location: 'Bengaluru, Karnataka, India',
              category: 'Engineering',
              job_type_fields: {
                job_type: 'Regular Full-Time',
              },
              experience_sentences: ['5+ years of experience building cloud applications.'],
              education_sentences: ['Bachelor degree in Computer Science or related field.'],
              ml_Description: '<p>Build digital products for Trane Technologies India teams.</p><p><strong>Required Skills</strong></p><ul><li>Node.js</li><li>AWS</li></ul>',
              applyUrl: 'https://tranetechnologies.wd12.myworkdayjobs.com/Trane_Technologies_Careers/job/Bengaluru-Karnataka-India/Senior-Software-Engineer_JR-12345/apply',
            },
          },
        },
      })};
    </script>
  </body>
</html>
`

test('buildSearchResultsPageUrl keeps Trane Technologies listings on the verified public Phenom route', async () => {
  const { buildSearchResultsPageUrl } = await loadTraneModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.tranetechnologies.com/global/en/search-results?s=1',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://careers.tranetechnologies.com/global/en/search-results?s=1&from=10',
  )
})

test('run keeps Trane Technologies on the public India Phenom lane and preserves Workday apply handoffs', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadTraneModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 5,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buildSearchResultsPageUrl()) {
        return TRANE_SEARCH_HTML
      }

      if (url === 'https://careers.tranetechnologies.com/global/en/job/JR-12345/Senior-Software-Engineer') {
        return TRANE_DETAIL_HTML
      }

      throw new Error(`Unexpected Trane fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.tranetechnologies.com/global/en/search-results?s=1',
    'https://careers.tranetechnologies.com/global/en/job/JR-12345/Senior-Software-Engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0].requiredSkills, ['Node.js', 'AWS'])
  assert.equal(jobs[0].company, 'Trane Technologies')
  assert.equal(jobs[0].source, 'tranetechnologies')
  assert.equal(jobs[0].jobId, 'JR-12345')
  assert.equal(jobs[0].requisitionId, 'JR-12345')
  assert.equal(jobs[0].department, 'Engineering')
  assert.equal(jobs[0].location, 'Bengaluru, Karnataka, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.tranetechnologies.com/global/en/job/JR-12345/Senior-Software-Engineer',
  )
  assert.equal(
    jobs[0].applyUrl,
    'https://tranetechnologies.wd12.myworkdayjobs.com/Trane_Technologies_Careers/job/Bengaluru-Karnataka-India/Senior-Software-Engineer_JR-12345/apply',
  )
  assert.equal(
    jobs[0].link,
    'https://tranetechnologies.wd12.myworkdayjobs.com/Trane_Technologies_Careers/job/Bengaluru-Karnataka-India/Senior-Software-Engineer_JR-12345/apply',
  )
  assert.equal(jobs[0].postingDate, '2026-07-09')
  assert.match(jobs[0].experienceRequired, /5\+ years/i)
  assert.match(jobs[0].minimumQualification, /Bachelor degree/i)
  assert.match(jobs[0].jobDescription, /Trane Technologies India teams/i)
})
