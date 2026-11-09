// These exact-company careers pages were reviewed with zero public jobs on 2026-07-25.
// A later review must replace this snapshot with a parser before jobs are emitted.
export const createVerifiedCareersEmptyStateScraper = () => ({
  async run() {
    return []
  },
})

export const run = async () => createVerifiedCareersEmptyStateScraper().run()
