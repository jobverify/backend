import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..', '..')
const providerExtensionDir = path.join(backendDir, 'scraper-support', 'providers', 'providerExtensions')
const aliasExtensionDir = path.join(backendDir, 'scraper-support', 'providers', 'companyAliasExtensions')

const loadSortedJsonFiles = (directory, matcher) =>
  readdirSync(directory)
    .filter((name) => matcher.test(name))
    .sort((left, right) => left.localeCompare(right))

const loadJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf8'))

const coreWorkbookSignature = (provider = {}) => JSON.stringify({
  source: provider.source,
  companyName: provider.companyName,
  adapter: provider.adapter,
  modulePath: provider.modulePath,
  dryRunFile: provider.dryRunFile,
  atsPlatform: provider.atsPlatform,
  parser: provider.parser,
})

export const loadWorkbookBatchProviders = ({ providerExtensionDir: directory = providerExtensionDir } = {}) =>
  loadSortedJsonFiles(directory, /^workbook-batch-.*\.json$/i)
    .flatMap((name) => loadJson(path.join(directory, name)))

export const loadWorkbookBatchAliases = ({ aliasExtensionDir: directory = aliasExtensionDir } = {}) =>
  loadSortedJsonFiles(directory, /^workbook-batch-.*\.json$/i)
    .reduce((aliasMap, name) => Object.assign(aliasMap, loadJson(path.join(directory, name))), {})

export const buildCanonicalWorkbookInventory = ({
  workbookProviders = [],
  dedicatedProviders = [],
} = {}) => {
  const workbookBySource = new Map()
  const dedicatedBySource = new Map(dedicatedProviders.map((provider) => [provider.source, provider]))
  const workbookOnlyProviders = []
  const overlappingProviders = []
  const dedicatedOnlyProviders = dedicatedProviders.filter(
    (provider) => !workbookProviders.some((workbookProvider) => workbookProvider.source === provider.source),
  )
  const conflicts = []

  for (const provider of workbookProviders) {
    if (!provider?.source) {
      conflicts.push('Encountered workbook provider without a source.')
      continue
    }

    const existingWorkbook = workbookBySource.get(provider.source)
    if (existingWorkbook) {
      if (coreWorkbookSignature(existingWorkbook) !== coreWorkbookSignature(provider)) {
        conflicts.push(`Workbook source conflict for ${provider.source}`)
      }
      continue
    }

    workbookBySource.set(provider.source, provider)

    if (dedicatedBySource.has(provider.source)) overlappingProviders.push(provider)
    else workbookOnlyProviders.push(provider)
  }

  return {
    canonicalProviders: [
      ...dedicatedOnlyProviders,
      ...[...workbookBySource.values()].sort((left, right) => left.source.localeCompare(right.source)),
    ],
    workbookOnlyProviders,
    overlappingProviders,
    dedicatedOnlyProviders,
    conflicts: [...new Set(conflicts)].sort((left, right) => left.localeCompare(right)),
    stats: {
      workbookProviderCount: workbookProviders.length,
      uniqueWorkbookSourceCount: workbookBySource.size,
      dedicatedProviderCount: dedicatedProviders.length,
      overlapWithDedicatedCount: overlappingProviders.length,
      batchOnlyCount: workbookOnlyProviders.length,
    },
  }
}
