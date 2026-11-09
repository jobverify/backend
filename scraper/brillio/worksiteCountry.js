// Reviewed 2026-10-27; Fort Lauderdale/South Florida corroboration added 2026-10-29.
// These aliases apply only inside explicit role-owned worksite clauses. A city
// label, headquarters, client geography, salary currency or visa statement is
// never sufficient. Every alternative in the clause must resolve consistently.
export const US_GEOGRAPHY_REFERENCES={
 states:'https://www.census.gov/library/reference/code-lists/ansi/ansi-codes-for-states.html',
 minneapolis:'https://www.census.gov/quickfacts/fact/table/minneapoliscityminnesota/PST045225',
 madison:'https://www.census.gov/quickfacts/fact/table/madisonboroughnewjersey/PST045225',
 manhattan:'https://portal.311.nyc.gov/article/?kanumber=KA-02877',
 boston:'https://www.mass.gov/info-details/greater-boston-region-housing-snapshot',
 southFlorida:'https://www.weather.gov/mfl/',
 fortLauderdale:'https://www.fortlauderdale.gov/Government/Departments/Community-Services/Economic-Development',
 seattle:'https://www.census.gov/quickfacts/fact/table/seattlecitywashington/PST045225',
}
const aliases=[
 [/^Minneapolis,\s*(?:MN|Minnesota)$/i,'Minneapolis, Minnesota','minneapolis'],
 [/^Madison,\s*(?:NJ|New Jersey)$/i,'Madison, New Jersey','madison'],
 [/^Manhattan$/i,'Manhattan, New York','manhattan'],
 [/^Greater Boston Area$/i,'Greater Boston area, United States (exact regional boundary unspecified)','boston'],
 [/^South Florida Area$/i,'South Florida area, United States','southFlorida'],
 [/^Greater Seattle Area,\s*(?:WA|Washington)$/i,'Greater Seattle, Washington','seattle'],
]
const clean=value=>value.replace(/\s+/g,' ').replace(/\s+,/g,',').replace(/,\s*$/,'').trim()
export const resolveWorksiteCountry=({location,description,roleWorksiteStatements,complete=false}={})=>{
 const contexts=[]
 // Runtime supplies actual visible paragraph/list-item field boundaries from
 // the native role DOM. A flattened description cannot turn an arbitrary
 // substring such as "Client Location:" into the standalone "Location:" field.
 const statements=Array.isArray(roleWorksiteStatements)?roleWorksiteStatements:[String(description||'')]
 for(const value of statements){
  const statement=String(value).trim()
  const field=statement.match(/^Location:\s*([\s\S]*?)(?=\s+(?:About Brillio|As a consultant|Job Description:|Role Responsibilities|The Role|Key Responsibilities)\b|$)/i)
  if(field)contexts.push(field[1].trim())
  for(const m of statement.matchAll(/(?:^|[.!?]\s+|\n)\s*This position is based in\s+([^.;]+)(?=[.;]|$)/gi))contexts.push(m[1].replace(/,\s*with\s+.*$/i,'').trim())
 }
 const unknown={country:null,method:'role-worksite-government-geography',contexts,alternatives:[],reason:!complete?'native-detail-incomplete':'native-worksite-missing-or-unresolved'}
 if(!complete||!contexts.length)return unknown
 const alternatives=[]
 for(const context of contexts){
  const body=context.replace(/^Hybrid\s+\d+\s+days\s+for\s+these\s+locations\s+/i,'').replace(/\s*\|\s*(?:Hybrid|Remote|Onsite|In office)\s*$/i,'')
  for(const raw of body.split(/\s*[|/]\s*/)){
   const worksite=clean(raw),alias=aliases.find(([pattern])=>pattern.test(worksite))
   if(!worksite||!alias)return{...unknown,alternatives,reason:'unresolved-or-conflicting-native-worksite-alternative'}
   const [,resolvedWorksite,key]=alias
   alternatives.push({worksite,resolvedWorksite,country:'United States',referenceUrls:[US_GEOGRAPHY_REFERENCES[key],US_GEOGRAPHY_REFERENCES.states]})
  }
 }
 // Reviewed city-only headers must be corroborated by a matching role-owned
 // clause. Different headers or an explicit India header remain unresolved.
 const corroborated=/^Minneapolis$/i.test(location||'')&&alternatives.some(a=>/^Minneapolis,/.test(a.worksite))
  ||/^Boston$/i.test(location||'')&&alternatives.some(a=>a.worksite==='Greater Boston Area')
  ||/^Fort Lauderdale$/i.test(location||'')&&alternatives.some(a=>a.worksite==='South Florida Area')
 if(!corroborated)return{...unknown,alternatives,reason:'native-header-and-worksite-context-not-corroborated'}
 if(/^Fort Lauderdale$/i.test(location||''))for(const alternative of alternatives){
  if(alternative.worksite==='South Florida Area')alternative.referenceUrls.push(US_GEOGRAPHY_REFERENCES.fortLauderdale)
 }
 return{country:'United States',method:'role-worksite-government-geography',contexts,alternatives,reason:null}
}
