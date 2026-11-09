import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T10:30:00.000Z'

const jobsArchiveHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Archive - Inspiredge IT Solutions</title>
  </head>
  <body>
    <h1>Job Archives</h1>
    <div class="sjb-listing">
      <div class="list-data">
        <div class="v2">
          <header>
            <div class="row">
              <div class="col-md-8 col-sm-8">
                <div class="company-logo">
                  <a href="https://inspiredgeit.com/jobs/telecom-analyst-3/">
                    <img src="https://inspiredgeit.com/wp-content/uploads/logo.jpg" alt="Inspiredge IT Solutions">
                  </a>
                </div>
                <div class="sjb-with-logo">
                  <div class="job-info">
                    <h4>
                      <a href="https://inspiredgeit.com/jobs/telecom-analyst-3/">
                        <span class="job-title">Telecom Analyst</span>
                      </a>
                    </h4>
                  </div>
                </div>
              </div>
              <div class="col-md-4 col-sm-4 col-xs-12 sjb-apply-now-btn">
                <a href="https://inspiredgeit.com/jobs/telecom-analyst-3/" class="btn btn-primary">Apply Now</a>
              </div>
              <div class="col-md-12 col-sm-12">
                <div class="sjb-job-type-location-date">
                  <div class="job-type"><i class="fa fa-briefcase"></i>Technical Services</div>
                  <div class="job-location"><i class="fa fa-map-marker"></i>Remote</div>
                  <div class="job-date"><i class="fa fa-calendar-check-o"></i>Posted 2 years ago</div>
                </div>
              </div>
            </div>
          </header>
          <div class="job-description-list">
            <p>Customer-facing telecom analysis and reporting.</p>
          </div>
        </div>
      </div>
      <!-- ==================================================
      End Jobs List View -->
      <div class="list-data">
        <div class="v2">
          <header>
            <div class="row">
              <div class="col-md-8 col-sm-8">
                <div class="company-logo">
                  <a href="https://inspiredgeit.com/jobs/ai-engineer/">
                    <img src="https://inspiredgeit.com/wp-content/uploads/logo.jpg" alt="Inspiredge IT Solutions">
                  </a>
                </div>
                <div class="sjb-with-logo">
                  <div class="job-info">
                    <h4>
                      <a href="https://inspiredgeit.com/jobs/ai-engineer/">
                        <span class="job-title">AI Engineer</span>
                      </a>
                    </h4>
                  </div>
                </div>
              </div>
              <div class="col-md-4 col-sm-4 col-xs-12 sjb-apply-now-btn">
                <a href="https://inspiredgeit.com/jobs/ai-engineer/" class="btn btn-primary">Apply Now</a>
              </div>
              <div class="col-md-12 col-sm-12">
                <div class="sjb-job-type-location-date">
                  <div class="job-type"><i class="fa fa-briefcase"></i>Technical Services</div>
                  <div class="job-location"><i class="fa fa-map-marker"></i>Hyderabad, Remote</div>
                  <div class="job-date"><i class="fa fa-calendar-check-o"></i>Posted 2 years ago</div>
                </div>
              </div>
            </div>
          </header>
          <div class="job-description-list">
            <p>Build practical AI workflows for managed services.</p>
          </div>
        </div>
      </div>
      <!-- ==================================================
      End Jobs List View -->
    </div>
    <ul class="pagination">
      <li class="list-item"><span aria-current="page" class="page-numbers current">1</span></li>
      <li class="list-item"><a class="page-numbers" href="https://inspiredgeit.com/jobs/?page=2/">2</a></li>
      <li class="list-item"><a class="next page-numbers" href="https://inspiredgeit.com/jobs/?page=2/">Next</a></li>
    </ul>
  </body>
