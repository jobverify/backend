import {createHash} from 'node:crypto'
// Complete role/application programs and their exact own-publisher declarations
// were reviewed as static data. This profile does not execute shared/browser code
// or certify that submitting an application succeeds.
const legacy={role:'01cf7547816ba811e46eff4ebb10e28b7b4fe8a8b63543f9eb05de26bf91f3c5',apply:'259b5b4ae9327608f90927c1835f5f48227f5fc5312afe23440f4ec63def7447'}
const current={role:'7e7b6ae04e4c2a6f0e26f394949ddc5f16656fbd016b74ebf76176a1986a71c6',apply:'a5aae7431cac22325254177606bf515b023a4fba98637bbf5f7a97c5b742cc1d'}
const declarations={
 "role": [
  "https://ats.us1.rippling.com/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "https://ats.us1.rippling.com/_next/static/chunks/webpack-7b89002f6b924dbc.js",
  "https://ats.us1.rippling.com/_next/static/chunks/framework-a96425ebb2c01c59.js",
  "https://ats.us1.rippling.com/_next/static/chunks/main-9b9f7dea66d0b54b.js",
  "https://ats.us1.rippling.com/_next/static/chunks/pages/_app-e4ddd0e6f708a095.js",
  "https://ats.us1.rippling.com/_next/static/chunks/pages/%5BjobBoardSlug%5D/jobs/%5BjobId%5D-f5a3381aaec0ea0b.js",
  "https://ats.us1.rippling.com/_next/static/4yNB1FCH88tY6PbRSmFAH/_buildManifest.js",
  "https://ats.us1.rippling.com/_next/static/4yNB1FCH88tY6PbRSmFAH/_ssgManifest.js"
 ],
 "apply": [
  "https://ats.us1.rippling.com/_next/static/chunks/polyfills-42372ed130431b0a.js",
  "https://ats.us1.rippling.com/_next/static/chunks/webpack-7b89002f6b924dbc.js",
  "https://ats.us1.rippling.com/_next/static/chunks/framework-a96425ebb2c01c59.js",
  "https://ats.us1.rippling.com/_next/static/chunks/main-9b9f7dea66d0b54b.js",
  "https://ats.us1.rippling.com/_next/static/chunks/pages/_app-e4ddd0e6f708a095.js",
  "https://ats.us1.rippling.com/_next/static/chunks/546-5e49bf3f3f834913.js",
  "https://ats.us1.rippling.com/_next/static/chunks/780-887778ce0a1d4fbf.js",
  "https://ats.us1.rippling.com/_next/static/chunks/788-0c441e0104c99ca4.js",
  "https://ats.us1.rippling.com/_next/static/chunks/pages/%5BjobBoardSlug%5D/jobs/%5BjobId%5D/apply-530b431e9be29ff9.js",
  "https://ats.us1.rippling.com/_next/static/4yNB1FCH88tY6PbRSmFAH/_buildManifest.js",
  "https://ats.us1.rippling.com/_next/static/4yNB1FCH88tY6PbRSmFAH/_ssgManifest.js"
 ]
}
// Current public role/application pages use the same role program with a new
// translated application program and an updated complete Next build context.
// Keep both observed contexts; a leaf hash alone still cannot qualify a page.
const current20261115={role:current.role,apply:'59bad43fd68985a50b80c47807f201e48a34e813be1bfadcce6602691fd2538d'}
const declarations20261115=Object.fromEntries(Object.entries(declarations).map(([kind,urls])=>[kind,urls.map(url=>url
 .replace('main-9b9f7dea66d0b54b.js','main-eb264300998e854e.js')
 .replace('_app-e4ddd0e6f708a095.js','_app-906b68baa5ff46c1.js')
 .replace('4yNB1FCH88tY6PbRSmFAH','6fvxwFNQJCv4SL9RqAcJL')
 .replace('apply-530b431e9be29ff9.js','apply-b96f12938a22623b.js'))]))
// The Nov16 public deployment advertises the already reviewed Nov7 role and
// application programs in this exact new Next build context.
const declarations20261116=Object.fromEntries(Object.entries(declarations).map(([kind,urls])=>[kind,urls.map(url=>url
 .replace('main-9b9f7dea66d0b54b.js','main-eb264300998e854e.js')
 .replace('_app-e4ddd0e6f708a095.js','_app-adc50512ab52b557.js')
 .replace('4yNB1FCH88tY6PbRSmFAH','-o1k54Bqx8mJwi93As_1h'))]))
// The Nov18 role leaf is unchanged. The complete application program differs
// only in its Sentry/map IDs and two minifier-local identifier swaps. Pin the
// actual bytes and the entire advertised Next declaration tuple together.
const current20261118={role:current.role,apply:'0eb8e1d10c1510914c38757e53297d837ea3f6557e3923df32b92a9de800af38'}
const declarations20261118=Object.fromEntries(Object.entries(declarations).map(([kind,urls])=>[kind,urls.map(url=>url
 .replace('main-9b9f7dea66d0b54b.js','main-73465e06eee9a8f2.js')
 .replace('_app-e4ddd0e6f708a095.js','_app-df6557919049cce8.js')
 .replace('4yNB1FCH88tY6PbRSmFAH','DZ554rXjs25aVcEecNGXp')
 .replace('788-0c441e0104c99ca4.js','788-4f6f260a8769e9da.js')
 .replace('apply-530b431e9be29ff9.js','apply-3fe9d85435bea2fa.js'))]))
export function qualifyEverstageClient(document,url,body,kind){
 const sha=createHash('sha256').update(body).digest('hex')
 if(sha===legacy[kind])return '2026-10-21'
 const profiles=[{hashes:current,declarations,date:'2026-11-07'},{hashes:current20261115,declarations:declarations20261115,date:'2026-11-15'},{hashes:current,declarations:declarations20261116,date:'2026-11-16'},{hashes:current20261118,declarations:declarations20261118,date:'2026-11-18'}].filter(profile=>profile.hashes[kind]===sha)
 if(!profiles.length)throw Error('Everstage native: Native '+kind+' executable client contract changed')
 const advertised=[]
 // Hidden/inert presentation does not remove an authored program declaration.
 const collect=node=>{if(node.tag==='script'&&node.attrs.src)advertised.push(node.attrs.src);for(const child of node.children??[])if(typeof child!=='string')collect(child)}
 for(const root of document.nodes(n=>n.tag==='root'))collect(root)
 const own=advertised.filter(src=>src.startsWith('https://ats.us1.rippling.com/')||src.includes('/_next/'))
 const matched=profiles.find(profile=>{const expected=profile.declarations[kind];return expected.includes(url)&&own.length===expected.length&&new Set(own).size===own.length&&expected.every(src=>own.includes(src))})
 if(!matched)throw Error('Everstage native: Native '+kind+' client declaration context changed')
 return matched.date
}
