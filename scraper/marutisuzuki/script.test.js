import assert from 'node:assert/strict'
import test from 'node:test'

const loadMarutiSuzukiModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Maruti Suzuki scraper module at ./script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Life at Maruti Suzuki India Limited</title>
  </head>
  <body>
    <main>
      <h1>Work with Maruti Suzuki</h1>
      <section>
        <h2>Freshers</h2>
        <p>
          We will be maintaining your resume in our database and will contact you, in case we
          find it suitable as per our requirement.
        </p>
        <a href="https://maruti.app.param.ai/jobs/">apply now</a>
      </section>

      <section>
        <h2>All India Engineering Hiring 2023</h2>
        <p>Passing Year batch 2021 only</p>
        <p>Last date for Application: July 16, 2023, 23:59 hrs</p>
        <a href="https://maruti.app.param.ai/jobs/all-india-hiring-2023-20-btech-and-mtech">
          Link to Apply
        </a>
      </section>

      <section>
        <h2>experienced professionals</h2>
        <p>Jobs at Maruti Suzuki, are open for professionals from diverse backgrounds.</p>
        <a href="https://maruti.app.param.ai/jobs/">apply now</a>
      </section>

      <section>
        <h2>WORKMEN HIRING (ITI)</h2>
        <p>Passing Year 2019, 2020 &amp; 2021</p>
        <p>SCVT &amp; NCVT only</p>
      </section>
    </main>
  </body>
</html>
`

const currentCareersHubHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Life at Maruti Suzuki India Limited</title>
  </head>
  <body>
    <main>
      <section>
        <h1>Come, join us! The future of mobility needs you</h1>
        <p>Maruti Suzuki is built on trust, making mobility in India simpler, safer, and more reassuring every day.</p>
        <a href="#career-life-at-msil">Life at MSIL</a>
        <a href="#job-listing">See Open Positions</a>
      </section>

      <section>
        <h2>WHY WORK WITH US</h2>
        <p>We believe in the four pillars of Maruti that shape meaningful careers.</p>
        <h3>Better Opportunities</h3>
        <h3>Learning &#x26; Development</h3>
        <h3>Care &#x26; Love</h3>
        <h3>Maximize Potential</h3>
      </section>

      <section id="job-listing">
        <h2>JOIN US</h2>
        <p>View all open positions</p>

        <article>
          <h3>Freshers</h3>
          <p>0-1 YOE</p>
          <p>Entry Level</p>
          <p>PAN India / Hybrid</p>
          <a href="https://maruti.app.param.ai/jobs/">Apply Now</a>
        </article>

        <article>
          <h3>All India Engineering Hiring</h3>
          <p>0-1 YOE</p>
          <p>Entry Level</p>
          <p>PAN India / Hybrid</p>
          <a href="https://maruti.app.param.ai/jobs/">Apply Now</a>
        </article>

        <article>
          <h3>Experienced Professionals</h3>
          <p>0-1 YOE</p>
          <p>Entry Level</p>
          <p>PAN India / Hybrid</p>
          <a href="https://maruti.app.param.ai/jobs/">Apply Now</a>
        </article>

        <article>
          <h3>Workmen Hiring (ITI)</h3>
          <p>0-1 YOE</p>
          <p>Entry Level</p>
          <p>PAN India / Hybrid</p>
          <a href="https://www.marutisuzuki.com/corporate/careers/join-us/career-notice">Apply Now</a>
        </article>
      </section>
    </main>
  </body>
</html>
`

test('Maruti Suzuki scraper validates the verified official careers surface and current apply-only links', async () => {
  const marutiSuzuki = await loadMarutiSuzukiModule()

  assert.equal(marutiSuzuki.SOURCE, 'marutisuzuki')
  assert.equal(marutiSuzuki.COMPANY, 'Maruti Suzuki India Limited')
  assert.equal(marutiSuzuki.CAREERS_URL, 'https://www.marutisuzuki.com/corporate/careers')
  assert.equal(marutiSuzuki.APPLY_PORTAL_URL, 'https://maruti.app.param.ai/jobs/')
  assert.equal(marutiSuzuki.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(marutiSuzuki.hasArchivedApplyOnlySignal(officialCareersHtml), true)
  assert.deepEqual(marutiSuzuki.extractApplyUrls(officialCareersHtml), [
    'https://maruti.app.param.ai/jobs/',
    'https://maruti.app.param.ai/jobs/all-india-hiring-2023-20-btech-and-mtech',
  ])
})

test('Maruti Suzuki scraper accepts the current careers hub and generic apply-only handoff surface', async () => {
  const marutiSuzuki = await loadMarutiSuzukiModule()

  assert.equal(marutiSuzuki.hasOfficialCareersSignal(currentCareersHubHtml), true)
  assert.equal(marutiSuzuki.hasArchivedApplyOnlySignal(currentCareersHubHtml), true)
  assert.deepEqual(marutiSuzuki.extractApplyUrls(currentCareersHubHtml), [
    'https://maruti.app.param.ai/jobs/',
  ])
})

test('Maruti Suzuki scraper returns no jobs while the official public careers page remains apply-only', async () => {
  const marutiSuzuki = await loadMarutiSuzukiModule()
  const requestedUrls = []

  const jobs = await marutiSuzuki.createMarutiSuzukiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === marutiSuzuki.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [marutiSuzuki.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Maruti Suzuki scraper returns no jobs while the current careers hub remains a generic apply-only handoff', async () => {
  const marutiSuzuki = await loadMarutiSuzukiModule()
  const requestedUrls = []

  const jobs = await marutiSuzuki.createMarutiSuzukiScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === marutiSuzuki.CAREERS_URL) return currentCareersHubHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [marutiSuzuki.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Maruti Suzuki scraper fails closed when the verified public surface changes or starts exposing live openings', async () => {
  const marutiSuzuki = await loadMarutiSuzukiModule()

  await assert.rejects(
    marutiSuzuki.createMarutiSuzukiScraper().run({
      fetchText: async () => '<main><h1>Maruti Careers</h1></main>',
    }),
    /verified official public careers surface/i,
  )

  await assert.rejects(
    marutiSuzuki.createMarutiSuzukiScraper().run({
      fetchText: async () => `
        ${officialCareersHtml}
        <section>
          <h2>Current Openings</h2>
          <a href="https://maruti.app.param.ai/jobs/senior-engineer-2026">Senior Engineer</a>
        </section>
      `,
    }),
    /public careers surface now exposes live openings/i,
  )
})
