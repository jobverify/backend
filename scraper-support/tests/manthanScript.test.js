import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Manthan</title>
  </head>
  <body>
    <p>We are Manthan. We love technology, we love consumers.</p>
    <p>We design prescriptive analytics applications powered by AI; on cloud, for customer-facing businesses.</p>
    <a href="https://manthan.com/careers/">Careers</a>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers &#8211; Manthan</title>
  </head>
  <body>
    <div class="elementor-widget-container">
      <h4 class="elementor-heading-title elementor-size-default">Legacy Role</h4>
    </div>
    <div class="elementor-widget-container">
      <p>5+ years experience | MBA | Bangalore, India</p>
    </div>
    <div class="elementor-button-wrapper">
      <a class="elementor-button elementor-button-link elementor-size-sm" href="https://manthan.com/contact/">
        <span class="elementor-button-content-wrapper">
          <span class="elementor-button-text">Apply Now</span>
        </span>
      </a>
    </div>

    <div class="elementor-widget-container">
      <h4 class="elementor-heading-title elementor-size-default">Senior Manager - Product Marketing</h4>
    </div>
    <div class="elementor-widget-container">
      <p>8+ years experience | MBA | Bangalore, India</p>
    </div>
    <div class="elementor-button-wrapper">
      <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.linkedin.com/jobs/view/1592115764/" target="_blank">
        <span class="elementor-button-content-wrapper">
          <span class="elementor-button-text">Apply Now</span>
        </span>
      </a>
    </div>

    <div class="elementor-widget-container">
      <h4 class="elementor-heading-title elementor-size-default">Director - Product Marketing</h4>
    </div>
    <div class="elementor-widget-container">
      10+ years experience | MBA | Bangalore, India
    </div>
    <div class="elementor-button-wrapper">
      <a class="elementor-button elementor-button-link elementor-size-sm" href="https://www.linkedin.com/jobs/view/1592111875/" target="_blank">
        <span class="elementor-button-content-wrapper">
          <span class="elementor-button-text">Apply Now</span>
        </span>
      </a>
    </div>
  </body>
</html>
`

const loadManthanModule = async () => {
  try {
    return await import('../../scraper/manthan/script.js')
  } catch {
    assert.fail('Expected Manthan scraper module at ../../scraper/manthan/script.js')
  }
}

test('Manthan scraper pins the verified official careers page and extracts the current concrete openings', async () => {
  const manthan = await loadManthanModule()

  assert.equal(manthan.SOURCE, 'manthan')
  assert.equal(manthan.COMPANY, 'Manthan')
  assert.equal(manthan.OFFICIAL_BRAND_NAME, 'Manthan')
  assert.equal(manthan.VERIFIED_ON, '2026-07-16')
  assert.equal(manthan.HOMEPAGE_URL, 'https://manthan.com/')
  assert.equal(manthan.CAREERS_URL, 'https://manthan.com/careers/')
  assert.match(manthan.VERIFIED_SURFACE_SUMMARY, /two concrete public openings/i)

  assert.equal(manthan.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(manthan.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(manthan.parseRoleMeta('8+ years experience | MBA | Bangalore, India'), {
    experienceRequired: '8+ years experience',
    minimumQualification: 'MBA',
    location: 'Bangalore, India',
    city: 'Bangalore',
    country: 'India',
  })
  assert.equal(manthan.extractLinkedInJobId('https://www.linkedin.com/jobs/view/1592115764/'), '1592115764')
  assert.deepEqual(manthan.extractJobCards(careersHtml), [
    {
      title: 'Senior Manager - Product Marketing',
      company: 'Manthan',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '1592115764',
      requisitionId: '1592115764',
      sourceUrl: 'https://manthan.com/careers/',
      applyUrl: 'https://www.linkedin.com/jobs/view/1592115764/',
      employmentType: null,
      experienceRequired: '8+ years experience',
      minimumQualification: 'MBA',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: '8+ years experience | MBA | Bangalore, India',
    },
    {
      title: 'Director - Product Marketing',
      company: 'Manthan',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '1592111875',
      requisitionId: '1592111875',
      sourceUrl: 'https://manthan.com/careers/',
      applyUrl: 'https://www.linkedin.com/jobs/view/1592111875/',
      employmentType: null,
      experienceRequired: '10+ years experience',
      minimumQualification: 'MBA',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: '10+ years experience | MBA | Bangalore, India',
    },
  ])
})

test('Manthan run validates the official first-party surface and returns the live inline openings', async () => {
  const manthan = await loadManthanModule()
  const requestedUrls = []

  const jobs = await manthan.createManthanScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === manthan.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === manthan.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      throw new Error(`Unexpected Manthan URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    manthan.HOMEPAGE_URL,
    manthan.CAREERS_URL,
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'manthan')
  assert.equal(jobs[0].link, 'https://www.linkedin.com/jobs/view/1592115764/')
  assert.equal(jobs[1].jobId, '1592111875')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Manthan scraper fails closed when the official careers page no longer exposes the verified concrete openings', async () => {
  const manthan = await loadManthanModule()

  await assert.rejects(
    manthan.createManthanScraper().run({
      fetchPage: async (url) => {
        if (url === manthan.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === manthan.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Careers &#8211; Manthan</title></head>
                <body>
                  <a href="https://manthan.com/contact/">Apply Now</a>
                </body>
              </html>
            `,
          }
        }

        throw new Error(`Unexpected Manthan URL: ${url}`)
      },
    }),
    /careers page no longer exposes the verified concrete public openings/i,
  )
})
