import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>AI-Driven Cloud, Data &amp; Enterprise Platforms Engineering Services</title>
    <link rel="canonical" href="https://nexturn.com/" />
    <meta property="og:site_name" content="NexTurn" />
  </head>
  <body>
    <nav>
      <a href="https://nexturn.com/careers/">Careers</a>
    </nav>
    <section>
      <p>India office: Cyber Towers, Madhapur, Hyderabad 500081</p>
    </section>
    <footer>careers@nexturn.com | &copy;2026 NexTurn | All Rights Reserved</footer>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at NexTurn | Build the Future with Innovation &amp; Purpose</title>
    <link rel="canonical" href="https://nexturn.com/careers/" />
    <meta property="og:site_name" content="NexTurn" />
  </head>
  <body>
    <main>
      <h1>Dream Big. Build Bold. Grow Limitlessly.</h1>
      <p>Join our team</p>
      <h2 class="mb-4 section-title pb-3">Current Positions Available</h2>
      <div class="row g-4">
        <div class="col-12 col-md-6 job_post_thumb" id="job_post_thumb_1">
          <div class="job-card">
            <h3 class="whitecard-heading">Java &#038; Linux Admin</h3>
            <p class="job-subtitle">India, Remote</p>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Work Experience:</strong>
              5+ Years
            </div>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Qualifications:</strong>
              Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.
            </div>
            <div class="my-4">
              <strong class="job-subtitle">Job Description:</strong>
              <p class="card-text-medium">
                Develop and maintain enterprise software applications using Java, Linux administration, and cloud automation.
              </p>
            </div>
            <a href="https://nexturn.com/job/java-linux-admin/" class="job-apply-btn mb-4">Apply</a>
          </div>
        </div>
        <div class="col-12 col-md-6 job_post_thumb show_hide" id="job_post_thumb_2" style="display:none;">
          <div class="job-card">
            <h3 class="whitecard-heading">SAP Techno-Functional Consultant</h3>
            <p class="job-subtitle">Hyderabad (Hybrid)</p>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Work Experience:</strong>
              5+ Years
            </div>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Qualifications:</strong>
              Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.
            </div>
            <div class="my-4">
              <strong class="job-subtitle">Job Description:</strong>
              <p class="card-text-medium">
                Partner with customer stakeholders to deliver SAP integration programs across enterprise workflows.
              </p>
            </div>
            <a href="https://nexturn.com/job/sap-techno-functional-consultant/" class="job-apply-btn mb-4">Apply</a>
          </div>
        </div>
        <div class="col-12 col-md-6 job_post_thumb" id="job_post_thumb_3">
          <div class="job-card">
            <h3 class="whitecard-heading">Salesforce Business Analyst</h3>
            <p class="job-subtitle">USA, King of Prussia, PA (Hybrid)</p>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Work Experience:</strong>
              12+ Years
            </div>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Qualifications:</strong>
              Bachelor's degree in Computer Science, Engineering, Information Systems, or a related field.
            </div>
            <div class="my-4">
              <strong class="job-subtitle">Job Description:</strong>
              <p class="card-text-medium">
                Collaborate with US-based stakeholders to deliver Salesforce business analysis programs.
              </p>
            </div>
            <a href="https://nexturn.com/job/salesforce-business-analyst/" class="job-apply-btn mb-4">Apply</a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const officialCareersUsOnlyHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers at NexTurn | Build the Future with Innovation &amp; Purpose</title>
    <link rel="canonical" href="https://nexturn.com/careers/" />
    <meta property="og:site_name" content="NexTurn" />
  </head>
  <body>
    <main>
      <h1>Dream Big. Build Bold. Grow Limitlessly.</h1>
      <h2 class="mb-4 section-title pb-3">Current Positions Available</h2>
      <div class="row g-4">
        <div class="col-12 col-md-6 job_post_thumb" id="job_post_thumb_24">
          <div class="job-card">
            <h3 class="whitecard-heading">Salesforce Business Analyst</h3>
            <p class="job-subtitle">USA, King of Prussia, PA (Hybrid)</p>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Work Experience:</strong>
              12+ Years
            </div>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Qualifications:</strong>
              Bachelor's degree in Computer Science, Engineering, Information Systems, or a related field.
            </div>
            <div class="my-4">
              <strong class="job-subtitle">Job Description:</strong>
              <p class="card-text-medium">
                Collaborate with US-based stakeholders to deliver Salesforce business analysis programs.
              </p>
            </div>
            <a href="https://nexturn.com/job/salesforce-business-analyst/" class="job-apply-btn mb-4">Apply</a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const verifiedAug32026HomepageHtml = `
<!doctype html>
<html lang=en-US>
  <head>
    <title>AI-Driven Cloud, Data &amp; Enterprise Platforms Engineering Services</title>
    <link rel=canonical href=https://nexturn.com/ >
    <meta property="og:site_name" content="NexTurn">
  </head>
  <body>
    <nav>
      <a class="nav-link" href=https://nexturn.com/careers>Careers</a>
    </nav>
    <footer>info@nexturn.com | careers@nexturn.com | &copy;2026 NexTurn | All Rights Reserved</footer>
  </body>
</html>
`

