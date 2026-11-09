import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SIMPLIFY3X_SOFTWARE_CATALOG = {
  source: 'simplify3xsoftware',
  companyName: 'Simplify3x Software',
  officialBrandName: 'Simplify3x',
  adapter: 'script',
  modulePath: path.join(currentDir, 'script.js'),
  companyCareerPage: "https://www.hire3x.com/careers",
  companyDomain: "simplify3x.com.my",
  atsPlatform: "hire3x-public-careers",
  countryFilter: 'India',
  paginationStrategy: "published-v2-categories-two-snapshots-native-details",
  extractionStrategy:
    "verified-company-alias+published-hire3x-client+native-details+India-assignments-partial",
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: "2026-10-09",
  verifiedSurfaceSummary:
    "Verified on October 9, 2026: the certificate-valid Simplify3x company alias https://simplify3x.com.my/ and its Life at Simplify3x, About and Contact pages retain exact brand, official email, social identity and audit-report links and publish https://www.hire3x.com/careers. Its current public Vue client publishes the v2 categories API: 14 rows reconcile to 13 unique native IDs with one identical duplicate. Three active India assignments in the Simplify3x license have full native descriptions, matching employer/title/location, mandatory application fields and public application availability; seven active foreign assignments are excluded. One on-hold role has a native Job Not found response. Two separate-license Hire3x recruitment-drive rows retain old event dates despite open flags, so they remain excluded and full source coverage is incomplete. Every returned row is partial; zero results cannot expire prior inventory.",
}

export default SIMPLIFY3X_SOFTWARE_CATALOG
