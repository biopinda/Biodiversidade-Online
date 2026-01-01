import { MongoClient } from 'mongodb'
import { type DbIpt, processaZip } from './lib/dwca.ts'
import {
  initializeDataPreserver,
  preserveOriginalData,
  saveTransformedWithReference
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

  const client = new MongoClient(mongoUri)

  try {
    console.log('Connecting to MongoDB...')
    await client.connect()
    console.log('MongoDB connection established')
    const db = client.db('dwc2json')

    // Initialize preservation system (optional for now)
    let preservador: any = null
    try {
      preservador = await initializeDataPreserver(mongoUri)
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

    if (dbVersion === ipt.version) {
      console.debug(`Fauna already on version ${ipt.version}`)
    } else {
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

      // Step 2: Transform data (existing logic)
      console.debug('Transforming fauna data...')
      const faunaJson = processaFauna(json)

      // Step 3: Legacy storage approach (maintain compatibility)
      console.debug('Cleaning collection')
      const { deletedCount } = await collection.deleteMany({
        kingdom: 'Animalia'
      })
      console.log(`Deleted ${deletedCount ?? 0} existing fauna records`)

      console.debug('Inserting taxa')
      const taxa = Object.values(faunaJson)
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

      // Step 4: Save transformed data with references (if preservation system is available)
      if (preservador) {
        try {
          console.debug('Saving transformed data with references...')
          const transformFunctions = [
            'processaFauna',
            'applyFaunaTransformations'
          ]
          const saveResult = await saveTransformedWithReference(
            taxa,
            ipt,
            'fauna',
            transformFunctions
          )

          if (saveResult.inserted > 0) {
            console.log(
              `Linked ${saveResult.inserted} transformed documents to originals`
            )
          }
          if (saveResult.failed > 0) {
            console.warn(
              `Failed to link ${saveResult.failed} documents:`,
              saveResult.errors
            )
          }
        } catch (error) {
          console.warn(
            'Failed to save transformation references:',
            (error as Error).message
          )
        }
      }
    }

    // Step 5: Create indexes (unchanged)
    console.log('Creating indexes')
    await collection.createIndexes([
      {
        key: { scientificName: 1 },
        name: 'scientificName'
      },
      {
        key: { kingdom: 1 },
        name: 'kingdom'
      },
      {
        key: { family: 1 },
        name: 'family'
      },
      {
        key: { genus: 1 },
        name: 'genus'
      },
      {
        key: { taxonID: 1, kingdom: 1 },
        name: 'taxonKingdom'
      },
      {
        key: { canonicalName: 1 },
        name: 'canonicalName'
      },
      { key: { flatScientificName: 1 }, name: 'flatScientificName' }
    ])

    console.debug('Fauna processing completed successfully')
  } catch (error) {
    console.error('Error during fauna processing:', error)
    throw error
  } finally {
    await client.close()
  }
}

if (import.meta.main) {
  main().catch((error) => {
    console.error('Fauna ingestion failed', error)
    process.exitCode = 1
  })
}
