import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadKgislModule = async () => {
  try {
    return await import('../../scraper/kgisl/script.js')
  } catch {
    assert.fail('Expected KGISL scraper module at ../../scraper/kgisl/script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures', 'kgisl')

const homepageHtml = readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')
const currentOpeningsHtml = readFileSync(path.join(fixturesDir, 'current-openings.html'), 'utf8')
const candidateHomeHtml = readFileSync(path.join(fixturesDir, 'candidate-home.html'), 'utf8')

const createUnavailableError = (url) => {
  const error = new Error(`fetch failed | Connect Timeout Error (attempted address: ${url.includes('careerxai') ? 'careerxai.kgisl.com:443' : 'www.kgisl.com:443'}, timeout: 10000ms)`)
  error.cause = {
    code: 'UND_ERR_CONNECT_TIMEOUT',
    message: `Connect Timeout Error (attempted address: ${url.includes('careerxai') ? 'careerxai.kgisl.com:443' : 'www.kgisl.com:443'}, timeout: 10000ms)`,
  }
  return error
}

test('KGISL scraper keeps the verified first-party URLs and public job surface pinned', async () => {
  const kgisl = await loadKgislModule()

  assert.equal(kgisl.SOURCE, 'kgisl')
  assert.equal(kgisl.COMPANY, 'KGISL')
  assert.equal(kgisl.HOMEPAGE_URL, 'https://www.kgisl.com/')
  assert.equal(kgisl.CAREERS_URL, 'https://www.kgisl.com/careers')
  assert.equal(kgisl.CURRENT_OPENINGS_URL, 'https://www.kgisl.com/current-openings/')
  assert.equal(
    kgisl.CANDIDATE_HOME_URL,
    'https://careerxai.kgisl.com/ajax/candidate_home?form=wepportal',
  )
  assert.equal(kgisl.VERIFIED_ON, '2026-10-09')
  assert.equal(kgisl.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(kgisl.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(kgisl.hasOfficialCandidateHomeSignal(candidateHomeHtml), true)
  assert.equal(kgisl.extractCandidateHomeUrl(currentOpeningsHtml), kgisl.CANDIDATE_HOME_URL)

  const jobs = kgisl.extractJobs(candidateHomeHtml)
  assert.equal(jobs.length, 16)
  assert.deepEqual(jobs[0], {
    title: 'Sr.associate - Senior Associate',
    location: 'COIMBATORE-INDIA',
    jobId: 'V100889',
    applyUrl: 'https://careerxai.kgisl.com/resume/webportal_vacancy_apply_resume/VjEwMDg4OQ==',
    sourceUrl: 'https://careerxai.kgisl.com/resume/webportal_vacancy_apply_resume/VjEwMDg4OQ==',
    postingDate: '26-Jun-2026',
    jobDescription:
      'We are seeking a Senior Associate – Full Stack Developer with strong expertise in Java, Spring Boot, Angular, and PostgreSQL to design, develop, and maintain scalable, high-performance enterprise applications. The ideal candidate should demonstrate ownership, technical leadership, and a proactive approach to solving complex business and technical challenges while delivering high-quality software solutions within project timelines.',
  })
  assert.equal(jobs.at(-1)?.jobId, 'V100427')
})

test('KGISL scraper returns normalized jobs from the verified first-party candidate portal', async () => {
  const kgisl = await loadKgislModule()
  const requestedUrls = []

  const jobs = await kgisl.createKgislScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kgisl.HOMEPAGE_URL) return homepageHtml
      if (url === kgisl.CAREERS_URL) return careersHtml
      if (url === kgisl.CURRENT_OPENINGS_URL) return currentOpeningsHtml
      if (url === kgisl.CANDIDATE_HOME_URL) return candidateHomeHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kgisl.HOMEPAGE_URL,
    kgisl.CAREERS_URL,
    kgisl.CURRENT_OPENINGS_URL,
    kgisl.CANDIDATE_HOME_URL,
  ])
  assert.equal(jobs.length, 16)
  assert.equal(jobs[0].company, 'KGISL')
  assert.equal(jobs[0].jobId, 'V100889')
  assert.equal(jobs[0].location, 'COIMBATORE-INDIA')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].atsPlatform, 'official-first-party-candidate-portal')
  assert.equal(jobs[0].companyCareerPage, kgisl.CURRENT_OPENINGS_URL)
  assert.equal(jobs[0].companyDomain, 'kgisl.com')
  assert.equal(jobs[0].title, 'Sr.associate - Senior Associate')
  assert.equal(jobs[0].jobType, 'Full-time Experienced')
  assert.equal(jobs[0].sourceUrl, jobs[0].applyUrl)
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('KGISL scraper falls back to the verified candidate portal when the kgisl.com wrapper pages time out or 504', async () => {
  const kgisl = await loadKgislModule()
  const requestedUrls = []

  const jobs = await kgisl.createKgislScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kgisl.HOMEPAGE_URL) {
        throw new Error('HTTP 500 for https://www.kgisl.com/')
      }
      if (url === kgisl.CAREERS_URL) {
        throw new Error('The operation was aborted due to timeout')
      }
      if (url === kgisl.CURRENT_OPENINGS_URL) {
        throw new Error('HTTP 504 for https://www.kgisl.com/current-openings/')
      }
      if (url === kgisl.CANDIDATE_HOME_URL) return candidateHomeHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kgisl.HOMEPAGE_URL,
    kgisl.CAREERS_URL,
    kgisl.CURRENT_OPENINGS_URL,
    kgisl.CANDIDATE_HOME_URL,
  ])
  assert.equal(jobs.length, 16)
  assert.equal(jobs[0].jobId, 'V100889')
  assert.equal(jobs[0].companyCareerPage, kgisl.CURRENT_OPENINGS_URL)
})

