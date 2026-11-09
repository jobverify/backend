import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers and internships - Motherson Group</title>
  </head>
  <body>
    <main>
      <h3>Our Global Family at Motherson</h3>
      <a href="https://careers.motherson.com/en">More about life at Motherson</a>
      <a href="https://careers.motherson.com/en">Your career opportunities</a>
    </main>
    <footer>Copyright Motherson. All rights reserved.</footer>
  </body>
</html>
`

const jobsBoardData = {
  props: {
    pageProps: {
      allJobs: [
        {
          id: 'dM7p8Gg0SPGUtG1ZwfZFwQ',
          slug: 'assistant-manager-paintshop-5510',
          title: 'Assistant Manager Paintshop',
          searchTerms: 'Assistant Manager Paintshop Chennai India Manufacturing/Operations Experienced',
          location: {
            name: 'Chennai',
            country: {
              name: 'India',
            },
          },
          businessDivision: null,
          company: null,
          functionalAreas: [],
          careerLevel: {
            name: 'Experienced',
          },
        },
        {
          id: 'us-maintenance-tech',
          slug: 'maintenance-technician-usa',
          title: 'Maintenance Technician',
          searchTerms: 'Maintenance Technician Sterling Heights USA Facility Management / Maintenance Entry level',
          location: {
            name: 'Sterling Heights',
            country: {
              name: 'USA',
            },
          },
          businessDivision: null,
          company: null,
          functionalAreas: [],
          careerLevel: {
            name: 'Entry level',
          },
        },
      ],
    },
  },
}

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Motherson Careers</title>
  </head>
  <body>
    <main>
      <h1>All jobs</h1>
      <h2>Job portal</h2>
      <p>Wecome to our careers platform</p>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(jobsBoardData)}</script>
  </body>
</html>
`

const jobsBoardHtmlWithTextDrift = `
<!doctype html>
<html lang="en">
  <head>
    <title data-next-head="">Jobs - Motherson Careers</title>
  </head>
  <body>
    <main>
      <h1>All jobs</h1>
      <h2>Job portal</h2>
      <p>Welcome to our careers platform</p>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          jobsListing: {
            allJobs: jobsBoardData.props.pageProps.allJobs,
          },
        },
      },
    })}</script>
  </body>
</html>
`

const jobsBoardHtmlWithStaleIndiaDetail = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs - Motherson Careers</title>
  </head>
  <body>
    <main>
      <h1>All jobs</h1>
      <h2>Job portal</h2>
      <p>Wecome to our careers platform</p>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          allJobs: [
            ...jobsBoardData.props.pageProps.allJobs,
            {
              id: 'stale-india-detail',
              slug: 'senior-engineer-ped-5875',
              title: 'Senior Engineer PED',
              searchTerms: 'Senior Engineer PED Chennai India Engineering Experienced',
              location: {
                name: 'Chennai',
                country: {
                  name: 'India',
                },
              },
              businessDivision: null,
              company: null,
              functionalAreas: [],
              careerLevel: {
                name: 'Experienced',
              },
            },
          ],
        },
      },
    })}</script>
  </body>
</html>
`

const detailPageData = {
  props: {
    pageProps: {
      job: {
        id: 'dM7p8Gg0SPGUtG1ZwfZFwQ',
        slug: 'assistant-manager-paintshop-5510',
        title: 'Assistant Manager Paintshop',
        introduction:
          '<p>This position replacement for Mr. Abdul Wahid Ansari A L- Assistant manager (Paint Shop Production)</p>',
        tasks:
          '<ol><li>Develop, program, and fine-tune robotic painting processes (ABB, Fanuc, Durr systems).</li><li>Troubleshoot robot paths, spray parameters, and sequencing issues.</li></ol>',
        profile:
          '<ol><li>BE/B.Tech &amp; Diploma in Paint Technology, Mechanical, Chemical, or relevant field.</li></ol>',
        whatWeOffer:
          '<ol><li>The team is growing at the same time our Group grows.</li></ol>',
        applyUrl:
          'https://career55.sapsf.eu/career?company=smrautomot&career_ns=job_application&career_job_req_id=5510',
        location: {
          name: 'Chennai',
          country: {
            name: 'India',
          },
        },
        businessDivision: null,
        company: null,
        functionalAreas: [],
        careerLevel: {
          name: 'Experienced',
        },
      },
    },
  },
}

const detailPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Assistant Manager Paintshop - Motherson Careers</title>
  </head>
  <body>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify(detailPageData)}</script>
  </body>
</html>
`

