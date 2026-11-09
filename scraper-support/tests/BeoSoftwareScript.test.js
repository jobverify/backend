import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Discover Jobs - BEO Softwares | IT Services | Digital Transformation | Outsourcing | Consulting</title>
  </head>
  <body>
    <main>
      <h1>Discover Jobs</h1>
      <div id="job_list">
        <div class="section-content">
          <ul class="search-results">
            <li class="d-flex align-items-center">
              <div class="search-result-column flex-grow-1">
                <p class="fs-lg fw-bold search-headding">Senior Full-Stack Node.js Developer</p>
                <p>Location : Kochi</p>
                <p>Posted on 31-07-2026</p>
              </div>
              <div class="search-result-column">
                <a href="https://beo-software.in/careers-jobs-detail/senior-full-stack-nodejs-developer" class="circle-btn"></a>
              </div>
            </li>
            <li class="d-flex align-items-center">
              <div class="search-result-column flex-grow-1">
                <p class="fs-lg fw-bold search-headding">Senior Full-Stack Developer</p>
                <p>Location : Kochi</p>
                <p>Posted on 31-07-2026</p>
              </div>
              <div class="search-result-column">
                <a href="https://beo-software.in/careers-jobs-detail/senior-full-stack-developer-6" class="circle-btn"></a>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </main>
  </body>
</html>
`

const subscriptionShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Discover Jobs - BEO Softwares | IT Services | Digital Transformation | Outsourcing | Consulting</title>
  </head>
  <body>
    <main>
      <article class="article">
        <div class="article-header text-center">
          <p class="fs-lg fw-bold">Join our community</p>
          <p>Be the first one to get alerts when we post new job opportunities that might be a perfect fit for you.</p>
        </div>
        <form id="subscription-form" method="POST" action="https://beo-software.in/subscription">
          <input type="email" name="email">
        </form>
      </article>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/beosoftware/script.js')
  } catch {
    assert.fail('Expected BEO Software scraper module at ../../scraper/beosoftware/script.js')
  }
}

test('BEO Software extracts public job cards from the verified first-party careers page', async () => {
  const beo = await loadModule()

  assert.equal(beo.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(beo.extractJobCards(careersHtml), [
    {
      title: 'Senior Full-Stack Node.js Developer',
      location: 'Kochi, India',
      city: 'Kochi',
      postingDate: '2026-07-31',
      detailUrl: 'https://beo-software.in/careers-jobs-detail/senior-full-stack-nodejs-developer',
    },
    {
      title: 'Senior Full-Stack Developer',
      location: 'Kochi, India',
      city: 'Kochi',
      postingDate: '2026-07-31',
      detailUrl: 'https://beo-software.in/careers-jobs-detail/senior-full-stack-developer-6',
    },
  ])

  const jobs = await beo.createBeoSoftwareScraper().run({
    fetchText: async () => careersHtml,
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.postingDate, job.applyUrl]),
    [
      [
        'Senior Full-Stack Node.js Developer',
        'Kochi, India',
        '2026-07-31',
        'https://beo-software.in/careers-jobs-detail/senior-full-stack-nodejs-developer',
      ],
      [
        'Senior Full-Stack Developer',
        'Kochi, India',
        '2026-07-31',
        'https://beo-software.in/careers-jobs-detail/senior-full-stack-developer-6',
      ],
    ],
  )
})

test('BEO Software returns [] when the verified careers page is a subscription-only shell with no public job cards', async () => {
  const beo = await loadModule()

  assert.equal(beo.hasOfficialCareersSignal(subscriptionShellHtml), true)
  assert.equal(beo.hasVerifiedSubscriptionShell(subscriptionShellHtml), true)
  assert.deepEqual(beo.extractJobCards(subscriptionShellHtml), [])

  const jobs = await beo.createBeoSoftwareScraper().run({
    fetchText: async () => subscriptionShellHtml,
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
})
