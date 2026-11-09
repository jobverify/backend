import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_PAGE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Welcome to your team - Deqode Solutions</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="/career/python-developer-1">Python Developer</a>
  </body>
</html>
`

const PYTHON_DEVELOPER_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Python Developer - Deqode Solutions</title>
    <link rel="canonical" href="https://deqode.com/career/python-developer-1" />
  </head>
  <body>
    <p data-pagefind-meta="title">Python Developer</p>
    <p data-pagefind-meta="description">We're looking for a highly-skilled Python Developer to join our Back-end team.</p>
    <div>
      <p>Role:</p><p>Python developer</p>
      <p>Location:</p><p>Indore</p>
      <p>Experience:</p><p>3-5 years</p>
      <p>Category:</p><p>Software Development</p>
      <p>Employment Type:</p><p>Full - Type</p>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/deqode/script.js')
  } catch {
    assert.fail('Expected Deqode scraper module at ../../scraper/deqode/script.js')
  }
}

test('Deqode helpers stay pinned to the verified first-party careers and job detail surfaces from Saturday, July 18, 2026', async () => {
  const deqode = await loadModule()

  assert.equal(deqode.SOURCE, 'deqode')
  assert.equal(deqode.COMPANY, 'Deqode')
  assert.equal(deqode.OFFICIAL_BRAND_NAME, 'Deqode Solutions')
  assert.equal(deqode.VERIFIED_ON, '2026-07-18')
  assert.equal(deqode.HOMEPAGE_URL, 'https://deqode.com/')
  assert.equal(deqode.CAREERS_URL, 'https://www.deqode.com/career')
  assert.equal(deqode.VERIFIED_JOB_DETAIL_URL, 'https://deqode.com/career/python-developer-1')
  assert.equal(deqode.hasOfficialCareersSignal(CAREERS_PAGE_HTML), true)
  assert.deepEqual(
    deqode.extractJobDetailUrls(CAREERS_PAGE_HTML),
    ['https://deqode.com/career/python-developer-1'],
  )

  const job = deqode.extractJobDetail(PYTHON_DEVELOPER_DETAIL_HTML, deqode.VERIFIED_JOB_DETAIL_URL)
  assert.equal(job.title, 'Python Developer')
  assert.equal(job.location, 'Indore')
  assert.equal(job.department, 'Software Development')
  assert.equal(job.employmentType, 'Full - Type')
  assert.equal(job.applyUrl, deqode.VERIFIED_JOB_DETAIL_URL)
})

test('Deqode returns public jobs from the verified first-party careers page and linked detail pages', async () => {
  const deqode = await loadModule()
  const requestedUrls = []

  const jobs = await deqode.createDeqodeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === deqode.CAREERS_URL) return CAREERS_PAGE_HTML
      if (url === deqode.VERIFIED_JOB_DETAIL_URL) return PYTHON_DEVELOPER_DETAIL_HTML
      throw new Error(`Unexpected Deqode URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [deqode.CAREERS_URL, deqode.VERIFIED_JOB_DETAIL_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, 'Deqode')
  assert.equal(jobs[0].source, 'deqode')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Deqode ignores non-job /career asset paths when collecting detail URLs', async () => {
  const deqode = await loadModule()

  const careersPageWithAssets = `
<!doctype html>
<html lang="en">
  <head>
    <title>Welcome to your team - Deqode Solutions</title>
  </head>
  <body>
    <h1>Current Openings</h1>
    <img src="/career/people/people_img1.png" alt="People" />
    <img src="/career/people/people_img2.png" alt="People" />
    <a href="/career/python-developer-1">Python Developer</a>
  </body>
</html>
`

  assert.deepEqual(
    deqode.extractJobDetailUrls(careersPageWithAssets),
    ['https://deqode.com/career/python-developer-1'],
  )
})

test('Deqode fails closed when the verified careers page or detail page drifts', async () => {
  const deqode = await loadModule()

  await assert.rejects(
    deqode.createDeqodeScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    deqode.createDeqodeScraper().run({
      fetchText: async (url) => {
        if (url === deqode.CAREERS_URL) return CAREERS_PAGE_HTML
        return '<html><body><h1>Python Developer</h1></body></html>'
      },
    }),
    /job detail no longer matches/i,
  )
})
