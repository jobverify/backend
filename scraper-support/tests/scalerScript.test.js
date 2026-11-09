import assert from 'node:assert/strict'
import test from 'node:test'

const loadScalerModule = async () => {
  try {
    return await import('../../scraper/scaler/script.js')
  } catch {
    assert.fail('Expected Scaler scraper module at ../../scraper/scaler/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Scaler</title>
  </head>
  <body>
    <main>
      <h1>Transform the tech world with Scaler.</h1>
      <h2>Job Openings</h2>
      <div class="opening__blocks__container">
        <div class="opening__blocks row">
          <div class="opening__blocks__one">
            <a href="/careers/entrepreneur-in-residence-eir-gtm" target="_blank">
              <p class="opening__blocks__desc">Posted 5 months ago</p>
              <div class="opening__blocks__top">
                <h3 class="opening__blocks__heading">Entrepreneur in Residence(EIR) - GTM</h3>
              </div>
              <div class="opening__blocks__bottom">
                <p class="opening__blocks__desc">Marketing - Bengaluru - Full time</p>
              </div>
            </a>
          </div>
          <div class="opening__blocks__one">
            <a href="https://www.scaler.com/careers/remote-instructor-python" target="_blank">
              <p class="opening__blocks__desc">Posted almost 2 years ago</p>
              <div class="opening__blocks__top">
                <h3 class="opening__blocks__heading">Remote Instructor- Python</h3>
              </div>
              <div class="opening__blocks__bottom">
                <p class="opening__blocks__desc">Instructors - Bengaluru - Free lancer</p>
              </div>
            </a>
          </div>
        </div>
      </div>
      <a href="/careers/">Careers</a>
      <a href="https://www.scaler.com/about/">About Scaler</a>
    </main>
  </body>
</html>
`

const entrepreneurDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Entrepreneur in Residence(EIR) - GTM</h1>
      <h2>Marketing</h2>
      <a href="https://interviewbit.typeform.com/to/eir-gtm">Apply Now</a>
      <p>Job Title: Entrepreneur in Residence(EIR) - GTM</p>
      <p>Location: Electronic City, Bangalore (WFO) | Reporting to: Lead, GTM Strategy | IC Role</p>
      <section>
        <h3>What You Will Do</h3>
        <ul>
          <li>Own admissions and GTM experiments.</li>
          <li>Turn candidate conversations into product insight.</li>
        </ul>
      </section>
      <div>
        <h3>Job Overview</h3>
        <ul>
          <li>Location: Bengaluru</li>
          <li>Job Type: Full time</li>
          <li>Work: Office</li>
        </ul>
      </div>
    </main>
  </body>
</html>
`

const remoteInstructorDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Remote Instructor- Python</h1>
      <h2>Instructors</h2>
      <a href="https://interviewbit.typeform.com/to/python">Apply Now</a>
      <p>Job Title: Remote Instructor- Python</p>
      <p>Location: Bengaluru</p>
      <section>
        <h3>What You Will Do</h3>
        <p>Teach live Python classes and mentor learners remotely.</p>
      </section>
      <div>
        <h3>Job Overview</h3>
        <ul>
          <li>Location: Bengaluru</li>
          <li>Job Type: Free lancer</li>
          <li>Work: Remote</li>
        </ul>
      </div>
    </main>
  </body>
</html>
`

test('hasOfficialCareersSignal validates the verified Scaler careers surface', async () => {
  const scaler = await loadScalerModule()

  assert.equal(scaler.hasOfficialCareersSignal(careersPageHtml), true)
})

test('extractListings keeps only same-domain Scaler job detail links from the official careers page', async () => {
  const scaler = await loadScalerModule()

  assert.deepEqual(scaler.extractListings(careersPageHtml), [
    {
      title: 'Entrepreneur in Residence(EIR) - GTM',
      company: 'Scaler',
      jobId: 'entrepreneur-in-residence-eir-gtm',
      requisitionId: 'entrepreneur-in-residence-eir-gtm',
      sourceUrl: 'https://www.scaler.com/careers/entrepreneur-in-residence-eir-gtm',
      applyUrl: 'https://www.scaler.com/careers/entrepreneur-in-residence-eir-gtm',
    },
    {
      title: 'Remote Instructor- Python',
      company: 'Scaler',
      jobId: 'remote-instructor-python',
      requisitionId: 'remote-instructor-python',
      sourceUrl: 'https://www.scaler.com/careers/remote-instructor-python',
      applyUrl: 'https://www.scaler.com/careers/remote-instructor-python',
    },
  ])
})

test('extractJobDetail maps Scaler detail-page metadata and keeps the public apply URL', async () => {
  const scaler = await loadScalerModule()
  const sourceUrl = 'https://www.scaler.com/careers/entrepreneur-in-residence-eir-gtm'

  assert.deepEqual(scaler.extractJobDetail(entrepreneurDetailHtml, {
    title: 'Entrepreneur in Residence(EIR) - GTM',
    jobId: 'entrepreneur-in-residence-eir-gtm',
    requisitionId: 'entrepreneur-in-residence-eir-gtm',
    sourceUrl,
    applyUrl: sourceUrl,
  }), {
    title: 'Entrepreneur in Residence(EIR) - GTM',
    company: 'Scaler',
    department: 'Marketing',
    location: 'Electronic City, Bangalore (WFO)',
    city: 'Bangalore',
    country: 'India',
    jobId: 'entrepreneur-in-residence-eir-gtm',
    requisitionId: 'entrepreneur-in-residence-eir-gtm',
    sourceUrl,
    applyUrl: 'https://interviewbit.typeform.com/to/eir-gtm',
    employmentType: 'Full time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'What You Will Do Own admissions and GTM experiments. Turn candidate conversations into product insight.',
    remoteStatus: 'On-site',
  })
})

test('run fetches the Scaler careers page, follows same-domain detail links, and decorates final jobs', async () => {
  const scaler = await loadScalerModule()
  const requestedUrls = []

  const jobs = await scaler.createScalerScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === scaler.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.scaler.com/careers/entrepreneur-in-residence-eir-gtm') {
        return entrepreneurDetailHtml
      }
      if (url === 'https://www.scaler.com/careers/remote-instructor-python') {
        return remoteInstructorDetailHtml
      }

      throw new Error(`Unexpected Scaler fixture URL: ${url}`)
    },
    now: () => '2026-07-10T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    scaler.CAREERS_URL,
    'https://www.scaler.com/careers/entrepreneur-in-residence-eir-gtm',
    'https://www.scaler.com/careers/remote-instructor-python',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'scaler')
  assert.equal(jobs[0].company, 'Scaler')
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].applyUrl, 'https://interviewbit.typeform.com/to/eir-gtm')
  assert.equal(jobs[0].scrapedAt, '2026-07-10T00:00:00.000Z')
  assert.equal(jobs[1].remoteStatus, 'Remote')
  assert.equal(jobs[1].employmentType, 'Free lancer')
})

test('run fails closed when the verified Scaler careers signal disappears', async () => {
  const scaler = await loadScalerModule()

  await assert.rejects(
    scaler.createScalerScraper().run({
      fetchText: async () => '<html><body>No verified Scaler job openings here</body></html>',
    }),
    /verified Scaler careers surface/i,
  )
})
