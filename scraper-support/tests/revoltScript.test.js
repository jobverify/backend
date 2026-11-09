import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-04T13:00:00.000Z'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Revolt Electric Bikes- EV Bike Price India and Latest Models</title>
    <meta
      name="description"
      content="Find the best electric bikes in India from Revolt Motors."
    />
    <meta property="og:site_name" content="Revolt Motors" />
  </head>
  <body>
    <header>
      <a href="/career-with-us">Careers</a>
    </header>
    <main>
      <p>contact@revoltmotors.com</p>
      <p>Revolt Intellicorp Private Limited</p>
    </main>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Revolt Electric Bikes- EV Bike Price India and Latest Models</title>
    <meta
      name="description"
      content="Find the best electric bikes in India with modern features, strong range, and affordable electric bike prices. Explore top EV motorcycles for daily commuting."
    />
    <meta property="og:site_name" content="Revolt Motors" />
    <meta property="og:title" content="Revolt Electric Bikes- EV Bike Price India and Latest Models" />
    <link rel="canonical" href="https://www.revoltmotors.com" />
  </head>
  <body>
    <a href="https://www.rattanindia.com/">RattanIndia</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Revolt Motors Careers | Jobs and Hiring Opportunities</title>
    <link rel="canonical" href="https://www.revoltmotors.com/career-with-us" />
  </head>
  <body>
    <main>
      <h1>Build your career at Revolt</h1>
      <p>Check all our job openings</p>
      <label>Select Department</label>
      <label>Select Location</label>
      <button>Apply Filter</button>
      <div data-slot="card" class="text-card-foreground">
        <div data-slot="card-header">
          <div data-slot="card-title" class="text-xl font-bold">Vehicle Architecture</div>
          <div class="flex justify-between items-center text-sm text-[#0f0f0f] mt-2">
            <span>Manesar</span>
            <span>Research and Development</span>
          </div>
        </div>
        <div data-slot="card-content" class="px-6">
          <p>Visible teaser text for Vehicle Architecture.</p>
        </div>
      </div>
      <div data-slot="card" class="text-card-foreground">
        <div data-slot="card-header">
          <div data-slot="card-title" class="text-xl font-bold">Marketing Intern</div>
          <div class="flex justify-between items-center text-sm text-[#0f0f0f] mt-2">
            <span>Gurugram</span>
            <span>Marketing</span>
          </div>
        </div>
        <div data-slot="card-content" class="px-6">
          <p>Visible teaser text for Marketing Intern.</p>
        </div>
      </div>
    </main>
    <script>
      window.__REVOLT_INITIAL_DATA__ = {
        "initialDropdownData": {
          "locations": ["Manesar", "Gurugram"],
          "departments": ["Research and Development", "Marketing"]
        },
        "initialJobs": [
          {
            "id": 1,
            "requisition_date": "2026-05-10T18:30:00.000Z",
            "department": "Research and Development",
            "designation": "Vehicle Architecture",
            "position": null,
            "location": "Manesar",
            "exp": "3 - 8 Years",
            "qualifications": "B.Tech (Electronics, Electrical)",
            "short_text": "Structured teaser text for Vehicle Architecture.",
            "rnr": "$17",
            "priority": "HIGH",
            "type": "Full Time",
            "status": 1,
            "created_at": "2024-12-07T10:33:28.000Z",
            "updated_at": null,
            "created_by": null
          },
          {
            "id": 2,
            "requisition_date": "2026-05-12T18:30:00.000Z",
            "department": "Marketing",
            "designation": "Marketing Intern",
            "position": null,
            "location": "Gurugram",
            "exp": "0",
            "qualifications": "MBA",
            "short_text": "Structured teaser text for Marketing Intern.",
            "rnr": "$1f",
            "priority": "HIGH",
            "type": "Full Time",
            "status": 1,
            "created_at": "2024-12-26T12:12:55.000Z",
            "updated_at": null,
            "created_by": null
          }
        ]
      };
    </script>
  </body>
