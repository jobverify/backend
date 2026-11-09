import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'

import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-07-17T00:00:00.000Z'

const loadNykaaModule = async () => {
  try {
    return await import('../../scraper/nykaa/script.js')
  } catch {
    assert.fail('Expected Nykaa scraper module at ../../scraper/nykaa/script.js')
  }
}

const BOARD_PAGE_1_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Nykaa</title>
    <link rel="canonical" href="https://careers.nykaa.com.skima.ai">
  </head>
  <body>
    <h1>Nykaa</h1>
    <span>Showing 2 of 3 - Jobs</span>
    <div class="divide-y-[1px] rounded-md border border-offset-background">
      <div class="flex flex-col space-y-3 border-offset-background p-5 md:flex-row md:items-center md:space-x-3 md:space-y-0">
        <div class="w-full">
          <a href="/job-1" class="text-lg font-semibold text-primary hover:underline hover:underline-offset-2">
            Executive - Category &amp; Brand Management
          </a>
          <p class="text-sm">Minimum 1 years of experience</p>
          <div class="flex flex-wrap items-center space-x-3">
            <span class="break-all text-sm"> Bangalore </span>
            <div class="h-[6px] w-[6px] rounded-full bg-[#D9D9D9]"></div>
            <span class="break-all text-sm"> In Office </span>
            <div class="h-[6px] w-[6px] rounded-full bg-[#D9D9D9]"></div>
            <span class="break-all text-sm"> Full Time </span>
          </div>
        </div>
        <div class="flex justify-end">
          <a href="/job-1" class="inline-flex items-center justify-center">Apply</a>
        </div>
      </div>
      <div class="flex flex-col space-y-3 border-offset-background p-5 md:flex-row md:items-center md:space-x-3 md:space-y-0">
        <div class="w-full">
          <a href="/job-2" class="text-lg font-semibold text-primary hover:underline hover:underline-offset-2">
            Product Manager - Growth
          </a>
          <p class="text-sm">Minimum 4 years of experience</p>
          <div class="flex flex-wrap items-center space-x-3">
            <span class="break-all text-sm"> Delhi </span>
            <div class="h-[6px] w-[6px] rounded-full bg-[#D9D9D9]"></div>
            <span class="break-all text-sm"> In Office </span>
            <div class="h-[6px] w-[6px] rounded-full bg-[#D9D9D9]"></div>
            <span class="break-all text-sm"> Full Time </span>
          </div>
        </div>
        <div class="flex justify-end">
          <a href="/job-2" class="inline-flex items-center justify-center">Apply</a>
        </div>
      </div>
      <div data-last-page="2" data-current-page="1" data-pagination-container></div>
    </div>
  </body>
</html>
`

const BOARD_PAGE_2_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Nykaa</title>
    <link rel="canonical" href="https://careers.nykaa.com.skima.ai">
  </head>
  <body>
    <h1>Nykaa</h1>
    <span>Showing 1 of 3 - Jobs</span>
    <div class="divide-y-[1px] rounded-md border border-offset-background">
      <div class="flex flex-col space-y-3 border-offset-background p-5 md:flex-row md:items-center md:space-x-3 md:space-y-0">
        <div class="w-full">
          <a href="/job-3" class="text-lg font-semibold text-primary hover:underline hover:underline-offset-2">
            Senior Executive - CRM
          </a>
          <p class="text-sm">Minimum 2.0 of experience</p>
          <div class="flex flex-wrap items-center space-x-3">
            <span class="break-all text-sm"> Mumbai </span>
            <div class="h-[6px] w-[6px] rounded-full bg-[#D9D9D9]"></div>
            <span class="break-all text-sm"> In Office </span>
            <div class="h-[6px] w-[6px] rounded-full bg-[#D9D9D9]"></div>
            <span class="break-all text-sm"> Not Specified </span>
          </div>
        </div>
        <div class="flex justify-end">
          <a href="/job-3" class="inline-flex items-center justify-center">Apply</a>
        </div>
      </div>
      <div data-last-page="2" data-current-page="2" data-pagination-container></div>
    </div>
  </body>
</html>
`

