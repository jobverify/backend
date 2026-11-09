export const LATTICE_SEMICONDUCTOR_INDIA_CATALOG = {
  source: 'latticesemiconductorindia',
  companyName: 'Lattice Semiconductor India',
  officialBrandName: 'Lattice Semiconductor',
  adapter: 'script',
  modulePath: '../../scraper/latticesemiconductorindia/script.js',
  dryRunFile: 'latticesemiconductorindia/jobs.json',
  homepageUrl: 'https://www.latticesemi.com/en',
  companyCareerPage: 'https://www.latticesemi.com/About/Jobs',
  workdayBoardUrl: 'https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers',
  workdayJobsApiUrl: 'https://latticesemi.wd5.myworkdayjobs.com/wday/cxs/latticesemi/latticesemiconductorscareers/jobs',
  atsPlatform: 'workday-jobs-api',
  countryFilter: 'India',
  paginationStrategy: 'workday-jobs-api',
  extractionStrategy: 'verified-first-party-careers-page+verified-workday-handoff+verified-workday-board+jobs-api',
  parser: 'custom-script',
  normalizationProfile: 'engineering-default',
  companyDomain: 'latticesemi.com',
  verifiedOn: '2026-08-15',
  verifiedSurfaceSummary:
    'Verified on Saturday, August 15, 2026 that https://www.latticesemi.com/About/Jobs remains the live first-party careers page titled "Lattice Semiconductor | Careers | Join the FPGA Leader", that it still includes a stale Search Job Openings link into a 404ing iCIMS intro, but also links the live public Workday board at https://latticesemi.wd5.myworkdayjobs.com/latticesemiconductorscareers. Verified on the same date that the public Workday jobs API at https://latticesemi.wd5.myworkdayjobs.com/wday/cxs/latticesemi/latticesemiconductorscareers/jobs enumerated current India openings across Pune, Hyderabad, and Chennai, including Design Eng, Senior Design Verification Engineer, and Intellectual Property Counsel.',
}

export default LATTICE_SEMICONDUCTOR_INDIA_CATALOG
