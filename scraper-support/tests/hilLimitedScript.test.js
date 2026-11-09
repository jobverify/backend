import assert from 'node:assert/strict'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hillimited',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadHilLimitedModule = async () => {
  try {
    return await import('../../scraper/hillimited/script.js')
  } catch {
    assert.fail('Expected HIL Limited scraper module at ../../scraper/hillimited/script.js')
  }
}

test('HIL Limited scraper validates the verified BirlaNu people page and current Darwinbox-only handoff', async () => {
  const hillimited = await loadHilLimitedModule()
  const peoplePageHtml = readFixture('people-page.html')

  assert.equal(hillimited.SOURCE, 'hillimited')
  assert.equal(hillimited.COMPANY, 'HIL Limited')
  assert.equal(hillimited.HOMEPAGE_URL, 'https://www.hil.in/')
  assert.equal(hillimited.CAREERS_URL, 'https://birlanu.com/people')
  assert.equal(
    hillimited.VERIFIED_DARWINBOX_URL,
    'https://iconnect-hil.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(hillimited.hasOfficialCareersSignal(peoplePageHtml), true)
  assert.equal(
    hillimited.extractJoinUsUrl(peoplePageHtml),
    'https://iconnect-hil.darwinbox.in/ms/candidatev2/main/careers/allJobs',
  )
  assert.equal(hillimited.pageExposesFirstPartyJobRecords(peoplePageHtml), false)

  const requestedUrls = []
  const jobs = await hillimited.createHilLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === hillimited.CAREERS_URL) return peoplePageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [hillimited.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('HIL Limited scraper fails closed when the verified BirlaNu handoff changes or first-party job cards appear', async () => {
  const hillimited = await loadHilLimitedModule()
  const peoplePageHtml = readFixture('people-page.html')
  const firstPartyJobsHtml = readFixture('people-page-first-party-jobs.html')

  await assert.rejects(
    hillimited.createHilLimitedScraper().run({
      fetchText: async (url) => {
        if (url === hillimited.CAREERS_URL) {
          return peoplePageHtml.replace(
            'https://iconnect-hil.darwinbox.in/ms/candidatev2/main/careers/allJobs',
            'https://birlanu.com/careers/openings',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified darwinbox handoff/i,
  )

  await assert.rejects(
    hillimited.createHilLimitedScraper().run({
      fetchText: async (url) => {
        if (url === hillimited.CAREERS_URL) return firstPartyJobsHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /first-party public job records/i,
  )
})
