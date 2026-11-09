import assert from 'node:assert/strict'
import test from 'node:test'

const loadMarsModule = async () => {
  try {
    return await import('../../scraper/mars/script.js')
  } catch {
    assert.fail('Expected Mars scraper module at ../../scraper/mars/script.js')
  }
}

const MARS_SEARCH_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <script>
      phApp.ddo = ${JSON.stringify({
        siteConfig: {
          data: {
            refineSearchAPIUrl: 'https://careers.mars.com/widgets',
          },
        },
        eagerLoadRefineSearch: {
          totalHits: 2,
          hits: 10,
          data: {
            jobs: [
              {
                reqId: 'R129167',
                jobId: 'R129167',
                title: 'Senior Data Engineer',
                cityStateCountry: 'Hyderabad, Telangana, India',
                country: 'India',
                category: 'Digital Technologies',
                type: 'Full time',
                descriptionTeaser: 'Build modern data products and pipelines for Mars digital platforms.',
                postedDate: '2026-07-08T00:00:00.000+0000',
                ml_skills: ['Python', 'AWS', 'Airflow'],
                applyUrl: 'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167/apply',
              },
              {
                reqId: 'R500001',
                jobId: 'R500001',
                title: 'Regional Brand Manager',
                cityStateCountry: 'Chicago, Illinois, United States',
                country: 'United States',
                category: 'Marketing',
                type: 'Full time',
                descriptionTeaser: 'Lead portfolio marketing for North America.',
                postedDate: '2026-07-08T00:00:00.000+0000',
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

const MARS_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer">
    <script type="application/ld+json">
      ${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: 'Senior Data Engineer',
        datePosted: '2026-07-08',
        description: '<p>Build modern data products and pipelines for Mars digital platforms.</p><p><strong>Required Skills</strong></p><ul><li>Python</li><li>AWS</li><li>Airflow</li></ul>',
        employmentType: 'FULL_TIME',
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Hyderabad',
            addressRegion: 'Telangana',
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
              jobId: 'R129167',
              reqId: 'R129167',
              title: 'Senior Data Engineer',
              location: 'Hyderabad, Telangana, India',
              category: 'Digital Technologies',
              job_type_fields: {
                job_type: 'Full time',
              },
              experience_sentences: ['5+ years of experience building modern data platforms.'],
              education_sentences: ['Bachelor degree in Computer Science or related field.'],
              ml_Description: '<p>Build modern data products and pipelines for Mars digital platforms.</p><p><strong>Required Skills</strong></p><ul><li>Python</li><li>AWS</li><li>Airflow</li></ul>',
              applyUrl: 'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167-1/apply',
            },
          },
        },
      })};
    </script>
  </body>
</html>
`

test('buildSearchResultsPageUrl and buildJobDetailUrl keep Mars on the verified public Phenom routes', async () => {
  const {
    buildJobDetailUrl,
    buildSearchResultsPageUrl,
  } = await loadMarsModule()

  assert.equal(
    buildSearchResultsPageUrl(),
    'https://careers.mars.com/global/en/search-results',
  )
  assert.equal(
    buildSearchResultsPageUrl(10),
    'https://careers.mars.com/global/en/search-results?from=10',
  )
  assert.equal(
    buildJobDetailUrl({ reqId: 'R129167', title: 'Senior Data Engineer' }),
    'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer',
  )
})

test('extractSearchPayload reads Mars embedded Phenom search payloads and India aggregation counts', async () => {
  const { extractSearchPayload } = await loadMarsModule()
  const payload = extractSearchPayload(MARS_SEARCH_HTML)

  assert.equal(payload.widgetApiEndpoint, 'https://careers.mars.com/widgets')
  assert.equal(payload.totalHits, 2)
  assert.equal(payload.hits, 10)
  assert.equal(payload.jobs.length, 2)
  assert.equal(payload.aggregations.country.India, 1)
  assert.equal(payload.jobs[0].reqId, 'R129167')
})

test('extractSearchResults normalizes Mars India listings and preserves the public Workday apply handoff from search', async () => {
  const {
    extractSearchPayload,
    extractSearchResults,
  } = await loadMarsModule()
  const jobs = extractSearchResults(extractSearchPayload(MARS_SEARCH_HTML))
  const seniorDataEngineer = jobs.find((job) => job.jobId === 'R129167')

  assert.deepEqual(seniorDataEngineer, {
    title: 'Senior Data Engineer',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'R129167',
    requisitionId: 'R129167',
    department: 'Digital Technologies',
    employmentType: 'Full-time',
    sourceEmploymentType: 'Full-time',
    sourceExperienceRequired: null,
    experienceRequired: null,
    jobDescription: 'Build modern data products and pipelines for Mars digital platforms.',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Python', 'AWS', 'Airflow'],
    postingDate: '2026-07-08T00:00:00.000+0000',
    applyUrl: 'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167/apply',
    sourceUrl: 'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer',
  })
})

test('extractJobDetail reads Mars detail metadata and upgrades the Workday apply handoff when the -1 variant is published', async () => {
  const { extractJobDetail } = await loadMarsModule()
  const detail = extractJobDetail(MARS_DETAIL_HTML, {
    title: 'Senior Data Engineer',
    location: 'Hyderabad, Telangana, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'R129167',
    requisitionId: 'R129167',
    department: 'Digital Technologies',
    applyUrl: 'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167/apply',
    sourceUrl: 'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer',
  })

  assert.equal(detail.title, 'Senior Data Engineer')
  assert.equal(detail.location, 'Hyderabad, Telangana, India')
  assert.equal(detail.city, 'Hyderabad')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'R129167')
  assert.equal(detail.requisitionId, 'R129167')
  assert.equal(detail.department, 'Digital Technologies')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '5+ years')
  assert.match(detail.minimumQualification, /Bachelor degree/i)
  assert.equal(detail.preferredQualification, null)
  assert.equal(detail.postingDate, '2026-07-08')
  assert.equal(
    detail.applyUrl,
    'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167-1/apply',
  )
  assert.equal(
    detail.sourceUrl,
    'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer',
  )
  assert.match(detail.jobDescription, /Mars digital platforms/i)
  assert.deepEqual(detail.requiredSkills, ['Python', 'AWS', 'Airflow'])
})

test('run keeps Mars jobs on the verified public Phenom search route and returns the Workday apply handoff', async () => {
  const {
    buildSearchResultsPageUrl,
    run,
  } = await loadMarsModule()
  const requestedUrls = []

  const jobs = await run({
    maxPages: 1,
    maxJobs: 5,
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buildSearchResultsPageUrl()) {
        // Synthetic matching-pair setup; the original mismatched fixtures stay intact.
        const matchingSearch = MARS_SEARCH_HTML.replace("https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167/apply", "https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167-1/apply")
        assert.notEqual(matchingSearch, MARS_SEARCH_HTML)
        return matchingSearch
      }

      if (url === 'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer') {
        return MARS_DETAIL_HTML
      }

      throw new Error(`Unexpected Mars fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://careers.mars.com/global/en/search-results',
    'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceDetailFailureKind, undefined)
  assert.deepEqual(jobs[0].requiredSkills, ['Python', 'AWS', 'Airflow'])
  assert.equal(jobs[0].company, 'Mars')
  assert.equal(jobs[0].source, 'mars')
  assert.equal(jobs[0].jobId, 'R129167')
  assert.equal(jobs[0].requisitionId, 'R129167')
  assert.equal(jobs[0].department, 'Digital Technologies')
  assert.equal(jobs[0].location, 'Hyderabad, Telangana, India')
  assert.equal(jobs[0].city, 'Hyderabad')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(
    jobs[0].sourceUrl,
    'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer',
  )
  assert.equal(
    jobs[0].applyUrl,
    'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167-1/apply',
  )
  assert.equal(
    jobs[0].link,
    'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167-1/apply',
  )
  assert.equal(jobs[0].postingDate, '2026-07-08')
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.match(jobs[0].minimumQualification, /Bachelor degree/i)
  assert.match(jobs[0].jobDescription, /Mars digital platforms/i)
})


