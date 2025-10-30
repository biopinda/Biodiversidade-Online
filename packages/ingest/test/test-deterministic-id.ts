/**
 * Test file to verify deterministic ID generation prevents collisions
 */

import {
  buildOccurrenceDeterministicId,
  buildTaxonDeterministicId
} from '../src/utils/deterministic-id'

console.log('🧪 Testing Deterministic ID Generation\n')

// Test 1: Taxa IDs with different sources (flora vs fauna)
console.log('Test 1: Taxa IDs - Flora vs Fauna Collision Prevention')
const floraTaxon = buildTaxonDeterministicId({
  taxonID: '12345',
  source: 'flora'
})
const faunaTaxon = buildTaxonDeterministicId({
  taxonID: '12345',
  source: 'fauna'
})

console.log('  Flora taxon ID:', floraTaxon)
console.log('  Fauna taxon ID:', faunaTaxon)

if (floraTaxon === faunaTaxon) {
  console.log('  ❌ COLLISION DETECTED! IDs should be different')
  process.exit(1)
} else {
  console.log('  ✅ No collision - IDs are unique across sources')
}
console.log('')

// Test 2: Taxa IDs with same source
console.log('Test 2: Taxa IDs - Same Source, Different taxonIDs')
const floraTaxon1 = buildTaxonDeterministicId({
  taxonID: '12345',
  source: 'flora'
})
const floraTaxon2 = buildTaxonDeterministicId({
  taxonID: '67890',
  source: 'flora'
})

console.log('  Flora taxon 1:', floraTaxon1)
console.log('  Flora taxon 2:', floraTaxon2)

if (floraTaxon1 === floraTaxon2) {
  console.log('  ❌ COLLISION! Different taxonIDs should have different IDs')
  process.exit(1)
} else {
  console.log('  ✅ Different taxonIDs produce different IDs')
}
console.log('')

// Test 3: Taxa IDs without source (backward compatibility fallback)
console.log('Test 3: Taxa IDs - Without source (fallback)')
const taxonNoSource = buildTaxonDeterministicId({
  taxonID: '12345'
})

console.log('  Taxon without source:', taxonNoSource)

if (taxonNoSource === '12345') {
  console.log('  ✅ Falls back to taxonID only when source not provided')
} else {
  console.log('  ❌ Fallback not working correctly')
  process.exit(1)
}
console.log('')

// Test 4: Occurrence IDs
console.log('Test 4: Occurrence IDs - IPT-based uniqueness')
const occurrence1 = buildOccurrenceDeterministicId(
  { occurrenceID: 'OCC-001' },
  'ipt-resource-1'
)
const occurrence2 = buildOccurrenceDeterministicId(
  { occurrenceID: 'OCC-001' },
  'ipt-resource-2'
)

console.log('  Occurrence from IPT 1:', occurrence1)
console.log('  Occurrence from IPT 2:', occurrence2)

if (occurrence1 === occurrence2) {
  console.log(
    '  ❌ COLLISION! Same occurrenceID from different IPTs should be unique'
  )
  process.exit(1)
} else {
  console.log('  ✅ Same occurrenceID from different IPTs are unique')
}
console.log('')

// Test 5: Real-world scenario
console.log('Test 5: Real-world Flora vs Fauna Scenario')
console.log('  Scenario: Both flora and fauna have taxonID "FB12345"')

const floraReal = buildTaxonDeterministicId({
  taxonID: 'FB12345',
  source: 'flora'
})
const faunaReal = buildTaxonDeterministicId({
  taxonID: 'FB12345',
  source: 'fauna'
})

console.log('  Flora document _id:', floraReal)
console.log('  Fauna document _id:', faunaReal)

if (floraReal === faunaReal) {
  console.log("  ❌ REAL-WORLD COLLISION! This is the bug we're fixing")
  process.exit(1)
} else {
  console.log('  ✅ Flora and fauna documents have unique IDs')
}
console.log('')

// Test 6: ID format verification
console.log('Test 6: ID Format Verification')
console.log('  Expected format: P{taxonID} for flora, A{taxonID} for fauna')

if (floraReal === 'PFB12345') {
  console.log('  ✅ Flora ID format is correct (P prefix)')
} else {
  console.log('  ❌ Flora ID format is incorrect:', floraReal)
  process.exit(1)
}

if (faunaReal === 'AFB12345') {
  console.log('  ✅ Fauna ID format is correct (A prefix)')
} else {
  console.log('  ❌ Fauna ID format is incorrect:', faunaReal)
  process.exit(1)
}
console.log('')

console.log('🎉 All tests passed! Collision issue is fixed.')
console.log('')
console.log('Summary:')
console.log('  - Taxa IDs now use A prefix for fauna (Animalia)')
console.log('  - Taxa IDs now use P prefix for flora (Plantae)')
console.log('  - Format: P{taxonID} or A{taxonID}')
console.log('  - Flora and fauna with same taxonID get unique _id values')
console.log('  - Backward compatible fallback when source not provided')
