import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const mobineersCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Career</h2>
    <h2>Recent Jobs</h2>
    <a href="https://mobineers.com/jobs/sr-sales-manager/">Sr. Sales Manager</a>
    <span>Marketing</span>
    <span>Full Time</span>
    <span>Delhi</span>
    <a href="https://mobineers.com/jobs/qa-automation-tester/">QA Automation Tester</a>
    <span>Marketing</span>
    <span>Full Time</span>
    <span>Delhi</span>
    <a href="https://mobineers.com/jobs/sql-developer/">SQL DEVELOPER</a>
    <span>Full Time</span>
    <span>Hisar Varanasi</span>
    <a href="https://mobineers.com/jobs/sr-business-developer/">Sr. Business Developer</a>
    <span>Full Time</span>
    <span>Delhi</span>
  </body>
</html>
`

const mobineersDetailByUrl = {
  'https://mobineers.com/jobs/sr-sales-manager/': `
    <!doctype html>
    <html lang="en">
      <body>
        <h2>Sr. Sales Manager</h2>
        <p>Sr. Sales Manager Job Category: Marketing Job Type: Full Time Job Location: Delhi Apply for this position</p>
      </body>
    </html>
  `,
  'https://mobineers.com/jobs/qa-automation-tester/': `
    <!doctype html>
    <html lang="en">
      <body>
        <h2>QA Automation Tester</h2>
        <h3>Job Description for QA Automation Tester</h3>
        <p>Mobineers is seeking a skilled and proactive Automation Tester to join our QA team.</p>
        <p>Appium for mobile automation (Android/iOS)</p>
        <p>Selenium with Java for web automation</p>
        <p>API Testing using Postman</p>
        <p>Email: hr@mobineers.com</p>
        <p>Job Type: Full Time</p>
        <p>Job Location: Delhi</p>
        <h3>Apply for this position</h3>
      </body>
    </html>
  `,
  'https://mobineers.com/jobs/sql-developer/': `
    <!doctype html>
    <html lang="en">
      <body>
        <h2>SQL DEVELOPER</h2>
        <h3>JOB DESCRIPTION FOR SQL DEVELOPER</h3>
        <p>Write efficient and optimized database queries using SQL Server variants such as MySQL, MSSQL, or PostgreSQL.</p>
        <p>Troubleshoot and resolve database-related issues using JavaScript and other programming languages.</p>
        <p>Job Type: Full Time</p>
        <p>Job Location: Hisar Varanasi</p>
      </body>
    </html>
  `,
  'https://mobineers.com/jobs/sr-business-developer/': `
    <!doctype html>
    <html lang="en">
      <body>
        <h2>Sr. Business Developer</h2>
        <p>Drive enterprise software sales, identify leads, and manage customer relationships.</p>
        <p>Job Type: Full Time</p>
        <p>Job Location: Delhi</p>
      </body>
    </html>
  `,
}

const businessnextCurrentOpeningsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Current Openings</h2>
    <p>19</p>
    <h2>Cloud / DevOps Roles</h2>
    <p>Job Role Location Experience Required Open Positions</p>
    <p>Lead - DevOps Noida 7-10 years 1</p>
    <p>Cloud Devops Engineer Noida 2 - 4 years 2</p>
    <h2>Global Operations</h2>
    <p>Business Operations Specialist Noida 3-5 years 1</p>
    <h2>Go-to-Market (GTM) & Strategy Roles</h2>
    <p>Solution Consulting Specialist Mumbai 4 - 6 years 1</p>
    <p>Country Sales Manager Indonesia 8-12 years 1</p>
    <p>Manager Consultanting - Value Consulting Noida 9 - 12 years 1</p>
    <p>Manager Consultanting - Value Consulting Mumbai 9 - 12 years 1</p>
    <p>Manager Sales Mumbai 9 - 12 years 1</p>
    <p>Solution Consultant Specialist Noida 4 - 6 years 1</p>
    <p>Senior Associate - Direct Sales Mumbai 4 - 6 years 1</p>
    <h2>Product Development / Engineering Roles</h2>
    <p>Manager- DataScience Noida 7-10 years 1</p>
    <p>Product Owner Noida 7-10 years 1</p>
    <p>Instructional Designer Noida 2-5 years 1</p>
    <p>Assistant Manager - .Net Core Noida 8-10 years 1</p>
    <h2>Product Management & Design</h2>
    <p>UI/UX Designer Noida 4 - 6 years 1</p>
    <h2>Techno-Functional Roles</h2>
    <p>Lead Consultant Noida 6-9 years 1</p>
    <p>Senior Engineer Noida 4 - 6 years 1</p>
    <p>Engineer Mumbai 2 - 4 years 1</p>
    <p>Consultant Mumbai 2 - 4 years 1</p>
  </body>
</html>
`

const businessnextCareersHomeHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Unlimit Your Potential</h1>
    <p>Current Openings</p>
    <p>AI / ML / Data Engineering Roles</p>
    <p>Cloud / DevOps Roles</p>
  </body>
</html>
`

const rgbsiBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>RGBSI</h1>
    <a href="https://www.rgbsi.com/">Home Page</a>
    <h2>Careers at RGBSI</h2>
    <h3>Jobs at RGBSI</h3>
    <a href="https://jobs.smartrecruiters.com/RGBSI/743999999000001-cnc-programmer">CNC programmer</a>
    <a href="https://jobs.smartrecruiters.com/RGBSI/743999999000002-supplier-quality-engineer">Supplier Quality Engineer</a>
  </body>
</html>
`

const rgbsiListingPayload = {
  totalFound: 2,
  content: [
    {
      id: '743999999000001',
      name: 'CNC programmer',
      refNumber: 'RGB-1001',
      releasedDate: '2026-07-15T05:00:00.000Z',
      location: {
        city: 'East Hartford',
        region: 'CT',
        country: 'us',
        fullLocation: 'East Hartford, CT, United States',
      },
      company: {
        identifier: 'RGBSI',
        name: 'RGBSI',
      },
      department: {
        label: 'Manufacturing',
      },
      typeOfEmployment: {
        id: 'full-time',
        label: 'Full-time',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/RGBSI/postings/743999999000001',
    },
    {
      id: '743999999000002',
      name: 'Supplier Quality Engineer',
      refNumber: 'RGB-1002',
      releasedDate: '2026-07-14T05:00:00.000Z',
      location: {
        city: 'Oshkosh',
        region: 'WI',
        country: 'us',
        fullLocation: 'Oshkosh, WI, United States',
      },
      company: {
        identifier: 'RGBSI',
        name: 'RGBSI',
      },
      department: {
        label: 'Quality',
      },
      typeOfEmployment: {
        id: 'contract',
        label: 'Contract',
      },
      ref: 'https://api.smartrecruiters.com/v1/companies/RGBSI/postings/743999999000002',
    },
  ],
}

const loconavCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Build Your Career with LocoNav</h1>
    <a href="https://www.linkedin.com/company/loconav/jobs/">See Job Openings</a>
    <p>LocoNav is the world’s fastest growing fleet management company.</p>
    <p>hi@loconav.com</p>
  </body>
</html>
`

const ionideaCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Jobs at IonIdea</h2>
    <!-- Current native role titles are paragraph cards, not footer headings. -->
    <div class="col-lg-12 border py-4 rounded-5"><p class="careers-job-title">APM Consultant/Sr Consultant for Dynatrace</p>
    <p>Experience: 3-5 years</p>
    <p>Education: BE/BTECH/MCA/ MTECH from Computer Science</p>
    <p>Location: Bangalore/ Hyderabad/ Chennai/ Delhi</p>
    <p>Summary:</p>
    <p>Lead implementation activities and quarterly business reviews with Dynatrace customers.</p>
    <a href="/careers-apply.php?id=252368">Apply Here</a></div>
    <div class="col-lg-12 border py-4 rounded-5"><p class="careers-job-title">Software Engineer - APM</p>
    <p>Experience: 3-5 years</p>
    <p>Education: BE/BTECH/MCA/ MTECH from Computer Science</p>
    <p>Location: Bangalore/ Hyderabad/ Chennai/ Delhi</p>
    <p>Required Technical Skills:</p>
    <p>Performance Engineering with APM tools</p>
    <p>Proficient in Java, J2ee/ Python</p>
    <a href="/careers-apply.php?id=252367">Apply Here</a></div>
    <div class="col-lg-12 border py-4 rounded-5"><p class="careers-job-title">Consultant (Devops Engineer)</p>
    <p>IonIdea, Inc. - Fairfax, VA is looking for a Consultant (Devops Engineer)</p>
    <p>Will take part in AWS Cloud implementations and Azure migration.</p>
    <p>Will use Terraform, Terragrunt, and Cloudformation Infrastructure automation.</p>
    <p>Will provide services at unanticipated client worksites throughout the U.S.</p>
    <p>Salary: $114,026/year.</p>
    <a href="https://www.jobpostingtoday.com/application/15567/apply/">Apply Here</a></div>
  </body>
</html>
`

test('Mobineers Info Systems run returns normalized jobs from the verified first-party careers pages', async () => {
  const mobineers = await loadModule('../../scraper/mobineersinfosystems/script.js')
  const requestedUrls = []

  assert.equal(mobineers.hasOfficialCareersSignal(mobineersCareersHtml), true)
  assert.equal(mobineers.extractListingCards(mobineersCareersHtml).length, 4)

  const jobs = await mobineers.createMobineersInfoSystemsScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === mobineers.CAREERS_URL) return mobineersCareersHtml
      if (mobineersDetailByUrl[url]) return mobineersDetailByUrl[url]
      throw new Error(`Unexpected Mobineers URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    mobineers.CAREERS_URL,
    'https://mobineers.com/jobs/sr-sales-manager/',
    'https://mobineers.com/jobs/qa-automation-tester/',
    'https://mobineers.com/jobs/sql-developer/',
    'https://mobineers.com/jobs/sr-business-developer/',
  ])
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs.map((job) => job.title), [
    'QA Automation Tester',
    'SQL DEVELOPER',
    'Sr. Business Developer',
    'Sr. Sales Manager',
  ])
  assert.equal(jobs[0].location, 'Delhi')
  assert.match(jobs[0].jobDescription, /Appium/i)
  assert.equal(jobs[1].location, 'Hisar Varanasi')
  assert.match(jobs[1].jobDescription, /database queries/i)
  assert.equal(jobs[2].location, 'Delhi')
  assert.equal(jobs[2].employmentType, 'Full Time')
})

test('BUSINESSNEXT run returns normalized jobs from the verified first-party current openings page', async () => {
  const businessnext = await loadModule('../../scraper/businessnext/script.js')
  const requestedUrls = []

  assert.equal(businessnext.hasOfficialCareersHubSignal(businessnextCareersHomeHtml), true)
  assert.equal(businessnext.hasOfficialCurrentOpeningsSignal(businessnextCurrentOpeningsHtml), true)

  const jobs = await businessnext.createBusinessnextScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === businessnext.CAREERS_HUB_URL) return businessnextCareersHomeHtml
      if (url === businessnext.CAREERS_URL) return businessnextCurrentOpeningsHtml
      throw new Error(`Unexpected BUSINESSNEXT URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [businessnext.CAREERS_HUB_URL, businessnext.CAREERS_URL])
  assert.equal(jobs.length, 18)
  assert.equal(jobs[0].title, 'Assistant Manager - .Net Core')
  assert.equal(jobs[0].department, 'Product Development / Engineering Roles')
  assert.equal(jobs[0].location, 'Noida')
  assert.equal(jobs.at(-1).title, 'UI/UX Designer')
  assert.equal(jobs.at(-1).experienceRequired, '4 - 6 years')
})

