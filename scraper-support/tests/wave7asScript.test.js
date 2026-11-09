import assert from 'node:assert/strict'
import test from 'node:test'

const techtreeCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | TechTree IT System Pvt Ltd</title>
  </head>
  <body>
    <h1 class="et_pb_module_header">CAREERS</h1>
    <div class="awsm-job-wrap">
      <div class="awsm-filter-wrap">
        <label>All Job Category</label>
        <label>All Job Type</label>
        <label>All Mumbai</label>
      </div>
      <div class="awsm-job-listings awsm-lists" data-listings="29">
        <div class="awsm-job-listing-item awsm-list-item" id="awsm-list-item-12193">
          <div class="awsm-job-item">
            <div class="awsm-list-left-col">
              <h2 class="awsm-job-post-title">
                <a href="https://www.techtreeit.com/jobs/ui-developer/">UI Developer</a>
              </h2>
            </div>
            <div class="awsm-list-right-col">
              <div class="awsm-job-specification-wrapper">
                <div class="awsm-job-specification-item awsm-job-specification-job-category">
                  <span class="awsm-job-specification-term">UI Developer</span>
                </div>
                <div class="awsm-job-specification-item awsm-job-specification-job-type">
                  <span class="awsm-job-specification-term">Full Time</span>
                </div>
                <div class="awsm-job-specification-item awsm-job-specification-job-location">
                  <span class="awsm-job-specification-term">Belagavi</span>
                  <span class="awsm-job-specification-term">Mumbai</span>
                </div>
              </div>
              <div class="awsm-job-more-container">
                <a class="awsm-job-more" href="https://www.techtreeit.com/jobs/ui-developer/">More Details</a>
              </div>
            </div>
          </div>
        </div>
        <div class="awsm-job-listing-item awsm-list-item" id="awsm-list-item-12190">
          <div class="awsm-job-item">
            <div class="awsm-list-left-col">
              <h2 class="awsm-job-post-title">
                <a href="https://www.techtreeit.com/jobs/associate-qa-engineer/">Associate QA Engineer</a>
              </h2>
            </div>
            <div class="awsm-list-right-col">
              <div class="awsm-job-specification-wrapper">
                <div class="awsm-job-specification-item awsm-job-specification-job-category">
                  <span class="awsm-job-specification-term">Associate QA Engineer</span>
                </div>
                <div class="awsm-job-specification-item awsm-job-specification-job-type">
                  <span class="awsm-job-specification-term">Full Time</span>
                </div>
                <div class="awsm-job-specification-item awsm-job-specification-job-location">
                  <span class="awsm-job-specification-term">Belagavi</span>
                  <span class="awsm-job-specification-term">Bengaluru</span>
                </div>
              </div>
              <div class="awsm-job-more-container">
                <a class="awsm-job-more" href="https://www.techtreeit.com/jobs/associate-qa-engineer/">More Details</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const rocketCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Rocket Software</title>
  </head>
  <body>
    <h1>Careers at Rocket Software</h1>
    <a href="https://rocket.wd5.myworkdayjobs.com/rocket_careers">View current openings</a>
    <p>One Rocket Software.</p>
  </body>
