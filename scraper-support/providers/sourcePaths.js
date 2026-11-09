import path from 'node:path'

export const WORKDAY_SOURCE_DIRECTORY_SUFFIX = '.workday'

export const isWorkdayBackedProvider = (provider = {}) => (
  provider?.adapter === 'workday'
  || provider?.atsPlatform === 'workday'
  || provider?.parser === 'workday'
  || provider?.backfillMode === 'workday'
  || provider?.originalAtsPlatform === 'workday'
)

export const getWorkdaySourceDirectoryName = (source) =>
  `${String(source || '').trim()}${WORKDAY_SOURCE_DIRECTORY_SUFFIX}`

export const getScraperSourceDirectoryName = (
  providerOrSource,
  { workday } = {},
) => {
  const source = typeof providerOrSource === 'string'
    ? providerOrSource
    : providerOrSource?.source || providerOrSource?.name || ''

  if (!String(source || '').trim()) {
    throw new Error('A scraper source is required to resolve its directory name.')
  }

  const isWorkday = workday ?? (
    typeof providerOrSource === 'string'
      ? false
      : isWorkdayBackedProvider(providerOrSource)
  )

  return isWorkday ? getWorkdaySourceDirectoryName(source) : source
}

export const getDefaultScriptModulePath = (
  providerOrSource,
  options = {},
) => `../../scraper/${getScraperSourceDirectoryName(providerOrSource, options)}/script.js`

export const getDefaultDryRunRelativePath = (
  providerOrSource,
  options = {},
) => `${getScraperSourceDirectoryName(providerOrSource, options)}/jobs.json`

export const resolveScraperSourceDirectory = (
  providerOrSource,
  { baseDir, ...options } = {},
) => path.join(
  baseDir,
  getScraperSourceDirectoryName(providerOrSource, options),
)