const verifiedAug72026HomepageHtml = `
<!doctype html>
<html lang=en-US>
  <head>
    <title>AI-Driven Cloud, Data &amp; Enterprise Platforms Engineering Services</title>
    <link rel=canonical href=https://65.0.158.166/ >
    <meta property="og:site_name" content="NexTurn">
  </head>
  <body>
    <nav>
      <a class="nav-link" href=https://nexturn.com/careers>Careers</a>
    </nav>
    <footer>info@nexturn.com | careers@nexturn.com | &copy;2026 NexTurn | All Rights Reserved</footer>
  </body>
</html>
`

const verifiedAug32026CareersHtml = `
<!doctype html>
<html lang=en-US>
  <head>
    <title>Careers at NexTurn | Build the Future with Innovation &amp; Purpose</title>
    <link rel=canonical href=https://65.0.158.166/careers/ >
    <meta property="og:site_name" content="NexTurn">
    <meta property="og:url" content="https://65.0.158.166/careers/">
  </head>
  <body>
    <main>
      <h1>Dream Big. Build Bold. Grow Limitlessly.</h1>
      <p>Join our team</p>
      <h2 class="mb-4 section-title pb-3">Current Positions Available</h2>
      <div class="row g-4">
        <div class="col-12 col-md-6 job_post_thumb" id="job_post_thumb_1">
          <div class="job-card">
            <h3 class="whitecard-heading">Staff Full Stack Engineer</h3>
            <p class="job-subtitle">India, Hyderabad (Hybrid + Remote)</p>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Work Experience:</strong>
              8+ Years
            </div>
            <div class="mb-3 card-text-medium">
              <strong class="job-subtitle">Qualifications:</strong>
              Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.
            </div>
            <div class="my-4">
              <strong class="job-subtitle">Job Description:</strong>
              <p class="card-text-medium">
                Full Stack Architecture: Define the communication protocols and data contracts between the Java backend and the TypeScript frontend.
              </p>
            </div>
            <a href="https://nexturn.com/job/staff-full-stack-engineer/" class="job-apply-btn mb-4">Apply</a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const javaLinuxAdminDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Java &amp; Linux Admin - NexTurn</title>
    <link rel="canonical" href="https://nexturn.com/job/java-linux-admin/" />
    <meta property="og:site_name" content="NexTurn" />
  </head>
  <body>
    <a href="https://nexturn.com/careers/">Back to Career</a>
    <h1>Java &amp; Linux Admin</h1>
    <p>Location: India, Remote</p>
    <p>Work Experience: 5+ Years</p>
    <p>Requirements: Build and support enterprise Java applications, Linux environments, and cloud automation.</p>
    <p>Qualifications: Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.</p>
    <p>Job Description: Develop and maintain enterprise Java and Linux administration workflows for secure cloud operations.</p>
    <a href="#application-form">Apply</a>
    <section>Job Application Form</section>
  </body>
</html>
`

