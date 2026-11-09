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
  <html>
    <head>
      <title>Zeon Charging — EV Charging Solutions</title>
      <link rel="canonical" href="https://zeoncharging.com/">
    </head>
    <body>
      <header>
        <a href="/locations">Locations</a>
        <a href="/business">Business</a>
      </header>
      <p>Our Charging Network</p>
      <p>Find Nearest Station</p>
      <footer>
        <a href="/careers">Careers</a>
      </footer>
    </body>
  </html>
`

const aboutHtml = `
  <html>
    <body>
      <h1>About Zeon</h1>
      <p>Zeon Electric Pvt Ltd is building EV charging infrastructure across India.</p>
    </body>
  </html>
`

const contactHtml = `
  <html>
    <body>
      <h1>Contact Us</h1>
      <p>Tiruppur, Tamil Nadu, India</p>
      <a href="mailto:care@zeoncharging.com">care@zeoncharging.com</a>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <body>
      <section>
        <h1>Join Us</h1>
        <h2>Open Positions</h2>
        <div class="card">
          <div class="col-xs-6 pad_lr">Tiruppur</div>
          <div class="experience col-xs-6">Fresher</div>
          <h3 id="job_title_184653">Customer Support Executive</h3>
          <h6>Customer Support</h6>
          <p>Support Zeon's EV charging customers across India.<a href="JavaScript:show_job_role('184653');">more..</a></p>
          <div id="job_role_184653" class="hide">
            <h3>Job Type</h3>
            <p>Full-time</p>
          </div>
        </div>
        <div class="card">
          <div class="col-xs-6 pad_lr">Tiruppur</div>
          <div class="experience col-xs-6">2 to 3 years</div>
          <h3 id="job_title_184655">Team Lead - Customer Support</h3>
          <h6>Team Leader</h6>
          <p>Lead the support team and improve customer issue resolution.<a href="JavaScript:show_job_role('184655');">more..</a></p>
          <div id="job_role_184655" class="hide">
            <h3>Job Type</h3>
            <p>Full-time</p>
          </div>
        </div>
        <div class="card">
          <div class="col-xs-6 pad_lr">Tiruppur</div>
          <div class="experience col-xs-6">Fresher</div>
          <h3 id="job_title_185492">Internship - Infrastructure Development</h3>
          <h6>Internship</h6>
          <p>Assist the infrastructure team with charging-network rollout work.<a href="JavaScript:show_job_role('185492');">more..</a></p>
          <div id="job_role_185492" class="hide">
            <h3>Job Type</h3>
            <p>Internship</p>
          </div>
        </div>
      </section>
    </body>
  </html>
`

const modernCareersHtml = `
  <html>
    <body>
      <section>
        <h1>Join Us</h1>
        <h2>Open Positions</h2>
        <article class="job-card">
          <div>
            <div>Tiruppur</div>
            <div>Fresher</div>
          </div>
          <div>
            <h3>Customer Support Executive</h3>
            <h6>Customer Support</h6>
            <div>
              Full-time customer support role handling phone, chat, and email queries related to charging, payments, and app issues.
              <details>
                <summary>more..</summary>
                <span>Additional details</span>
              </details>
            </div>
          </div>
          <div>
            <a href="https://zeoncharging.com/?fx=zeon__apply_job&amp;menu_off=1&amp;job_id=184653">Apply Now</a>
          </div>
        </article>
        <article class="job-card">
          <div>
            <div>Tiruppur</div>
            <div>2 to 3 years</div>
          </div>
          <div>
            <h3>Team Lead - Customer Support</h3>
            <h6>Team Leader</h6>
            <div>
              The Customer Support Team Lead will oversee and mentor the support team, manage daily operations and escalations, monitor KPIs, and drive process improvements.
              <details>
                <summary>more..</summary>
                <span>Additional details</span>
              </details>
            </div>
          </div>
          <div>
            <a href="https://zeoncharging.com/?fx=zeon__apply_job&amp;menu_off=1&amp;job_id=184655">Apply Now</a>
          </div>
        </article>
        <article class="job-card">
          <div>
            <div>Tiruppur</div>
            <div>Fresher</div>
          </div>
          <div>
            <h3>Internship \u2013 Infrastructure Development</h3>
            <h6>Internship</h6>
            <div>
              Field-based internship for final-year or recent EEE graduates focused on EV charging infrastructure development.
              <details>
                <summary>more..</summary>
                <span>Additional details</span>
              </details>
            </div>
          </div>
          <div>
            <a href="https://zeoncharging.com/?fx=zeon__apply_job&amp;menu_off=1&amp;job_id=185492">Apply Now</a>
          </div>
        </article>
      </section>
    </body>
  </html>
