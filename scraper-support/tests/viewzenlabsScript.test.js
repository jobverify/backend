import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const loadViewZenLabsModule = async () => {
  try {
    return await import('../../scraper/viewzenlabs/script.js')
  } catch {
    return null
  }
}

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'viewzenlabs',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

test('extractCompanyLocation reads the Chennai base from the ViewZen Labs careers page', async () => {
  const viewzenlabs = await loadViewZenLabsModule()
  assert.ok(viewzenlabs)

  assert.equal(
    viewzenlabs.extractCompanyLocation(readFixture('careers.html')),
    'Chennai, India',
  )
})

test('extractJobListings maps ViewZen Labs career cards into the shared listing contract', async () => {
  const viewzenlabs = await loadViewZenLabsModule()
  assert.ok(viewzenlabs)

  const jobs = viewzenlabs.extractJobListings(readFixture('careers.html'))

  assert.equal(jobs.length, 5)
  assert.deepEqual(jobs[0], {
    title: 'Frontend - Angular',
    location: 'Chennai, India',
    city: 'Chennai',
    jobId: 'frontend-angular',
    requisitionId: 'frontend-angular',
    employmentType: 'Full-time',
    experienceRequired: '0 - 1 Years',
    postingDate: null,
    closingDate: null,
    sourceUrl: 'https://www.viewzenlabs.com/careers',
    applyUrl: null,
    department: 'Software Developer',
    minimumQualification: 'BE / B.Tech / BSc / MSc/MCA or equivalent.',
    requiredSkills: [
      'Linux (Ubuntu)',
      'Javascript / ES6 / Typescript',
      'HTML5 / CSS / Bootstrap',
      'Angular 16+ Components/Services',
      'Async REST Web Services',
    ],
  })

  assert.deepEqual(jobs[4], {
    title: 'Tech Sales',
    location: 'Chennai, India',
    city: 'Chennai',
    jobId: 'tech-sales',
    requisitionId: 'tech-sales',
    employmentType: 'Full-time',
    experienceRequired: '0 - 1 Years',
    postingDate: null,
    closingDate: null,
    sourceUrl: 'https://www.viewzenlabs.com/careers',
    applyUrl: null,
    department: 'Sales Executive',
    minimumQualification: 'Mass Comm / MBA / BBA / BE.',
    requiredSkills: [
      'Lead Gen (Email, Cold Calls)',
      'Client Meetings, Webinars',
      'Proposal Creation',
      'Target-oriented',
    ],
  })
})

test('normalizeScrapedJob composes ViewZen Labs early-career roles from the careers page cards', async () => {
  const viewzenlabs = await loadViewZenLabsModule()
  assert.ok(viewzenlabs)

  const listing = viewzenlabs.extractJobListings(readFixture('careers.html'))[0]
  const normalized = normalizeScrapedJob(listing, {
    source: 'viewzenlabs',
    companyName: 'ViewZen Labs',
    companyCareerPage: 'https://www.viewzenlabs.com/careers',
    atsPlatform: 'official-company-careers',
  })

  assert.equal(normalized.company, 'ViewZen Labs')
  assert.equal(normalized.country, 'India')
  assert.equal(normalized.remoteStatus, 'On-site')
  assert.equal(normalized.experienceLevel, 'Entry Level')
  assert.equal(normalized.jobType, 'Full-time Fresher')
})

test('run fetches the ViewZen Labs careers page and decorates shared runner fields', async () => {
  const viewzenlabs = await loadViewZenLabsModule()
  assert.ok(viewzenlabs)

  const requested = []
  const scraper = viewzenlabs.createViewZenLabsScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requested.push(url)
      if (url === 'https://www.viewzenlabs.com/careers') {
        return readFixture('careers.html')
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requested, ['https://www.viewzenlabs.com/careers'])
  assert.equal(jobs.length, 5)
  assert.equal(jobs[0].company, 'ViewZen Labs')
  assert.equal(jobs[0].source, 'viewzenlabs')
  assert.equal(jobs[0].link, 'https://www.viewzenlabs.com/careers')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
  assert.match(jobs[0].sourceDescription, /BE \/ B.Tech \/ BSc/)
  assert.match(jobs[0].sourceDescription, /Angular 16\+ Components\/Services/)
  assert.doesNotMatch(jobs[0].sourceDescription, /Lead Gen|NoSQL|Copyright/)
  assert.equal(jobs[0].sourceDetailComplete, false, 'A published role card does not establish the separate full JD')
})

test('ViewZen source content must come from one active role card matching its exact qualification and skills', async () => {
  const source = await loadViewZenLabsModule(), html = readFixture('careers.html')
  const job = source.extractJobListings(html)[0]
  const valid = source.extractPublishedRoleDescription(html, job)
  assert.match(valid, /Async REST Web Services/)
  assert.equal(source.extractPublishedRoleDescription('<template>'+html+'</template>', job), null)
  assert.equal(source.extractPublishedRoleDescription('<div hidden>'+html+'</div>', job), null)
  assert.equal(source.extractPublishedRoleDescription(html+html, job), null)
  assert.equal(source.extractPublishedRoleDescription(html, {...job, title:'Another role'}), null)
  assert.equal(source.extractPublishedRoleDescription(html, {...job, minimumQualification:'Invented qualification'}), null)
  assert.equal(source.extractPublishedRoleDescription(html, {...job, requiredSkills:['Another skill']}), null)
})

test('actual employer card content makes ViewZen roles visible while preserving partial detail status', {timeout:60000}, async t => {
  const [{default:mongoose},{MongoMemoryServer},{saveToDB},{applyPublicJobVisibility}] = await Promise.all([
    import('mongoose'),import('mongodb-memory-server'),import('../utils/saveToDB.js'),
    import('../../src/utils/publicJobVisibility.js'),
  ])
  assert.equal(mongoose.connection.readyState,0)
  const mongo=await MongoMemoryServer.create({instance:{ip:'127.0.0.1'},binary:{version:'8.2.6',
    downloadDir:fileURLToPath(new URL('../../.cache/mongodb-binaries/',import.meta.url))}})
  t.after(async()=>{await mongoose.disconnect();await mongo.stop()})
  assert.match(mongo.getUri(),/^mongodb:\/\/127\.0\.0\.1:/)
  await mongoose.connect(mongo.getUri(),{autoIndex:false,autoCreate:false})
  const source=await loadViewZenLabsModule(),now=new Date('2026-10-29T14:00:00Z')
  const jobs=await source.run({fetchText:async()=>readFixture('careers.html'),now:()=>now.toISOString()})
  await saveToDB(jobs,'viewzenlabs',{now,enrichPublicExperience:false,enqueueAlerts:false,
    descriptionRewriteMode:'off',replaceExisting:false,refreshDatasetSummary:false})
  const visible=await mongoose.connection.db.collection('jobs').find(applyPublicJobVisibility({source:'viewzenlabs',status:'active'},{},now)).toArray()
  assert.equal(visible.length,5)
  assert.ok(visible.every(job=>job.sourceDescription))
})
