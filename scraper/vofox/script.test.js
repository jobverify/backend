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
    <title>Vofox Solutions | Software development company</title>
  </head>
  <body>
    <nav>
      <a href="https://vofoxsolutions.com/about-us">About US</a>
      <a href="https://vofoxsolutions.com/career-at-vofox">Career</a>
      <a href="https://vofoxsolutions.com/contact-us">Get in touch</a>
    </nav>
    <main>
      <h1>Offshore Development Company in India</h1>
      <p>Vofox solutions is a leading offshore development partner with offices in India, USA and Australia.</p>
      <p>Vofox solutions, with a team of more than 100 software programmers.</p>
    </main>
  </body>
</html>
`

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us | Vofox Solutions</title>
  </head>
  <body>
    <main>
      <p>Headquartered in Dallas, Texas, Vofox Solutions is an offshore software development company.</p>
      <p>Vofox Solutions Pvt. Ltd. has a total of 4 offices that are located in the United States, India, Australia, and UK.</p>
      <p>Back in the spring of 2005, in the startup hub of Kerala - Kochi, Vofox Solutions Pvt. Ltd. incubated itself as a promising technology startup.</p>
    </main>
  </body>
</html>
`

const contactHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Contact Us | Vofox Solutions - Best Offshore Software Development Services</title>
  </head>
  <body>
    <main>
      <h1>Let's Talk Business!</h1>
      <p>Vofox Solutions Pvt Ltd, Vofox Square, VIP Road, JLN Stadium Metro Station, Kaloor, Kochi- 682017 Kerala, India</p>
      <p>Telephone:+91-484-4049006</p>
      <p>Email: hr@vofoxsolutions.com</p>
      <a href="https://vofoxsolutions.com/career-at-vofox">Career</a>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career at Vofox | Vofox Solutions</title>
  </head>
  <body>
    <main>
      <h2>Current Openings</h2>

      <section class="job-card">
        <div>Job Title</div>
        <h5>System Administrator</h5>
        <div>Experience</div>
        <h5>: 2 - 4 Years</h5>
        <div>Salary</div>
        <h5>As per industry standard</h5>
        <div>Skills Required</div>
        <p>Active Directory</p>
        <p>DNS</p>
        <div>Description</div>
        <p>Install, configure, and maintain Windows Server / Linux operating systems.</p>
        <div>Employment Type</div>
        <p>Permanent</p>
        <div>No. Of Positions</div>
        <p>1</p>
        <div>Apply Now</div>
      </section>

      <section class="job-card">
        <div>Job Title</div>
        <h5>AI Developer</h5>
        <div>Experience</div>
        <h5>3-4</h5>
        <div>Salary</div>
        <h5>As per industry standard</h5>
        <div>Skills Required</div>
        <p>Production use of OpenAI or comparable LLM platforms</p>
        <p>RAG workflows</p>
        <div>Description</div>
        <p>Build and maintain AI-powered products and services.</p>
        <div>Employment Type</div>
        <p>Permanent</p>
        <div>No. Of Positions</div>
        <p>1</p>
        <div>Apply Now</div>
      </section>

      <h5>Apply Now For The Position Of</h5>
      <p>Attach latest resume</p>
      <p>Only PDF & DOCX files are allowed.</p>
      <p>Vofox Solutions Pvt Ltd, Vofox Square, VIP Road, JLN Stadium Metro Station, Kaloor, Kochi- 682017 Kerala, India</p>
    </main>
  </body>
</html>
`

const liveAccordionCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career at Vofox | Vofox Solutions</title>
  </head>
  <body>
    <main>
      <h2>Current Openings</h2>
      <div class="accordion-item card-shadow">
        <div class="accordion-button" type="button">
          <div class="row">
            <div class="col-lg-3 col-md-12">
              <span class="badge bg-danger">Job Title</span>
              <h5 class="career_name_1">System Administrator</h5>
            </div>
            <div class="col-lg-2 col-md-12">
              <span class="badge bg-danger">Experience</span>
              <h5>: 2 - 4 Years</h5>
            </div>
            <div class="col-lg-5 col-md-12">
              <span class="badge bg-danger">Salary</span>
              <h5>As per industry standard</h5>
            </div>
          </div>
        </div>
        <div class="accordion-collapse collapse show">
          <div class="accordion-body">
            <div class="row">
              <div class="col-lg-6 col-md-12">
                <h4>Skills Required</h4>
                <p>Active Directory<br />DNS</p>
              </div>
              <div class="col-lg-6 col-md-12">
                <article>
                  <h4>Description</h4>
                  <p>Install, configure, and maintain Windows Server / Linux operating systems.</p>
                </article>
              </div>
            </div>
          </div>
        </div>
      </div>
      <h5>Apply Now For The Position Of</h5>
      <p>Attach latest resume</p>
      <p>Only PDF & DOCX files are allowed.</p>
      <p>Vofox Solutions Pvt Ltd, Vofox Square, VIP Road, JLN Stadium Metro Station, Kaloor, Kochi- 682017 Kerala, India</p>
    </main>
  </body>
</html>
`

