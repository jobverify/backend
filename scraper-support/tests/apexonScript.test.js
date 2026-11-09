import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Apexon - Enterprise AI, Data &amp; Digital Engineering Solutions</title>
  </head>
  <body>
    <nav>
      <a href="/about/who-we-are/">Who We Are</a>
      <a href="/about/careers/">Careers</a>
      <a href="/contact-us/">Contact Us</a>
    </nav>
    <main>
      <h1>Peak Ingenuity</h1>
      <p>Enterprise AI, data and digital engineering solutions.</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Apexon Careers &amp; Work Culture and Values - Apexon</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Peak Ingenuity</p>
      <p>
        To see our latest openings,
        <a href="/explore-jobs/">click here to view</a>
      </p>
      <a href="/explore-jobs/">click here to view</a>
    </main>
  </body>
</html>
`

const exploreJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Search, Job Opportunities &amp; Openings in India - Apexon</title>
  </head>
  <body>
    <main>
      <h1>Explore Jobs</h1>
      <div class="joinLocationsearch">
        <div class="LocationsearchTable">
          <div class="table">
            <div class="theader">
              <div class="table_header JobTitlehead">Job Title</div>
              <div class="table_header OpenJobPositions">Openings</div>
              <div class="table_header JobLocationhead">Location</div>
            </div>

            <div class="table_row">
              <div class="table_small jobTitle">
                <div class="table_cell">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6500" title="Architect - Data Engineering">Architect - Data Engineering</a>
                </div>
              </div>
              <div class="table_small openPosiTitle">
                <div class="table_cell">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6500" title="Architect - Data Engineering">1</a>
                </div>
              </div>
              <div class="table_small locationTitle">
                <div class="table_cell">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6500" title="Architect - Data Engineering">Hyderabad, India</a>
                </div>
              </div>
              <div class="table_small">
                <div class="table_cell JobClickbtn text-center">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6500" title="Architect - Data Engineering">
                    <span class="findMorelink">Find out more</span>
                  </a>
                </div>
              </div>
            </div>

            <div class="table_row">
              <div class="table_small jobTitle">
                <div class="table_cell">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6609" title="SRE (Python)">SRE (Python)</a>
                </div>
              </div>
              <div class="table_small openPosiTitle">
                <div class="table_cell">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6609" title="SRE (Python)">3</a>
                </div>
              </div>
              <div class="table_small locationTitle">
                <div class="table_cell">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6609" title="SRE (Python)">Bengaluru, India</a>
                </div>
              </div>
              <div class="table_small">
                <div class="table_cell JobClickbtn text-center">
                  <a href="https://www.apexon.com/career-job-detail/?id=0&amp;jobid=6609" title="SRE (Python)">
                    <span class="findMorelink">Find out more</span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const architectDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Job Detail &#8211; Experience, Digital Engineering and Data &amp; Analytics Solutions by Apexon</title>
  </head>
  <body>
    <main>
      <h1 class="jobtitle dtitle text-left">Architect - Data Engineering</h1>
      <div class="jobdetails">
        <p class="job-code-text"><strong>Job Reference No#: </strong>6500</p>
        <p class="open-position-text"><strong>Open Positions:</strong> 1</p>
        <div class="btn-container">
          <a class="btn btn-primary print" href="https://apexon.talentrecruit.com/career-page/apply/U2FsdGVkX1%252BajGKtji6uOZ%252F1Esz%252BQCCxuH4N8J2QhoU%253D" target="_blank">Apply</a>
        </div>
      </div>
      <div class="jobcontent">
        <p><strong>About Apexon:</strong></p>
        <p>Apexon is a digital-first technology services firm specializing in accelerating business transformation and delivering human-centric digital experiences.</p>
        <p>We are seeking an experienced Data Architect with strong expertise in Azure Data Platform and PySpark to lead the design, development, and delivery of scalable data solutions.</p>
        <p><strong>Key Responsibilities</strong></p>
        <ul>
          <li>Design and architect scalable, secure, and high-performance data platforms and data pipelines on Azure.</li>
          <li>Lead the offshore data engineering team, ensuring successful delivery of projects and adherence to best practices.</li>
        </ul>
        <p><strong>Required Skills &amp; Experience</strong></p>
        <ul>
          <li>Strong experience in Azure Data Services.</li>
          <li>Deep expertise in PySpark for large-scale data processing and transformation.</li>
        </ul>
        <p class="mb0"><strong>Job Location :</strong></p>
        <p>Hyderabad, India</p>
      </div>
      <div class="footercontactform customcareerform">
        <div class="title">Can't find what you're looking for?</div>
      </div>
    </main>
  </body>
</html>
`

const sreDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Job Detail &#8211; Experience, Digital Engineering and Data &amp; Analytics Solutions by Apexon</title>
  </head>
  <body>
    <main>
      <h1 class="jobtitle dtitle text-left">SRE (Python)</h1>
      <div class="jobdetails">
        <p class="job-code-text"><strong>Job Reference No#: </strong>6609</p>
        <p class="open-position-text"><strong>Open Positions:</strong> 3</p>
        <div class="btn-container">
          <a class="btn btn-primary print" href="https://apexon.talentrecruit.com/career-page/apply/U2FsdGVkX1%252BZ2UwALGBqNytpOd6Z7PWXFSg02HZDaco%253D" target="_blank">Apply</a>
        </div>
      </div>
      <div class="jobcontent">
        <p><strong>About Apexon:</strong></p>
        <p>Apexon is a digital-first technology services firm specializing in accelerating business transformation and delivering human-centric digital experiences.</p>
        <p>We are seeking an SRE with Python expertise to improve platform reliability and observability.</p>
        <p><strong>Key Responsibilities</strong></p>
        <ul>
          <li>Improve automation and observability across cloud services.</li>
          <li>Collaborate with engineering teams on operational excellence.</li>
        </ul>
        <p><strong>Required Skills &amp; Experience</strong></p>
        <ul>
          <li>Python scripting and Linux troubleshooting.</li>
          <li>Experience with SRE practices and monitoring platforms.</li>
        </ul>
        <p class="mb0"><strong>Job Location :</strong></p>
        <p>Bengaluru, India</p>
      </div>
      <div class="footercontactform customcareerform">
        <div class="title">Can't find what you're looking for?</div>
      </div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/apexon/script.js')
  } catch {
    assert.fail('Expected Apexon scraper module at ../../scraper/apexon/script.js')
  }
}

