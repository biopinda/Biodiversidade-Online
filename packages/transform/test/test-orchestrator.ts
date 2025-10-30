/**
 * Test file to verify the refactored transform architecture works correctly
 */

import { executeTransformPipeline } from '../src/lib/orchestrator'
import type { RawOccurrenceDocument } from '../src/occurrences/normalizeOccurrence'
import { occurrenceNormalizationPipeline } from '../src/occurrences/transforms/pipeline'
import type { RawTaxonDocument } from '../src/taxa/normalizeTaxon'
import { taxaNormalizationPipeline } from '../src/taxa/transforms/pipeline'

console.log('🧪 Testing Transform Orchestrator\n')

// Test 1: Taxa normalization pipeline
console.log('Test 1: Taxa Normalization Pipeline')
const rawTaxon: RawTaxonDocument = {
  _id: 'test-taxon-1',
  taxonRank: 'ESPECIE',
  kingdom: 'Plantae',
  genus: 'Araucaria',
  specificEpithet: 'angustifolia',
  scientificName: 'Araucaria angustifolia',
  vernacularname: [
    { vernacularName: 'Pinheiro do Paraná', language: 'português' }
  ],
  distribution: [
    {
      establishmentMeans: 'Native',
      locationID: 'BR-PR',
      occurrenceRemarks: {
        endemism: 'Endemic',
        phytogeographicDomain: 'Mata Atlântica'
      }
    }
  ]
}

executeTransformPipeline(taxaNormalizationPipeline, rawTaxon)
  .then((result) => {
    if (result.success && result.document) {
      console.log('✅ Taxa transform succeeded')
      console.log('   - Canonical name:', result.document.canonicalName)
      console.log(
        '   - Flat scientific name:',
        result.document.flatScientificName
      )
      console.log('   - Kingdom:', result.document.kingdom)
      console.log('   - Vernacular names:', result.document.vernacularname)
      console.log(
        '   - Distribution:',
        JSON.stringify(result.document.distribution, null, 2)
      )
    } else {
      console.log('❌ Taxa transform failed')
      console.log('   - Failed at:', result.failedAt)
      console.log('   - Error:', result.error?.message)
    }
    console.log('')

    // Test 2: Taxa with invalid rank (should fail)
    console.log(
      'Test 2: Taxa with Invalid Rank (should fail at filter-by-taxon-rank)'
    )
    const invalidTaxon: RawTaxonDocument = {
      _id: 'test-taxon-2',
      taxonRank: 'REINO', // Invalid rank
      kingdom: 'Plantae'
    }

    return executeTransformPipeline(taxaNormalizationPipeline, invalidTaxon)
  })
  .then((result) => {
    if (!result.success) {
      console.log('✅ Correctly rejected invalid taxon')
      console.log('   - Failed at:', result.failedAt)
    } else {
      console.log('❌ Should have rejected invalid taxon rank')
    }
    console.log('')

    // Test 3: Occurrence normalization pipeline
    console.log('Test 3: Occurrence Normalization Pipeline')
    const rawOccurrence: RawOccurrenceDocument = {
      _id: 'test-occurrence-1',
      occurrenceID: '  test-occurrence-123  ',
      scientificName: 'Araucaria angustifolia',
      genus: 'Araucaria',
      specificEpithet: 'angustifolia',
      decimalLatitude: '-25.4284',
      decimalLongitude: '-49.2733',
      country: 'Brazil',
      stateProvince: 'Parana',
      county: 'curitiba',
      eventDate: '2024-01-15',
      iptKingdom: 'Plantae'
    }

    return executeTransformPipeline(
      occurrenceNormalizationPipeline,
      rawOccurrence
    )
  })
  .then((result) => {
    if (result.success && result.document) {
      console.log('✅ Occurrence transform succeeded')
      console.log('   - Occurrence ID:', result.document.occurrenceID)
      console.log('   - Canonical name:', result.document.canonicalName)
      console.log(
        '   - Flat scientific name:',
        result.document.flatScientificName
      )
      console.log('   - Geo point:', result.document.geoPoint)
      console.log('   - Country:', result.document.country)
      console.log('   - State:', result.document.stateProvince)
      console.log('   - County:', result.document.county)
      console.log('   - IPT Kingdoms:', result.document.iptKingdoms)
      console.log('   - Event date:', result.document.eventDate)
      console.log(
        '   - Year/Month/Day:',
        result.document.year,
        '/',
        result.document.month,
        '/',
        result.document.day
      )
    } else {
      console.log('❌ Occurrence transform failed')
      console.log('   - Failed at:', result.failedAt)
      console.log('   - Error:', result.error?.message)
    }
    console.log('')

    // Test 4: Non-Brazilian occurrence (should fail)
    console.log(
      'Test 4: Non-Brazilian Occurrence (should fail at check-brazilian)'
    )
    const nonBrazilianOccurrence: RawOccurrenceDocument = {
      _id: 'test-occurrence-2',
      scientificName: 'Species americanus',
      country: 'United States',
      decimalLatitude: '40.7128',
      decimalLongitude: '-74.0060'
    }

    return executeTransformPipeline(
      occurrenceNormalizationPipeline,
      nonBrazilianOccurrence
    )
  })
  .then((result) => {
    if (!result.success) {
      console.log('✅ Correctly filtered non-Brazilian occurrence')
      console.log('   - Failed at:', result.failedAt)
    } else {
      console.log('❌ Should have filtered non-Brazilian occurrence')
    }
    console.log('')

    console.log('🎉 All tests completed!')
  })
  .catch((error) => {
    console.error('❌ Test suite failed:', error)
    process.exit(1)
  })