const DETAIL_PAGE_1_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Executive - Category &amp; Brand Management | Nykaa Fashion</title>
  </head>
  <body>
    <main data-posting-panel data-current-page="overview">
      <div class="flex w-full flex-col">
        <h1 class="text-2xl font-semibold text-primary">Executive - Category &amp; Brand Management</h1>
        <p class="text-xs text-[#727272]"><span>Posted on </span><span> 3 May 2026 </span></p>
      </div>
      <div class="col-span-12 md:col-span-9">
        <div class="job-description-panel w-full break-words font-normal">
          <p>Role Objective</p>
          <p>Drive category growth across Nykaa Fashion ecommerce.</p>
          <p>Improve customer experience and retention.</p>
          <p>Excel and PPT advanced user.</p>
        </div>
      </div>
      <div class="col-span-12 mt-6 md:col-span-3 md:mt-0">
        <div class="space-y-6 rounded-md bg-offset-background p-4">
          <div class="flex items-center space-x-2"><p class="w-full text-sm font-semibold">Nykaa Fashion</p></div>
          <div class="flex items-center space-x-2"><p class="flex w-full flex-wrap text-sm font-semibold"><span class="break-words text-sm font-semibold"> Bangalore </span></p></div>
          <div class="flex items-center space-x-2"><p class="w-full text-sm font-semibold">1 years Exp.</p></div>
          <div class="flex items-center space-x-2"><p class="w-full text-sm font-semibold">In Office</p></div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const DETAIL_PAGE_2_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Product Manager - Growth</title>
  </head>
  <body>
    <main data-posting-panel data-current-page="overview">
      <div class="flex w-full flex-col">
        <h1 class="text-2xl font-semibold text-primary">Product Manager - Growth</h1>
        <p class="text-xs text-[#727272]"><span>Posted on </span><span> 14 Nov 2025 </span></p>
      </div>
      <div class="col-span-12 md:col-span-9">
        <div class="job-description-panel w-full break-words font-normal">
          <h2><strong>Summary:</strong></h2>
          <p>Lead product growth in Delhi with data-driven product development.</p>
          <h2><strong>Responsibilities</strong></h2>
          <ol>
            <li>Develop and execute strategic product roadmaps.</li>
            <li>Collaborate with engineering and marketing teams.</li>
          </ol>
          <h2><strong>Requirements</strong></h2>
          <ol>
            <li>4 years of experience in product management.</li>
            <li>Excellent communication skills.</li>
          </ol>
        </div>
        <div class="mt-4 flex w-full flex-col items-start">
          <h2 class="w-[130px] shrink-0 text-base font-semibold">Skills</h2>
          <ul class="mt-2 flex w-full flex-wrap">
            <li class="m-0.5 rounded bg-offset-background px-3 py-1 text-xs font-normal text-foreground">Data Analysis</li>
            <li class="m-0.5 rounded bg-offset-background px-3 py-1 text-xs font-normal text-foreground">Strategic Planning</li>
          </ul>
        </div>
      </div>
      <div class="col-span-12 mt-6 md:col-span-3 md:mt-0">
        <div class="space-y-6 rounded-md bg-offset-background p-4">
          <div class="flex items-center space-x-2"><p class="flex w-full flex-wrap text-sm font-semibold"><span class="break-words text-sm font-semibold"> Delhi </span></p></div>
          <div class="flex items-center space-x-2"><p class="w-full text-sm font-semibold">4.0 Exp.</p></div>
          <div class="flex items-center space-x-2"><p class="w-full text-sm font-semibold">In Office</p></div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const DETAIL_PAGE_3_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Senior Executive - CRM</title>
  </head>
  <body>
    <main data-posting-panel data-current-page="overview">
      <div class="flex w-full flex-col">
        <h1 class="text-2xl font-semibold text-primary">Senior Executive - CRM</h1>
        <p class="text-xs text-[#727272]"><span>Posted on </span><span> 10 Jan 2026 </span></p>
      </div>
      <div class="col-span-12 md:col-span-9">
        <div class="job-description-panel w-full break-words font-normal">
          <p>Own CRM campaign execution and retention analytics.</p>
        </div>
      </div>
      <div class="col-span-12 mt-6 md:col-span-3 md:mt-0">
        <div class="space-y-6 rounded-md bg-offset-background p-4">
          <div class="flex items-center space-x-2"><p class="flex w-full flex-wrap text-sm font-semibold"><span class="break-words text-sm font-semibold"> Mumbai </span></p></div>
          <div class="flex items-center space-x-2"><p class="w-full text-sm font-semibold">2.0 Exp.</p></div>
          <div class="flex items-center space-x-2"><p class="w-full text-sm font-semibold">In Office</p></div>
        </div>
      </div>
    </main>
  </body>
