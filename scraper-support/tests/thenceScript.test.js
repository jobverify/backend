import assert from 'node:assert/strict'
import test from 'node:test'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadThenceModule = async () => {
  try {
    return await import('../../scraper/thence/script.js')
  } catch {
    assert.fail('Expected Thence scraper module at ../../scraper/thence/script.js')
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Thence Digital</title>
  </head>
  <body>
    <nav>
      <a href="https://thence.digital/blogs">Blogs</a>
      <a href="https://thence.digital/careers">Careers</a>
      <a href="https://thence.digital/contact-us">Contact us</a>
    </nav>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
    <link rel="canonical" href="https://www.thence.digital/careers"/>
  </head>
  <body>
    <main>
      <h1>Solve for Change, Craft a better you.</h1>
      <p>
        Join Thence and be part of a top UI/UX design agency.
        Explore career opportunities to create innovative digital experiences.
      </p>
      <a href="#section-contact-us-form">See Open Roles</a>
      <a href="#section-contact-us-form">Apply Now</a>

      <form id="job-application-form">
        <div class="form-input-row">
          <input id="jaf-full_name" name="Full-name" type="text"/>
          <select id="jaf-select_role" name="Select-role" required="">
            <option value="-">Select role</option>
            <option value="Product Data Analyst">Product Data Analyst</option>
            <option value="UI Tester">UI Tester</option>
            <option value="Engineering Head">Engineering Head</option>
            <option value="UI Designer">UI Designer</option>
            <option value="Account Executive - Sales">Account Executive - Sales</option>
            <option value="Asst. Manager - Founder&#x27;s Office">Asst. Manager - Founder&#x27;s Office</option>
            <option value="Front-end Developer">Front-end Developer</option>
            <option value="Senior Manager - Business Content &amp; Communication">Senior Manager - Business Content &amp; Communication</option>
            <option value="UX Intern">UX Intern</option>
            <option value="UX Designer">UX Designer</option>
            <option value="Project Manager - Engineering">Project Manager - Engineering</option>
            <option value="UX Researcher">UX Researcher</option>
            <option value="Senior UX Designer">Senior UX Designer</option>
            <option value="Product Consultant/APC">Product Consultant/APC</option>
            <option value="Sales Manager - Tech">Sales Manager - Tech</option>
            <option value="PMO - CEO&#x27;s Office">PMO - CEO&#x27;s Office</option>
          </select>
        </div>
        <input id="jaf-current_ctc" name="Current-CTC-LPA-INR" type="number"/>
        <input
          id="jaf-experience"
          name="Relevant-years-of-experience"
          placeholder="Relevant years of experience"
          type="number"
        />
        <select id="jaf-job_type" name="Current-job-type" required="">
          <option value="-">Current job type</option>
          <option value="Full-time">Full-time</option>
          <option value="Internship">Internship</option>
        </select>
        <select id="jad-reference" name="How-did-you-know-about-this-opportunity" required="">
          <option value="-">How did you know about this opportunity</option>
          <option value="Linked In - Job Posting">Linked In - Job Posting</option>
          <option value="Thence Website">Thence Website</option>
        </select>
      </form>
    </main>
  </body>
</html>
`

const liveSharedFormCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <main>
      <h1>Solve for Change, Craft a better you.</h1>
      <p>Join Thence and be part of a top UI/UX design agency.</p>
      <form id="job-application-form">
        <input id="jaf-full_name" name="Full-name" type="text"/>
        <select id="jaf-select_role" name="Select-role" required="">
          <option value="-">Select role</option>
          <option value="Product Data Analyst">Product Data Analyst</option>
          <option value="UX Intern">UX Intern</option>
        </select>
        <input id="jaf-current_ctc" name="Current-CTC-LPA-INR" type="number"/>
        <input
          id="jaf-experience"
          name="Relevant-years-of-experience"
          placeholder="Relevant years of experience"
          type="number"
        />
        <label for="jaf-duration">Duration</label>
        <select id="jaf-duration" name="Notice-period-duration">
          <option value="0 Days">0 Days</option>
          <option value="Less than 7 Days">Less than 7 Days</option>
          <option value="Less than 15 Days">Less than 15 Days</option>
          <option value="Less than 20 Days">Less than 20 Days</option>
          <option value="Less than 30 Days">Less than 30 Days</option>
          <option value="Less than 45 Days">Less than 45 Days</option>
          <option value="Less than 60 Days">Less than 60 Days</option>
          <option value="Less than 75 Days">Less than 75 Days</option>
          <option value="Less than 90 Days">Less than 90 Days</option>
        </select>
        <label for="jaf-negotiable">Is it negotiable?</label>
        <select id="jaf-negotiable" name="Is-it-negotiable">
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
        <select id="jad-reference" name="How-did-you-know-about-this-opportunity" required="">
          <option value="Linked In - Informed by HR">Linked In - Informed by HR</option>
          <option value="Linked In - Job Posting">Linked In - Job Posting</option>
          <option value="Indeed">Indeed</option>
          <option value="Hirist">Hirist</option>
          <option value="Crew Karma">Crew Karma</option>
          <option value="Glassdoor">Glassdoor</option>
          <option value="Wellfound: Naukari Behance Internshala">Wellfound: Naukari Behance Internshala</option>
          <option value="Thence Website">Thence Website</option>
          <option value="Other/Design Institutes/Reference">Other/Design Institutes/Reference</option>
        </select>
      </form>
    </main>
    <p>
      By using this website and submitting your information, you consent to the
      collection, processing and storage of your personal data in accordance with our Privacy Policy.
    </p>
    <footer>
      <p>To be updated with our latest insights join us</p>
      <p>Cookie settings</p>
      <p>Accept all cookies</p>
      <p>Thank you! Your submission has been received!</p>
      <p>Oops! Something went wrong while submitting the form.</p>
      <p>
        about us As a Product Success Company, Thence works with leaders of Fortune500s
        to identify innovation opportunities by building/disrupting products to deliver
        business impact.
      </p>
      <p>Links Careers Contact us Privacy Policy Practices Consulting Research Design Engineering Analytics</p>
      <p>Our presence Singapore UAE USA India</p>
      <p>Say hello connect@thence.co</p>
      <p>2025. All Rights Reserved</p>
      <p>Strictly necessary (always active)</p>
      <p>Marketing</p>
      <p>Personalization</p>
      <p>Analytics</p>
      <p>Deny Save settings</p>
    </footer>
  </body>
</html>
`

test('Thence scraper validates the official homepage handoff and extracts public role options from the careers form', async () => {
  const thence = await loadThenceModule()

  assert.equal(thence.SOURCE, 'thence')
  assert.equal(thence.COMPANY, 'Thence Private Limited')
  assert.equal(thence.HOMEPAGE_URL, 'https://thence.co')
  assert.equal(thence.CAREERS_URL, 'https://thence.digital/careers')
  assert.equal(thence.APPLY_URL, 'https://thence.digital/careers#section-contact-us-form')
  assert.equal(thence.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(thence.extractCareersUrlFromHomepage(officialHomepageHtml), thence.CAREERS_URL)
  assert.equal(thence.hasOfficialCareersSignal(officialCareersHtml), true)

  const jobs = thence.extractOpenRoles(officialCareersHtml)
  assert.equal(jobs.length, 16)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Product Data Analyst',
      'UI Tester',
      'Engineering Head',
      'UI Designer',
      'Account Executive - Sales',
      "Asst. Manager - Founder's Office",
      'Front-end Developer',
      'Senior Manager - Business Content & Communication',
      'UX Intern',
      'UX Designer',
      'Project Manager - Engineering',
      'UX Researcher',
      'Senior UX Designer',
      'Product Consultant/APC',
      'Sales Manager - Tech',
      "PMO - CEO's Office",
    ],
  )
  assert.deepEqual(jobs[0], {
    title: 'Product Data Analyst',
    company: 'Thence Private Limited',
    department: null,
    location: 'India',
    city: null,
    country: 'India',
    jobId: 'thence-product-data-analyst',
    requisitionId: 'thence-product-data-analyst',
    sourceUrl: 'https://thence.digital/careers',
    applyUrl: 'https://thence.digital/careers#section-contact-us-form',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    publicExperienceChecked: true,
    remoteStatus: null,
  })
})

test('Thence treats the shared public application form as verified experience evidence without inventing a requirement', async () => {
  const thence = await loadThenceModule()

  const jobs = thence.extractOpenRoles(officialCareersHtml)
  const analyst = jobs.find((job) => job.title === 'Product Data Analyst')

  assert.equal(analyst?.experienceRequired, null)
  assert.equal(analyst?.publicExperienceChecked, true)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('Thence normalization keeps shared-form roles verified-missing instead of inferring zero experience from generic applicant fields', async () => {
  const thence = await loadThenceModule()
  const analyst = thence.extractOpenRoles(liveSharedFormCareersHtml)
    .find((job) => job.title === 'Product Data Analyst')

  const normalized = normalizeScrapedJob({
    ...analyst,
    source: thence.SOURCE,
    link: thence.APPLY_URL,
    scrapedAt: '2026-08-06T00:00:00.000Z',
  }, {
    source: thence.SOURCE,
    companyName: thence.COMPANY,
    companyCareerPage: thence.CAREERS_URL,
  })

  assert.equal(analyst?.jobDescription, null)
  assert.equal(normalized.publicExperienceChecked, true)
  assert.equal(normalized.jobDescription, null)
  assert.equal(normalized.experienceRequired, null)
})

test('Thence run validates the official homepage and careers page before decorating the public role list', async () => {
  const thence = await loadThenceModule()
  const requestedUrls = []

  const jobs = await thence.createThenceScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === thence.HOMEPAGE_URL) return officialHomepageHtml
      if (url === thence.CAREERS_URL) return officialCareersHtml

      throw new Error(`Unexpected Thence fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    thence.HOMEPAGE_URL,
    thence.CAREERS_URL,
  ])
  assert.equal(jobs.length, 16)
  assert.equal(jobs[0].company, 'Thence Private Limited')
  assert.equal(jobs[0].source, 'thence')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, thence.APPLY_URL)
  assert.equal(jobs[0].experienceRequired, null)
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.notEqual(jobs[0].jobId, jobs[1].jobId)
})

test('Thence fails closed when the verified homepage handoff or careers form changes', async () => {
  const thence = await loadThenceModule()

  await assert.rejects(
    thence.createThenceScraper().run({
      fetchText: async (url) => {
        if (url === thence.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }

        throw new Error(`Unexpected Thence fixture URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    thence.createThenceScraper().run({
      fetchText: async (url) => {
        if (url === thence.HOMEPAGE_URL) {
          return officialHomepageHtml.replace(
            'https://thence.digital/careers',
            'https://jobs.example.com/thence',
          )
        }

        throw new Error(`Unexpected Thence fixture URL: ${url}`)
      },
    }),
    /verified official careers handoff/i,
  )

  await assert.rejects(
    thence.createThenceScraper().run({
      fetchText: async (url) => {
        if (url === thence.HOMEPAGE_URL) return officialHomepageHtml
        if (url === thence.CAREERS_URL) {
          return `
            <html>
              <head><title>Careers</title></head>
              <body>
                <main>
                  <h1>Solve for Change, Craft a better you.</h1>
                  <a href="#section-contact-us-form">Apply Now</a>
                </main>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected Thence fixture URL: ${url}`)
      },
    }),
    /verified official public careers surface/i,
  )
})
