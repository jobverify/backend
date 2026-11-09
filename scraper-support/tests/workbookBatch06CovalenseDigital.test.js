import assert from 'node:assert/strict'
import test from 'node:test'

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join Covalense Digital | Telecom and Tech Jobs | Careers</title>
  </head>
  <body>
    <main>
      <h1>Join Our Journey</h1>
      <p>Transform the future with us.</p>
      <h2>Life at Covalense Digital</h2>
      <h2>Continuous Learning and Development</h2>
      <h2>Current Openings</h2>
      <div class="space-y-6 max-w-7xl mx-auto"></div>
      <p>For Campus Placements: Contact us at <a href="mailto:careers@covalensedigital.com">careers@covalensedigital.com</a></p>
      <h3>Contact Us Form</h3>
      <div id="careers-contact"></div>
      <script src="/_next/static/chunks/492-test.js"></script>
      <script src="/_next/static/chunks/app/careers/page-test.js"></script>
    </main>
  </body>
</html>
`

const VERIFIED_CONFIG_CHUNK_JS = `
"use strict";
(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[492],{
  4997:(e,t,o)=>{
    o.d(t,{J:()=>s});
    let s="https://testingbe.covalensedigital.com"
  }
}]);
`

const VERIFIED_CAREERS_BUNDLE_JS = `
"use strict";
(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[3846],{
  158:(e,t,s)=>{
    let y=[];
    fetch("".concat(o.J,"/api/auth/getlistof-career"));
    y.map(e=>e.job_name);
    y.map(e=>e.job_description);
    y.map(e=>e.experience);
    y.map(e=>e.location);
    y.map(e=>e.education);
    "Current Openings";
    "Apply Now";
    "careers-contact";
  }
}]);
`

const VERIFIED_API_PAYLOAD = {
  latestCompanyDetail: [
    {
      _id: '6a50a6a76c4e708c78e1a82d',
      job_name: 'Software Architect',
      job_description:
        '<p>This role may require travel across the United States.</p>',
      experience: '2-5 years',
      location: 'Herndon, Virginia',
      education:
        "Master's in computer science, CIS, IT, Engineering, or an equivalent qualification.",
      order: 1,
      createdAt: '2026-07-10T08:00:39.457Z',
      updatedAt: '2026-07-10T09:06:03.079Z',
    },
    {
      _id: '697b05f18b6ec29d4c904a3d',
      job_name: 'GenAI & LLM Engineer',
      job_description:
        'We are seeking a specialist dedicated to designing, testing, and optimizing agentic AI solutions.',
      experience: '2-5 years',
      location: 'Bengaluru',
      education: 'Graduate/Postgraduate in Engineering or relevant',
      order: 2,
      createdAt: '2026-01-29T07:02:09.727Z',
      updatedAt: '2026-07-10T08:02:46.835Z',
    },
    {
      _id: '697b072a8b6ec29d4c904a6f',
      job_name: 'Oracle BRM Developer',
      job_description:
        '<p>Design, develop, and maintain Oracle BRM configurations and customisations.</p>',
      experience: '10+ Years',
      location: 'Bengaluru',
      education: 'Graduate/Postgraduate in Engineering or relevant',
      order: 8,
      createdAt: '2026-01-29T07:07:22.306Z',
      updatedAt: '2026-07-10T08:02:46.835Z',
    },
  ],
  message: 'Successfully fetched career data',
}

const loadModule = async () => {
  try {
    return await import('../../scraper/covalensedigital/script.js')
  } catch {
    assert.fail(
      'Expected Covalense Digital scraper module at ../../scraper/covalensedigital/script.js',
    )
  }
}

test('Covalense Digital validates the verified first-party careers surface and public careers API contract', async () => {
  const covalense = await loadModule()

  assert.equal(covalense.SOURCE, 'covalensedigital')
  assert.equal(covalense.COMPANY, 'Covalense Digital')
  assert.equal(covalense.OFFICIAL_BRAND, 'Covalense Digital')
  assert.equal(covalense.VERIFIED_ON, '2026-07-25')
  assert.equal(covalense.CAREERS_URL, 'https://covalensedigital.com/careers')
  assert.equal(
    covalense.CAREERS_API_BASE_URL,
    'https://testingbe.covalensedigital.com',
  )
  assert.equal(
    covalense.CAREERS_API_URL,
    'https://testingbe.covalensedigital.com/api/auth/getlistof-career',
  )
  assert.equal(
    covalense.DISPOSITION,
    'verified-first-party-careers-page-plus-public-careers-api',
  )
  assert.match(covalense.VERIFIED_SURFACE_SUMMARY, /Saturday, July 25, 2026/)
  assert.match(
    covalense.VERIFIED_SURFACE_SUMMARY,
    /https:\/\/covalensedigital\.com\/careers/i,
  )
  assert.match(
    covalense.VERIFIED_SURFACE_SUMMARY,
    /https:\/\/testingbe\.covalensedigital\.com\/api\/auth\/getlistof-career/i,
  )
  assert.match(covalense.VERIFIED_SURFACE_SUMMARY, /GenAI & LLM Engineer/i)
  assert.match(covalense.VERIFIED_SURFACE_SUMMARY, /Oracle BRM Developer/i)
  assert.equal(covalense.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.deepEqual(covalense.extractScriptUrls(VERIFIED_CAREERS_HTML), [
    'https://covalensedigital.com/_next/static/chunks/492-test.js',
    'https://covalensedigital.com/_next/static/chunks/app/careers/page-test.js',
  ])
  assert.equal(
    covalense.extractVerifiedCareerApiBaseUrl([
      VERIFIED_CONFIG_CHUNK_JS,
      VERIFIED_CAREERS_BUNDLE_JS,
    ]),
    'https://testingbe.covalensedigital.com',
  )

  const jobs = covalense.extractSearchResults(VERIFIED_API_PAYLOAD)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'GenAI & LLM Engineer',
    company: 'Covalense Digital',
    department: null,
    location: 'Bengaluru',
    city: 'Bengaluru',
    country: 'India',
    jobId: '02',
    requisitionId: '697b05f18b6ec29d4c904a3d',
    sourceUrl: 'https://covalensedigital.com/careers',
    applyUrl: 'https://covalensedigital.com/careers#careers-contact',
    employmentType: null,
    experienceRequired: '2-5 years',
    minimumQualification: 'Graduate/Postgraduate in Engineering or relevant',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-01-29T07:02:09.727Z',
    closingDate: null,
    jobDescription:
      'We are seeking a specialist dedicated to designing, testing, and optimizing agentic AI solutions.',
    remoteStatus: null,
  })
})

test('Covalense Digital run validates the verified page-plus-bundle contract and returns India jobs only', async () => {
  const covalense = await loadModule()
  const requestedTexts = []
  const requestedJson = []

  const jobs = await covalense.createCovalenseDigitalScraper().run({
    fetchText: async (url) => {
      requestedTexts.push(url)

      if (url === covalense.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === 'https://covalensedigital.com/_next/static/chunks/492-test.js') {
        return VERIFIED_CONFIG_CHUNK_JS
      }
      if (url === 'https://covalensedigital.com/_next/static/chunks/app/careers/page-test.js') {
        return VERIFIED_CAREERS_BUNDLE_JS
      }

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedJson.push(url)

      if (url === covalense.CAREERS_API_URL) return VERIFIED_API_PAYLOAD

      throw new Error(`Unexpected JSON URL: ${url}`)
    },
    now: () => '2026-07-25T00:00:00.000Z',
  })

  assert.deepEqual(requestedTexts, [
    covalense.CAREERS_URL,
    'https://covalensedigital.com/_next/static/chunks/492-test.js',
    'https://covalensedigital.com/_next/static/chunks/app/careers/page-test.js',
  ])
  assert.deepEqual(requestedJson, [covalense.CAREERS_API_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'GenAI & LLM Engineer',
      'Oracle BRM Developer',
    ],
  )
  assert.equal(jobs[0].source, 'covalensedigital')
  assert.equal(jobs[0].link, 'https://covalensedigital.com/careers#careers-contact')
  assert.equal(jobs[0].scrapedAt, '2026-07-25T00:00:00.000Z')
})

test('Covalense Digital fails closed when the verified official careers surface changes materially', async () => {
  const covalense = await loadModule()

  await assert.rejects(
    covalense.createCovalenseDigitalScraper().run({
      fetchText: async () => `
        <html>
          <body>
            <main>
              <h1>Careers</h1>
              <p>Join us.</p>
            </main>
          </body>
        </html>
      `,
      fetchJson: async () => VERIFIED_API_PAYLOAD,
    }),
    /verified official careers surface/i,
  )
})

test('Covalense Digital fails closed when the client-side careers API contract or payload drifts', async () => {
  const covalense = await loadModule()

  await assert.rejects(
    covalense.createCovalenseDigitalScraper().run({
      fetchText: async (url) => {
        if (url === covalense.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === 'https://covalensedigital.com/_next/static/chunks/492-test.js') {
          return VERIFIED_CONFIG_CHUNK_JS.replace(
            'https://testingbe.covalensedigital.com',
            'https://example.com',
          )
        }
        if (url === 'https://covalensedigital.com/_next/static/chunks/app/careers/page-test.js') {
          return VERIFIED_CAREERS_BUNDLE_JS
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => VERIFIED_API_PAYLOAD,
    }),
    /client-side careers api contract/i,
  )

  await assert.rejects(
    covalense.createCovalenseDigitalScraper().run({
      fetchText: async (url) => {
        if (url === covalense.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === 'https://covalensedigital.com/_next/static/chunks/492-test.js') {
          return VERIFIED_CONFIG_CHUNK_JS
        }
        if (url === 'https://covalensedigital.com/_next/static/chunks/app/careers/page-test.js') {
          return VERIFIED_CAREERS_BUNDLE_JS.replace('/api/auth/getlistof-career', '/api/auth/other')
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => VERIFIED_API_PAYLOAD,
    }),
    /client-side careers api contract/i,
  )

  await assert.rejects(
    covalense.createCovalenseDigitalScraper().run({
      fetchText: async (url) => {
        if (url === covalense.CAREERS_URL) return VERIFIED_CAREERS_HTML
        if (url === 'https://covalensedigital.com/_next/static/chunks/492-test.js') {
          return VERIFIED_CONFIG_CHUNK_JS
        }
        if (url === 'https://covalensedigital.com/_next/static/chunks/app/careers/page-test.js') {
          return VERIFIED_CAREERS_BUNDLE_JS
        }

        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async () => ({ latestCompanyDetail: [{ job_name: 'Broken role' }] }),
    }),
    /public careers api payload/i,
  )
})
