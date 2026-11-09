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
      <title>Home - tringapps</title>
      <meta
        name="description"
        content="Tringapps is a full-stack digital transformation company specializing in AI, FinTech, cloud, mobile, and OTT solutions. Explore our services!"
      />
    </head>
    <body>
      <main>
        <h1>Transform Ideas into Innovation</h1>
        <p>Build Next-Gen Digital Products with AI, ML &amp; Cloud to Drive Innovation, Scalability, and Engagement</p>
        <a href="https://tringapps.com/about-us/">About us</a>
        <a href="https://tringapps.com/career/">Careers</a>
        <a href="https://tringapps.com/contact-us/">Contact us</a>
      </main>
    </body>
  </html>
`

const aboutHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h2>Who we are</h2>
        <p>One vision. Infinite possibilities.</p>
        <p>Tringapps Inc, a part of Jean Martin Inc. (JMI), along with other affiliates forms a global powerhouse in technology, research, and analytics.</p>
        <p>With over 2,000 employees across ten global locations including the United States, Colombia, India, Dubai and Japan.</p>
        <p>Empowering businesses through cutting-edge technology, research, and analytics solutions.</p>
        <p>500+ Clients</p>
      </main>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h2>Shape Your Future with Us</h2>
        <p>Discover opportunities</p>
        <p>India</p>
        <p>USA</p>

        <h3>Senior SRE Specialist</h3>
        <p>10+ Yrs</p>
        <p>Full Time</p>
        <p>Remote</p>
        <p>India</p>
        <p>Openings: 2</p>
        <p>Who we need</p>
        <p>Who We Need Senior SRE Specialist. Roles and Responsibility Design, implement, and manage highly available, scalable, and fault-tolerant infrastructure on AWS.</p>
        <p>View Details Apply Now</p>
        <h2>Job Details</h2>
        <h2>Senior SRE Specialist</h2>
        <p>Location: Remote</p>
        <p>Type: Full Time</p>
        <p>Experience: 10+ Yrs</p>
        <p>Openings: 2</p>
        <p>Requirements</p>
        <ul>
          <li>AWS</li>
          <li>Terraform</li>
          <li>CI/CD</li>
        </ul>
        <h3>Apply Here</h3>
        <form><input name="resume" /></form>

        <h3>Citrix Admin</h3>
        <p>Full Time</p>
        <p>Remote</p>
        <p>India</p>
        <p>Openings: 2</p>
        <p>Who we need</p>
        <p>Who We Need Citrix Admin. Roles and Responsibility Administer, maintain, and support Citrix Virtual Apps and Desktops environments in enterprise production setups.</p>
        <p>View Details Apply Now</p>
        <h2>Job Details</h2>
        <h2>Citrix Admin</h2>
        <p>Location: Remote</p>
        <p>Type: Full Time</p>
        <p>Requirements</p>
        <ul>
          <li>Citrix Administration</li>
          <li>Windows Server</li>
          <li>VMware</li>
        </ul>
        <h3>Apply Here</h3>
        <form><input name="resume" /></form>

        <h3>Service Desk Agent</h3>
        <p>7+ Yrs</p>
        <p>Full Time</p>
        <p>Burbank, CA</p>
        <p>USA</p>
        <p>Openings: 3</p>
        <p>Who we need</p>
        <p>Who We Need Service Desk Agent. Roles and Responsibility Provide Level 1 and Level 2 technical support via phone, email, chat and web.</p>
        <p>View Details Apply Now</p>
        <h2>Job Details</h2>
        <h2>Service Desk Agent</h2>
        <p>Location: Burbank, CA</p>
        <p>Type: Full Time</p>
        <p>Requirements</p>
        <ul>
          <li>Customer Support</li>
        </ul>
        <h3>Apply Here</h3>
        <form><input name="resume" /></form>
      </main>
    </body>
  </html>
`

const contactHtml = `
  <!doctype html>
  <html lang="en">
    <body>
      <main>
        <h2>Let's Connect</h2>
        <p>Have questions or ready to collaborate? Reach out to us.</p>
        <h2>Keep in touch</h2>
        <p>Which division should we connect you to</p>
        <h2>Global Locations</h2>
        <p>New York City, NY</p>
        <p>Mumbai, India</p>
        <p>Chennai, India</p>
        <p>Madurai, India</p>
      </main>
      <footer>© 2025 TRINGAPPS, INC. ALL RIGHTS RESERVED</footer>
    </body>
  </html>
`

