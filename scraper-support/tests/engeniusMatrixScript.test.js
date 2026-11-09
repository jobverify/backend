import assert from 'node:assert/strict'
import test from 'node:test'

const loadEnGeniusMatrixModule = async () => {
  try {
    return await import('../../scraper/engeniusmatrix/script.js')
  } catch {
    assert.fail('Expected EnGenius Matrix scraper module at ../../scraper/engeniusmatrix/script.js')
  }
}

const homepageHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Home - Engenius Matrix</title>
  </head>
  <body>
    <nav>
      <a href="https://www.engeniusmatrix.com/about-us">About</a>
      <a href="https://www.engeniusmatrix.com/careers">Careers</a>
    </nav>
    <h1>Engineering Precision</h1>
    <p>At EnGenius Matrix, we deliver innovative, cost-efficient solutions.</p>
    <p>debarpan@engeniusmatrix.com | shubhashish@engeniusmatrix.com</p>
  </body>
</html>
`

const careersHtml = `
<!DOCTYPE html>
<html lang="en-US">
  <head>
    <title>Careers - Engenius Matrix</title>
  </head>
  <body>
    <section class="careerListing">
      <div class="heroTopText">
        <h1><span>Brilliant minds</span><br />Discovered here</h1>
        <p>Join EnGenius Matrix and shape the future!</p>
      </div>
      <div id="jobsCategory" class="filterWrapper fade-in">
        <h6 class="active" data-id="">View all</h6>
        <h6 data-id="16">Customer success</h6>
        <h6 data-id="18">Marketing</h6>
      </div>
    </section>
  </body>