</html>
`

const techtreeDetailJson = {
  'https://www.techtreeit.com/wp-json/wp/v2/awsm_job_openings/12193': {
    id: 12193,
    status: 'publish', type: 'awsm_job_openings',
    date_gmt: '2024-08-28T06:04:25',
    link: 'https://www.techtreeit.com/jobs/ui-developer/',
    title: { rendered: 'UI Developer' },
    content: {
      rendered: `
        <p>Experience 1 to 3 years</p>
        <p><strong>Responsibilities</strong></p>
        <ul>
          <li>Develop new frontend features and components.</li>
          <li>Collaborate with team members and stakeholders.</li>
        </ul>
      `,
    },
  },
  'https://www.techtreeit.com/wp-json/wp/v2/awsm_job_openings/12190': {
    id: 12190,
    status: 'publish', type: 'awsm_job_openings',
    date_gmt: '2024-08-27T06:00:00',
    link: 'https://www.techtreeit.com/jobs/associate-qa-engineer/',
    title: { rendered: 'Associate QA Engineer' },
    content: {
      rendered: `
        <p>Experience Required: 0 to 2 years</p>
        <p><strong>Requirements</strong></p>
        <ul>
          <li>Strong attention to detail and test case design.</li>
          <li>Good communication and stakeholder management.</li>
        </ul>
      `,
    },
  },
}

const rocketWorkdayJobs = [
  {
    title: 'Software Engineer III',
    company: 'Rocket Software',
    location: 'Pune, India',
    city: 'Pune',
    link: 'https://rocket.wd5.myworkdayjobs.com/rocket_careers/job/Pune-India/Software-Engineer-III_R2026-6454',
    source: 'rocketsoftware',
    jobId: 'R2026-6454',
    requisitionId: 'R2026-6454',
    scrapedAt: '2026-08-04T00:00:00.000Z',
  },
]

const hirexaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Hirexa</title>
  </head>
  <body>
    <h2>Search Job</h2>
    <span>[ Open positions</span>
    <span>Open positions</span>
    <div class="marquee-item"><h4 class="title">NetCraft</h4></div>
    <div class="marquee-item"><h4 class="title">NetCraft</h4></div>
    <div class="marquee-item"><h4 class="title">NetCraft</h4></div>
    <div class="marquee-item"><h4 class="title">NetCraft</h4></div>
    <h4 class="title">Apply new</h4>
    <a href="https://hirexa.com/europe-jobs">Europe Jobs</a>
    <a href="/usa-jobs">USA Jobs</a>
    <a href="https://hirexa.com/india-jobs/">India Jobs</a>
    <h4>Apply new</h4>
    <p>Your name</p>
    <p>Your email</p>
  </body>
</html>
`

const northcorpCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Northcorp Software</title>
  </head>
  <body>
    <div style="font-weight: 500;">below are some open positions with us.</div>
    <table>
      <tbody>
        <tr class="odd views-row-first">
          <td class="views-field views-field-field-kenexa-jobs-designation">
            <a href="#">Creative & Technical Content Writer</a>
          </td>
          <td class="views-field views-field-field-kenxa-jobs-updated-date">Aug 11, 2020</td>
          <td class="views-field views-field-field-kenexa-jobs-location">Gurgaon</td>
          <td class="views-field views-field-field-kenexa-experience-range">2-3 Years</td>
        </tr>
        <tr class="odd views-row-last">
          <td class="views-field views-field-field-kenexa-jobs-designation">
            <a href="#">Sr. UI / FRONTEND DEVELOPER</a>
          </td>
          <td class="views-field views-field-field-kenxa-jobs-updated-date">29-05-2020</td>
          <td class="views-field views-field-field-kenexa-jobs-location">Gurgaon</td>
          <td class="views-field views-field-field-kenexa-experience-range">3+ Years</td>
        </tr>
      </tbody>
    </table>
    <div class="accordion container" id="accordionExample">
      <div class="card">
        <div class="card-header" id="headingOne">
          <button class="btn btn-link" type="button">Creative & Technical Content Writer</button>
        </div>
        <div id="collapseOne" class="collapse show">
          <div class="card-body">
            <div class="Disclaimer">
              <h1>Disclaimer</h1>
              <p>We are looking for a Creative Writer with a keen eye for detail and the ability to thrive under pressure.</p>
              <h1>Responsibilities</h1>
              <ul class="uledit">
                <li>Create Business presentations (PPT) and documents basis the requirement.</li>
                <li>Conducting research before and during the writing process.</li>
              </ul>
              <h1>Requirements</h1>
              <ul class="uledit">
                <li>Excellent Microsoft Office skills.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
      <div class="card mbt-50">
        <div class="card-header" id="headingTwo">
          <button class="btn btn-link collapsed" type="button">Sr. UI / FRONTEND DEVELOPER</button>
        </div>
        <div id="collapseTwo" class="collapse">
          <div class="card-body">
            <div class="Disclaimer">
              <h1>Required Education and Experience:</h1>
              <ul class="uledit">
                <li>Any Bachelor Degree.</li>
                <li>3+ years of relevant experience in developing enterprise level software.</li>
                <li>Should have good development experience in REACT, Material UI/Elastic UI.</li>
              </ul>
              <h1>Good to Have:</h1>
              <ul class="uledit">
                <li>Knowledge and Experience in Angular.</li>
              </ul>
              <h1>Desired Qualities:</h1>
              <ul class="uledit">
                <li>Experience to perform Unit Testing and Integration Testing.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
    <h2 class="section-title text-center">Apply online for the position</h2>
  </body>
