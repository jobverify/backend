import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Content Transformation &amp; AI Learning Solutions</title>
  </head>
  <body>
    <a href="https://www.aptaracorp.com/" aria-label="Aptara Corp Logo">Aptara Corp Logo</a>
    <a href="https://www.aptaracorp.com/careers/"><span class="menu-text">CAREERS</span></a>
    <a href="https://www.aptaracorp.com/contact-us/">GET IN TOUCH</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers: Build Your Future in Digital Transformation</title>
    <link rel="canonical" href="https://www.aptaracorp.com/careers/">
  </head>
  <body>
    <h1>Careers</h1>
    <p>If you share these values, we'd like to hear from you.</p>
    <h2>Latest Job</h2>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-11">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Instructional Designer Manager (IDM) &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content">Pune, Maharashtra</div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-12">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Lead Instructional Designer (Lead ID) &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content">Pune, Maharashtra</div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-13">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Associate Instructional Designer Manager (AIDM) &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content">Pune, Maharashtra</div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-14">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Senior Instructional Designer Manager (Sr. IDM) &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content">Pune, Maharashtra</div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-15">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Senior Instructional Designer (Sr. ID) &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content">Pune, Maharashtra</div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-16">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Instructional Designer w/Utilities Experience (Hybrid) &#8211; Contract</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p>Oakland, CA</p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-17">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Business Analyst w/ AI experience (Hybrid) &#8211; Contract</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p>Oakland, CA</p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-18">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Product Manager w/ EV experience (Hybrid) &#8211; Contract</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p>Oakland, CA</p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-19">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Sr. Instructional Designer w/ Analysis, Design and Development experience &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p>USA</p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-20">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Jr. Designer w/ strong Graphic Design Skills &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p>USA</p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-21">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">LMS Administrator w/ SuccessFactors Experience &#8211; Remote</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p>USA</p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-22">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Compliance Analyst (Hybrid)</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p>Northern California OR Southern California</p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <div class="fusion-layout-column fusion_builder_column fusion-builder-column-23">
      <div class="fusion-title">
        <h3 class="fusion-title-heading title-heading-left">Sr. Financial Analyst/Financial Analyst</h3>
      </div>
      <ul class="fusion-checklist">
        <li class="fusion-li-item">
          <div class="fusion-li-item-content"><p><span data-olk-copy-source="MessageBody">Perungudi, Chennai</span></p></div>
        </li>
      </ul>
      <div><a href="#applynow"><span class="fusion-button-text">Apply Now</span></a></div>
    </div>

    <section id="applynow">
      <h3>Submit Your Resume</h3>
      <label for="file-upload">File Upload *</label>
      <input id="file-upload" type="file">
      <button type="submit">Submit</button>
    </section>
  </body>
</html>
`

const loadAptaraModule = async () => {
  try {
    return await import('../../scraper/aptara/script.js')
  } catch {
    assert.fail('Expected Aptara scraper module at ../../scraper/aptara/script.js')
  }
}

test('Aptara scraper constants stay pinned to the verified first-party careers surface', async () => {
  const aptara = await loadAptaraModule()

  assert.equal(aptara.SOURCE, 'aptara')
  assert.equal(aptara.COMPANY, 'Aptara')
  assert.equal(aptara.OFFICIAL_BRAND_NAME, 'Aptara Corp')
  assert.equal(aptara.VERIFIED_ON, '2026-07-15')
  assert.equal(aptara.HOMEPAGE_URL, 'https://www.aptaracorp.com/')
  assert.equal(aptara.CAREERS_URL, 'https://www.aptaracorp.com/careers/')
  assert.equal(aptara.APPLY_ANCHOR_URL, 'https://www.aptaracorp.com/careers/#applynow')
  assert.match(aptara.VERIFIED_SURFACE_SUMMARY, /shared first-party #applynow resume form/i)
  assert.equal(aptara.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    aptara.extractHomepageCareerUrl(homepageHtml),
    'https://www.aptaracorp.com/careers/',
  )
  assert.equal(aptara.hasOfficialCareersSurface(careersHtml), true)
  assert.equal(aptara.isIndiaListing('Pune, Maharashtra'), true)
  assert.equal(aptara.isIndiaListing('Perungudi, Chennai'), true)
  assert.equal(aptara.isIndiaListing('Oakland, CA'), false)
})

test('extractCareerListings keeps only the verified India roles from Aptara careers', async () => {
  const aptara = await loadAptaraModule()
  const jobs = aptara.extractCareerListings(careersHtml)

  assert.equal(jobs.length, 6)
  assert.deepEqual(jobs[0], {
    title: 'Instructional Designer Manager (IDM)',
    company: 'Aptara',
    department: null,
    location: 'Pune, Maharashtra, India',
    city: 'Pune',
    state: null,
    country: 'India',
    jobId: 'aptara-instructional-designer-manager-idm-pune-maharashtra-india',
    requisitionId: 'aptara-instructional-designer-manager-idm-pune-maharashtra-india',
    sourceUrl: 'https://www.aptaracorp.com/careers/',
    applyUrl: 'https://www.aptaracorp.com/careers/#applynow',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'Remote',
  })
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Instructional Designer Manager (IDM)',
      'Lead Instructional Designer (Lead ID)',
      'Associate Instructional Designer Manager (AIDM)',
      'Senior Instructional Designer Manager (Sr. IDM)',
      'Senior Instructional Designer (Sr. ID)',
      'Sr. Financial Analyst/Financial Analyst',
    ],
  )
  assert.equal(jobs[5].location, 'Perungudi, Chennai, India')
  assert.equal(jobs[5].city, 'Chennai')
  assert.equal(jobs[5].remoteStatus, 'On-site')
})

test('run fetches the Aptara homepage and careers page, then decorates the India jobs', async () => {
  const aptara = await loadAptaraModule()
  const requestedUrls = []

  const jobs = await aptara.createAptaraScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === aptara.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === aptara.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected Aptara URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.aptaracorp.com/',
    'https://www.aptaracorp.com/careers/',
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'aptara')
  assert.equal(jobs[0].link, 'https://www.aptaracorp.com/careers/#applynow')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
})

test('run fails closed when the verified Aptara homepage or careers shell drifts materially', async () => {
  const aptara = await loadAptaraModule()

  await assert.rejects(
    aptara.createAptaraScraper().run({
      fetchPage: async (url) => {
        if (url === aptara.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body>No verified homepage markers</body></html>' }
        }

        throw new Error(`Unexpected Aptara URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    aptara.createAptaraScraper().run({
      fetchPage: async (url) => {
        if (url === aptara.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === aptara.CAREERS_URL) {
          return { status: 200, url, html: '<html><body><h1>Careers</h1><p>No verified jobs shell</p></body></html>' }
        }

        throw new Error(`Unexpected Aptara URL: ${url}`)
      },
    }),
    /verified official careers surface/i,
  )
})
