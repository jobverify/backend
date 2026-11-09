import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const POLICY_PRIORITY = Object.freeze({
  'coverage-gap': 0,
  'discovery-only': 1,
  'evidence-required': 2,
})

const toNonNegativeInteger = (value, fallback = 0) => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : fallback
}

const toWorkbookRank = (value) => {
  const number = Number(value)
  return Number.isSafeInteger(number) && number >= 0 ? number : null
}

const inferPolicy = (provider, source) => {
  if (POLICY_PRIORITY[provider?.zeroResultPolicy] != null) {
    return provider.zeroResultPolicy
  }
  // Historical run-state source ids must remain classifiable after their
  // discovery adapters are retired from the current provider catalog.
  if (/\.(?:himalayas\.app|wellfoundDirectory)$/i.test(source)) {
    return 'discovery-only'
  }
  if (/sentinel|snapshot|static-empty|coverage-gap/i.test([
    provider?.atsPlatform,
    provider?.verificationDisposition,
    provider?.extractionStrategy,
    provider?.backfillMode,
  ].filter(Boolean).join(' '))) return 'coverage-gap'
  return 'evidence-required'
}

const priorityReasonFor = (policy) => {
  if (policy === 'coverage-gap') {
    return 'Coverage gap: this source cannot prove that its zero represents the official inventory.'
  }
  if (policy === 'discovery-only') {
    return 'Discovery only: directory/search coverage cannot authorize an empty lifecycle.'
  }
  return 'Evidence required: a zero needs fresh complete first-party inventory evidence.'
}

const verificationSortValue = (verifiedOn) => {
  const time = Date.parse(verifiedOn || '')
  return Number.isFinite(time) ? time : Number.NEGATIVE_INFINITY
}

const normalizeCoverageRows = (coverageRows) => {
  if (Array.isArray(coverageRows)) return coverageRows
  return Array.isArray(coverageRows?.matched) ? coverageRows.matched : []
}

const isRemediableZeroResult = (result = {}) => (
  toNonNegativeInteger(result.jobs) === 0
  && (result.success === true || result.failureKind === 'coverage_gap')
)

export const buildZeroInventoryRemediationReport = ({
  runState,
  coverageRows = [],
  providers = [],
}) => {
  const completed = runState?.completed
  if (!completed || typeof completed !== 'object' || Array.isArray(completed)) {
    throw new TypeError('runState.completed must be an object')
  }

  const coverageBySource = new Map(normalizeCoverageRows(coverageRows)
    .filter((row) => row?.source)
    .map((row) => [row.source, row]))
  const providerBySource = new Map(providers
    .filter((provider) => provider?.source)
    .map((provider) => [provider.source, provider]))

  const rows = Object.entries(completed)
    .filter(([, entry]) => isRemediableZeroResult(entry?.result))
    .map(([source, entry]) => {
      const coverage = coverageBySource.get(source) || {}
      const currentProvider = providerBySource.get(source)
      const provider = {
        ...(coverage.provider || {}),
        ...(currentProvider || {}),
      }
      const zeroResultPolicy = inferPolicy(provider, source)
      const indiaJobs = toNonNegativeInteger(entry.result.jobs)
      const filteredNonIndia = toNonNegativeInteger(entry.result.filteredNonIndia)
      const rawRecords = Number.isSafeInteger(entry.result.rawRecords)
        ? Math.max(0, entry.result.rawRecords)
        : indiaJobs + filteredNonIndia

      return {
        source,
        companyName: currentProvider?.companyName
          || coverage.companyName
          || coverage.provider?.companyName
          || provider.company
          || source,
        zeroResultPolicy,
        adapter: provider.adapter || null,
        atsPlatform: provider.atsPlatform || null,
        workbookRank: toWorkbookRank(coverage.workbookRank ?? coverage.row),
        verifiedOn: provider.verifiedOn || null,
        companyCareerPage: provider.companyCareerPage || provider.baseUrl || null,
        rawRecords,
        priorityReason: priorityReasonFor(zeroResultPolicy),
      }
    })
    .sort((left, right) => (
      (POLICY_PRIORITY[left.zeroResultPolicy] ?? Number.MAX_SAFE_INTEGER)
        - (POLICY_PRIORITY[right.zeroResultPolicy] ?? Number.MAX_SAFE_INTEGER)
      || (left.workbookRank ?? Number.MAX_SAFE_INTEGER)
        - (right.workbookRank ?? Number.MAX_SAFE_INTEGER)
      || verificationSortValue(left.verifiedOn) - verificationSortValue(right.verifiedOn)
      || left.source.localeCompare(right.source)
    ))

  const countPolicy = (policy) => rows.filter(
    ({ zeroResultPolicy }) => zeroResultPolicy === policy,
  ).length
  const rawNonIndiaRows = rows.filter(({ rawRecords }) => rawRecords > 0)

  return {
    summary: {
      zeroIndia: rows.length,
      rawZero: rows.length - rawNonIndiaRows.length,
      rawNonIndiaOnly: rawNonIndiaRows.length,
      rawNonIndiaRecords: rawNonIndiaRows.reduce(
        (total, { rawRecords }) => total + rawRecords,
        0,
      ),
      coverageGap: countPolicy('coverage-gap'),
      discoveryOnly: countPolicy('discovery-only'),
      evidenceRequired: countPolicy('evidence-required'),
    },
    rows,
  }
}

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'))

const readCliOptions = (argv) => {
  const valueFor = (name) => {
    const index = argv.indexOf(name)
    return index >= 0 ? argv[index + 1] : null
  }
  return {
    runStatePath: valueFor('--run-state'),
    coveragePath: valueFor('--coverage') || 'company_coverage_report.json',
    outputPath: valueFor('--output'),
  }
}

const main = async () => {
  const { runStatePath, coveragePath, outputPath } = readCliOptions(process.argv.slice(2))
  if (!runStatePath || !outputPath) {
    throw new Error('Usage: node scripts/reportZeroInventoryRemediation.js --run-state <path> [--coverage <path>] --output <path>')
  }

  const [{ getScraperCatalog }, runState, coverageRows] = await Promise.all([
    import('../scraper-support/providers/index.js'),
    Promise.resolve(readJson(path.resolve(runStatePath))),
    Promise.resolve(readJson(path.resolve(coveragePath))),
  ])
  const report = buildZeroInventoryRemediationReport({
    runState,
    coverageRows,
    providers: getScraperCatalog(),
  })
  const resolvedOutputPath = path.resolve(outputPath)
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true })
  fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(report, null, 2)}\n`)
  console.log(JSON.stringify({ output: resolvedOutputPath, ...report.summary }, null, 2))
}

if (process.argv[1]
  && path.resolve(process.argv[1]).toLowerCase() === fileURLToPath(import.meta.url).toLowerCase()) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
