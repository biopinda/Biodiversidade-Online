import { MongoClient } from 'mongodb'
import { type DbIpt, processaZip } from './lib/dwca.ts'
import {
  initializeDataPreserver,
  preserveOriginalData
} from './lib/preservador-dados-originais.ts'

export const findTaxonByName = (
  obj: Record<string, { scientificName?: string }>,
  name: string
) => {
  return Object.values(obj).find(
    (taxon) => (taxon.scientificName as string).search(name) >= 0
  )
}

type FaunaJson = Record<
  string,
  Record<
    string,
    string | Record<string, unknown> | Array<string | Record<string, unknown>>
  >
>
export const processaFauna = (dwcJson: FaunaJson): FaunaJson => {
  return Object.fromEntries(
    Object.entries(dwcJson).reduce(
      (entries, [id, taxon]) => {
        const distribution = taxon.distribution as {
          locality: string
          countryCode: string
          establishmentMeans: string
        }[]
        if (
          !['ESPECIE', 'VARIEDADE', 'FORMA', 'SUB_ESPECIE'].includes(
            taxon.taxonRank as string
          )
        ) {
          return entries
        }
        if (distribution) {
          taxon.distribution = {
            origin: distribution[0]?.establishmentMeans,
            occurrence: distribution[0]?.locality?.split(';'),
            countryCode: distribution[0]?.countryCode?.split(';')
          }
        }
        if (taxon.resourcerelationship) {
          const resourcerelationship = taxon.resourcerelationship as Record<
            string,
            string | Record<string, string>
          >[]
          taxon.othernames = resourcerelationship.map((relationship) => ({
            taxonID: relationship.relatedResourceID,
            scientificName:
              dwcJson[relationship.relatedResourceID as string]?.scientificName,
            taxonomicStatus: relationship.relationshipOfResource
          }))
          delete taxon.resourcerelationship
        }

        // if (taxon.speciesprofile) {
        //   taxon.speciesprofile = (
        //     taxon.speciesprofile as Record<string, unknown>[]
        //   )[0]
        //   delete (taxon.speciesprofile.lifeForm as Record<string, unknown>)
        //     .vegetationType
        // }

        if (taxon.higherClassification) {
          // Usa somente segundo componente da string separada por ;
          // https://github.com/biopinda/Biodiversidade-Online/issues/13
          taxon.higherClassification = (
            taxon.higherClassification as string
          ).split(';')[1]
        }

        ;(
          taxon.vernacularname as { vernacularName: string; language: string }[]
        )?.forEach((entry) => {
          entry.vernacularName = entry.vernacularName
            .toLowerCase()
            .replace(/ /g, '-')
          entry.language =
            entry.language.charAt(0).toUpperCase() +
            entry.language.slice(1).toLowerCase()
        })

        taxon.kingdom = 'Animalia'
        taxon.canonicalName = [
          taxon.genus,
          taxon.genericName,
          taxon.subgenus,
          taxon.infragenericEpithet,
          taxon.specificEpithet,
          taxon.infraspecificEpithet,
          taxon.cultivarEpiteth
        ]
          .filter(Boolean)
          .join(' ')
        taxon.flatScientificName = (taxon.scientificName as string)
          .replace(/[^a-zA-Z0-9]/g, '')
          .toLocaleLowerCase()

        entries.push([id, taxon])
        return entries
      },
      [] as [string, FaunaJson[string]][]
    )
  )
}

