import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { loadRecruitmentBatchAsset, RECRUITMENT_BATCH_ASSETS } from '../utils/recruitmentBatchAssets.js'

const asset = RECRUITMENT_BATCH_ASSETS.find(row => row.name === 'runtime')
const fixture = () => Array.from({ length: 500 }, (_, i) => ({
  source: 'schema-source-' + i,
  companyName: 'Schema Employer ' + i,
  companyCareerPage: 'https://careers.example.org/',
}))
function writeFixture(t, providers) {
  const directory = mkdtempSync(path.join(tmpdir(), 'recruitment-schema-'))
  t.after(() => rmSync(directory, { recursive: true, force: true }))
  writeFileSync(path.join(directory, asset.fileName), JSON.stringify(providers))
  return directory
}

for (const [label, change] of [
  ['source-only records', row => ({ source: row.source })],
  ['a blank employer name', row => ({ ...row, companyName: '  ' })],
  ['no official surface', row => ({ ...row, companyCareerPage: null })],
  ['an HTTP-only official surface', row => ({ ...row, companyCareerPage: 'http://careers.example.org/' })],
  ['an unparseable official surface', row => ({ ...row, companyCareerPage: 'not a URL' })],
  ['a local official surface', row => ({ ...row, companyCareerPage: 'https://localhost/' })],
  ['a credential-bearing official surface', row => ({ ...row, companyCareerPage: 'https://user:pass@careers.example.org/' })],
  ['an unofficial port', row => ({ ...row, companyCareerPage: 'https://careers.example.org:8443/' })],
]) {
  test('preflight rejects ' + label + ' before admitting a recruitment source', t => {
    const providers = fixture()
    providers[42] = change(providers[42])
    const directory = writeFixture(t, providers)
    assert.throws(() => loadRecruitmentBatchAsset('runtime', { directory }), error => {
      assert.equal(error.code, 'SCRAPER_RUNTIME_ASSET_INVALID')
      assert.equal(error.abortRetries, true)
      assert.match(error.message, /schema-source-42/)
      return true
    })
  })
}

test('preflight retains a usable explicit HTTPS homepage when the careers URL is unavailable', t => {
  const providers = fixture()
  providers[42] = { ...providers[42], companyCareerPage: null, officialHomepageUrl: 'https://employer.example.org/' }
  const directory = writeFixture(t, providers)
  assert.deepEqual(loadRecruitmentBatchAsset('runtime', { directory })[42], providers[42])
})

test('preflight retains the existing HTTPS company-domain fallback without inventing a career page', t => {
  const providers = fixture()
  providers[42] = { ...providers[42], companyCareerPage: null, companyDomain: 'employer.example.org' }
  const directory = writeFixture(t, providers)
  assert.deepEqual(loadRecruitmentBatchAsset('runtime', { directory })[42], providers[42])
})
