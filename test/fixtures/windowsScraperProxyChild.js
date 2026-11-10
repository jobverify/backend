process.stdout.write(JSON.stringify({ argument: process.argv[2], proxyPresent: Boolean(process.env.HTTPS_PROXY),
  proxyEnabled: process.env.NODE_USE_ENV_PROXY === '1' }) + '\n')
process.exitCode = 7
