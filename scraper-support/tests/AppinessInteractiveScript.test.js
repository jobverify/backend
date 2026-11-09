import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Appiness Interactive</title>
  </head>
  <body>
    <h1>Step into the Appiness World and Explore Our Wide Range of Exciting Careers!</h1>
    <section>
      <h2>Current Openings</h2>
      <article>
        <div>Role SEO Expert</div>
        <div>Experience 1-4 Years</div>
        <div>Location Bangalore</div>
      </article>
      <article>
        <div>Role Python Developer</div>
        <div>Experience 2-5 Years</div>
        <div>Location Bangalore</div>
      </article>
      <article>
        <div>Role Senior Software Engineer - Java</div>
        <div>Experience 6-9 Years</div>
        <div>Location Bangalore</div>
      </article>
      <article>
        <div>Role QA Engineer - Automation</div>
        <div>Experience 4-6 Years</div>
        <div>Location Bangalore</div>
      </article>
    </section>
  </body>
</html>
`

const liveLikeCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs at Appiness Interactive</title>
  </head>
  <body>
    <h2>Current Openings</h2>
    <div>Role SEO Expert</div>
    <div>Experience 1-4 Years</div>
    <div>Location Bangalore</div>
    <div>Job Details Apply</div>
    <div>Submit Application</div>
    <div>Role Python Developer</div>
    <div>Experience 2-5 Years</div>
    <div>Location Bangalore</div>
    <div>Job Details Apply</div>
    <div>Submit Application</div>
    <div>Role MERN Stack Developer</div>
    <div>Experience 3-6 Years</div>
    <div>Location Bangalore</div>
    <div>Job Details Apply</div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/appinessinteractive/script.js')
  } catch {
    assert.fail('Expected Appiness Interactive scraper module at ../../scraper/appinessinteractive/script.js')
  }
}

test('Appiness Interactive helpers stay pinned to the verified first-party careers roles from Saturday, August 1, 2026', async () => {
  const appiness = await loadModule()

  assert.equal(appiness.SOURCE, 'appinessinteractive')
  assert.equal(appiness.COMPANY, 'Appiness Interactive')
  assert.equal(appiness.CAREERS_URL, 'https://www.appinessworld.com/careers/job-details/')
  assert.equal(appiness.VERIFIED_ON, '2026-08-01')
  assert.equal(appiness.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(appiness.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.deepEqual(appiness.extractJobs(careersHtml), [
    {
      title: 'SEO Expert',
      company: 'Appiness Interactive',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'seo-expert',
      requisitionId: 'seo-expert',
      sourceUrl: 'https://www.appinessworld.com/careers/job-details/',
      applyUrl: 'https://www.appinessworld.com/careers/job-details/',
      employmentType: null,
      experienceRequired: '1-4 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Python Developer',
      company: 'Appiness Interactive',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'python-developer',
      requisitionId: 'python-developer',
      sourceUrl: 'https://www.appinessworld.com/careers/job-details/',
      applyUrl: 'https://www.appinessworld.com/careers/job-details/',
      employmentType: null,
      experienceRequired: '2-5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Senior Software Engineer - Java',
      company: 'Appiness Interactive',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'senior-software-engineer-java',
      requisitionId: 'senior-software-engineer-java',
      sourceUrl: 'https://www.appinessworld.com/careers/job-details/',
      applyUrl: 'https://www.appinessworld.com/careers/job-details/',
      employmentType: null,
      experienceRequired: '6-9 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'QA Engineer - Automation',
      company: 'Appiness Interactive',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'qa-engineer-automation',
      requisitionId: 'qa-engineer-automation',
      sourceUrl: 'https://www.appinessworld.com/careers/job-details/',
      applyUrl: 'https://www.appinessworld.com/careers/job-details/',
      employmentType: null,
      experienceRequired: '4-6 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
  ])
  assert.deepEqual(
    appiness.extractJobs(liveLikeCareersHtml).map((job) => [job.title, job.experienceRequired, job.location]),
    [
      ['SEO Expert', '1-4 Years', 'Bangalore, India'],
      ['Python Developer', '2-5 Years', 'Bangalore, India'],
      ['MERN Stack Developer', '3-6 Years', 'Bangalore, India'],
    ],
  )
})

test('Appiness Interactive run validates the verified careers page before decorating extracted jobs', async () => {
  const appiness = await loadModule()
  const requestedUrls = []
  const native = JSON.parse(readFileSync(new URL('./fixtures/appinessinteractive/native-4-20261024.json', import.meta.url)))

  const jobs = await appiness.createAppinessInteractiveScraper({ maxJobs: 2 }).run({
    requestIntervalMs: 0,
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === appiness.CAREERS_URL) return { status: 200, url, html: native.listingHtml }
      if (url === native.detailUrl) return { status: 200, url, html: native.detailHtml }
      throw new Error(`Unexpected Appiness Interactive URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [appiness.CAREERS_URL, native.detailUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'appinessinteractive')
  assert.equal(jobs[0].link, native.detailUrl)
  assert.match(jobs[0].sourceDescription, /Improve organic search results/)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('Appiness Interactive run fails closed when the verified careers surface drifts', async () => {
  const appiness = await loadModule()

  await assert.rejects(
    appiness.createAppinessInteractiveScraper().run({
      fetchPage: async url => ({ status: 200, url, html: '<html><body><h1>Unexpected</h1></body></html>' }),
    }),
    /Appiness native official listing employer identity changed/i,
  )
})