</html>
`

const maxgenCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Maxgen Technologies Pvt Ltd</title>
  </head>
  <body>
    <h2>Open Job Positions at Maxgen</h2>
    <button>FRESHERS</button>
    <button>EXPERIENCED</button>
    <div class="text-center text-sm text-muted py-10">No jobs available.</div>
  </body>
</html>
`

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

test('Techtree It Systems extracts the verified first-party wp-job-openings cards', async () => {
  const techtree = await loadModule('../../scraper/techtreeitsystems/script.js')

  assert.equal(techtree.hasOfficialCareersSignal(techtreeCareersHtml), true)
  assert.equal(
    techtree.isVerifiedCareersPage({
      status: 200,
      url: techtree.CAREERS_URL,
      html: techtreeCareersHtml,
    }),
    true,
  )
  assert.deepEqual(techtree.extractJobCards(techtreeCareersHtml), [
    {
      title: 'UI Developer',
      employmentType: 'Full Time',
      locations: ['Belagavi', 'Mumbai'],
      location: 'Belagavi / Mumbai',
      city: 'Belagavi',
      sourceUrl: 'https://www.techtreeit.com/jobs/ui-developer/',
      applyUrl: 'https://www.techtreeit.com/jobs/ui-developer/',
      postId: '12193',
    },
    {
      title: 'Associate QA Engineer',
      employmentType: 'Full Time',
      locations: ['Belagavi', 'Bengaluru'],
      location: 'Belagavi / Bengaluru',
      city: 'Belagavi',
      sourceUrl: 'https://www.techtreeit.com/jobs/associate-qa-engineer/',
      applyUrl: 'https://www.techtreeit.com/jobs/associate-qa-engineer/',
      postId: '12190',
    },
  ])

  const jobs = await techtree.createTechtreeItSystemsScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      assert.equal(url, techtree.CAREERS_URL)
      return {
        status: 200,
        url,
        // Synthetic country-qualified labels exercise the explicit-country path.
        html: techtreeCareersHtml.replace(/(awsm-job-specification-term">)(Belagavi|Mumbai|Bengaluru)(<\/span>)/g, '$1$2, India$3'),
      }
    },
    fetchJson: async (url) => {
      const payload = techtreeDetailJson[url]
      assert.ok(payload, `Unexpected TechTree detail JSON URL: ${url}`)
      return payload
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      employmentType: job.employmentType,
      sourceUrl: job.sourceUrl,
      experienceRequired: job.experienceRequired,
      publicExperienceChecked: job.publicExperienceChecked,
    })),
    [
      {
        title: 'UI Developer',
        location: 'Belagavi, India / Mumbai, India',
        employmentType: 'Full Time',
        sourceUrl: 'https://www.techtreeit.com/jobs/ui-developer/',
        experienceRequired: '1-3 years',
        publicExperienceChecked: true,
      },
      {
        title: 'Associate QA Engineer',
        location: 'Belagavi, India / Bengaluru, India',
        employmentType: 'Full Time',
        sourceUrl: 'https://www.techtreeit.com/jobs/associate-qa-engineer/',
        experienceRequired: '0-2 years',
        publicExperienceChecked: true,
      },
    ],
  )
  assert.match(jobs[0].jobDescription || '', /frontend features/i)
  assert.match(jobs[1].jobDescription || '', /test case design|attention to detail/i)
})

test('Rocket Software uses the verified careers page over direct HTTP and delegates to the live Workday board', async () => {
  const rocket = await loadModule('../../scraper/rocketsoftware/script.js')
  const requestedUrls = []

  assert.equal(rocket.hasOfficialCareersSignal(rocketCareersHtml), true)

  const jobs = await rocket.createRocketSoftwareScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, rocket.CAREERS_URL)
      return rocketCareersHtml
    },
    runWorkday: async (options) => {
      assert.equal(options.company, 'Rocket Software')
      assert.equal(options.baseUrl, rocket.WORKDAY_BOARD_URL)
      assert.equal(options.locationCountry, 'India')
      assert.equal(options.source, 'rocketsoftware')
      return rocketWorkdayJobs
    },
  })

  assert.deepEqual(requestedUrls, [rocket.CAREERS_URL])
  assert.deepEqual(jobs, [
    {
      ...rocketWorkdayJobs[0],
      company: 'Rocket Software',
      source: 'rocketsoftware',
      sourceUrl: 'https://rocket.wd5.myworkdayjobs.com/rocket_careers/job/Pune-India/Software-Engineer-III_R2026-6454',
      applyUrl: 'https://rocket.wd5.myworkdayjobs.com/rocket_careers/job/Pune-India/Software-Engineer-III_R2026-6454',
    },
  ])
})

