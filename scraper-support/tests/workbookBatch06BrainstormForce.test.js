import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
  <html>
    <head>
      <title>Join - Brainstorm Force</title>
      <link rel="canonical" href="https://brainstormforce.com/join/">
    </head>
    <body>
      <h1>Let’s Build the Future of Digital Business Together</h1>
      <h2>Work Remotely From Anywhere</h2>

      <div class="role-card">
        <p style="color:#000f32">Product Manager</p>
        <p>Shape product innovation for millions of WordPress users.</p>
        <p><img title="Join"> Remote (India)</p>
        <p><img title="Join"> Full-time</p>
        <a href="https://brainstormforce.com/join/product-manager/" aria-label="Apply Now">
          <div class="spectra-button__link">Apply Now</div>
        </a>
      </div>

      <div class="role-card">
        <p style="color:#000f32">Senior Laravel Developer</p>
        <p>Craft clean, efficient backend solutions with Laravel.</p>
        <p><img title="Join"> Remote (India)</p>
        <p><img title="Join"> Full-time</p>
        <a href="https://brainstormforce.com/join/senior-laravel-developer/" aria-label="Apply Now">
          <div class="spectra-button__link">Apply Now</div>
        </a>
      </div>

      <div class="role-card">
        <p style="color:#000f32">Senior Frontend Developer</p>
        <p>Build scalable, high-performance frontend features.</p>
        <p><img title="Join"> Remote (India)</p>
        <p><img title="Join"> Full-time</p>
        <a href="https://brainstormforce.com/join/frontend-developer/" aria-label="Apply Now">
          <div class="spectra-button__link">Apply Now</div>
        </a>
      </div>

      <div class="role-card">
        <p style="color:#000f32">UI/UX Designer (Product Design)</p>
        <p>Create intuitive user experiences across products.</p>
        <p><img title="Join"> Remote</p>
        <p><img title="Join"> Full-time</p>
        <a href="https://brainstormforce.com/join/ui-ux-designer/" aria-label="Apply Now">
          <div class="spectra-button__link">Apply Now</div>
        </a>
      </div>

      <div class="role-card duplicate">
        <p style="color:#000f32">Product Manager</p>
        <p>Shape product innovation for millions of WordPress users.</p>
        <p><img title="Join"> Remote (India)</p>
        <p><img title="Join"> Full-time</p>
        <a href="https://brainstormforce.com/join/product-manager/" aria-label="Apply Now">
          <div class="spectra-button__link">Apply Now</div>
        </a>
      </div>
    </body>
  </html>
`

const PRODUCT_MANAGER_DETAIL_HTML = `
  <html>
    <head><title>Product Manager - Brainstorm Force</title></head>
    <body>
      <h1><div>Product Manager</div></h1>
      <a href="https://forms.brainstormforce.com/form/product-manager-job-application-form/" aria-label="Apply Now">
        <div class="spectra-button__link">Apply Now</div>
      </a>
      <h4>Job Summary</h4>
      <h3>About the Role</h3>
      <p>Lead product direction for WordPress tools and SaaS products.</p>
    </body>
  </html>
`

const SENIOR_LARAVEL_DETAIL_HTML = `
  <html>
    <head><title>Senior Laravel Developer - Brainstorm Force</title></head>
    <body>
      <h1><div>Senior Laravel Developer</div></h1>
      <a href="https://forms.brainstormforce.com/senior-laravel-developer/" aria-label="Apply Now">
        <div class="spectra-button__link">Apply Now</div>
      </a>
      <h4>Job Summary</h4>
      <h3>What you will be doing</h3>
      <p>Own high-impact Laravel features for remote-first product teams.</p>
    </body>
  </html>
`

const BROKEN_FRONTEND_DETAIL_HTML = `
  <html>
    <head><title>Join - Brainstorm Force</title></head>
    <body>
      <h1>Let’s Build the Future of Digital Business Together</h1>
      <p>Redirected back to the main join page.</p>
    </body>
  </html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/brainstormforce/script.js')
  } catch {
    assert.fail('Expected Brainstorm Force scraper module at ../../scraper/brainstormforce/script.js')
  }
}

