import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'jaroeducation',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const HOMEPAGE_HTML = readFixture('homepage.html')
const CAREERS_HTML = readFixture('careers.html')
const ACCORDION_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title data-next-head="">Career at Jaro Education | Jaro Education</title>
  </head>
  <body>
    <h2>Why Join Jaro Education?</h2>
    <h2>Explore Current Opportunities</h2>
    <p>Find the Role That Moves Your Career Forward</p>
    <button>Find Jobs</button>
    <div class="accordion-item">
      <h2 class="accordion-header">
        <button type="button" class="accordion-button collapsed">
          <div class="Accordian_jar-job-header___B_eb">
            <div class="Accordian_jar-accordion-sec__head-left__YcZyq">
              <h5 class="raleway-ff fs-24 Accordian_jar-accordion-sec__heading__ETVvJ">administrative manager<svg></svg></h5>
              <ul class="Accordian_jar-accordion-sec__blocklist__NlhOm">
                <li>Mumbai</li>
                <li>Experienced</li>
                <li>Senior Level</li>
              </ul>
            </div>
            <div class="Accordian_jar-button-group__UAPeu">
              <div class="btnwhite jar-btn-lg">View Details</div>
              <div class="btnView jar-btn-lg">Apply Now</div>
            </div>
          </div>
        </button>
      </h2>
      <div class="accordion-collapse collapse">
        <div class="accordion-body">
          <div class="Accordian_jar-accordion-bodycnt__hnpoD">
            <h2>Location</h2>
            <ul><li>Chembur</li></ul>
            <h2>Experience</h2>
            <ul><li>10-12 years experience</li></ul>
            <h2>Job Description</h2>
            <ul><li>Oversee day-to-day administrative operations of the office.</li></ul>
            <h2>Educational Qualifications</h2>
            <ul>
              <li>Bachelor's degree in Business Administration, Management, or related field</li>
              <li>MBA preferred</li>
            </ul>
            <h2>Required Skills</h2>
            <ul><li>Strong organizational and multitasking abilities</li></ul>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/jaroeducation/script.js')
  } catch {
    assert.fail('Expected Jaro Education scraper module at ../../scraper/jaroeducation/script.js')
  }
}

test('Jaro Education validates the verified homepage and careers surface', async () => {
  const jaroEducation = await loadModule()

  assert.equal(jaroEducation.SOURCE, 'jaroeducation')
  assert.equal(jaroEducation.COMPANY, 'Jaro Education')
  assert.equal(jaroEducation.HOMEPAGE_URL, 'https://www.jaroeducation.com/')
  assert.equal(jaroEducation.CAREERS_URL, 'https://www.jaroeducation.com/careers')
  assert.equal(jaroEducation.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(jaroEducation.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('Jaro Education extracts public listings from the verified careers page', async () => {
  const jaroEducation = await loadModule()

  const jobs = jaroEducation.extractPublicListings(CAREERS_HTML)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'Administrative Manager',
    company: 'Jaro Education',
    department: null,
    location: 'Chembur, India',
    city: 'Chembur',
    country: 'India',
    jobId: 'jaroeducation-administrative-manager-chembur',
    requisitionId: 'jaroeducation-administrative-manager-chembur',
    sourceUrl: 'https://www.jaroeducation.com/careers#jaroeducation-administrative-manager-chembur',
    applyUrl: 'https://www.jaroeducation.com/careers#jaroeducation-administrative-manager-chembur',
    employmentType: null,
    experienceRequired: '10-12 years experience',
    minimumQualification: 'Bachelor’s degree in Business Administration, Management, or related field',
    preferredQualification: 'MBA/PGDM preferred (optional depending on organization)',
    requiredSkills: [
      'Strong organizational and multitasking abilities',
      'Leadership and team management skills',
      'Excellent communication and interpersonal skills',
      'Problem-solving and decision-making capability',
      'Vendor and facility management knowledge',
      'Proficiency in MS Office and office management software',
      'Time management and attention to detail',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'Oversee day-to-day administrative operations of the office.',
      'Manage office facilities, housekeeping, security, and maintenance.',
      'Supervise administrative staff and allocate responsibilities.',
      'Handle procurement of office supplies and vendor management.',
      'Maintain office records, files, and documentation systems.',
      'Coordinate travel arrangements, meetings, and events.',
      'Ensure compliance with company policies and administrative procedures.',
      'Monitor office budgets and control administrative expenses.',
      'Liaise with government authorities, service providers, and contractors when required.',
      'New office identification and existing office servicing.',
      'Implement process improvements for better office efficiency.',
      'Ensure workplace health, safety, and cleanliness standards are maintained.',
    ].join(' '),
  })
})

test('Jaro Education also extracts accordion-based public listings from the live careers layout', async () => {
  const jaroEducation = await loadModule()

  const jobs = jaroEducation.extractPublicListings(ACCORDION_CAREERS_HTML)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Administrative Manager',
    company: 'Jaro Education',
    department: null,
    location: 'Chembur, India',
    city: 'Chembur',
    country: 'India',
    jobId: 'jaroeducation-administrative-manager-chembur',
    requisitionId: 'jaroeducation-administrative-manager-chembur',
    sourceUrl: 'https://www.jaroeducation.com/careers#jaroeducation-administrative-manager-chembur',
    applyUrl: 'https://www.jaroeducation.com/careers#jaroeducation-administrative-manager-chembur',
    employmentType: null,
    experienceRequired: '10-12 years experience',
    minimumQualification: "Bachelor's degree in Business Administration, Management, or related field",
    preferredQualification: 'MBA preferred',
    requiredSkills: ['Strong organizational and multitasking abilities'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Oversee day-to-day administrative operations of the office.',
  })
})

test('Jaro Education run fetches the verified homepage and careers page, then returns the public jobs', async () => {
  const jaroEducation = await loadModule()
  const requestedUrls = []

  const jobs = await jaroEducation.createJaroEducationScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === jaroEducation.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === jaroEducation.CAREERS_URL) return CAREERS_HTML

      throw new Error(`Unexpected fixture URL: ${url}`)
    },
    now: () => '2026-07-10T10:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.jaroeducation.com/',
    'https://www.jaroeducation.com/careers',
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'jaroeducation')
  assert.equal(jobs[0].companyCareerPage, 'https://www.jaroeducation.com/careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T10:00:00.000Z')
})

test('Jaro Education fails closed when the homepage or careers contract changes materially', async () => {
  const jaroEducation = await loadModule()

  await assert.rejects(
    jaroEducation.createJaroEducationScraper().run({
      fetchText: async (url) => {
        if (url === jaroEducation.HOMEPAGE_URL) {
          return '<html><head><title>Unexpected</title></head><body></body></html>'
        }

        return CAREERS_HTML
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    jaroEducation.createJaroEducationScraper().run({
      fetchText: async (url) => {
        if (url === jaroEducation.HOMEPAGE_URL) return HOMEPAGE_HTML
        return '<html><body><h1>Careers</h1><p>No jobs</p></body></html>'
      },
    }),
    /verified official careers surface/i,
  )
})
