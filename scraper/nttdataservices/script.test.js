import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected NTT Data Services scraper module at ./script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Dare to redefine tomorrow</title>
    <link rel="canonical" href="https://www.nttdata.com/en-us">
  </head>
  <body>
    <a aria-label="Go to homepage" href="/en-us/">
      <img alt="NTT DATA Logo" src="/logo.svg">
    </a>
    <nav>
      <a href="/en-us/careers">Careers</a>
    </nav>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Accelerate your career</title>
  </head>
  <body>
    <main>
      <h1>Accelerate your career</h1>
      <h2>Career Opportunities</h2>
      <a href="https://careers.services.global.ntt/global/en/search-results">All jobs</a>
      <a href="https://careers.services.global.ntt/global/en">Experienced Professionals</a>
    </main>
  </body>
</html>
`

const officialJobsHomeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>NTT DATA Careers</title>
  </head>
  <body>
    <script>
      var phApp = phApp || {"widgetApiEndpoint":"https://careers.nttdata.com/widgets"};
      phApp.pageName = "home";
    </script>
    <main>
      <a href="/global/en/c/sales-and-presales-jobs">Sales jobs</a>
      <a href="/global/en/c/consulting-and-advisory-services-jobs">Consulting jobs</a>
      <a href="https://nttglobaldatacenters.wd501.myworkdayjobs.com/External">Data center jobs</a>
      <p>To report a suspected recruiting scam, contact global.careers@nttdata.com.</p>
    </main>
  </body>
</html>
`

const buildSearchResultsHtml = (jobs) => `
<!doctype html>
<html lang="en">
  <head>
    <title>Search results | Find the available job openings at NTT Data</title>
  </head>
  <body>
    <script>
      var phApp = phApp || {"widgetApiEndpoint":"https://careers.nttdata.com/widgets","pageName":"search-results"};
      phApp.ddo = ${JSON.stringify({
        eagerLoadRefineSearch: {
          totalHits: jobs.length,
          hits: jobs.length,
          data: {
            jobs,
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

const buildJobDetailHtml = (sourceUrl, applyUrl = `${sourceUrl}/apply`) => `
<!doctype html>
<html lang="en">
  <head>
    <link rel="canonical" href="${sourceUrl}">
    <script type="application/ld+json">${JSON.stringify({
      '@context': 'http://schema.org',
      '@type': 'JobPosting',
      title: 'SASE ENGINEER ',
      datePosted: '2025-08-12',
      description:
        '<p>Secure the platform for enterprise clients.</p><p>Bachelor of Engineering or equivalent degree.</p>',
      employmentType: ['FULL_TIME'],
      occupationalCategory: 'Information Security',
      jobLocation: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Noida',
          addressRegion: 'Uttar Pradesh',
          addressCountry: 'India',
        },
      },
      hiringOrganization: {
        '@type': 'Organization',
        name: 'NTT Data',
        url: sourceUrl,
      },
    })}</script>
  </head>
  <body>
    <script>
      var phApp = phApp || {};
      phApp.ddo = ${JSON.stringify({
        jobDetail: {
          data: {
            job: {
              jobId: 'P-100131',
              reqId: 'P-100131',
              title: 'SASE ENGINEER ',
              city: 'Noida',
              location: 'Noida, Uttar Pradesh, India',
              ml_country: 'India',
              category: 'Information Security',
              ml_Description:
                '<p>Secure the platform for enterprise clients.</p><p>Bachelor of Engineering or equivalent degree.</p>',
              experience_sentences: ['5+ years of experience in security operations.'],
              education_sentences: ['Bachelor of Engineering or equivalent degree.'],
              skills_sentences: ['Palo Alto Firewall', 'SASE'],
              job_type_fields: {
                job_type: 'Full-Time',
              },
              postedDate: '2025-08-12',
              applyUrl,
            },
          },
        },
      })};
    </script>
  </body>
