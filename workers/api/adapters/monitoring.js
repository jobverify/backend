export function captureServerError(error) {
  // Log classification only: database/HTTP errors can contain tokens or resume data.
  console.error(JSON.stringify({ event: 'api_error', name: String(error?.name || 'Error').slice(0, 80) }));
}
export function captureLoginFailure(method) {
  console.warn(JSON.stringify({ event: 'auth_login_failed', method: ['google', 'apple', 'password'].includes(method) ? method : 'other' }));
}