</html>
`

const jobsArchivePageTwoHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Archive - Page 2 of 2 - Inspiredge IT Solutions</title>
  </head>
  <body>
    <div class="sjb-listing">
      <div class="list-data">
        <div class="v2">
          <header>
            <div class="row">
              <div class="col-md-8 col-sm-8">
                <div class="company-logo">
                  <a href="https://inspiredgeit.com/jobs/technical-lead/">
                    <img src="https://inspiredgeit.com/wp-content/uploads/logo.jpg" alt="Inspiredge IT Solutions">
                  </a>
                </div>
                <div class="sjb-with-logo">
                  <div class="job-info">
                    <h4>
                      <a href="https://inspiredgeit.com/jobs/technical-lead/">
                        <span class="job-title">Technical Lead</span>
                      </a>
                    </h4>
                  </div>
                </div>
              </div>
              <div class="col-md-4 col-sm-4 col-xs-12 sjb-apply-now-btn">
                <a href="https://inspiredgeit.com/jobs/technical-lead/" class="btn btn-primary">Apply Now</a>
              </div>
              <div class="col-md-12 col-sm-12">
                <div class="sjb-job-type-location-date">
                  <div class="job-type"><i class="fa fa-briefcase"></i>Technical Services</div>
                  <div class="job-location"><i class="fa fa-map-marker"></i>Visakhapatnam</div>
                  <div class="job-date"><i class="fa fa-calendar-check-o"></i>Posted 3 years ago</div>
                </div>
              </div>
            </div>
          </header>
          <div class="job-description-list">
            <p>Lead the support and modernization roadmap.</p>
          </div>
        </div>
      </div>
      <!-- ==================================================
      End Jobs List View -->
      <div class="list-data">
        <div class="v2">
          <header>
            <div class="row">
              <div class="col-md-8 col-sm-8">
                <div class="company-logo">
                  <a href="https://inspiredgeit.com/jobs/sales-manager/">
                    <img src="https://inspiredgeit.com/wp-content/uploads/logo.jpg" alt="Inspiredge IT Solutions">
                  </a>
                </div>
                <div class="sjb-with-logo">
                  <div class="job-info">
                    <h4>
                      <a href="https://inspiredgeit.com/jobs/sales-manager/">
                        <span class="job-title">Sales Manager</span>
                      </a>
                    </h4>
                  </div>
                </div>
              </div>
              <div class="col-md-4 col-sm-4 col-xs-12 sjb-apply-now-btn">
                <a href="https://inspiredgeit.com/jobs/sales-manager/" class="btn btn-primary">Apply Now</a>
              </div>
              <div class="col-md-12 col-sm-12">
                <div class="sjb-job-type-location-date">
                  <div class="job-type"><i class="fa fa-briefcase"></i>Technical Services</div>
                  <div class="job-location"><i class="fa fa-map-marker"></i>Charlotte</div>
                  <div class="job-date"><i class="fa fa-calendar-check-o"></i>Posted 3 years ago</div>
                </div>
              </div>
            </div>
          </header>
          <div class="job-description-list">
            <p>US regional sales leadership opening.</p>
          </div>
        </div>
      </div>
      <!-- ==================================================
      End Jobs List View -->
    </div>
    <ul class="pagination">
      <li class="list-item"><a class="page-numbers" href="https://inspiredgeit.com/jobs/page/3/">3</a></li>
      <li class="list-item"><a class="next page-numbers" href="https://inspiredgeit.com/jobs/page/3/">Next</a></li>
    </ul>
  </body>
</html>
`

const jobsArchivePageThreeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Archive - Page 3 of 7 - Inspiredge IT Solutions</title>
  </head>
  <body>
    <div class="sjb-listing">
      <div class="list-data">
        <div class="v2">
          <header>
            <div class="row">
              <div class="col-md-8 col-sm-8">
                <div class="company-logo">
                  <a href="https://inspiredgeit.com/jobs/technical-support-engineer/">
                    <img src="https://inspiredgeit.com/wp-content/uploads/logo.jpg" alt="Inspiredge IT Solutions">
                  </a>
                </div>
                <div class="sjb-with-logo">
                  <div class="job-info">
                    <h4>
                      <a href="https://inspiredgeit.com/jobs/technical-support-engineer/">
                        <span class="job-title">Technical Support Engineer</span>
                      </a>
                    </h4>
                  </div>
                </div>
              </div>
              <div class="col-md-4 col-sm-4 col-xs-12 sjb-apply-now-btn">
                <a href="https://inspiredgeit.com/jobs/technical-support-engineer/" class="btn btn-primary">Apply Now</a>
              </div>
              <div class="col-md-12 col-sm-12">
                <div class="sjb-job-type-location-date">
                  <div class="job-type"><i class="fa fa-briefcase"></i>Technical Services</div>
                  <div class="job-location"><i class="fa fa-map-marker"></i>Visakhapatnam</div>
                  <div class="job-date"><i class="fa fa-calendar-check-o"></i>Posted 2 years ago</div>
                </div>
              </div>
            </div>
          </header>
          <div class="job-description-list">
            <p>Primary Skills: Soft skills:</p>
          </div>
        </div>
      </div>
      <!-- ==================================================
      End Jobs List View -->
    </div>
  </body>