</html>
`

test('Nykaa helpers verify the official board, pagination summary, and list-card extraction', async () => {
  const nykaa = await loadNykaaModule()

  assert.equal(nykaa.COMPANY, 'Nykaa')
  assert.equal(nykaa.VERIFIED_ON, '2026-10-09')
  assert.equal(nykaa.OFFICIAL_CAREERS_URL, 'https://careers.nykaa.com/')
  assert.equal(nykaa.PUBLIC_BOARD_URL, 'https://careers.nykaa.com/')
  assert.equal(nykaa.hasOfficialBoardSignal(BOARD_PAGE_1_HTML), true)
  assert.equal(nykaa.buildListingUrl(), 'https://careers.nykaa.com/')
  assert.equal(nykaa.buildListingUrl({ page: 2 }), 'https://careers.nykaa.com/?page=2')
  assert.equal(nykaa.buildJobUrl('job-1'), 'https://careers.nykaa.com/job-1')

  assert.deepEqual(nykaa.extractBoardSummary(BOARD_PAGE_1_HTML), {
    currentPage: 1,
    pageSize: 2,
    totalCount: 3,
    totalPages: 2,
    hasNext: true,
  })

  assert.deepEqual(nykaa.extractSearchResults(BOARD_PAGE_1_HTML), [
    {
      title: 'Executive - Category & Brand Management',
      company: 'Nykaa',
      department: null,
      location: 'Bangalore',
      city: 'Bangalore',
      country: 'India',
      jobId: 'job-1',
      requisitionId: 'job-1',
      sourceUrl: 'https://careers.nykaa.com/job-1',
      applyUrl: 'https://careers.nykaa.com/job-1',
      employmentType: 'Full-time',
      experienceRequired: '1 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
    {
      title: 'Product Manager - Growth',
      company: 'Nykaa',
      department: null,
      location: 'Delhi',
      city: 'Delhi',
      country: 'India',
      jobId: 'job-2',
      requisitionId: 'job-2',
      sourceUrl: 'https://careers.nykaa.com/job-2',
      applyUrl: 'https://careers.nykaa.com/job-2',
      employmentType: 'Full-time',
      experienceRequired: '4 years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('Nykaa detail extraction keeps the structured posting metadata and visible skills stable', async () => {
  const nykaa = await loadNykaaModule()

  const detail = nykaa.extractJobDetail(DETAIL_PAGE_2_HTML, {
    title: 'Product Manager - Growth',
    location: 'Delhi',
    city: 'Delhi',
    country: 'India',
    jobId: 'job-2',
    requisitionId: 'job-2',
    sourceUrl: 'https://careers.nykaa.com/job-2',
    applyUrl: 'https://careers.nykaa.com/job-2',
    employmentType: 'Full-time',
    experienceRequired: '4 years',
  })

  assert.equal(detail.title, 'Product Manager - Growth')
  assert.equal(detail.company, 'Nykaa')
  assert.equal(detail.location, 'Delhi')
  assert.equal(detail.city, 'Delhi')
  assert.equal(detail.country, 'India')
  assert.equal(detail.jobId, 'job-2')
  assert.equal(detail.requisitionId, 'job-2')
  assert.equal(detail.sourceUrl, 'https://careers.nykaa.com/job-2')
  assert.equal(detail.applyUrl, 'https://careers.nykaa.com/job-2')
  assert.equal(detail.employmentType, 'Full-time')
  assert.equal(detail.experienceRequired, '4.0 years')
  assert.equal(detail.postingDate, '2025-11-14')
  assert.match(detail.jobDescription, /Lead product growth in Delhi/i)
  assert.deepEqual(detail.requiredSkills, [
    'Data Analysis',
    'Strategic Planning',
  ])
})

test('Nykaa run validates the official board, paginates, and decorates shared runner fields', async () => {
  const nykaa = await loadNykaaModule()
  const requests = []
  const scraper = nykaa.createNykaaScraper({ maxPages: 2, now: () => FIXED_SCRAPED_AT })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requests.push(url)

      if (url === nykaa.buildListingUrl({ page: 1 })) return BOARD_PAGE_1_HTML
      if (url === nykaa.buildListingUrl({ page: 2 })) return BOARD_PAGE_2_HTML
      if (url === nykaa.buildJobUrl('job-1')) return DETAIL_PAGE_1_HTML
      if (url === nykaa.buildJobUrl('job-2')) return DETAIL_PAGE_2_HTML
      if (url === nykaa.buildJobUrl('job-3')) return DETAIL_PAGE_3_HTML

      throw new Error(`Unexpected Nykaa URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [
    nykaa.buildListingUrl({ page: 1 }),
    nykaa.buildJobUrl('job-1'),
    nykaa.buildJobUrl('job-2'),
    nykaa.buildListingUrl({ page: 2 }),
    nykaa.buildJobUrl('job-3'),
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.city, job.source, job.link, job.scrapedAt]),
    [
      [
        'Executive - Category & Brand Management',
        'Bangalore',
        'nykaa',
        'https://careers.nykaa.com/job-1',
        FIXED_SCRAPED_AT,
      ],
      [
        'Product Manager - Growth',
        'Delhi',
        'nykaa',
        'https://careers.nykaa.com/job-2',
        FIXED_SCRAPED_AT,
      ],
      [
        'Senior Executive - CRM',
        'Mumbai',
        'nykaa',
        'https://careers.nykaa.com/job-3',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.deepEqual(jobs[1].requiredSkills, [
    'Data Analysis',
    'Strategic Planning',
  ])
})

