import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://www.amns.in/ is the live AM/NS India homepage, that https://www.amns.in/careers redirects to the first-party candidate microsite at https://ace.amns.in/CANDMICROSITE/, that the public tenant lookup endpoint https://ace.amns.in/CANDMICROSITE/CMLandingpage/GetCompanyIDAndOUID resolves to AMNS/defaultOU, and that the public vacancy endpoint https://ace.amns.in/CANDMICROSITE/CPVacancyDetails/GetVacancyInformationWithoutToken returned 28 live vacancy records when called with the verified public encoded CompanyID and OU_ID values captured from the first-party microsite XHR flow.'

export const ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG = {
  source: 'arcelormittalnipponsteelindia',
  companyName: 'ArcelorMittal Nippon Steel India',
  officialBrandName: 'AM/NS India',
  adapter: 'script',
  enrichPublicExperience: false,
  modulePath: path.join(currentDir, 'script.js'),
  dryRunFile: 'arcelormittalnipponsteelindia/jobs.json',
  companyCareerPage: 'https://www.amns.in/careers',
  homepageUrl: 'https://www.amns.in/',
  careersMicrositeUrl: 'https://ace.amns.in/CANDMICROSITE/',
  publicApplyUrl: 'https://ace.amns.in/CANDMICROSITE/#/?CompanyID=AMNS&GroupId=defaultOU',
  publicCompanyLookupUrl: 'https://ace.amns.in/CANDMICROSITE/CMLandingpage/GetCompanyIDAndOUID',
  vacancyApiUrl: 'https://ace.amns.in/CANDMICROSITE/CPVacancyDetails/GetVacancyInformationWithoutToken',
  publicCompanyId: 'AMNS',
  publicGroupId: 'defaultOU',
  encodedCompanyId: 'y6k5iZIHLBMb25yRD9bK0A==',
  encodedGroupId: 'vrr0nzxsgCyo6GkEF0XU1g==',
  companyDomain: 'amns.in',
  atsPlatform: 'first-party-adrenalin-candidate-microsite-api',
  countryFilter: 'India',
  paginationStrategy: 'verified-careers-redirect-plus-single-public-adrenalin-vacancy-api-post',
  extractionStrategy:
    'verified-homepage+verified-careers-redirect+verified-company-ou-lookup+public-adrenalin-vacancy-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ARCELORMITTAL_NIPPON_STEEL_INDIA_CATALOG