`

test('Zeon Charging constants stay pinned to the verified legacy redirect, legal-name, contact, and careers contract', async () => {
  const zeon = await loadModule()
  assert.ok(zeon, 'Zeon Charging scraper module should load')

  assert.equal(zeon.SOURCE, 'zeoncharging')
  assert.equal(zeon.COMPANY, 'Zeon Electric Pvt Ltd')
  assert.equal(zeon.LEGACY_HOMEPAGE_URL, 'https://zeonelectric.in/')
  assert.equal(zeon.HOMEPAGE_URL, 'https://zeoncharging.com/')
  assert.equal(zeon.ABOUT_URL, 'https://zeoncharging.com/about_us')
  assert.equal(zeon.CONTACT_URL, 'https://zeoncharging.com/contact_us')
  assert.equal(zeon.CAREERS_URL, 'https://zeoncharging.com/careers')
  assert.equal(zeon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(zeon.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(zeon.hasOfficialContactSignal(contactHtml), true)
  assert.equal(zeon.hasOfficialCareersSignal(modernCareersHtml), true)
})

test('extractJobCards returns the verified inline Zeon roles from the public careers page', async () => {
  const zeon = await loadModule()
  assert.ok(zeon, 'Zeon Charging scraper module should load')

  assert.deepEqual(zeon.extractJobCards(careersHtml), [
    {
      title: 'Customer Support Executive',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Customer Support',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-184653',
      requisitionId: '184653',
      sourceUrl: 'https://zeoncharging.com/careers#job-184653',
      applyUrl: 'https://zeoncharging.com/careers#job-184653',
      employmentType: 'Full-time',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Support Zeon\'s EV charging customers across India.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Team Lead - Customer Support',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Team Leader',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-184655',
      requisitionId: '184655',
      sourceUrl: 'https://zeoncharging.com/careers#job-184655',
      applyUrl: 'https://zeoncharging.com/careers#job-184655',
      employmentType: 'Full-time',
      experienceRequired: '2 to 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Lead the support team and improve customer issue resolution.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Internship - Infrastructure Development',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Internship',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-185492',
      requisitionId: '185492',
      sourceUrl: 'https://zeoncharging.com/careers#job-185492',
      applyUrl: 'https://zeoncharging.com/careers#job-185492',
      employmentType: 'Internship',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Assist the infrastructure team with charging-network rollout work.',
      remoteStatus: 'On-site',
    },
  ])
})

test('extractJobCards returns the current article-based Zeon roles from the public careers page', async () => {
  const zeon = await loadModule()
  assert.ok(zeon, 'Zeon Charging scraper module should load')

  assert.deepEqual(zeon.extractJobCards(modernCareersHtml), [
    {
      title: 'Customer Support Executive',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Customer Support',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-184653',
      requisitionId: '184653',
      sourceUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184653',
      applyUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184653',
      employmentType: 'Full-time',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Full-time customer support role handling phone, chat, and email queries related to charging, payments, and app issues.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Team Lead - Customer Support',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Team Leader',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-184655',
      requisitionId: '184655',
      sourceUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184655',
      applyUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184655',
      employmentType: null,
      experienceRequired: '2 to 3 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'The Customer Support Team Lead will oversee and mentor the support team, manage daily operations and escalations, monitor KPIs, and drive process improvements.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Internship \u2013 Infrastructure Development',
      company: 'Zeon Electric Pvt Ltd',
      department: 'Internship',
      location: 'Tiruppur, India',
      city: 'Tiruppur',
      state: null,
      country: 'India',
      jobId: 'zeoncharging-185492',
      requisitionId: '185492',
      sourceUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=185492',
      applyUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=185492',
      employmentType: 'Internship',
      experienceRequired: 'Fresher',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Field-based internship for final-year or recent EEE graduates focused on EV charging infrastructure development.',
      remoteStatus: 'On-site',
    },
  ])
})

test('run validates the Zeon first-party chain and decorates careers-page roles', async () => {
  const zeon = await loadModule()
  assert.ok(zeon, 'Zeon Charging scraper module should load')

  const requestedUrls = []
  const jobs = await zeon.createZeonChargingScraper({ maxJobs: 2 }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === zeon.LEGACY_HOMEPAGE_URL) {
        return {
          status: 200,
          url: zeon.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }
      if (url === zeon.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === zeon.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === zeon.CAREERS_URL) return { status: 200, url, html: modernCareersHtml }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-12T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    zeon.LEGACY_HOMEPAGE_URL,
    zeon.ABOUT_URL,
    zeon.CONTACT_URL,
    zeon.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'zeoncharging')
  assert.equal(jobs[0].link, 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184653')
  assert.equal(jobs[0].scrapedAt, '2026-07-12T00:00:00.000Z')
})

test('run falls back to rendered careers cards when the static HTML no longer contains the public roles', async () => {
  const zeon = await loadModule()
  assert.ok(zeon, 'Zeon Charging scraper module should load')

  const jobs = await zeon.createZeonChargingScraper({ maxJobs: 2 }).run({
    fetchPage: async (url) => {
      if (url === zeon.LEGACY_HOMEPAGE_URL) {
        return {
          status: 200,
          url: zeon.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }
      if (url === zeon.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === zeon.CONTACT_URL) return { status: 200, url, html: contactHtml }
      if (url === zeon.CAREERS_URL) {
        return {
          status: 200,
          url,
          html: '<html><head><title>EV Charging Jobs in India | Careers at Zeon Charging</title></head><body></body></html>',
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    extractRenderedJobs: async () => [
      {
        title: 'Customer Support Executive',
        company: 'Zeon Electric Pvt Ltd',
        department: 'Customer Support',
        location: 'Tiruppur, India',
        city: 'Tiruppur',
        state: null,
        country: 'India',
        jobId: 'zeoncharging-184653',
        requisitionId: '184653',
        sourceUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184653',
        applyUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184653',
        employmentType: null,
        experienceRequired: 'Fresher',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Full-time customer support role handling phone, chat, and email queries related to charging, payments, and app issues.',
        remoteStatus: 'On-site',
      },
      {
        title: 'Team Lead - Customer Support',
        company: 'Zeon Electric Pvt Ltd',
        department: 'Team Leader',
        location: 'Tiruppur, India',
        city: 'Tiruppur',
        state: null,
        country: 'India',
        jobId: 'zeoncharging-184655',
        requisitionId: '184655',
        sourceUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184655',
        applyUrl: 'https://zeoncharging.com/?fx=zeon__apply_job&menu_off=1&job_id=184655',
        employmentType: null,
        experienceRequired: '2 to 3 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'The Customer Support Team Lead will oversee and mentor the support team, manage daily operations and escalations, monitor KPIs, and drive process improvements.',
        remoteStatus: 'On-site',
      },
    ],
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'zeoncharging')
  assert.equal(jobs[0].scrapedAt, '2026-08-04T00:00:00.000Z')
})

test('run fails closed when the Zeon redirect, about page, contact page, or careers contract changes', async () => {
  const zeon = await loadModule()
  assert.ok(zeon, 'Zeon Charging scraper module should load')

  await assert.rejects(
    zeon.createZeonChargingScraper().run({
      fetchPage: async (url) => {
        if (url === zeon.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: 'https://example.com/', html: homepageHtml }
        }
        return { status: 200, url, html: careersHtml }
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    zeon.createZeonChargingScraper().run({
      fetchPage: async (url) => {
        if (url === zeon.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: zeon.HOMEPAGE_URL, html: homepageHtml }
        }
        if (url === zeon.ABOUT_URL) {
          return { status: 200, url, html: '<html><body><p>About Zeon Charging</p></body></html>' }
        }
        if (url === zeon.CONTACT_URL) return { status: 200, url, html: contactHtml }
        return { status: 200, url, html: careersHtml }
      },
    }),
    /legal-name about page/i,
  )

  await assert.rejects(
    zeon.createZeonChargingScraper().run({
      fetchPage: async (url) => {
        if (url === zeon.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: zeon.HOMEPAGE_URL, html: homepageHtml }
        }
        if (url === zeon.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === zeon.CONTACT_URL) {
          return { status: 200, url, html: '<html><body><p>Reach us later</p></body></html>' }
        }
        return { status: 200, url, html: careersHtml }
      },
    }),
    /official contact page/i,
  )

  await assert.rejects(
    zeon.createZeonChargingScraper().run({
      fetchPage: async (url) => {
        if (url === zeon.LEGACY_HOMEPAGE_URL) {
          return { status: 200, url: zeon.HOMEPAGE_URL, html: homepageHtml }
        }
        if (url === zeon.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === zeon.CONTACT_URL) return { status: 200, url, html: contactHtml }
        return { status: 200, url, html: '<html><body><h1>Join Us</h1></body></html>' }
      },
      extractRenderedJobs: async () => [],
    }),
    /official careers response/i,
  )
})
