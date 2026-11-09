// Log only the public role path. Never serialize a response row, URL credentials,
// query parameters, fragments, cookies, or headers while diagnosing rejection.
export const workdayListingIdentityDiagnostic = ({ reason, board, rowIndex, externalPath }) => ({
  reason,
  board,
  rowIndex: Number.isSafeInteger(rowIndex) && rowIndex >= 0 ? rowIndex : null,
  externalPath: typeof externalPath === 'string' && externalPath.startsWith('/job/')
    ? externalPath.split(/[?#]/, 1)[0].replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, '').slice(0, 256)
    : null,
})
