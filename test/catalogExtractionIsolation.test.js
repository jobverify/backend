import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { createHash } from 'node:crypto'
import { runIsolatedExtraction } from '../scripts/auditCatalogExtractions.js'

const backend = fileURLToPath(new URL('../', import.meta.url))
const parent = path.join(backend, '.tmp')
fs.mkdirSync(parent, { recursive: true })

async function withFixture(code, callback) {
  const directory = fs.mkdtempSync(path.join(parent, 'extraction-isolation-'))
  try {
    const modulePath = path.join(directory, 'fixture.mjs')
    fs.writeFileSync(modulePath, code)
    await callback({ directory, provider: { adapter: 'script', source: 'fixture', companyName: 'Fixture', modulePath } })
  } finally {
    const resolved = path.resolve(directory)
    assert.ok(resolved.startsWith(path.resolve(parent) + path.sep))
    fs.rmSync(resolved, { recursive: true, force: true })
  }
}

test('isolated extraction cannot write outside its source artifact directory', async () => {
  await withFixture(`import fs from 'node:fs'; export const run = async () => { fs.writeFileSync(new URL('./forbidden.txt', import.meta.url), 'changed'); return [] }`, async ({ directory, provider }) => {
    const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
    assert.equal(row.outcome, 'audit-permission-blocked')
    assert.equal(fs.existsSync(path.join(directory, 'forbidden.txt')), false)
  })
})

test('isolated extraction rejects database access before a source can connect', async () => {
  await withFixture(`import mongoose from 'mongoose'; export const run = async () => { await mongoose.connect('mongodb://127.0.0.1:27017/should-never-connect'); return [] }`, async ({ directory, provider }) => {
    const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
    assert.equal(row.outcome, 'extraction-failed')
    assert.equal(row.failureCode, 'AUDIT_DATABASE_BLOCKED')
    assert.equal(row.failureKind, 'audit_database_blocked')
  })
})

test('native fetch failure is reported from bounded underlying evidence with unknown qualified counts', async t => {
  const fixture = `export const run = async () => {
    const error = new Error('Arrow native collection incomplete; cleanup forbidden');
    error.nativeEvidence = {observedListingCount: 3, jobs: [{rawHTML:'PRIVATE_JOB'}], cleanupAllowed: false,
      failures:[{stage:'binding-pagination-or-closure', name:'Error',message:'Arrow native transport: fetch failed'}],
      transportPackets:[{status:null,headers:{cookie:'PRIVATE_COOKIE'},bodyBase64:'PRIVATE_BODY',
        failure:{name:'TypeError',message:'fetch failed',cause:{name:'ConnectTimeoutError',message:'Connect Timeout Error',code:'UND_ERR_CONNECT_TIMEOUT'}}}]};
    throw error;
  }`
  await withFixture(fixture, async ({ directory, provider }) => {
    const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
    assert.equal(row.failureKind, 'network_or_timeout')
    assert.equal(row.outcome, 'extraction-failed')
    for (const key of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'inventoryEvidence']) assert.equal(row[key], null)
    assert.equal(row.failureEvidence.observedListingCount, 3)
    assert.equal(row.failureEvidence.partialJobsLength, 1)
    assert.equal(row.failureEvidence.cleanupAllowed, false)
    assert.equal(row.failureEvidence.inventoryComplete, false)
    assert.equal(row.failureEvidence.firstParty, null)
    assert.equal(row.failureEvidence.reasons[0].cause.code, 'UND_ERR_CONNECT_TIMEOUT')
    assert.doesNotMatch(JSON.stringify(row), /PRIVATE_|bodyBase64|rawHTML|headers/)
    t.diagnostic(`Synthetic offline worker row: ${JSON.stringify(row)}`)
  })
})

test('an empty successful return without evidence stays unverified', async () => {
  await withFixture('export const run = async () => []', async ({ directory, provider }) => {
    const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
    assert.equal(row.outcome, 'unverified-zero')
    assert.equal(row.inventoryEvidence?.listingComplete, undefined)
    assert.equal(row.mode, 'isolated-direct-live-extraction-no-database')
    assert.equal(row.productionWrites, false)
  })
})

test('native parser failures retain hash-checked bodies in the permitted artifact directory only', async () => {
  const body = Buffer.from('<html><main>Changed first-party listing layout</main></html>')
  const packet = { url: 'https://careers.example.test/jobs', status: 200,
    headers: { 'content-type': 'text/html', cookie: 'PRIVATE_COOKIE' }, bodyBytes: body.length,
    bodySHA256: createHash('sha256').update(body).digest('hex'), rawBodyBase64: body.toString('base64'),
    requestedAt: '2026-10-22T17:13:01.000Z', completedAt: '2026-10-22T17:13:04.000Z' }
  await withFixture(`export const run = async () => { const error = new Error('Native parser incomplete'); error.nativeEvidence = {retainedResponses:[${JSON.stringify(packet)}], failures:[{stage:'native-pagination',message:'Missing native wrapper'}]}; throw error }`, async ({ directory, provider }) => {
    const outputDirectory = path.join(directory, 'output')
    const row = await runIsolatedExtraction(provider, { outputDirectory })
    assert.equal(row.outcome, 'extraction-failed')
    for (const key of ['rawJobs', 'indiaJobs', 'eligibleJobs']) assert.equal(row[key], null)
    assert.equal(row.retainedFailureEvidence.retainedResponses, 1)
    const bytes = fs.readFileSync(path.join(outputDirectory, row.retainedFailureEvidence.filename))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), row.retainedFailureEvidence.sha256)
    const artifact = JSON.parse(bytes)
    assert.equal(artifact.retainedResponses[0].rawBodyBase64, body.toString('base64'))
    assert.equal(artifact.retainedResponses[0].completedAt, packet.completedAt)
    assert.equal(artifact.verifiedZeroInventory, false)
    assert.doesNotMatch(JSON.stringify(artifact), /PRIVATE_COOKIE/)
    assert.doesNotMatch(JSON.stringify(row), /rawBodyBase64|Changed first-party/)
  })
})

