import path from 'node:path'
import { fileURLToPath } from 'node:url'
import CURRENT_NATIVE_METADATA from '../../scraper-support/providers/providerExtensions/zzzz-adityabirlafashion-native-20261103.json' with { type: 'json' }

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const ADITYA_BIRLA_FASHION_CATALOG = {
  ...CURRENT_NATIVE_METADATA,
  officialBrandName: "Aditya Birla Fashion and Retail",
  legalEntityName: "Aditya Birla Fashion and Retail Limited",
  officialCareersHandoffUrl: "https://careers.adityabirla.com/fashion-retail",
  groupJobSearchUrl: "https://careers.adityabirla.com/job-search",
  storeManagerOpeningsUrl: "https://abfrlcareers.peoplestrong.com/home",
  modulePath: path.join(currentDir, 'script.js'),
}

export default ADITYA_BIRLA_FASHION_CATALOG
