import assert from 'node:assert/strict'
import test from 'node:test'

const verifiedHomepageHtml = `
  <html lang="en">
    <head>
      <title>Home - olectra</title>
    </head>
    <body>
      <nav>
        <a href="job-openings">Job Openings</a>
        <a href="submit-resume">Submit Resume</a>
      </nav>
      <p>
        Olectra Greentech Ltd is pioneer in electric bus manufacturing and insulators in India,
        With this Endeavour OGL has been a part of building the Power Transmission and distribution in India.
      </p>
      <p>
        Olectra vision to support environment has led to a new phase by developing Innovative
        solutions for the society.
      </p>
      <footer>&copy; Olectra Greentech Limited.</footer>
    </body>
  </html>
`

const verifiedJobOpeningsHtml = `
  <html lang="en">
    <head>
      <title>Job Openings - olectra</title>
    </head>
    <body>
      <h1>Job Openings</h1>
      <a href="https://olectra.com/job-openings/">Job Openings</a>
      <a href="https://olectra.com/submit-resume/">Submit Resume</a>

      <div class="fusion-panel panel-default">
        <div class="panel-heading">
          <h4 class="panel-title toggle">
            <a href="#panel-1">
              <div class="fusion-toggle-heading">Engineer / Sr. Engineer - R&amp;D Project Management</div>
            </a>
          </h4>
        </div>
        <div id="panel-1" class="panel-collapse collapse">
          <div class="panel-body toggle-content">
            <h3><strong>Job Description</strong></h3>
            <h5><strong><em>Role &amp; Responsibilities:</em></strong></h5>
            <ul>
              <li>Preparation of project time line as per business requirement</li>
              <li>Project list summary and periodic reporting to management</li>
            </ul>
            <h5><strong>Educational Qualification, experience, skills &amp; knowledge:</strong></h5>
            <ul>
              <li>Education: Diploma/BE / B.Tech / Mechanical / Automobile /MBA</li>
              <li>Experience: 3 to 5 years in R&amp;D Project Management</li>
              <li>Skills and Knowledge:</li>
              <li>Knowledge of project timeline preparation</li>
              <li>Good Interpersonal and Communication skills</li>
              <li>Knowledge of the Bus and Truck design process</li>
              <li>Knowledge of design and development process inclusive of the manufacturing process</li>
              <li>Knowledge of project dashboard tools and preparation is essential</li>
            </ul>
            <h5><strong>Competencies &amp; cultural requirements:</strong></h5>
            <ul>
              <li>Expert in follow up with all functions in R&amp;D and ensuring project tasks execution as per committed timeline</li>
            </ul>
            <a
              class="fusion-button button-flat fusion-button-round button-large button-default button-4"
              target="_self"
              href="https://olectra.com/job-openings/submit-resume"
            ><span class="fusion-button-text">Apply now</span></a>
          </div>
        </div>
      </div>

      <div class="fusion-panel panel-default">
        <div class="panel-heading">
          <h4 class="panel-title toggle">
            <a href="#panel-2">
              <div class="fusion-toggle-heading">Engineer / Sr. Engineer &#8211; R&amp;D Proto Development</div>
            </a>
          </h4>
        </div>
        <div id="panel-2" class="panel-collapse collapse">
          <div class="panel-body toggle-content">
            <h3><strong>Job Description</strong></h3>
            <h5><strong><em>Role &amp; Responsibilities:</em></strong></h5>
            <ul>
              <li>Preparation of proto type planning as per project timeline</li>
              <li>Proto type BoM management as per the inputs from design team</li>
            </ul>
            <h5><strong>Educational Qualification, experience, skills &amp; knowledge:</strong></h5>
            <ul>
              <li>Education: Diploma/BE / B.Tech / Mechanical / Automobile / Industrial Production.</li>
              <li>Experience: 4 to 6 years in proto type vehicle building.</li>
              <li>Skills and Knowledge:</li>
              <li>Good Interpersonal and Communication skills.</li>
              <li>Knowledge of the Bus and Truck proto assembly process</li>
            </ul>
            <h5><strong>Competencies &amp; cultural requirements:</strong></h5>
            <ul>
              <li>Expert in resolving proto type build related concerns/issues on-time and Quick First level analysis.</li>
            </ul>
            <a
              class="fusion-button button-flat fusion-button-round button-large button-default button-5"
              target="_self"
              href="https://olectra.com/job-openings/submit-resume"
            ><span class="fusion-button-text">Apply now</span></a>
          </div>
        </div>
      </div>

      <div class="fusion-panel panel-default">
        <div class="panel-heading">
          <h4 class="panel-title toggle">
            <a href="#panel-3">
              <div class="fusion-toggle-heading">Engineer/ Sr. Engineer &#8211; R&amp;D Cabin &amp; Load Body</div>
            </a>
          </h4>
        </div>
        <div id="panel-3" class="panel-collapse collapse">
          <div class="panel-body toggle-content">
            <h3><strong>Job Description</strong></h3>
            <h5><strong><em>Role &amp; Responsibilities:</em></strong></h5>
            <ul>
              <li>Benchmarking of Load body system and deep understanding of application.</li>
              <li>Creation of 2D Master section of Load Body &amp; mounting to Chassis.</li>
            </ul>
            <h5><strong>Educational Qualification, experience, skills &amp; knowledge:</strong></h5>
            <ul>
              <li>Education: BE / B.Tech / M.Tech, Mechanical / Automobile / Industrial Production.</li>
              <li>Experience: 4 to 6 years in Truck Load Body design.</li>
              <li>Skills and Knowledge:</li>
              <li>Good Interpersonal and Communication skills.</li>
            </ul>
            <h5><strong>Competencies &amp; cultural requirements:</strong></h5>
            <ul>
              <li>Expert in resolving Load body Aggregate design &amp; tipper Hydraulic issues on-time.</li>
            </ul>
            <a
              class="fusion-button button-flat fusion-button-round button-large button-default button-6"
              target="_self"
              href="https://olectra.com/job-openings/submit-resume"
            ><span class="fusion-button-text">Apply now</span></a>
          </div>
        </div>
      </div>
    </body>
  </html>
`

