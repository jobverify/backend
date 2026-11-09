import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'lektik',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = readFixture('homepage.html')
const careersHtml = readFixture('careers.html')
const careersApiPayload = JSON.parse(readFixture('careers-api.json'))
const fullStackDetailPayload = JSON.parse(readFixture('detail-full-stack.json'))
const seniorBackendDetailPayload = JSON.parse(readFixture('detail-senior-backend.json'))

const loadLektikModule = async () => {
  try {
    return await import('../../scraper/lektik/script.js')
  } catch {
    assert.fail('Expected Lektik scraper module at ../../scraper/lektik/script.js')
  }
}

test('Lektik scraper keeps the verified homepage, careers shell, and first-party GraphQL contracts pinned', async () => {
  const lektik = await loadLektikModule()

  assert.equal(lektik.SOURCE, 'lektik')
  assert.equal(lektik.COMPANY, 'Lektik')
  assert.equal(lektik.HOMEPAGE_URL, 'https://www.lektik.com/')
  assert.equal(lektik.CAREERS_URL, 'https://www.lektik.com/careers')
  assert.equal(
    lektik.CAREERS_API_URL,
    'https://lektik-backend.lektikprojects.com/api/graphql',
  )
  assert.equal(lektik.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(lektik.hasOfficialCareersSignal(careersHtml), true)

  const jobs = lektik.extractPublicJobs(
    careersApiPayload,
    new Map([
      ['full-stack-developer', fullStackDetailPayload],
      ['senior-backend-developer', seniorBackendDetailPayload],
    ]),
  )

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Full Stack Developer',
    company: 'Lektik',
    department: null,
    location: 'Kochi, Kerala, India',
    city: 'Kochi',
    country: 'India',
    jobId: 'cmf3wpkm4001h7015321ocbem',
    requisitionId: 'cmf3wpkm4001h7015321ocbem',
    sourceUrl: 'https://www.lektik.com/career/full-stack-developer',
    applyUrl: 'https://www.lektik.com/career/full-stack-developer',
    employmentType: 'Full-time',
    experienceRequired: 'Mid Level (3-5 years)',
    minimumQualification: 'Bachelor’s degree in Computer Science, Engineering, or related field (or equivalent experience).',
    preferredQualification: 'Frontend: Proficiency in React.js, Next.js, or similar frameworks; strong understanding of JavaScript, HTML5, CSS3. Backend: Hands-on experience with Node.js, Python, or Java frameworks such as Spring Boot, Django, or Flask. Cloud Platforms: Experience in AWS, Azure, or GCP with exposure to serverless or container-based deployments. API Development: Strong understanding of RESTful and GraphQL API design. Databases: Solid experience with SQL and NoSQL databases. DevOps: Working knowledge of CI/CD, Git, and build automation tools. Containerization: Experience deploying and managing applications using Docker and Kubernetes.',
    requiredSkills: [],
    postingDate: '2025-11-10T11:41:24.507Z',
    closingDate: null,
    jobDescription: 'We are seeking an experienced Full Stack Developer with expertise in Python and Node.js to join our team. The ideal candidate will build scalable applications, develop APIs, and deliver high-quality solutions across front-end and back-end systems. Nice to have: Strong communication and collaboration skills across teams. Ability to manage multiple priorities and deliver high-quality outcomes. Keen eye for detail with a problem-solving and ownership-driven attitude. Adaptability to new tools, frameworks, and project demands.',
  })
  assert.equal(jobs[1].title, 'Senior Backend Developer')
  assert.equal(jobs[1].location, 'Kochi, Kerala, India')
  assert.equal(jobs[1].employmentType, 'Full-time')
  assert.equal(jobs[1].experienceRequired, 'Mid Level (3-5 years)')
})

test('Lektik scraper returns normalized India jobs from the verified first-party GraphQL API', async () => {
  const lektik = await loadLektikModule()
  const fetchTextCalls = []
  const fetchJsonCalls = []

  const jobs = await lektik.createLektikScraper({
    now: () => '2026-07-11T20:30:00.000Z',
  }).run({
    fetchText: async (url) => {
      fetchTextCalls.push(url)

      if (url === lektik.HOMEPAGE_URL) return homepageHtml
      if (url === lektik.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected text URL: ${url}`)
    },
    fetchJson: async (url, options = {}) => {
      fetchJsonCalls.push({ url, options })
      const body = JSON.parse(options.body)

      if (body.query.includes('query GetCareers')) {
        return careersApiPayload
      }

      if (body.variables?.slug === 'full-stack-developer') {
        return fullStackDetailPayload
      }

      if (body.variables?.slug === 'senior-backend-developer') {
        return seniorBackendDetailPayload
      }

      throw new Error(`Unexpected JSON request: ${url} ${options.body}`)
    },
  })

  assert.deepEqual(fetchTextCalls, [lektik.HOMEPAGE_URL, lektik.CAREERS_URL])
  assert.equal(fetchJsonCalls.length, 3)
  assert.equal(fetchJsonCalls[0].url, lektik.CAREERS_API_URL)
  assert.equal(fetchJsonCalls[0].options.method, 'POST')
  assert.equal(fetchJsonCalls[0].options.headers['Content-Type'], 'application/json')
  assert.deepEqual(JSON.parse(fetchJsonCalls[0].options.body), lektik.LIST_CAREERS_REQUEST_BODY)
  assert.equal(JSON.parse(fetchJsonCalls[1].options.body).variables.slug, 'full-stack-developer')
  assert.equal(JSON.parse(fetchJsonCalls[2].options.body).variables.slug, 'senior-backend-developer')

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'lektik')
  assert.equal(jobs[0].companyCareerPage, 'https://www.lektik.com/careers')
  assert.equal(jobs[0].companyDomain, 'lektik.com')
  assert.equal(jobs[0].atsPlatform, 'official-first-party-graphql-api')
  assert.equal(jobs[0].scrapedAt, '2026-07-11T20:30:00.000Z')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.ok(jobs.every((job) => job.country === 'India'))
  assert.ok(jobs.every((job) => job.location === 'Kochi, Kerala, India'))
})

test('Lektik scraper fails closed when the verified homepage, careers shell, or GraphQL payload drifts', async () => {
  const lektik = await loadLektikModule()

  await assert.rejects(
    lektik.createLektikScraper().run({
      fetchText: async (url) => {
        if (url === lektik.HOMEPAGE_URL) return '<html><body><h1>Unexpected homepage</h1></body></html>'
        return careersHtml
      },
      fetchJson: async () => careersApiPayload,
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    lektik.createLektikScraper().run({
      fetchText: async (url) => {
        if (url === lektik.HOMEPAGE_URL) return homepageHtml
        return careersHtml.replace(
          'Explore Exciting Career Opportunities',
          'Explore Career Paths',
        )
      },
      fetchJson: async () => careersApiPayload,
    }),
    /verified first-party careers shell/i,
  )

  await assert.rejects(
    lektik.createLektikScraper().run({
      fetchText: async (url) => {
        if (url === lektik.HOMEPAGE_URL) return homepageHtml
        if (url === lektik.CAREERS_URL) return careersHtml
        throw new Error(`Unexpected text URL: ${url}`)
      },
      fetchJson: async (url, options = {}) => {
        const body = JSON.parse(options.body)
        if (body.query.includes('query GetCareers')) {
          return {
            data: {
              careers: [
                {
                  ...careersApiPayload.data.careers[0],
                  slug: null,
                },
              ],
            },
          }
        }

        return fullStackDetailPayload
      },
    }),
    /public careers api no longer matches/i,
  )
})
