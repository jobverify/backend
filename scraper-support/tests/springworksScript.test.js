import assert from 'node:assert/strict'
import test from 'node:test'

const aboutHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>About Us | Springworks</title>
  </head>
  <body>
    <a href="https://springworks.goodfit.so/careers/springworks">Join our team</a>
    <footer><a href="https://springworks.goodfit.so/careers/springworks">Work with Us</a></footer>
  </body>
</html>
`

const handoffHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Springworks at Springworks</title>
    <meta name="robots" content="noindex" />
  </head>
  <body>
    <main>Goodfit handoff shell</main>
  </body>
</html>
`

const jobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>goodfit</title>
    <link rel="canonical" href="https://jobs.goodfit.so/jobs/springworks" />
    <meta property="og:title" content="Jobs at Springworks | Goodfit" />
  </head>
  <body>
    <h2>Open Positions <span>5</span></h2>
    <section>
      <a class="group" href="/jobs/springworks/Software-Development-Engineer-in-Test-Intern?id=019f89eb-6a85-749d-a595-5c80eaa876fd">
        <div>
          <span class="font-medium text-base">Software Development Engineer in Test Intern</span>
          <div><span class="text-xs">Remote</span></div>
        </div>
      </a>
      <a class="group" href="/jobs/springworks/Sales-SDR-Intern?id=51214997-9646-4249-84b9-d98f4b21fa3e">
        <div>
          <span class="font-medium text-base">Sales/ SDR Intern</span>
          <div><span class="text-xs">Remote</span></div>
        </div>
      </a>
      <a class="group" href="/jobs/springworks/Account-Executive-SpringVerify?id=f7554ef1-ec87-4f4e-b573-e7d2627151d1">
        <div>
          <span class="font-medium text-base">Account Executive- SpringVerify</span>
          <div><span class="text-xs">Remote</span></div>
        </div>
      </a>
      <a class="group" href="/jobs/springworks/Sales-Development-Representative-SpringVerify?id=57ab0782-26e2-4094-a38d-4b5e7641677c">
        <div>
          <span class="font-medium text-base">Sales Development Representative- SpringVerify</span>
          <div><span class="text-xs">Remote</span></div>
        </div>
      </a>
      <a class="group" href="/jobs/springworks/Customer-Success-Associate?id=4ab07500-6a67-4096-96d0-2eac8bdff306">
        <div>
          <span class="font-medium text-base">Customer Success Associate</span>
          <div><span class="text-xs">Remote</span></div>
        </div>
      </a>
    </section>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/springworks/script.js')
  } catch {
    assert.fail('Expected Springworks scraper module at ../../scraper/springworks/script.js')
  }
}

test('Springworks scraper parses verified public role cards from the Goodfit jobs surface', async () => {
  const springworks = await loadScriptModule()

  assert.equal(springworks.SOURCE, 'springworks')
  assert.equal(springworks.COMPANY, 'Springworks')
  assert.equal(springworks.VERIFIED_ON, '2026-08-04')
  assert.equal(springworks.ABOUT_URL, 'https://www.springworks.in/about-us/')
  assert.equal(springworks.HANDOFF_URL, 'https://springworks.goodfit.so/careers/springworks')
  assert.equal(springworks.JOBS_URL, 'https://jobs.goodfit.so/jobs/springworks')
  assert.equal(springworks.hasFirstPartyAboutSignal(aboutHtml), true)
  assert.equal(springworks.hasGoodfitHandoffSignal(handoffHtml), true)
  assert.equal(springworks.hasGoodfitJobsSignal(jobsHtml), true)

  const extractedJobs = springworks.extractSpringworksJobs(jobsHtml)
  assert.equal(extractedJobs.length, 5)

  const jobs = await springworks.createSpringworksScraper().run({
    fetchPage: async (url) => {
      if (url === springworks.ABOUT_URL) return { status: 200, url, html: aboutHtml }
      if (url === springworks.HANDOFF_URL) return { status: 200, url: 'https://jobs.goodfit.so/careers/springworks', html: handoffHtml }
      if (url === springworks.JOBS_URL) return { status: 200, url, html: jobsHtml }
      throw new Error(`Unexpected Springworks URL: ${url}`)
    },
    now: () => '2026-08-04T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.applyUrl]),
    [
      ['Software Development Engineer in Test Intern', 'Remote', 'https://jobs.goodfit.so/jobs/springworks/Software-Development-Engineer-in-Test-Intern?id=019f89eb-6a85-749d-a595-5c80eaa876fd'],
      ['Sales/ SDR Intern', 'Remote', 'https://jobs.goodfit.so/jobs/springworks/Sales-SDR-Intern?id=51214997-9646-4249-84b9-d98f4b21fa3e'],
      ['Account Executive- SpringVerify', 'Remote', 'https://jobs.goodfit.so/jobs/springworks/Account-Executive-SpringVerify?id=f7554ef1-ec87-4f4e-b573-e7d2627151d1'],
      ['Sales Development Representative- SpringVerify', 'Remote', 'https://jobs.goodfit.so/jobs/springworks/Sales-Development-Representative-SpringVerify?id=57ab0782-26e2-4094-a38d-4b5e7641677c'],
      ['Customer Success Associate', 'Remote', 'https://jobs.goodfit.so/jobs/springworks/Customer-Success-Associate?id=4ab07500-6a67-4096-96d0-2eac8bdff306'],
    ],
  )
})

test('Springworks scraper fails closed when the about, handoff, or jobs surfaces drift', async () => {
  const springworks = await loadScriptModule()

  await assert.rejects(
    springworks.createSpringworksScraper().run({
      fetchPage: async (url) => {
        if (url === springworks.ABOUT_URL) return { status: 200, url, html: '<title>Unexpected</title>' }
        throw new Error(`Unexpected Springworks URL: ${url}`)
      },
    }),
    /trusted careers handoff surface/i,
  )

  await assert.rejects(
    springworks.createSpringworksScraper().run({
      fetchPage: async (url) => {
        if (url === springworks.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === springworks.HANDOFF_URL) return { status: 200, url: 'https://jobs.goodfit.so/careers/springworks', html: '<title>Unexpected</title>' }
        throw new Error(`Unexpected Springworks URL: ${url}`)
      },
    }),
    /trusted goodfit handoff surface/i,
  )

  await assert.rejects(
    springworks.createSpringworksScraper().run({
      fetchPage: async (url) => {
        if (url === springworks.ABOUT_URL) return { status: 200, url, html: aboutHtml }
        if (url === springworks.HANDOFF_URL) return { status: 200, url: 'https://jobs.goodfit.so/careers/springworks', html: handoffHtml }
        if (url === springworks.JOBS_URL) return { status: 200, url, html: '<title>Jobs at Springworks | Goodfit</title>' }
        throw new Error(`Unexpected Springworks URL: ${url}`)
      },
    }),
    /verified SSR jobs surface/i,
  )
})


test('Springworks accepts the current direct jobs handoff and rejects partial counts', async () => {
  const s = await loadScriptModule()
  const fetchPage = async (url) => url === s.ABOUT_URL
    ? { status: 200, url, html: aboutHtml }
    : { status: 200, url: s.JOBS_URL, html: jobsHtml }
  assert.equal((await s.run({ fetchPage })).length, 5)
  await assert.rejects(s.run({ fetchPage: async (url) => {
    const page = await fetchPage(url)
    return url === s.ABOUT_URL ? page : { ...page, html: page.html.replace('<span>5</span>', '<span>6</span>') }
  } }), /incomplete|count/i)
})
