import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-14T16:00:00.000Z'

const buildJobCardHtml = ({
  jobId,
  title,
  department = 'Talent Collective',
  experienceRequired,
}) => `
  <div data-elementor-type="loop-item" class="elementor elementor-2389 e-loop-item e-loop-item-${jobId} post-${jobId} job type-job status-publish hentry ast-article-single">
    <div class="elementor-element elementor-element-09cbc8a e-con-full e-flex e-con e-child">
      <div class="elementor-element elementor-element-6e7b8a6 elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h3 class="elementor-heading-title elementor-size-default">${title}</h3>
        </div>
      </div>
      <div class="elementor-element elementor-element-6e9cb4a elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h3 class="elementor-heading-title elementor-size-default"> | </h3>
        </div>
      </div>
      <div class="elementor-element elementor-element-800d727 elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h3 class="elementor-heading-title elementor-size-default">${department}</h3>
        </div>
      </div>
      <div class="elementor-element elementor-element-8fffba8 elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h3 class="elementor-heading-title elementor-size-default">|</h3>
        </div>
      </div>
      <div class="elementor-element elementor-element-49f85ed elementor-widget elementor-widget-heading">
        <div class="elementor-widget-container">
          <h3 class="elementor-heading-title elementor-size-default">${experienceRequired}</h3>
        </div>
      </div>
    </div>
    <div class="elementor-element elementor-element-62bf320 contact-aply-now-btn elementor-align-right elementor-widget elementor-widget-button">
      <div class="elementor-widget-container">
        <div class="elementor-button-wrapper">
          <a class="elementor-button elementor-button-link elementor-size-sm" href="mailto:careers@collectiveartists.com" target="_blank">
            <span class="elementor-button-text">Apply Now</span>
          </a>
        </div>
      </div>
    </div>
  </div>
`

const buildJobsSurfaceHtml = ({
  canonicalUrl,
  maxPage = 3,
  nextPage = 'https://www.collectiveartists.com/contact/2/',
  jobs,
}) => `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Contact Us</title>
    <link rel="canonical" href="${canonicalUrl}" />
  </head>
  <body>
    <main>
      <h2>SHAPE YOUR FUTURE WITH US</h2>
      ${jobs.map((job) => buildJobCardHtml(job)).join('\n')}
      <div class="e-load-more-anchor" data-page="1" data-max-page="${maxPage}" data-next-page="${nextPage}"></div>
      <p>Didn’t find the role you were looking for? Write to us at <a href="mailto:careers@collectiveartists.com">careers@collectiveartists.com</a></p>
    </main>
    <footer>
      <a href="mailto:info@collectiveartists.com">info@collectiveartists.com</a>
      <a href="mailto:careers@collectiveartists.com">careers@collectiveartists.com</a>
      <p>Copyright ©COLLECTIVE ARTISTS NETWORK INDIA PRIVATE LIMITED. All rights reserved</p>
    </footer>
  </body>
</html>
`

const pageOneHtml = buildJobsSurfaceHtml({
  canonicalUrl: 'https://www.collectiveartists.com/contact/',
  jobs: [
    {
      jobId: '2899',
      title: 'Logistics &#038; Production SPOC',
      experienceRequired: '0-2 yrs exp.',
    },
    {
      jobId: '2897',
      title: 'Influencer Sales (Business Development)',
      experienceRequired: '4-7 yrs exp.',
    },
  ],
})

const pageTwoHtml = buildJobsSurfaceHtml({
  canonicalUrl: 'https://www.collectiveartists.com/contact/',
  jobs: [
    {
      jobId: '2901',
      title: 'Student Operations Manager',
      experienceRequired: '0-2 yrs exp.',
    },
    {
      jobId: '2902',
      title: 'Video editor &#8211; Social Media',
      experienceRequired: '3-4 yrs exp.',
    },
  ],
})

const pageThreeHtml = buildJobsSurfaceHtml({
  canonicalUrl: 'https://www.collectiveartists.com/contact/',
  jobs: [
    {
      jobId: '2905',
      title: 'Key Account Manager &#8211; Social Media',
      experienceRequired: '4-5 yrs exp.',
    },
    {
      jobId: '2906',
      title: 'Talent Manager',
      experienceRequired: '4-7 yrs exp.',
    },
  ],
})