const verifiedAug32026DetailHtml = `
<!doctype html>
<html lang=en-US>
  <head>
    <title>Staff Full Stack Engineer - NexTurn</title>
    <link rel=canonical href=https://nexturn.com/job/staff-full-stack-engineer/ >
    <meta property="og:site_name" content="NexTurn">
    <meta property="og:url" content="https://nexturn.com/job/staff-full-stack-engineer/">
  </head>
  <body>
    <h1>Like Minded People Work Together</h1>
    <a href=https://nexturn.com/careers class=back-link><span class=icon>←</span> Back to Career</a>
    <h1 class="section-title">Staff Full Stack Engineer</h1>
    <h3 class="job-subtitle location mt-4">Location:
      India, Hyderabad (Hybrid + Remote)<h3>
    <p class="innersec-white-medium mt-4">
      <strong class="job-subtitle text-white">Work
        Experience:</strong>
      8+ Years
    </p>
    <h2 class="job-subtitle text-white mt-4">Requirements:</h2>
    <ul>
      <li>Experience: Hands-on engineering experience with a track record of leading full stack projects in an enterprise environment.</li>
      <li>Mastery: Deep, under-the-hood knowledge of Java, React, and TypeScript.</li>
    </ul>
    <p class="innersec-white-medium mt-4">
      <strong class="job-subtitle text-white ">Qualifications:
      </strong>
      Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.
    </p>
    <p><strong class="job-subtitle text-white ">Job Description:</strong></p>
    <ul>
      <li>Full Stack Architecture: Define the communication protocols and data contracts between the Java backend and the TypeScript frontend to ensure seamless data flow.</li>
      <li>Platform Evolution: Lead the transition toward a unified, framework-agnostic UI strategy using Web Components.</li>
    </ul>
    <a href="#application-form">Apply</a>
    <section>Job Application Form</section>
  </body>
</html>
`

const sapConsultantDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>SAP Techno-Functional Consultant - NexTurn</title>
    <link rel="canonical" href="https://nexturn.com/job/sap-techno-functional-consultant/" />
    <meta property="og:site_name" content="NexTurn" />
  </head>
  <body>
    <a href="https://nexturn.com/careers/">Back to Career</a>
    <h1>SAP Techno-Functional Consultant</h1>
    <p>Location: Hyderabad (Hybrid)</p>
    <p>Work Experience: 5+ Years</p>
    <p>Requirements: Partner with customer stakeholders to scope and deliver SAP integration use cases.</p>
    <p>Qualifications: Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.</p>
    <p>Job Description: Drive SAP integration delivery across finance and supply chain programs.</p>
    <a href="#application-form">Apply</a>
    <section>Job Application Form</section>
  </body>
</html>
`

const usBusinessAnalystDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Salesforce Business Analyst - NexTurn</title>
    <link rel="canonical" href="https://nexturn.com/job/salesforce-business-analyst/" />
    <meta property="og:site_name" content="NexTurn" />
  </head>
  <body>
    <a href="https://nexturn.com/careers/">Back to Career</a>
    <h1>Salesforce Business Analyst</h1>
    <p>Location: USA, King of Prussia, PA (Hybrid)</p>
    <p>Work Experience: 12+ Years</p>
    <p>Requirements: Collaborate with US-based stakeholders to define Salesforce delivery programs.</p>
    <p>Qualifications: Bachelor's degree in Computer Science, Engineering, Information Systems, or a related field.</p>
    <p>Job Description: Gather requirements and deliver business analysis for Salesforce programs.</p>
    <a href="#application-form">Apply</a>
    <section>Job Application Form</section>
  </body>
</html>
`

const loadNexTurnModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected NexTurn scraper module at ./script.js')
  }
}

