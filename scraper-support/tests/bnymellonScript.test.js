import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadBnyModule = async () => {
  try {
    return await import('../../scraper/bnymellon/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'bnymellon',
)

const readJsonFixture = (name) => JSON.parse(readFileSync(path.join(fixturesDir, name), 'utf8'))

const sampleDetailPayload = {
  Id: '74699',
  Title: 'Senior Specialist, Full-Stack Engineer',
  JobSchedule: 'Full time',
  PostedDate: '2026-06-29',
  PrimaryLocation: 'Pune, MH, India',
  PrimaryLocationCountry: 'IN',
  ExternalDescriptionStr: '<p>Build and support full-stack platforms for enterprise workflows. Collaborate with engineers to design, test and operate reliable customer services.</p>',
  ExternalQualificationsStr: '<ul><li>2-6 years of software engineering experience</li><li>Bachelor degree in computer science</li></ul>',
}

test('buildSearchUrl keeps BNY searches on the public Oracle Cloud careers finder with India scoping', async () => {
  const bny = await loadBnyModule()
  assert.ok(bny)

  assert.equal(
    bny.buildSearchUrl(),
    'https://eofe.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_3001,limit=24,offset=0,location=India',
  )
  assert.equal(
    bny.buildSearchUrl({ page: 2, limit: 10, location: 'Pune, India' }),
    'https://eofe.fa.us2.oraclecloud.com:443/hcmRestApi/resources/latest/recruitingCEJobRequisitions?onlyData=true&expand=requisitionList.secondaryLocations&finder=findReqs;siteNumber=CX_3001,limit=10,offset=20,location=Pune, India',
  )
})

test('buildJobDetailUrl keeps BNY detail links on the public Oracle Cloud site', async () => {
  const bny = await loadBnyModule()
  assert.ok(bny)

  assert.equal(
    bny.buildJobDetailUrl('74699'),
    'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/job/74699/',
  )
})

test('buildJobDetailApiUrl uses the official BNY Oracle detail endpoint', async () => {
  const bny = await loadBnyModule()
  assert.ok(bny)

  assert.equal(
    bny.buildJobDetailApiUrl('74699'),
    'https://eofe.fa.us2.oraclecloud.com/hcmRestApi/resources/latest/recruitingCEJobRequisitionDetails/74699?expand=all',
  )
})

test('extractSearchResults normalizes BNY Oracle Cloud requisitions and keeps only India jobs', async () => {
  const bny = await loadBnyModule()
  assert.ok(bny)

  const payload = readJsonFixture('search-results.json')
  const jobs = bny.extractSearchResults(payload)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Specialist, Full-Stack Engineer',
    company: 'BNY Mellon',
    department: null,
    location: 'Pune, Mh, India',
    city: 'Pune',
    jobId: '74699',
    requisitionId: '74699',
    sourceUrl: 'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/job/74699/',
    applyUrl: 'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/job/74699/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-29',
    closingDate: null,
    jobDescription: null,
  })

  assert.equal(jobs[1].jobId, '75085')
  assert.equal(jobs[1].city, 'Pune')
})

test('extractJobDetail derives experience from BNY Oracle detail qualifications', async () => {
  const bny = await loadBnyModule()
  assert.ok(bny)

  const listing = bny.extractSearchResults(readJsonFixture('search-results.json'))[0]
  const detail = bny.extractJobDetail(sampleDetailPayload, listing)

  assert.deepEqual(detail, {
    title: 'Senior Specialist, Full-Stack Engineer',
    company: 'BNY Mellon',
    department: null,
    location: 'Pune, Mh, India',
    city: 'Pune',
    jobId: '74699',
    requisitionId: '74699',
    sourceUrl: 'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/job/74699/',
    applyUrl: 'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/job/74699/',
    employmentType: 'Full time',
    experienceRequired: '2-6 years',
    minimumQualification: '2-6 years of software engineering experience Bachelor degree in computer science',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-29',
    closingDate: null,
    jobDescription: 'Build and support full-stack platforms for enterprise workflows. Collaborate with engineers to design, test and operate reliable customer services. 2-6 years of software engineering experience Bachelor degree in computer science',
  })
})

test('run paginates BNY Oracle Cloud pages, hydrates detail, and decorates shared runner fields', async () => {
  const bny = await loadBnyModule()
  assert.ok(bny)

  const requests = []
  const jobs = await bny.run({
    maxPages: 1,
    maxJobs: 1,
    fetchImpl: async (url) => {
      requests.push(url)
      if (url === bny.OFFICIAL_CAREERS_URL) return { ok: true, text: async () => `<a href="${bny.PUBLIC_SITE_URL}">Explore jobs</a>` }
      if (url === bny.PUBLIC_SITE_URL) return { ok: true, text: async () => '<base href="/hcmUI/CandidateExperience/en/sites/BNY-Careers" data-sitenumber="CX_3001">' }
      if (url === bny.buildSearchUrl()) {
        return {
          ok: true,
          json: async () => {
            const payload = readJsonFixture('search-results.json')
            Object.assign(payload.items[0], { SiteNumber: 'CX_3001', Offset: 0 })
            return payload
          },
        }
      }
      if (url === bny.buildJobDetailApiUrl('74699')) {
        return {
          ok: true,
          json: async () => sampleDetailPayload,
        }
      }
      assert.fail(`Unexpected BNY fetch URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    bny.OFFICIAL_CAREERS_URL,
    bny.PUBLIC_SITE_URL,
    bny.buildSearchUrl(),
    bny.buildJobDetailApiUrl('74699'),
    bny.buildSearchUrl(),
    bny.OFFICIAL_CAREERS_URL,
    bny.PUBLIC_SITE_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'bnymellon')
  assert.equal(jobs[0].company, 'BNY Mellon')
  assert.equal(jobs[0].jobId, '74699')
  assert.equal(jobs[0].experienceRequired, '2-6 years')
  assert.equal(
    jobs[0].applyUrl,
    'https://eofe.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/BNY-Careers/job/74699/',
  )
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
