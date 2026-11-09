import { readFileSync } from 'node:fs'
import { createVerifiedRecruitmentScraper } from './verifiedRecruitment.js'

const providers = JSON.parse(readFileSync(new URL('../providers/providerExtensions/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-remaining-recruitment-1033-20261103.json', import.meta.url), 'utf8'))
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
