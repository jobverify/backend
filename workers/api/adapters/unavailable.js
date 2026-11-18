export function unavailable(feature) {
  return Object.assign(new Error(`${feature} requires the Node runner and is unavailable on the Cloudflare API.`),
    { status: 503, statusCode: 503, code: 'NODE_RUNNER_REQUIRED' });
}
