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
  <html lang="en">
    <head>
      <title>TuTr Hyperloop | Revolutionizing High-Speed Transportation</title>
    </head>
    <body>
      <main>
        <h1>Revolutionizing High-Speed Transportation</h1>
        <a href="https://tutr.tech/career/">Career</a>
        <a href="https://tutr.tech/contact-us/">Contact us</a>
      </main>
    </body>
  </html>
`

const careersPageHtml = `
  <html>
    <head>
      <title>Hyperloop Engineering Jobs | Careers at TuTr Hyperloop</title>
    </head>
    <body>
      <main>
        <h1>Career</h1>
        <p>Open Positions</p>
        <p>Build the Future of Mobility. With Us.</p>
        <a href="mailto:careers@tutr.tech">APPLY NOW</a>
        <div id="premium-modal-role-a" class="premium-modal-box-modal" role="dialog" style="display: none">
          <div class="premium-modal-box-modal-dialog">
            <div class="premium-modal-box-modal-header">
              <h3 class="premium-modal-box-modal-title">Senior Software Engineer</h3>
            </div>
            <div class="premium-modal-box-modal-body">
              <p><strong>Job Type:</strong> Full-Time<br /><strong>Location:</strong> Chennai<br /><strong>Posted:</strong> 3 Days Ago</p>
              <h3>Job Overview</h3>
              <p>Build scalable, secure backend systems for hyperloop software.</p>
              <h3>Key Responsibilities</h3>
              <ul>
                <li>Design APIs.</li>
                <li>Improve performance.</li>
              </ul>
              <h3>Required Skills</h3>
              <ul>
                <li>Node.js</li>
                <li>REST APIs</li>
              </ul>
              <h3>Preferred Qualifications</h3>
              <ul>
                <li>Cloud experience</li>
              </ul>
              <h3>Why Join This Role?</h3>
              <p>Work on mobility infrastructure.</p>
              <h3>Apply Now</h3>
              <p><a href="https://tutr-website-9ecfe0.ingress-daribow.ewp.live/contact-us/">Apply Now</a></p>
            </div>
          </div>
        </div>
        <div id="premium-modal-role-b" class="premium-modal-box-modal" role="dialog" style="display: none">
          <div class="premium-modal-box-modal-dialog">
            <div class="premium-modal-box-modal-header">
              <h3 class="premium-modal-box-modal-title">Senior Software Engineer</h3>
            </div>
            <div class="premium-modal-box-modal-body">
              <p><strong>Job Type:</strong> Full-Time<br /><strong>Location:</strong> Chennai<br /><strong>Posted:</strong> 3 Days Ago</p>
              <h3>Job Overview</h3>
              <p>Build scalable, secure backend systems for hyperloop software.</p>
              <h3>Required Skills</h3>
              <ul>
                <li>Node.js</li>
                <li>REST APIs</li>
              </ul>
              <h3>Apply Now</h3>
              <p><a href="mailto:careers@tutr.tech">Apply Now</a></p>
            </div>
          </div>
        </div>
      </main>
    </body>
  </html>
