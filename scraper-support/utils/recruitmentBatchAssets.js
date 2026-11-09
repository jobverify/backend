import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultDirectory = fileURLToPath(new URL('../providers/providerExtensions/', import.meta.url))

export const RECRUITMENT_BATCH_ASSETS = Object.freeze([
  Object.freeze({ name: 'runtime', expectedCount: 500,
    fileName: 'zz-296-runtime-recruitment-500.json' }),
  Object.freeze({ name: 'remaining', expectedCount: 1033,
    fileName: 'zz-297-remaining-recruitment-1033.json' }),
])

const assetError = (message, cause) => Object.assign(new Error(message, { cause }), {
  code: 'SCRAPER_RUNTIME_ASSET_INVALID', exitCode: 1, abortRetries: true,
  failureKind: 'configuration_error',
})

// Match the collector's admission requirements before any source starts. A
// readable manifest with only source names is still an unusable release asset.
const isOfficialHttpsSurface = value => {
  let url
  try { url = new URL(value) } catch { return false }
  return url.protocol === 'https:' && !url.username && !url.password && !url.port
    && !/^localhost$|\.localhost$|\.local$|^\[|^\d+(?:\.\d+){3}$/i.test(url.hostname)
}

export const loadRecruitmentBatchAsset = (name, { directory = defaultDirectory } = {}) => {
  const asset = RECRUITMENT_BATCH_ASSETS.find(row => row.name === name)
  if (!asset) throw assetError('Unknown required recruitment batch: ' + name)
  const file = path.join(directory, asset.fileName)
  try {
    const providers = JSON.parse(readFileSync(file, 'utf8'))
    if (!Array.isArray(providers) || providers.length !== asset.expectedCount
      || providers.some(provider => typeof provider?.source !== 'string' || !provider.source.trim())
      || new Set(providers.map(provider => provider.source)).size !== asset.expectedCount) {
      throw new Error(`Expected ${asset.expectedCount} unique, nonempty source registrations`)
    }
    for (const provider of providers) {
      const homepage = provider.officialHomepageUrl
        || (provider.companyDomain ? `https://${provider.companyDomain}/` : '')
      if (typeof provider.companyName !== 'string' || !provider.companyName.trim()
        || !(isOfficialHttpsSurface(provider.companyCareerPage) || isOfficialHttpsSurface(homepage))) {
        throw new Error(`Invalid source registration ${provider.source}: a company name and official HTTPS surface are required`)
      }
    }
    return providers
  } catch (cause) {
    throw assetError(`Required scraper runtime asset is missing or invalid: ${file}. ${cause.message}`, cause)
  }
}

// Report every missing batch together, before opening a database connection or
// admitting any source. An incomplete release must not become 1,499 task errors.
export const validateRecruitmentBatchAssets = (options = {}) => {
  const failures = [], results = []
  for (const asset of RECRUITMENT_BATCH_ASSETS) {
    try {
      results.push({ fileName: asset.fileName, providers: loadRecruitmentBatchAsset(asset.name, options).length })
    } catch (error) { failures.push(error) }
  }
  if (failures.length) throw assetError(failures.map(error => error.message).join('\n'), new AggregateError(failures))
  return results
}
