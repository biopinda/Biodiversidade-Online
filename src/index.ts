import { parse } from 'https://deno.land/x/xml@2.1.0/mod.ts'

type WithAttribute<A extends string, T> = {
  [key in `@${A}`]: T
}
type IndexedField = WithAttribute<'index', number>
type IndexedFieldWithTerm = IndexedField & WithAttribute<'term', string>
type BaseSpec = {
  files: {
    location: string
  }
  field: IndexedFieldWithTerm[]
}
type CoreSpec = BaseSpec & {
  id: IndexedField
}
type ExtensionSpec = BaseSpec & {
  id: undefined
  coreid: IndexedField
}
type ReturnObj = Record<
  string,
  Record<string, string | Record<string, unknown>[]>
>

const _parseJsonEntry = (entry: CoreSpec | ExtensionSpec) => {
  const fields = []
  fields[(entry.id ?? entry.coreid)['@index']] = 'INDEX'
  entry.field.forEach((field) => {
    fields[field['@index']] = field['@term'].split('/').pop()
  })
  return { file: entry.files.location, fields }
}

const streamProcessor = async (
  fileName: string,
  lineCallback: (line: string) => void
) => {
  const file = await Deno.open(fileName, { read: true })
  const decoder = new TextDecoder()
  let lineRemainder = ''
  let skippedFirstLine = false
  let chunkN = 0
  for await (const chunk of file.readable) {
    await Deno.stdout.write(
      new TextEncoder().encode(`Parsing chunk ${++chunkN} of ${fileName}\r`)
    )
    const lines = decoder.decode(chunk).split('\n')
    const lastLine = lines.pop()
    lines[0] = lineRemainder + lines[0]
    for (const line of lines) {
      if (skippedFirstLine) {
        lineCallback(line)
      } else {
        skippedFirstLine = true
      }
    }
    lineRemainder = lastLine ?? ''
  }
  if (lineRemainder) {
    lineCallback(lineRemainder)
  }
  await Deno.stdout.write(new TextEncoder().encode('\ndone\n'))
}

const _addLineToObj = (line: string, fields: string[], obj: ReturnObj) => {
  const values = line.split('\t')
  const id = values[fields.indexOf('INDEX')]
  if (id) {
    obj[id] = {}
    fields.forEach((field, index) => {
      if (field !== 'INDEX' && values[index]) {
        obj[id][field] = values[index]
      }
    })
  }
}
const getFileFields = async (fileName: string, fields: string[]) => {
  const obj: ReturnObj = {}
  await streamProcessor(fileName, (line) => {
    _addLineToObj(line, fields, obj)
  })
  return obj
}

const jsonSafeParse = (str: string) => {
  try {
    return JSON.parse(str)
  } catch (_e) {
    return str
  }
}

const addExtension = async (
  obj: ReturnObj,
  filePath: string,
  fields: string[]
) => {
  const extensionName = filePath.split('/').pop()?.split('.').shift() as string
  await streamProcessor(`dwca/${filePath}`, (line) => {
    const values = line.split('\t')
    const id = values[fields.indexOf('INDEX')]
    if (values.slice(1).every((v) => !v)) {
      return
    }
    if (!obj[id][extensionName]) {
      obj[id][extensionName] = []
    }
    (obj[id][extensionName] as Record<string, unknown>[]).push(
      fields.reduce((acc, field, index) => {
        if (field !== 'INDEX' && values[index]) {
          acc[field] =
            values[index].charAt(0) === '{'
              ? jsonSafeParse(values[index])
              : values[index]
        }
        return acc
      }, {} as Record<string, unknown>)
    )
  })
}

export const buildJson = async (fileName: string) => {
  const contents = await Deno.readTextFile(fileName)
  const { archive } = parse(contents) as unknown as {
    archive: { core: CoreSpec; extension: ExtensionSpec[] }
  }
  const ref = {
    core: _parseJsonEntry(archive.core),
    extensions: archive.extension.map(_parseJsonEntry)
  }
  const root = await getFileFields(`dwca/${ref.core.file}`, ref.core.fields)
  for (const extension of ref.extensions) {
    await addExtension(root, extension.file, extension.fields)
  }
  return root
}

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
    Object.entries(dwcJson).map(([id, taxon]) => {
      const distribution = taxon.distribution as Record<
        string,
        Record<string, string>
      >[]
      if (!distribution) return [id, taxon]
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

      return [id, taxon]
    })
  )
}
