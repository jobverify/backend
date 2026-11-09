import assert from 'node:assert/strict'
import test from 'node:test'

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Buy Furniture &amp; Home Decor Online – Up to 65% Off at Best Prices in India | Pepperfry</title>
  </head>
  <body>
    <h1>Buy Furniture &amp; Home Decor Online</h1>
    <div>Browse All Categories</div>
    <div>Partner With Us</div>
    <div>Check Out Bonhomie, Our Blog</div>
    <footer>
      <a href="https://www.pepperfry.com/pages/careers.html?type=footer">Careers</a>
    </footer>
  </body>
</html>
`

const CURRENT_HOMEPAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Best Furniture &amp; Home Decor Online in India - Up to 70% Off | Pepperfry</title>
  </head>
  <body>
    <h1>Best Furniture &amp; Home Decor Online in India</h1>
    <div>Track Your Order</div>
    <div>Find a Store</div>
    <div>Pepperfry in the News</div>
    <div>Sell on pepperfry</div>
    <footer>
      <a href="https://www.pepperfry.com/pages/careers.html?type=footer">Careers</a>
    </footer>
  </body>
</html>
`

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Online Furniture Shopping Store: Shop Online in India for Furniture, Home Decor, Homeware Products @ Pepperfry</title>
  </head>
  <body>
    <section class="crpg-crnt-opening-container">
      <div class="crpg-opn-listitem">
        <span class="crpg-opn-listitem-ttl font-medium text-lg">(Assistant) Manager - Assisted Buying</span>
        <span class="crpg-opn-listitem-location text-sm"> Mumbai </span>
        <a target="_blank" rel="noopener" class="crpg-opn-view-desc-link text-sm" href="https://trendsys.darwinbox.in/ms/candidate/careers/a6690d8c6351c2">
          View Job Description
        </a>
      </div>
      <div class="crpg-opn-listitem">
        <span class="crpg-opn-listitem-ttl font-medium text-lg">Area Manager (Studios)</span>
        <span class="crpg-opn-listitem-location text-sm"> Hyderabad,Mumbai,New Delhi </span>
        <a target="_blank" rel="noopener" class="crpg-opn-view-desc-link text-sm" href="https://trendsys.darwinbox.in/ms/candidate/careers/a695b99381bd79">
          View Job Description
        </a>
      </div>
    </section>
  </body>
</html>
`

const BROKEN_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Careers</h1>
    <p>Open positions coming soon.</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/pepperfry/script.js')
  } catch {
    assert.fail('Expected Pepperfry scraper module at ../../scraper/pepperfry/script.js')
  }
}

test('Pepperfry parser helpers stay pinned to the verified homepage footer link and current first-party careers listings', async () => {
  const pepperfry = await loadModule()

  assert.equal(pepperfry.COMPANY, 'Pepperfry')
  assert.equal(pepperfry.OFFICIAL_BRAND_NAME, 'Pepperfry')
  assert.equal(pepperfry.VERIFIED_ON, '2026-08-04')
  assert.equal(pepperfry.HOMEPAGE_URL, 'https://www.pepperfry.com/')
  assert.equal(
    pepperfry.CAREERS_PAGE_URL,
    'https://www.pepperfry.com/pages/careers.html?type=footer',
  )
  assert.equal(pepperfry.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(pepperfry.hasOfficialHomepageSignal(CURRENT_HOMEPAGE_HTML), true)
  assert.equal(
    pepperfry.extractVerifiedCareersPageUrl(HOMEPAGE_HTML),
    'https://www.pepperfry.com/pages/careers.html?type=footer',
  )
  assert.equal(
    pepperfry.extractVerifiedCareersPageUrl(CURRENT_HOMEPAGE_HTML),
    'https://www.pepperfry.com/pages/careers.html?type=footer',
  )

  const listings = pepperfry.extractCareerListings(CAREERS_HTML)
  assert.deepEqual(listings, [
    {
      title: '(Assistant) Manager - Assisted Buying',
      location: 'Mumbai',
      applyUrl: 'https://trendsys.darwinbox.in/ms/candidate/careers/a6690d8c6351c2',
    },
    {
      title: 'Area Manager (Studios)',
      location: 'Hyderabad, Mumbai, New Delhi',
      applyUrl: 'https://trendsys.darwinbox.in/ms/candidate/careers/a695b99381bd79',
    },
  ])
})

test('Pepperfry returns normalized jobs from the verified first-party careers page', async () => {
  const pepperfry = await loadModule()
  const requestedUrls = []

  const jobs = await pepperfry.createPepperfryScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === pepperfry.HOMEPAGE_URL) {
        return { status: 200, url, html: HOMEPAGE_HTML }
      }

      if (url === pepperfry.CAREERS_PAGE_URL) {
        return { status: 200, url, html: CAREERS_HTML }
      }

      throw new Error(`Unexpected Pepperfry URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    pepperfry.HOMEPAGE_URL,
    pepperfry.CAREERS_PAGE_URL,
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.city, job.jobId]),
    [
      [
        '(Assistant) Manager - Assisted Buying',
        'Mumbai, India',
        'Mumbai',
        'a6690d8c6351c2',
      ],
      [
        'Area Manager (Studios)',
        'Hyderabad, Mumbai, New Delhi, India',
        null,
        'a695b99381bd79',
      ],
    ],
  )
  assert.equal(jobs[0].company, 'Pepperfry')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, 'https://trendsys.darwinbox.in/ms/candidate/careers/a6690d8c6351c2')
  assert.equal(jobs[0].applyUrl, 'https://trendsys.darwinbox.in/ms/candidate/careers/a6690d8c6351c2')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(jobs[1].publicExperienceChecked, true)
})

test('Pepperfry fails closed when the verified homepage link or current careers listing structure drifts', async () => {
  const pepperfry = await loadModule()

  await assert.rejects(
    pepperfry.createPepperfryScraper().run({
      fetchPage: async (url) => {
        if (url === pepperfry.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }
        }

        throw new Error(`Unexpected Pepperfry URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    pepperfry.createPepperfryScraper().run({
      fetchPage: async (url) => {
        if (url === pepperfry.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: HOMEPAGE_HTML.replace(
              'https://www.pepperfry.com/pages/careers.html?type=footer',
              'https://www.pepperfry.com/pages/jobs.html',
            ),
          }
        }

        throw new Error(`Unexpected Pepperfry URL: ${url}`)
      },
    }),
    /verified homepage careers handoff/i,
  )

  await assert.rejects(
    pepperfry.createPepperfryScraper().run({
      fetchPage: async (url) => {
        if (url === pepperfry.HOMEPAGE_URL) {
          return { status: 200, url, html: HOMEPAGE_HTML }
        }

        if (url === pepperfry.CAREERS_PAGE_URL) {
          return { status: 200, url, html: BROKEN_CAREERS_HTML }
        }

        throw new Error(`Unexpected Pepperfry URL: ${url}`)
      },
    }),
    /verified first-party careers listings changed materially/i,
  )
})
