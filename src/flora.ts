import { MongoClient } from 'https://deno.land/x/mongo@v0.32.0/mod.ts'
import { processaZip, type DbIpt } from './lib/dwca.ts'

export const findTaxonByName = (
  obj: Record<string, { scientificName?: string }>,
  name: string
) => {
  return Object.values(obj).find(
    (taxon) => (taxon.scientificName as string).search(name) >= 0
  )
}

type FloraJson = Record<
  string,
  Record<
    string,
    string | Record<string, unknown> | Array<string | Record<string, unknown>>
  >
>
export const processaFlora = (dwcJson: FloraJson): FloraJson => {
  return Object.fromEntries(
    Object.entries(dwcJson).reduce((entries, [id, taxon]) => {
      const distribution = taxon.distribution as Record<
        string,
        Record<string, string>
      >[]
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
          Endemism: distribution[0]?.occurrenceRemarks.endemism,
          phytogeographicDomains:
            distribution[0]?.occurrenceRemarks.phytogeographicDomain,
          occurrence: distribution.map(({ locationID }) => locationID).sort(),
          vegetationType: (
            taxon.speciesprofile as Record<string, Record<string, string>>[]
          )?.[0]?.lifeForm?.vegetationType
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

      if (taxon.speciesprofile) {
        taxon.speciesprofile = (
          taxon.speciesprofile as Record<string, unknown>[]
        )[0]
        delete (taxon.speciesprofile.lifeForm as Record<string, unknown>)
          .vegetationType
      }

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
    }, [] as [string, FloraJson[string]][])
  )
}

export const processaFloraZip = async (url: string) => {
  const { json, ipt } = await processaZip(url)
  const floraJson = processaFlora(json)
  return { json: floraJson, ipt }
}
async function main() {
  if (Deno.args?.length === 0) {
    return
  }
  const [url] = Deno.args
  const { json, ipt } = await processaFloraZip(url)
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
    console.log(
      await collection.deleteMany({
        $or: [{ kingdom: 'Plantae' }, { kingdom: 'Fungi' }]
      })
    )
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
      { $set: { _id, ...iptDb, ipt: 'flora', set: 'flora' } },
      { upsert: true }
    )
  }
  console.log('Creating indexes')
  await collection.createIndexes({
    indexes: [
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
    ]
  })
  console.debug('Done')
}

main()
