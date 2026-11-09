import assert from 'node:assert/strict'
import test from 'node:test'

const loadBytexlModule = async () => {
  try {
    return await import('../../scraper/bytexl/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>byteXL: Industry-Aligned Skilling for Modern AI Careers</title>
  </head>
  <body>
    <nav>
      <a href="/programs">Programs</a>
      <a href="/careerxl">CareerXL</a>
      <a href="/careers">Careers</a>
    </nav>
    <main>
      <h1>byteXL</h1>
    </main>
  </body>
</html>
`

const missingCareersRouteHtml = `
<!doctype html>
<html lang="en-us">
  <head>
    <title>Not Found</title>
  </head>
  <body>
    HTTP Status: 404 (not found)
  </body>
</html>
`

const careersPageHtml = `
<!doctype html>
<html>
  <body>
    <section class="py-5 bg-grey">
      <div class="careerBox">
        <h3 class="text-secondary">Finance Controller</h3>
        <div class="details">
          <p>We are seeking an experienced Finance Controller to lead the financial operations of our fast-growing EdTech company.</p>
        </div>
        <a href="careers-Finance-Controller.php" class="btn1">View Details</a>
      </div>
      <div class="careerBox">
        <h3 class="text-secondary">Head of Operations</h3>
        <div class="details">
          <p>Are you passionate about problem-solving and providing solutions at scale? Have you ever built an operations team from the ground up? If so, this position is perfect for you!</p>
        </div>
        <a href="careers-Head-of-Operations.php" class="btn1">View Details</a>
      </div>
    </section>
  </body>
</html>
`

const financeControllerDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="banner minHeight2 bg-primary">
      <h1 class="fs-800 fw-bold text-white">Finance Controller</h1>
    </div>
    <section class="py-5 bg-grey">
      <h2 class="fs-500">I. Overview</h2>
      <p>Our vision is to be the leading edtech company.</p>
    </section>
    <section class="py-5">
      <p class="justify mt-2 fs-300">
        <span class="fs-400"><b>Location:</b></span> Bangalore/Hyderabad
      </p>
      <p class="justify mt-2 fs-300">
        <span class="fs-400"><b>Experience:</b></span> 8-10 years
      </p>
      <h2 class="fs-500 mt-4">Position Overview:</h2>
      <p class="justify fs-300 mt-2">We are seeking an experienced <b>Finance Controller</b> to lead the financial operations of our fast-growing EdTech company.</p>
    </section>
    <section class="py-5 bg-grey">
      <h2>APPLY NOW</h2>
      <p>To apply for this job, please mail your resume and cover letter to <a href="mailto:careers@bytexl.in">careers@bytexl.in</a></p>
    </section>
  </body>
</html>
`

const headOfOperationsDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="banner minHeight2 bg-primary">
      <h1 class="fs-800 fw-bold text-white">Head of Operations</h1>
    </div>
    <section class="py-5 bg-grey">
      <h2 class="fs-500">I. Overview</h2>
      <p>Our vision is to be the leading edtech company.</p>
    </section>
    <section class="py-5">
      <p class="justify mt-2 fs-300">
        <span class="fs-400"><b>Location:</b></span> Hyderabad-India
      </p>
      <p class="justify mt-2 fs-300">
        <span class="fs-400"><b>Experience:</b></span> 7-10 years | Full-Time
      </p>
      <h2 class="fs-500 mt-4">About the Role</h2>
      <p class="justify fs-300 mt-2">At byteXL, we're seeking a <b>Head of Operations</b> to lead our end-to-end operational strategy.</p>
    </section>
    <section class="py-5 bg-grey">
      <h2>APPLY NOW</h2>
      <p>To apply for this job, please mail your resume and cover letter to <a href="mailto:careers@bytexl.in">careers@bytexl.in</a></p>
    </section>
  </body>
</html>
`

const learningDevelopmentManagerDetailHtml = `
<!doctype html>
<html>
  <body>
    <div class="banner minHeight2 bg-primary">
      <h1 class="fs-800 fw-bold text-white">Learning and Development Manager</h1>
    </div>
    <section class="py-5 bg-grey">
      <h1 class="fs-500">I. Overview</h1>
      <p>Our vision is to be the leading edtech company.</p>
    </section>
    <section class="py-5">
      <h1 class="fs-500">II. Job Description</h1>
      <p class="justify mt-2 fs-300">The Learning Development Executive plays a pivotal role in supporting the planning and execution of our programs.</p>
    </section>
    <section class="pb-5">
      <h1 class="fs-500">IV. What's in it for you</h1>
      <ol>
        <li><p class="fs-300">Location: Across India (Telangana, Andhrapradesh, Chandigarh, Delhi, Punjab, Mumbai)</p></li>
        <li><p class="fs-300">Joining: As soon as possible.</p></li>
      </ol>
    </section>
    <section class="py-5 bg-grey">
      <h2>APPLY NOW</h2>
      <p>To apply for this job, please mail your resume and cover letter to <a href="mailto:careers@bytexl.in">careers@bytexl.in</a></p>
    </section>
  </body>
</html>
`

test('byteXL scraper verifies the current official homepage and missing careers route while preserving the legacy detail parser', async () => {
  const bytexl = await loadBytexlModule()
  assert.ok(bytexl, 'Expected byteXL scraper module at ../../scraper/bytexl/script.js')

  assert.equal(bytexl.HOMEPAGE_URL, 'https://bytexl.com/')
  assert.equal(bytexl.CAREERS_PAGE_URL, 'https://bytexl.com/careers')
  assert.equal(bytexl.COMPANY, 'byteXL')
  assert.equal(bytexl.SOURCE, 'bytexl')
  assert.equal(bytexl.VERIFIED_ON, '2026-08-13')
  assert.equal(bytexl.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    bytexl.isVerifiedMissingCareersRoute({ status: 404, html: missingCareersRouteHtml }),
    true,
  )

  assert.deepEqual(bytexl.extractOpenings(careersPageHtml), [
    {
      title: 'Finance Controller',
      summary: 'We are seeking an experienced Finance Controller to lead the financial operations of our fast-growing EdTech company.',
      sourceUrl: 'https://bytexl.com/careers-Finance-Controller.php',
    },
    {
      title: 'Head of Operations',
      summary: 'Are you passionate about problem-solving and providing solutions at scale? Have you ever built an operations team from the ground up? If so, this position is perfect for you!',
      sourceUrl: 'https://bytexl.com/careers-Head-of-Operations.php',
    },
  ])

  const financeDetail = bytexl.extractJobDetail(
    financeControllerDetailHtml,
    'https://bytexl.com/careers-Finance-Controller.php',
  )
  assert.equal(financeDetail.title, 'Finance Controller')
  assert.equal(financeDetail.location, 'Bangalore/Hyderabad, India')
  assert.equal(financeDetail.city, 'Bangalore')
  assert.equal(financeDetail.country, 'India')
  assert.equal(financeDetail.experienceRequired, '8-10 years')
  assert.equal(financeDetail.employmentType, null)
  assert.equal(financeDetail.applyUrl, 'mailto:careers@bytexl.in')
  assert.match(financeDetail.jobDescription, /lead the financial operations/i)

  const operationsDetail = bytexl.extractJobDetail(
    headOfOperationsDetailHtml,
    'https://bytexl.com/careers-Head-of-Operations.php',
  )
  assert.equal(operationsDetail.location, 'Hyderabad, India')
  assert.equal(operationsDetail.city, 'Hyderabad')
  assert.equal(operationsDetail.experienceRequired, '7-10 years')
  assert.equal(operationsDetail.employmentType, 'Full-Time')
  assert.match(operationsDetail.jobDescription, /lead our end-to-end operational strategy/i)

  const learningDetail = bytexl.extractJobDetail(
    learningDevelopmentManagerDetailHtml,
    'https://bytexl.com/careers-Learning-Development-Manager.php',
  )
  assert.equal(
    learningDetail.location,
    'Across India (Telangana, Andhrapradesh, Chandigarh, Delhi, Punjab, Mumbai), India',
  )
  assert.equal(learningDetail.city, null)
  assert.equal(learningDetail.experienceRequired, null)
  assert.equal(learningDetail.employmentType, null)
  assert.match(learningDetail.jobDescription, /Learning Development Executive plays a pivotal role/i)
})

test('run returns an honest zero-job result while the official /careers route currently resolves to a verified 404', async () => {
  const bytexl = await loadBytexlModule()
  assert.ok(bytexl, 'Expected byteXL scraper module at ../../scraper/bytexl/script.js')

  const pageRequests = []
  const textRequests = []
  const scraper = bytexl.createBytexlScraper()

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === bytexl.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === bytexl.CAREERS_PAGE_URL) {
        return { status: 404, url, html: missingCareersRouteHtml }
      }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      textRequests.push(url)
      throw new Error(`Unexpected detail URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    'https://bytexl.com/',
    'https://bytexl.com/careers',
  ])
  assert.deepEqual(textRequests, [])
  assert.deepEqual(jobs, [])
})