test('Rocket Software stops on a denied corporate handoff before any native request', async () => {
  const rocket = await loadModule('../../scraper/rocketsoftware/script.js')
  const requestedUrls = []
  let nativeCalls = 0
  await assert.rejects(rocket.run({
    fetchText: async url => { requestedUrls.push(url); throw new Error('HTTP 403 current careers denied') },
    runWorkday: async () => { nativeCalls++; return rocketWorkdayJobs },
  }), /HTTP 403/)
  assert.deepEqual(requestedUrls, [rocket.CAREERS_URL])
  assert.equal(nativeCalls, 0)
})

test('Rocket Software fails closed when the verified careers page drifts', async () => {
  const rocket = await loadModule('../../scraper/rocketsoftware/script.js')

  await assert.rejects(
    rocket.createRocketSoftwareScraper().run({
      fetchText: async () => '<html><title>Unexpected</title></html>',
      runWorkday: async () => {
        throw new Error('runWorkday should not be called when the careers page drifts')
      },
    }),
    /current corporate recruitment handoff is unavailable/i,
  )
})

test('HIREXA SOLUTIONS stays fail-closed while the first-party page only exposes placeholder NetCraft cards', async () => {
  const hirexa = await loadModule('../../scraper/hirexasolutions/script.js')

  assert.equal(hirexa.hasOfficialCareersSignal(hirexaCareersHtml), true)
  assert.equal(hirexa.hasPublicJobsSignal(hirexaCareersHtml), false)
  assert.deepEqual(hirexa.extractPlaceholderTitles(hirexaCareersHtml), [
    'NetCraft',
    'NetCraft',
    'NetCraft',
    'NetCraft',
  ])

  const jobs = await hirexa.createHirexaSolutionsScraper().run({
    fetchText: async (url) => {
      assert.equal(url, hirexa.CAREERS_URL)
      return hirexaCareersHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    hirexa.createHirexaSolutionsScraper().run({
      fetchText: async () => `
        ${hirexaCareersHtml}
        <div class="marquee-item"><h4 class="title">Data Engineer</h4></div>
      `,
    }),
    /public jobs surface/i,
  )
})

test('Northcorp Software extracts the verified inline table rows and accordion details', async () => {
  const northcorp = await loadModule('../../scraper/northcorpsoftware/script.js')

  assert.equal(northcorp.hasOfficialCareersSignal(northcorpCareersHtml), true)
  assert.deepEqual(northcorp.extractJobSummaries(northcorpCareersHtml), [
    {
      title: 'Creative & Technical Content Writer',
      location: 'Gurgaon',
      experience: '2-3 Years',
      postedOn: 'Aug 11, 2020',
    },
    {
      title: 'Sr. UI / FRONTEND DEVELOPER',
      location: 'Gurgaon',
      experience: '3+ Years',
      postedOn: '29-05-2020',
    },
  ])

  const jobs = await northcorp.createNorthcorpSoftwareScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, northcorp.CAREERS_URL)
      return northcorpCareersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.experienceRequired]),
    [
      ['Creative & Technical Content Writer', 'Gurgaon, India', '2-3 Years'],
      ['Sr. UI / FRONTEND DEVELOPER', 'Gurgaon, India', '3+ Years'],
    ],
  )
  assert.match(jobs[0].jobDescription, /Creative Writer/i)
  assert.match(jobs[1].jobDescription, /REACT/i)
})

test('Maxgen Technologies stays fail-closed while the verified careers page still says no jobs available', async () => {
  const maxgen = await loadModule('../../scraper/maxgentechnologies/script.js')

  assert.equal(maxgen.hasOfficialCareersSignal(maxgenCareersHtml), true)
  assert.equal(maxgen.hasPublicJobsSignal(maxgenCareersHtml), false)

  const jobs = await maxgen.createMaxgenTechnologiesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, maxgen.CAREERS_URL)
      return maxgenCareersHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    maxgen.createMaxgenTechnologiesScraper().run({
      fetchText: async () => `
        <html><body>
          <h2>Open Job Positions at Maxgen</h2>
          <a href="https://www.maxgentechnologies.com/career/python-developer-with-0-1-year-of-experience">Python Developer with 0-1 year of experience</a>
        </body></html>
      `,
    }),
    /no-jobs careers shell/i,
  )
})
