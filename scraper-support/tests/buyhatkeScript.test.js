import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sales, SEO, Software Engineer Job Openings | Jobs at Buyhatke</title>
  </head>
  <body>
    <main>
      <h1>Careers @ Buyhatke</h1>
      <section>
        <h2>Jobs @ Buyhatke</h2>
        <article class="opening-card">
          <a href="backend-developer.php">
            <h3>Backend Developer</h3>
          </a>
        </article>
        <article class="opening-card">
          <a href="android-developer.php">
            <h3>Android Developer</h3>
          </a>
        </article>
      </section>
    </main>
  </body>
</html>
`

const CURRENT_LINK_LIST_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sales, SEO, Software Engineer Job Openings | Jobs at Buyhatke</title>
  </head>
  <body>
    <h1>Careers @ Buyhatke</h1>
    <h2>Jobs @ Buyhatke</h2>
    <ul class="jobs">
      <li><a href="android-developer.php">Android Developer</a></li>
      <li><a href="backend-developer.php">Back End Developer</a></li>
      <li><a href="fed.php">Front End Engineer</a></li>
      <li><a href="http://compare.buyhatke.com/products/siteMap.php">Price History & Tracker</a></li>
    </ul>
  </body>
</html>
`

const BACKEND_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Buyhatke | Backend Developer</title>
  </head>
  <body>
    <main>
      <h1>Backend Developer</h1>
      <section>
        <h2>Job Description</h2>
        <p>Build backend services that power price tracking and commerce intelligence.</p>
      </section>
      <section>
        <h2>Requirements</h2>
        <ul>
          <li>3+ years of experience with Node.js</li>
          <li>Experience with scalable backend systems</li>
        </ul>
      </section>
      <iframe src="https://docs.google.com/forms/d/e/buyhatke-backend/viewform?embedded=true"></iframe>
    </main>
  </body>
</html>
`

const ANDROID_DETAIL_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Buyhatke | Android Developer</title>
  </head>
  <body>
    <main>
      <h1>Android Developer</h1>
      <section>
        <h2>Job Description</h2>
        <p>Ship user-facing Android experiences for millions of shoppers.</p>
      </section>
      <section>
        <h2>Requirements</h2>
        <ul>
          <li>2+ years of Android development experience</li>
          <li>Experience with Kotlin</li>
        </ul>
      </section>
      <iframe src="https://docs.google.com/forms/d/e/buyhatke-android/viewform?embedded=true"></iframe>
    </main>
  </body>
</html>
`

const loadBuyhatkeModule = async () => {
  try {
    return await import('../../scraper/buyhatke/script.js')
  } catch {
    assert.fail('Expected Buyhatke scraper module at ../../scraper/buyhatke/script.js')
  }
}

test('hasOfficialCareersSignal validates the verified Buyhatke careers surface', async () => {
  const buyhatke = await loadBuyhatkeModule()

  assert.equal(buyhatke.hasOfficialCareersSignal(CAREERS_HTML), true)
})

test('extractListings parses Buyhatke careers cards into detail-page listings', async () => {
  const buyhatke = await loadBuyhatkeModule()

  assert.equal(buyhatke.CAREERS_URL, 'https://compare.buyhatke.com/company/')

  const jobs = buyhatke.extractListings(CAREERS_HTML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Backend Developer',
    company: 'Buyhatke',
    department: null,
    location: null,
    city: null,
    country: null,
    jobId: 'backend-developer',
    requisitionId: null,
    sourceUrl: 'https://compare.buyhatke.com/company/backend-developer.php',
    applyUrl: 'https://compare.buyhatke.com/company/backend-developer.php',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  })

  assert.deepEqual(jobs[1], {
    title: 'Android Developer',
    company: 'Buyhatke',
    department: null,
    location: null,
    city: null,
    country: null,
    jobId: 'android-developer',
    requisitionId: null,
    sourceUrl: 'https://compare.buyhatke.com/company/android-developer.php',
    applyUrl: 'https://compare.buyhatke.com/company/android-developer.php',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: null,
  })
})

test('extractListings parses the current Buyhatke linked role list', async () => {
  const buyhatke = await loadBuyhatkeModule()

  const jobs = buyhatke.extractListings(CURRENT_LINK_LIST_CAREERS_HTML)

  assert.deepEqual(
    jobs.map((job) => [job.title, job.jobId, job.sourceUrl]),
    [
      ['Android Developer', 'android-developer', 'https://compare.buyhatke.com/company/android-developer.php'],
      ['Back End Developer', 'backend-developer', 'https://compare.buyhatke.com/company/backend-developer.php'],
      ['Front End Engineer', 'fed', 'https://compare.buyhatke.com/company/fed.php'],
    ],
  )
})

test('extractListings ignores Buyhatke non-job sitemap and product links', async () => {
  const buyhatke = await loadBuyhatkeModule()

  const jobs = buyhatke.extractListings(CURRENT_LINK_LIST_CAREERS_HTML)

  assert.equal(jobs.some((job) => /siteMap/i.test(job.jobId)), false)
  assert.equal(jobs.some((job) => /Price History & Tracker/i.test(job.title)), false)
})

test('extractJobDetail lifts Buyhatke detail fields and Google Forms apply links', async () => {
  const buyhatke = await loadBuyhatkeModule()

  const listing = buyhatke.extractListings(CAREERS_HTML)[0]
  const job = buyhatke.extractJobDetail(BACKEND_DETAIL_HTML, listing)

  assert.equal(job.title, 'Backend Developer')
  assert.equal(job.applyUrl, 'https://docs.google.com/forms/d/e/buyhatke-backend/viewform?embedded=true')
  assert.match(job.jobDescription, /price tracking/i)
  assert.equal(job.minimumQualification, '3+ years of experience with Node.js')
  assert.equal(job.preferredQualification, 'Experience with scalable backend systems')
  assert.deepEqual(job.requiredSkills, [
    '3+ years of experience with Node.js',
    'Experience with scalable backend systems',
  ])
})

test('run fetches the Buyhatke careers page and detail pages, then decorates runner fields', async () => {
  const buyhatke = await loadBuyhatkeModule()
  const requestedUrls = []

  const jobs = await buyhatke.createBuyhatkeScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === 'https://compare.buyhatke.com/company/') return CAREERS_HTML
      if (url === 'https://compare.buyhatke.com/company/backend-developer.php') return BACKEND_DETAIL_HTML
      if (url === 'https://compare.buyhatke.com/company/android-developer.php') return ANDROID_DETAIL_HTML

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-14T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://compare.buyhatke.com/company/',
    'https://compare.buyhatke.com/company/backend-developer.php',
    'https://compare.buyhatke.com/company/android-developer.php',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'buyhatke')
  assert.equal(jobs[0].link, 'https://docs.google.com/forms/d/e/buyhatke-backend/viewform?embedded=true')
  assert.equal(jobs[0].scrapedAt, '2026-07-14T12:00:00.000Z')
})

test('run fails closed when the Buyhatke careers surface changes', async () => {
  const buyhatke = await loadBuyhatkeModule()

  await assert.rejects(
    buyhatke.createBuyhatkeScraper().run({
      fetchText: async () => '<html><body>No open roles here</body></html>',
    }),
    /verified Buyhatke careers surface/i,
  )
})
