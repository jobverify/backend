import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLY_URL,
  CAREERS_URL,
  HOMEPAGE_URL,
  createEfftronicsScraper,
  extractPublicListings,
  hasOfficialCareersSignal,
  hasOfficialHomepageSignal,
} from './script.js'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Efftronics Systems Pvt. Ltd.</title>
    </head>
    <body>
      <nav>
        <a href="https://www.efftronics.com/careers">Careers</a>
      </nav>
      <h1>YOUR ONE-STOP DESTINATION FOR END-TO-END SMART SOLUTIONS.</h1>
    </body>
  </html>
`

const careersHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Careers | Efftronics Systems Pvt. Ltd.</title>
    </head>
    <body>
      <h1>Join us</h1>
      <h2>Current Vacancies</h2>
      <p>:: Walk-in Interviews every Tuesday at 9:00 AM @ Mangalagiri ::</p>

      <section class="vacancy-card">
        <h3>Embedded</h3>
        <h3>Engineer</h3>
        <p>B.Tech/M.Tech(EEE/ECE/EIE)</p>
        <p>M.Sc Electronics</p>
        <p>Analog system design,</p>
        <p>Embedded or Resource-constraint environments</p>
        <p>Details</p>
      </section>

      <section class="vacancy-card">
        <h3>Software</h3>
        <h3>Engineer</h3>
        <p>B.Tech - CSE/IT,</p>
        <p>M.Tech - CSE/IT, MCA</p>
        <p>C/C++,</p>
        <p>Object Oriented Programming</p>
        <p>Details</p>
      </section>

      <section class="vacancy-card">
        <h3>Mechanical</h3>
        <h3>Engineer</h3>
        <p>B.Tech/M.Tech (Mechanical)</p>
        <p>Freshers preferred</p>
        <p>2D and 3D drawing</p>
        <p>Drafting</p>
        <p>Details</p>
      </section>

      <section class="vacancy-card">
        <h3>Solution</h3>
        <h3>Support Engineer</h3>
        <p>Diploma/B.Tech (ECE/EEE/EIE)</p>
        <p>Network Handling</p>
        <p>Failure Analysis System</p>
        <p>Details</p>
      </section>

      <section class="vacancy-card">
        <h3>System</h3>
        <h3>Administrator</h3>
        <p>B.Tech(CSE/ECE)</p>
        <p>BSC Computers</p>
        <p>Hardware & networking</p>
        <p>Monitoring</p>
        <p>Details</p>
      </section>

      <h2>Career Development with Efftronics</h2>

      <section class="role-modal">
        <h2>Embedded Engineer</h2>
        <h4>Qualification</h4>
        <p>B.Tech - EEE/ECE/EIE, M.Tech - EEE/ECE/EIE, M.Sc Electronics</p>
        <h4>Job Location</h4>
        <p>Mangalagiri</p>
        <a href="/resume-upload">Apply Now</a>
        <p>About Job Role</p>
        <p>At Efftronics, we create value by solving customer problems through design thinking.</p>
        <p>The primary purpose of Embedded Engineer is to design & build IoT based smart solutions.</p>
        <p>SERVICE AGREEMENT</p>
      </section>

      <section class="role-modal">
        <h2>Software Engineer</h2>
        <h4>Qualification</h4>
        <p>B.Tech - CSE/IT, M.Tech - CSE/IT, MCA, M.Sc Computers</p>
        <h4>Job Location</h4>
        <p>Mangalagiri</p>
        <a href="/resume-upload">Apply Now</a>
        <p>About Job Role</p>
        <p>At Efftronics, we create value by solving customer problems through design thinking.</p>
        <p>The primary purpose of Software Engineer is to design and build software components.</p>
        <p>SERVICE AGREEMENT</p>
      </section>

      <section class="role-modal">
        <h2>Mechanical Engineer</h2>
        <h4>Qualification</h4>
        <p>B.Tech/M.Tech (Mechanical)</p>
        <h4>Job Location</h4>
        <p>Mangalagiri</p>
        <a href="/resume-upload">Apply Now</a>
        <p>About Job Role</p>
        <p>At Efftronics, we create value by solving customer problems through design thinking.</p>
        <p>The primary purpose of Mechanical Engineer is to support product design and drafting.</p>
        <p>SERVICE AGREEMENT</p>
      </section>

      <section class="role-modal">
        <h2>Solution Support Engineer</h2>
        <h4>Qualification</h4>
        <p>Diploma/B.Tech (ECE/EEE/EIE)</p>
        <h4>Job Location</h4>
        <p>Mangalagiri</p>
        <a href="/resume-upload">Apply Now</a>
        <p>About Job Role</p>
        <p>At Efftronics, we create value by solving customer problems through design thinking.</p>
        <p>The primary purpose of Solution Support Engineer is to support deployed smart solutions.</p>
        <p>SERVICE AGREEMENT</p>
      </section>

      <section class="role-modal">
        <h2>System Administrator</h2>
        <h4>Qualification</h4>
        <p>B.Tech(CSE/ECE), BSC Computers</p>
        <h4>Job Location</h4>
        <p>Mangalagiri</p>
        <a href="/resume-upload">Apply Now</a>
        <p>About Job Role</p>
        <p>At Efftronics, we create value by solving customer problems through design thinking.</p>
        <p>The primary purpose of System Administrator is to monitor hardware and networking systems.</p>
        <p>SERVICE AGREEMENT</p>
      </section>
    </body>
  </html>
`

