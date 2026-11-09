import { nativeCountryName } from '../shared/nativeJobPosting.js'
import { isNativeBareCityInPublicScope } from '../shared/nativeCityScope.js'
import {createHash} from 'node:crypto'
import {readVisibleNativeDocument} from './visibleNativeHtml.js'

const cleanWorksite = value => typeof value === 'string' ? value.normalize('NFKC').trim().replace(/\s+/g, ' ') : ''
const isPostingScope = node => Object.hasOwn(node.attrs, 'itemscope')
  && (node.attrs.itemtype || '').split(/\s+/).some(type => /^https?:\/\/schema\.org\/JobPosting\/?$/.test(type))
const collectVisibleLocations = (document, scope) => {
  const locations=[]
  const visit=parent=>{for(const child of parent.children){
    if(typeof child==='string'||child.inert||Object.hasOwn(child.attrs,'itemscope'))continue
    if((child.attrs.class||'').split(/\s+/).includes('jobGeoLocation'))locations.push(document.text(child))
    visit(child)
  }}
  visit(scope);return locations
}
const countryOnlyVisible = (document,scope,html,label) => {
  if(typeof html!=='string')return false
  const originals=document.nodes(isPostingScope)
  if(originals.length!==1||originals[0]!==scope)return false
  // Exact reviewed RMK top-level anti-framing behavior, interpreted as data.
  // No publisher script executes and no other hiding rule is removed.
  const style='<style id="antiClickjack" type="text/css">body{display:none !important;}</style>'
  const scripts=document.nodes(n=>n.tag==='script'&&n.attrs.id==='antiClickJackScript')
  const sha=value=>createHash('sha256').update(value).digest('hex')
  if(html.split(style).length===2&&scripts.length===1
    &&JSON.stringify(scripts[0].attrs)===JSON.stringify({type:'text/javascript',id:'antiClickJackScript'})
    &&sha(scripts[0].raw)==='4a1ab69ed7fa61e5385ca970bf06b3e1afafc49efaeace8ec022766e16e72433')html=html.replace(style,'<style id="antiClickjack" type="text/css"></style>')
  const visible=readVisibleNativeDocument(html,{strict:true}),scopes=visible.nodes(isPostingScope)
  if(scopes.length!==1)return false
  const labels=collectVisibleLocations(visible,scopes[0])
  return labels.length>0&&labels.every(value=>cleanWorksite(value)===label)
}
const streetWorksite = (street, visibleLocations) => {
  const label = cleanWorksite(street)
  if (!label || !visibleLocations.some(visible => cleanWorksite(visible) === label)) return null
  const namedCountry = nativeCountryName(label)
  if (namedCountry && cleanWorksite(namedCountry).toLowerCase() === label.toLowerCase()
    && visibleLocations.every(visible => cleanWorksite(visible) === label)) return { country: namedCountry, locality: null, countryOnly: true }
  const parts = label.split(',').map(part => part.trim())
  if (parts.length < 2 || parts.some(part => !part)) return null
  const tail = parts.at(-1), candidate = /\d/.test(tail) ? parts.at(-2) : tail
  // A full native country name is unambiguous. IN alone also denotes Indiana
  // and RMK truncates Indonesia to "In"; require an own India city and PIN.
  const country = candidate.length > 2 ? nativeCountryName(candidate)
    : candidate === 'IN' && /^[1-9]\d{5}$/.test(tail) && isNativeBareCityInPublicScope(parts[0]) ? 'India' : null
  return country ? { country, locality: parts[0] } : null
}

