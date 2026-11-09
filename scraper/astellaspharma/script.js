import { createSuccessFactorsRmkScraper } from '../../scraper-support/shared/successFactorsRmk.js'

// This officially observed board covers the Asia/Mumbai recruitment surface.
// The separate Bengaluru route is not silently merged into its inventory.
export const run = options => createSuccessFactorsRmkScraper({ source: 'astellaspharma', companyName: 'Astellas Pharma',
  origin: 'https://careers.astellas.com', companyToken: 'astellasT5',
  searchUrl: 'https://careers.astellas.com/search?locale=en_GB', sourceScopeComplete: false }).run(options)