test('Vofox validates the verified homepage, about page, contact page, careers page, and extracts inline role sections', async () => {
  const vofox = await loadModule()
  assert.ok(vofox, 'Vofox scraper module should load')

  assert.equal(vofox.SOURCE, 'vofox')
  assert.equal(vofox.COMPANY, 'Vofox Solutions Pvt Ltd')
  assert.equal(vofox.HOMEPAGE_URL, 'https://vofoxsolutions.com/')
  assert.equal(vofox.ABOUT_URL, 'https://vofoxsolutions.com/about-us')
  assert.equal(vofox.CONTACT_URL, 'https://vofoxsolutions.com/contact-us')
  assert.equal(vofox.CAREERS_URL, 'https://vofoxsolutions.com/career-at-vofox')
  assert.equal(vofox.APPLY_URL, 'https://vofoxsolutions.com/career-at-vofox')
  assert.equal(vofox.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(vofox.hasOfficialAboutSignal(aboutHtml), true)
  assert.equal(vofox.hasOfficialContactSignal(contactHtml), true)
  assert.equal(vofox.hasOfficialCareersSignal(careersHtml), true)

  const jobs = vofox.extractJobCards(careersHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      experienceRequired: job.experienceRequired,
      location: job.location,
      country: job.country,
      applyUrl: job.applyUrl,
      openingCount: job.openingCount,
    })),
    [
      {
        title: 'System Administrator',
        experienceRequired: '2 - 4 Years',
        location: 'Kochi, Kerala, India',
        country: 'India',
        applyUrl: 'https://vofoxsolutions.com/career-at-vofox',
        openingCount: 1,
      },
      {
        title: 'AI Developer',
        experienceRequired: '3-4',
        location: 'Kochi, Kerala, India',
        country: 'India',
        applyUrl: 'https://vofoxsolutions.com/career-at-vofox',
        openingCount: 1,
      },
    ],
  )

  const accordionJobs = vofox.extractJobCards(liveAccordionCareersHtml)
  assert.equal(accordionJobs.length, 1)
  assert.deepEqual(
    {
      title: accordionJobs[0].title,
      experienceRequired: accordionJobs[0].experienceRequired,
      applyUrl: accordionJobs[0].applyUrl,
      requiredSkills: accordionJobs[0].requiredSkills,
    },
    {
      title: 'System Administrator',
      experienceRequired: '2 - 4 Years',
      applyUrl: 'https://vofoxsolutions.com/career-at-vofox',
      requiredSkills: ['Active Directory', 'DNS'],
    },
  )
})

test('Vofox run validates the official first-party surfaces before returning decorated openings', async () => {
  const vofox = await loadModule()
  assert.ok(vofox, 'Vofox scraper module should load')

  const requestedUrls = []
  const jobs = await vofox.createVofoxScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === vofox.HOMEPAGE_URL) return homepageHtml
      if (url === vofox.ABOUT_URL) return aboutHtml
      if (url === vofox.CONTACT_URL) return contactHtml
      if (url === vofox.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    vofox.HOMEPAGE_URL,
    vofox.ABOUT_URL,
    vofox.CONTACT_URL,
    vofox.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'vofox')
  assert.equal(jobs[0].company, 'Vofox Solutions Pvt Ltd')
  assert.equal(jobs[0].link, 'https://vofoxsolutions.com/career-at-vofox')
  assert.ok(jobs[0].jobId.startsWith('vofox-'))
  assert.ok(jobs[0].scrapedAt)
})

test('Vofox fails closed when the homepage, about page, contact page, or careers page changes materially', async () => {
  const vofox = await loadModule()
  assert.ok(vofox, 'Vofox scraper module should load')

  await assert.rejects(
    vofox.createVofoxScraper().run({
      fetchText: async (url) => {
        if (url === vofox.HOMEPAGE_URL) return '<html><body><h1>Placeholder</h1></body></html>'
        if (url === vofox.ABOUT_URL) return aboutHtml
        if (url === vofox.CONTACT_URL) return contactHtml
        if (url === vofox.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    vofox.createVofoxScraper().run({
      fetchText: async (url) => {
        if (url === vofox.HOMEPAGE_URL) return homepageHtml
        if (url === vofox.ABOUT_URL) return '<html><body><h1>About</h1></body></html>'
        if (url === vofox.CONTACT_URL) return contactHtml
        if (url === vofox.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /about/i,
  )

  await assert.rejects(
    vofox.createVofoxScraper().run({
      fetchText: async (url) => {
        if (url === vofox.HOMEPAGE_URL) return homepageHtml
        if (url === vofox.ABOUT_URL) return aboutHtml
        if (url === vofox.CONTACT_URL) return '<html><body><h1>Contact</h1></body></html>'
        if (url === vofox.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /contact/i,
  )

  await assert.rejects(
    vofox.createVofoxScraper().run({
      fetchText: async (url) => {
        if (url === vofox.HOMEPAGE_URL) return homepageHtml
        if (url === vofox.ABOUT_URL) return aboutHtml
        if (url === vofox.CONTACT_URL) return contactHtml
        if (url === vofox.CAREERS_URL) return '<html><body><h2>Open Roles</h2></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )
})
