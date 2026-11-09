import { readFileSync } from 'node:fs'
import { createVerifiedRecruitmentScraper } from './verifiedRecruitment.js'

const providers = JSON.parse(readFileSync(new URL('../providers/providerExtensions/zzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz-runtime-recruitment-500-20261103.json', import.meta.url), 'utf8'))
const bySource = new Map(providers.map(provider => [provider.source, provider]))
if (bySource.size !== 500 || providers.length !== 500) throw new Error('The recruitment repair batch must contain 500 unique source registrations')

export const recruitmentBatchProviders = () => providers.map(provider => structuredClone(provider))
export const runRecruitmentBatchSource = (source, options = {}) => {
  const provider = bySource.get(source)
  if (!provider) throw new Error('Unknown registered recruitment repair source: ' + source)
  return createVerifiedRecruitmentScraper(provider).run(options)
}