const loadMothersonSumiModule = async () => {
  try {
    return await import('../../scraper/mothersonsumi/script.js')
  } catch {
    assert.fail('Expected Motherson Sumi scraper module at ../../scraper/mothersonsumi/script.js')
  }
}

test('Motherson Sumi helpers stay pinned to the verified first-party careers landing and jobs board data shape', async () => {
  const motherson = await loadMothersonSumiModule()

  assert.equal(motherson.SOURCE, 'mothersonsumi')
  assert.equal(motherson.COMPANY_NAME, 'Motherson Sumi')
  assert.equal(motherson.OFFICIAL_BRAND_NAME, 'Motherson')
  assert.equal(
    motherson.CAREERS_LANDING_URL,
    'https://www.motherson.com/people/careers-and-internships',
  )
  assert.equal(
    motherson.JOBS_BOARD_URL,
    'https://careers.motherson.com/en/jobs?country=India',
  )
  assert.equal(
    motherson.buildDetailUrl('assistant-manager-paintshop-5510'),
    'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
  )
  assert.equal(motherson.hasOfficialCareersLandingSignal(officialCareersLandingHtml), true)
  assert.equal(motherson.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.deepEqual(motherson.extractIndiaJobListings(jobsBoardHtml), [
    {
      title: 'Assistant Manager Paintshop',
      company: 'Motherson Sumi',
      department: 'Manufacturing/Operations',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'dM7p8Gg0SPGUtG1ZwfZFwQ',
      requisitionId: '5510',
      sourceUrl: 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
      applyUrl: 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Motherson Sumi detail extraction preserves the public detail URL and successfactors apply handoff', async () => {
  const motherson = await loadMothersonSumiModule()
  const listing = motherson.extractIndiaJobListings(jobsBoardHtml)[0]
  const detail = motherson.extractJobDetail(detailPageHtml, listing)

  assert.deepEqual(detail, {
    title: 'Assistant Manager Paintshop',
    company: 'Motherson Sumi',
    department: 'Manufacturing/Operations',
    location: 'Chennai, India',
    city: 'Chennai',
    country: 'India',
    jobId: 'dM7p8Gg0SPGUtG1ZwfZFwQ',
    requisitionId: '5510',
    sourceUrl: 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
    applyUrl: 'https://career55.sapsf.eu/career?company=smrautomot&career_ns=job_application&career_job_req_id=5510',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Introduction: This position replacement for Mr. Abdul Wahid Ansari A L- Assistant manager (Paint Shop Production)\n\nTasks: Develop, program, and fine-tune robotic painting processes (ABB, Fanuc, Durr systems). Troubleshoot robot paths, spray parameters, and sequencing issues.\n\nProfile: BE/B.Tech & Diploma in Paint Technology, Mechanical, Chemical, or relevant field.\n\nWhat we offer: The team is growing at the same time our Group grows.',
  })
})

test('Motherson Sumi jobs board signal tolerates harmless title punctuation and welcome-copy drift', async () => {
  const motherson = await loadMothersonSumiModule()

  assert.equal(motherson.hasOfficialJobsBoardSignal(jobsBoardHtmlWithTextDrift), true)
  assert.equal(motherson.extractIndiaJobListings(jobsBoardHtmlWithTextDrift).length, 1)
})

test('Motherson Sumi run follows the verified careers handoff, board page, and India detail pages only', async () => {
  const motherson = await loadMothersonSumiModule()
  const requestedUrls = []

  const jobs = await motherson.createMothersonSumiScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === motherson.CAREERS_LANDING_URL) return officialCareersLandingHtml
      if (url === motherson.JOBS_BOARD_URL) return jobsBoardHtml
      if (url === 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510') {
        return detailPageHtml
      }

      throw new Error(`Unexpected Motherson Sumi URL: ${url}`)
    },
    now: () => '2026-07-16T00:00:00.000Z',
  }).run()

  assert.deepEqual(requestedUrls, [
    motherson.CAREERS_LANDING_URL,
    motherson.JOBS_BOARD_URL,
    'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Assistant Manager Paintshop',
      company: 'Motherson Sumi',
      department: 'Manufacturing/Operations',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'dM7p8Gg0SPGUtG1ZwfZFwQ',
      requisitionId: '5510',
      sourceUrl: 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
      applyUrl: 'https://career55.sapsf.eu/career?company=smrautomot&career_ns=job_application&career_job_req_id=5510',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Introduction: This position replacement for Mr. Abdul Wahid Ansari A L- Assistant manager (Paint Shop Production)\n\nTasks: Develop, program, and fine-tune robotic painting processes (ABB, Fanuc, Durr systems). Troubleshoot robot paths, spray parameters, and sequencing issues.\n\nProfile: BE/B.Tech & Diploma in Paint Technology, Mechanical, Chemical, or relevant field.\n\nWhat we offer: The team is growing at the same time our Group grows.',
      source: 'mothersonsumi',
      link: 'https://career55.sapsf.eu/career?company=smrautomot&career_ns=job_application&career_job_req_id=5510',
      scrapedAt: '2026-07-16T00:00:00.000Z',
    },
  ])
})