`

test('verified surface helpers recognize the official Tutr Hyperloop homepage and careers page', async () => {
  const tutrHyperloop = await loadModule()
  assert.ok(tutrHyperloop, 'Expected Tutr Hyperloop scraper module at ./script.js')

  const {
    CAREERS_PAGE_URL,
    CONTACT_US_URL,
    HOMEPAGE_URL,
    hasOfficialCareersPageSignal,
    hasOfficialHomepageSignal,
  } = tutrHyperloop

  assert.equal(HOMEPAGE_URL, 'https://tutr.tech/')
  assert.equal(CAREERS_PAGE_URL, 'https://tutr.tech/career/')
  assert.equal(CONTACT_US_URL, 'https://tutr.tech/contact-us/')
  assert.equal(hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(hasOfficialCareersPageSignal(careersPageHtml), true)
})

test('extractJobsFromCareersHtml dedupes the responsive Tutr Hyperloop role markup and normalizes the role', async () => {
  const tutrHyperloop = await loadModule()
  assert.ok(tutrHyperloop, 'Expected Tutr Hyperloop scraper module at ./script.js')

  assert.deepEqual(tutrHyperloop.extractJobsFromCareersHtml(careersPageHtml), [
    {
      title: 'Senior Software Engineer',
      company: 'Tutr Hyperloop',
      location: 'Chennai, India',
      city: 'Chennai',
      country: 'India',
      jobId: 'tutrhyperloop-senior-software-engineer-chennai',
      requisitionId: null,
      sourceUrl: 'https://tutr.tech/career/',
      applyUrl: 'https://tutr.tech/contact-us/',
      employmentType: 'Full-Time',
      department: 'Engineering',
      postingDate: null,
      closingDate: null,
      requiredSkills: ['Node.js', 'REST APIs'],
      preferredQualification: 'Cloud experience',
      jobDescription:
        'Job Type: Full-Time Location: Chennai Posted: 3 Days Ago Job Overview Build scalable, secure backend systems for hyperloop software. Key Responsibilities Design APIs. Improve performance. Required Skills Node.js REST APIs Preferred Qualifications Cloud experience Why Join This Role? Work on mobility infrastructure.',
    },
  ])
})

test('run returns the verified public Tutr Hyperloop jobs from the first-party careers page', async () => {
  const tutrHyperloop = await loadModule()
  assert.ok(tutrHyperloop, 'Expected Tutr Hyperloop scraper module at ./script.js')

  const { CAREERS_PAGE_URL, HOMEPAGE_URL, createTutrHyperloopScraper, extractJobsFromCareersHtml } = tutrHyperloop
  const requestedUrls = []

  const jobs = await createTutrHyperloopScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }
      if (url === CAREERS_PAGE_URL) {
        return { status: 200, url, html: careersPageHtml }
      }
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [HOMEPAGE_URL, CAREERS_PAGE_URL])
  assert.deepEqual(jobs, extractJobsFromCareersHtml(careersPageHtml))
})

test('run returns [] when both verified Tutr Hyperloop routes fail with the August 20, 2026 certificate mismatch', async () => {
  const tutrHyperloop = await loadModule()
  assert.ok(tutrHyperloop, 'Expected Tutr Hyperloop scraper module at ./script.js')

  const { CAREERS_PAGE_URL, HOMEPAGE_URL, createTutrHyperloopScraper } = tutrHyperloop
  const certificateError =
    "fetch failed | Hostname/IP does not match certificate's altnames: Host: tutr.tech. is not in the cert's altnames: DNS:*.ingress-daribow.ewp.live, DNS:ingress-daribow.ewp.live"

  const jobs = await createTutrHyperloopScraper().run({
    fetchPage: async (url) => {
      if (url === HOMEPAGE_URL || url === CAREERS_PAGE_URL) {
        throw new Error(certificateError)
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
})

test('Tutr Hyperloop default fetch is bounded by a timeout signal', async () => {
  const tutrHyperloop = await loadModule()
  assert.ok(tutrHyperloop, 'Expected Tutr Hyperloop scraper module at ./script.js')

  let capturedInit = null
  const page = await tutrHyperloop.defaultFetchPage(tutrHyperloop.CAREERS_PAGE_URL, {
    timeoutMs: 25,
    fetchImpl: async (url, init) => {
      capturedInit = init
      return {
        status: 200,
        url,
        text: async () => careersPageHtml,
      }
    },
  })

  assert.equal(page.status, 200)
  assert.equal(page.url, tutrHyperloop.CAREERS_PAGE_URL)
  assert.equal(page.html, careersPageHtml)
  assert.equal(capturedInit.signal instanceof AbortSignal, true)
})

test('run fails closed when the verified Tutr Hyperloop homepage or careers page changes materially', async () => {
  const tutrHyperloop = await loadModule()
  assert.ok(tutrHyperloop, 'Expected Tutr Hyperloop scraper module at ./script.js')

  const { CAREERS_PAGE_URL, HOMEPAGE_URL, createTutrHyperloopScraper } = tutrHyperloop

  await assert.rejects(
    createTutrHyperloopScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body>unexpected</body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified homepage/i,
  )

  await assert.rejects(
    createTutrHyperloopScraper().run({
      fetchPage: async (url) => {
        if (url === HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml,
          }
        }

        if (url === CAREERS_PAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><body>unexpected</body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers page/i,
  )
})
