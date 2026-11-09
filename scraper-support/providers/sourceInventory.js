import { existsSync, readdirSync } from 'node:fs'

import { getScraperSourceDirectoryName } from './sourcePaths.js'
import { SCRAPER_DIR } from '../supportPaths.js'

const scraperDir = SCRAPER_DIR

export const getDiskBackedScraperSources = ({
  catalog = [],
  scraperDirectories = readdirSync(scraperDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name),
} = {}) => {
  const scraperDirectorySet = new Set(scraperDirectories)
  const providersBySource = new Map(catalog.map((provider) => [provider.source, provider]))

  return [...new Set(catalog.map((provider) => provider.source))]
    .filter((source) => {
      const provider = providersBySource.get(source)
      const directoryName = provider
        ? getScraperSourceDirectoryName(provider)
        : source

      return scraperDirectorySet.has(directoryName)
        || (provider?.dryRunFile ? existsSync(provider.dryRunFile) : false)
    })
}