</html>
`

const streamedCareersHtml = careersHtml.replace(
  '<script>',
  `${String.raw`<script>
      self.__next_f.push([1,"0:{\\\"initialJobs\\\":[{\\\"id\\\":1,\\\"requisition_date\\\":\\\"2026-05-10T18:30:00.000Z\\\",\\\"department\\\":\\\"Research and Development\\\",\\\"designation\\\":\\\"Vehicle Architecture\\\",\\\"position\\\":null,\\\"location\\\":\\\"Manesar\\\",\\\"exp\\\":\\\"3 - 8 Years\\\",\\\"qualifications\\\":\\\"B.Tech (Electronics, Electrical)\\\",\\\"short_text\\\":\\\"Structured teaser text for Vehicle Architecture.\\\",\\\"rnr\\\":\\\"$17\\\",\\\"priority\\\":\\\"HIGH\\\",\\\"type\\\":\\\"Full Time\\\",\\\"status\\\":1,\\\"created_at\\\":\\\"2024-12-07T10:33:28.000Z\\\",\\\"updated_at\\\":null,\\\"created_by\\\":null},{\\\"id\\\":2,\\\"requisition_date\\\":\\\"2026-05-12T18:30:00.000Z\\\",\\\"department\\\":\\\"Marketing\\\",\\\"designation\\\":\\\"Marketing Intern\\\",\\\"position\\\":null,\\\"location\\\":\\\"Gurugram\\\",\\\"exp\\\":\\\"0\\\",\\\"qualifications\\\":\\\"MBA\\\",\\\"short_text\\\":\\\"Structured teaser text for Marketing Intern.\\\",\\\"rnr\\\":\\\"$1f\\\",\\\"priority\\\":\\\"HIGH\\\",\\\"type\\\":\\\"Full Time\\\",\\\"status\\\":1,\\\"created_at\\\":\\\"2024-12-26T12:12:55.000Z\\\",\\\"updated_at\\\":null,\\\"created_by\\\":null}]}"])</script>`}
    <script>`,
)

const loadModule = async () => {
  try {
    return await import('../../scraper/revolt/script.js')
  } catch {
    assert.fail('Expected Revolt scraper module at ../../scraper/revolt/script.js')
  }
}

test('Revolt helpers validate the official public careers surface and parse structured initialJobs payloads', async () => {
  const revolt = await loadModule()

  assert.equal(revolt.SOURCE, 'revolt')
  assert.equal(revolt.COMPANY, 'Revolt')
  assert.equal(revolt.HOMEPAGE_URL, 'https://www.revoltmotors.com/')
  assert.equal(revolt.CAREERS_URL, 'https://www.revoltmotors.com/career-with-us')
  assert.equal(revolt.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(revolt.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(revolt.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(revolt.extractStructuredInitialJobs(careersHtml).length, 2)

  const jobs = revolt.extractJobOpenings(careersHtml)
  assert.equal(jobs.length, 2)
  const marketingIntern = jobs.find((job) => job.title === 'Marketing Intern')
  const vehicleArchitecture = jobs.find((job) => job.title === 'Vehicle Architecture')
  assert.ok(marketingIntern)
  assert.ok(vehicleArchitecture)
  assert.equal(marketingIntern.experienceRequired, 'No experience required')
  assert.equal(marketingIntern.minimumQualification, 'MBA')
  assert.equal(vehicleArchitecture.experienceRequired, '3-8 years')
  assert.equal(vehicleArchitecture.minimumQualification, 'B.Tech (Electronics, Electrical)')
  assert.equal(vehicleArchitecture.employmentType, 'Full-time')
})

test('Revolt helpers parse the streamed escaped initialJobs payload used on the live careers page', async () => {
  const revolt = await loadModule()

  assert.equal(revolt.hasOfficialCareersSignal(streamedCareersHtml), true)
  assert.equal(revolt.extractStructuredInitialJobs(streamedCareersHtml).length, 2)

  const jobs = revolt.extractJobOpenings(streamedCareersHtml)
  const marketingIntern = jobs.find((job) => job.title === 'Marketing Intern')
  const vehicleArchitecture = jobs.find((job) => job.title === 'Vehicle Architecture')
  assert.ok(marketingIntern)
  assert.ok(vehicleArchitecture)
  assert.equal(marketingIntern.experienceRequired, 'No experience required')
  assert.equal(vehicleArchitecture.experienceRequired, '3-8 years')
})

test('Revolt run returns structured experience fields from the verified public payload', async () => {
  const revolt = await loadModule()

  const jobs = await revolt.createRevoltScraper().run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      if (url === revolt.HOMEPAGE_URL) return homepageHtml
      if (url === revolt.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Revolt URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 2)
  const marketingIntern = jobs.find((job) => job.title === 'Marketing Intern')
  const vehicleArchitecture = jobs.find((job) => job.title === 'Vehicle Architecture')
  assert.ok(marketingIntern)
  assert.ok(vehicleArchitecture)
  assert.equal(marketingIntern.source, 'revolt')
  assert.equal(marketingIntern.link, revolt.CAREERS_URL)
  assert.equal(marketingIntern.scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(marketingIntern.experienceRequired, 'No experience required')
  assert.equal(vehicleArchitecture.experienceRequired, '3-8 years')
})

test('Revolt run fails closed when the official careers page drifts', async () => {
  const revolt = await loadModule()

  await assert.rejects(
    revolt.createRevoltScraper().run({
      fetchText: async (url) => {
        if (url === revolt.HOMEPAGE_URL) return homepageHtml
        if (url === revolt.CAREERS_URL) {
          return '<html><head><title>Unexpected</title></head><body><p>No openings here</p></body></html>'
        }
        throw new Error(`Unexpected Revolt URL: ${url}`)
      },
    }),
    /careers page no longer matches/i,
  )
})