test('Apexon validates the verified homepage, careers handoff, explore-jobs listings, and detail pages', async () => {
  const apexon = await loadModule()

  assert.equal(apexon.SOURCE, 'apexon')
  assert.equal(apexon.COMPANY, 'Apexon')
  assert.equal(apexon.OFFICIAL_BRAND_NAME, 'Apexon')
  assert.equal(apexon.VERIFIED_AT, '2026-07-15')
  assert.equal(apexon.HOMEPAGE_URL, 'https://www.apexon.com/')
  assert.equal(apexon.CAREERS_URL, 'https://www.apexon.com/about/careers/')
  assert.equal(apexon.EXPLORE_JOBS_URL, 'https://www.apexon.com/explore-jobs/')
  assert.equal(apexon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(apexon.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(apexon.extractExploreJobsUrl(careersHtml), apexon.EXPLORE_JOBS_URL)
  assert.equal(apexon.hasOfficialExploreJobsSignal(exploreJobsHtml), true)
  assert.deepEqual(apexon.extractListingCards(exploreJobsHtml), [
    {
      title: 'Architect - Data Engineering',
      requisitionId: '6500',
      openings: '1',
      location: 'Hyderabad, India',
      sourceUrl: 'https://www.apexon.com/career-job-detail/?id=0&jobid=6500',
    },
    {
      title: 'SRE (Python)',
      requisitionId: '6609',
      openings: '3',
      location: 'Bengaluru, India',
      sourceUrl: 'https://www.apexon.com/career-job-detail/?id=0&jobid=6609',
    },
  ])
  assert.equal(apexon.hasOfficialDetailPageSignal(architectDetailHtml), true)
  assert.equal(apexon.hasOfficialDetailPageSignal(sreDetailHtml), true)
})

test('Apexon run validates the first-party careers flow and returns normalized India jobs', async () => {
  const apexon = await loadModule()
  const requestedUrls = []

  const jobs = await apexon.createApexonScraper({
    now: () => '2026-07-15T08:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === apexon.HOMEPAGE_URL) return homepageHtml
      if (url === apexon.CAREERS_URL) return careersHtml
      if (url === apexon.EXPLORE_JOBS_URL) return exploreJobsHtml
      if (url === 'https://www.apexon.com/career-job-detail/?id=0&jobid=6500') return architectDetailHtml
      if (url === 'https://www.apexon.com/career-job-detail/?id=0&jobid=6609') return sreDetailHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    apexon.HOMEPAGE_URL,
    apexon.CAREERS_URL,
    apexon.EXPLORE_JOBS_URL,
    'https://www.apexon.com/career-job-detail/?id=0&jobid=6500',
    'https://www.apexon.com/career-job-detail/?id=0&jobid=6609',
  ])
  assert.deepEqual(
    jobs.map((job) => job.title),
    ['Architect - Data Engineering', 'SRE (Python)'],
  )
  const legacyFields = ({
    nativeSourceRecord, nativeEmployerBinding, nativeHiringOrganization, nativeBoardListingComplete,
    nativeCollectionFailures, sourceDescription, sourceDetailComplete, sourceDetailUrl,
    sourceScopeComplete, sourceListingComplete, lifecycleCleanupAllowed, applicationVisited, ...job
  }) => job
  assert.ok(jobs.every(job => job.sourceDetailComplete === true && job.sourceScopeComplete === false
    && job.lifecycleCleanupAllowed === false && job.applicationVisited === false
    && job.nativeSourceRecord.detail.requisitionId === job.requisitionId
    && job.sourceDescription === job.jobDescription))
  assert.deepEqual(legacyFields(jobs[0]), {
    title: 'Architect - Data Engineering',
    company: 'Apexon',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'apexon-6500',
    requisitionId: '6500',
    sourceUrl: 'https://www.apexon.com/career-job-detail/?id=0&jobid=6500',
    applyUrl: 'https://apexon.talentrecruit.com/career-page/apply/U2FsdGVkX1%252BajGKtji6uOZ%252F1Esz%252BQCCxuH4N8J2QhoU%253D',
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Design and architect scalable, secure, and high-performance data platforms and data pipelines on Azure.',
      'Lead the offshore data engineering team, ensuring successful delivery of projects and adherence to best practices.',
      'Strong experience in Azure Data Services.',
      'Deep expertise in PySpark for large-scale data processing and transformation.',
    ],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About Apexon:',
      'Apexon is a digital-first technology services firm specializing in accelerating business transformation and delivering human-centric digital experiences.',
      'We are seeking an experienced Data Architect with strong expertise in Azure Data Platform and PySpark to lead the design, development, and delivery of scalable data solutions.',
      'Key Responsibilities',
      '- Design and architect scalable, secure, and high-performance data platforms and data pipelines on Azure.',
      '- Lead the offshore data engineering team, ensuring successful delivery of projects and adherence to best practices.',
      'Required Skills & Experience',
      '- Strong experience in Azure Data Services.',
      '- Deep expertise in PySpark for large-scale data processing and transformation.',
      'Job Location :',
      'Hyderabad, India',
    ].join('\n'),
    source: 'apexon',
    companyCareerPage: 'https://www.apexon.com/about/careers/',
    companyDomain: 'apexon.com',
    atsPlatform: 'official-company-careers',
    link: 'https://apexon.talentrecruit.com/career-page/apply/U2FsdGVkX1%252BajGKtji6uOZ%252F1Esz%252BQCCxuH4N8J2QhoU%253D',
    scrapedAt: '2026-07-15T08:30:00.000Z',
  })
  assert.deepEqual(legacyFields(jobs[1]), {
    title: 'SRE (Python)',
    company: 'Apexon',
    department: null,
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: 'apexon-6609',
    requisitionId: '6609',
    sourceUrl: 'https://www.apexon.com/career-job-detail/?id=0&jobid=6609',
    applyUrl: 'https://apexon.talentrecruit.com/career-page/apply/U2FsdGVkX1%252BZ2UwALGBqNytpOd6Z7PWXFSg02HZDaco%253D',
    employmentType: null,
    workplaceType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Improve automation and observability across cloud services.',
      'Collaborate with engineering teams on operational excellence.',
      'Python scripting and Linux troubleshooting.',
      'Experience with SRE practices and monitoring platforms.',
    ],
    compensation: null,
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About Apexon:',
      'Apexon is a digital-first technology services firm specializing in accelerating business transformation and delivering human-centric digital experiences.',
      'We are seeking an SRE with Python expertise to improve platform reliability and observability.',
      'Key Responsibilities',
      '- Improve automation and observability across cloud services.',
      '- Collaborate with engineering teams on operational excellence.',
      'Required Skills & Experience',
      '- Python scripting and Linux troubleshooting.',
      '- Experience with SRE practices and monitoring platforms.',
      'Job Location :',
      'Bengaluru, India',
    ].join('\n'),
    source: 'apexon',
    companyCareerPage: 'https://www.apexon.com/about/careers/',
    companyDomain: 'apexon.com',
    atsPlatform: 'official-company-careers',
    link: 'https://apexon.talentrecruit.com/career-page/apply/U2FsdGVkX1%252BZ2UwALGBqNytpOd6Z7PWXFSg02HZDaco%253D',
    scrapedAt: '2026-07-15T08:30:00.000Z',
  })
})

