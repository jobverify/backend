import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Partex.AI | Join the Future of AI Pharma</title>
  </head>
  <body>
    <main>
      <h1>Join the Journey at Partex.AI</h1>
      <a href="#open-positions">View Openings</a>
      <a href="https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55">Talent pool</a>
      <script>
        window.__OPENINGS__ = {
          "initialJobs": [
            {
              "id": 8,
              "title": "Data Manager - Life Sciences",
              "location": "Germany (Onsite Role)",
              "shortDescription": "Germany role.",
              "applyUrl": "https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55"
            },
            {
              "id": 4,
              "title": "AVP/VP/Sr. VP. - Business Development",
              "location": "Pune (Onsite)",
              "shortDescription": "Lead commercial expansion across US and European markets.",
              "applyUrl": "https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55"
            },
            {
              "id": 6,
              "title": "Associate Scientific Manager - Life Sciences",
              "location": "Pune, India (Onsite Role)",
              "shortDescription": "Bring strong biological and mechanistic insights into AI-driven discovery programs.",
              "applyUrl": "https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55"
            },
            {
              "id": 25,
              "title": "AI Engineer",
              "location": "Delhi, Pune, India (Onsite Role)",
              "shortDescription": "Build, deploy, and scale AI-driven product features.",
              "applyUrl": "https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55"
            },
            {
              "id": 30,
              "title": "Account Manager",
              "location": "Pune",
              "shortDescription": "Manage enterprise client relationships and AI-led delivery outcomes.",
              "applyUrl": "https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55"
            }
          ]
        }
      </script>
    </main>
  </body>
</html>
`

const escapedCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Partex.AI | Join the Future of AI Pharma</title>
  </head>
  <body>
    <main>
      <h1>Join the Journey at Partex.AI</h1>
      <a href="#open-positions">View Openings</a>
      <a href="https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55">Talent pool</a>
      <script>
        self.__next_f.push([1,"$L1f",null,{\\"initialJobs\\":[{\\"id\\":4,\\"title\\":\\"AVP/VP/Sr. VP. - Business Development\\",\\"location\\":\\"Pune (Onsite)\\",\\"shortDescription\\":\\"Lead commercial expansion across US and European markets.\\",\\"applyUrl\\":\\"https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55\\"},{\\"id\\":25,\\"title\\":\\"AI Engineer\\",\\"location\\":\\"Delhi, Pune, India (Onsite Role)\\",\\"shortDescription\\":\\"Build, deploy, and scale AI-driven product features.\\",\\"applyUrl\\":\\"https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55\\"}] }])
      </script>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/innoplexus/script.js')
  } catch {
    assert.fail('Expected Innoplexus scraper module at ../../scraper/innoplexus/script.js')
  }
}

test('Innoplexus helpers stay pinned to the verified redirect careers page and embedded openings array', async () => {
  const innoplexus = await loadModule()

  assert.equal(innoplexus.SOURCE, 'innoplexus')
  assert.equal(innoplexus.COMPANY, 'Innoplexus')
  assert.equal(innoplexus.CAREERS_URL, 'https://www.innoplexus.com/careers')
  assert.equal(innoplexus.REDIRECTED_CAREERS_PAGE_URL, 'https://partex.ai/en/careers')
  assert.equal(innoplexus.VERIFIED_ON, '2026-07-17')
  assert.equal(innoplexus.hasVerifiedCareersSignal(careersHtml), true)

  const jobs = innoplexus.extractIndiaJobsFromHtml(careersHtml)
  assert.equal(jobs.length, 4)
  assert.deepEqual(jobs[0], {
    title: 'AVP/VP/Sr. VP. - Business Development',
    company: 'Innoplexus',
    department: null,
    location: 'Pune, India',
    city: 'Pune',
    country: 'India',
    jobId: '4',
    requisitionId: '4',
    sourceUrl: 'https://partex.ai/en/careers#job-4',
    applyUrl: 'https://partex.zohorecruit.in/forms/a8246d12a6edcdc0c07688faef96118fef29cd68ad9ccd670493d066c7a36f55',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Lead commercial expansion across US and European markets.',
    remoteStatus: 'On-site',
  })

  const escapedJobs = innoplexus.extractIndiaJobsFromHtml(escapedCareersHtml)
  assert.equal(escapedJobs.length, 2)
  assert.equal(escapedJobs[0].jobId, '4')
  assert.equal(escapedJobs[1].jobId, '25')
})

test('Innoplexus validates the careers redirect page and returns India openings from the embedded array', async () => {
  const innoplexus = await loadModule()
  const requestedUrls = []

  const jobs = await innoplexus.createInnoplexusScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
    now: () => '2026-07-17T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [innoplexus.CAREERS_URL])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'innoplexus')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-17T12:00:00.000Z')
})

test('Innoplexus fails closed when the verified careers signal or embedded openings array drifts', async () => {
  const innoplexus = await loadModule()

  await assert.rejects(
    innoplexus.createInnoplexusScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified Innoplexus careers page/i,
  )

  await assert.rejects(
    innoplexus.createInnoplexusScraper().run({
      fetchText: async () => careersHtml.replace('"initialJobs"', '"openRoles"'),
    }),
    /embedded openings array/i,
  )
})
