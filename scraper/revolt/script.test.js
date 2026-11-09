import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Revolt Electric Bikes- EV Bike Price India and Latest Models</title>
      <meta
        name="description"
        content="Find the best electric bikes in India with modern features, strong range, and affordable electric bike prices. Explore top EV motorcycles for daily commuting."
      />
      <meta property="og:site_name" content="Revolt Motors" />
    </head>
    <body>
      <a href="/" aria-label="Revolt Motors Homepage">Home</a>
      <a href="/career-with-us">Career</a>
      <a href="/support">Support</a>
      <p>contact@revoltmotors.com</p>
      <p>© 2026 Revolt Intellicorp Private Limited. All rights reserved.</p>
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
      <meta
        name="description"
        content="Apply for revolt career opportunities and join revolt careers india to work with an electric mobility company building advanced electric bikes."
      />
      <link rel="canonical" href="https://www.revoltmotors.com/career-with-us" />
    </head>
    <body>
      <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              "url": "https://www.revoltmotors.com/career-with-us",
              "name": "Revolt Motors Careers | Jobs and Hiring Opportunities"
            }
          ]
        }
      </script>
      <h2>Build your career at Revolt</h2>
      <label for="department">Check all our job openings</label>
      <select id="department">
        <option value="" selected="">Select Department</option>
        <option value="Research and Development">Research and Development</option>
        <option value="Dealer Development">Dealer Development</option>
        <option value="IT">IT</option>
        <option value="Marketing">Marketing</option>
      </select>
      <select id="location">
        <option value="" selected="">Select Location</option>
        <option value="Manesar">Manesar</option>
        <option value="Bangalore, Kolkata">Bangalore, Kolkata</option>
        <option value="GURUGRAM">GURUGRAM</option>
      </select>
      <button type="submit">Apply Filter</button>
      <div class="grid grid-cols-3 gap-[32px] max-w-[964px] mx-auto">
        <div data-slot="card" class="text-card-foreground gap-6 rounded-xl py-6 cursor-pointer h-[250px] bg-[#FFFFFF] border-0 shadow-none flex flex-col justify-center">
          <div data-slot="card-header" class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6">
            <div data-slot="card-title" class="text-xl font-bold">Vehicle Architecture</div>
            <div class="flex justify-between items-center text-sm text-[#0f0f0f] mt-2">
              <span>Manesar</span>
              <span class="bg-secondary px-2 py-1 rounded text-secondary-foreground text-xs">Research and Development</span>
            </div>
          </div>
          <div data-slot="card-content" class="px-6">
            <p class="text-sm line-clamp-3 text-[#0f0f0f]">Revolt started with a vision of making clean commuting accessible to the masses by using next-gen mobility solutions.</p>
          </div>
        </div>
        <div data-slot="card" class="text-card-foreground gap-6 rounded-xl py-6 cursor-pointer h-[250px] bg-[#FFFFFF] border-0 shadow-none flex flex-col justify-center">
          <div data-slot="card-header" class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6">
            <div data-slot="card-title" class="text-xl font-bold">Dealer Development Manager</div>
            <div class="flex justify-between items-center text-sm text-[#0f0f0f] mt-2">
              <span>Bangalore, Kolkata</span>
              <span class="bg-secondary px-2 py-1 rounded text-secondary-foreground text-xs">Dealer Development</span>
            </div>
          </div>
          <div data-slot="card-content" class="px-6">
            <p class="text-sm line-clamp-3 text-[#0f0f0f]">To expand and strengthen the dealer network of Revolt Motors by identifying new business opportunities.</p>
          </div>
        </div>
        <div data-slot="card" class="text-card-foreground gap-6 rounded-xl py-6 cursor-pointer h-[250px] bg-[#FFFFFF] border-0 shadow-none flex flex-col justify-center">
          <div data-slot="card-header" class="@container/card-header grid auto-rows-min grid-rows-[auto_auto] items-start gap-2 px-6">
            <div data-slot="card-title" class="text-xl font-bold">IT Head</div>
            <div class="flex justify-between items-center text-sm text-[#0f0f0f] mt-2">
              <span>GURUGRAM</span>
              <span class="bg-secondary px-2 py-1 rounded text-secondary-foreground text-xs">IT</span>
            </div>
          </div>
          <div data-slot="card-content" class="px-6">
            <p class="text-sm line-clamp-3 text-[#0f0f0f]">At Revolt Motors, part of the RattanIndia Group, we are building the future of mobility through technology.</p>
          </div>
        </div>
      </div>
    </body>
  </html>
