import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-15T00:00:00.000Z'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Aker Solutions</title>
    <link rel="canonical" href="https://www.akersolutions.com/careers/" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>See all available jobs</p>
      <div>38 Vacancies</div>
      <nav>
        <a href="/careers/job-search/">See all available jobs</a>
        <a href="/careers/job-search/?region=Asia%20Pacific">Asia Pacific 1</a>
        <a href="/careers/job-search/?region=Europe">Europe 33</a>
      </nav>
    </main>
  </body>
</html>
`

const listingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Search at Aker Solutions. Find all available positions and job banks here | Aker Solutions</title>
    <meta property="og:url" content="https://www.akersolutions.com/careers/job-search/" />
    <link rel="canonical" href="https://www.akersolutions.com/careers/job-search/" />
  </head>
  <body>
    <main>
      <h1>Job Search</h1>
      <p>All countries</p>
      <p>India</p>
      <p>Mumbai</p>
      <p>Permanent</p>
      <p>38 Vacancies</p>
    </main>
    <script>
      window.__AKER_LISTING__ = {"jobs":[
        {"title":{"linkText":"Lead Engineer - Process Safety","href":"/careers/job-search?jobPostId=21793","linkType":0,"size":0,"theme":0,"fullRefreshProperties":null,"ope":{}},"location":"Mumbai","region":"Asia Pacific","country":"India","jobType":"","positionType":"Permanent","deadline":"July 31, 2026","fullRefreshProperties":null,"ope":{}},
        {"title":{"linkText":"Senior Instrument Engineer","href":"/careers/job-search?jobPostId=21835","linkType":0,"size":0,"theme":0,"fullRefreshProperties":null,"ope":{}},"location":"Stavanger","region":"Europe","country":"Norway","jobType":"","positionType":"Permanent","deadline":"August 17, 2026","fullRefreshProperties":null,"ope":{}}
      ],"placeholderList":["e.g. Software Developer"],"textInputLabel":"What kind of job are you looking for?","loadMoreJobsText":"Load more","filters":[
        {"property":"country","defaultValue":null,"urlParameterName":"country","label":"Country","options":null,"allOption":"All countries","sortAlphabetically":false,"fullRefreshProperties":null,"ope":{}},
        {"property":"location","defaultValue":"","urlParameterName":"location","label":"Location","options":null,"allOption":"All locations","sortAlphabetically":false,"fullRefreshProperties":null,"ope":{}},
        {"property":"positionType","defaultValue":"","urlParameterName":"positionType","label":"Position type","options":null,"allOption":"All position types","sortAlphabetically":false,"fullRefreshProperties":null,"ope":{}}
      ],"showMoreHitsLabel":null,"defaultSearchTerm":"","showFilter":"Show Job Filters","hideFilter":"Hide Job Filters","blockName":"JobListBlock","fullRefreshProperties":null,"ope":{}};
    </script>
    <script>
      window.__AKER_INFO__ = {"infoSection":[
        {"title":"Employees","number":"11,800","fullRefreshProperties":null,"ope":{}},
        {"title":"Locations","number":"36","fullRefreshProperties":null,"ope":{}},
        {"title":"Share Price","number":"45.16","fullRefreshProperties":null,"ope":{}},
        {"title":"Vacancies","number":"38","fullRefreshProperties":null,"ope":{}}
      ]};
    </script>
  </body>
</html>
`

const detailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Lead Engineer - Process Safety | Aker Solutions</title>
    <meta property="og:url" content="https://www.akersolutions.com/careers/job-search/?jobPostId=21793" />
    <link rel="canonical" href="https://www.akersolutions.com/careers/job-search/?jobPostId=21793" />
  </head>
  <body>
    <main>
      <h1>Lead Engineer - Process Safety</h1>
      <div>Location: Mumbai, India</div>
      <div>Apply by: July 31, 2026</div>
      <div>Position type: Permanent</div>
      <div>Job ID #: 21793</div>
      <a href="https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=21793&amp;company=akersoluti">Apply</a>
    </main>
    <script>
      window.__AKER_DETAIL__ = {"info":{"eventInfo":[
        {"label":"Location: ","value":"Mumbai, India","fullRefreshProperties":null,"ope":{}},
        {"label":"Apply by: ","value":"July 31, 2026","fullRefreshProperties":null,"ope":{}},
        {"label":"Position type: ","value":"Permanent","fullRefreshProperties":null,"ope":{}},
        {"label":"Job ID #: ","value":"21793","fullRefreshProperties":null,"ope":{}}
      ],"registerLink":{"linkText":"Apply","href":"https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=21793&company=akersoluti","linkType":0,"size":0,"theme":0,"fullRefreshProperties":null,"ope":{}},"calendarLink":null,"blockName":"EventInfo","fullRefreshProperties":null,"ope":{}},"article":{"items":[
        {"text":{"blockName":"RichTextBlock","items":[{"html":"\\u003ch2\\u003eWhat will you be doing?\\u003c/h2\\u003e\\u003cp\\u003eLead process safety for offshore and onshore projects.\\u003c/p\\u003e\\u003cul type=\\"disc\\"\\u003e\\u003cli\\u003eDrive HAZOP reviews\\u003c/li\\u003e\\u003cli\\u003eSupport cross-functional teams\\u003c/li\\u003e\\u003c/ul\\u003e\\u003ch2\\u003eWe think you should have:\\u003c/h2\\u003e\\u003cp\\u003eBachelor or Master of Engineering and 10 to 15 years of experience.\\u003c/p\\u003e\\u003ch2\\u003eWhat we offer:\\u003c/h2\\u003e\\u003cp\\u003eRewarding career opportunities.\\u003c/p\\u003e\\u003ch2\\u003eApply Now!\\u003c/h2\\u003e\\u003cp\\u003eCareers.India@akersolutions.com\\u003c/p\\u003e\\u003cp\\u003eBackground checks are conducted on all final candidates.\\u003c/p\\u003e\\u003ch2\\u003eDiversity and Inclusion\\u003c/h2\\u003e\\u003cp\\u003eWe foster an environment where everyone can thrive.\\u003c/p\\u003e\\u003ch2\\u003eThis is Aker Solutions\\u003c/h2\\u003e\\u003cp\\u003eAker Solutions employs approximately 11,800 people in 13 countries.\\u003c/p\\u003e","blockName":"RichText","fullRefreshProperties":null,"ope":{}}],"contentAreaType":2,"propertyName":null,"fullRefreshProperties":null,"ope":{}}}
      ]}};
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/akersolutionsindia/script.js')
  } catch {
    assert.fail('Expected Aker Solutions India scraper module at ../../scraper/akersolutionsindia/script.js')
  }
}