</html>
`

test('NTT enriches four independent details concurrently while retaining verified role identity', async () => {
  const ntt = await loadModule();
  const rows = Array.from({ length: 4 }, (_, i) => ({ reqId: String(i + 1), jobId: String(i + 1),
    title: 'Engineer ' + (i + 1), country: 'India', cityStateCountry: 'Bengaluru, India' }));
  let started = 0, release;
  const barrier = new Promise(resolve => { release = resolve; });
  const jobs = await ntt.run({ detailEnrichmentBudgetMs: 1000, fetchText: async url => {
    if (url === ntt.HOMEPAGE_URL) return officialHomepageHtml;
    if (url === ntt.CAREERS_URL) return officialCareersHtml;
    if (url === ntt.JOBS_HOME_URL) return officialJobsHomeHtml;
    if (url === ntt.SEARCH_RESULTS_URL) return buildSearchResultsHtml(rows);
    if (++started === 4) release();
    await barrier;
    const row = rows.find(job => url.includes('/job/' + job.jobId + '/'));
    return '<script>phApp.ddo = ' + JSON.stringify({ jobDetail: { data: { job: {
      ...row, ml_country: 'India', ml_Description: '<p>Build and maintain customer software services.</p>',
    } } } }) + '</script>';
  } });
  assert.equal(started, 4);
  assert.equal(jobs.length, 4);
  assert.ok(jobs.every(job => job.sourceDetailComplete && job.jobDescription === 'Build and maintain customer software services.'));
});

test('NTT Data Services scraper exposes the verified first-party surfaces and Phenom URL builders', async () => {
  const ntt = await loadModule()

  assert.equal(ntt.SOURCE, 'nttdataservices')
  assert.equal(ntt.COMPANY, 'NTT Data Services')
  assert.equal(ntt.HOMEPAGE_URL, 'https://www.nttdata.com/en-us')
  assert.equal(ntt.CAREERS_URL, 'https://www.nttdata.com/en-us/careers')
  assert.equal(ntt.JOBS_HOME_URL, 'https://careers.nttdata.com/global/en')
  assert.equal(
    ntt.SEARCH_RESULTS_URL,
    'https://careers.nttdata.com/global/en/search-results',
  )
  assert.equal(ntt.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(ntt.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(ntt.hasOfficialJobsHomeSignal(officialJobsHomeHtml), true)
  assert.equal(
    ntt.hasOfficialSearchResultsSignal(buildSearchResultsHtml([])),
    true,
  )
  assert.equal(
    ntt.buildSearchResultsPageUrl(),
    'https://careers.nttdata.com/global/en/search-results',
  )
  assert.equal(
    ntt.buildSearchResultsPageUrl(20),
    'https://careers.nttdata.com/global/en/search-results?from=20',
  )
  assert.equal(
    ntt.buildJobDetailUrl({ reqId: 'P-100131', title: 'SASE ENGINEER ' }),
    'https://careers.nttdata.com/global/en/job/P-100131/SASE-ENGINEER',
  )
})

for (const [kind, applicationUrl] of [
  ['external', () => 'https://ntt.wd3.myworkdayjobs.com/External/job/Noida/SASE-ENGINEER_P-100131/apply'],
  ['different role', () => 'https://careers.nttdata.com/global/en/job/P-OTHER/Engineer/apply'],
  ['redirect query', sourceUrl => `${sourceUrl}/apply?redirect=https%3A%2F%2Funrelated.invalid`],
]) test(`NTT Data Services preserves India identity but rejects an uncorroborated ${kind} detail-only application URL`, async () => {
  const ntt = await loadModule()
  const requestedUrls = []
  const searchResultsUrl = ntt.SEARCH_RESULTS_URL
  const detailUrl =
    'https://careers.nttdata.com/global/en/job/P-100131/SASE-ENGINEER'

  const jobs = await ntt.createNttDataServicesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === ntt.HOMEPAGE_URL) return officialHomepageHtml
      if (url === ntt.CAREERS_URL) return officialCareersHtml
      if (url === ntt.JOBS_HOME_URL) return officialJobsHomeHtml
      if (url === searchResultsUrl) {
        return buildSearchResultsHtml([
          {
            reqId: 'P-100131',
            jobId: 'P-100131',
            title: 'SASE ENGINEER ',
            cityStateCountry: 'Noida, Uttar Pradesh, India',
            country: 'India',
            category: 'Information Security',
            type: 'Full-Time',
            postedDate: '2025-08-12',
            experience: '5+ years of experience in security operations.',
            ml_skills: ['Palo Alto Firewall', 'SASE'],
          },
          {
            reqId: 'US-001',
            jobId: 'US-001',
            title: 'Cloud Architect',
            cityStateCountry: 'Plano, Texas, United States',
            country: 'United States',
            category: 'Technical Engineering',
            type: 'Full-Time',
          },
        ])
      }
      if (url === detailUrl) return buildJobDetailHtml(detailUrl, applicationUrl(detailUrl))
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    ntt.HOMEPAGE_URL,
    ntt.CAREERS_URL,
    ntt.JOBS_HOME_URL,
    searchResultsUrl,
    detailUrl,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'NTT Data Services')
  assert.equal(jobs[0].source, 'nttdataservices')
  assert.equal(jobs[0].jobId, 'P-100131')
  assert.equal(jobs[0].requisitionId, 'P-100131')
  assert.equal(jobs[0].title, 'SASE ENGINEER')
  assert.equal(jobs[0].city, 'Noida')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].employmentType, 'Full-time')
  assert.equal(jobs[0].postingDate, '2025-08-12')
  assert.equal(
    jobs[0].applyUrl,
    detailUrl,
  )
  assert.equal(jobs[0].sourceUrl, detailUrl)
  assert.equal(jobs[0].minimumQualification, null)
  assert.deepEqual(jobs[0].requiredSkills, ['Palo Alto Firewall', 'SASE'])
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.match(jobs[0].experienceRequired, /5\+ years/i)
  assert.ok(jobs[0].scrapedAt)
})

test('NTT Data Services accepts the exact first-party same-role apply route after native identity checks', async () => {
  const ntt = await loadModule()
  const detailUrl = 'https://careers.nttdata.com/global/en/job/P-100131/SASE-ENGINEER'
  const pages = new Map([
    [ntt.HOMEPAGE_URL, officialHomepageHtml],
    [ntt.CAREERS_URL, officialCareersHtml],
    [ntt.JOBS_HOME_URL, officialJobsHomeHtml],
    [ntt.SEARCH_RESULTS_URL, buildSearchResultsHtml([{
      reqId: 'P-100131', jobId: 'P-100131', title: 'SASE ENGINEER ',
      cityStateCountry: 'Noida, Uttar Pradesh, India', country: 'India',
    }])],
    [detailUrl, buildJobDetailHtml(detailUrl)],
  ])
  const calls = []
  const jobs = await ntt.run({ fetchText: async url => {
    calls.push(url)
    assert.ok(pages.has(url), `Unexpected offline request: ${url}`)
    return pages.get(url)
  } })
  assert.deepEqual(calls, [...pages.keys()])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'P-100131')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, detailUrl)
  assert.equal(jobs[0].applyUrl, `${detailUrl}/apply`)
  assert.equal(jobs[0].link, `${detailUrl}/apply`)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceDetailFailureKind, undefined)
  assert.match(jobs[0].jobDescription, /Secure the platform for enterprise clients/)
})

test('NTT Data Services scraper fails closed when a verified first-party surface changes', async () => {
  const ntt = await loadModule()

  await assert.rejects(
    ntt.createNttDataServicesScraper().run({
      fetchText: async (url) => {
        if (url === ntt.HOMEPAGE_URL) {
          return '<html><body><h1>Welcome</h1></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers handoff/i,
  )

  await assert.rejects(
    ntt.createNttDataServicesScraper().run({
      fetchText: async (url) => {
        if (url === ntt.HOMEPAGE_URL) return officialHomepageHtml
        if (url === ntt.CAREERS_URL) return officialCareersHtml
        if (url === ntt.JOBS_HOME_URL) return officialJobsHomeHtml
        if (url === ntt.SEARCH_RESULTS_URL) {
          return '<html><head><title>Jobs</title></head><body>No verified board</body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party public jobs surface/i,
  )
})


const loadCurrentHomepage = async () => {
  const { readFile } = await import('node:fs/promises')
  return readFile(new URL('./fixtures/homepage-current.html', import.meta.url), 'utf8')
}

test('NTT Data Services accepts the verified Intelligence to Impact homepage without changing the India Phenom handoff', async () => {
  const ntt = await loadModule()
  const homepage = await loadCurrentHomepage()
  assert.equal(ntt.hasOfficialHomepageSignal(homepage), true)
  const detailUrl = 'https://careers.nttdata.com/global/en/job/P-100131/SASE-ENGINEER'
  const jobs = await ntt.run({
    fetchText: async url => {
      if (url === ntt.HOMEPAGE_URL) return homepage
      if (url === ntt.CAREERS_URL) return officialCareersHtml
      if (url === ntt.JOBS_HOME_URL) return officialJobsHomeHtml
      if (url === ntt.SEARCH_RESULTS_URL) return buildSearchResultsHtml([
        { reqId: 'P-100131', jobId: 'P-100131', title: 'SASE ENGINEER', country: 'India', cityStateCountry: 'Noida, Uttar Pradesh, India' },
        { reqId: 'US-001', jobId: 'US-001', title: 'Cloud Architect', country: 'United States', cityStateCountry: 'Plano, Texas, United States' },
      ])
      if (url === detailUrl) return buildJobDetailHtml(detailUrl)
      throw new Error('Unexpected URL: ' + url)
    },
  })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, ntt.COMPANY)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, detailUrl)
})

test('NTT Data Services rejects altered homepage brand, canonical identity, and careers links', async () => {
  const ntt = await loadModule()
  const homepage = await loadCurrentHomepage()
  for (const changed of [
    homepage.replace(/<title[^>]*>Intelligence to Impact<\/title>/, '<title>Other homepage</title>'),
    homepage.replace(/(<h1\b[^>]*>)Intelligence to Impact(<\/h1>)/, '$1Other heading$2'),
    homepage.replace('href="https://www.nttdata.com/en-us" data-next-head', 'href="https://example.org/en-us" data-next-head'),
    homepage.replace(/href="\/en-us\/careers"/g, 'href="https://example.org/careers"'),
    homepage.replace(/alt="NTT DATA Logo"/g, 'alt="Other employer logo"'),
  ]) {
    assert.notEqual(changed, homepage)
    assert.equal(ntt.hasOfficialHomepageSignal(changed), false)
  }
})