test('tringapps validates the official pages and extracts only India roles from the first-party careers page', async () => {
  const tringapps = await loadModule()
  assert.ok(tringapps, 'tringapps scraper module should load')

  assert.equal(tringapps.SOURCE, 'tringapps')
  assert.equal(tringapps.COMPANY, 'tringapps')
  assert.equal(tringapps.HOMEPAGE_URL, 'https://tringapps.com/')
  assert.equal(tringapps.ABOUT_URL, 'https://tringapps.com/about-us/')
  assert.equal(tringapps.CAREERS_URL, 'https://tringapps.com/careers/')
  assert.equal(tringapps.CONTACT_URL, 'https://tringapps.com/contact-us/')
  assert.equal(tringapps.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(tringapps.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(tringapps.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(tringapps.hasOfficialContactSignal(contactHtml), true)
  assert.deepEqual(tringapps.extractJobCards(careersHtml), [{
    title: 'Senior SRE Specialist',
    company: 'tringapps',
    department: null,
    location: 'Remote, India',
    city: 'Remote',
    country: 'India',
    jobId: 'tringapps-senior-sre-specialist-remote-india',
    requisitionId: 'tringapps-senior-sre-specialist-remote-india',
    sourceUrl: 'https://tringapps.com/careers/',
    applyUrl: 'https://tringapps.com/careers/',
    employmentType: 'Full-time',
    experienceRequired: '10+ Yrs',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['AWS', 'Terraform', 'CI/CD'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Who We Need Senior SRE Specialist. Roles and Responsibility Design, implement, and manage highly available, scalable, and fault-tolerant infrastructure on AWS.',
  }, {
    title: 'Citrix Admin',
    company: 'tringapps',
    department: null,
    location: 'Remote, India',
    city: 'Remote',
    country: 'India',
    jobId: 'tringapps-citrix-admin-remote-india',
    requisitionId: 'tringapps-citrix-admin-remote-india',
    sourceUrl: 'https://tringapps.com/careers/',
    applyUrl: 'https://tringapps.com/careers/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: ['Citrix Administration', 'Windows Server', 'VMware'],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Who We Need Citrix Admin. Roles and Responsibility Administer, maintain, and support Citrix Virtual Apps and Desktops environments in enterprise production setups.',
  }])
})

test('tringapps scraper run decorates the verified India roles from the first-party careers page', async () => {
  const tringapps = await loadModule()
  assert.ok(tringapps, 'tringapps scraper module should load')

  const requestedUrls = []
  const jobs = await tringapps.createTringappsScraper({
    now: () => '2026-07-12T12:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tringapps.HOMEPAGE_URL) return homepageHtml
      if (url === tringapps.ABOUT_URL) return aboutHtml
      if (url === tringapps.CAREERS_URL) return careersHtml
      if (url === tringapps.CONTACT_URL) return contactHtml
      throw new Error(`Unexpected tringapps URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://tringapps.com/',
    'https://tringapps.com/about-us/',
    'https://tringapps.com/careers/',
    'https://tringapps.com/contact-us/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    {
      titles: jobs.map((job) => job.title),
      sources: [...new Set(jobs.map((job) => job.source))],
      links: [...new Set(jobs.map((job) => job.link))],
      scrapedAt: [...new Set(jobs.map((job) => job.scrapedAt))],
    },
    {
      titles: ['Senior SRE Specialist', 'Citrix Admin'],
      sources: ['tringapps'],
      links: ['https://tringapps.com/careers/'],
      scrapedAt: ['2026-07-12T12:00:00.000Z'],
    },
  )
})

test('tringapps scraper fails closed when the first-party pages change materially', async () => {
  const tringapps = await loadModule()
  assert.ok(tringapps, 'tringapps scraper module should load')

  await assert.rejects(
    tringapps.createTringappsScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected homepage</h1></body></html>',
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    tringapps.createTringappsScraper().run({
      fetchText: async (url) => {
        if (url === tringapps.HOMEPAGE_URL) return homepageHtml
        if (url === tringapps.ABOUT_URL) return aboutHtml
        return '<html><body><h1>Unexpected careers page</h1></body></html>'
      },
    }),
    /verified first-party careers page/i,
  )
})