test('Aker Solutions India constants and parsers stay pinned to the verified first-party careers surface', async () => {
  const akerSolutionsIndia = await loadModule()

  assert.equal(akerSolutionsIndia.COMPANY_NAME, 'Aker Solutions India')
  assert.equal(akerSolutionsIndia.SOURCE, 'akersolutionsindia')
  assert.equal(akerSolutionsIndia.COUNTRY_FILTER, 'India')
  assert.equal(akerSolutionsIndia.CAREERS_HOME_URL, 'https://www.akersolutions.com/careers/')
  assert.equal(akerSolutionsIndia.JOB_SEARCH_URL, 'https://www.akersolutions.com/careers/job-search/')
  assert.equal(
    akerSolutionsIndia.VERIFIED_INDIA_JOB_URL,
    'https://www.akersolutions.com/careers/job-search?jobPostId=21793',
  )
  assert.equal(akerSolutionsIndia.SUCCESSFACTORS_HOST, 'https://career2.successfactors.eu')
  assert.equal(akerSolutionsIndia.SUCCESSFACTORS_COMPANY_TOKEN, 'akersoluti')
  assert.equal(akerSolutionsIndia.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(
    akerSolutionsIndia.extractJobSearchUrl(careersLandingHtml),
    'https://www.akersolutions.com/careers/job-search/',
  )
  assert.equal(akerSolutionsIndia.hasOfficialJobSearchSignal(listingHtml), true)

  const payload = akerSolutionsIndia.extractJobListPayload(listingHtml)
  assert.equal(payload.jobs.length, 2)
  assert.equal(payload.loadMoreJobsText, 'Load more')
  assert.equal(payload.vacancyCount, 38)
  assert.deepEqual(payload.filters.map((filter) => filter.label), [
    'Country',
    'Location',
    'Position type',
  ])

  const listings = akerSolutionsIndia.extractListingJobs(listingHtml)
  assert.deepEqual(listings, [
    {
      title: 'Lead Engineer - Process Safety',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      region: 'Asia Pacific',
      jobId: '21793',
      requisitionId: '21793',
      sourceUrl: 'https://www.akersolutions.com/careers/job-search?jobPostId=21793',
      applyUrl: null,
      employmentType: 'Permanent',
      postingDate: null,
      closingDate: 'July 31, 2026',
      department: null,
      jobDescription: null,
    },
  ])

  assert.equal(akerSolutionsIndia.hasOfficialJobDetailSignal(detailHtml, '21793'), true)
  assert.equal(
    akerSolutionsIndia.extractApplyUrl(detailHtml),
    'https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=21793&company=akersoluti',
  )
  assert.deepEqual(akerSolutionsIndia.extractJobDetail(detailHtml, listings[0]), {
    title: 'Lead Engineer - Process Safety',
    company: 'Aker Solutions India',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '21793',
    requisitionId: '21793',
    sourceUrl: 'https://www.akersolutions.com/careers/job-search?jobPostId=21793',
    applyUrl: 'https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=21793&company=akersoluti',
    employmentType: 'Permanent',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: 'July 31, 2026',
    jobDescription: [
      'What will you be doing?',
      'Lead process safety for offshore and onshore projects.',
      'Drive HAZOP reviews',
      'Support cross-functional teams',
      'We think you should have:',
      'Bachelor or Master of Engineering and 10 to 15 years of experience.',
      'What we offer:',
      'Rewarding career opportunities.',
      'Apply Now!',
      'Careers.India@akersolutions.com',
      'Background checks are conducted on all final candidates.',
      'Diversity and Inclusion',
      'We foster an environment where everyone can thrive.',
      'This is Aker Solutions',
      'Aker Solutions employs approximately 11,800 people in 13 countries.',
    ].join(' '),
  })
})

test('run validates the verified first-party careers surface, keeps only India jobs, and decorates runner fields', async () => {
  const akerSolutionsIndia = await loadModule()
  const requestedUrls = []

  const jobs = await akerSolutionsIndia.createAkerSolutionsIndiaScraper({ maxJobs: 5 }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === akerSolutionsIndia.CAREERS_HOME_URL) return careersLandingHtml
      if (url === akerSolutionsIndia.JOB_SEARCH_URL) return listingHtml
      if (url === akerSolutionsIndia.VERIFIED_INDIA_JOB_URL) return detailHtml

      throw new Error(`Unexpected Aker Solutions India fixture URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    akerSolutionsIndia.CAREERS_HOME_URL,
    akerSolutionsIndia.JOB_SEARCH_URL,
    akerSolutionsIndia.VERIFIED_INDIA_JOB_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'akersolutionsindia')
  assert.equal(jobs[0].company, 'Aker Solutions India')
  assert.equal(
    jobs[0].link,
    'https://career2.successfactors.eu/sfcareer/jobreqcareer?jobId=21793&company=akersoluti',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Aker Solutions India scraper fails closed when the careers landing, job-search payload, or detail apply handoff drifts', async () => {
  const akerSolutionsIndia = await loadModule()

  await assert.rejects(
    akerSolutionsIndia.createAkerSolutionsIndiaScraper().run({
      fetchText: async (url) => {
        if (url === akerSolutionsIndia.CAREERS_HOME_URL) {
          return careersLandingHtml.replace('/careers/job-search/', '/careers/open-roles/')
        }

        throw new Error(`Unexpected Aker Solutions India fixture URL: ${url}`)
      },
    }),
    /verified careers landing/i,
  )

  await assert.rejects(
    akerSolutionsIndia.createAkerSolutionsIndiaScraper().run({
      fetchText: async (url) => {
        if (url === akerSolutionsIndia.CAREERS_HOME_URL) return careersLandingHtml
        if (url === akerSolutionsIndia.JOB_SEARCH_URL) {
          return listingHtml.replace('"loadMoreJobsText":"Load more"', '"loadMoreJobsText":""')
        }

        throw new Error(`Unexpected Aker Solutions India fixture URL: ${url}`)
      },
    }),
    /verified public job-search surface/i,
  )

  await assert.rejects(
    akerSolutionsIndia.createAkerSolutionsIndiaScraper().run({
      fetchText: async (url) => {
        if (url === akerSolutionsIndia.CAREERS_HOME_URL) return careersLandingHtml
        if (url === akerSolutionsIndia.JOB_SEARCH_URL) return listingHtml
        if (url === akerSolutionsIndia.VERIFIED_INDIA_JOB_URL) {
          return detailHtml.replace('career2.successfactors.eu', 'jobs.example.com')
        }

        throw new Error(`Unexpected Aker Solutions India fixture URL: ${url}`)
      },
    }),
    /verified detail apply handoff/i,
  )
})