test('Motherson Sumi skips stale India listings whose public detail pages now return 404 while keeping healthy jobs', async () => {
  const motherson = await loadMothersonSumiModule()
  const requestedUrls = []

  const jobs = await motherson.createMothersonSumiScraper({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === motherson.CAREERS_LANDING_URL) return officialCareersLandingHtml
      if (url === motherson.JOBS_BOARD_URL) return jobsBoardHtmlWithStaleIndiaDetail
      if (url === 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510') {
        return detailPageHtml
      }
      if (url === 'https://careers.motherson.com/en/job/senior-engineer-ped-5875') {
        const error = new Error(`HTTP 404 for ${url}`)
        error.status = 404
        throw error
      }

      throw new Error(`Unexpected Motherson Sumi URL: ${url}`)
    },
    now: () => '2026-08-20T00:00:00.000Z',
  }).run()

  assert.deepEqual(requestedUrls, [
    motherson.CAREERS_LANDING_URL,
    motherson.JOBS_BOARD_URL,
    'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
    'https://careers.motherson.com/en/job/senior-engineer-ped-5875',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Assistant Manager Paintshop',
      company: 'Motherson Sumi',
      department: 'Manufacturing/Operations',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'dM7p8Gg0SPGUtG1ZwfZFwQ',
      requisitionId: '5510',
      sourceUrl: 'https://careers.motherson.com/en/job/assistant-manager-paintshop-5510',
      applyUrl: 'https://career55.sapsf.eu/career?company=smrautomot&career_ns=job_application&career_job_req_id=5510',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Introduction: This position replacement for Mr. Abdul Wahid Ansari A L- Assistant manager (Paint Shop Production)\n\nTasks: Develop, program, and fine-tune robotic painting processes (ABB, Fanuc, Durr systems). Troubleshoot robot paths, spray parameters, and sequencing issues.\n\nProfile: BE/B.Tech & Diploma in Paint Technology, Mechanical, Chemical, or relevant field.\n\nWhat we offer: The team is growing at the same time our Group grows.',
      source: 'mothersonsumi',
      link: 'https://career55.sapsf.eu/career?company=smrautomot&career_ns=job_application&career_job_req_id=5510',
      scrapedAt: '2026-08-20T00:00:00.000Z',
    },
  ])
})

test('Motherson Sumi fails closed when the verified careers landing or board page changes materially', async () => {
  const motherson = await loadMothersonSumiModule()

  await assert.rejects(
    motherson.createMothersonSumiScraper({
      fetchText: async (url) => {
        if (url === motherson.CAREERS_LANDING_URL) {
          return '<html><body><h1>Motherson careers changed</h1></body></html>'
        }

        throw new Error(`Unexpected Motherson Sumi URL: ${url}`)
      },
    }).run(),
    /verified official careers page/i,
  )

  await assert.rejects(
    motherson.createMothersonSumiScraper({
      fetchText: async (url) => {
        if (url === motherson.CAREERS_LANDING_URL) return officialCareersLandingHtml
        if (url === motherson.JOBS_BOARD_URL) {
          return '<html><body><h1>Board changed</h1></body></html>'
        }

        throw new Error(`Unexpected Motherson Sumi URL: ${url}`)
      },
    }).run(),
    /verified public jobs board/i,
  )
})
