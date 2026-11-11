// Authored offline protocol controls only. None of these values or programs
// represents a captured ReBIT browser client, credential or current API.
export const MAIN = 'https://rebit.org.in/main-CONTROL20261111.js'
export const CONFIG = 'https://rebit.org.in/chunk-CONTROL20261111.js'
export const usernameBytes = Array.from({ length: 16 }, (_, index) => index + 1)
export const passwordBytes = Array.from({ length: 32 }, (_, index) => index + 17)
export const clientWith = (user = usernameBytes) => 'import{environment as e}from"./chunk-CONTROL20261111.js";'
  + 'function pe(n){let o=n.map(t=>String.fromCharCode(t)).join("");return btoa(o)}'
  + 'function login(){let n=' + JSON.stringify(user) + ',r=' + JSON.stringify(passwordBytes)
  + ',s=pe(n),a=pe(r);http.post(`${e.apiUrl}/auth/login`,{username:s,password:a})}'
export const careers = '<!doctype html><title>ReBIT - Reserve Bank Information Technology</title>'
  + '<base href="/"><script src="https://www.google.com/recaptcha/api.js?render=explicit"></script>'
  + '<app-root></app-root><script type="module" src="main-CONTROL20261111.js"></script>'
export const client = clientWith()
export const config = 'export const environment={apiUrl:"https://rebit.org.in/web/api"};'
export const expectedBody = (user = usernameBytes) => ({
  username: Buffer.from(user).toString('base64'), password: Buffer.from(passwordBytes).toString('base64'),
})