</html>
`

const telecomAnalystDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Telecom Analyst - Inspiredge IT Solutions</title>
    <meta
      name="description"
      content="Customer-facing telecom analysis and reporting. 5+ years of telecom operations experience is required."
    />
  </head>
  <body>
    <main>
      <h1>Telecom Analyst</h1>
      <section>
        <h2>Role Summary</h2>
        <p>Customer-facing telecom analysis and reporting.</p>
        <p>5+ years of telecom operations experience is required.</p>
      </section>
    </main>
  </body>
</html>
`

const aiEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>AI Engineer - Inspiredge IT Solutions</title>
    <meta
      name="description"
      content="Build practical AI workflows for managed services. 3 years of applied AI engineering experience is preferred."
    />
  </head>
  <body>
    <main>
      <h1>AI Engineer</h1>
      <section>
        <h2>Job Description</h2>
        <p>Build practical AI workflows for managed services.</p>
        <p>3 years of applied AI engineering experience is preferred.</p>
      </section>
    </main>
  </body>
</html>
`

const technicalLeadDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Technical Lead - Inspiredge IT Solutions</title>
    <meta
      name="description"
      content="Lead the support and modernization roadmap for enterprise client environments."
    />
  </head>
  <body>
    <main>
      <h1>Technical Lead</h1>
      <section>
        <h2>What You Will Do</h2>
        <p>Lead the support and modernization roadmap for enterprise client environments.</p>
        <p>Coordinate engineers, improve service quality, and drive operational reliability across the support organization.</p>
      </section>
    </main>
  </body>
</html>
`

const inspiredgeHomepageShellHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Managed Services and Industry Specific Solutions - Inspiredge IT Solutions</title>
    <meta
      name="description"
      content="Managed services and industry specific solutions for enterprise transformation with Agentic AI."
    />
  </head>
  <body>
    <main>
      <h1>Redefining Digital Landscape with Intelligent AI Experts In Execution, Delivering Excellence.</h1>
      <section>
        <p>Enterprise Transformation with Agentic AI</p>
        <p>Happy Clients are the best advertising Money can't buy</p>
        <p>Hello!! I'm Sophie, How may I assist you today?</p>
      </section>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/inspiredgeitsolutions/script.js')
  } catch {
    assert.fail('Expected Inspiredge IT Solutions scraper module at ../../scraper/inspiredgeitsolutions/script.js')
  }
}

test('Inspiredge IT Solutions helpers stay pinned to the verified first-party jobs archive from Sunday, August 2, 2026', async () => {
  const inspiredge = await loadModule()

  assert.equal(inspiredge.SOURCE, 'inspiredgeitsolutions')
  assert.equal(inspiredge.COMPANY, 'Inspiredge IT Solutions')
  assert.equal(inspiredge.CAREERS_URL, 'https://inspiredgeit.com/jobs/')
  assert.equal(inspiredge.VERIFIED_ON, '2026-08-02')
  assert.equal(inspiredge.hasOfficialJobsArchiveSignal(jobsArchiveHtml), true)
  assert.equal(inspiredge.hasOfficialJobsArchiveSignal('<html><body><h1>Jobs</h1></body></html>'), false)
  assert.deepEqual(inspiredge.extractArchivePageUrls(jobsArchiveHtml), [
    'https://inspiredgeit.com/jobs/page/2/',
  ])
  assert.deepEqual(inspiredge.extractJobs(jobsArchiveHtml), [
    {
      title: 'Telecom Analyst',
      company: 'Inspiredge IT Solutions',
      department: 'Technical Services',
      location: 'Remote, India',
      city: null,
      country: 'India',
      jobId: 'telecom-analyst-3',
      requisitionId: 'telecom-analyst-3',
      sourceUrl: 'https://inspiredgeit.com/jobs/telecom-analyst-3/',
      applyUrl: 'https://inspiredgeit.com/jobs/telecom-analyst-3/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Customer-facing telecom analysis and reporting.',
      remoteStatus: 'Remote',
    },
    {
      title: 'AI Engineer',
      company: 'Inspiredge IT Solutions',
      department: 'Technical Services',
      location: 'Hyderabad, Telangana, India',
      city: 'Hyderabad',
      country: 'India',
      jobId: 'ai-engineer',
      requisitionId: 'ai-engineer',
      sourceUrl: 'https://inspiredgeit.com/jobs/ai-engineer/',
      applyUrl: 'https://inspiredgeit.com/jobs/ai-engineer/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Build practical AI workflows for managed services.',
      remoteStatus: 'Hybrid',
    },
  ])
})

