import fs from 'fs'
const j = JSON.parse(
  fs.readFileSync('packages/web/cache/map-initial-load.json', 'utf8')
)
const regions = j.regions
console.log('regions count', regions.length)
console.log(
  'has Outros?',
  regions.some((r) => r._id === 'Outros')
)
const suspicious = regions.filter((r) =>
  /\b(PY|Paraguay|Paraguai|CO|Colombia|Colômbia)\b/i.test(r._id)
)
console.log('suspicious entries:', suspicious.slice(0, 20))