</html>
`

const listingsPayload = [
  {
    id: 1102,
    date_gmt: '2025-04-23T13:41:27',
    link: 'https://www.engeniusmatrix.com/job/executive-office-assistant-to-the-director/',
    title: {
      rendered: 'Executive Office Assistant to the Director',
    },
    'job-category': [16],
  },
  {
    id: 714,
    date_gmt: '2025-04-11T19:26:06',
    link: 'https://www.engeniusmatrix.com/job/drafting-engineer/',
    title: {
      rendered: 'Drafting Engineer',
    },
    'job-category': [18],
  },
]

const executiveOfficeAssistantDetail = {
  id: 1102,
  link: 'https://www.engeniusmatrix.com/job/executive-office-assistant-to-the-director/',
  title: {
    rendered: 'Executive Office Assistant to the Director',
  },
  content: {
    rendered: `
      <div class="detailsBox fade-in">
        <h4>Description</h4>
        <div><p>Engenius Matrix Pvt Ltd is seeking a dynamic and highly organized Executive Office Assistant to support the Director in managing day-to-day operations and strategic initiatives. Based in Bangalore, this pivotal role requires a proactive individual with exceptional multitasking abilities, discretion, and a commitment to excellence.</p></div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Role of the Executive Office Assistant</h4>
        <div><p>The Executive Office Assistant will act as a critical partner to the Director, ensuring smooth execution of tasks, coordination among teams, and efficient handling of administrative and strategic responsibilities.</p></div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Basic Qualifications</h4>
        <div>
          <p>Minimum of 3 years of experience in an executive assistant or similar role.</p>
          <p>Excellent organizational and communication skills.</p>
          <p>Ability to manage competing priorities with discretion.</p>
        </div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Preferred Qualifications</h4>
        <div><p>Previous experience supporting C-suite executives.</p></div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Closing Note</h4>
        <div><p>At Engenius Matrix Pvt Ltd, you are becoming part of a mission to redefine engineering excellence.</p></div>
      </div>
      <div class="application-form fade-in" id="applicationForm">
        <div class="wpcf7 no-js" id="wpcf7-f744-o1">
          <form action="/job/executive-office-assistant-to-the-director/#wpcf7-f744-o1" method="post" enctype="multipart/form-data">
            <input class="wpcf7-submit" type="submit" value="Apply now" />
          </form>
        </div>
      </div>
    `,
  },
}

const draftingEngineerDetail = {
  id: 714,
  link: 'https://www.engeniusmatrix.com/job/drafting-engineer/',
  title: {
    rendered: 'Drafting Engineer',
  },
  content: {
    rendered: `
      <div class="detailsBox fade-in">
        <h4>Description</h4>
        <div><p>Engenius Matrix Pvt Ltd is looking for a skilled and detail-oriented Drafting Engineer to join our dynamic team. Based in Bangalore, India, the ideal candidate will have a strong grasp of industrial processes and be proficient in advanced drafting tools such as AutoCAD, 3D Design, BIM Model, and Solid Works.</p></div>
      </div>
      <div class="detailsBox fade-in">
        <h4>About the Role</h4>
        <div><p>The Drafting Engineer will play a key role in designing and developing technical drawings for industrial projects, ensuring precision, compliance, and alignment with project goals.</p></div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Key Job Responsibilities</h4>
        <div>
          <p>Prepare detailed 2D and 3D drawings using AutoCAD, BIM Model, Solid Works, and other drafting tools.</p>
          <p>Collaborate with design teams to translate conceptual designs into detailed engineering drawings.</p>
        </div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Basic Qualifications</h4>
        <div>
          <p>Bachelor's degree or diploma in Mechanical, Civil, or related engineering fields.</p>
          <p>Minimum of 3 years of experience in industrial drafting or design.</p>
          <p>Proficiency in AutoCAD, 3D Design, BIM Modeling, and Solidworks.</p>
        </div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Preferred Qualifications</h4>
        <div><p>Experience working on industrial projects such as Pharma, FMCG, or Green Buildings.</p></div>
      </div>
      <div class="detailsBox fade-in">
        <h4>Closing Note</h4>
        <div><p>Let us build something extraordinary together!</p></div>
      </div>
      <div class="application-form fade-in" id="applicationForm">
        <div class="wpcf7 no-js" id="wpcf7-f744-o1">
          <form action="/job/drafting-engineer/#wpcf7-f744-o1" method="post" enctype="multipart/form-data">
            <input class="wpcf7-submit" type="submit" value="Apply now" />
          </form>
        </div>
      </div>
    `,
  },
}

test('EnGenius Matrix helpers stay pinned to the verified homepage, careers page, and WordPress jobs API contract', async () => {
  const engeniusMatrix = await loadEnGeniusMatrixModule()

  assert.equal(engeniusMatrix.SOURCE, 'engeniusmatrix')
  assert.equal(engeniusMatrix.COMPANY, 'EnGenius Matrix')
  assert.equal(engeniusMatrix.HOME_URL, 'https://www.engeniusmatrix.com/')
  assert.equal(engeniusMatrix.CAREERS_URL, 'https://www.engeniusmatrix.com/careers/')
  assert.equal(engeniusMatrix.JOBS_API_URL, 'https://www.engeniusmatrix.com/wp-json/wp/v2/job')
  assert.equal(
    engeniusMatrix.buildListingsApiUrl(),
    'https://www.engeniusmatrix.com/wp-json/wp/v2/job?_fields=id%2Cdate_gmt%2Clink%2Ctitle%2Cjob-category&per_page=100&page=1',
  )
  assert.equal(
    engeniusMatrix.buildJobDetailApiUrl(714),
    'https://www.engeniusmatrix.com/wp-json/wp/v2/job/714?_fields=id%2Clink%2Ctitle%2Ccontent',
  )
  assert.equal(engeniusMatrix.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(engeniusMatrix.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(engeniusMatrix.isOfficialListingsPayload(listingsPayload), true)
  assert.deepEqual(
    engeniusMatrix.extractJobFromApiRecord(listingsPayload[1], draftingEngineerDetail),
    {
      title: 'Drafting Engineer',
      company: 'EnGenius Matrix',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '714',
      requisitionId: '714',
      sourceUrl: 'https://www.engeniusmatrix.com/job/drafting-engineer/',
      applyUrl: 'https://www.engeniusmatrix.com/job/drafting-engineer/#applicationForm',
      employmentType: null,
      experienceRequired: 'Minimum of 3 years of experience in industrial drafting or design.',
      minimumQualification: "Bachelor's degree or diploma in Mechanical, Civil, or related engineering fields. Minimum of 3 years of experience in industrial drafting or design. Proficiency in AutoCAD, 3D Design, BIM Modeling, and Solidworks.",
      preferredQualification: 'Experience working on industrial projects such as Pharma, FMCG, or Green Buildings.',
      requiredSkills: [
        "Bachelor's degree or diploma in Mechanical, Civil, or related engineering fields.",
        'Minimum of 3 years of experience in industrial drafting or design.',
        'Proficiency in AutoCAD, 3D Design, BIM Modeling, and Solidworks.',
      ],
      postingDate: '2025-04-11T19:26:06.000Z',
      closingDate: null,
      jobDescription: [
        'Description: Engenius Matrix Pvt Ltd is looking for a skilled and detail-oriented Drafting Engineer to join our dynamic team. Based in Bangalore, India, the ideal candidate will have a strong grasp of industrial processes and be proficient in advanced drafting tools such as AutoCAD, 3D Design, BIM Model, and Solid Works.',
        'About the Role: The Drafting Engineer will play a key role in designing and developing technical drawings for industrial projects, ensuring precision, compliance, and alignment with project goals.',
        'Key Job Responsibilities: Prepare detailed 2D and 3D drawings using AutoCAD, BIM Model, Solid Works, and other drafting tools. Collaborate with design teams to translate conceptual designs into detailed engineering drawings.',
        "Basic Qualifications: Bachelor's degree or diploma in Mechanical, Civil, or related engineering fields. Minimum of 3 years of experience in industrial drafting or design. Proficiency in AutoCAD, 3D Design, BIM Modeling, and Solidworks.",
        'Preferred Qualifications: Experience working on industrial projects such as Pharma, FMCG, or Green Buildings.',
        'Closing Note: Let us build something extraordinary together!',
      ].join('\n\n'),
      remoteStatus: 'On-site',
    },
  )
})

test('run validates the verified EnGenius Matrix surfaces, fetches the WordPress jobs API, and decorates job records', async () => {
  const engeniusMatrix = await loadEnGeniusMatrixModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await engeniusMatrix.createEnGeniusMatrixScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === engeniusMatrix.HOME_URL) return homepageHtml
      if (url === engeniusMatrix.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected HTML URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      if (url === engeniusMatrix.buildListingsApiUrl()) return listingsPayload
      if (url === engeniusMatrix.buildJobDetailApiUrl(1102)) return executiveOfficeAssistantDetail
      if (url === engeniusMatrix.buildJobDetailApiUrl(714)) return draftingEngineerDetail
      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    engeniusMatrix.HOME_URL,
    engeniusMatrix.CAREERS_URL,
  ])
  assert.deepEqual(requestedJsonUrls, [
    engeniusMatrix.buildListingsApiUrl(),
    engeniusMatrix.buildJobDetailApiUrl(1102),
    engeniusMatrix.buildJobDetailApiUrl(714),
  ])
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      country: job.country,
      jobId: job.jobId,
      link: job.link,
      applyUrl: job.applyUrl,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Executive Office Assistant to the Director',
        source: 'engeniusmatrix',
        country: 'India',
        jobId: '1102',
        link: 'https://www.engeniusmatrix.com/job/executive-office-assistant-to-the-director/#applicationForm',
        applyUrl: 'https://www.engeniusmatrix.com/job/executive-office-assistant-to-the-director/#applicationForm',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
      {
        title: 'Drafting Engineer',
        source: 'engeniusmatrix',
        country: 'India',
        jobId: '714',
        link: 'https://www.engeniusmatrix.com/job/drafting-engineer/#applicationForm',
        applyUrl: 'https://www.engeniusmatrix.com/job/drafting-engineer/#applicationForm',
        scrapedAt: '2026-07-11T00:00:00.000Z',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /support the Director/i)
  assert.match(jobs[1].jobDescription, /Drafting Engineer/i)
})

test('run fails closed when the verified EnGenius Matrix homepage, careers page, jobs API, or job detail record changes materially', async () => {
  const engeniusMatrix = await loadEnGeniusMatrixModule()

  await assert.rejects(
    engeniusMatrix.createEnGeniusMatrixScraper().run({
      fetchText: async (url) => {
        if (url === engeniusMatrix.HOME_URL) return '<html><body><h1>Unexpected</h1></body></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => listingsPayload,
    }),
    /verified official EnGenius Matrix homepage/i,
  )

  await assert.rejects(
    engeniusMatrix.createEnGeniusMatrixScraper().run({
      fetchText: async (url) => {
        if (url === engeniusMatrix.HOME_URL) return homepageHtml
        if (url === engeniusMatrix.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => listingsPayload,
    }),
    /verified official EnGenius Matrix careers page/i,
  )

  await assert.rejects(
    engeniusMatrix.createEnGeniusMatrixScraper().run({
      fetchText: async (url) => {
        if (url === engeniusMatrix.HOME_URL) return homepageHtml
        if (url === engeniusMatrix.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async () => ({ total: 2 }),
    }),
    /verified EnGenius Matrix jobs API/i,
  )

  await assert.rejects(
    engeniusMatrix.createEnGeniusMatrixScraper().run({
      fetchText: async (url) => {
        if (url === engeniusMatrix.HOME_URL) return homepageHtml
        if (url === engeniusMatrix.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected HTML URL: ${url}`)
      },
      fetchJson: async (url) => {
        if (url === engeniusMatrix.buildListingsApiUrl()) return listingsPayload.slice(0, 1)
        if (url === engeniusMatrix.buildJobDetailApiUrl(1102)) {
          return {
            ...executiveOfficeAssistantDetail,
            content: { rendered: '<div><p>Broken detail</p></div>' },
          }
        }
        throw new Error(`Unexpected JSON URL: ${url}`)
      },
    }),
    /verified EnGenius Matrix job detail record/i,
  )
})
