import { resolve4, resolve6 } from 'node:dns/promises'

export const DEFAULT_DNS_LOOKUP_TIMEOUT_MS = 3000

const resolveWithTimeout = (resolver, host, timeoutMs) => new Promise((resolve) => {
  const timeoutId = setTimeout(() => resolve([]), timeoutMs)

  Promise.resolve()
    .then(() => resolver(host))
    .then((addresses) => resolve(Array.isArray(addresses) ? addresses : []))
    .catch(() => resolve([]))
    .finally(() => clearTimeout(timeoutId))
})

export const resolveHostAddressesWithTimeout = async (
  hosts = [],
  {
    resolve4Impl = resolve4,
    resolve6Impl = resolve6,
    timeoutMs = DEFAULT_DNS_LOOKUP_TIMEOUT_MS,
  } = {},
) => {
  const results = await Promise.all(
    hosts.flatMap((host) => [
      resolveWithTimeout(resolve4Impl, host, timeoutMs),
      resolveWithTimeout(resolve6Impl, host, timeoutMs),
    ]),
  )

  return [...new Set(results.flat())]
}
