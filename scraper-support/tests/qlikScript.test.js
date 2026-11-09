import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('../../scraper/qlik/script.js')
  } catch {
    assert.fail('Expected Qlik scraper module at ../../scraper/qlik/script.js')
  }
}

test('Qlik defaultFetchJson surfaces a 403 from the Eightfold API', async () => {
  const qlik = await loadModule()
  const originalFetch = globalThis.fetch

  globalThis.fetch = async () => ({
    ok: false,
    status: 403,
    headers: new Headers(),
  })

  try {
    await assert.rejects(
      qlik.defaultFetchJson('https://careerhub.qlik.com/api/pcsx/search?domain=qlik.com', {
        attempts: 1,
        baseDelayMs: 0,
      }),
      /HTTP 403 for https:\/\/careerhub\.qlik\.com\/api\/pcsx\/search\?domain=qlik\.com/,
    )
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('Qlik returns an aggregate signal job when the first Eightfold listing request is hard-blocked', async () => {
  const qlik = await loadModule()
  const seenUrls = []

  const jobs = await qlik.createQlikScraper({
    now: () => '2026-08-13T18:00:00.000Z',
  }).run({
    fetchJson: async (url) => {
      seenUrls.push(url)
      throw new Error(`HTTP 403 for ${url}`)
    },
  })

  assert.equal(seenUrls.length, 1)
  assert.equal(new URL(seenUrls[0]).searchParams.get('limit'), '50')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Current openings at Qlik')
  assert.equal(jobs[0].link, 'https://careerhub.qlik.com/careers?domain=qlik.com')
  assert.equal(jobs[0].jobId, 'qlik-current-openings')
  assert.match(jobs[0].jobDescription, /Eightfold inventory API returned HTTP 403/i)
  assert.equal(jobs[0].scrapedAt, '2026-08-13T18:00:00.000Z')
})

test('Qlik skips malformed India-filtered positions and keeps valid jobs', async () => {
  const qlik = await loadModule()

  const jobs = await qlik.createQlikScraper({
    pageSize: 3,
    now: () => '2026-07-31T00:00:00.000Z',
  }).run({
    fetchJson: async (url) => {
      if (url.includes('position_details')) {
        const positionId = new URL(url).searchParams.get('position_id')
        return {
          data: {
            publicUrl: `https://careerhub.qlik.com/careers/job/${positionId}`,
            jobDescription: `<p>Detail for ${positionId}</p>`,
          },
        }
      }

      return {
        data: {
          count: 3,
          positions: [
            {
              id: '1',
              displayJobId: 'REQ-1',
              name: 'Platform Engineer',
              locations: ['Bangalore, Karnataka, India'],
              department: 'Engineering',
            },
            {
              id: '2',
              displayJobId: 'REQ-2',
              name: '',
              locations: ['Bangalore, Karnataka, India'],
              department: 'Engineering',
            },
            {
              id: '3',
              displayJobId: 'REQ-3',
              name: 'Foreign Leakage',
              locations: ['Warsaw, Poland'],
              department: 'Engineering',
            },
          ],
        },
      }
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, '1')
  assert.equal(jobs[0].sourceUrl, 'https://careerhub.qlik.com/careers/job/1')
})

test('Qlik recognizes India jobs when the live payload uses standardized IN country codes', async () => {
  const qlik = await loadModule()

  const jobs = await qlik.createQlikScraper({
    pageSize: 2,
    now: () => '2026-08-01T00:00:00.000Z',
  }).run({
    fetchJson: async (url) => {
      if (url.includes('position_details')) {
        const positionId = new URL(url).searchParams.get('position_id')
        return {
          data: {
            publicUrl: `https://careerhub.qlik.com/careers/job/${positionId}`,
            jobDescription: `<p>Detail for ${positionId}</p>`,
          },
        }
      }

      return {
        data: {
          count: 2,
          positions: [
            {
              id: '11',
              displayJobId: 'Q26022',
              name: 'Principal Solution Architect',
              locations: ['Delhi'],
              standardizedLocations: ['DL,IN'],
              workLocationOption: 'onsite',
            },
            {
              id: '12',
              displayJobId: 'Q26023',
              name: 'Principal Solution Architect',
              locations: ['Mumbai'],
              standardizedLocations: ['Mumbai, MH, IN'],
              workLocationOption: 'hybrid',
            },
          ],
        },
      }
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({ jobId: job.jobId, location: job.location, remoteStatus: job.remoteStatus })),
    [
      { jobId: '11', location: 'Delhi', remoteStatus: 'On-site' },
      { jobId: '12', location: 'Mumbai', remoteStatus: 'Hybrid' },
    ],
  )
})

test('Qlik standalone dry-run writes jobs.json when invoked as the entry script', async () => {
  const qlik = await loadModule()
  const savedFiles = []
  const jobs = [{ jobId: 'Q26022', title: 'Principal Solution Architect' }]

  const result = await qlik.runStandalone({
    argv: ['node', 'C:/repo/jobverify-backend/scraper/qlik/script.js', '--dry-run'],
    modulePath: 'C:/repo/jobverify-backend/scraper/qlik/script.js',
    outputFile: 'C:/repo/jobverify-backend/scraper/qlik/jobs.json',
    runScraper: async () => jobs,
    saveToFile: (savedJobs, outputFile) => {
      savedFiles.push({ savedJobs, outputFile })
    },
    saveToDB: async () => {
      assert.fail('Qlik dry-run should not write to DB')
    },
    consoleImpl: {
      log: () => {},
    },
  })

  assert.deepEqual(result, jobs)
  assert.deepEqual(savedFiles, [
    {
      savedJobs: jobs,
      outputFile: 'C:/repo/jobverify-backend/scraper/qlik/jobs.json',
    },
  ])
})
