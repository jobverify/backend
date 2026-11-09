import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const fixturesDir = path.resolve(currentDir, '../../scraper/gmrinstituteoftechnology/fixtures')

const loadFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const homepageHtml = loadFixture('homepage.html')
const commentOnlyCareersHtml = loadFixture('careers-comment-only.html')
const publicOpeningsCareersHtml = loadFixture('careers-public-openings.html')

const loadGmritModule = async () => {
  try {
    return await import('../../scraper/gmrinstituteoftechnology/script.js')
  } catch {
    return null
  }
}

test('GMR Institute of Technology validates the verified homepage handoff and ignores comment-only vacancy rows', async () => {
  const gmrit = await loadGmritModule()
  assert.ok(gmrit, 'Expected GMR Institute of Technology scraper module at ../../scraper/gmrinstituteoftechnology/script.js')

  assert.equal(gmrit.SOURCE, 'gmrinstituteoftechnology')
  assert.equal(gmrit.COMPANY, 'GMR Institute of Technology')
  assert.equal(gmrit.HOMEPAGE_URL, 'https://gmrit.edu.in/')
  assert.equal(gmrit.CAREERS_URL, 'https://gmrit.edu.in/careers.php')
  assert.equal(gmrit.APPLY_URL, 'https://gmrit.edu.in/applynow.php')
  assert.equal(gmrit.APPLY_EMAIL, 'opportunities@gmrit.edu.in')
  assert.equal(gmrit.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(gmrit.hasOfficialCareersSignal(commentOnlyCareersHtml), true)
  assert.deepEqual(gmrit.extractPublicListings(commentOnlyCareersHtml), [])
})

test('GMR Institute of Technology parses public vacancy rows and decorates the scraper output', async () => {
  const gmrit = await loadGmritModule()
  assert.ok(gmrit, 'Expected GMR Institute of Technology scraper module at ../../scraper/gmrinstituteoftechnology/script.js')

  const jobs = gmrit.extractPublicListings(publicOpeningsCareersHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Assistant Professor',
    company: 'GMR Institute of Technology',
    department: 'Soft Skills',
    location: 'Rajam, Andhra Pradesh, India',
    city: 'Rajam',
    country: 'India',
    jobId: 'gmrinstituteoftechnology-assistant-professor-soft-skills',
    requisitionId: 'gmrinstituteoftechnology-assistant-professor-soft-skills',
    sourceUrl: 'https://gmrit.edu.in/careers.php',
    applyUrl: 'https://gmrit.edu.in/applynow.php',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: 'Post-Graduation with related experience and Certifications.',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'Post-Graduation with related experience and Certifications.',
    remoteStatus: 'On-site',
  })
  assert.match(jobs[1].minimumQualification, /8-10 years/i)

  const requestedUrls = []
  const runJobs = await gmrit.createGmritScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === gmrit.HOMEPAGE_URL) return homepageHtml
      if (url === gmrit.CAREERS_URL) return publicOpeningsCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T09:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [gmrit.HOMEPAGE_URL, gmrit.CAREERS_URL])
  assert.equal(runJobs.length, 2)
  assert.equal(runJobs[0].source, 'gmrinstituteoftechnology')
  assert.equal(runJobs[0].link, 'https://gmrit.edu.in/applynow.php')
  assert.equal(runJobs[0].scrapedAt, '2026-07-10T09:00:00.000Z')
})

test('GMR Institute of Technology fails closed when the verified homepage handoff or careers table changes materially', async () => {
  const gmrit = await loadGmritModule()
  assert.ok(gmrit, 'Expected GMR Institute of Technology scraper module at ../../scraper/gmrinstituteoftechnology/script.js')

  await assert.rejects(
    gmrit.createGmritScraper().run({
      fetchText: async (url) => {
        if (url === gmrit.HOMEPAGE_URL) {
          return homepageHtml.replace('careers.php', 'faculty.php')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage no longer matches the verified careers handoff/i,
  )

  await assert.rejects(
    gmrit.createGmritScraper().run({
      fetchText: async (url) => {
        if (url === gmrit.HOMEPAGE_URL) return homepageHtml
        if (url === gmrit.CAREERS_URL) {
          return commentOnlyCareersHtml
            .replace('Current Vacancy', 'Open Roles')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page no longer matches the verified vacancy table/i,
  )
})
