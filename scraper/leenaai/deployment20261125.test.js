import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { run } from './script.js'
import { validateCurrentPublisher } from './nativeCurrentWorkable.js'
import { readInventoryEvidence, sourceLifecycleCleanupForbidden } from '../../scraper-support/utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261125/native-capture.json.gz', import.meta.url))))
const CAREERS = 'https://leena.ai/careers'
const CLIENT = 'https://leena.ai/_next/static/chunks/pages/careers-15090a0f10f8bc12.js'
const FEED = 'https://bots.leena.ai/api/website/careers/jobs'
const ACCOUNT = 'https://apply.workable.com/api/v1/accounts/leena-ai'
const body = receipt => {
  const value = Buffer.from(receipt.bodyBase64, 'base64')
  assert.equal(value.length, receipt.bytes)
  assert.equal(createHash('sha256').update(value).digest('hex'), receipt.sha256)
  return value.toString('utf8')
}
const replay = (change = (_url, value) => value) => {
  const counts = new Map(), calls = []
  return { calls, options: { now: () => fixture.capturedAt, fetchImpl: async (input, init) => {
    const url = String(input), rows = fixture.responses.filter(row => row.requestedUrl === url)
    const count = counts.get(url) || 0
    assert.equal(init.method, 'GET')
    assert.ok(count < rows.length, 'Only current retained public responses may be read: ' + url)
    counts.set(url, count + 1); calls.push(url)
    const receipt = rows[count]
    return Object.defineProperty(new Response(change(url, body(receipt)), { status: receipt.status, headers: receipt.headers }),
      'url', { value: receipt.responseUrl })
  } } }
}

test('current Leena publisher deployment retains the unchanged career factory across both native observations', () => {
  const pages = fixture.responses.filter(row => row.requestedUrl === CAREERS)
  const client = body(fixture.responses.find(row => row.requestedUrl === CLIENT))
  const opening = validateCurrentPublisher(body(pages[0]), client)
  const closing = validateCurrentPublisher(body(pages[1]), client)
  assert.equal(opening.bundleSHA256, 'c41f4d7591956790cb2731b7f0b54d8ca1eb893667ca66afd0cfe6e48f339596')
  assert.equal(opening.corporateProfileSHA256, '4923cd40cdd3725d94edae24337c4db17f634271818886f0de80d095752191b7')
  assert.equal(closing.corporateProfileSHA256, opening.corporateProfileSHA256)
  assert.notEqual(opening.corporateSHA256, closing.corporateSHA256)
  assert.equal(opening.browserEquivalenceClaimed, false)
})

test('current Leena acquisition reconciles six India details and retains five qualified roles with the unresolved criteria original', async () => {
  const io = replay(), jobs = await run(io.options)
  assert.equal(jobs.length, 5)
  assert.equal(io.calls.length, 20)
  assert.equal(jobs.nativeCollectionEvidence.observedRecordCount, 13)
  assert.equal(jobs.nativeCollectionEvidence.selectedTypedIndiaCount, 6)
  assert.equal(jobs.nativeCollectionEvidence.heldCount, 1)
  assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal, null)
  assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal, null)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  for (const job of jobs) {
    const detail = JSON.parse(body(fixture.responses.find(row => row.requestedUrl.endsWith('/jobs/' + job.jobId))))
    assert.deepEqual(job.sourceNativeModel, detail)
    assert.deepEqual(job.sourceNativeCriteria, {
      description: detail.description, requirements: detail.requirements, benefits: detail.benefits,
    })
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.country, 'India')
    assert.equal(job.company, 'Leena AI')
  }
  const unresolved = jobs.nativeCollectionEvidence.held.find(row => row.shortcode === '34C41A27A6')
  assert.match(unresolved.heldReason, /requirements unreviewed authored carrier/)
  const paid = unresolved.model
  assert.deepEqual(paid, JSON.parse(body(fixture.responses.find(row => row.requestedUrl.endsWith('/jobs/34C41A27A6')))))
  assert.equal(paid.salary_from, 1200000)
  assert.equal(paid.salary_to, 1900000)
  assert.equal(paid.salary_currency_iso_code, 'INR')
  assert.equal(paid.salary_frequency, 'year')
})

test('current Leena deployment cannot authorize an unknown app, fixed style change, or changed career factory', async () => {
  for (const mode of ['app', 'style', 'factory']) {
    const io = replay((url, value) => url === CAREERS && mode !== 'factory'
      ? mode === 'app' ? value.replace('_app-c833e639eb496d96', '_app-c834e639eb496d96') : value.replace('#0F72EE', '#0F72EF')
      : url === CLIENT && mode === 'factory' ? value + ';window.unreviewedCareers=true;' : value)
    await assert.rejects(run(io.options), error => error.failureKind === 'parser_or_contract_error')
    assert.equal(io.calls.includes(FEED), false)
  }
})

test('current Leena deployment still requires the reciprocal native account identity', async () => {
  const io = replay((url, value) => {
    if (url !== ACCOUNT) return value
    const account = JSON.parse(value); account.uid = '00000000-0000-0000-0000-000000000000'
    return JSON.stringify(account)
  })
  await assert.rejects(run(io.options), /account reciprocal identity/)
})

test('current Leena deployment holds a native country conflict instead of relabelling it as an India role', async () => {
  const io = replay((url, value) => {
    if (!url.endsWith('/jobs/68D93DAEF4')) return value
    const detail = JSON.parse(value)
    detail.location.country = 'United States'; detail.location.countryCode = 'US'
    return JSON.stringify(detail)
  })
  const jobs = await run(io.options)
  assert.equal(jobs.length, 4)
  assert.equal(jobs.some(job => job.jobId === '68D93DAEF4'), false)
  assert.equal(jobs.nativeCollectionEvidence.heldCount, 2)
  assert.match(jobs.nativeCollectionEvidence.held.find(row => row.shortcode === '68D93DAEF4').heldReason, /country contradiction/)
  assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
})

test('current Leena salary fields cannot authorize partial, contradictory, or unreviewed compensation data', async () => {
  for (const edit of [
    row => { delete row.salary_frequency },
    row => { row.salary_from = '1200000' },
    row => { row.salary_from = -1 },
    row => { row.salary_to = 1000000 },
    row => { row.salary_currency_iso_code = 'USD' },
    row => { row.salary_frequency = 'month' },
    row => { row.unreviewedEligibility = { condition: 'New condition' } },
  ]) {
    const io = replay((url, value) => {
      if (!url.endsWith('/jobs/34C41A27A6')) return value
      const row = JSON.parse(value); edit(row); return JSON.stringify(row)
    })
    await assert.rejects(run(io.options), error => error.failureKind === 'parser_or_contract_error')
  }
})

test('unreviewed authored links and changed linked criteria remain held with their original native models', async () => {
  for (const mode of ['text', 'url']) {
    const io = replay((url, value) => {
      if (!url.endsWith('/jobs/34C41A27A6')) return value
      const row = JSON.parse(value)
      row.requirements = mode === 'text'
        ? row.requirements.replace('></a>', '>Additional linked eligibility</a>')
        : row.requirements.replace('https://www.google.com/search', 'https://unreviewed.example/criteria')
      return JSON.stringify(row)
    })
    const jobs = await run(io.options)
    assert.equal(jobs.length, 5)
    assert.equal(jobs.some(job => job.jobId === '34C41A27A6'), false)
    assert.equal(jobs.nativeCollectionEvidence.heldCount, 1)
    assert.equal(sourceLifecycleCleanupForbidden(jobs), true)
  }
})
