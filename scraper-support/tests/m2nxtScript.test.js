import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const loadM2nxtModule = async () => {
  try {
    return await import('../../scraper/m2nxt/script.js')
  } catch {
    assert.fail('Expected m2nxt Solutions (P) Ltd scraper module at ../../scraper/m2nxt/script.js')
  }
}

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.join(currentDir, '..', '..', 'scraper', 'm2nxt', 'fixtures')
const homepageHtml = fs.readFileSync(path.join(fixturesDir, 'homepage.html'), 'utf8')
const careersHtml = fs.readFileSync(path.join(fixturesDir, 'careers.html'), 'utf8')

test('m2nxt Solutions (P) Ltd scraper validates the verified homepage and careers page', async () => {
  const m2nxt = await loadM2nxtModule()

  assert.equal(m2nxt.SOURCE, 'm2nxt')
  assert.equal(m2nxt.COMPANY, 'm2nxt Solutions (P) Ltd')
  assert.equal(m2nxt.HOMEPAGE_URL, 'https://www.m2nxt.com/')
  assert.equal(m2nxt.CAREERS_URL, 'https://www.m2nxt.com/careers')
  assert.equal(m2nxt.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(m2nxt.hasOfficialCareersSignal(careersHtml), true)
})

test('m2nxt Solutions (P) Ltd scraper returns the verified public openings from the first-party careers page', async () => {
  const m2nxt = await loadM2nxtModule()

  const jobs = await m2nxt.createM2nxtScraper().run({
    fetchText: async (url) => {
      if (url === m2nxt.HOMEPAGE_URL) return homepageHtml
      if (url === m2nxt.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(jobs.length, 13)
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Pre Sales Mechanical Design & Estimation for Automation Solutions',
      'Robotics Team Lead Engineer',
      'Automation Controls Engineer - Lead',
      'Assistant Manager / Deputy Manager - Sales Engineering (Fixture Business)',
      'Team Lead - Mechanical Design (Industrial Automation)',
      'Trainee / Engineer - Mechanical Design',
      'Engineer - QA Software',
      'Technical Sales Engineer',
      'Engineer - Operations',
      'Fixture & Tooling Design Engineer',
      'Senior Engineer / Lead - Mechanical Design',
      'Senior Fixture Design Engineer',
      'Controls Engineer - Additive Manufacturing',
    ],
  )
  assert.equal(jobs[0].applyUrl, 'mailto:Ahalya.k@m2nxt.com')
  assert.equal(jobs[0].location, 'Bangalore')
  assert.equal(jobs[0].publicExperienceChecked,true)
  assert.equal(jobs[0].country,null)
  assert.ok(jobs.slice(1).every(job=>job.publicExperienceChecked===false&&job.jobDescription==null&&job.country==null))
})