// Read only active, own-scope HTML microdata. Nested organizations or unrelated
// postings cannot donate country, employer or title fields to another role.
export function recruitmentMicrodataPostings(document, pageURL, {scope = null,html = null} = {}) {
  const scopes = scope ? [scope] : document.nodes(node => Object.hasOwn(node.attrs, 'itemscope')
    && (node.attrs.itemtype || '').split(/\s+/).some(type => /^https?:\/\/schema\.org\/JobPosting\/?$/.test(type)))
  return scopes.map(scope => {
    const issues = new Set()
    const properties = (name, root = scope) => {
      const found = []
      const visit = parent => {
        for (const child of parent.children) {
          if (typeof child === 'string' || child.inert) continue
          if ((child.attrs.itemprop || '').split(/\s+/).includes(name)) found.push(child)
          if (!Object.hasOwn(child.attrs, 'itemscope')) visit(child)
        }
      }
      visit(root)
      return found
    }
    const value = node => node.attrs.content ?? (node.tag === 'a' || node.tag === 'link' ? node.attrs.href : null) ?? document.text(node)
    const scalar = (name, root = scope) => {
      const values = [...new Set(properties(name, root).map(value).filter(item => typeof item === 'string' && item.trim()).map(item => item.trim()))]
      if (values.length > 1) issues.add('ambiguous-native-microdata-' + name)
      return values.length === 1 ? values[0] : null
    }
    const organizations = properties('hiringOrganization').map(node => Object.hasOwn(node.attrs, 'itemscope') ? scalar('name', node) : value(node)).filter(Boolean)
    if (new Set(organizations).size > 1) issues.add('ambiguous-native-microdata-employer')
    const title = scalar('title')
    const descriptions = [...new Set(properties('description').filter(node => !['meta', 'script'].includes(node.tag)).map(node => document.text(node)).filter(Boolean))]
    if (descriptions.length > 1) issues.add('ambiguous-native-microdata-description')
    const locations = properties('jobLocation').flatMap(place => properties('address', place)).map(address => ({
      address: Object.fromEntries(['addressLocality', 'addressRegion', 'addressCountry', 'postalCode', 'streetAddress'].map(name => [name, scalar(name, address)])),
    }))
    const visibleLocations = []
    const visitLocations = parent => {
      for (const child of parent.children) {
        if (typeof child === 'string' || child.inert || Object.hasOwn(child.attrs, 'itemscope')) continue
        if ((child.attrs.class || '').split(/\s+/).includes('jobGeoLocation')) visibleLocations.push(document.text(child))
        visitLocations(child)
      }
    }
    visitLocations(scope)
    // RMK sometimes writes the first two letters of a country name into its
    // microdata, including "In" for Indonesia. Correlate its own full visible
    // worksite label before interpreting those letters as an ISO country code.
    for (const location of locations) {
      const address = location.address, original = address.addressCountry
      if (address.streetAddress && !address.addressLocality) {
        const worksite = streetWorksite(address.streetAddress, visibleLocations)
        if(worksite?.countryOnly&&!countryOnlyVisible(document,scope,html,cleanWorksite(address.streetAddress))){
          issues.add('native-country-only-visible-worksite-unqualified');continue
        }
        if (worksite) {
          if (original && nativeCountryName(original) !== worksite.country) {
            issues.add('native-microdata-country-conflict'); continue
          }
          address.nativeAddressCountry = original
          address.addressCountry = worksite.country
          address.addressLocality = worksite.locality
          if (worksite.countryOnly) address.nativeCountryOnlyWorksite = {
            country: worksite.country, literalCountryLabel: address.streetAddress, matchedVisibleLabels: [...visibleLocations],
          }
          continue
        }
        if (!nativeCountryName(original)) {
          issues.add(visibleLocations.length ? 'native-microdata-visible-country-unresolved' : 'native-location-scope-unresolved'); continue
        }
      }
      if (!visibleLocations.length) continue
      const labels = [...new Set(visibleLocations)].filter(label => address.addressLocality
        && label.toLowerCase().startsWith(address.addressLocality.toLowerCase() + ','))
      const countries = [...new Set(labels.map(label => {
        const parts = label.split(',').map(part => part.trim())
        const tail = parts.at(-1)
        return nativeCountryName(tail)
          || (/\d/.test(tail || '') ? nativeCountryName(parts.at(-2)) : null)
      }).filter(Boolean))]
      if (countries.length !== 1) { issues.add('native-microdata-visible-country-unresolved'); continue }
      const resolved = countries[0]
      if (nativeCountryName(original) !== resolved
        && !(typeof original === 'string' && /^[a-z]{2}$/i.test(original) && resolved.toLowerCase().startsWith(original.toLowerCase()))) {
        issues.add('native-microdata-country-conflict'); continue
      }
      address.nativeAddressCountry = original
      address.addressCountry = resolved
    }
    const url = scalar('url') || scope.attrs.itemid || pageURL
    const datePosted = scalar('datePosted'), validThrough = scalar('validThrough'), employmentType = scalar('employmentType')
    return { '@type': 'JobPosting', nativeRepresentation: 'html-microdata', nativeMicrodataIssues: [...issues],
      nativeVisibleTitleConfirmed: properties('title').some(node => !['meta', 'link'].includes(node.tag) && document.text(node) === title),
      title, description: descriptions.length === 1 ? descriptions[0] : null,
      url,
      hiringOrganization: new Set(organizations).size === 1 ? { name: organizations[0] } : null,
      jobLocation: locations, datePosted, validThrough, employmentType }
  })
}
