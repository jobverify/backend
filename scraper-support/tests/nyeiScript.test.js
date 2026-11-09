import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'nyei',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const verifiedHomepageHtml = readFixture('homepage.html')
const verifiedCareersHtml = readFixture('careers.html')
const currentHomepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>MEP Consultant for Commercial Building Projects | NY Engineers</title>
    </head>
    <body>
      <header>
        <a href="https://www.ny-engineers.com/about/engineering-career-opportunities">Careers</a>
      </header>
      <main>
        <h1>NY Engineers</h1>
        <p>Contact us at info@ny-engineers.com</p>
      </main>
    </body>
  </html>
`
const reorderedBoundaryCareersHtml = verifiedCareersHtml.replace(
  /(<div id="form-wrap"[\s\S]*$)/i,
  '',
).trim() === verifiedCareersHtml.trim()
  ? verifiedCareersHtml
  : `${verifiedCareersHtml.match(/<div id="form-wrap"[\s\S]*$/i)?.[0] ?? ''}\n${verifiedCareersHtml.replace(/<div id="form-wrap"[\s\S]*$/i, '').trim()}`

const loadNyeiModule = async () => {
  try {
    return await import('../../scraper/nyei/script.js')
  } catch {
    assert.fail('Expected NYEI scraper module at ../../scraper/nyei/script.js')
  }
}

test('NYEI scraper recognizes the verified homepage and first-party careers listings shell', async () => {
  const nyei = await loadNyeiModule()

  assert.equal(nyei.SOURCE, 'nyei')
  assert.equal(nyei.COMPANY, 'NYEI')
  assert.equal(nyei.HOMEPAGE_URL, 'https://www.ny-engineers.com/')
  assert.equal(
    nyei.CAREERS_URL,
    'https://www.ny-engineers.com/about/engineering-career-opportunities',
  )
  assert.equal(nyei.hasOfficialHomepageSignal(verifiedHomepageHtml), true)
  assert.equal(nyei.hasOfficialCareersSignal(verifiedCareersHtml), true)
})

test('NYEI scraper accepts the current homepage title variant', async () => {
  const nyei = await loadNyeiModule()

  assert.equal(nyei.hasOfficialHomepageSignal(currentHomepageHtml), true)
})

test('NYEI scraper extracts the current first-party role cards and narrows them to India jobs', async () => {
  const nyei = await loadNyeiModule()

  const cards = nyei.extractOpenRoleCards(verifiedCareersHtml)
  const jobs = nyei.extractIndiaJobOpenings(verifiedCareersHtml)

  assert.equal(cards.length, 14)
  assert.deepEqual(
    cards.slice(0, 4).map((card) => ({
      title: card.title,
      department: card.department,
      location: card.location,
    })),
    [
      {
        title: 'HVAC Design Engineer',
        department: 'Mechanical',
        location: 'Pune, India',
      },
      {
        title: 'HVAC Design Engineer L2',
        department: 'Mechanical',
        location: 'Pune, India',
      },
      {
        title: 'Senior Electrical Design Engineer',
        department: 'Electrical and Fire Alarm',
        location: 'Pune, India',
      },
      {
        title: 'Electrical Design Engineer L2',
        department: 'Electrical and Fire Alarm',
        location: 'Pune, India',
      },
    ],
  )

  assert.equal(jobs.length, 11)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Digital Marketing Executive',
      'Digital Marketing Manager',
      'Electrical Design Engineer L1',
      'Electrical Design Engineer L2',
      'HVAC Design Engineer',
      'HVAC Design Engineer L2',
      'Plumbing Design Engineer',
      'Plumbing Design Engineer L2',
      'Senior Electrical Design Engineer',
      'Senior Plumbing Design Engineer',
      'Social Media Executive',
    ],
  )
  assert.deepEqual(
    (({
      title,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      employmentType,
      experienceRequired,
      workplaceType,
      requiredSkills,
    }) => ({
      title,
      department,
      location,
      city,
      country,
      jobId,
      requisitionId,
      sourceUrl,
      applyUrl,
      employmentType,
      experienceRequired,
      workplaceType,
      requiredSkills,
    }))(jobs[0]),
    {
      title: 'Digital Marketing Executive',
      department: 'Other',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'nyei-digital-marketing-executive-pune-india',
      requisitionId: 'nyei-digital-marketing-executive-pune-india',
      sourceUrl: 'https://www.ny-engineers.com/about/engineering-career-opportunities',
      applyUrl: 'https://www.ny-engineers.com/about/engineering-career-opportunities#JobApply',
      employmentType: null,
      experienceRequired: null,
      workplaceType: null,
      requiredSkills: [],
    },
  )
  assert.ok(
    jobs.every((job) =>
      job.company === 'NYEI'
      && job.location === 'Pune, India'
      && job.country === 'India'
      && job.applyUrl === 'https://www.ny-engineers.com/about/engineering-career-opportunities#JobApply'
      && job.sourceUrl === 'https://www.ny-engineers.com/about/engineering-career-opportunities'),
  )
  assert.match(
    jobs[1].jobDescription,
    /Lead the execution of marketing programs from start to finish/i,
  )
  assert.equal(
    jobs.some((job) => /New York, USA/i.test(job.location)),
    false,
  )
})

test('NYEI scraper tolerates the live careers-page section boundary moving ahead of the job cards', async () => {
  const nyei = await loadNyeiModule()
  const cards = nyei.extractOpenRoleCards(reorderedBoundaryCareersHtml)

  assert.equal(cards.length, 14)
  assert.equal(cards[0].title, 'HVAC Design Engineer')
})

test('NYEI scraper returns the public first-party India roles from the verified careers page', async () => {
  const nyei = await loadNyeiModule()
  const requestedUrls = []

  const jobs = await nyei.createNyeiScraper({
    now: () => '2026-07-11T08:15:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nyei.HOMEPAGE_URL) return verifiedHomepageHtml
      if (url === nyei.CAREERS_URL) return verifiedCareersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [nyei.HOMEPAGE_URL, nyei.CAREERS_URL])
  assert.equal(jobs.length, 11)
  assert.equal(jobs[0].source, 'nyei')
  assert.equal(jobs[0].company, 'NYEI')
  assert.equal(
    jobs[0].companyCareerPage,
    'https://www.ny-engineers.com/about/engineering-career-opportunities',
  )
  assert.equal(jobs[0].companyDomain, 'ny-engineers.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T08:15:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})

test('NYEI scraper fails closed when the verified homepage or careers shell drifts materially', async () => {
  const nyei = await loadNyeiModule()

  await assert.rejects(
    nyei.createNyeiScraper().run({
      fetchText: async (url) => {
        if (url === nyei.HOMEPAGE_URL) {
          return verifiedHomepageHtml.replace(
            'https://www.ny-engineers.com/about/engineering-career-opportunities',
            'https://www.ny-engineers.com/about',
          )
        }
        return verifiedCareersHtml
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    nyei.createNyeiScraper().run({
      fetchText: async (url) => {
        if (url === nyei.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          'module_Job_openings_NYEI.min.js',
          'module_Careers.min.js',
        )
      },
    }),
    /verified public careers page/i,
  )

  await assert.rejects(
    nyei.createNyeiScraper().run({
      fetchText: async (url) => {
        if (url === nyei.HOMEPAGE_URL) return verifiedHomepageHtml
        return verifiedCareersHtml.replace(
          '<a class="JobApply" href="#JobApply">Apply Now</a>',
          '<a class="JobApply" href="#JobApply">View job</a>',
        )
      },
    }),
    /job cards changed shape/i,
  )
})
