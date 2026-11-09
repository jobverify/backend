import assert from 'node:assert/strict'
import test from 'node:test'

const loadHhvAdvancedTechnologiesModule = async () => {
  try {
    return await import('../../scraper/hhvadvancedtechnologies/script.js')
  } catch {
    assert.fail('Expected HHV Advanced Technologies scraper module at ../../scraper/hhvadvancedtechnologies/script.js')
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Optical Component Manufacturer | Thin Film Technology</title>
      <meta property="og:title" content="HHV Advanced Technologies" />
    </head>
    <body>
      <nav>
        <a href="/careers">Careers</a>
      </nav>
    </body>
  </html>
`

const careersPageHtml = `
  <html>
    <head>
      <title>Careers - HHV Advanced Tech</title>
      <meta property="og:url" content="https://hhvadvancedtech.com/careers" />
    </head>
    <body>
      <a href="/careers#current-openings">Current Openings</a>
      <a href="/careers#internship">Internship Program</a>
      <p>The following are the current openings at HHV Advanced Technologies.</p>

      <div class="accordion_2kN" data-accordion-item="0">
        <div class="accordion__header_27Z">
          <h3 class="accordion__heading_2zT">
            <span class="w-text-block"><span class="w-text-content">Customer Support - Engineer (Thin Film Equipment)</span></span>
          </h3>
        </div>
        <div class="accordion__content_Y1_" data-accordion-content="0">
          <div data-accordion-inner="true">
            <h3 class="text_1L- ui-text w-body">
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Department: </span>Customer Support</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Location: </span>Chennai &amp; Mumbai</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Number of Positions:</span> 2</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Education Qualification: </span>Diploma / BE or B.Tech - Mechanical</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Years of Experience: </span>4-5 Years in SPM Machine assembly.</span></span>
              <br>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Job Description:</span></span></span>
              <span class="w-text-block"><span class="w-text-content">● Install and test equipment to ensure it runs smoothly</span></span>
              <span class="w-text-block"><span class="w-text-content">● Troubleshoot customer issues and provide solutions in tandem with the sales team</span></span>
              <span class="w-text-block"><span class="w-text-content"><a href="https://hhvadvancedtech.com/apply-now?post=Customer%20Support%20-%20Engineer%20(Thin%20Film%20Equipment)">APPLY NOW</a></span></span>
            </h3>
          </div>
        </div>
      </div>

      <div class="accordion_2kN" data-accordion-item="1">
        <div class="accordion__header_27Z">
          <h3 class="accordion__heading_2zT">
            <span class="w-text-block"><span class="w-text-content">Graduate Engineer Trainee – Mechanical/Electrical (Thin Film Equipment)</span></span>
          </h3>
        </div>
        <div class="accordion__content_Y1_" data-accordion-content="1">
          <div data-accordion-inner="true">
            <h3 class="text_1L- ui-text w-body">
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Department: </span>Based on performance, knowledge, and individual interest, the trainee will be allocated to a suitable department</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Location: </span>Dabaspet, Bangalore</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Number of Positions:</span> 6</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Education Qualification: </span>BE/ Diploma - Mechanical</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Years of Experience: </span>Freshers or 1-2 years</span></span>
              <br>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Job Description:</span></span></span>
              <span class="w-text-block"><span class="w-text-content">● Undergo training in multiple departments such as Production, Quality, Maintenance, Design, Planning and Supply Chain</span></span>
              <span class="w-text-block"><span class="w-text-content">● Assist Senior engineers in daily operational activities</span></span>
              <span class="w-text-block"><span class="w-text-content"><span style="font-weight:bold">Key Skills &amp; Competencies</span></span></span>
              <span class="w-text-block"><span class="w-text-content">● Strong communication and teamwork skills</span></span>
              <span class="w-text-block"><span class="w-text-content"><a href="https://hhvadvancedtech.com/apply-now?post=Graduate%20Engineer%20Trainee%20%E2%80%93%20Mechanical/Electrical%20(Thin%20Film%20Equipment)">APPLY NOW</a></span></span>
            </h3>
          </div>
        </div>
      </div>
    </body>
  </html>
`

test('HHV Advanced Technologies constants stay pinned to the verified first-party homepage and careers page', async () => {
  const hhv = await loadHhvAdvancedTechnologiesModule()

  assert.equal(hhv.SOURCE, 'hhvadvancedtechnologies')
  assert.equal(hhv.COMPANY, 'HHV Advanced Technologies')
  assert.equal(hhv.HOMEPAGE_URL, 'https://hhvadvancedtech.com/')
  assert.equal(hhv.CAREERS_URL, 'https://hhvadvancedtech.com/careers')
  assert.equal(hhv.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hhv.hasOfficialCareersSignal(careersPageHtml), true)
})

test('extractJobsFromCareersPage parses HHV Advanced Technologies accordion openings from the first-party careers HTML', async () => {
  const hhv = await loadHhvAdvancedTechnologiesModule()

  assert.deepEqual(hhv.extractJobsFromCareersPage(careersPageHtml), [
    {
      title: 'Customer Support - Engineer (Thin Film Equipment)',
      company: 'HHV Advanced Technologies',
      department: 'Customer Support',
      location: 'Chennai & Mumbai',
      city: null,
      state: null,
      country: 'India',
      jobId: 'customer-support-engineer-thin-film-equipment',
      requisitionId: 'customer-support-engineer-thin-film-equipment',
      sourceUrl: 'https://hhvadvancedtech.com/careers',
      applyUrl: 'https://hhvadvancedtech.com/apply-now?post=Customer%20Support%20-%20Engineer%20(Thin%20Film%20Equipment)',
      employmentType: null,
      experienceRequired: '4-5 Years in SPM Machine assembly.',
      minimumQualification: 'Diploma / BE or B.Tech - Mechanical',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Install and test equipment to ensure it runs smoothly Troubleshoot customer issues and provide solutions in tandem with the sales team',
      remoteStatus: 'On-site',
    },
    {
      title: 'Graduate Engineer Trainee - Mechanical/Electrical (Thin Film Equipment)',
      company: 'HHV Advanced Technologies',
      department:
        'Based on performance, knowledge, and individual interest, the trainee will be allocated to a suitable department',
      location: 'Dabaspet, Bangalore',
      city: 'Dabaspet',
      state: null,
      country: 'India',
      jobId: 'graduate-engineer-trainee-mechanical-electrical-thin-film-equipment',
      requisitionId: 'graduate-engineer-trainee-mechanical-electrical-thin-film-equipment',
      sourceUrl: 'https://hhvadvancedtech.com/careers',
      applyUrl:
        'https://hhvadvancedtech.com/apply-now?post=Graduate%20Engineer%20Trainee%20%E2%80%93%20Mechanical/Electrical%20(Thin%20Film%20Equipment)',
      employmentType: null,
      experienceRequired: 'Freshers or 1-2 years',
      minimumQualification: 'BE/ Diploma - Mechanical',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Undergo training in multiple departments such as Production, Quality, Maintenance, Design, Planning and Supply Chain Assist Senior engineers in daily operational activities Key Skills & Competencies Strong communication and teamwork skills',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the official HHV homepage handoff and decorates first-party openings from the careers page', async () => {
  const hhv = await loadHhvAdvancedTechnologiesModule()
  const requestedUrls = []

  const jobs = await hhv.createHhvAdvancedTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === hhv.HOMEPAGE_URL) return homepageHtml
      if (url === hhv.CAREERS_URL) return careersPageHtml
      throw new Error(`Unexpected HHV URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://hhvadvancedtech.com/',
    'https://hhvadvancedtech.com/careers',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'hhvadvancedtechnologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
  assert.equal(jobs[1].jobId, 'graduate-engineer-trainee-mechanical-electrical-thin-film-equipment')
})
