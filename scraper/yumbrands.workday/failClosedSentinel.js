export const createFailClosedSentinelScraper = () => ({
  async run() {
    return []
  },
})

export const run = async () => createFailClosedSentinelScraper().run()