test('Apexon fails closed when the homepage, careers handoff, explore-jobs page, or detail pages drift', async () => {
  const apexon = await loadModule()

  await assert.rejects(
    apexon.createApexonScraper().run({
      fetchText: async (url) => {
        if (url === apexon.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    apexon.createApexonScraper().run({
      fetchText: async (url) => {
        if (url === apexon.HOMEPAGE_URL) return homepageHtml
        if (url === apexon.CAREERS_URL) return careersHtml.replaceAll('/explore-jobs/', '/careers-stories/')
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )

  await assert.rejects(
    apexon.createApexonScraper().run({
      fetchText: async (url) => {
        if (url === apexon.HOMEPAGE_URL) return homepageHtml
        if (url === apexon.CAREERS_URL) return careersHtml
        if (url === apexon.EXPLORE_JOBS_URL) {
          return exploreJobsHtml.replaceAll('career-job-detail/?id=0&amp;jobid=', 'external-job-board/?jobid=')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /explore-jobs page/i,
  )

  await assert.rejects(
    apexon.createApexonScraper().run({
      fetchText: async (url) => {
        if (url === apexon.HOMEPAGE_URL) return homepageHtml
        if (url === apexon.CAREERS_URL) return careersHtml
        if (url === apexon.EXPLORE_JOBS_URL) return exploreJobsHtml
        if (url === 'https://www.apexon.com/career-job-detail/?id=0&jobid=6500') {
          return '<html><body><h1>Broken detail</h1></body></html>'
        }
        if (url === 'https://www.apexon.com/career-job-detail/?id=0&jobid=6609') return sreDetailHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /detail page/i,
  )
})
