import { MongoClient } from 'https://deno.land/x/mongo@v0.32.0/mod.ts'
import { type DbIpt, processaZip } from './lib/dwca.ts'

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
    Object.entries(dwcJson).reduce((entries, [id, taxon]) => {
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
          countryCode: distribution[0]?.countryCode?.split(';'),
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
          taxonomicStatus: relationship.relationshipOfResource,
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
        // https://github.com/biopinda/DarwinCoreJSON/issues/13
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
        taxon.cultivarEpiteth,
      ]
        .filter(Boolean)
        .join(' ')
      taxon.flatScientificName = (taxon.scientificName as string)
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLocaleLowerCase()

      entries.push([id, taxon])
      return entries
    }, [] as [string, FaunaJson[string]][])
  )
}

export const processaFaunaZip = async (url: string) => {
  const { json, ipt } = await processaZip(url)
  const faunaJson = processaFauna(json)
  return { json: faunaJson, ipt }
}
async function main() {
  if (Deno.args?.length === 0) {
    return
  }
  const [url] = Deno.args
  const { json, ipt } = await processaFaunaZip(url).catch((error) => {
    // Handle 404 errors when IPT resources no longer exist
    if (
      error.name === 'Http' &&
      (error.message.includes('404') ||
        error.message.includes('Not Found') ||
        error.message.includes('status 404'))
    ) {
      console.log(`Fauna resource no longer exists (404) - exiting`)
      Deno.exit(0)
    }
    // Re-throw other errors for proper error handling
    console.error(`Error downloading fauna data:`, error.message)
    throw error
  })
  const client = new MongoClient()
  await client.connect(Deno.env.get('MONGO_URI') as string)
  const iptsCol = client.database('dwc2json').collection('ipts')
  const collection = client.database('dwc2json').collection('taxa')
  const dbVersion = (
    (await iptsCol.findOne({ _id: ipt.id })) as DbIpt | undefined
  )?.version
  if (dbVersion === ipt.version) {
    console.debug(`Fauna already on version ${ipt.version}`)
  } else {
    console.debug('Cleaning collection')
    console.log(await collection.deleteMany({ kingdom: 'Animalia' }))
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
  console.log('Creating indexes')
  await collection.createIndexes({
    indexes: [
      {
        key: { scientificName: 1 },
        name: 'scientificName',
      },
      {
        key: { kingdom: 1 },
        name: 'kingdom',
      },
      {
        key: { family: 1 },
        name: 'family',
      },
      {
        key: { genus: 1 },
        name: 'genus',
      },
      {
        key: { taxonID: 1, kingdom: 1 },
        name: 'taxonKingdom',
      },
      {
        key: { canonicalName: 1 },
        name: 'canonicalName',
      },
      { key: { flatScientificName: 1 }, name: 'flatScientificName' },
    ],
  })
  console.debug('Done')
}

main()
