import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validateRecruitmentBatchAssets } from '../scraper-support/utils/recruitmentBatchAssets.js'

export const validateScraperRuntimeAssets = () => validateRecruitmentBatchAssets()

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const assets = validateScraperRuntimeAssets()
    console.log(`Validated ${assets.length} required scraper batches (${assets.reduce((sum, row) => sum + row.providers, 0)} source registrations).`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
