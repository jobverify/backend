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
export function qualifyEverstageClient(document,url,body,kind){
 const sha=createHash('sha256').update(body).digest('hex')
 if(sha===legacy[kind])return '2026-10-21'
 if(sha!==current[kind])throw Error('Everstage native: Native '+kind+' executable client contract changed')
 const expected=declarations[kind],advertised=[]
 // Hidden/inert presentation does not remove an authored program declaration.
 const collect=node=>{if(node.tag==='script'&&node.attrs.src)advertised.push(node.attrs.src);for(const child of node.children??[])if(typeof child!=='string')collect(child)}
 for(const root of document.nodes(n=>n.tag==='root'))collect(root)
 const own=advertised.filter(src=>src.startsWith('https://ats.us1.rippling.com/')||src.includes('/_next/'))
 if(!expected.includes(url)||own.length!==expected.length||new Set(own).size!==own.length||!expected.every(src=>own.includes(src)))throw Error('Everstage native: Native '+kind+' client declaration context changed')
 return '2026-11-07'
}