export const processaFaunaZip = async (url: string) => {
  const { json, ipt } = await processaZip(url)
  const faunaJson = processaFauna(json)
  return { json: faunaJson, ipt }
}
async function main() {
  const [url] = process.argv.slice(2)
  if (!url) {
    console.error(
      'Usage: bun run --filter @darwincore/ingest fauna -- <dwc-a url>'
    )
    process.exit(1)
  }

  // MongoDB connection
  const mongoUri = process.env.MONGO_URI
  if (!mongoUri) {
    console.error('MONGO_URI environment variable is required')
    process.exit(1)
  }

  const client = new MongoClient(mongoUri, {
    serverSelectionTimeoutMS: 10000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 45000
  })

  try {
    console.log('Connecting to MongoDB...')
    await Promise.race([
      client.connect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('MongoDB connection timeout after 10s')),
          10000
        )
      )
    ])
    console.log('MongoDB connection established')
    const db = client.db('dwc2json')

    // Initialize preservation system (optional for now)
    let preservador: any = null
    try {
      preservador = initializeDataPreserver(db)
      console.debug('Data preservation system initialized')
    } catch (error) {
      console.warn(
        'Failed to initialize preservation system:',
        (error as Error).message
      )
    }

    // Process the DwC-A archive
    const { json, ipt } = await processaFaunaZip(url).catch((error) => {
      // Handle 404 errors when IPT resources no longer exist
      if (
        error.name === 'Http' &&
        (error.message.includes('404') ||
          error.message.includes('Not Found') ||
          error.message.includes('status 404'))
      ) {
        console.log(`Fauna resource no longer exists (404) - exiting`)
        process.exit(0)
      }
      // Re-throw other errors for proper error handling
      console.error(`Error downloading fauna data:`, error.message)
      throw error
    })

    const iptsCol = db.collection<DbIpt>('ipts')
    const collection = db.collection('taxa')
    const dbVersion = (
      (await iptsCol.findOne({ _id: ipt.id })) as DbIpt | undefined
    )?.version

    const taxaCount = await collection.countDocuments(
      { kingdom: 'Animalia' },
      { limit: 1 }
    )
    const dataExists = taxaCount > 0

    if (dbVersion === ipt.version && dataExists) {
      console.debug(`Fauna already on version ${ipt.version}`)
    } else {
      if (dbVersion === ipt.version && !dataExists) {
        console.warn(
          `IPT version ${ipt.version} matches but taxa collection is empty, re-ingesting...`
        )
      }
      console.debug(`Processing fauna data from ${ipt.id} v${ipt.version}`)

      // Step 1: Preserve original data (if preservation system is available)
      if (preservador) {
        try {
          console.debug('Preserving original data...')
          const preservationResult = await preserveOriginalData(
            json,
            ipt,
            'fauna',
            {
              batch_size: 5000
            }
          )

          if (
            preservationResult.status === 'success' ||
            preservationResult.status === 'partial'
          ) {
            console.log(
              `Preserved ${preservationResult.documents_preserved} original documents`
            )
            if (preservationResult.failed_documents > 0) {
              console.warn(
                `Failed to preserve ${preservationResult.failed_documents} documents`
              )
            }
          } else {
            console.warn(
              'Failed to preserve original data, continuing with transformation only'
            )
          }
        } catch (error) {
          console.warn(
            'Preservation failed, continuing with legacy approach:',
            (error as Error).message
          )
        }
      }

      // Step 2: Use already-transformed data from processaFaunaZip
      console.debug('Fauna data already transformed, preparing for storage...')

      // Step 3: Legacy storage approach (maintain compatibility)
      console.debug('Cleaning collection')
      const { deletedCount } = await collection.deleteMany({
        kingdom: 'Animalia'
      })
      console.log(`Deleted ${deletedCount ?? 0} existing fauna records`)

      console.debug('Inserting taxa')
      const taxa = Object.values(json)
      for (let i = 0, n = taxa.length; i < n; i += 5000) {
        console.log(`Inserting ${i} to ${Math.min(i + 5000, n)}`)
        await collection.insertMany(taxa.slice(i, i + 5000), { ordered: false })
      }

      console.debug(`Inserting IPT`)
      const { id: _id, ...iptDb } = ipt
      await iptsCol.updateOne(
        { _id: ipt.id },
        { $set: { _id, ...iptDb, ipt: 'fauna', set: 'fauna' } },
        { upsert: true }
      )
    }

    // Step 5: Create indexes
    console.log('Creating indexes')
    await collection.createIndexes([
      { key: { scientificName: 1 } },
      { key: { kingdom: 1 } },
      { key: { family: 1 } },
      { key: { genus: 1 } },
      { key: { taxonID: 1, kingdom: 1 } },
      { key: { canonicalName: 1 } },
      { key: { flatScientificName: 1 } }
    ])

    console.debug('Fauna processing completed successfully')
  } catch (error) {
    console.error('Error during fauna processing:', error)
    throw error
  } finally {
    try {
      await Promise.race([
        client.close(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('MongoDB close timeout')), 5000)
        )
      ])
    } catch (closeError) {
      console.warn('Warning: MongoDB close timeout, forcing exit')
    }
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fauna ingestion failed', error)
    process.exitCode = 1
  })
}
