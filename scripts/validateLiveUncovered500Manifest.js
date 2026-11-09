import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  generateCompanyCoverageReport,
  getCompanyAliasMap,
  normalizeCompanyName,
} from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')

export const LIVE_UNCOVERED_500_MANIFEST_NAME = 'live-uncovered-500-2026-07-28'
export const LIVE_UNCOVERED_500_VERIFIED_ON = '2026-07-28'
export const DEFAULT_LIVE_UNCOVERED_500_EXPECTED_COUNT = 500
export const DEFAULT_LIVE_UNCOVERED_500_MANIFEST_PATH = path.join(
  backendDir,
  'artifacts',
  'workbook-batches',
  `${LIVE_UNCOVERED_500_MANIFEST_NAME}.json`,
)

export const LIVE_UNCOVERED_500_REQUIRED_FIELDS = [
  'companyName',
  'normalizedCompanyName',
  'companyDomain',
  'officialCareersUrl',
  'officialJobsListingUrl',
  'sampleLiveJobTitle',
  'sampleLiveJobUrl',
  'sampleLiveJobLocation',
  'indiaHiringEvidence',
  'verifiedOn',
  'verificationNotes',
  'discoverySource',
]

const escapeCsvValue = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`

const normalizeString = (value) => String(value ?? '').trim()

const isHttpUrl = (value) => /^https?:\/\//i.test(normalizeString(value))

export const findDuplicateValues = (values = []) => {
  const counts = new Map()
  for (const rawValue of values) {
    const value = normalizeString(rawValue)
    if (!value) continue
    counts.set(value, (counts.get(value) || 0) + 1)
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((left, right) => left.localeCompare(right))
}

export const collectMissingRequiredFields = (companies = []) =>
  companies.flatMap((entry, index) =>
    LIVE_UNCOVERED_500_REQUIRED_FIELDS
      .filter((field) => normalizeString(entry?.[field]).length === 0)
      .map((field) => `${normalizeString(entry?.companyName) || `row-${index + 1}`}:${field}`),
  )

export const collectInvalidUrlFields = (companies = []) =>
  companies.flatMap((entry, index) => {
    const label = normalizeString(entry?.companyName) || `row-${index + 1}`
    return [
      ['officialCareersUrl', entry?.officialCareersUrl],
      ['officialJobsListingUrl', entry?.officialJobsListingUrl],
      ['sampleLiveJobUrl', entry?.sampleLiveJobUrl],
    ]
      .filter(([, value]) => normalizeString(value) && !isHttpUrl(value))
      .map(([field]) => `${label}:${field}`)
  })

const buildCoverageCsv = (companies = []) =>
  ['company_name', ...companies.map((entry) => escapeCsvValue(entry?.companyName))]
    .join('\n')
    .concat('\n')

const uniqueSorted = (values = []) => [...new Set(values.filter(Boolean))]
  .sort((left, right) => left.localeCompare(right))

export const loadLiveUncovered500Manifest = ({
  manifestPath = DEFAULT_LIVE_UNCOVERED_500_MANIFEST_PATH,
} = {}) => JSON.parse(readFileSync(path.resolve(manifestPath), 'utf8'))

export const validateLiveUncovered500Manifest = ({
  manifest,
  catalog = getScraperCatalog(),
  aliasMap = getCompanyAliasMap(),
  expectedCount = DEFAULT_LIVE_UNCOVERED_500_EXPECTED_COUNT,
} = {}) => {
  const companies = Array.isArray(manifest?.companies) ? manifest.companies : []
  const missingRequiredFields = collectMissingRequiredFields(companies)
  const invalidUrlFields = collectInvalidUrlFields(companies)
  const duplicateNormalizedCompanyNames = findDuplicateValues(
    companies.map((entry) => entry?.normalizedCompanyName),
  )
  const duplicateCareersUrls = findDuplicateValues(
    companies.map((entry) => entry?.officialCareersUrl),
  )
  const duplicateJobUrls = findDuplicateValues(
    companies.map((entry) => entry?.sampleLiveJobUrl),
  )
  const invalidNormalizedNames = uniqueSorted(
    companies
      .filter(
        (entry) =>
          normalizeString(entry?.companyName)
          && normalizeString(entry?.normalizedCompanyName) !== normalizeCompanyName(entry?.companyName),
      )
      .map((entry) => entry.companyName),
  )
  const invalidVerifiedOn = uniqueSorted(
    companies
      .filter((entry) => normalizeString(entry?.verifiedOn) !== LIVE_UNCOVERED_500_VERIFIED_ON)
      .map((entry) => entry.companyName),
  )

  const coverageReport = generateCompanyCoverageReport({
    csvText: buildCoverageCsv(companies),
    catalog,
    aliasMap,
  })
  const coveredCompanies = uniqueSorted(coverageReport.matched.map((entry) => entry.companyName))

  const summary = {
    manifestName: manifest?.manifestName ?? null,
    verifiedOn: manifest?.verifiedOn ?? null,
    expectedCount,
    totalCompanies: companies.length,
    duplicateNormalizedCompanyNames,
    duplicateCareersUrls,
    duplicateJobUrls,
    coveredCompanies,
    invalidNormalizedNames,
    invalidVerifiedOn,
    missingRequiredFields,
    invalidUrlFields,
  }

  const errors = []

  if (manifest?.manifestVersion !== 1) {
    errors.push(`manifestVersion must equal 1, received ${JSON.stringify(manifest?.manifestVersion ?? null)}`)
  }
  if (manifest?.manifestName !== LIVE_UNCOVERED_500_MANIFEST_NAME) {
    errors.push(
      `manifestName must equal ${LIVE_UNCOVERED_500_MANIFEST_NAME}, received ${JSON.stringify(manifest?.manifestName ?? null)}`,
    )
  }
  if (manifest?.verifiedOn !== LIVE_UNCOVERED_500_VERIFIED_ON) {
    errors.push(
      `verifiedOn must equal ${LIVE_UNCOVERED_500_VERIFIED_ON}, received ${JSON.stringify(manifest?.verifiedOn ?? null)}`,
    )
  }
  if (!Array.isArray(manifest?.companies)) {
    errors.push('companies must be an array')
  }
  if (companies.length !== expectedCount) {
    errors.push(`companies must contain exactly ${expectedCount} entries, received ${companies.length}`)
  }
  if (duplicateNormalizedCompanyNames.length > 0) {
    errors.push(
      `duplicate normalized company names: ${duplicateNormalizedCompanyNames.join(', ')}`,
    )
  }
  if (duplicateCareersUrls.length > 0) {
    errors.push(`duplicate careers URLs: ${duplicateCareersUrls.join(', ')}`)
  }
  if (duplicateJobUrls.length > 0) {
    errors.push(`duplicate sample job URLs: ${duplicateJobUrls.join(', ')}`)
  }
  if (coveredCompanies.length > 0) {
    errors.push(`covered companies: ${coveredCompanies.join(', ')}`)
  }
  if (invalidNormalizedNames.length > 0) {
    errors.push(`invalid normalized company names: ${invalidNormalizedNames.join(', ')}`)
  }
  if (invalidVerifiedOn.length > 0) {
    errors.push(`invalid row verifiedOn values: ${invalidVerifiedOn.join(', ')}`)
  }
  if (missingRequiredFields.length > 0) {
    errors.push(`missing required fields: ${missingRequiredFields.join(', ')}`)
  }
  if (invalidUrlFields.length > 0) {
    errors.push(`invalid URL fields: ${invalidUrlFields.join(', ')}`)
  }

  return { errors, summary }
}

export const runLiveUncovered500ManifestValidation = (options = {}) => {
  const manifest = loadLiveUncovered500Manifest(options)
  const result = validateLiveUncovered500Manifest({
    ...options,
    manifest,
  })

  if (result.errors.length > 0) {
    throw new Error(
      `Live uncovered 500 manifest validation failed:\n- ${result.errors.join('\n- ')}`,
    )
  }

  return result.summary
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const cliManifestPath = process.argv[2]
      ? path.resolve(process.cwd(), process.argv[2])
      : undefined
    const summary = runLiveUncovered500ManifestValidation({
      manifestPath: cliManifestPath,
    })
    console.log(JSON.stringify(summary, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