for (const [name, replacement] of [
  ['the original differently suffixed apply URL', null],
  ['an unrelated Workday role URL', 'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Delhi/Other_R999999/apply'],
  ['an unrelated apply host', 'https://careers.other.example/apply/R129167'],
]) test('Mars retains an unqualified listing when detail supplies ' + name, async () => {
  const { run, extractSearchResults, extractSearchPayload } = await loadMarsModule()
  const originalDetailURL = 'https://mars.wd3.myworkdayjobs.com/en-US/External/job/Hyderabad-Telangana-India/Senior-Data-Engineer_R129167-1/apply'
  const html = replacement ? MARS_DETAIL_HTML.replace(originalDetailURL, replacement) : MARS_DETAIL_HTML
  if (replacement) assert.notEqual(html, MARS_DETAIL_HTML)
  const requested = []
  const jobs = await run({ maxPages: 1, maxJobs: 5, fetchText: async url => {
    requested.push(url)
    if (url === 'https://careers.mars.com/global/en/search-results') return MARS_SEARCH_HTML
    if (url === 'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer') return html
    throw Error('Unexpected synthetic fixture request: ' + url)
  } })
  const listing = extractSearchResults(extractSearchPayload(MARS_SEARCH_HTML)).find(job => job.jobId === 'R129167')
  assert.deepEqual(requested, ['https://careers.mars.com/global/en/search-results', 'https://careers.mars.com/global/en/job/R129167/Senior-Data-Engineer'])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(jobs[0].applyUrl, listing.applyUrl)
  assert.equal(jobs[0].link, listing.applyUrl)
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingTeaser, listing.jobDescription)
  assert.equal(jobs[0].jobId, listing.jobId)
  assert.equal(jobs[0].country, listing.country)
})
