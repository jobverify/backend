import assert from 'node:assert/strict'
import test from 'node:test'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Algonomy</title>
  </head>
  <body>
    <p>Algonomy is now part of ADA, creating the world’s most intelligent growth platform for enterprises globally.</p>
    <h1>Search Job Openings</h1>
    <h2>Why Algonomy</h2>
    <p>Working at Algonomy is more than just a job. It's a mission.</p>
  </body>
</html>
`

const PAYCOR_BOARD_HTML = `
<!doctype html>
<html lang="en">
  <head></head>
  <body>
    <script>
      homeUrl = 'https://algonomy.com/careers/';
      descUrl = 'https://algonomy.com/careers/';
    </script>
    <div class="gnewtonCareerGroupHeaderClass">Technology</div>
    <div class="gnewtonCareerGroupRowClass">
      <div class="gnewtonCareerGroupJobTitleClass">
        <a href="https://recruitingbypaycor.com/career/JobIntroduction.action?clientId=8a7883c6606d030901607ae3719c71a6&id=8a7887a87759248701776b7d28164319&source=&lang=en">Database Programmer (DBP)</a>
      </div>
      <div class="gnewtonCareerGroupJobDescriptionClass">Bangalore, India</div>
    </div>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/algonomy/script.js')
  } catch {
    assert.fail('Expected Algonomy scraper module at ../../scraper/algonomy/script.js')
  }
}

test('Algonomy accepts the live Paycor board even when the normalized body no longer includes the literal Algonomy brand token', async () => {
  const algonomy = await loadModule()

  assert.equal(algonomy.hasOfficialCareersSignal(CAREERS_HTML), true)
  assert.equal(algonomy.hasOfficialPaycorBoardSignal(PAYCOR_BOARD_HTML), true)
  assert.deepEqual(algonomy.extractJobsFromPaycorBoard(PAYCOR_BOARD_HTML), [
    {
      title: 'Database Programmer (DBP)',
      jobId: 'algonomy-8a7887a87759248701776b7d28164319',
      requisitionId: '8a7887a87759248701776b7d28164319',
      sourceUrl: 'https://recruitingbypaycor.com/career/JobIntroduction.action?clientId=8a7883c6606d030901607ae3719c71a6&id=8a7887a87759248701776b7d28164319&source=&lang=en',
      applyUrl: 'https://recruitingbypaycor.com/career/JobIntroduction.action?clientId=8a7883c6606d030901607ae3719c71a6&id=8a7887a87759248701776b7d28164319&source=&lang=en',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      department: 'Technology',
      employmentType: null,
      workplaceType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      compensation: null,
      postingDate: null,
      closingDate: null,
      openingsCount: null,
      jobDescription: null,
      companyCareerPage: 'https://www.algonomy.com.br/en/careers/',
      companyCareerPage: 'https://algonomy.com/careers/',
    },
  ])
})

test('Algonomy returns Paycor-backed jobs from the verified first-party careers page', async () => {
  const algonomy = await loadModule()
  const requestedUrls = []

  const jobs = await algonomy.createAlgonomyScraper({
    now: () => '2026-07-26T04:45:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === algonomy.CAREERS_URL) return CAREERS_HTML + `<script src="${algonomy.PAYCOR_SCRIPT_URL}"></script>`
      if (url === algonomy.PAYCOR_BOARD_URL) return PAYCOR_BOARD_HTML
      throw new Error(`Unexpected Algonomy URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    algonomy.CAREERS_URL,
    algonomy.PAYCOR_BOARD_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'algonomy')
  assert.equal(jobs[0].company, 'Algonomy')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].scrapedAt, '2026-07-26T04:45:00.000Z')
})


test('Algonomy reports the official ADA migration without relabeling parent jobs or accepting an empty marketing page', async () => {
  const a = await loadModule()
  const html = '<title>Careers | Build What the Next Era Runs On | ADA Global</title><h1>Careers at ADA</h1><a href="https://adaglobal.darwinbox.com/ms/candidatev2/main/careers/allJobs">Explore open roles</a>'
  const jobs = await a.run({
    fetchText: async url => { assert.equal(url, a.CAREERS_URL); return html },
    now: () => '2026-09-14T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence?.status, 'discovery-only')
  assert.equal(evidence?.surface, a.CAREERS_URL)
  assert.equal(evidence?.listingComplete, false)
  assert.match(evidence?.reason || '', /ADA Global Darwinbox/i)
})

test('Algonomy refuses an unlinked legacy Paycor board even if old marketing copy remains', async () => {
  const a = await loadModule()
  await assert.rejects(a.run({ fetchText: async url => {
    if (url === a.CAREERS_URL) return CAREERS_HTML
    return PAYCOR_BOARD_HTML
  } }), /Paycor handoff/i)
})