`

test('Revolt scraper recognizes the verified first-party homepage and careers surface', async () => {
  const revolt = await loadModule()
  assert.ok(revolt, 'Revolt scraper module should load')

  assert.equal(revolt.SOURCE, 'revolt')
  assert.equal(revolt.COMPANY, 'Revolt')
  assert.equal(revolt.HOMEPAGE_URL, 'https://www.revoltmotors.com/')
  assert.equal(revolt.CAREERS_URL, 'https://www.revoltmotors.com/career-with-us')
  assert.equal(revolt.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(revolt.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(revolt.hasOfficialCareersSignal(careersHtml), true)
})

test('Revolt scraper extracts first-party role cards into the shared contract shape', async () => {
  const revolt = await loadModule()
  assert.ok(revolt, 'Revolt scraper module should load')

  assert.deepEqual(revolt.extractJobOpenings(careersHtml), [
    {
      title: 'Vehicle Architecture',
      company: 'Revolt',
      location: 'Manesar, India',
      city: 'Manesar',
      country: 'India',
      department: 'Research and Development',
      jobId: 'revolt-vehicle-architecture-research-and-development-manesar',
      requisitionId: 'revolt-vehicle-architecture-research-and-development-manesar',
      sourceUrl: 'https://www.revoltmotors.com/career-with-us',
      applyUrl: 'https://www.revoltmotors.com/career-with-us',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Revolt started with a vision of making clean commuting accessible to the masses by using next-gen mobility solutions.',
    },
    {
      title: 'Dealer Development Manager',
      company: 'Revolt',
      location: 'Bangalore, Kolkata, India',
      city: null,
      country: 'India',
      department: 'Dealer Development',
      jobId: 'revolt-dealer-development-manager-dealer-development-bangalore-kolkata',
      requisitionId: 'revolt-dealer-development-manager-dealer-development-bangalore-kolkata',
      sourceUrl: 'https://www.revoltmotors.com/career-with-us',
      applyUrl: 'https://www.revoltmotors.com/career-with-us',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'To expand and strengthen the dealer network of Revolt Motors by identifying new business opportunities.',
    },
    {
      title: 'IT Head',
      company: 'Revolt',
      location: 'Gurugram, India',
      city: 'Gurugram',
      country: 'India',
      department: 'IT',
      jobId: 'revolt-it-head-it-gurugram',
      requisitionId: 'revolt-it-head-it-gurugram',
      sourceUrl: 'https://www.revoltmotors.com/career-with-us',
      applyUrl: 'https://www.revoltmotors.com/career-with-us',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'At Revolt Motors, part of the RattanIndia Group, we are building the future of mobility through technology.',
    },
  ])
})

test('Revolt run validates the first-party surface and decorates jobs', async () => {
  const revolt = await loadModule()
  assert.ok(revolt, 'Revolt scraper module should load')

  const requestedUrls = []
  const jobs = await revolt.createRevoltScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === revolt.HOMEPAGE_URL) return homepageHtml
      if (url === revolt.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-11T05:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    revolt.HOMEPAGE_URL,
    revolt.CAREERS_URL,
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'revolt')
  assert.equal(jobs[0].link, 'https://www.revoltmotors.com/career-with-us')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T05:30:00.000Z')
})

test('Revolt fails closed when the verified public surface changes', async () => {
  const revolt = await loadModule()
  assert.ok(revolt, 'Revolt scraper module should load')

  await assert.rejects(
    revolt.createRevoltScraper().run({
      fetchText: async () => '<html><title>Home</title></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    revolt.createRevoltScraper().run({
      fetchText: async (url) => {
        if (url === revolt.HOMEPAGE_URL) return homepageHtml
        if (url === revolt.CAREERS_URL) return careersHtml.replace('Build your career at Revolt', 'Jobs')
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )
})
