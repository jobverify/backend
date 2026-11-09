import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const FINCARE_SMALL_FINANCE_BANK_CATALOG = {
  source: 'fincaresmallfinancebank',
  companyName: 'Fincare Small Finance Bank',
  officialBrandName: 'Fincare Small Finance Bank',
  adapter: 'script',
  companyCareerPage: 'https://www.fincarebank.com/',
  legacyHomepageUrl: 'https://www.fincarebank.com/',
  legacyHomepageNoWwwUrl: 'https://fincarebank.com/',
  mergedParentHomepageUrl: 'https://www.au.bank.in/',
  atsPlatform: 'legacy-brand-redirect-to-au-bank-homepage',
  countryFilter: 'India',
  paginationStrategy: 'legacy-homepage-redirect-validation',
  extractionStrategy:
    'verified-legacy-fincare-domains-redirect-to-au-homepage-without-fincare-jobs-return-empty',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'fincarebank.com',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary:
    'Verified on July 15, 2026 that both https://www.fincarebank.com/ and https://fincarebank.com/ now redirect to the AU Small Finance Bank homepage at https://www.au.bank.in/, whose live page title is "Personal, Business, Corporate, and NRI Banking | AU Small Finance Bank" and which still exposes migrated customer links such as "Fincare NetBanking" and "Fincare Corporate NetBanking". There is no trustworthy public jobs surface for the exact legacy brand Fincare Small Finance Bank anymore: the exact-name first-party domains now resolve to an AU banking homepage rather than to a Fincare-branded careers or public jobs listing surface.',
  modulePath: path.join(currentDir, 'script.js'),
}

export default FINCARE_SMALL_FINANCE_BANK_CATALOG
