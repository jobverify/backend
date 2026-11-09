import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLY_URL,
  CAREERS_URL,
  COMPANY,
  HOMEPAGE_URL,
  SOURCE,
  createPrecisionPrecastSolutionsScraper,
  extractPublicJobs,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <html>
    <head>
      <title>PPS - Precision Precast Solutions</title>
    </head>
    <body>
      <nav>
        <a href="/">HOME</a>
        <a href="/career.php">CAREERS</a>
      </nav>
      <main>
        <h1>Precision Precast Solutions</h1>
        <p>Precision Precast Solutions Private Limited (PPS) is an Integrated Engineering consultancy company in the AEC segment.</p>
        <p>We are a technology driven organization using cutting edge tools to deliver optimum solutions since our inception in June 2004 in Pune, India.</p>
        <p>marketing@ppspl.in</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>PPS - Precision Precast Solutions</title>
    </head>
    <body>
      <main>
        <h2>Careers</h2>
        <h3>
          <a href="resume.php" target="_blank"><strong>CLICK HERE TO FILL THE DETAILED FORM</strong></a>
          <span>or</span>
          <form action="resume_email.php" enctype="multipart/form-data" method="post">
            <label for="resume_up"><strong>SUBMIT YOUR RESUME</strong></label>
          </form>
        </h3>
        <div class="accordion accordion-group" id="our-values-accordion">
          <div class="card">
            <div class="card-header p-0 bg-transparent" id="headingOne1">
              <h2 class="mb-0">
                <button class="btn btn-block text-left" type="button" data-toggle="collapse" data-target="#collapseOne1">Structural Engineer</button>
              </h2>
            </div>
            <div id="collapseOne1" class="collapse show" aria-labelledby="headingOne1" data-parent="#our-values-accordion">
              <div class="card-body">
                <p><strong>Designation- Structural Design Engineer</strong></p>
                <p>Qualification- M Tech Structures/ Civil</p>
                <p><strong>Broad Responsibilities</strong></p>
                <p><strong>Required minimum 2 yrs of Experience</strong></p>
                <p>&bull; Designing structures such as buildings and industrial structures.</p>
                <p>&bull; Performing structural analysis to calculate loads.</p>
                <div class="general-btn mt-4">
                  <a class="btn btn-primary" href="resume.php">Apply Now</a>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header p-0 bg-transparent" id="headingOne2">
              <h2 class="mb-0">
                <button class="btn btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseOne2">Tekla Precast Modeller / Detailer</button>
              </h2>
            </div>
            <div id="collapseOne2" class="collapse" aria-labelledby="headingOne2" data-parent="#our-values-accordion">
              <div class="card-body">
                <p><strong>Designation- Tekla Precast Modeller / Detailer</strong><br>Qualification-B.E. (Civil) / Diploma<br>Experience- 3 to 5 Yrs.</p>
                <p>Broad Responsibility</p>
                <ul>
                  <li>Develop accurate 3D models, including rebar modelling, for precast structures.</li>
                  <li>Generate detailed construction and production drawings.</li>
                </ul>
                <p>Job Specific Skills</p>
                <ul>
                  <li>Tekla</li>
                  <li>Rebar modelling</li>
                </ul>
                <!--
                  <ul>
                    <li>Legacy hidden item</li>
                  </ul>
                -->
                <div class="general-btn mt-4">
                  <a class="btn btn-primary" href="resume.php">Apply Now</a>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header p-0 bg-transparent" id="headingOne3">
              <h2 class="mb-0">
                <button class="btn btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseOne3">Precast CAD Detailer</button>
              </h2>
            </div>
            <div id="collapseOne3" class="collapse" aria-labelledby="headingOne3" data-parent="#our-values-accordion">
              <div class="card-body">
                <p><strong>Designation- Precast CAD Detailer</strong><br>Qualification- B.E.(Civil) / Diploma / ITI<br>Experience- 3 to 8 Yrs.</p>
                <p><strong>Broad Responsibility</strong></p>
                <ul>
                  <li>Prepare precast shop drawings.</li>
                </ul>
                <div class="general-btn mt-4">
                  <a class="btn btn-primary" href="resume.php">Apply Now</a>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header p-0 bg-transparent" id="headingOne4">
              <h2 class="mb-0">
                <button class="btn btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseOne4">Rebar CAD Detailer</button>
              </h2>
            </div>
            <div id="collapseOne4" class="collapse" aria-labelledby="headingOne4" data-parent="#our-values-accordion">
              <div class="card-body">
                <p><strong>Designation- Rebar CAD Detailer</strong><br>Qualification- B.E. (Civil) / Diploma / ITI<br>Experience- 3 to 5 Yrs</p>
                <p><strong>Broad Responsibility</strong></p>
                <ul>
                  <li>Able to prepare bar bending schedules.</li>
                </ul>
                <div class="general-btn mt-4">
                  <a class="btn btn-primary" href="resume.php">Apply Now</a>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header p-0 bg-transparent" id="headingOne5">
              <h2 class="mb-0">
                <button class="btn btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseOne5">Steel Detailer (AutoCAD/CAD)</button>
              </h2>
            </div>
            <div id="collapseOne5" class="collapse" aria-labelledby="headingOne5" data-parent="#our-values-accordion">
              <div class="card-body">
                <p><strong>Designation - Steel Detailer (AutoCAD / CAD)</strong></p>
                <p>Experience: 3 &ndash; 5 years</p>
                <p><strong>Broad Responsibilities:</strong></p>
                <ul>
                  <li>Use CAD software to create detailed drawings.</li>
                </ul>
                <p><strong>Job Specific Skills</strong></p>
                <ul>
                  <li>Good Visualization Skills</li>
                  <li>Good at AutoCAD drawing</li>
                </ul>
                <div class="general-btn mt-4">
                  <a class="btn btn-primary" href="resume.php">Apply Now</a>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header p-0 bg-transparent" id="headingOne6">
              <h2 class="mb-0">
                <button class="btn btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseOne6">Senior Steel Detailer (AutoCAD/CAD)</button>
              </h2>
            </div>
            <div id="collapseOne6" class="collapse" aria-labelledby="headingOne6" data-parent="#our-values-accordion">
              <div class="card-body">
                <p><strong>Designation : Senior Steel detailer (AutoCAD/CAD)</strong><br>Experience: 5 &ndash; 7 years</p>
                <p><strong>Broad Responsibilities</strong></p>
                <ul>
                  <li>Expertise in steel structural detailing using AutoCAD as well as TEKLA.</li>
                </ul>
                <p><strong>Job Specific Skills</strong></p>
                <ul>
                  <li>Good at AutoCAD drawing</li>
                  <li>Rebar CAD would be the added advantage</li>
                </ul>
                <div class="general-btn mt-4">
                  <a class="btn btn-primary" href="resume.php">Apply Now</a>
                </div>
              </div>
            </div>
          </div>

          <div class="card">
            <div class="card-header p-0 bg-transparent" id="headingSix">
              <h2 class="mb-0">
                <button class="btn btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseSix">Benefits</button>
              </h2>
            </div>
            <div id="collapseSix" class="collapse" aria-labelledby="headingSix" data-parent="#our-values-accordion">
              <div class="card-body">
                <ul>
                  <li>All employees are covered under group medi-claim policy.</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </body>
  </html>
