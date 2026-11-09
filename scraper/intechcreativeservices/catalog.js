import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const INTECH_CREATIVE_SERVICES_CATALOG = {
  source: 'intechcreativeservices',
  companyName: 'Intech Creative Services',
  officialBrandName: 'The INTECH Group',
  adapter: 'script',
  homepageUrl: 'https://theintechgroup.com/',
  companyCareerPage: 'https://theintechgroup.com/career/',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'elementor-load-more-pages+published-rest-count',
  extractionStrategy: 'verified-first-party-paged-cards+published-identity-inventory+native-job-details',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'theintechgroup.com',
  verifiedOn: '2026-10-09',
  verificationDisposition: 'partial-india-inventory-three-upstream-coverage-gaps',
  verifiedPublishedJobCount: 23,
  verifiedIndiaJobCount: 20,
  verifiedSurfaceSummary: "Verified October 9, 2026: official /career/ still identifies At INTECH Creative Services and publishes 23 roles over three Elementor pages (9+9+5), with current /jobs/ and older /career/jobs/ native application routes. Published REST total and all 23 role/application identities agree. Twenty roles have verified India city or explicitly India-scoped remote locations and complete native descriptions. Three upstream roles (20386, 17285, 15765) lack verified country and one has a short description; return only verified India roles with coverage-gap evidence and sourceListingComplete false, preserving prior records.",
  modulePath: path.resolve(currentDir, 'script.js'),
}

export default INTECH_CREATIVE_SERVICES_CATALOG
