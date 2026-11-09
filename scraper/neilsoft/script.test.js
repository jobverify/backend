import assert from 'node:assert/strict'
import test from 'node:test'

const loadNeilsoftModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Neilsoft scraper module at ./script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Engineering Services &amp; Design |Neilsoft </title>
  </head>
  <body>
    <p>
      Neilsoft headquartered in Pune (India), is a 1400+ people global Engineering Services &amp; Solutions company.
    </p>
    <ul>
      <li><a href="/services" title="Services">Engineering Services</a></li>
      <li><a href="/careers" title="Careers">Careers</a></li>
    </ul>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title> Careers at Neilsoft | Explore Opportunities</title>
  </head>
  <body>
    <div class="careers-box1">
      <h2><a href="/careers/why-neilsoft"> Why Neilsoft ?</a></h2>
    </div>
    <div class="careers-box2">
      <h2><a href="/careers/employee-testimonials">Employee Testimonials</a></h2>
    </div>
    <div class="careers-box3">
      <h2><a href="/careers/current-job-openings-india">Current Job Openings-India</a></h2>
    </div>
  </body>
</html>
`

const indiaOpeningsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings in India | Neilsoft Careers</title>
  </head>
  <body>
    <h1>Current job openings India</h1>
    <p>
      A list of our current job openings is provided below. If your experience matches our current requirements,
      please email us your detailed resume at careers@neilsoft.com.
    </p>
    <h2>Buildings &amp; Infrastructure</h2>
    <div class="Currer ">
      <span class="pull-right vcenter"><a href="/careers/current-job-openings-india/designer-sr-designer"></a></span>
      <strong><a href="/careers/current-job-openings-india/designer-sr-designer">Designer / Sr. Designer</a></strong>
      <br/>
      Pune - Job code:
      <a href="mailto:careers@neilsoft.com?Subject=Designer / Sr. Designer code:Buildings-P-R">[Buildings - P-R]</a>
    </div>
    <div class="Currer ">
      <span class="pull-right vcenter">
        <a href="/careers/current-job-openings-india/water-resources-and-municipal-engineer"></a>
      </span>
      <strong>
        <a href="/careers/current-job-openings-india/water-resources-and-municipal-engineer">
          Water Resources and Municipal Engineer
        </a>
      </strong>
      <br/>
      Any/WFH - Job code:
      <a href="mailto:careers@neilsoft.com?Subject=Water Resources and Municipal Engineer code:Buildings-Water">
        [Buildings - Water Resources and Municipal Engineer]
      </a>
    </div>
    <h2>Software Engineering</h2>
    <div class="Currer ">
      <span class="pull-right vcenter"><a href="/careers/current-job-openings-india/cad-software-engineer"></a></span>
      <strong><a href="/careers/current-job-openings-india/cad-software-engineer">CAD Software Engineer</a></strong>
      <br/>
      Pune - Job code: [SES-0123-001]
    </div>
  </body>
</html>
`

const designerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Designer / Sr. Designer "/>
  </head>
  <body>
    <ul class="breadcrumb">
      <li><a href="/careers">Careers</a></li>
      <li><a href="/careers/current-job-openings-india">Current Job Openings-India</a></li>
      <li><span>Designer / Sr. Designer </span></li>
    </ul>
    <h1>Designer / Sr. Designer</h1>
    <p>
      <strong>Qualification:</strong> D.C.E. / I.T.I. (Civil)
    </p>
    <p><strong>Background &amp; Skills:</strong></p>
    <ul>
      <li>Must have hands on experience detailing Precast projects</li>
      <li>Candidate should have 2 to 10 years of experience</li>
      <li>US detailing experience will be preferred</li>
      <li>Must have good AutoCAD knowledge &amp; visualization skills</li>
    </ul>
    <p>
      Please send your resume to
      <a href="mailto:careers@neilsoft.com?Subject=Designer / Sr. Designer code:Buildings-P-R">careers@neilsoft.com</a>
      with the job code in the subject line.
    </p>
  </body>
</html>
`

const waterResourcesDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Water Resources and Municipal Engineer"/>
  </head>
  <body>
    <h1>Water Resources and Municipal Engineer</h1>
    <p>
      <strong>Qualification:</strong> B.E. / B.Tech (Civil)
    </p>
    <p><strong>Background &amp; Skills:</strong></p>
    <ul>
      <li>Candidate should have 5 to 12 years of experience</li>
      <li>Must have hands on experience in water resources engineering</li>
      <li>Experience working with municipal projects will be preferred</li>
    </ul>
    <p>
      Please send your resume to
      <a href="mailto:careers@neilsoft.com?Subject=Water Resources and Municipal Engineer code:Buildings-Water">
        careers@neilsoft.com
      </a>
      with the job code in the subject line.
    </p>
  </body>
</html>
`

const cadSoftwareEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="CAD Software Engineer"/>
  </head>
  <body>
    <h1>CAD Software Engineer</h1>
    <p>
      <strong>Qualification:</strong> B.E. / B.Tech (Mechanical / Production)
    </p>
    <p><strong>Background &amp; Skills:</strong></p>
    <ul>
      <li>Candidate should have 3 to 6 years of experience</li>
      <li>Must have strong C++, CAD customization, and debugging skills</li>
      <li>Knowledge of Creo or similar CAD platforms will be preferred</li>
    </ul>
    <p>
      Please send your resume to
      <a href="mailto:careers@neilsoft.com?Subject=CAD Software Engineer code:SES-0123-001">careers@neilsoft.com</a>
      with the job code in the subject line.
    </p>
  </body>
</html>
`

const rmgExecutiveDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <meta property="og:title" content="Sr. RMG Executive"/>
  </head>
  <body>
    <h1>Sr. RMG Executive</h1>
    <p><strong>Job Title:</strong> Senior Resource Management Executive, Resource Management Group (RMG)</p>
    <p><strong>Location:</strong> Pune</p>
    <p><strong>Experience:</strong> 6-10 Years, Minimum 4 years in Resource Management within an Engineering Services company</p>
    <h2>Key Responsibilities</h2>
    <ul class="listStyle">
      <li>Collaborate with Management, Delivery Teams, Practice Heads, IT, HR, Recruitment Team, Project Leaders, and Delivery Teams for resource management activities.</li>
      <li>Ensure effective resource planning, allocation, and optimal utilization across projects.</li>
    </ul>
    <h2>Required Qualifications</h2>
    <ul class="listStyle">
      <li>BE with MBA in Operations.</li>
      <li>Minimum 4 years of experience as a Resource Management Executive/Senior Resource Management Executive in an engineering services company.</li>
      <li>Overall industry experience of 6-10 years is preferred.</li>
    </ul>
    <h2>Required Skills</h2>
    <ul class="listStyle">
      <li>Strong resource planning, allocation, and capacity planning skills.</li>
      <li>Experience in utilization monitoring, billability tracking, and workforce planning.</li>
    </ul>
    <p>Please send your resume to <a href="mailto:careers@neilsoft.com">careers@neilsoft.com</a> with the job code in the subject line.</p>
  </body>
</html>
`

