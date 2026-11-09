import assert from 'node:assert/strict'
import test from 'node:test'

const loadSayOneModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const careersPageHtml = String.raw`<!DOCTYPE html>
<html>
  <head>
    <title>Careers | Jobs in Kochi | SayOne</title>
    <script src="/_next/static/chunks/placeholder.js"></script>
    <script src="/_next/static/chunks/public-data.js"></script>
  </head>
  <body>
    <h1>Find the Right Place</h1>
    <section>Our Culture</section>
    <h2>Are You Ready to be an Integral Part of SayOne?</h2>
    <p>Career Email: careers@sayonetech.com</p>
  </body>
</html>`

const publicDataChunkJs = String.raw`
  "use strict";
  (self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[2889],{
    12889:(e,t,a)=>{
      a.d(t,{S$:()=>h});
      let l=(0,a(83845).GO)({
        baseURL:"https://strapi.sayonetech.com/api",
        auth:"test-public-token"
      }),
      h=async()=>[];
    }
  }]);
`

const jobsPayload = {
  data: [
    {
      id: 17,
      documentId: 'rgxuymsiglunmo2966nba0fy',
      title: 'Java Spring Boot Developer',
      slug: 'java-spring-boot-developer-job-opening',
      experience: '3-5',
      description: 'We are looking for a skilled and motivated Software Developer with 3+ years of hands-on experience.',
      location: 'Infopark, Kochi',
      job_type: 'Full-time',
      job_status: 'Open',
      responsibilities: [
        '- Design, develop, and maintain Java Spring Boot microservices',
        '- Collaborate with cross-functional teams',
      ].join('\n'),
      requirements: [
        '- 3-5 years of professional experience',
        '- Strong proficiency in Java and Spring Boot',
        '**Soft Skills**',
        '- Good communication',
      ].join('\n'),
      createdAt: '2026-01-07T04:54:03.570Z',
      updatedAt: '2026-01-07T04:54:03.570Z',
      publishedAt: '2026-01-07T04:54:03.590Z',
    },
    {
      id: 15,
      documentId: 'r0u96lngxeaw0m84lip9gpwd',
      title: 'Fullstack Developer',
      slug: 'fullstack-developer',
      experience: '2-3',
      description: 'We are looking for a skilled and motivated Fullstack Developer with 2+ years of experience.',
      location: 'Infopark, Kochi',
      job_type: 'Full-time',
      job_status: 'Open',
      responsibilities: '- Build scalable APIs and services',
      requirements: [
        '- 2+ years of hands-on experience in backend and frontend development',
        '- Proficiency in backend frameworks: Django, Flask, or FastAPI',
      ].join('\n'),
      createdAt: '2025-11-12T12:08:02.861Z',
      updatedAt: '2025-11-12T12:08:02.861Z',
      publishedAt: '2025-11-12T12:08:02.879Z',
    },
  ],
}

test('SayOne Technologies validates the verified first-party careers surface and zero-vacancy signal', async () => {
  const sayOne = await loadSayOneModule()
  assert.ok(sayOne, 'Expected SayOne Technologies scraper module at ./script.js')

  const pageData = {
    url: sayOne.CAREERS_PAGE_URL,
    title: 'Careers | Jobs in Kochi | SayOne',
    text: [
      'Find the Right Place',
      'Our Culture',
      'Are You Ready to be an Integral Part of SayOne?',
      'Career Email: careers@sayonetech.com',
    ].join('\n'),
  }

  assert.equal(sayOne.SOURCE, 'sayonetechnologies')
  assert.equal(sayOne.COMPANY, 'SayOne Technologies')
  assert.equal(sayOne.CAREERS_PAGE_URL, 'https://www.sayonetech.com/career/')
  assert.equal(sayOne.hasOfficialCareersSignal(pageData), true)
  assert.equal(
    sayOne.hasExplicitNoVacanciesSignal('No vacancies available. Please check back later for new opportunities.'),
    true,
  )
})

