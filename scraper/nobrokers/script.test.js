import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadNobrokersModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Nobrokers scraper module at ./script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, 'fixtures')

const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')
const careersBundle = fs.readFileSync(path.join(fixturesDir, 'careers.bundle.js'), 'utf8')
const sharedConfigBundle = fs.readFileSync(path.join(fixturesDir, 'shared-config.bundle.js'), 'utf8')
const jobFeedPayload = JSON.parse(
  fs.readFileSync(path.join(fixturesDir, 'jobOpeningSheet.json'), 'utf8'),
)

test('Nobrokers scraper validates the verified homepage, careers shell, bundle signals, and public jobs feed', async () => {
  const nobrokers = await loadNobrokersModule()

  assert.equal(nobrokers.SOURCE, 'nobrokers')
  assert.equal(nobrokers.COMPANY, 'NoBroker')
  assert.equal(nobrokers.HOMEPAGE_URL, 'https://www.nobroker.in/')
  assert.equal(nobrokers.CAREERS_URL, 'https://www.nobroker.in/careers')
  assert.equal(
    nobrokers.JOB_FEED_URL,
    'https://no-broker-cbaa4.firebaseio.com/jobOpeningSheet.json',
  )
  assert.equal(nobrokers.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(nobrokers.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(nobrokers.extractBundleUrlsFromHtml(careersHtml), [
    'https://assets.nobroker.in/nb-new/3/3.eeb967ddc3fac566549d.chunk.js',
    'https://assets.nobroker.in/nb-new/5/5.551f771adb7ec8827d23.chunk.js',
    'https://assets.nobroker.in/nb-new/7/7.3b1029e797285647c482.chunk.js',
    'https://assets.nobroker.in/nb-new/8/8.bfa306b894b853aafac3.chunk.js',
    'https://assets.nobroker.in/nb-new/25/25.06807a6fbdd181e05b8f.chunk.js',
    'https://assets.nobroker.in/nb-new/careers/careers.d40148c29ae49a8408eb.chunk.js',
  ])
  assert.equal(nobrokers.hasJobsFeedBundleSignal(careersBundle), true)
  assert.equal(nobrokers.hasJobsFeedConfigSignal(sharedConfigBundle), true)
  assert.equal(
    nobrokers.hasVerifiedBundleSignals([careersBundle, sharedConfigBundle]),
    true,
  )
  assert.equal(nobrokers.hasVerifiedJobFeedPayload(jobFeedPayload), true)
  assert.deepEqual(nobrokers.extractJobsFromFeed(jobFeedPayload), [
    {
      title: 'Lead Software Engineer',
      company: 'NoBroker',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '1',
      requisitionId: '1',
      sourceUrl: 'https://www.linkedin.com/jobs/view/2454032399/?capColoOverride=true',
      applyUrl: 'https://www.linkedin.com/jobs/view/2454032399/?capColoOverride=true',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
    {
      title: 'Senior Software Engineer',
      company: 'NoBroker',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '2',
      requisitionId: '2',
      sourceUrl: 'https://www.linkedin.com/jobs/view/2427005768/?capColoOverride=true',
      applyUrl: 'https://www.linkedin.com/jobs/view/2427005768/?capColoOverride=true',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
    {
      title: 'Frontend Developer',
      company: 'NoBroker',
      department: 'Engineering',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '3',
      requisitionId: '3',
      sourceUrl: 'https://www.linkedin.com/jobs/view/2444892497/?capColoOverride=true',
      applyUrl: 'https://www.linkedin.com/jobs/view/2444892497/?capColoOverride=true',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
    {
      title: 'Product Manager',
      company: 'NoBroker',
      department: 'Design - Product Manager',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '4',
      requisitionId: '4',
      sourceUrl: 'https://www.linkedin.com/jobs/view/2429283907/?capColoOverride=true',
      applyUrl: 'https://www.linkedin.com/jobs/view/2429283907/?capColoOverride=true',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
    {
      title: 'Android Developer',
      company: 'NoBroker',
      department: 'Engineering - Mobile',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '6',
      requisitionId: '6',
      sourceUrl: 'https://www.linkedin.com/jobs/view/2461500701/?capColoOverride=true',
      applyUrl: 'https://www.linkedin.com/jobs/view/2461500701/?capColoOverride=true',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
    {
      title: 'IOS Developer',
      company: 'NoBroker',
      department: 'Engineering - Mobile',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: '7',
      requisitionId: '7',
      sourceUrl: 'https://www.linkedin.com/jobs/view/2479970990/?capColoOverride=true',
      applyUrl: 'https://www.linkedin.com/jobs/view/2479970990/?capColoOverride=true',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      publicExperienceChecked: true,
    },
  ])
})

test('Nobrokers scraper run decorates jobs from the verified first-party feed', async () => {
  const nobrokers = await loadNobrokersModule()
  const requestedTextUrls = []
  const requestedJsonUrls = []

  const jobs = await nobrokers.createNobrokersScraper().run({
    fetchText: async (url) => {
      requestedTextUrls.push(url)

      if (url === nobrokers.HOMEPAGE_URL) return homepageHtml
      if (url === nobrokers.CAREERS_URL) return careersHtml
      if (url.endsWith('/careers/careers.d40148c29ae49a8408eb.chunk.js')) return careersBundle
      return sharedConfigBundle
    },
    fetchJson: async (url) => {
      requestedJsonUrls.push(url)
      assert.equal(url, nobrokers.JOB_FEED_URL)
      return jobFeedPayload
    },
    now: () => '2026-07-11T00:00:00.000Z',
  })

  assert.deepEqual(requestedTextUrls, [
    nobrokers.HOMEPAGE_URL,
    nobrokers.CAREERS_URL,
    'https://assets.nobroker.in/nb-new/3/3.eeb967ddc3fac566549d.chunk.js',
    'https://assets.nobroker.in/nb-new/5/5.551f771adb7ec8827d23.chunk.js',
    'https://assets.nobroker.in/nb-new/7/7.3b1029e797285647c482.chunk.js',
    'https://assets.nobroker.in/nb-new/8/8.bfa306b894b853aafac3.chunk.js',
    'https://assets.nobroker.in/nb-new/25/25.06807a6fbdd181e05b8f.chunk.js',
    'https://assets.nobroker.in/nb-new/careers/careers.d40148c29ae49a8408eb.chunk.js',
  ])
  assert.deepEqual(requestedJsonUrls, [nobrokers.JOB_FEED_URL])
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].source, 'nobrokers')
  assert.equal(jobs[0].company, 'NoBroker')
  assert.equal(
    jobs[0].link,
    'https://www.linkedin.com/jobs/view/2454032399/?capColoOverride=true',
  )
  assert.equal(jobs[0].scrapedAt, '2026-07-11T00:00:00.000Z')
  assert.equal(jobs[0].publicExperienceChecked, true)
})

test('Nobrokers scraper fails closed when the verified first-party surface drifts', async () => {
  const nobrokers = await loadNobrokersModule()

  await assert.rejects(
    nobrokers.createNobrokersScraper().run({
      fetchText: async (url) => {
        if (url === nobrokers.HOMEPAGE_URL) {
          return '<html><body><h1>Placeholder</h1></body></html>'
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    nobrokers.createNobrokersScraper().run({
      fetchText: async (url) => {
        if (url === nobrokers.HOMEPAGE_URL) return homepageHtml
        if (url === nobrokers.CAREERS_URL) return careersHtml
        return 'window.__NB_CONFIG__ = {}'
      },
    }),
    /verified public firebase jobs feed/i,
  )

  await assert.rejects(
    nobrokers.createNobrokersScraper().run({
      fetchText: async (url) => {
        if (url === nobrokers.HOMEPAGE_URL) return homepageHtml
        if (url === nobrokers.CAREERS_URL) return careersHtml
        if (url.endsWith('/careers/careers.d40148c29ae49a8408eb.chunk.js')) return careersBundle
        return sharedConfigBundle
      },
      fetchJson: async () => [{ Role: 'Broken record' }],
    }),
    /jobs feed changed materially/i,
  )
})

test('Nobrokers accepts current Firebase config keys while retaining exact project verification', async () => {
  const nb = await loadNobrokersModule()
  const client = 'r.default.initializeApp(v.firebaseConfig);r.default.database().ref("jobOpeningSheet").once("value",callback)'
  const config = 't.firebaseConfig={authDomain:"no-broker-cbaa4.firebaseapp.com",databaseURL:"https://no-broker-cbaa4.firebaseio.com"}'
  assert.equal(nb.hasVerifiedBundleSignals([client, config]), true)
  assert.equal(nb.hasVerifiedBundleSignals([client, config.replace('no-broker-cbaa4.firebaseio.com', 'different.firebaseio.com')]), false)
  assert.equal(nb.hasVerifiedBundleSignals([client, config.replace('no-broker-cbaa4.firebaseapp.com', 'different.firebaseapp.com')]), false)
  const jobs = await nb.run({fetchText: async url => url === nb.HOMEPAGE_URL ? homepageHtml : url === nb.CAREERS_URL ? careersHtml : url.includes('/careers/') ? client : config, fetchJson: async () => jobFeedPayload})
  assert.equal(jobs.length, 6)
  assert.equal(jobs[0].jobId, '1')
})