test('NexTurn helpers validate the official homepage, careers shell, job cards, and detail pages', async () => {
  const nexturn = await loadNexTurnModule()

  assert.equal(nexturn.SOURCE, 'nexturn')
  assert.equal(nexturn.COMPANY, 'NexTurn')
  assert.equal(nexturn.HOMEPAGE_URL, 'https://nexturn.com/')
  assert.equal(nexturn.CAREERS_URL, 'https://nexturn.com/careers/')
  assert.equal(nexturn.VERIFIED_ON, '2026-10-03')
  assert.equal(nexturn.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(nexturn.hasOfficialHomepageSignal('<html><title>Placeholder</title></html>'), false)
  assert.equal(nexturn.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(nexturn.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(nexturn.hasOfficialJobDetailSignal(javaLinuxAdminDetailHtml), true)
  assert.equal(nexturn.hasOfficialJobDetailSignal('<html><body><h1>Placeholder</h1></body></html>'), false)

  assert.deepEqual(
    nexturn.extractJobCards(officialCareersHtml).map((job) => ({
      title: job.title,
      location: job.location,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Java & Linux Admin',
        location: 'India, Remote',
        experienceRequired: '5+ Years',
        minimumQualification: "Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.",
        sourceUrl: 'https://nexturn.com/job/java-linux-admin/',
      },
      {
        title: 'SAP Techno-Functional Consultant',
        location: 'Hyderabad (Hybrid)',
        experienceRequired: '5+ Years',
        minimumQualification: "Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.",
        sourceUrl: 'https://nexturn.com/job/sap-techno-functional-consultant/',
      },
      {
        title: 'Salesforce Business Analyst',
        location: 'USA, King of Prussia, PA (Hybrid)',
        experienceRequired: '12+ Years',
        minimumQualification: "Bachelor's degree in Computer Science, Engineering, Information Systems, or a related field.",
        sourceUrl: 'https://nexturn.com/job/salesforce-business-analyst/',
      },
    ],
  )

  assert.deepEqual(
    nexturn.extractJobDetail(
      sapConsultantDetailHtml,
      'https://nexturn.com/job/sap-techno-functional-consultant/',
    ),
    {
      title: 'SAP Techno-Functional Consultant',
      location: 'Hyderabad (Hybrid)',
      city: 'Hyderabad',
      experienceRequired: '5+ Years',
      requirements: 'Partner with customer stakeholders to scope and deliver SAP integration use cases.',
      minimumQualification: "Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.",
      jobDescription: 'Drive SAP integration delivery across finance and supply chain programs.',
      sourceUrl: 'https://nexturn.com/job/sap-techno-functional-consultant/',
      applyUrl: 'https://nexturn.com/job/sap-techno-functional-consultant/',
    },
  )
})

test('NexTurn accepts its known origin canonical only for the matching official job path', async () => {
  const nexturn = await loadNexTurnModule()
  const sourceUrl = 'https://nexturn.com/job/java-linux-admin/'
  for (const origin of [
    'ec2-65-0-158-166.ap-south-1.compute.amazonaws.com',
    '3.7.208.225',
    '13.202.106.64',
  ]) {
    const html = javaLinuxAdminDetailHtml.replace(sourceUrl, `https://${origin}/job/java-linux-admin/`)
    assert.equal(nexturn.hasOfficialJobDetailSignal(html, sourceUrl), true)
    assert.equal(nexturn.hasOfficialJobDetailSignal(html, 'https://nexturn.com/job/another-role/'), false)
  }
  const unrelated = javaLinuxAdminDetailHtml.replace(sourceUrl, 'https://unrelated.example/job/java-linux-admin/')
  assert.equal(nexturn.hasOfficialJobDetailSignal(unrelated, sourceUrl), false)
})

test('NexTurn run validates the official surfaces, fetches same-domain India detail pages, and skips explicit US jobs', async () => {
  const nexturn = await loadNexTurnModule()
  const requestedUrls = []

  const jobs = await nexturn.createNexTurnScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nexturn.HOMEPAGE_URL) return officialHomepageHtml
      if (url === nexturn.CAREERS_URL) return officialCareersHtml
      if (url === 'https://nexturn.com/job/java-linux-admin/') return javaLinuxAdminDetailHtml
      if (url === 'https://nexturn.com/job/sap-techno-functional-consultant/') {
        return sapConsultantDetailHtml
      }
      if (url === 'https://nexturn.com/job/salesforce-business-analyst/') {
        return usBusinessAnalystDetailHtml
      }

      throw new Error(`Unexpected NexTurn URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://nexturn.com/',
    'https://nexturn.com/careers/',
    'https://nexturn.com/job/java-linux-admin/',
    'https://nexturn.com/job/sap-techno-functional-consultant/',
  ])

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      minimumQualification: job.minimumQualification,
      experienceRequired: job.experienceRequired,
    })),
    [
      {
        title: 'Java & Linux Admin',
        location: 'India, Remote',
        city: 'Remote',
        sourceUrl: 'https://nexturn.com/job/java-linux-admin/',
        applyUrl: 'https://nexturn.com/job/java-linux-admin/',
        jobId: 'nexturn-java-linux-admin',
        requisitionId: 'nexturn-java-linux-admin',
        minimumQualification: "Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.",
        experienceRequired: '5+ Years',
      },
      {
        title: 'SAP Techno-Functional Consultant',
        location: 'Hyderabad (Hybrid)',
        city: 'Hyderabad',
        sourceUrl: 'https://nexturn.com/job/sap-techno-functional-consultant/',
        applyUrl: 'https://nexturn.com/job/sap-techno-functional-consultant/',
        jobId: 'nexturn-sap-techno-functional-consultant',
        requisitionId: 'nexturn-sap-techno-functional-consultant',
        minimumQualification: "Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.",
        experienceRequired: '5+ Years',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Build and support enterprise Java applications/i)
  assert.match(jobs[1].jobDescription, /Drive SAP integration delivery/i)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('NexTurn returns an honest zero-job result when the verified public careers surface has no India roles', async () => {
  const nexturn = await loadNexTurnModule()
  const requestedUrls = []

  const jobs = await nexturn.createNexTurnScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nexturn.HOMEPAGE_URL) return officialHomepageHtml
      if (url === nexturn.CAREERS_URL) return officialCareersUsOnlyHtml
      if (url === 'https://nexturn.com/job/salesforce-business-analyst/') {
        return usBusinessAnalystDetailHtml
      }

      throw new Error(`Unexpected NexTurn URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://nexturn.com/',
    'https://nexturn.com/careers/',
  ])
  assert.deepEqual(jobs, [])
})

test('NexTurn fails closed when the homepage, careers page, or job detail surface changes', async () => {
  const nexturn = await loadNexTurnModule()

  await assert.rejects(
    nexturn.createNexTurnScraper().run({
      fetchText: async (url) =>
        url === nexturn.HOMEPAGE_URL
          ? '<html><title>Unexpected homepage</title></html>'
          : officialCareersHtml,
    }),
    /NexTurn official homepage changed/i,
  )

  await assert.rejects(
    nexturn.createNexTurnScraper().run({
      fetchText: async (url) => {
        if (url === nexturn.HOMEPAGE_URL) return officialHomepageHtml
        return '<html><body><h1>Careers</h1></body></html>'
      },
    }),
    /NexTurn official careers surface changed/i,
  )

  await assert.rejects(
    nexturn.createNexTurnScraper().run({
      fetchText: async (url) => {
        if (url === nexturn.HOMEPAGE_URL) return officialHomepageHtml
        if (url === nexturn.CAREERS_URL) return officialCareersHtml
        return '<html><body><h1>Java & Linux Admin</h1></body></html>'
      },
    }),
    /NexTurn official job detail surface changed/i,
  )
})

test('NexTurn accepts the verified Friday, August 7, 2026 homepage canonical drift', async () => {
  const nexturn = await loadNexTurnModule()

  assert.equal(nexturn.hasOfficialHomepageSignal(verifiedAug32026HomepageHtml), true)
  assert.equal(nexturn.hasOfficialHomepageSignal(verifiedAug72026HomepageHtml), true)
  assert.equal(nexturn.hasOfficialCareersSignal(verifiedAug32026CareersHtml), true)
  assert.equal(nexturn.hasOfficialJobDetailSignal(verifiedAug32026DetailHtml), true)

  const jobs = await nexturn.createNexTurnScraper().run({
    fetchText: async (url) => {
      if (url === nexturn.HOMEPAGE_URL) return verifiedAug72026HomepageHtml
      if (url === nexturn.CAREERS_URL) return verifiedAug32026CareersHtml
      if (url === 'https://nexturn.com/job/staff-full-stack-engineer/') {
        return verifiedAug32026DetailHtml
      }

      throw new Error(`Unexpected NexTurn URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 1)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      sourceUrl: job.sourceUrl,
    })),
    [
      {
        title: 'Staff Full Stack Engineer',
        location: 'India, Hyderabad (Hybrid + Remote)',
        city: 'Hyderabad',
        experienceRequired: '8+ Years',
        minimumQualification: "Bachelor's or Master's degree in Computer Science, Information Technology, or a related field.",
        sourceUrl: 'https://nexturn.com/job/staff-full-stack-engineer/',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Platform Evolution/i)
})