test('SayOne Technologies extracts live Strapi config from the public chunk and normalizes jobs', async () => {
  const sayOne = await loadSayOneModule()
  assert.ok(sayOne, 'Expected SayOne Technologies scraper module at ./script.js')

  assert.deepEqual(
    sayOne.extractStrapiConfig(publicDataChunkJs),
    {
      baseUrl: 'https://strapi.sayonetech.com/api',
      authToken: 'test-public-token',
    },
  )

  assert.deepEqual(
    sayOne.buildJobFromPosting(jobsPayload.data[0]),
    {
      title: 'Java Spring Boot Developer',
      company: 'SayOne Technologies',
      department: null,
      location: 'Infopark, Kochi',
      city: 'Kochi',
      country: 'India',
      jobId: 'java-spring-boot-developer-job-opening',
      requisitionId: 'java-spring-boot-developer-job-opening',
      sourceUrl: 'https://www.sayonetech.com/career/',
      applyUrl: 'mailto:careers@sayonetech.com',
      employmentType: 'Full-time',
      experienceRequired: '3-5',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [
        '3-5 years of professional experience',
        'Strong proficiency in Java and Spring Boot',
        'Good communication',
      ],
      postingDate: '2026-01-07T04:54:03.590Z',
      closingDate: null,
      jobDescription: [
        'Description: We are looking for a skilled and motivated Software Developer with 3+ years of hands-on experience.',
        'Responsibilities:\n- Design, develop, and maintain Java Spring Boot microservices\n- Collaborate with cross-functional teams',
        'Requirements:\n- 3-5 years of professional experience\n- Strong proficiency in Java and Spring Boot\n- Soft Skills\n- Good communication',
      ].join('\n\n'),
      remoteStatus: 'On-site',
    },
  )
})

test('SayOne Technologies runs through the verified API-only careers surface', async () => {
  const sayOne = await loadSayOneModule()
  assert.ok(sayOne, 'Expected SayOne Technologies scraper module at ./script.js')

  const requestedTextUrls = []
  const requestedJson = []

  const jobs = await sayOne.createSayonetechnologiesScraper({
    maxJobs: 2,
    now: () => '2026-07-11T07:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)
      if (url === sayOne.CAREERS_PAGE_URL) return careersPageHtml
      if (url === 'https://www.sayonetech.com/_next/static/chunks/placeholder.js') return 'console.log("noop")'
      if (url === 'https://www.sayonetech.com/_next/static/chunks/public-data.js') return publicDataChunkJs
      throw new Error(`Unexpected fetchText URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      requestedJson.push({ url, options })
      return jobsPayload
    },
  })

  assert.deepEqual(
    requestedTextUrls,
    [
      sayOne.CAREERS_PAGE_URL,
      'https://www.sayonetech.com/_next/static/chunks/placeholder.js',
      'https://www.sayonetech.com/_next/static/chunks/public-data.js',
    ],
  )
  assert.equal(requestedJson.length, 1)
  assert.match(requestedJson[0].url, /job-postings/i)
  assert.equal(
    requestedJson[0].options.headers.Authorization,
    'Bearer test-public-token',
  )
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'sayonetechnologies')
  assert.equal(jobs[0].link, 'mailto:careers@sayonetech.com')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T07:00:00.000Z')
  assert.equal(jobs[1].city, 'Kochi')
})

test('SayOne Technologies returns no jobs when the verified public jobs API is empty', async () => {
  const sayOne = await loadSayOneModule()
  assert.ok(sayOne, 'Expected SayOne Technologies scraper module at ./script.js')

  const jobs = await sayOne.createSayonetechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === sayOne.CAREERS_PAGE_URL) return careersPageHtml
      if (url === 'https://www.sayonetech.com/_next/static/chunks/placeholder.js') return 'console.log("noop")'
      if (url === 'https://www.sayonetech.com/_next/static/chunks/public-data.js') return publicDataChunkJs
      throw new Error(`Unexpected fetchText URL: ${url}`)
    },
    fetchJson: async () => ({ data: [] }),
  })

  assert.deepEqual(jobs, [])
})

test('SayOne Technologies fails closed when the verified first-party careers contract changes', async () => {
  const sayOne = await loadSayOneModule()
  assert.ok(sayOne, 'Expected SayOne Technologies scraper module at ./script.js')

  await assert.rejects(
    sayOne.createSayonetechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === sayOne.CAREERS_PAGE_URL) {
          return '<html><head><title>Unexpected Careers Page</title></head><body>Open roles somewhere else</body></html>'
        }
        throw new Error(`Unexpected fetchText URL: ${url}`)
      },
    }),
    /verified official public surface/i,
  )
})