`

test('Precision Precast Solutions pins the verified official homepage and careers constants', () => {
  assert.equal(SOURCE, 'precisionprecastsolutions')
  assert.equal(COMPANY, 'Precision Precast Solutions')
  assert.equal(HOMEPAGE_URL, 'https://ppspl.com/')
  assert.equal(CAREERS_URL, 'https://ppspl.com/career.php')
  assert.equal(APPLY_URL, 'https://ppspl.com/resume.php')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasOfficialHomepageSignal('<html><body>Placeholder</body></html>'), false)
  assert.equal(hasOfficialCareersSignal('<html><body>No jobs here</body></html>'), false)
})

test('extractPublicJobs returns the public first-party Precision Precast Solutions roles', () => {
  const jobs = extractPublicJobs(careersHtml)

  assert.equal(jobs.length, 6)
  const {rawNativeRoleEvidence,...firstJob}=jobs[0]
  assert.match(rawNativeRoleEvidence.descriptionHtml,/Broad Responsibilities/)
  assert.deepEqual(firstJob, {
    title: 'Structural Design Engineer',
    company: 'Precision Precast Solutions',
    location: null,
    city: null,
    country: null,
    jobId: 'precisionprecastsolutions-structural-design-engineer',
    requisitionId: null,
    sourceUrl: 'https://ppspl.com/career.php',
    applyUrl: 'https://ppspl.com/resume.php',
    employmentType: 'Full-time',
    experienceRequired: '2 yrs',
    minimumQualification: 'M Tech Structures/ Civil',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Designation- Structural Design Engineer Qualification- M Tech Structures/ Civil Broad Responsibilities Required minimum 2 yrs of Experience - Designing structures such as buildings and industrial structures. - Performing structural analysis to calculate loads.',
  })
  assert.equal(jobs[1].title, 'Tekla Precast Modeller / Detailer')
  assert.equal(jobs[1].minimumQualification, 'B.E. (Civil) / Diploma')
  assert.equal(jobs[1].experienceRequired, '3 to 5 Yrs')
  assert.equal(jobs[1].requiredSkills.join(', '), 'Tekla, Rebar modelling')
  assert.equal(jobs[4].title, 'Steel Detailer (AutoCAD / CAD)')
  assert.equal(jobs[4].minimumQualification, null)
  assert.equal(jobs[4].experienceRequired, '3 - 5 years')
  assert.equal(jobs[5].title, 'Senior Steel detailer (AutoCAD/CAD)')
  assert.equal(jobs[5].experienceRequired, '5 - 7 years')
  assert.match(jobs[5].jobDescription, /AutoCAD as well as TEKLA/i)
})

test('run validates the official surfaces and decorates Precision Precast Solutions jobs with scraper metadata', async () => {
  const requestedUrls = []

  const jobs = await createPrecisionPrecastSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-13T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'precisionprecastsolutions')
  assert.equal(jobs[0].companyCareerPage, 'https://ppspl.com/career.php')
  assert.equal(jobs[0].companyDomain, 'ppspl.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].link, 'https://ppspl.com/resume.php')
  assert.equal(jobs[0].jobType, 'Full-time Experienced')
  assert.equal(jobs[0].scrapedTimestamp?.toISOString(), '2026-07-13T00:00:00.000Z')
})

test('run fails closed when the verified homepage or careers surface drifts', async () => {
  const scraper = createPrecisionPrecastSolutionsScraper()

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body>Coming soon</body></html>'
        }

        return careersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) {
          return careersHtml.replace('CLICK HERE TO FILL THE DETAILED FORM', 'Apply Here')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified public careers surface/i,
  )

  await assert.rejects(
    scraper.run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) {
          return careersHtml.replace(/<div class="card">[\s\S]*?<button class="btn btn-block text-left collapsed" type="button" data-toggle="collapse" data-target="#collapseSix">Benefits<\/button>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*<\/main>/, '</main>')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /returned no public jobs|verified public careers surface/i,
  )
})
