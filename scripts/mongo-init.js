// MongoDB Initialization Script for Biodiversidade-Online
// This script runs when the MongoDB container starts for the first time

print('Starting MongoDB initialization for Biodiversidade-Online...')

// Switch to the biodiversidade database
db = db.getSiblingDB('biodiversidade')

// Create collections if they don't exist
try {
  // Taxa collection
  db.createCollection('taxa')
  print('✅ Created taxa collection')

  // Occurrences collection
  db.createCollection('ocorrencias')
  print('✅ Created ocorrencias collection')

  // Threatened species collections
  db.createCollection('faunaAmeacada')
  db.createCollection('cncfloraPlantae')
  db.createCollection('cncfloraFungi')
  print('✅ Created threatened species collections')

  // Invasive species collection
  db.createCollection('invasoras')
  print('✅ Created invasoras collection')

  // Phenological calendar collection/view
  db.createCollection('calFeno')
  print('✅ Created calFeno collection')
} catch (error) {
  print('⚠️ Some collections may already exist: ' + error)
}

// Create indexes for better performance
try {
  // Taxa indexes
  db.taxa.createIndex({ kingdom: 1 })
  db.taxa.createIndex({ taxonomicStatus: 1 })
  db.taxa.createIndex({ scientificName: 1 })
  db.taxa.createIndex({ taxonID: 1 })
  print('✅ Created taxa indexes')

  // Occurrences indexes
  db.ocorrencias.createIndex({ stateProvince: 1 })
  db.ocorrencias.createIndex({ kingdom: 1 })
  db.ocorrencias.createIndex({ scientificName: 1 })
  db.ocorrencias.createIndex({ kingdom: 1, class: 1, family: 1 })
  print('✅ Created ocorrencias indexes')

  // Compound index for taxonomic filtering
  db.ocorrencias.createIndex({
    kingdom: 1,
    phylum: 1,
    class: 1,
    order: 1,
    family: 1,
    genus: 1
  })
  print('✅ Created compound taxonomic index')
} catch (error) {
  print('⚠️ Error creating indexes: ' + error)
}

// Insert sample data for development (optional)
if (db.taxa.countDocuments() === 0) {
  try {
    db.taxa.insertMany([
      {
        kingdom: 'Animalia',
        phylum: 'Chordata',
        class: 'Mammalia',
        order: 'Primates',
        family: 'Hominidae',
        genus: 'Homo',
        specificEpithet: 'sapiens',
        scientificName: 'Homo sapiens',
        taxonomicStatus: 'NOME_ACEITO',
        taxonID: 'sample001'
      },
      {
        kingdom: 'Plantae',
        phylum: 'Magnoliophyta',
        class: 'Magnoliopsida',
        order: 'Rosales',
        family: 'Rosaceae',
        genus: 'Rosa',
        specificEpithet: 'rubiginosa',
        scientificName: 'Rosa rubiginosa',
        taxonomicStatus: 'NOME_ACEITO',
        taxonID: 'sample002'
      }
    ])
    print('✅ Inserted sample taxa data')
  } catch (error) {
    print('⚠️ Error inserting sample data: ' + error)
  }
}

if (db.ocorrencias.countDocuments() === 0) {
  try {
    db.ocorrencias.insertMany([
      {
        kingdom: 'Animalia',
        scientificName: 'Homo sapiens',
        stateProvince: 'São Paulo',
        country: 'Brazil'
      },
      {
        kingdom: 'Plantae',
        scientificName: 'Rosa rubiginosa',
        stateProvince: 'SP',
        country: 'Brazil'
      },
      {
        kingdom: 'Animalia',
        scientificName: 'Homo sapiens',
        stateProvince: 'Rio de Janeiro',
        country: 'Brazil'
      }
    ])
    print('✅ Inserted sample occurrence data')
  } catch (error) {
    print('⚠️ Error inserting sample occurrence data: ' + error)
  }
}

print('🎉 MongoDB initialization completed successfully!')
print('📊 Database status:')
print('  - Taxa documents: ' + db.taxa.countDocuments())
print('  - Occurrence documents: ' + db.ocorrencias.countDocuments())
print('  - Collections: ' + db.getCollectionNames().length)
