import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { materializeWorkbookProvider } from '../scripts/lib/workbookDedicatedFolderMaterializer.js'

test('materializeWorkbookProvider writes dedicated live and generated empty folders', () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), 'workbook-materializer-'))
  const scraperDir = path.join(repoDir, 'scraper')
  const providerBaseDir = path.join(scraperDir, 'providers')
  mkdirSync(path.join(scraperDir, 'workbookbatch02'), { recursive: true })
  mkdirSync(path.join(scraperDir, 'workbookbatch04'), { recursive: true })
  mkdirSync(providerBaseDir, { recursive: true })

  writeFileSync(
    path.join(scraperDir, 'workbookbatch02', 'sampleemployer.js'),
    "import { helper } from './helper.js'\nexport const run = async () => [{ title: helper() }]\n",
    'utf8',
  )
  writeFileSync(
    path.join(scraperDir, 'workbookbatch02', 'helper.js'),
    "export const helper = () => 'ok'\n",
    'utf8',
  )
  writeFileSync(
    path.join(scraperDir, 'workbookbatch04', 'verifiedCareersEmptyState.js'),
    'export const createVerifiedCareersEmptyStateScraper = () => ({ async run() { return [] } })\nexport const run = async () => []\n',
    'utf8',
  )

  const liveResult = materializeWorkbookProvider(
    {
      source: 'sampleemployer',
      modulePath: '../sampleemployer/script.js',
      originalModulePath: '../workbookbatch02/sampleemployer.js',
      dryRunFile: 'workbookbatch02/sampleemployer.jobs.json',
      atsPlatform: 'verified-public-careers-cards',
    },
    { scraperDir, repoDir },
  )

  const emptyResult = materializeWorkbookProvider(
    {
      source: 'adpushup',
      modulePath: '../adpushup/script.js',
      originalModulePath: '../workbookbatch04/verifiedCareersEmptyState.js',
      dryRunFile: 'workbookbatch02/adpushup.jobs.json',
      atsPlatform: 'verified-first-party-careers-empty-result',
      companyName: 'AdPushup',
      companyCareerPage: 'https://www.adpushup.com/careers/',
    },
    { scraperDir, repoDir },
  )

  assert.equal(readFileSync(path.join(liveResult.sourceDirectory, 'script.js'), 'utf8').includes("title: helper()"), true)
  assert.equal(existsSync(path.join(liveResult.sourceDirectory, 'helper.js')), true)
  assert.equal(existsSync(path.join(liveResult.sourceDirectory, 'jobs.json')), true)
  assert.equal(readFileSync(path.join(emptyResult.sourceDirectory, 'script.js'), 'utf8').includes('createVerifiedCareersEmptyStateScraper'), true)
  assert.equal(existsSync(path.join(emptyResult.sourceDirectory, 'verifiedCareersEmptyState.js')), true)
  assert.equal(existsSync(path.join(emptyResult.sourceDirectory, 'jobs.json')), true)
})

test('materializeWorkbookProvider can refresh already-dedicated folders after legacy batch files are removed', () => {
  const repoDir = mkdtempSync(path.join(os.tmpdir(), 'workbook-materializer-local-'))
  const scraperDir = path.join(repoDir, 'scraper')
  const liveDir = path.join(scraperDir, 'sampleemployer')
  const generatedDir = path.join(scraperDir, 'adpushup')

  mkdirSync(liveDir, { recursive: true })
  mkdirSync(generatedDir, { recursive: true })

  writeFileSync(
    path.join(liveDir, 'script.js'),
    "import { helper } from './helper.js'\nexport const run = async () => [{ title: helper() }]\n",
    'utf8',
  )
  writeFileSync(path.join(liveDir, 'helper.js'), "export const helper = () => 'ok'\n", 'utf8')
  writeFileSync(
    path.join(generatedDir, 'verifiedCareersEmptyState.js'),
    'export const createVerifiedCareersEmptyStateScraper = () => ({ async run() { return [] } })\nexport const run = async () => []\n',
    'utf8',
  )

  materializeWorkbookProvider(
    {
      source: 'sampleemployer',
      modulePath: '../sampleemployer/script.js',
      originalModulePath: '../workbookbatch02/sampleemployer.js',
      atsPlatform: 'verified-public-careers-cards',
    },
    { scraperDir, repoDir },
  )

  materializeWorkbookProvider(
    {
      source: 'adpushup',
      modulePath: '../adpushup/script.js',
      originalModulePath: '../workbookbatch04/verifiedCareersEmptyState.js',
      atsPlatform: 'verified-first-party-careers-empty-result',
      companyName: 'AdPushup',
    },
    { scraperDir, repoDir },
  )

  assert.equal(readFileSync(path.join(liveDir, 'script.js'), 'utf8').includes("title: helper()"), true)
  assert.equal(existsSync(path.join(liveDir, 'helper.js')), true)
  assert.equal(readFileSync(path.join(generatedDir, 'script.js'), 'utf8').includes('createVerifiedCareersEmptyStateScraper'), true)
  assert.equal(existsSync(path.join(generatedDir, 'verifiedCareersEmptyState.js')), true)
})
