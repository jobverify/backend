import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { extractWorkdayStructuredDetail, runWorkdayScraper } from '../myworkday/engine.js'

const baseUrl = 'https://native-dates.wd12.myworkdayjobs.com/External'
const externalPath = '/job/Mumbai-India/Engineer_R-2298'
const nativePosting = (overrides = {}) => ({
  title: 'Engineer', jobReqId: 'R-2298', location: 'Mumbai, India',
  country: { alpha2Code: 'IN' }, externalUrl: baseUrl + externalPath,
  jobDescription: '<p>Build reliable software. Two years of professional experience required.</p>',
  ...overrides,
})

const replay = (t, { native = {}, postedOn = 'Today', locationsText = 'Mumbai, India', runOptions = {}, waitForHtmlAbort = false } = {}) => {
  const reads = { htmlDetails: 0 }
  t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
    if (init.method === 'POST') return Response.json({ total: 1, jobPostings: [{
      title: 'Engineer', externalPath, locationsText, postedOn,
    }] })
    if (String(url).includes('/wday/cxs/') && String(url).includes('/job/')) {
      return Response.json({ jobPostingInfo: nativePosting(native) })
    }
    if (String(url).includes('/job/')) {
      reads.htmlDetails++
      if (waitForHtmlAbort) return new Promise((_resolve, reject) => {
        if (init.signal.aborted) reject(init.signal.reason)
        else init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })
      })
      return new Response('<script type="application/ld+json">{"@type":"JobPosting","datePosted":"2026-10-24","description":"Fresh HTML fallback description"}</script>')
    }
    return new Response('<html>Workday careers</html>')
  })
  return { reads, run: () => runWorkdayScraper({
    company: 'Native Dates', source: 'native-dates', baseUrl,
    scraperDir: fileURLToPath(new URL('../myworkday', import.meta.url)),
    requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} },
    retryBaseDelayMs: 0,
    ...runOptions,
  }) }
}

test('native publication and closing calendars retain raw dates and calendar precision', () => {
  const detail = extractWorkdayStructuredDetail({ jobPostingInfo: nativePosting({
    startDate: '2024-02-29', endDate: '2026-10-28',
  }) })
  assert.equal(detail.postingDate, '2024-02-29')
  assert.equal(detail.closingDate, '2026-10-28')
  assert.equal(detail.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
  assert.deepEqual(detail.sourceRawDates, { startDate: '2024-02-29', endDate: '2026-10-28' })
  assert.equal(detail.postingDatePrecision, 'calendar-date')
  assert.equal(detail.closingDatePrecision, 'calendar-date')
  assert.equal(detail.sourcePostingDateIsExact, false)
  assert.equal(detail.sourceClosingDateIsExact, false)
})

for (const field of ['startDate', 'endDate']) {
  for (const value of ['2026-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '2026-01-00',
    '2026-10-01T24:00:00Z', '2026-10-01T12:60:00Z', '2026-10-01T12:00:60Z',
    '2026-10-01T12:00:00+24:00', '2026-10-01T12:00:00+05:60',
    '2026-10-01T12:00:00', 'October 1, 2026', '', ' 2026-10-01 ', 123, {}, true]) {
    test(`invalid native ${field} ${JSON.stringify(value)} fails closed`, () => {
      assert.throws(() => extractWorkdayStructuredDetail({ jobPostingInfo: nativePosting({ [field]: value }) }), {
        name: 'WorkdayNativeLifecycleDateError', code: 'WORKDAY_NATIVE_DATE_INVALID', field,
        failureKind: 'parser_or_contract_error', abortRetries: true,
      })
    })
  }
}

test('a malformed supplied native date cannot be hidden by a missing description', () => {
  assert.throws(() => extractWorkdayStructuredDetail({ jobPostingInfo: {
    startDate: '2026-02-30', jobDescription: null,
  } }), { code: 'WORKDAY_NATIVE_DATE_INVALID' })
})

test('native calendars beat stale listing-relative labels after the IST day boundary', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-24T20:00:00Z'))
  const fixture = replay(t, { native: { startDate: '2026-06-29', endDate: '2026-10-28' },
    postedOn: 'Posted 30+ Days Ago' })
  const [job] = await fixture.run()
  assert.equal(job.postedAt.toISOString(), '2026-06-29T00:00:00.000Z')
  assert.equal(job.postingDate, '2026-06-29')
  assert.equal(job.closingDate.toISOString(), '2026-10-28T00:00:00.000Z')
  assert.equal(job.sourcePostingDateIsExact, false)
  assert.equal(job.sourceClosingDateIsExact, false)
  assert.equal(job.postingDatePrecision, 'calendar-date')
  assert.equal(job.closingDatePrecision, 'calendar-date')
  assert.deepEqual(job.sourceRawDates, { startDate: '2026-06-29', endDate: '2026-10-28' })
  assert.equal(job.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
})

test('zoned native clocks preserve their actual instant and exact precision', async t => {
  const startDate = '2026-10-21T00:15:30.125+05:30'
  const endDate = '2026-10-28T23:59:59-04:00'
  const fixture = replay(t, { native: { startDate, endDate } })
  const [job] = await fixture.run()
  assert.equal(job.postedAt.toISOString(), '2026-10-20T18:45:30.125Z')
  assert.equal(job.closingDate.toISOString(), '2026-10-29T03:59:59.000Z')
  assert.deepEqual(job.sourceRawDates, { startDate, endDate })
  assert.equal(job.postingDatePrecision, 'timestamp')
  assert.equal(job.closingDatePrecision, 'timestamp')
  assert.equal(job.sourcePostingDateIsExact, true)
  assert.equal(job.sourceClosingDateIsExact, true)
})

for (const native of [{ startDate: '2026-02-30' }, { endDate: '2026-10-01T24:00:00Z' }]) {
  test(`a malformed optional native ${Object.keys(native)[0]} never falls through HTML or listing data`, async t => {
    const fixture = replay(t, { native })
    await assert.rejects(fixture.run, { code: 'WORKDAY_NATIVE_DATE_INVALID' })
    assert.equal(fixture.reads.htmlDetails, 0)
  })
}

test('a malformed required-scope native date also rejects the inventory', async t => {
  const fixture = replay(t, { native: { startDate: '2026-02-30', additionalLocations: ['Bengaluru, India'] }, locationsText: '2 Locations' })
  await assert.rejects(fixture.run, { code: 'WORKDAY_NATIVE_DATE_INVALID' })
  assert.equal(fixture.reads.htmlDetails, 0)
})

test('a same-role native requisition ID fills a hyphenated URL ID', async t => {
  const fixture = replay(t)
  const [job] = await fixture.run()
  assert.equal(job.jobId, 'R-2298')
})

for (const conflict of [{ jobReqId: 'R-0000' }, { title: 'Other role' },
  { externalUrl: baseUrl + '/job/Mumbai-India/Other_R-2298' }]) {
  test(`conflicting native ${Object.keys(conflict)[0]} cannot supply another role's dates or description`, async t => {
    const fixture = replay(t, { native: { ...conflict, startDate: '2026-06-29', endDate: '2026-10-28' } })
    await assert.rejects(fixture.run, { code: 'WORKDAY_NATIVE_ROLE_MISMATCH' })
    assert.equal(fixture.reads.htmlDetails, 0)
  })
}

test('native dates without a verified role identity cannot replace the listing date', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-24T20:00:00Z'))
  const fixture = replay(t, { native: { jobReqId: null, startDate: '2026-06-29', endDate: '2026-10-28' },
    postedOn: 'Posted 3 Days Ago' })
  const [job] = await fixture.run()
  assert.equal(job.jobId, null)
  assert.equal(job.postedAt.toISOString(), '2026-10-22T00:00:00.000Z')
  assert.equal(job.closingDate, null)
  assert.equal(job.sourceDateProvenance, undefined)
  assert.equal(job.sourceRawDates, undefined)
})