test('Inspiredge IT Solutions run uses browser fallback and archive pagination before decorating extracted jobs', async () => {
  const inspiredge = await loadModule()
  const browserRequestedUrls = []

  const jobs = await inspiredge.createInspiredgeItSolutionsScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async () => {
      throw new Error('HTTP/1.1 protocol parse error')
    },
    fetchBrowserText: async (url) => {
      browserRequestedUrls.push(url)
      if (url === inspiredge.CAREERS_URL) return jobsArchiveHtml
      if (url === 'https://inspiredgeit.com/jobs/page/2/') return jobsArchivePageTwoHtml
      if (url === 'https://inspiredgeit.com/jobs/page/3/') return jobsArchivePageThreeHtml
      if (url === 'https://inspiredgeit.com/jobs/telecom-analyst-3/') return telecomAnalystDetailHtml
      if (url === 'https://inspiredgeit.com/jobs/ai-engineer/') return aiEngineerDetailHtml
      if (url === 'https://inspiredgeit.com/jobs/technical-lead/') return technicalLeadDetailHtml
      if (url === 'https://inspiredgeit.com/jobs/technical-support-engineer/') return inspiredgeHomepageShellHtml
      throw new Error(`Unexpected Inspiredge URL: ${url}`)
    },
  })

  assert.deepEqual(browserRequestedUrls.slice(0, 3), [
    inspiredge.CAREERS_URL,
    'https://inspiredgeit.com/jobs/page/2/',
    'https://inspiredgeit.com/jobs/page/3/',
  ])
  assert.equal(browserRequestedUrls.includes('https://inspiredgeit.com/jobs/telecom-analyst-3/'), true)
  assert.equal(browserRequestedUrls.includes('https://inspiredgeit.com/jobs/ai-engineer/'), true)
  assert.equal(browserRequestedUrls.includes('https://inspiredgeit.com/jobs/technical-lead/'), true)
  assert.equal(
    browserRequestedUrls.filter((url) => url === 'https://inspiredgeit.com/jobs/technical-support-engineer/').length >= 2,
    true,
  )
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'inspiredgeitsolutions')
  assert.equal(jobs[0].link, 'https://inspiredgeit.com/jobs/telecom-analyst-3/')
  assert.equal(jobs[0].experienceRequired, '5+ years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[1].experienceRequired, '3 years')
  assert.equal(jobs[1].publicExperienceChecked, true)
  assert.equal(jobs[2].title, 'Technical Lead')
  assert.equal(jobs[2].experienceRequired, null)
  assert.equal(jobs[2].publicExperienceChecked, true)
  assert.equal(jobs[3].title, 'Technical Support Engineer')
  assert.equal(jobs[3].experienceRequired, null)
  assert.equal(jobs[3].publicExperienceChecked, true)
  assert.equal(jobs[3].jobDescription, 'Primary Skills: Soft skills:')
  assert.equal(jobs.some((job) => job.title === 'Sales Manager'), false)
})

test('Inspiredge IT Solutions run fails closed when the verified jobs archive drifts', async () => {
  const inspiredge = await loadModule()

  await assert.rejects(
    inspiredge.createInspiredgeItSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
      fetchBrowserText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified inspiredge it solutions jobs archive/i,
  )
})
