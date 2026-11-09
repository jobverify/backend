import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadEpamModule = async () => {
  try {
    return await import('../../scraper/epam/script.js')
  } catch {
    assert.fail('Expected EPAM scraper module at ../../scraper/scraper/epam/script.js')
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'epam',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

test('buildSearchUrl keeps EPAM on the official India search endpoint', async () => {
  const { API_URL, COUNTRY_FACET_ID, PAGE_SIZE, buildSearchUrl } = await loadEpamModule()

  assert.equal(COUNTRY_FACET_ID, '4060741400035606931')
  assert.equal(PAGE_SIZE, 10)
  assert.equal(
    buildSearchUrl(),
    `${API_URL}?facets=country%3D4060741400035606931&from=0&lang=en&size=10&sortBy=relevance%3Brelocation%3Dasc&websiteLocale=en-us`,
  )
  assert.equal(
    buildSearchUrl(10),
    `${API_URL}?facets=country%3D4060741400035606931&from=10&lang=en&size=10&sortBy=relevance%3Brelocation%3Dasc&websiteLocale=en-us`,
  )
})

test('extractSearchResults maps EPAM India search jobs into the shared scraper fields', async () => {
  const { extractSearchResults } = await loadEpamModule()
  const payload = readJsonFixture('india-search-page-1.json')
  const jobs = extractSearchResults(payload)

  assert.equal(jobs.length, 10)
  assert.deepEqual(jobs[0], {
    title: 'Senior Business Analyst - Corporate Actions with Gen AI',
    company: 'EPAM',
    department: 'Business Analyst',
    location: 'Pune, India',
    city: 'Pune',
    jobId: 'blt02p4etwfqf6mgzoy',
    requisitionId: 'blt02p4etwfqf6mgzoy',
    sourceUrl: 'https://careers.epam.com/en/vacancy/senior-business-analyst-corporate-actions-with-gen-ai-blt02p4etwfqf6mgzoy_en',
    applyUrl: 'https://careers.epam.com/en/vacancy/senior-business-analyst-corporate-actions-with-gen-ai-blt02p4etwfqf6mgzoy_en',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'Business Analysis',
      'Agile',
      'Corporate Actions [Financial instruments]',
      'GenAI for Requirement Management',
    ],
    postingDate: '2026-06-18T04:29:52.574Z',
    closingDate: null,
    jobDescription: 'We are seeking a Senior Business Analyst - Corporate Actions with Gen AI to enhance Corporate Actions Operations by deploying AI agents.',
  })
  assert.equal(jobs[1].city, 'Hyderabad')
  assert.equal(jobs[3].department, 'Software Architect')
})

test('extractSearchResults derives experienceRequired from official EPAM search descriptions', async () => {
  const { extractSearchResults } = await loadEpamModule()
  const jobs = extractSearchResults({
    data: {
      jobs: [
        {
          name: 'Senior Technical Delivery Manager - Java/.NET',
          uid: 'delivery-manager-1',
          seo: {
            url: '/en/vacancy/senior-technical-delivery-manager-java-net-blt1e34ac3d19140099_en',
          },
          city: [{ name: 'Bengaluru' }],
          country: [{ name: 'India' }],
          text: 'Requirements 15 to 18 years of experience in the software industry. Background in Coding with 10-13 years of hands-on experience.',
        },
        {
          name: 'Software Engineer - Java Full Stack React',
          uid: 'fullstack-react-1',
          seo: {
            url: '/en/vacancy/software-engineer-java-full-stack-react-blt1jr66036aesrrgj1_en',
          },
          city: [{ name: 'Hyderabad' }],
          country: [{ name: 'India' }],
          text: 'Requirements 4-5.5 years of experience in full-stack development, with a strong focus on React and Java.',
        },
      ],
    },
  })

  assert.equal(jobs[0].experienceRequired, '15-18 years')
  assert.equal(jobs[1].experienceRequired, '4-5.5 years')
})

test('run paginates the EPAM India search feed and decorates shared runner fields', async () => {
  const {
    createEpamScraper,
    buildSearchUrl,
  } = await loadEpamModule()
  const pageOne = readJsonFixture('india-search-page-1.json')
  const pageTwo = readJsonFixture('india-search-page-2.json')
  const requestedUrls = []
  const scraper = createEpamScraper({ maxJobs: 11 })

  const jobs = await scraper.run({
    fetchJson: async (url) => {
      requestedUrls.push(url)
      if (url === buildSearchUrl(0)) return pageOne
      if (url === buildSearchUrl(10)) return pageTwo
      throw new Error(`Unexpected EPAM URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchUrl(0),
    buildSearchUrl(10),
  ])
  assert.equal(jobs.length, 11)
  assert.equal(jobs[0].source, 'epam')
  assert.equal(jobs[0].company, 'EPAM')
  assert.equal(jobs[0].link, 'https://careers.epam.com/en/vacancy/senior-business-analyst-corporate-actions-with-gen-ai-blt02p4etwfqf6mgzoy_en')
  assert.equal(jobs[10].title, 'Senior Business Analyst - AI')
  assert.equal(jobs[10].location, 'Coimbatore, India')
})
