import assert from 'node:assert/strict'
import test from 'node:test'

const loadMadisonWorldModule = async () => import('../../scraper/madisonworld/script.js')

const buildCareersHtml = (jobs) => `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers</title>
  </head>
  <body>
    <div id="__next"></div>
    <section>
      <h5>You can drop in your resume and portfolio</h5>
    </section>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          jobs,
        },
      },
    })}</script>
  </body>
</html>
`

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Madison World</title>
  </head>
  <body>
    <main>
      <h1>Madison World</h1>
      <p>For 36 years, Madison World has been solving clients' marketing challenges and driving sustainable profits.</p>
      <a href="/careers">Careers</a>
    </main>
  </body>
</html>
`

const careersHtml = buildCareersHtml([
  {
    id: 11,
    attributes: {
      title: 'Account Executive',
      tag: 'Madison PR',
      years: '6 months to 1 year',
      positions: '02',
      city: 'Mumbai',
      publishedAt: '2026-07-03T10:20:21.617Z',
    },
  },
  {
    id: 12,
    attributes: {
      title: 'Digital Media Planner',
      tag: 'Madison Digital',
      years: '2 to 7 years',
      positions: '3',
      city: 'Mumbai',
      publishedAt: '2026-07-06T06:35:56.483Z',
    },
  },
  {
    id: 13,
    attributes: {
      title: 'Performance Marketer',
      tag: 'Madison Digital',
      years: '2 to 7 Years',
      positions: '5',
      city: 'Mumbai',
      publishedAt: '2026-07-06T06:34:41.329Z',
    },
  },
  {
    id: 14,
    attributes: {
      title: 'Account Manager',
      tag: 'Madison Digital',
      years: '2 to 7 Years',
      positions: '2',
      city: 'Mumbai',
      publishedAt: '2026-07-06T06:36:41.329Z',
    },
  },
])

test('Madison World validates its first-party homepage and careers surface', async () => {
  const madisonWorld = await loadMadisonWorldModule()

  assert.equal(madisonWorld.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(madisonWorld.hasOfficialCareersSignal(careersHtml), true)
})

test('extractJobsFromNextData parses Madison World jobs from the careers page payload', async () => {
  const madisonWorld = await loadMadisonWorldModule()
  const jobs = madisonWorld.extractJobsFromNextData(careersHtml)

  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'Account Executive',
    company: 'Madison World',
    department: 'Madison PR',
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: '11',
    requisitionId: '11',
    sourceUrl: 'https://madisonindia.com/careers',
    applyUrl: 'https://madisonindia.com/careers#careerform',
    employmentType: null,
    experienceRequired: '6 months to 1 year',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-03T10:20:21.617Z',
    closingDate: null,
    jobDescription: 'Madison PR - 6 months to 1 year - 02 positions - Mumbai',
  })
})

test('run fetches the homepage and careers page before returning decorated jobs', async () => {
  const madisonWorld = await loadMadisonWorldModule()
  const requestedUrls = []
  const scraper = madisonWorld.createMadisonWorldScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === madisonWorld.HOMEPAGE_URL) return homepageHtml
      if (url === madisonWorld.CAREERS_PAGE_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [madisonWorld.HOMEPAGE_URL, madisonWorld.CAREERS_PAGE_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[2].source, 'madisonworld')
  assert.equal(jobs[2].link, 'https://madisonindia.com/careers#careerform')
  assert.equal(jobs[2].company, 'Madison World')
  assert.equal(jobs[2].city, 'Mumbai')
  assert.equal(typeof jobs[2].scrapedAt, 'string')
})