test('RGBSI run keeps unavailable current handoffs and details partial while excluding explicit US legacy records', async () => {
  const rgbsi = await loadModule('../../scraper/rgbsi/script.js')
  const requestedUrls = []

  assert.equal(rgbsi.hasVerifiedBoardSignal(rgbsiBoardHtml), true)

  const jobs = await rgbsi.createRgbsiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === rgbsi.BOARD_URL) return rgbsiBoardHtml
      throw new Error('No retained current corporate reply in this legacy-only fixture')
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://api.smartrecruiters.com/v1/companies/RGBSI/postings?limit=100&offset=0') {
        return rgbsiListingPayload
      }
      throw new Error(`Unexpected RGBSI URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    rgbsi.BOARD_URL,
    'https://api.smartrecruiters.com/v1/companies/RGBSI/postings?limit=100&offset=0',
    'https://api.smartrecruiters.com/v1/companies/RGBSI/postings/743999999000001',
    'https://api.smartrecruiters.com/v1/companies/RGBSI/postings/743999999000002',
    'https://www.rgbsi.com/',
  ])
  assert.deepEqual(jobs, [])
  const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})

test('LocoNav sentinel validates the first-party LinkedIn handoff page and returns []', async () => {
  const loconav = await loadModule('../../scraper/loconav/script.js')

  assert.equal(loconav.hasOfficialCareersSignal(loconavCareersHtml), true)
  assert.equal(loconav.hasFirstPartyJobInventory(loconavCareersHtml), false)

  const jobs = await loconav.createLoconavScraper().run({
    fetchText: async (url) => {
      assert.equal(url, loconav.CAREERS_URL)
      return loconavCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('IonIdea run returns normalized inline jobs from the verified first-party careers page', async () => {
  const ionidea = await loadModule('../../scraper/ionidea/script.js')

  assert.equal(ionidea.hasOfficialCareersSignal(ionideaCareersHtml), true)
  assert.equal(ionidea.extractInlineJobs(ionideaCareersHtml).length, 3)

  const jobs = await ionidea.createIonideaScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, ionidea.CAREERS_URL)
      return ionideaCareersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.title), [
    'APM Consultant/Sr Consultant for Dynatrace',
    'Consultant (Devops Engineer)',
    'Software Engineer - APM',
  ])
  assert.equal(jobs[0].location, 'Bangalore/ Hyderabad/ Chennai/ Delhi')
  assert.match(jobs[1].jobDescription, /AWS Cloud implementations/i)
  assert.equal(jobs[2].applyUrl, 'https://www.ionidea.com/careers-apply.php?id=252367')
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[1].country, 'U.S.')
  assert.equal(jobs[1].requisitionId, null)
})
