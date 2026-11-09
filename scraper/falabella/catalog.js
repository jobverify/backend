import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const VERIFIED_SURFACE_SUMMARY =
  'Verified on July 15, 2026 that https://jobs.falabella.com/ redirects to the live first-party careers shell at https://muevete.falabella.com/, that the shell exposes the public module bundle https://muevete.falabella.com/assets/index-BEcRIvKY.js, and that the bundle instantiates the public external offers client against https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/type/external. Verified the public external offers API returned 1899 public records, including the live sample detail contract https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/external/611174, the public apply handoff https://falabella.airavirtual.com/postula/9FY0xC6XCTMRM1qokXsN?logged_action=apply&register=true, and the public offer-info URL embedded in the bundle at https://falabella.airavirtual.com/offer_info/B673kVNCinevRIVb5luq?fbrefresh=STPm1B6TRvQvIzI8&id=1678396020.'

export const FALABELLA_CATALOG = {
  source: 'falabella',
  companyName: 'Falabella',
  officialBrandName: 'Grupo Falabella',
  adapter: 'script',
  modulePath: path.resolve(currentDir, 'script.js'),
  dryRunFile: 'falabella/jobs.json',
  companyCareerPage: 'https://jobs.falabella.com/',
  companyDomain: 'muevete.falabella.com',
  officialHomepageUrl: 'https://www.falabella.com/',
  officialCareersHomeUrl: 'https://muevete.falabella.com/',
  verifiedBundleUrl: 'https://muevete.falabella.com/assets/index-BEcRIvKY.js',
  publicJobsApiUrl:
    'https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/type/external',
  verifiedSampleDetailApiUrl:
    'https://ftc-hr-tama-atrc.falabella.tech/bff-sgdt-job-offer/api/ofertalaboral/external/611174',
  verifiedSampleApplyUrl:
    'https://falabella.airavirtual.com/postula/9FY0xC6XCTMRM1qokXsN?logged_action=apply&register=true',
  verifiedSampleOfferInfoUrl:
    'https://falabella.airavirtual.com/offer_info/B673kVNCinevRIVb5luq?fbrefresh=STPm1B6TRvQvIzI8&id=1678396020',
  verifiedListingJobCount: 1899,
  atsPlatform: 'first-party-bff-job-api',
  countryFilter: 'Global',
  paginationStrategy: 'single-public-external-offers-feed',
  extractionStrategy:
    'verified-careers-redirect+verified-careers-shell+verified-public-bundle-client+verified-external-offers-api+airavirtual-apply-handoff',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  verifiedOn: '2026-07-15',
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default FALABELLA_CATALOG
