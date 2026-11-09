export const CAREERS_URL = 'https://www.techjockey.com/company/careers'
export const CONTACT_EMAIL = 'career@techjockey.com'

export const createFailClosedSentinelScraper = () => ({
  async run() {
    return []
  },
})

export const run = async () => createFailClosedSentinelScraper().run()
