import assert from 'node:assert/strict'
import test from 'node:test'

import {
  buildRequestedSourceDirectoryNames,
  decodePossiblyUtf16Text,
  extractCompletedSourceDirectoryNamesFromPipelineLogText,
  isUncheckedMissingExperienceJob,
  prioritizeBackfillTargets,
  selectUncheckedMissingExperienceJobs,
} from '../scripts/backfillDryRunExperience.js'

test('buildRequestedSourceDirectoryNames resolves logical source ids to dry-run directory names', () => {
  const requestedSources = new Set(['thales', 'abb', 'airbus'])
  const scrapers = [
    {
      name: 'thales',
      dryRunFile: 'C:/repo/jobverify-backend/scraper/thales.workday/jobs.json',
    },
    {
      name: 'abb',
      dryRunFile: 'C:/repo/jobverify-backend/scraper/abb.workday/jobs.json',
    },
    {
      name: 'airbus',
      dryRunFile: 'C:/repo/jobverify-backend/scraper/airbus.workday/jobs.json',
    },
  ]

  const resolved = [...buildRequestedSourceDirectoryNames(requestedSources, scrapers)].sort()

  assert.deepEqual(resolved, [
    'abb',
    'abb.workday',
    'airbus',
    'airbus.workday',
    'thales',
    'thales.workday',
  ])
})

test('prioritizeBackfillTargets preserves explicit requested source order for targeted reruns', () => {
  const targets = [
    { source: 'mindtree', missingBefore: 245 },
    { source: 'cmscomputers', missingBefore: 227 },
    { source: 'questglobal', missingBefore: 227 },
  ]

  const prioritized = prioritizeBackfillTargets(
    targets,
    ['cmscomputers', 'questglobal', 'mindtree'],
  )

  assert.deepEqual(
    prioritized.map((target) => target.source),
    ['cmscomputers', 'questglobal', 'mindtree'],
  )
})

test('isUncheckedMissingExperienceJob only targets jobs that are still unchecked and missing experience', () => {
  assert.equal(isUncheckedMissingExperienceJob({
    experienceRequired: null,
    publicExperienceChecked: false,
  }), true)

  assert.equal(isUncheckedMissingExperienceJob({
    experienceRequired: '5 years',
    publicExperienceChecked: false,
  }), false)

  assert.equal(isUncheckedMissingExperienceJob({
    experienceRequired: null,
    publicExperienceChecked: true,
  }), false)
})

test('selectUncheckedMissingExperienceJobs returns the first unchecked missing jobs up to the requested batch size', () => {
  const jobs = [
    { title: 'verified-missing', experienceRequired: null, publicExperienceChecked: true },
    { title: 'filled', experienceRequired: '2 years', publicExperienceChecked: false },
    { title: 'first-unchecked', experienceRequired: null, publicExperienceChecked: false },
    { title: 'second-unchecked', experienceRequired: '', publicExperienceChecked: false },
    { title: 'third-unchecked', experienceRequired: null, publicExperienceChecked: false },
  ]

  assert.deepEqual(
    selectUncheckedMissingExperienceJobs(jobs, 2).map((job) => job.title),
    ['first-unchecked', 'second-unchecked'],
  )

  assert.deepEqual(
    selectUncheckedMissingExperienceJobs(jobs).map((job) => job.title),
    ['first-unchecked', 'second-unchecked', 'third-unchecked'],
  )
})

test('decodePossiblyUtf16Text reads PowerShell-style UTF-16LE pipeline logs', () => {
  const raw = Buffer.from(
    '\uFEFF\r\n> jobverify-backend@1.0.0 scrape:parallel:dry\r\n[runner] Progress: 17/4833 scrapers finished.\r\n',
    'utf16le',
  )

  const decoded = decodePossiblyUtf16Text(raw)

  assert.match(decoded, /> jobverify-backend@1\.0\.0 scrape:parallel:dry/)
  assert.match(decoded, /\[runner\] Progress: 17\/4833 scrapers finished\./)
})

test('extractCompletedSourceDirectoryNamesFromPipelineLogText captures completed dry-run source directories', () => {
  const logText = [
    '  OK [amadeus] 34 India jobs -> C:\\repo\\jobverify-backend\\scraper\\amadeus.workday\\jobs.json',
    '[runner] Progress: 1/4833 scrapers finished.',
    '  OK [abb] 174 India jobs -> C:\\repo\\jobverify-backend\\scraper\\abb.workday\\jobs.json',
    '  OK [abb] 174 India jobs -> C:\\repo\\jobverify-backend\\scraper\\abb.workday\\jobs.json',
  ].join('\r\n')

  assert.deepEqual(
    extractCompletedSourceDirectoryNamesFromPipelineLogText(logText),
    ['amadeus.workday', 'abb.workday'],
  )
})