test('complete listing evidence cannot conceal missing native descriptions or explicit detail failures', async () => {
  const helper = new URL('../scraper-support/utils/inventoryEvidence.js', import.meta.url).href
  for (const variant of [
    { jobDescription: '' },
    { jobDescription: 'Build production software services.', sourceDetailComplete: false, sourceDetailFailureKind: 'upstream' },
    { jobDescription: 'Build production software services.', sourceListingComplete: false },
  ]) {
    const fixture = `import {attachInventoryEvidence} from ${JSON.stringify(helper)};
      export const run = async () => attachInventoryEvidence([{title:'Software Engineer',company:'Fixture',source:'fixture',location:'Bengaluru, India',country:'India',link:'https://careers.fixture.test/jobs/123',...${JSON.stringify(variant)}}],
      {status:'complete-inventory',firstParty:true,listingComplete:true,pagesFetched:1,reportedTotal:1,indiaFacetCount:1,surface:'https://careers.fixture.test/jobs',verifiedAt:new Date().toISOString()})`
    await withFixture(fixture, async ({ directory, provider }) => {
      const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
      assert.equal(row.outcome, 'positive-extraction-incomplete-evidence')
      assert.equal(row.inventoryEvidence.listingComplete, true)
      assert.equal(row.detailHealth.complete, false)
      assert.equal(row.detailHealth.incompleteJobs, 1)
    })
  }
})

test('a complete native listing with complete descriptions has healthy detail diagnostics', async () => {
  const helper = new URL('../scraper-support/utils/inventoryEvidence.js', import.meta.url).href
  const fixture = `import {attachInventoryEvidence} from ${JSON.stringify(helper)};
    export const run = async () => attachInventoryEvidence([{title:'Software Engineer',company:'Fixture',source:'fixture',location:'Bengaluru, India',country:'India',link:'https://careers.fixture.test/jobs/123',jobDescription:'Build production software services.'}],
    {status:'complete-inventory',firstParty:true,listingComplete:true,pagesFetched:1,reportedTotal:1,indiaFacetCount:1,surface:'https://careers.fixture.test/jobs',verifiedAt:new Date().toISOString()})`
  await withFixture(fixture, async ({ directory, provider }) => {
    const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
    assert.equal(row.outcome, 'complete-positive-extraction')
    assert.deepEqual(row.detailHealth, { complete: true, inspectedJobs: 1, incompleteJobs: 0, missingDescriptions: 0, failureKinds: {} })
  })
})

test('timed out audits record the actual attempt and unknown counts', async () => {
  await withFixture('export const run = async () => new Promise(resolve => setTimeout(() => resolve([]), 5000))', async ({directory, provider}) => {
    const row = await runIsolatedExtraction(provider, {outputDirectory: path.join(directory, 'output'), timeoutMs: 1000})
    assert.equal(row.outcome, 'extraction-timeout')
    assert.ok(Number.isFinite(new Date(row.attemptedAt).getTime()))
    assert.ok(new Date(row.completedAt) >= new Date(row.attemptedAt))
    assert.equal(row.productionWrites, false)
    assert.equal(row.rawJobs, null)
    assert.equal(row.inventoryEvidence, null)
  })
})

test('a source process exit preserves its exit code and leaves inventory unknown', async () => {
  await withFixture('export const run = async () => process.exit(7)', async ({ directory, provider }) => {
    const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
    assert.equal(row.outcome, 'audit-process-exited-without-result')
    assert.deepEqual(row.auditProcessExit, { exitCode: 7, signal: null })
    for (const key of ['rawJobs', 'indiaJobs', 'eligibleJobs', 'inventoryEvidence']) assert.equal(row[key], null)
  })
})

test('partial native extraction reports observed listing rows separately from extracted jobs', async () => {
  const helper = new URL('../scraper-support/utils/inventoryEvidence.js', import.meta.url).href
  const code = `import {attachInventoryEvidence} from ${JSON.stringify(helper)};
    export const run = async () => attachInventoryEvidence([
      {title:'Software Engineer',company:'Fixture',source:'fixture',country:'India',location:'Bengaluru, India',sourceUrl:'https://careers.fixture.test/jobs/1',jobDescription:'Build production software services.',sourceListingComplete:false,nativeCollectionEvidence:{source:'fixture',observedListingCount:7}},
      {title:'Data Engineer',company:'Fixture',source:'fixture',country:'India',location:'Bengaluru, India',sourceUrl:'https://careers.fixture.test/jobs/2',jobDescription:'Build production data pipelines.',sourceListingComplete:false}
    ],{status:'coverage-gap',firstParty:true,listingComplete:false,reportedTotal:null,surface:'https://careers.fixture.test/jobs',pagesFetched:1})`
  await withFixture(code, async ({ directory, provider }) => {
    const row = await runIsolatedExtraction(provider, { outputDirectory: path.join(directory, 'output') })
    assert.equal(row.outcome, 'positive-extraction-incomplete-evidence')
    assert.equal(row.rawJobs, 7)
    assert.equal(row.extractedJobs, 2)
    assert.equal(row.rawJobsBasis, 'observed-native-listing-rows')
    assert.equal(row.inventoryEvidence.reportedTotal, null)
    assert.equal(row.inventoryEvidence.listingComplete, false)
  })
})
