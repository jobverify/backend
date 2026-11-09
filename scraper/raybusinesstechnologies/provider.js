export const provider = {
  source: 'raybusinesstechnologies',
  companyName: 'Ray Business Technologies',
  officialBrandName: 'Ray Business Technologies Pvt. Ltd.',
  adapter: 'script',
  modulePath: '../../scraper/raybusinesstechnologies/script.js',
  homepageUrl: 'https://raybiztech.com/',
  companyCareerPage: 'https://raybiztech.com/about-us/careers/current-openings',
  atsPlatform: 'official-company-careers',
  countryFilter: 'India',
  paginationStrategy: 'single-page-accordion-list',
  extractionStrategy: 'verified-first-party-careers-page+public-accordion-openings+india-location-filter',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'raybiztech.com',
  verifiedOn: '2026-08-04',
  verifiedSurfaceSummary:
    'Verified on Tuesday, August 4, 2026 that https://raybiztech.com/about-us/careers/current-openings is the live first-party Ray Business Technologies careers page and that its public accordion markup now exposes accessible opening titles and descriptions directly in the fetched HTML. The public surface includes current India openings such as Senior AI/ML Engineer, Dotnet Developer, HR Executive, and Boomi Developer, while also listing at least one explicit US-only role. This scraper validates the exact first-party page shell, extracts the public accordion openings, and returns only conservative India-eligible jobs.',
  dryRunFile: 'raybusinesstechnologies/jobs.json',
}

export default provider