test('Brainstorm Force recognizes the verified careers surface and extracts unique public role cards', async () => {
  const brainstormforce = await loadModule()
  const listings = brainstormforce.extractCareersListings(VERIFIED_CAREERS_HTML)
  const indiaListings = listings.filter((listing) => listing.isIndiaRole)

  assert.equal(brainstormforce.SOURCE, 'brainstormforce')
  assert.equal(brainstormforce.COMPANY, 'Brainstorm Force')
  assert.equal(brainstormforce.VERIFIED_ON, '2026-07-25')
  assert.equal(brainstormforce.CAREERS_URL, 'https://brainstormforce.com/join/')
  assert.equal(
    brainstormforce.APPLICATION_FORMS_BASE_URL,
    'https://forms.brainstormforce.com/',
  )
  assert.equal(
    brainstormforce.DISPOSITION,
    'verified-first-party-careers-page-plus-public-job-pages-and-branded-application-forms',
  )
  assert.match(brainstormforce.VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.match(brainstormforce.VERIFIED_SURFACE_SUMMARY, /Product Manager/i)
  assert.match(brainstormforce.VERIFIED_SURFACE_SUMMARY, /Senior Laravel Developer/i)
  assert.equal(brainstormforce.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(listings.length, 4)
  assert.equal(indiaListings.length, 3)
  assert.deepEqual(
    indiaListings.map((listing) => ({
      title: listing.title,
      location: listing.location,
      employmentType: listing.employmentType,
      sourceUrl: listing.sourceUrl,
      jobId: listing.jobId,
    })),
    [
      {
        title: 'Product Manager',
        location: 'Remote (India)',
        employmentType: 'Full-time',
        sourceUrl: 'https://brainstormforce.com/join/product-manager/',
        jobId: 'product-manager',
      },
      {
        title: 'Senior Laravel Developer',
        location: 'Remote (India)',
        employmentType: 'Full-time',
        sourceUrl: 'https://brainstormforce.com/join/senior-laravel-developer/',
        jobId: 'senior-laravel-developer',
      },
      {
        title: 'Senior Frontend Developer',
        location: 'Remote (India)',
        employmentType: 'Full-time',
        sourceUrl: 'https://brainstormforce.com/join/frontend-developer/',
        jobId: 'frontend-developer',
      },
    ],
  )
})

test('Brainstorm Force run returns only India-tagged roles whose detail pages still expose trusted branded application forms', async () => {
  const brainstormforce = await loadModule()
  const requestedUrls = []

  const jobs = await brainstormforce.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === brainstormforce.CAREERS_URL) {
        return { url, html: VERIFIED_CAREERS_HTML }
      }

      if (url === 'https://brainstormforce.com/join/product-manager/') {
        return { url, html: PRODUCT_MANAGER_DETAIL_HTML }
      }

      if (url === 'https://brainstormforce.com/join/senior-laravel-developer/') {
        return { url, html: SENIOR_LARAVEL_DETAIL_HTML }
      }

      if (url === 'https://brainstormforce.com/join/frontend-developer/') {
        return { url: brainstormforce.CAREERS_URL, html: BROKEN_FRONTEND_DETAIL_HTML }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(
    requestedUrls,
    [
      brainstormforce.CAREERS_URL,
      'https://brainstormforce.com/join/product-manager/',
      'https://brainstormforce.com/join/senior-laravel-developer/',
      'https://brainstormforce.com/join/frontend-developer/',
    ],
  )
  assert.deepEqual(
    jobs,
    [
      {
        title: 'Product Manager',
        company: 'Brainstorm Force',
        department: null,
        location: 'Remote (India)',
        city: null,
        country: 'India',
        jobId: 'product-manager',
        requisitionId: 'product-manager',
        sourceUrl: 'https://brainstormforce.com/join/product-manager/',
        applyUrl: 'https://forms.brainstormforce.com/form/product-manager-job-application-form/',
        employmentType: 'Full-time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Shape product innovation for millions of WordPress users.',
        remoteStatus: 'Remote',
        source: 'brainstormforce',
        link: 'https://forms.brainstormforce.com/form/product-manager-job-application-form/',
        scrapedAt: '2026-07-25T00:00:00.000Z',
      },
      {
        title: 'Senior Laravel Developer',
        company: 'Brainstorm Force',
        department: null,
        location: 'Remote (India)',
        city: null,
        country: 'India',
        jobId: 'senior-laravel-developer',
        requisitionId: 'senior-laravel-developer',
        sourceUrl: 'https://brainstormforce.com/join/senior-laravel-developer/',
        applyUrl: 'https://forms.brainstormforce.com/senior-laravel-developer/',
        employmentType: 'Full-time',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Craft clean, efficient backend solutions with Laravel.',
        remoteStatus: 'Remote',
        source: 'brainstormforce',
        link: 'https://forms.brainstormforce.com/senior-laravel-developer/',
        scrapedAt: '2026-07-25T00:00:00.000Z',
      },
    ],
  )
})

test('Brainstorm Force fails closed when the verified careers surface drifts materially', async () => {
  const brainstormforce = await loadModule()

  await assert.rejects(
    brainstormforce.run({
      fetchPage: async (url) => {
        if (url === brainstormforce.CAREERS_URL) {
          return {
            url,
            html: VERIFIED_CAREERS_HTML.replace('Work Remotely From Anywhere', 'Join Our Team'),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers surface changed materially/i,
  )

  await assert.rejects(
    brainstormforce.run({
      fetchPage: async (url) => {
        if (url === brainstormforce.CAREERS_URL) {
          return {
            url: 'https://brainstormforce.com/about/',
            html: VERIFIED_CAREERS_HTML,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official careers surface changed materially/i,
  )
})

test('Brainstorm Force fails closed when no India-tagged role detail page still resolves to a trusted branded form handoff', async () => {
  const brainstormforce = await loadModule()

  await assert.rejects(
    brainstormforce.run({
      fetchPage: async (url) => {
        if (url === brainstormforce.CAREERS_URL) {
          return { url, html: VERIFIED_CAREERS_HTML }
        }

        if (url.startsWith('https://brainstormforce.com/join/')) {
          return { url: brainstormforce.CAREERS_URL, html: BROKEN_FRONTEND_DETAIL_HTML }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no longer exposes any trustworthy India-targeted public role pages/i,
  )
})
