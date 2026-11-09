import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>No.1 PLC SCADA Training Institute In Bangalore</title>
  </head>
  <body>
    <nav>
      <a href="https://technologics.in/about-us/">About us</a>
      <a href="https://technologics.in/jobs/">Jobs</a>
      <a href="https://technologics.in/lab/">R&amp;D Lab</a>
      <a href="https://technologics.in/contact-enquire/">Contact us</a>
    </nav>
    <main>
      <img src="https://technologics.in/wp-content/uploads/2020/10/TECHNOLOGICS-LOGO.png" alt="TECHNOLOGICS">
      <p>For Immediate Assistance Call Us +919738171920</p>
      <p>Best PLC SCADA Training</p>
    </main>
  </body>
</html>
`

const homepageHtmlWithCareersNav = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>No.1 PLC SCADA Training Institute In Bangalore</title>
  </head>
  <body>
    <nav>
      <a href="https://technologics.in/about-us/">About us</a>
      <a href="https://technologics.in/careers">Careers</a>
      <a href="https://technologics.in/lab/">R&amp;D Lab</a>
      <a href="https://technologics.in/contact-enquire/">Contact us</a>
    </nav>
    <main>
      <img src="https://technologics.in/wp-content/uploads/2020/10/TECHNOLOGICS-LOGO.png" alt="TECHNOLOGICS">
      <p>For Immediate Assistance Call Us +919738171920</p>
      <p>Best PLC SCADA Training</p>
    </main>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Jobs - Technologics | PLC SCADA Training Embedded Etap Labview Matlab Linux Device Driver Plc Scada Training</title>
    <link rel="canonical" href="https://technologics.in/jobs/" />
  </head>
  <body>
    <nav>
      <a href="https://technologics.in/jobs/">Jobs</a>
      <a href="https://technologics.in/lab/">R&amp;D Lab</a>
      <a href="#">Careers</a>
    </nav>
    <main>
      <h1 class="display-4 font-weight-semi-bold mb-0">Jobs</h1>
      <div>[vc_row][vc_column][vc_column_text][jobpost][/vc_column_text][/vc_column][/vc_row]</div>
    </main>
  </body>
</html>
`

const pageSitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://technologics.in/job-description/</loc></url>
  <url><loc>https://technologics.in/jobs/</loc></url>
  <url><loc>https://technologics.in/career/</loc></url>
  <url><loc>https://technologics.in/core-industry-jobs/</loc></url>
  <url><loc>https://technologics.in/best-job-oriented-training/</loc></url>
  <url><loc>https://technologics.in/lab/</loc></url>
</urlset>`

const jobDescriptionHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Description - Technologics | PLC SCADA Training Embedded Etap Labview Matlab Linux Device Driver Plc Scada Training</title>
    <link rel="canonical" href="https://technologics.in/job-description/" />
  </head>
  <body>
    <nav>
      <a href="https://technologics.in/jobs/">Jobs</a>
      <a href="https://technologics.in/lab/">R&amp;D Lab</a>
    </nav>
    <main>
      <h1 class="display-4 font-weight-semi-bold mb-0">Job Description</h1>
      <p>Designation: Automation Engineer.</p>
      <p>Work location - china / japan.</p>
      <p>No of openings: 12 nos.</p>
      <p>1st interview: July 1st week by Indian Team.</p>
      <p>2nd interview: Mids of August by Japanese Team.</p>
      <p>Interview Location : Bangalore</p>
      <p>Eligibility Criteria:</p>
      <p>- Education : BE / B-Tech</p>
      <p>- Must had taken customized Automation Training at Technologics according to the requirement.</p>
      <p>- Must have Passport.</p>
      <p>- Willing to travel overseas to work for long time.</p>
      <p>- Must have good English communication.</p>
      <p>- programming knowledge.</p>
      <p>[sf_button colour="gold" type="standard" size="standard" link="http://technologics.in/?page_id=2572" target="_self"]Register[/sf_button]</p>
    </main>
  </body>
</html>
`

const marketingJobsHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Core Industry Jobs - Technologics | PLC SCADA Training Embedded Etap Labview Matlab Linux Device Driver Plc Scada Training</title>
  </head>
  <body>
    <main>
      <h1>Core Industry Jobs</h1>
      <p>For Immediate Assistance Call Us +919738171920</p>
    </main>
  </body>
