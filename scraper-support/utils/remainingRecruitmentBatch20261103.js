import { loadRecruitmentBatchAsset } from './recruitmentBatchAssets.js'
import { createVerifiedRecruitmentScraper } from './verifiedRecruitment.js'

const providers = loadRecruitmentBatchAsset('remaining')
const bySource = new Map(providers.map(provider => [provider.source, provider]))
if (bySource.size !== 1033 || providers.length !== 1033) throw new Error('The remaining recruitment batch requires 1033 unique source registrations')

export const remainingRecruitmentBatchProviders = () => structuredClone(providers)
export const remainingRecruitmentBatchProvider = source => {
  const provider = bySource.get(source)
  if (!provider) throw new Error('Unknown remaining recruitment source: ' + source)
  return structuredClone(provider)
}
export const runRemainingRecruitmentBatchSource = (source, options = {}) => {
  const provider = bySource.get(source)
  if (!provider) throw new Error('Unknown remaining recruitment source: ' + source)
  return createVerifiedRecruitmentScraper(provider).run({ preferIndiaInventory: true, ...options })
}
