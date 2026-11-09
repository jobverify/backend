import assert from 'node:assert/strict'
import test from 'node:test'

const loadClumioModule = async () => {
  try {
    return await import('../../scraper/clumio/script.js')
  } catch {
    assert.fail('Expected Clumio scraper module at ../../scraper/clumio/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Find a Career with Commvault</title>
  </head>
  <body>
    <h1>Find a career with Commvault</h1>
    <script type="text/javascript" id="greenhouseJS-js-before">
      const greenhouse_list = [
        {
          "job_id":"5116017008",
          "internal_job_id":4426060008,
          "requisition_id":"R0012682",
          "title":"Principal Engineer-Cloud Engineering",
          "job_profile_code":"DE1010",
          "hiring_type":"Full Time",
          "remote_position":"No",
          "location":"Seoul, South Korea",
          "country":"Korea, Republic Of",
          "state":"Other",
          "department":"Engineering &amp; Product",
          "department_id":4029220008,
          "excerpt":"About the TeamThe Clumio Cloud Engineering team designs, builds, and operates the cloud infrastructure and foundational services that power Clumio&rsquo;s SaaS platform. The team&hellip;"
        },
        {
          "job_id":"5278390008",
          "internal_job_id":4496993008,
          "requisition_id":"R0013283",
          "title":"Deal Management Operations Associate",
          "job_profile_code":"BO1000",
          "hiring_type":"Full Time",
          "remote_position":"No",
          "location":"Bangalore, India",
          "country":"India",
          "state":"Karn\u0101taka",
          "department":"Finance",
          "department_id":4029189008,
          "excerpt":"The Opportunity - Deal Desk AssociateJob Title: Deal Desk Associate Experience: 2\u20134 Years Department: Deal Desk Work Schedule: Shift-Based."
        }
      ];
    </script>
    <div class="job-cards list">
      <a class="job-card__link" href="/careers/jobs/5116017008">Principal Engineer-Cloud Engineering</a>
      <a class="job-card__link" href="/careers/jobs/5278390008">Deal Management Operations Associate</a>
    </div>
  </body>
</html>
`

const clumioDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Principal Engineer-Cloud Engineering | Careers at Commvault</title>
    <meta
      name="description"
      content="About the TeamThe Clumio Cloud Engineering team designs, builds, and operates the cloud infrastructure and foundational services that power Clumio’s SaaS platform. The team…"
    />
  </head>
  <body>
    <div class="hero t-dark text-center pb-4xl pt-4xl">
      <h1 class="h1">Find a career with Commvault</h1>
    </div>
    <div class="entry__content">
      <div class="job__heading">
        <div class="job__meta mb-xl">
          <div class="tags">
            <span class="tag bg-color-grey-100">Engineering &amp; Product</span>
            <span class="tag bg-color-midnight-100">Full Time</span>
          </div>
        </div>
        <h1>Principal Engineer-Cloud Engineering</h1>
      </div>

      <div class="job__body">
        <div class="content-intro">
          <p><strong>Recruitment Fraud Alert</strong></p>
          <p>Ignore this block for the Clumio role description.</p>
        </div>
        <h2>About the Team</h2>
        <p>
          The Clumio Cloud Engineering team designs, builds, and operates the cloud
          infrastructure and foundational services that power Clumio’s SaaS platform.
        </p>
        <p>
          In this role, you remain deeply hands-on while guiding design decisions
          across infrastructure, automation, and production operations.
        </p>
        <h2>Basic Qualifications</h2>
        <ul>
          <li>8+ years of professional experience in software engineering or cloud infrastructure.</li>
          <li>Hands-on experience with infrastructure-as-code, Kubernetes, and CI/CD systems.</li>
          <li>Experience with public cloud platforms such as AWS, GCP, or Azure.</li>
        </ul>
        <h2>Preferred Qualifications</h2>
        <ul>
          <li>Experience serving as the senior technical owner for a platform team.</li>
          <li>Strong understanding of secure system design principles.</li>
        </ul>
        <p>#LI-Hybrid</p>
        <div class="content-conclusion">
          <p>Commvault is an equal opportunity workplace.</p>
        </div>
      </div>

      <a
        class="btn btn-primary mb-md"
        href="https://job-boards.greenhouse.io/commvault/jobs/5116017008#application-form"
      >
        Apply now
      </a>
    </div>
  </body>
</html>
`

const ampersandDetailHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Product Manager, AI &amp; Platform | Careers at Commvault</title>
  </head>
  <body>
    <div class="job__heading">
      <h1>Senior Product Manager, AI &amp; Platform</h1>
    </div>
    <div class="job__body">
      <h2>About the Team</h2>
      <p>Lead product strategy across AI and platform capabilities.</p>
      <div class="content-conclusion"></div>
    </div>
  </body>
</html>
`

test('Clumio pins the Commvault first-party careers route and keeps only excerpt-verified Clumio jobs', async () => {
  const clumio = await loadClumioModule()

  assert.equal(clumio.SOURCE, 'clumio')
  assert.equal(clumio.COMPANY, 'Clumio')
  assert.equal(clumio.CAREERS_URL, 'https://www.commvault.com/careers/jobs')
  assert.equal(
    clumio.buildJobDetailUrl('5116017008'),
    'https://www.commvault.com/careers/jobs/5116017008',
  )
  assert.equal(clumio.hasOfficialCareersSignal(officialCareersHtml), true)

  const greenhouseList = clumio.extractGreenhouseListPayload(officialCareersHtml)
  assert.equal(greenhouseList.length, 2)

  const jobs = clumio.extractClumioJobsFromGreenhouseList(greenhouseList, {
    scrapedAt: '2026-07-14T12:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Principal Engineer-Cloud Engineering',
      company: 'Clumio',
      location: 'Seoul, South Korea',
      city: 'Seoul',
      country: 'Korea, Republic Of',
      link: 'https://www.commvault.com/careers/jobs/5116017008',
      applyUrl: 'https://www.commvault.com/careers/jobs/5116017008',
      sourceUrl: 'https://www.commvault.com/careers/jobs/5116017008',
      source: 'clumio',
      jobId: '5116017008',
      requisitionId: 'R0012682',
      department: 'Engineering & Product',
      employmentType: 'Full Time',
      experienceRequired: null,
      jobDescription:
        'About the TeamThe Clumio Cloud Engineering team designs, builds, and operates the cloud infrastructure and foundational services that power Clumio’s SaaS platform. The team...',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      remoteStatus: 'On-site',
      scrapedAt: '2026-07-14T12:00:00.000Z',
    },
  ])
})

test('Clumio detail parsing enriches first-party Commvault listings during run()', async () => {
  const clumio = await loadClumioModule()

  const detail = clumio.extractDetailFields(clumioDetailHtml)
  assert.equal(detail.remoteStatus, 'Hybrid')
  assert.match(detail.jobDescription, /<h2>About the Team<\/h2>/)
  assert.match(detail.jobDescription, /Clumio Cloud Engineering team/i)
  assert.match(detail.minimumQualification, /8\+ years of professional experience/i)
  assert.match(detail.preferredQualification, /secure system design principles/i)

  const { replay, fixture } = await import('../native-sources/commvaultClumio/fixtureReplay.js')
  const r = replay(), jobs = await clumio.createClumioScraper().run(r.options)
  assert.equal(r.audits[0].observations.length, 61)
  assert.deepEqual(jobs.map(job => job.jobId), fixture.records.filter(row => row.brandQualified).map(row => row.id))
  assert.equal(jobs.length, 9)
  assert.ok(jobs.every(job => job.company === 'Commvault' && job.source === 'clumio'))
  assert.ok(jobs.some(job => job.country === 'South Korea'))
  assert.ok(jobs.some(job => job.jobId === '5137752008' && job.remoteStatus === 'Hybrid'))
  assert.equal(jobs[0].scrapedAt, '2026-10-31T19:00:00.000Z')
  await assert.rejects(clumio.createClumioScraper().run({ fetchText: r.options.fetchText }), /original HTTP/)

})

test('Clumio detail parsing decodes HTML entities in first-party job titles before title handoff validation', async () => {
  const clumio = await loadClumioModule()

  const detail = clumio.extractDetailFields(ampersandDetailHtml)
  assert.equal(detail.title, 'Senior Product Manager, AI & Platform')
})
