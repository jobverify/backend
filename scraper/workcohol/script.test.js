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
    <title>Workcohol || Innovative Technology Solutions | Technology Service Provider Platform</title>
  </head>
  <body>
    <nav>
      <a href="https://www.workcohol.com/page-about">About us</a>
      <a href="https://www.workcohol.com/page-career">Careers</a>
      <a href="https://www.workcohol.com/page-contact">Contact</a>
    </nav>
    <main>
      <h1>Supercharge your Business with World-Class Technology.</h1>
      <p>Workcohol founded.</p>
      <p>Workcohol created to focus your work easier and more efficient.</p>
      <p>Workcohol is your trusted partner in navigating the digital landscape and achieving your business objectives.</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Workcohol || About Us | Leading Technology Service Provider</title>
  </head>
  <body>
    <main>
      <h1>About Workcohol</h1>
      <p>Empowering businesses with innovative technology solutions.</p>
      <p>Our mission is to make access to technology services seamless, transparent, and efficient.</p>
      <p>We believe in simplifying complex technology challenges.</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Workcohol || Contact Us | Get in Touch with Our Technology Experts</title>
  </head>
  <body>
    <main>
      <h1>Let's get in touch.</h1>
      <p>info@workcohol.com</p>
      <p>Workcohol Solutions Private Limited</p>
      <p>Tidel Park, Dotcoworks, Module 115 -D, North Block, First Floor, Rajiv Gandhi Salai, Taramani, Chennai - 600113</p>
      <p>DAL Towers, Old TCS Building, 16, Rajiv Gandhi Salai, Karapakkam, Chennai - 600097</p>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Workcohol || Careers | Join Our Innovative Technology Team</title>
  </head>
  <body>
    <main>
      <h2>Current openings</h2>
      <h5>Software Engineer</h5>
      <p>Remote</p>
      <a href="https://www.workcohol.com/page-career-detail/1">Apply now</a>

      <h5>Business Consultant</h5>
      <p>MENA Region (Remote/On-site)</p>
      <a href="https://www.workcohol.com/page-career-detail/2">Apply now</a>

      <h5>Client Acquisition Specialist</h5>
      <p>Chennai (Onsite)</p>
      <a href="https://www.workcohol.com/page-career-detail/3">Apply now</a>
    </main>
  </body>
</html>
`

const softwareEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Workcohol || Careers | Join Our Innovative Technology Team</title>
  </head>
  <body>
    <main>
      <h1>Software Engineer</h1>
      <h3>Software Engineer</h3>
      <p>Experience Level: 5+ Years</p>
      <p>Job Type: Full-Time</p>
      <p>Salary: Competitive, based on experience</p>
      <p>Reports to: Engineering Manager/Lead Developer</p>
      <h3>Overview:</h3>
      <p>Design and deploy scalable software solutions.</p>
      <h3>Key Responsibilities:</h3>
      <ul>
        <li>Build and maintain applications.</li>
        <li>Collaborate with cross-functional teams.</li>
      </ul>
      <h3>Required Skills & Qualifications:</h3>
      <ul>
        <li>Java</li>
        <li>Python</li>
      </ul>
      <h3>Preferred Qualifications:</h3>
      <ul>
        <li>AWS exposure</li>
      </ul>
      <h4>Job details</h4>
      <h5>Position</h5>
      <p>Software Engineer</p>
      <h5>Experience Level</h5>
      <p>5+ Years</p>
      <h5>Salary</h5>
      <p>Competitive, based on experience</p>
    </main>
  </body>
</html>
`

const clientAcquisitionDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Workcohol || Careers | Join Our Innovative Technology Team</title>
  </head>
  <body>
    <main>
      <h1>Client Acquisition Specialist</h1>
      <h3>Client Acquisition Specialist</h3>
      <p>Experience Level: 2+ Years</p>
      <p>Job Type: Full-Time</p>
      <p>Salary: Incentive-based</p>
      <p>Reports to: Growth Lead</p>
      <h3>Overview:</h3>
      <p>Own prospecting and client conversations for Workcohol growth.</p>
      <h3>Key Responsibilities:</h3>
      <ul>
        <li>Generate qualified leads.</li>
        <li>Coordinate discovery calls.</li>
      </ul>
      <h3>Required Skills & Qualifications:</h3>
      <ul>
        <li>Communication</li>
        <li>B2B sales</li>
      </ul>
      <h3>Preferred Qualifications:</h3>
      <ul>
        <li>Chennai market familiarity</li>
      </ul>
      <h4>Job details</h4>
      <h5>Position</h5>
      <p>Client Acquisition Specialist</p>
      <h5>Experience Level</h5>
      <p>2+ Years</p>
      <h5>Salary</h5>
      <p>Incentive-based</p>
    </main>
  </body>
</html>
`

test('Workcohol validates the verified homepage, careers page, about page, contact page, and extracts same-domain detail roles', async () => {
  const workcohol = await loadModule()
  assert.ok(workcohol, 'Workcohol scraper module should load')

  assert.equal(workcohol.SOURCE, 'workcohol')
  assert.equal(workcohol.COMPANY, 'Workcohol')
  assert.equal(workcohol.HOMEPAGE_URL, 'https://www.workcohol.com/')
  assert.equal(workcohol.CAREERS_URL, 'https://www.workcohol.com/page-career')
  assert.equal(workcohol.ABOUT_URL, 'https://www.workcohol.com/page-about')
  assert.equal(workcohol.CONTACT_URL, 'https://www.workcohol.com/page-contact')
  assert.equal(workcohol.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(workcohol.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(workcohol.hasOfficialContactSignal(contactHtml), true)
  assert.equal(workcohol.hasOfficialCareersSignal(careersHtml), true)

  const openings = workcohol.extractCareerCards(careersHtml)
  assert.deepEqual(
    openings.map((job) => ({ title: job.title, locationLabel: job.locationLabel, detailUrl: job.detailUrl })),
    [
      {
        title: 'Software Engineer',
        locationLabel: 'Remote',
        detailUrl: 'https://www.workcohol.com/page-career-detail/1',
      },
      {
        title: 'Business Consultant',
        locationLabel: 'MENA Region (Remote/On-site)',
        detailUrl: 'https://www.workcohol.com/page-career-detail/2',
      },
      {
        title: 'Client Acquisition Specialist',
        locationLabel: 'Chennai (Onsite)',
        detailUrl: 'https://www.workcohol.com/page-career-detail/3',
      },
    ],
  )
})

test('Workcohol run validates first-party surfaces, excludes non-India roles, and decorates same-domain detail jobs', async () => {
  const workcohol = await loadModule()
  assert.ok(workcohol, 'Workcohol scraper module should load')

  const requestedUrls = []
  const jobs = await workcohol.createWorkcoholScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === workcohol.HOMEPAGE_URL) return homepageHtml
      if (url === workcohol.ABOUT_URL) return aboutHtml
      if (url === workcohol.CONTACT_URL) return contactHtml
      if (url === workcohol.CAREERS_URL) return careersHtml
      if (url === 'https://www.workcohol.com/page-career-detail/1') return softwareEngineerDetailHtml
      if (url === 'https://www.workcohol.com/page-career-detail/3') return clientAcquisitionDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    workcohol.HOMEPAGE_URL,
    workcohol.ABOUT_URL,
    workcohol.CONTACT_URL,
    workcohol.CAREERS_URL,
    'https://www.workcohol.com/page-career-detail/1',
    'https://www.workcohol.com/page-career-detail/3',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({ title: job.title, location: job.location, country: job.country, applyUrl: job.applyUrl })),
    [
      {
        title: 'Software Engineer',
        location: 'Remote',
        country: 'India',
        applyUrl: 'https://www.workcohol.com/page-career-detail/1',
      },
      {
        title: 'Client Acquisition Specialist',
        location: 'Chennai, India',
        country: 'India',
        applyUrl: 'https://www.workcohol.com/page-career-detail/3',
      },
    ],
  )
  assert.ok(jobs[0].jobId.startsWith('workcohol-'))
  assert.ok(jobs[0].scrapedAt)
})

test('Workcohol fails closed when the homepage, careers page, about page, contact page, or detail surface changes materially', async () => {
  const workcohol = await loadModule()
  assert.ok(workcohol, 'Workcohol scraper module should load')

  await assert.rejects(
    workcohol.createWorkcoholScraper().run({
      fetchText: async (url) => {
        if (url === workcohol.HOMEPAGE_URL) return '<html><body><h1>Placeholder</h1></body></html>'
        if (url === workcohol.ABOUT_URL) return aboutHtml
        if (url === workcohol.CONTACT_URL) return contactHtml
        if (url === workcohol.CAREERS_URL) return careersHtml
        if (url === 'https://www.workcohol.com/page-career-detail/1') return softwareEngineerDetailHtml
        if (url === 'https://www.workcohol.com/page-career-detail/3') return clientAcquisitionDetailHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    workcohol.createWorkcoholScraper().run({
      fetchText: async (url) => {
        if (url === workcohol.HOMEPAGE_URL) return homepageHtml
        if (url === workcohol.ABOUT_URL) return '<html><body><h1>About</h1></body></html>'
        if (url === workcohol.CONTACT_URL) return contactHtml
        if (url === workcohol.CAREERS_URL) return careersHtml
        if (url === 'https://www.workcohol.com/page-career-detail/1') return softwareEngineerDetailHtml
        if (url === 'https://www.workcohol.com/page-career-detail/3') return clientAcquisitionDetailHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about/i,
  )

  await assert.rejects(
    workcohol.createWorkcoholScraper().run({
      fetchText: async (url) => {
        if (url === workcohol.HOMEPAGE_URL) return homepageHtml
        if (url === workcohol.ABOUT_URL) return aboutHtml
        if (url === workcohol.CONTACT_URL) return '<html><body><h1>Contact</h1></body></html>'
        if (url === workcohol.CAREERS_URL) return careersHtml
        if (url === 'https://www.workcohol.com/page-career-detail/1') return softwareEngineerDetailHtml
        if (url === 'https://www.workcohol.com/page-career-detail/3') return clientAcquisitionDetailHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact/i,
  )

  await assert.rejects(
    workcohol.createWorkcoholScraper().run({
      fetchText: async (url) => {
        if (url === workcohol.HOMEPAGE_URL) return homepageHtml
        if (url === workcohol.ABOUT_URL) return aboutHtml
        if (url === workcohol.CONTACT_URL) return contactHtml
        if (url === workcohol.CAREERS_URL) return '<html><body><h2>Open roles</h2></body></html>'
        if (url === 'https://www.workcohol.com/page-career-detail/1') return softwareEngineerDetailHtml
        if (url === 'https://www.workcohol.com/page-career-detail/3') return clientAcquisitionDetailHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    workcohol.createWorkcoholScraper().run({
      fetchText: async (url) => {
        if (url === workcohol.HOMEPAGE_URL) return homepageHtml
        if (url === workcohol.ABOUT_URL) return aboutHtml
        if (url === workcohol.CONTACT_URL) return contactHtml
        if (url === workcohol.CAREERS_URL) return careersHtml
        if (url === 'https://www.workcohol.com/page-career-detail/1') return '<html><body><h1>Broken detail</h1></body></html>'
        if (url === 'https://www.workcohol.com/page-career-detail/3') return clientAcquisitionDetailHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /detail/i,
  )
})

test('Workcohol returns [] while the verified first-party host is TLS-blocked', async () => {
  const workcohol = await loadModule()
  assert.ok(workcohol, 'Workcohol scraper module should load')

  const blockedError = new Error('fetch failed')
  blockedError.cause = new Error('certificate has expired')

  assert.equal(workcohol.hasBlockedTlsFailure(blockedError), true)

  const jobs = await workcohol.createWorkcoholScraper().run({
    fetchText: async () => {
      throw blockedError
    },
  })

  assert.deepEqual(jobs, [])
})