test('KGISL scraper fails closed when the verified first-party surface drifts', async () => {
  const kgisl = await loadKgislModule()

  await assert.rejects(
    kgisl.createKgislScraper().run({
      fetchText: async (url) => {
        if (url === kgisl.HOMEPAGE_URL) return '<html><body><h1>Unexpected homepage</h1></body></html>'
        if (url === kgisl.CAREERS_URL) return careersHtml
        if (url === kgisl.CURRENT_OPENINGS_URL) return currentOpeningsHtml
        if (url === kgisl.CANDIDATE_HOME_URL) return candidateHomeHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    kgisl.createKgislScraper().run({
      fetchText: async (url) => {
        if (url === kgisl.HOMEPAGE_URL) return homepageHtml
        if (url === kgisl.CAREERS_URL) return careersHtml
        if (url === kgisl.CURRENT_OPENINGS_URL) {
          return currentOpeningsHtml.replace(
            'https://careerxai.kgisl.com/ajax/candidate_home?form=wepportal',
            'https://jobs.kgisl.com/public/openings',
          )
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified candidate portal/i,
  )

  await assert.rejects(
    kgisl.createKgislScraper().run({
      fetchText: async (url) => {
        if (url === kgisl.HOMEPAGE_URL) return homepageHtml
        if (url === kgisl.CAREERS_URL) return careersHtml
        if (url === kgisl.CURRENT_OPENINGS_URL) return currentOpeningsHtml
        if (url === kgisl.CANDIDATE_HOME_URL) {
          return '<html><body><p>No current vacancies published.</p></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /candidate portal no longer matches the verified public surface/i,
  )

  await assert.rejects(
    kgisl.createKgislScraper().run({
      fetchText: async (url) => {
        if (url === kgisl.HOMEPAGE_URL) {
          throw new Error('HTTP 500 for https://www.kgisl.com/')
        }
        if (url === kgisl.CAREERS_URL) {
          throw new Error('The operation was aborted due to timeout')
        }
        if (url === kgisl.CURRENT_OPENINGS_URL) {
          throw new Error('HTTP 504 for https://www.kgisl.com/current-openings/')
        }
        if (url === kgisl.CANDIDATE_HOME_URL) {
          return '<html><body><h1>Unexpected</h1></body></html>'
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /candidate portal no longer matches the verified public surface/i,
  )
})

test('KGISL preserves unavailable inventory as a failure instead of verified empty', async () => {
  const kgisl = await loadKgislModule()
  assert.equal(kgisl.isVerifiedKgislUnavailableError(createUnavailableError(kgisl.CANDIDATE_HOME_URL)), true)
  await assert.rejects(kgisl.run({fetchText:async url => {throw createUnavailableError(url)}}), /timeout|unavailable|fetch failed/i)
})

const currentOpenings = readFileSync(path.join(fixturesDir, 'careerx-openings-current.html'), 'utf8')
const currentPortal = readFileSync(path.join(fixturesDir, 'current-portal.html'), 'utf8')
const currentClient = readFileSync(path.join(fixturesDir, 'current-client.js'), 'utf8')
const currentInventory = JSON.parse(readFileSync(path.join(fixturesDir, 'current-inventory.json'), 'utf8'))
const currentDetails = JSON.parse(readFileSync(path.join(fixturesDir, 'current-details.json'), 'utf8'))
const currentOptions = (kgisl, overrides = {}) => ({
  fetchText: async url => {
    if (url === kgisl.HOMEPAGE_URL) return homepageHtml
    if (url === kgisl.CAREERS_URL) return careersHtml
    if (url === kgisl.CURRENT_OPENINGS_URL) return currentOpenings
    if (url === 'https://careerx.kgisl.com/') return currentPortal
    if (url === 'https://careerx.kgisl.com/assets/index-24QujpCW.js') return currentClient
    throw new Error('Unexpected current KGISL URL: ' + url)
  },
  fetchJson: async url => url.endsWith('/vacancies') ? structuredClone(currentInventory) : structuredClone(currentDetails[url.split('/').at(-1)]),
  ...overrides,
})

test('KGISL follows its verified replacement iframe and returns all twenty India roles', async () => {
  const kgisl = await loadKgislModule()
  assert.equal(kgisl.extractCandidateHomeUrl(currentOpenings), 'https://careerx.kgisl.com/#/careers')
  const jobs = await kgisl.run(currentOptions(kgisl))
  assert.equal(jobs.length, 20)
  assert.equal(new Set(jobs.map(job => job.jobId)).size, 20)
  assert.ok(jobs.every(job => job.country === 'India' && job.jobDescription && job.applyUrl === 'https://careerx.kgisl.com/#/careers/apply/' + job.jobId))
  assert.equal(jobs[0].title, 'Senior Business Analyst - Project Lead')
  assert.equal(jobs[0].experienceRequired, '10-15 years')
})

test('KGISL rejects replacement-client drift and incomplete or conflicting vacancy data', async () => {
  const kgisl = await loadKgislModule()
  const options = currentOptions(kgisl)
  await assert.rejects(kgisl.run({...options,fetchText:async url => (await options.fetchText(url)).replaceAll('/api/public/careers/vacancies','/api/changed')}), /client|inventory/i)
  for (const mutate of [
    payload => {payload.status = 500},
    payload => {payload.response.push(payload.response[0])},
    payload => {payload.response[0].work_location = 'Remote'},
    payload => {payload.more_records = true},
  ]) {
    await assert.rejects(kgisl.run({...options,fetchJson:async url => {const payload=await options.fetchJson(url);if(url.endsWith('/vacancies'))mutate(payload);return payload}}), /inventory|country|location|duplicate|pagination/i)
  }
  for (const mutate of [
    detail => {detail.vacancy_number = 'V000000'},
    detail => {detail.work_location = 'Kuala lumpur-Malaysia'},
    detail => {detail.job_description = ''},
    detail => {detail.min_experience = 0},
  ]) {
    await assert.rejects(kgisl.run({...options,fetchJson:async url => {const payload=await options.fetchJson(url);if(!url.endsWith('/vacancies'))mutate(payload.response);return payload}}), /detail|description|listing/i)
  }
})

test('KGISL allows verified empty replacement inventory and honors cancellation', async () => {
  const kgisl = await loadKgislModule()
  assert.deepEqual(await kgisl.run(currentOptions(kgisl,{fetchJson:async()=>({status:200,message:'OK',response:[]})})), [])
  const controller = new AbortController(); controller.abort(new Error('test cancellation'))
  await assert.rejects(kgisl.run(currentOptions(kgisl,{signal:controller.signal})), /test cancellation/)
})
