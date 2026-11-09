import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { generateDedicatedScraperFolderBackfill } from '../scripts/generateDedicatedScraperFolderBackfill.js'

test('generateDedicatedScraperFolderBackfill writes dedicated providers, aliases, and folders', () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), 'workbook-generator-'))
  const backendDir = path.join(repoDir, 'jobverify-backend')
  const providerExtensionDir = path.join(backendDir, 'scraper-support', 'providers', 'providerExtensions')
  const aliasExtensionDir = path.join(backendDir, 'scraper-support', 'providers', 'companyAliasExtensions')
  const scraperBaseDir = path.join(backendDir, 'scraper')
  const coveragePath = path.join(repoDir, 'coverage.csv')
  const outputManifestPath = path.join(providerExtensionDir, 'zz-dedicated-scraper-folder-backfill.json')
  const outputAliasPath = path.join(aliasExtensionDir, 'zz-workbook-dedicated.json')

  mkdirSync(providerExtensionDir, { recursive: true })
  mkdirSync(aliasExtensionDir, { recursive: true })
  mkdirSync(path.join(scraperBaseDir, 'workbookbatch07'), { recursive: true })

  writeFileSync(path.join(coveragePath), 'company,source,has_backend_scraper_folder,coverage_type\n', 'utf8')
  writeFileSync(
    path.join(providerExtensionDir, 'workbook-batch-07-a.json'),
    `${JSON.stringify([
      {
        source: 'banyancloud',
        companyName: 'Banyan Cloud',
        adapter: 'script',
        modulePath: '../workbookbatch07/failClosedSentinel.js',
        dryRunFile: 'workbookbatch07/banyancloud.jobs.json',
        atsPlatform: 'workbook-exact-name-sentinel',
      },
    ], null, 2)}\n`,
    'utf8',
  )
  writeFileSync(path.join(providerExtensionDir, 'zz-dedicated-scraper-folder-backfill.json'), '[]\n', 'utf8')
  writeFileSync(
    path.join(aliasExtensionDir, 'workbook-batch-07.json'),
    `${JSON.stringify({ 'Banyan Cloud Careers': 'banyancloud' }, null, 2)}\n`,
    'utf8',
  )
  writeFileSync(
    path.join(scraperBaseDir, 'workbookbatch07', 'failClosedSentinel.js'),
    'export const createFailClosedSentinelScraper = () => ({ async run() { return [] } })\nexport const run = async () => []\n',
    'utf8',
  )

  const result = generateDedicatedScraperFolderBackfill({
    coveragePath,
    outputManifestPath,
    outputAliasPath,
    providerExtensionDir,
    aliasExtensionDir,
    scraperBaseDir,
  })

  const manifest = JSON.parse(readFileSync(outputManifestPath, 'utf8'))
  const aliases = JSON.parse(readFileSync(outputAliasPath, 'utf8'))

  assert.equal(result.generatedSourceCount, 1)
  assert.equal(result.aliasCount, 1)
  assert.equal(manifest.length, 1)
  assert.deepEqual(aliases, { 'Banyan Cloud Careers': 'banyancloud' })
  assert.equal(existsSync(path.join(scraperBaseDir, 'banyancloud', 'script.js')), true)
  assert.equal(existsSync(path.join(scraperBaseDir, 'banyancloud', 'failClosedSentinel.js')), true)
  assert.equal(existsSync(path.join(scraperBaseDir, 'banyancloud', 'jobs.json')), true)
})
