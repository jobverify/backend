import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

// A missing release asset must be detected before a source can open a network
// connection or write an attempt to the database.
const moduleURL = new URL('../scraper-support/utils/recruitmentBatchAssets.js', import.meta.url)
const loadValidator = () => import(moduleURL.href)

test('the complete checkout contains both required source batches', async () => {
  const { validateRecruitmentBatchAssets } = await loadValidator()
  assert.deepEqual(validateRecruitmentBatchAssets().map(row => row.providers), [500, 1033])
})

test('a release missing both batch manifests fails with both actionable paths', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'scraper-assets-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const { validateRecruitmentBatchAssets } = await loadValidator()
  assert.throws(() => validateRecruitmentBatchAssets({ directory }), error => {
    assert.equal(error.code, 'SCRAPER_RUNTIME_ASSET_INVALID')
    assert.equal(error.exitCode, 1)
    assert.match(error.message, /runtime-recruitment-500\.json/)
    assert.match(error.message, /remaining-recruitment-1033\.json/)
    return true
  })
})

test('truncated, duplicate and invalid JSON manifests cannot pass validation', async t => {
  const directory = mkdtempSync(path.join(tmpdir(), 'scraper-assets-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  const { RECRUITMENT_BATCH_ASSETS, validateRecruitmentBatchAssets } = await loadValidator()
  for (const asset of RECRUITMENT_BATCH_ASSETS) {
    writeFileSync(path.join(directory, asset.fileName), JSON.stringify(
      Array.from({ length: asset.expectedCount }, (_, i) => ({
        source: 'source-' + i, companyName: 'Fixture Employer ' + i,
        companyCareerPage: 'https://careers.example.org/',
      })),
    ))
  }
  assert.deepEqual(validateRecruitmentBatchAssets({ directory }).map(row => row.providers), [500, 1033])
  const target = path.join(directory, RECRUITMENT_BATCH_ASSETS[0].fileName)
  for (const body of ['[{', '[]', JSON.stringify(Array.from({ length: 500 }, () => ({ source: 'duplicate' })))]) {
    writeFileSync(target, body)
    assert.throws(() => validateRecruitmentBatchAssets({ directory }), { code: 'SCRAPER_RUNTIME_ASSET_INVALID' })
  }
})

test('asset validation CLI does not start scraping or require database configuration', () => {
  const child = spawnSync(process.execPath, ['scripts/validateScraperRuntimeAssets.js'], {
    cwd: new URL('..', import.meta.url), encoding: 'utf8', timeout: 10000,
    env: { ...process.env, MONGO_URI: '', MONGODB_URI: '' },
  })
  assert.equal(child.status, 0, child.stderr)
  assert.match(child.stdout, /1533/)
  assert.doesNotMatch(child.stdout, /Connecting|bulkWrite|Running .*scraper/i)
})
