import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import {
  getScraperCatalog,
  loadProviderExtensions,
} from '../scraper-support/providers/index.js'

test('loadProviderExtensions merges sorted JSON files into a single provider list', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-provider-extensions-'))

  try {
    writeFileSync(
      path.join(tempDir, 'b-second.json'),
      `${JSON.stringify([
        {
          source: 'testscriptbeta',
          companyName: 'Test Script Beta',
          adapter: 'script',
          modulePath: '../testscriptbeta/script.js',
          companyCareerPage: 'https://beta.example/careers',
          verifiedOn: '2026-07-25',
        },
      ], null, 2)}\n`,
      'utf8',
    )
    writeFileSync(
      path.join(tempDir, 'a-first.json'),
      `${JSON.stringify([
        {
          source: 'testworkdayalpha',
          companyName: 'Test Workday Alpha',
          adapter: 'workday',
          baseUrl: 'https://alpha.wd1.myworkdayjobs.com/Alpha',
          companyCareerPage: 'https://alpha.example/careers',
        },
      ], null, 2)}\n`,
      'utf8',
    )

    const providers = loadProviderExtensions(tempDir)

    assert.deepEqual(
      providers.map((provider) => provider.source),
      ['testworkdayalpha', 'testscriptbeta'],
    )
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('getScraperCatalog includes providers loaded from extension files', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-provider-catalog-'))

  try {
    writeFileSync(
      path.join(tempDir, 'a-first.json'),
      `${JSON.stringify([
        {
          source: 'testworkdayalpha',
          companyName: 'Test Workday Alpha',
          adapter: 'workday',
          baseUrl: 'https://alpha.wd1.myworkdayjobs.com/Alpha',
          companyCareerPage: 'https://alpha.example/careers',
        },
        {
          source: 'testscriptbeta',
          companyName: 'Test Script Beta',
          adapter: 'script',
          modulePath: '../testscriptbeta/script.js',
          companyCareerPage: 'https://beta.example/careers',
          verifiedOn: '2026-07-25',
          verifiedSurfaceSummary: 'Verified on Saturday, July 25, 2026 that Beta uses a script provider.',
        },
      ], null, 2)}\n`,
      'utf8',
    )

    const catalog = getScraperCatalog({ providerExtensionDir: tempDir })
    const workdayProvider = catalog.find((provider) => provider.source === 'testworkdayalpha')
    const scriptProvider = catalog.find((provider) => provider.source === 'testscriptbeta')

    assert.ok(workdayProvider)
    assert.equal(workdayProvider.adapter, 'workday')
    assert.equal(workdayProvider.baseUrl, 'https://alpha.wd1.myworkdayjobs.com/Alpha')
    assert.equal(workdayProvider.companyDomain, 'alpha.example')

    assert.ok(scriptProvider)
    assert.equal(scriptProvider.adapter, 'script')
    assert.match(scriptProvider.modulePath, /testscriptbeta[\\/]script\.js$/)
    assert.equal(scriptProvider.companyDomain, 'beta.example')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('getScraperCatalog prefers the later extension entry when sources collide', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-provider-catalog-dedupe-'))

  try {
    writeFileSync(
      path.join(tempDir, 'a-first.json'),
      `${JSON.stringify([
        {
          source: 'duplicate-source',
          companyName: 'First Duplicate',
          adapter: 'script',
          modulePath: '../duplicate-first/script.js',
          companyCareerPage: 'https://first.example/careers',
          atsPlatform: 'shared-first',
        },
      ], null, 2)}\n`,
      'utf8',
    )
    writeFileSync(
      path.join(tempDir, 'z-last.json'),
      `${JSON.stringify([
        {
          source: 'duplicate-source',
          companyName: 'Last Duplicate',
          adapter: 'script',
          modulePath: '../duplicate-last/script.js',
          companyCareerPage: 'https://last.example/careers',
          atsPlatform: 'dedicated-last',
        },
      ], null, 2)}\n`,
      'utf8',
    )

    const catalog = getScraperCatalog({ providerExtensionDir: tempDir })
    const duplicates = catalog.filter((provider) => provider.source === 'duplicate-source')

    assert.equal(duplicates.length, 1)
    assert.equal(duplicates[0].companyName, 'Last Duplicate')
    assert.equal(duplicates[0].atsPlatform, 'dedicated-last')
    assert.match(duplicates[0].modulePath, /duplicate-last[\\/]script\.js$/)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
