export const VERIFIED_SURFACE_SUMMARY = "Verified on October 9, 2026 (India time) that https://www.aculife.co.in/resource/home.aspx, https://www.aculife.co.in/resource/HR.aspx, and https://www.aculife.co.in/resource/career.aspx are reachable official Aculife surfaces. The homepage and HR page publish the first-party career form. Its POST action stays on Career.aspx and its Position field is free text, alongside personal details, experience, and a resume upload. These pages do not enumerate vacancies or report a complete inventory. This is discovery-only evidence with unknown active vacancy counts, not a verified empty feed, and cannot authorize expiry. Historical unpublished candidate paths are no longer mandatory dependencies. Changed employer authority, application form, or newly published vacancies and hiring handoffs remain failures requiring review."

export const ACULIFE_PROVIDER = {
  source: 'aculife',
  companyName: 'Aculife',
  adapter: 'script',
  modulePath: '../../scraper/aculife/script.js',
  companyCareerPage: 'https://www.aculife.co.in/resource/career.aspx',
  atsPlatform: 'official-company-site-discovery-only',
  countryFilter: 'India',
  paginationStrategy: 'first-party-homepage-and-general-application-form',
  extractionStrategy: 'verified-first-party-careers-application-form+discovery-only-unknown-vacancy-counts',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'aculife.co.in',
  verifiedOn: '2026-10-09',
  verifiedPublicJobCount: null,
  verifiedIndiaJobCount: null,
  verifiedInventoryStatus: 'discovery-only',
  listingComplete: false,
  verifiedSurfaceSummary: VERIFIED_SURFACE_SUMMARY,
}

export default ACULIFE_PROVIDER
