import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kanodaenergysystemspvtltd')

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')

test('Kanoda Energy Systems verifies the first-party careers surface and extracts public openings', async () => {
  const kanoda = await import('../../scraper/kanodaenergysystemspvtltd/script.js')

  assert.equal(kanoda.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kanoda.hasOfficialCareersSignal(careersHtml), true)

  assert.deepEqual(kanoda.extractJobs(careersHtml), [
    {
      title: 'Admin Executive | Immediate Joiner | Ahmedabad',
      company: 'Kanoda Energy Systems Pvt. Ltd.',
      department: 'HR & Admin',
      location: 'Ahmedabad, Gujarat, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: 'kanodaenergysystemspvtltd-admin-executive-immediate-joiner-ahmedabad-ahmedabad',
      requisitionId: 'kanodaenergysystemspvtltd-admin-executive-immediate-joiner-ahmedabad-ahmedabad',
      sourceUrl: 'https://www.kanoda.com/careers.html',
      applyUrl: 'https://www.kanoda.com/careers.html',
      employmentType: null,
      experienceRequired: '2-4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Manage the overall administration of the office. Oversee housekeeping-related activities. Coordinate travel bookings, reimbursements, and other administrative tasks. Support the HR team with event planning, arrangements, and coordination.',
    },
    {
      title: 'Data Operator',
      company: 'Kanoda Energy Systems Pvt. Ltd.',
      department: 'Design & Engineering',
      location: 'Ahmedabad, Gujarat, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: 'kanodaenergysystemspvtltd-data-operator-ahmedabad',
      requisitionId: 'kanodaenergysystemspvtltd-data-operator-ahmedabad',
      sourceUrl: 'https://www.kanoda.com/careers.html',
      applyUrl: 'https://www.kanoda.com/careers.html',
      employmentType: null,
      experienceRequired: '1 year',
      minimumQualification: 'B.Com., Diploma/B.E./B.Tech. in any engineering field',
      preferredQualification: null,
      requiredSkills: [
        'Proficient in handling large chunks of data on daily basis by using MS Excel formulas.',
        'Excellent knowledge of MS Excel, MS Words and Google Sheets.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Maintain and update database of site survey, design & engineering drawing of 28,000 telecom sites on daily basis. Identification of relevant data from survey forms. Compiling, verifying accuracy and sorting information for further processing.',
    },
    {
      title: 'Junior Design Engineer (Solar Design)',
      company: 'Kanoda Energy Systems Pvt. Ltd.',
      department: null,
      location: 'Ahmedabad, Gujarat, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: 'kanodaenergysystemspvtltd-junior-design-engineer-solar-design-ahmedabad',
      requisitionId: 'kanodaenergysystemspvtltd-junior-design-engineer-solar-design-ahmedabad',
      sourceUrl: 'https://www.kanoda.com/careers.html',
      applyUrl: 'https://www.kanoda.com/careers.html',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: 'Bachelors/ Diploma in Mechanical, Electrical, Civil, Industrial or allied engineering fields',
      preferredQualification: null,
      requiredSkills: [
        'Ability to read, comprehend and visualize basic layout drawings involving distances, area, volume, shapes, etc.',
        'Candidates with knowledge in PVSyst will be given preference.',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Survey Validation. Validate Site Survey forms and photographs for each site against site survey guidelines. PV System Design. Design Solar PV Plant Layouts in Google SketchUp in 3D model as per inputs given by Site Survey forms and photographs.',
    },
    {
      title: 'Senior Electrical Design Engineer',
      company: 'Kanoda Energy Systems Pvt. Ltd.',
      department: 'Design & Engineering',
      location: 'Ahmedabad, Gujarat, India',
      city: 'Ahmedabad',
      country: 'India',
      jobId: 'kanodaenergysystemspvtltd-senior-electrical-design-engineer-ahmedabad',
      requisitionId: 'kanodaenergysystemspvtltd-senior-electrical-design-engineer-ahmedabad',
      sourceUrl: 'https://www.kanoda.com/careers.html',
      applyUrl: 'https://www.kanoda.com/careers.html',
      employmentType: null,
      experienceRequired: '5-8 years',
      minimumQualification: 'Diploma/ B.E./ B.Tech./ M.E./ M.Tech. in Electrical Engineering',
      preferredQualification: null,
      requiredSkills: [
        'Knowledge of IS codes/ IEC standards for electrical designing',
        'AutoCAD, PVSyst, PV*SOL, SolidWorks, HelioScope',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead and manage electrical engineering design team for engineering, procurement and construction (EPC) and operation and maintenance (O&M) of solar photovoltaic (PV) power plants. Complete and detailed electrical designing and engineering of kW and MW-scale PV plants.',
    },
  ])
})

test('Kanoda Energy Systems scraper decorates verified jobs for persistence', async () => {
  const kanoda = await import('../../scraper/kanodaenergysystemspvtltd/script.js')
  const requestedUrls = []

  const jobs = await kanoda.createKanodaEnergySystemsScraper({
    now: () => '2026-07-11T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kanoda.HOMEPAGE_URL) return homepageHtml
      if (url === kanoda.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.kanoda.com/',
    'https://www.kanoda.com/careers.html',
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'kanodaenergysystemspvtltd')
  assert.equal(jobs[0].link, 'https://www.kanoda.com/careers.html')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
})

test('Kanoda Energy Systems fails closed when the careers page drift removes public job blocks', async () => {
  const kanoda = await import('../../scraper/kanodaenergysystemspvtltd/script.js')
  const driftedCareersHtml = careersHtml.replace(/Admin Executive \| Immediate Joiner \| Ahmedabad[\s\S]*?anamika\.gajjar@kanoda\.com/, '')

  await assert.rejects(
    kanoda.createKanodaEnergySystemsScraper().run({
      fetchText: async (url) => (url === kanoda.HOMEPAGE_URL ? homepageHtml : driftedCareersHtml),
    }),
    /public job listings/i,
  )
})
