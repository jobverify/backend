export function validEmail(value) {
  return typeof value === 'string' && value.length <= 320 && /^[A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9](?:[A-Z0-9.-]*[A-Z0-9])?\.[A-Z]{2,63}$/i.test(value) && !/[\r\n\x00-\x20\x7f]/.test(value);
}