const verifiedSubmitResumeHtml = `
  <html lang="en">
    <head>
      <title>Submit Resume - olectra</title>
    </head>
    <body>
      <h1>Submit Resume</h1>
      <form
        action="/submit-resume/#wpcf7-f525-p502-o2"
        method="post"
        class="wpcf7-form init"
        enctype="multipart/form-data"
      >
        <input placeholder="Full name" type="text" name="your-name" />
        <input placeholder="Mobile" type="text" name="mobile" />
        <input placeholder="Current Location" type="text" name="current-location" />
        <input placeholder="Current Employer" type="text" name="current-employer" />
        <input placeholder="Current CTC (in Lakhs)" type="text" name="current-ctc" />
        <input placeholder="Notice Period" type="text" name="notice-period" />
        <input placeholder="Email" type="email" name="your-email" />
        <input placeholder="Qualification" type="text" name="qualification" />
        <input placeholder="Current Job Title" type="text" name="current-job-title" />
        <input placeholder="Applying for" type="text" name="applying-for" />

        <select name="functional-area">
          <option>Functional Area</option>
          <option>Finance</option>
          <option>Operations</option>
          <option>Sales &amp; Marketing</option>
          <option>Technology</option>
          <option>Production</option>
        </select>

        <select name="yeas-of-experience">
          <option>Yeas of Experience</option>
          <option>&lt;1 Year</option>
          <option>1-2 Years</option>
          <option>3-4 Years</option>
          <option>7-10 Years</option>
        </select>

        <label>Upload resume</label>
        <input type="file" name="your-resume" />
      </form>
    </body>
  </html>
`

const EXPECTED_TITLES = [
  'Engineer / Sr. Engineer - R&D Project Management',
  'Engineer / Sr. Engineer - R&D Proto Development',
  'Engineer/ Sr. Engineer - R&D Cabin & Load Body',
]

const loadOlectraModule = async () => {
  try {
    return await import('../../scraper/olectragreentechlimited/script.js')
  } catch {
    assert.fail('Expected Olectra Greentech Limited scraper module at ../../scraper/olectragreentechlimited/script.js')
  }
}