const loadCollectiveArtistsNetworkModule = async () => {
  try {
    return await import('../../scraper/collectiveartistsnetwork/script.js')
  } catch {
    assert.fail('Expected Collective Artists Network scraper module at ../../scraper/collectiveartistsnetwork/script.js')
  }
}

test('Collective Artists Network recognizes the verified first-party public jobs surface', async () => {
  const collective = await loadCollectiveArtistsNetworkModule()

  assert.equal(collective.hasOfficialJobsSurfaceSignal(pageOneHtml), true)
  assert.equal(collective.extractTotalPages(pageOneHtml), 3)
  assert.deepEqual(collective.buildJobsSurfacePageUrls(3), [
    collective.JOBS_SURFACE_URL,
    'https://www.collectiveartists.com/contact/2/',
    'https://www.collectiveartists.com/contact/3/',
  ])
})

test('Collective Artists Network extracts public first-party roles from the verified jobs surface HTML', async () => {
  const collective = await loadCollectiveArtistsNetworkModule()

  const jobs = collective.extractJobsFromHtml(pageOneHtml, {
    pageUrl: collective.JOBS_SURFACE_URL,
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobs, [
    {
      title: 'Logistics & Production SPOC',
      company: 'Collective Artists Network',
      location: 'India',
      country: 'India',
      link: 'https://www.collectiveartists.com/contact/#job-2899',
      applyUrl: 'https://www.collectiveartists.com/contact/#job-2899',
      sourceUrl: 'https://www.collectiveartists.com/contact/#job-2899',
      source: 'collectiveartistsnetwork',
      jobId: '2899',
      requisitionId: '2899',
      department: 'Talent Collective',
      experienceRequired: '0-2 yrs exp.',
      remoteStatus: 'On-site',
      jobDescription: 'Apply via careers@collectiveartists.com from the official first-party jobs surface.',
      companyCareerPage: 'https://www.collectiveartists.com/contact/',
      companyDomain: 'collectiveartists.com',
      atsPlatform: 'official-company-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
    {
      title: 'Influencer Sales (Business Development)',
      company: 'Collective Artists Network',
      location: 'India',
      country: 'India',
      link: 'https://www.collectiveartists.com/contact/#job-2897',
      applyUrl: 'https://www.collectiveartists.com/contact/#job-2897',
      sourceUrl: 'https://www.collectiveartists.com/contact/#job-2897',
      source: 'collectiveartistsnetwork',
      jobId: '2897',
      requisitionId: '2897',
      department: 'Talent Collective',
      experienceRequired: '4-7 yrs exp.',
      remoteStatus: 'On-site',
      jobDescription: 'Apply via careers@collectiveartists.com from the official first-party jobs surface.',
      companyCareerPage: 'https://www.collectiveartists.com/contact/',
      companyDomain: 'collectiveartists.com',
      atsPlatform: 'official-company-site',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Collective Artists Network run validates the official first-party jobs surface and aggregates paginated roles', async () => {
  const collective = await loadCollectiveArtistsNetworkModule()
  const requestedUrls = []

  const jobs = await collective.createCollectiveArtistsNetworkScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === collective.JOBS_SURFACE_URL) return pageOneHtml
      if (url === 'https://www.collectiveartists.com/contact/2/') return pageTwoHtml
      if (url === 'https://www.collectiveartists.com/contact/3/') return pageThreeHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => FIXED_SCRAPED_AT,
  })

  assert.deepEqual(requestedUrls, [
    collective.JOBS_SURFACE_URL,
    'https://www.collectiveartists.com/contact/2/',
    'https://www.collectiveartists.com/contact/3/',
  ])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].title, 'Logistics & Production SPOC')
  assert.equal(jobs[5].title, 'Talent Manager')
})

test('Collective Artists Network fails closed when the official jobs surface changes or stops exposing role cards', async () => {
  const collective = await loadCollectiveArtistsNetworkModule()

  await assert.rejects(
    collective.createCollectiveArtistsNetworkScraper().run({
      fetchText: async () => '<html><body><h1>Contact Us</h1></body></html>',
    }),
    /official jobs surface/i,
  )

  await assert.rejects(
    collective.createCollectiveArtistsNetworkScraper().run({
      fetchText: async (url) => {
        if (url === collective.JOBS_SURFACE_URL) {
          return buildJobsSurfaceHtml({
            canonicalUrl: 'https://www.collectiveartists.com/contact/',
            jobs: [],
          })
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /no public job cards/i,
  )
})