test('Neilsoft verifies the official homepage, careers landing page, India openings page, and detail page contracts', async () => {
  const neilsoft = await loadNeilsoftModule()

  assert.equal(neilsoft.SOURCE, 'neilsoft')
  assert.equal(neilsoft.COMPANY, 'Neilsoft Ltd')
  assert.equal(neilsoft.HOMEPAGE_URL, 'https://neilsoft.com/')
  assert.equal(neilsoft.CAREERS_URL, 'https://neilsoft.com/careers')
  assert.equal(neilsoft.INDIA_OPENINGS_URL, 'https://neilsoft.com/careers/current-job-openings-india')
  assert.equal(neilsoft.APPLICATION_EMAIL, 'careers@neilsoft.com')
  assert.equal(neilsoft.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(neilsoft.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(neilsoft.hasOfficialIndiaOpeningsSignal(indiaOpeningsHtml), true)
  assert.equal(neilsoft.hasOfficialJobDetailSignal(designerDetailHtml, 'Designer / Sr. Designer'), true)
})

test('Neilsoft extracts first-party India openings and enriches detail pages into shared job fields', async () => {
  const neilsoft = await loadNeilsoftModule()

  assert.deepEqual(neilsoft.extractJobsFromIndiaOpeningsPage(indiaOpeningsHtml), [
    {
      title: 'Designer / Sr. Designer',
      company: 'Neilsoft Ltd',
      department: 'Buildings & Infrastructure',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'Buildings - P-R',
      requisitionId: 'Buildings - P-R',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/designer-sr-designer',
      applyUrl: 'mailto:careers@neilsoft.com?Subject=Designer / Sr. Designer code:Buildings-P-R',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Water Resources and Municipal Engineer',
      company: 'Neilsoft Ltd',
      department: 'Buildings & Infrastructure',
      location: 'Any/WFH, India',
      city: null,
      country: 'India',
      jobId: 'Buildings - Water Resources and Municipal Engineer',
      requisitionId: 'Buildings - Water Resources and Municipal Engineer',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/water-resources-and-municipal-engineer',
      applyUrl: 'mailto:careers@neilsoft.com?Subject=Water Resources and Municipal Engineer code:Buildings-Water',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
    {
      title: 'CAD Software Engineer',
      company: 'Neilsoft Ltd',
      department: 'Software Engineering',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'SES-0123-001',
      requisitionId: 'SES-0123-001',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/cad-software-engineer',
      applyUrl: null,
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])

  assert.deepEqual(
    neilsoft.extractJobDetail(designerDetailHtml, 'https://neilsoft.com/careers/current-job-openings-india/designer-sr-designer'),
    {
      title: 'Designer / Sr. Designer',
      minimumQualification: 'D.C.E. / I.T.I. (Civil)',
      experienceRequired: '2 to 10 years',
      preferredQualification: null,
      requiredSkills: [
        'Must have hands on experience detailing Precast projects',
        'US detailing experience will be preferred',
        'Must have good AutoCAD knowledge & visualization skills',
      ],
      jobDescription:
        'Qualification: D.C.E. / I.T.I. (Civil) Must have hands on experience detailing Precast projects Candidate should have 2 to 10 years of experience US detailing experience will be preferred Must have good AutoCAD knowledge & visualization skills',
      applyUrl: 'mailto:careers@neilsoft.com?Subject=Designer / Sr. Designer code:Buildings-P-R',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/designer-sr-designer',
    },
  )

  assert.deepEqual(
    neilsoft.extractJobDetail(rmgExecutiveDetailHtml, 'https://neilsoft.com/careers/current-job-openings-india/sr-rmg-executive'),
    {
      title: 'Sr. RMG Executive',
      minimumQualification: 'BE with MBA in Operations.',
      experienceRequired: '6-10 Years',
      preferredQualification: null,
      requiredSkills: [
        'Strong resource planning, allocation, and capacity planning skills.',
        'Experience in utilization monitoring, billability tracking, and workforce planning.',
      ],
      jobDescription:
        'Qualification: BE with MBA in Operations. Experience: 6-10 Years, Minimum 4 years in Resource Management within an Engineering Services company Collaborate with Management, Delivery Teams, Practice Heads, IT, HR, Recruitment Team, Project Leaders, and Delivery Teams for resource management activities. Ensure effective resource planning, allocation, and optimal utilization across projects. BE with MBA in Operations. Minimum 4 years of experience as a Resource Management Executive/Senior Resource Management Executive in an engineering services company. Overall industry experience of 6-10 years is preferred. Strong resource planning, allocation, and capacity planning skills. Experience in utilization monitoring, billability tracking, and workforce planning.',
      applyUrl: 'mailto:careers@neilsoft.com',
      sourceUrl: 'https://neilsoft.com/careers/current-job-openings-india/sr-rmg-executive',
    },
  )
})

test('Neilsoft run validates the verified first-party pages and returns enriched jobs with detail-page links', async () => {
  const neilsoft = await loadNeilsoftModule()
  const requestedUrls = []

  const jobs = await neilsoft.createNeilsoftScraper({
    now: () => '2026-07-11T08:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === neilsoft.HOMEPAGE_URL) return homepageHtml
      if (url === neilsoft.CAREERS_URL) return careersHtml
      if (url === neilsoft.INDIA_OPENINGS_URL) return indiaOpeningsHtml
      if (url === 'https://neilsoft.com/careers/current-job-openings-india/designer-sr-designer') {
        return designerDetailHtml
      }
      if (url === 'https://neilsoft.com/careers/current-job-openings-india/water-resources-and-municipal-engineer') {
        return waterResourcesDetailHtml
      }
      if (url === 'https://neilsoft.com/careers/current-job-openings-india/cad-software-engineer') {
        return cadSoftwareEngineerDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    neilsoft.HOMEPAGE_URL,
    neilsoft.CAREERS_URL,
    neilsoft.INDIA_OPENINGS_URL,
    'https://neilsoft.com/careers/current-job-openings-india/designer-sr-designer',
    'https://neilsoft.com/careers/current-job-openings-india/water-resources-and-municipal-engineer',
    'https://neilsoft.com/careers/current-job-openings-india/cad-software-engineer',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'neilsoft')
  assert.equal(jobs[0].link, 'https://neilsoft.com/careers/current-job-openings-india/designer-sr-designer')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T08:00:00.000Z')
  assert.equal(jobs[1].remoteStatus, 'Remote')
  assert.equal(
    jobs[2].applyUrl,
    'mailto:careers@neilsoft.com?Subject=CAD Software Engineer code:SES-0123-001',
  )
})

test('Neilsoft fails closed when the verified public jobs surface changes materially', async () => {
  const neilsoft = await loadNeilsoftModule()

  await assert.rejects(
    neilsoft.createNeilsoftScraper().run({
      fetchText: async (url) => {
        if (url === neilsoft.HOMEPAGE_URL) return homepageHtml
        if (url === neilsoft.CAREERS_URL) return careersHtml
        return '<html><body><h1>Jobs</h1></body></html>'
      },
    }),
    /Neilsoft official India openings page changed/i,
  )
})
