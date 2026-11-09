import assert from 'node:assert/strict'
import test from 'node:test'

const loadInfobellModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Infobell IT Solutions scraper module at ./script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Infobell IT Solutions</title>
  </head>
  <body>
    <main id="careers">
      <h1><span class="tricksword-wrapper">Join our team today</span></h1>
      <div class="job-card">
        <div class="row">
          <div class="col-xxl-10 col-xl-10 col-sm-12 j-d">
            <h3>Server Performance Benchmark Engineers</h3>
            <span class="d-flex">Bengaluru</span>
          </div>
          <div class="col-xxl-2 col-xl-2 col-sm-12 mt-xxl-0 mt-xl-0 mt-sm-5">
            <a class="ib-rmore" href="./careers-detail.html">Apply Now</a>
          </div>
        </div>
      </div>
      <div class="job-card">
        <div class="row">
          <div class="col-xxl-10 col-xl-10 col-sm-12 j-d">
            <h3>DevOps &amp; DevSecOps</h3>
            <span class="d-flex">Bengaluru</span>
          </div>
          <div class="col-xxl-2 col-xl-2 col-sm-12 mt-xl-0 mt-sm-5">
            <a class="ib-rmore" href="./Devops.html">Apply Now</a>
          </div>
        </div>
      </div>
      <div class="job-card">
        <div class="row">
          <div class="col-xxl-10 col-xl-10 col-sm-12 j-d">
            <h3>UI developer</h3>
            <span class="d-flex">Bengaluru</span>
          </div>
          <div class="col-xxl-2 col-xl-2 col-sm-12 mt-xl-0 mt-sm-5">
            <a class="ib-rmore" href="./UI.html">Apply Now</a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const detailPages = {
  'https://www.infobellit.com/careers-detail.html': `
    <!doctype html>
    <html lang="en">
      <body>
        <section class="job-desciption">
          <h1>Server Performance Benchmark Engineers</h1>
          <div class="d-card">
            <h3>Job Responsibilities / Skill-Set</h3>
            <p>
              3+ years of experience
              Good experience on Server performance benchmark testing
              <strong>like SPECCPU, SPECJBB, TPC etc</strong>
              Good handle on Linux Operating system and Server Architecture.
            </p>
          </div>
          <div class="s-card">
            <h3>Apply today</h3>
            <a href="mailto:info@infobellit.com">info@infobellit.com</a>
          </div>
        </section>
      </body>
    </html>
  `,
  'https://www.infobellit.com/Devops.html': `
    <!doctype html>
    <html lang="en">
      <body>
        <section class="job-desciption">
          <h1>DevOps &amp; DevSecOps</h1>
          <div class="d-card">
            <h3>Job Responsibilities / Skill-Set</h3>
            <p>
              4 + years of experience in large Cloud based environment
              Compliance framework NIST 800-53, SOC2, CIS
              DevOps, DevSecOps
            </p>
          </div>
          <div class="s-card">
            <h3>Apply today</h3>
            <a href="mailto:info@infobellit.com">info@infobellit.com</a>
          </div>
        </section>
      </body>
    </html>
  `,
  'https://www.infobellit.com/UI.html': `
    <!doctype html>
    <html lang="en">
      <body>
        <section class="job-desciption">
          <h1>UI Developer</h1>
          <div class="d-card">
            <h3>Job Responsibilities / Skill-Set</h3>
            <p>3+ years of ReactJS developer</p>
          </div>
          <div class="s-card">
            <h3>Apply today</h3>
            <a href="mailto:info@infobellit.com">info@infobellit.com</a>
          </div>
        </section>
      </body>
    </html>
  `,
}

test('Infobell IT Solutions scraper validates the verified first-party careers page and extracts job cards', async () => {
  const infobell = await loadInfobellModule()

  assert.equal(infobell.SOURCE, 'infobellitsolutionspvtltd')
  assert.equal(infobell.COMPANY, 'Infobell IT Solutions Pvt.Ltd.')
  assert.equal(infobell.CAREERS_URL, 'https://www.infobellit.com/careers.html')
  assert.equal(infobell.hasOfficialCareersSignal(careersPageHtml), true)
  assert.deepEqual(infobell.extractJobCards(careersPageHtml), [
    {
      title: 'Server Performance Benchmark Engineers',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      sourceUrl: 'https://www.infobellit.com/careers-detail.html',
      detailUrl: 'https://www.infobellit.com/careers-detail.html',
      applyUrl: null,
      jobId: 'careers-detail',
      requisitionId: 'careers-detail',
    },
    {
      title: 'DevOps & DevSecOps',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      sourceUrl: 'https://www.infobellit.com/Devops.html',
      detailUrl: 'https://www.infobellit.com/Devops.html',
      applyUrl: null,
      jobId: 'devops',
      requisitionId: 'devops',
    },
    {
      title: 'UI developer',
      location: 'Bengaluru, India',
      city: 'Bangalore',
      sourceUrl: 'https://www.infobellit.com/UI.html',
      detailUrl: 'https://www.infobellit.com/UI.html',
      applyUrl: null,
      jobId: 'ui',
      requisitionId: 'ui',
    },
  ])
})

test('Infobell IT Solutions run decorates first-party listings with detail-page descriptions and application links', async () => {
  const infobell = await loadInfobellModule()
  const requestedUrls = []

  const jobs = await infobell.createInfobellItSolutionsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === infobell.CAREERS_URL) {
        return careersPageHtml
      }

      const detailHtml = detailPages[url]
      if (detailHtml) {
        return detailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    infobell.CAREERS_URL,
    'https://www.infobellit.com/careers-detail.html',
    'https://www.infobellit.com/Devops.html',
    'https://www.infobellit.com/UI.html',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      applyUrl: job.applyUrl,
      link: job.link,
      jobId: job.jobId,
    })),
    [
      {
        title: 'Server Performance Benchmark Engineers',
        location: 'Bengaluru, India',
        city: 'Bangalore',
        applyUrl: 'https://www.infobellit.com/careers-detail.html',
        link: 'https://www.infobellit.com/careers-detail.html',
        jobId: 'careers-detail',
      },
      {
        title: 'DevOps & DevSecOps',
        location: 'Bengaluru, India',
        city: 'Bangalore',
        applyUrl: 'https://www.infobellit.com/Devops.html',
        link: 'https://www.infobellit.com/Devops.html',
        jobId: 'devops',
      },
      {
        title: 'UI Developer',
        location: 'Bengaluru, India',
        city: 'Bangalore',
        applyUrl: 'https://www.infobellit.com/UI.html',
        link: 'https://www.infobellit.com/UI.html',
        jobId: 'ui',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /SPECCPU/i)
  assert.equal(jobs[0].company, 'Infobell IT Solutions Pvt.Ltd.')
  assert.equal(jobs[0].source, 'infobellitsolutionspvtltd')
  assert.equal(jobs[0].country, 'India')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Infobell IT Solutions fails closed when the verified careers shell or detail apply flow changes', async () => {
  const infobell = await loadInfobellModule()

  await assert.rejects(
    infobell.createInfobellItSolutionsScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    infobell.createInfobellItSolutionsScraper().run({
      fetchText: async (url) => {
        if (url === infobell.CAREERS_URL) {
          return careersPageHtml
        }

        return detailPages[url].replace('mailto:info@infobellit.com', 'https://jobs.infobellit.com/apply')
      },
    }),
    /verified first-party detail page or apply flow/i,
  )
})