</html>
`

test('Technologics scraper pins the verified first-party public surface from 2026-07-13', async () => {
  const technologics = await loadModule()
  assert.ok(technologics, 'Expected scraper module at ./script.js')

  assert.equal(technologics.SOURCE, 'technologicsglobalprojectsrdlab')
  assert.equal(technologics.COMPANY, 'Technologics Global Projects & R&D Lab')
  assert.equal(technologics.HOMEPAGE_URL, 'https://technologics.in/')
  assert.equal(technologics.JOBS_PAGE_URL, 'https://technologics.in/jobs/')
  assert.equal(technologics.PAGE_SITEMAP_URL, 'https://technologics.in/page-sitemap.xml')
  assert.equal(technologics.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(technologics.hasOfficialHomepageSignal(homepageHtmlWithCareersNav), true)
  assert.equal(technologics.hasOfficialJobsPageSignal(jobsPageHtml), true)
  assert.deepEqual(technologics.extractCandidateJobUrls(pageSitemapXml), [
    'https://technologics.in/job-description/',
    'https://technologics.in/jobs/',
    'https://technologics.in/career/',
    'https://technologics.in/core-industry-jobs/',
    'https://technologics.in/best-job-oriented-training/',
  ])
})

test('isJobPostingPage only accepts actual posting pages and skips marketing pages', async () => {
  const technologics = await loadModule()
  assert.ok(technologics, 'Expected scraper module at ./script.js')

  assert.equal(
    technologics.isJobPostingPage({
      url: 'https://technologics.in/job-description/',
      html: jobDescriptionHtml,
    }),
    true,
  )

  assert.equal(
    technologics.isJobPostingPage({
      url: 'https://technologics.in/jobs/',
      html: jobsPageHtml,
    }),
    false,
  )

  assert.equal(
    technologics.isJobPostingPage({
      url: 'https://technologics.in/core-industry-jobs/',
      html: marketingJobsHtml,
    }),
    false,
  )
})

test('extractJobFromPostingPage normalizes the verified public job page into shared fields', async () => {
  const technologics = await loadModule()
  assert.ok(technologics, 'Expected scraper module at ./script.js')

  assert.deepEqual(
    technologics.extractJobFromPostingPage({
      url: 'https://technologics.in/job-description/',
      html: jobDescriptionHtml,
    }),
    {
      title: 'Automation Engineer',
      company: 'Technologics Global Projects & R&D Lab',
      department: null,
      location: 'China / Japan',
      city: null,
      country: null,
      jobId: 'job-description::automation-engineer',
      requisitionId: 'job-description::automation-engineer',
      sourceUrl: 'https://technologics.in/job-description/',
      applyUrl: 'http://technologics.in/?page_id=2572',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: 'BE / B-Tech',
      preferredQualification: null,
      requiredSkills: [
        'Programming knowledge',
        'Good English communication',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Designation: Automation Engineer. Work location - china / japan. No of openings: 12 nos. 1st interview: July 1st week by Indian Team. 2nd interview: Mids of August by Japanese Team. Interview Location : Bangalore Eligibility Criteria: - Education : BE / B-Tech - Must had taken customized Automation Training at Technologics according to the requirement. - Must have Passport. - Willing to travel overseas to work for long time. - Must have good English communication. - programming knowledge. Register',
    },
  )
})

test('run fetches the verified Technologics surface and returns only actual public postings', async () => {
  const technologics = await loadModule()
  assert.ok(technologics, 'Expected scraper module at ./script.js')

  const requestedUrls = []
  const jobs = await technologics.createTechnologicsGlobalProjectsRDLabScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === technologics.HOMEPAGE_URL) return homepageHtml
      if (url === technologics.JOBS_PAGE_URL) return jobsPageHtml
      if (url === technologics.PAGE_SITEMAP_URL) return pageSitemapXml
      if (url === 'https://technologics.in/job-description/') return jobDescriptionHtml
      if (url === 'https://technologics.in/jobs/') return jobsPageHtml
      if (url === 'https://technologics.in/career/') return '<html><body><h1>Finishing School</h1></body></html>'
      if (url === 'https://technologics.in/core-industry-jobs/') return marketingJobsHtml
      if (url === 'https://technologics.in/best-job-oriented-training/') return '<html><body><h1>Best Job Oriented Training</h1></body></html>'

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    technologics.HOMEPAGE_URL,
    technologics.JOBS_PAGE_URL,
    technologics.PAGE_SITEMAP_URL,
    'https://technologics.in/job-description/',
    'https://technologics.in/jobs/',
    'https://technologics.in/career/',
    'https://technologics.in/core-industry-jobs/',
    'https://technologics.in/best-job-oriented-training/',
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Automation Engineer')
  assert.equal(jobs[0].source, 'technologicsglobalprojectsrdlab')
  assert.equal(jobs[0].link, 'http://technologics.in/?page_id=2572')
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