test('Nykaa fails closed when the verified official board no longer matches the trusted public surface', async () => {
  const nykaa = await loadNykaaModule()

  await assert.rejects(
    nykaa.createNykaaScraper().run({
      fetchText: async () => '<html><body><h1>Nykaa</h1></body></html>',
    }),
    /official board/i,
  )
})


test('Nykaa accepts the current official Skima tenant with an explicit empty public inventory', async () => {
  const nykaa = await loadNykaaModule()
  const html = await fs.readFile(new URL('../../scraper/nykaa/fixtures/board-current-empty.html', import.meta.url), 'utf8')
  assert.equal(nykaa.hasOfficialBoardSignal(html), true)
  const jobs = await nykaa.createNykaaScraper().run({ fetchText: async () => html, now: () => FIXED_SCRAPED_AT })
  assert.deepEqual(jobs, [])
  assert.deepEqual(readInventoryEvidence(jobs), {
    status: 'verified-empty', surface: nykaa.PUBLIC_BOARD_URL, firstParty: true, listingComplete: true,
    pagesFetched: 1, reportedTotal: 0, indiaFacetCount: 0, verifiedAt: FIXED_SCRAPED_AT,
    reason: 'official-nykaa-board-explicit-no-job-postings',
  })
})

test('Nykaa current board rejects missing inventory and contradictory visible job cards', async () => {
  const nykaa = await loadNykaaModule()
  const html = await fs.readFile(new URL('../../scraper/nykaa/fixtures/board-current-empty.html', import.meta.url), 'utf8')
  const missingInventory = html.replace('Currently there are no job postings available.', 'Please check back later.')
  const contradictoryInventory = html.replace('Currently there are no job postings available.', 'Currently there are no job postings available. Showing 1 of 1 - Jobs') + BOARD_PAGE_1_HTML
  assert.equal(nykaa.hasOfficialBoardSignal(missingInventory), false)
  assert.equal(nykaa.hasOfficialBoardSignal(contradictoryInventory), false)
  await assert.rejects(nykaa.createNykaaScraper().run({ fetchText: async () => missingInventory }), /official board/i)
  await assert.rejects(nykaa.createNykaaScraper().run({ fetchText: async () => contradictoryInventory }), /official board/i)
})