test('run still follows legacy byteXL detail pages if the official /careers route publishes openings again', async () => {
  const bytexl = await loadBytexlModule()
  assert.ok(bytexl, 'Expected byteXL scraper module at ../../scraper/bytexl/script.js')

  const pageRequests = []
  const textRequests = []
  const scraper = bytexl.createBytexlScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchPage: async (url) => {
      pageRequests.push(url)

      if (url === bytexl.HOMEPAGE_URL) return { status: 200, url, html: homepageHtml }
      if (url === bytexl.CAREERS_PAGE_URL) return { status: 200, url, html: careersPageHtml }

      throw new Error(`Unexpected page URL: ${url}`)
    },
    fetchText: async (url) => {
      textRequests.push(url)

      if (url === 'https://bytexl.com/careers-Finance-Controller.php') return financeControllerDetailHtml

      throw new Error(`Unexpected detail URL: ${url}`)
    },
  })

  assert.deepEqual(pageRequests, [
    'https://bytexl.com/',
    'https://bytexl.com/careers',
  ])
  assert.deepEqual(textRequests, [
    'https://bytexl.com/careers-Finance-Controller.php',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Finance Controller')
  assert.equal(jobs[0].company, 'byteXL')
  assert.equal(jobs[0].location, 'Bangalore/Hyderabad, India')
  assert.equal(jobs[0].city, 'Bangalore')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl, 'https://bytexl.com/careers-Finance-Controller.php')
  assert.equal(jobs[0].applyUrl, 'mailto:careers@bytexl.in')
  assert.equal(jobs[0].source, 'bytexl')
  assert.equal(jobs[0].link, 'mailto:careers@bytexl.in')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