test('Olectra scraper recognizes the verified homepage, job openings page, and shared submit-resume form', async () => {
  const olectra = await loadOlectraModule()

  assert.equal(olectra.SOURCE, 'olectragreentechlimited')
  assert.equal(olectra.COMPANY, 'Olectra Greentech Limited')
  assert.equal(olectra.HOMEPAGE_URL, 'https://olectra.com/')
  assert.equal(olectra.JOB_OPENINGS_URL, 'https://olectra.com/job-openings/')
  assert.equal(olectra.SUBMIT_RESUME_URL, 'https://olectra.com/submit-resume/')
  assert.equal(olectra.APPLY_URL, 'https://olectra.com/job-openings/submit-resume')
  assert.equal(olectra.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(olectra.hasOfficialJobOpeningsSignal(verifiedJobOpeningsHtml), true)
  assert.equal(olectra.hasOfficialSubmitResumeSignal(verifiedSubmitResumeHtml), true)
})

test('Olectra scraper extracts the verified public first-party roles from the job openings page', async () => {
  const olectra = await loadOlectraModule()

  const jobs = olectra.extractPublicJobs(verifiedJobOpeningsHtml)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.title), EXPECTED_TITLES)
  assert.deepEqual(jobs[0], {
    title: 'Engineer / Sr. Engineer - R&D Project Management',
    company: 'Olectra Greentech Limited',
    department: 'R&D',
    location: null,
    city: null,
    country: 'India',
    jobId: 'olectragreentechlimited-engineer-sr-engineer-r-d-project-management',
    requisitionId: 'olectragreentechlimited-engineer-sr-engineer-r-d-project-management',
    sourceUrl: 'https://olectra.com/job-openings/#olectragreentechlimited-engineer-sr-engineer-r-d-project-management',
    applyUrl: 'https://olectra.com/job-openings/submit-resume',
    employmentType: null,
    workplaceType: null,
    experienceRequired: '3 to 5 years in R&D Project Management',
    minimumQualification: 'Diploma/BE / B.Tech / Mechanical / Automobile /MBA',
    preferredQualification: null,
    requiredSkills: [
      'Knowledge of project timeline preparation',
      'Good Interpersonal and Communication skills',
      'Knowledge of the Bus and Truck design process',
      'Knowledge of design and development process inclusive of the manufacturing process',
      'Knowledge of project dashboard tools and preparation is essential',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Education: Diploma/BE / B.Tech / Mechanical / Automobile /MBA. Experience: 3 to 5 years in R&D Project Management. Skills: Knowledge of project timeline preparation; Good Interpersonal and Communication skills; Knowledge of the Bus and Truck design process; Knowledge of design and development process inclusive of the manufacturing process; Knowledge of project dashboard tools and preparation is essential. Apply via the official Olectra first-party resume page.',
  })
  assert.equal(jobs[1].experienceRequired, '4 to 6 years in proto type vehicle building.')
  assert.equal(jobs[2].minimumQualification, 'BE / B.Tech / M.Tech, Mechanical / Automobile / Industrial Production.')
  assert.ok(
    jobs.every((job) =>
      job.country === 'India'
      && job.department === 'R&D'
      && job.applyUrl === 'https://olectra.com/job-openings/submit-resume'
      && job.sourceUrl.startsWith('https://olectra.com/job-openings/#olectragreentechlimited-')),
  )
})

test('Olectra scraper verifies the live-surface handoff chain before returning decorated jobs', async () => {
  const olectra = await loadOlectraModule()
  const requestedUrls = []

  const jobs = await olectra.createOlectraGreentechLimitedScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === olectra.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === olectra.JOB_OPENINGS_URL) return verifiedJobOpeningsHtml
      if (url === olectra.SUBMIT_RESUME_URL) return verifiedSubmitResumeHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    olectra.HOMEPAGE_URL,
    olectra.JOB_OPENINGS_URL,
    olectra.SUBMIT_RESUME_URL,
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'olectragreentechlimited')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].companyCareerPage, 'https://olectra.com/job-openings/')
  assert.equal(jobs[0].companyDomain, 'olectra.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
})

test('Olectra scraper fails closed when the verified homepage, jobs surface, or submit-resume form drifts', async () => {
  const olectra = await loadOlectraModule()

  await assert.rejects(
    olectra.createOlectraGreentechLimitedScraper().run({
      fetchText: async (url) => {
        if (url === olectra.HOMEPAGE_URL) return '<html><title>Unexpected</title></html>'
        if (url === olectra.JOB_OPENINGS_URL) return verifiedJobOpeningsHtml
        return verifiedSubmitResumeHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    olectra.createOlectraGreentechLimitedScraper().run({
      fetchText: async (url) => {
        if (url === olectra.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === olectra.JOB_OPENINGS_URL) {
          return verifiedJobOpeningsHtml.replace(
            'Engineer / Sr. Engineer - R&amp;D Project Management',
            'Project Lead',
          )
        }
        return verifiedSubmitResumeHtml
      },
    }),
    /verified public job openings page|verified public job cards/i,
  )

  await assert.rejects(
    olectra.createOlectraGreentechLimitedScraper().run({
      fetchText: async (url) => {
        if (url === olectra.HOMEPAGE_URL) return verifiedHomepageHtml
        if (url === olectra.JOB_OPENINGS_URL) return verifiedJobOpeningsHtml
        return verifiedSubmitResumeHtml.replace('Applying for', 'Position')
      },
    }),
    /verified submit-resume form/i,
  )
})