test('Nykaa fails closed when pagination omits an advertised public opening', async () => {
  const nykaa = await loadNykaaModule()
  const partialFirstPage = BOARD_PAGE_1_HTML.replace('Showing 2 of 3 - Jobs', 'Showing 2 of 4 - Jobs')
  const partialLastPage = BOARD_PAGE_2_HTML.replace('Showing 1 of 3 - Jobs', 'Showing 1 of 4 - Jobs')
  await assert.rejects(nykaa.createNykaaScraper().run({
    fetchText: async (url) => {
      if (url === nykaa.buildListingUrl()) return partialFirstPage
      if (url === nykaa.buildListingUrl({ page: 2 })) return partialLastPage
      if (url === nykaa.buildJobUrl('job-1')) return DETAIL_PAGE_1_HTML
      if (url === nykaa.buildJobUrl('job-2')) return DETAIL_PAGE_2_HTML
      if (url === nykaa.buildJobUrl('job-3')) return DETAIL_PAGE_3_HTML
      throw new Error('Unexpected fixture URL: ' + url)
    },
  }), /advertised public inventory/i)
})

const fetchNykaaInventoryFixture = async (url) => {
  if (url === 'https://careers.nykaa.com/') return BOARD_PAGE_1_HTML
  if (url === 'https://careers.nykaa.com/?page=2') return BOARD_PAGE_2_HTML
  if (url === 'https://careers.nykaa.com/job-1') return DETAIL_PAGE_1_HTML
  if (url === 'https://careers.nykaa.com/job-2') return DETAIL_PAGE_2_HTML
  if (url === 'https://careers.nykaa.com/job-3') return DETAIL_PAGE_3_HTML
  throw new Error('Unexpected fixture URL: ' + url)
}

for (const [label, limits] of [
  ['maxJobs', { maxJobs: 2 }],
  ['maxPages', { maxPages: 1 }],
]) {
  test('Nykaa marks every returned job incomplete when ' + label + ' truncates advertised inventory', async () => {
    const nykaa = await loadNykaaModule()
    const jobs = await nykaa.createNykaaScraper(limits).run({ fetchText: fetchNykaaInventoryFixture })
    assert.deepEqual(jobs.map(job => job.jobId), ['job-1', 'job-2'])
    assert.ok(jobs.every(job => job.sourceListingComplete === false))
    assert.equal(jobs[0].company, 'Nykaa')
    assert.equal(jobs[0].title, 'Executive - Category & Brand Management')
    assert.match(jobs[1].jobDescription, /Lead product growth/)
    assert.deepEqual(jobs[1].requiredSkills, ['Data Analysis', 'Strategic Planning'])
  })
}

test('Nykaa leaves complete inventory flags unchanged when configured limits cover all advertised jobs', async () => {
  const nykaa = await loadNykaaModule()
  const jobs = await nykaa.createNykaaScraper({ maxJobs: 3, maxPages: 2 }).run({ fetchText: fetchNykaaInventoryFixture })
  assert.deepEqual(jobs.map(job => job.jobId), ['job-1', 'job-2', 'job-3'])
  assert.ok(jobs.every(job => job.sourceListingComplete === undefined))
})
