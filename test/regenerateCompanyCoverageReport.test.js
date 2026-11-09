import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { regenerateCompanyCoverageReport } from '../scripts/regenerateCompanyCoverageReport.js'

test('regenerateCompanyCoverageReport includes every registered provider when csvPath is omitted', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-regenerate-coverage-default-'))

  try {
    const backendReportPath = path.join(tempDir, 'backend-company-coverage-report.json')
    const frontendReportPath = path.join(tempDir, 'frontend-company-coverage-report.json')

    const summary = regenerateCompanyCoverageReport({
      backendReportPath,
      frontendReportPath,
      catalog: [
        { source: 'alpha', companyName: 'Alpha Inc.' },
        { source: 'beta', companyName: 'Beta Labs' },
        { source: 'gamma', companyName: 'Gamma Systems' },
      ],
      scraperDirectories: ['beta', 'helpers', 'alpha'],
    })

    assert.equal(summary.sourceType, 'provider-catalog')
    assert.equal(summary.totalRows, 3)
    assert.equal(summary.candidateRows, 3)
    assert.equal(summary.matchedCount, 3)
    assert.equal(summary.unmatchedCount, 0)
    assert.deepEqual(summary.unresolvedSample, [])

    const backendReport = JSON.parse(readFileSync(backendReportPath, 'utf8'))
    const frontendReport = JSON.parse(readFileSync(frontendReportPath, 'utf8'))

    assert.deepEqual(frontendReport, backendReport)
    assert.deepEqual(
      backendReport.matched.map((item) => [item.companyName, item.source]),
      [
        ['Alpha Inc.', 'alpha'],
        ['Beta Labs', 'beta'],
        ['Gamma Systems', 'gamma'],
      ],
    )
    assert.deepEqual(backendReport.matched[2].provider, {
      source: 'gamma',
      companyName: 'Gamma Systems',
    })
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('regenerateCompanyCoverageReport writes a fresh report from the provided CSV input', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-regenerate-coverage-'))

  try {
    const csvPath = path.join(tempDir, 'fresh-company-list.csv')
    const backendReportPath = path.join(tempDir, 'backend-company-coverage-report.json')
    const frontendReportPath = path.join(tempDir, 'frontend-company-coverage-report.json')

    writeFileSync(
      csvPath,
      'company_name\nAmazon Development Center\nBanyan Cloud\nWells Fargo Technology\n',
      'utf8',
    )

    const summary = regenerateCompanyCoverageReport({
      csvPath,
      backendReportPath,
      frontendReportPath,
    })

    assert.equal(summary.source, csvPath)
    assert.equal(summary.backendReportPath, backendReportPath)
    assert.equal(summary.frontendReportPath, frontendReportPath)
    assert.equal(summary.totalRows, 3)
    assert.equal(summary.candidateRows, 3)
    assert.equal(summary.matchedCount, 3)
    assert.equal(summary.unmatchedCount, 0)
    assert.deepEqual(summary.unresolvedSample, [])

    const backendReport = JSON.parse(readFileSync(backendReportPath, 'utf8'))
    const frontendReport = JSON.parse(readFileSync(frontendReportPath, 'utf8'))
    const matchedByCompanyName = new Map(
      backendReport.matched.map((item) => [item.companyName, item.source]),
    )

    assert.deepEqual(frontendReport, backendReport)
    assert.equal(matchedByCompanyName.get('Amazon Development Center'), 'amazon')
    assert.equal(matchedByCompanyName.get('Banyan Cloud'), 'banyancloud')
    assert.equal(matchedByCompanyName.get('Wells Fargo Technology'), 'wellsfargotechnology')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('regenerateCompanyCoverageReport writes only the backend report by default', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-regenerate-coverage-backend-only-'))

  try {
    const csvPath = path.join(tempDir, 'fresh-company-list.csv')
    const backendReportPath = path.join(tempDir, 'backend-company-coverage-report.json')

    writeFileSync(
      csvPath,
      'company_name\nAmazon Development Center\nBanyan Cloud\n',
      'utf8',
    )

    const summary = regenerateCompanyCoverageReport({
      csvPath,
      backendReportPath,
    })

    assert.equal(summary.backendReportPath, backendReportPath)
    assert.equal(summary.frontendReportPath, null)
    assert.equal(summary.matchedCount, 2)
    assert.equal(summary.unmatchedCount, 0)

    const backendReport = JSON.parse(readFileSync(backendReportPath, 'utf8'))
    const matchedByCompanyName = new Map(
      backendReport.matched.map((item) => [item.companyName, item.source]),
    )

    assert.equal(matchedByCompanyName.get('Amazon Development Center'), 'amazon')
    assert.equal(matchedByCompanyName.get('Banyan Cloud'), 'banyancloud')
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})

test('regenerateCompanyCoverageReport CLI prints a JSON summary and supports explicit output paths', () => {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), 'jobverify-regenerate-coverage-cli-'))

  try {
    const csvPath = path.join(tempDir, 'fresh-company-list.csv')
    const backendReportPath = path.join(tempDir, 'backend-company-coverage-report.json')
    const frontendReportPath = path.join(tempDir, 'frontend-company-coverage-report.json')
    const backendDir = path.resolve(import.meta.dirname, '..')

    writeFileSync(
      csvPath,
      'company_name\nAmazon Development Center\nBanyan Cloud\nWells Fargo Technology\n',
      'utf8',
    )

    const stdout = execFileSync(
      process.execPath,
      [
        'scripts/regenerateCompanyCoverageReport.js',
        csvPath,
        backendReportPath,
        frontendReportPath,
      ],
      {
        cwd: backendDir,
        encoding: 'utf8',
      },
    )

    const summary = JSON.parse(stdout)
    assert.equal(summary.source, csvPath)
    assert.equal(summary.backendReportPath, backendReportPath)
    assert.equal(summary.frontendReportPath, frontendReportPath)
    assert.equal(summary.matchedCount, 3)
    assert.equal(summary.unmatchedCount, 0)

    const backendReport = JSON.parse(readFileSync(backendReportPath, 'utf8'))
    const frontendReport = JSON.parse(readFileSync(frontendReportPath, 'utf8'))
    assert.deepEqual(frontendReport, backendReport)
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
})