test('valid native clocks survive HTML description hydration', async t => {
  const fixture = replay(t, { native: {
    startDate: '2026-06-29', endDate: '2026-10-28', jobDescription: '',
  } })
  const [job] = await fixture.run()
  assert.equal(job.postedAt.toISOString(), '2026-06-29T00:00:00.000Z')
  assert.equal(job.closingDate.toISOString(), '2026-10-28T00:00:00.000Z')
  assert.match(job.jobDescription, /Fresh HTML fallback description/)
  assert.equal(job.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
  assert.deepEqual(job.sourceRawDates, { startDate: '2026-06-29', endDate: '2026-10-28' })
  assert.equal(job.jobId, 'R-2298')
})

test('required-scope native clocks survive a disabled optional description budget', async t => {
  const fixture = replay(t, { native: {
    startDate: '2026-06-29', endDate: '2026-10-28', jobDescription: '',
    additionalLocations: ['Bengaluru, India'],
  }, locationsText: '2 Locations', runOptions: { detailEnrichmentBudgetMs: 0 } })
  const [job] = await fixture.run()
  assert.equal(job.postedAt.toISOString(), '2026-06-29T00:00:00.000Z')
  assert.equal(job.closingDate.toISOString(), '2026-10-28T00:00:00.000Z')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
  assert.deepEqual(job.sourceRawDates, { startDate: '2026-06-29', endDate: '2026-10-28' })
})

test('native clocks already received survive an expired HTML hydration budget', async t => {
  const fixture = replay(t, { native: {
    startDate: '2026-06-29', endDate: '2026-10-28', jobDescription: '',
  }, runOptions: { detailEnrichmentBudgetMs: 100 }, waitForHtmlAbort: true })
  const [job] = await fixture.run()
  assert.equal(job.postedAt.toISOString(), '2026-06-29T00:00:00.000Z')
  assert.equal(job.closingDate.toISOString(), '2026-10-28T00:00:00.000Z')
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
})

test('missing optional native clocks preserve an exact listing-relative day', async t => {
  t.mock.method(Date, 'now', () => Date.parse('2026-10-24T20:00:00Z'))
  const fixture = replay(t, { native: { startDate: null, endDate: null }, postedOn: 'Posted 3 Days Ago' })
  const [job] = await fixture.run()
  assert.equal(job.postedAt.toISOString(), '2026-10-22T00:00:00.000Z')
  assert.equal(job.closingDate, null)
  assert.equal(job.sourceDateProvenance, undefined)
})

test('a listing-relative lower bound never becomes a fabricated exact day', async t => {
  const fixture = replay(t, { postedOn: 'Posted 30+ Days Ago' })
  const [job] = await fixture.run()
  assert.equal(job.postedAt, null)
  assert.equal(job.postingDatePrecision, 'relative-lower-bound')
  assert.equal(job.sourceListingPostedOn, 'Posted 30+ Days Ago')
})


test('an optional leading native URL locale preserves the verified same-role clocks and ID', async t => {
  const fixture = replay(t, { native: {
    startDate: '2026-06-29', endDate: '2026-10-28',
    externalUrl: baseUrl.replace('/External', '/en-US/External') + externalPath,
  } })
  const [job] = await fixture.run()
  assert.equal(job.jobId, 'R-2298')
  assert.equal(job.postedAt.toISOString(), '2026-06-29T00:00:00.000Z')
  assert.equal(job.closingDate.toISOString(), '2026-10-28T00:00:00.000Z')
  assert.equal(job.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
})

for (const externalUrl of [
  baseUrl.replace('/External', '/OtherBoard') + externalPath,
  baseUrl + '/job/Mumbai-India/Other_R-2298',
  baseUrl.replace('native-dates.wd12', 'other.wd12') + externalPath,
  baseUrl.replace('https://', 'https://user:secret@') + externalPath,
  baseUrl + externalPath + '?jobReqId=R-0000',
  baseUrl + externalPath + '#other-role',
  baseUrl.replace('https:', 'http:') + externalPath,
  baseUrl + '/en-US' + externalPath,
]) {
  test(`native URL identity rejects a changed origin, board, role, credentials or suffix: ${externalUrl}`, async t => {
    const fixture = replay(t, { native: { startDate: '2026-06-29', externalUrl } })
    await assert.rejects(fixture.run, { code: 'WORKDAY_NATIVE_ROLE_MISMATCH' })
    assert.equal(fixture.reads.htmlDetails, 0)
  })
}

for (const scenario of [
  { fixture: 'blackberry-native.json', board: 'BlackBerry', company: 'BlackBerry', scraperDir: '../../scraper/blackberry.workday',
    baseUrl: 'https://bb.wd3.myworkdayjobs.com/en-US/BlackBerry',
    dates: { '20250320': '2026-09-18' } },
  { fixture: 'blackrock-m11-native.json', company: 'BlackRock', scraperDir: '../../scraper/blackrock.workday/boards/india-fallback',
    baseUrl: 'https://blackrock.wd1.myworkdayjobs.com/en-US/BlackRock_Professional',
    dates: { R261168: '2026-10-01', R261170: '2026-10-01', R260416: '2026-09-25' } },
]) {
  test(`actual ${scenario.company} native packets verify the same role across an omitted leading locale`, async t => {
    const captured = JSON.parse(readFileSync(new URL('./fixtures/discovery-workday-007/' + scenario.fixture, import.meta.url), 'utf8'))
    const board = scenario.board ? captured.boards[scenario.board] : captured
    t.mock.method(globalThis, 'fetch', async (url, init = {}) => {
      if (init.method === 'POST') {
        assert.equal(JSON.parse(init.body).offset, 0)
        return Response.json(board.listing)
      }
      if (String(url).includes('/wday/cxs/') && String(url).includes('/job/')) {
        const path = new URL(url).pathname.match(/\/job\/.+$/)?.[0]
        assert.ok(board.details[path], 'Only a captured native role may be requested')
        return Response.json(board.details[path])
      }
      assert.ok(!String(url).includes('/job/'), 'Verified native role must not require HTML fallback')
      return new Response('<html>Workday careers</html>')
    })
    const jobs = await runWorkdayScraper({
      company: scenario.company, source: scenario.company.toLowerCase(), baseUrl: scenario.baseUrl,
      scraperDir: fileURLToPath(new URL(scenario.scraperDir, import.meta.url)),
      requestScheduler: { acquire: async () => () => {}, recordRateLimit() {} }, retryBaseDelayMs: 0,
    })
    assert.deepEqual(jobs.map(job => job.jobId).sort(), Object.keys(scenario.dates).sort())
    for (const job of jobs) {
      assert.equal(job.postedAt.toISOString(), scenario.dates[job.jobId] + 'T00:00:00.000Z')
      assert.equal(job.sourceDateProvenance, 'workday-cxs-jobPostingInfo')
    }
  })
}