test('extractPublicListings parses the verified public Efftronics vacancy cards', () => {
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersSignal(careersHtml), true)

  const jobs = extractPublicListings(careersHtml)

  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      minimumQualification: job.minimumQualification,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Embedded Engineer',
        location: 'Mangalagiri',
        minimumQualification: 'B.Tech/M.Tech(EEE/ECE/EIE) M.Sc Electronics',
        applyUrl: APPLY_URL,
      },
      {
        title: 'Software Engineer',
        location: 'Mangalagiri',
        minimumQualification: 'B.Tech - CSE/IT, M.Tech - CSE/IT, MCA',
        applyUrl: APPLY_URL,
      },
      {
        title: 'Mechanical Engineer',
        location: 'Mangalagiri',
        minimumQualification: 'B.Tech/M.Tech (Mechanical) Freshers preferred',
        applyUrl: APPLY_URL,
      },
      {
        title: 'Solution Support Engineer',
        location: 'Mangalagiri',
        minimumQualification: 'Diploma/B.Tech (ECE/EEE/EIE)',
        applyUrl: APPLY_URL,
      },
      {
        title: 'System Administrator',
        location: 'Mangalagiri',
        minimumQualification: 'B.Tech(CSE/ECE) BSC Computers',
        applyUrl: APPLY_URL,
      },
    ],
  )

  assert.deepEqual(jobs[0].requiredSkills, [
    'Analog system design,',
    'Embedded or Resource-constraint environments',
  ])
  assert.match(jobs[0].jobDescription, /design & build IoT based smart solutions/i)
  assert.match(jobs.find((job) => job.title === 'Software Engineer').jobDescription, /M\.Sc Computers/)
})

test('scraper run fetches the official homepage and careers page and returns normalized jobs', async () => {
  const requestedUrls = []
  const scraper = createEfftronicsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) return homepageHtml
      if (url === CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_URL])
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].company, 'Efftronics')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].source, 'efftronics')
  assert.equal(jobs[0].link, APPLY_URL)
  assert.ok(jobs[0].scrapedAt)
})

test('fails closed when the Efftronics homepage changes away from the verified official surface', async () => {
  await assert.rejects(
    createEfftronicsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) {
          return '<html><head><title>Placeholder</title></head><body>No careers link</body></html>'
        }

        return careersHtml
      },
    }),
    /Efftronics homepage no longer matches the verified official public site/i,
  )
})

test('fails closed when the Efftronics careers page shape changes', async () => {
  await assert.rejects(
    createEfftronicsScraper().run({
      fetchText: async (url) => {
        if (url === HOMEPAGE_URL) return homepageHtml
        if (url === CAREERS_URL) return '<html><head><title>Careers | Efftronics Systems Pvt. Ltd.</title></head><body>No vacancies</body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /Efftronics careers page no longer matches the verified official public jobs surface/i,
  )
})
