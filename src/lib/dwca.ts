import { parse } from 'https://deno.land/x/xml@2.1.0/mod.ts'
import { download } from 'https://deno.land/x/download@v2.0.2/mod.ts'
import { decompress } from 'https://deno.land/x/zip@v1.2.5/mod.ts'
import { DB } from 'https://deno.land/x/sqlite@v3.8/mod.ts'
import cliProgress from 'npm:cli-progress'

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
type DwcJson = Record<
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
  for await (const chunk of file.readable) {
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
}

const _addLineToObj = (line: string, fields: string[], obj: DwcJson) => {
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
  const obj: DwcJson = {}
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
  obj: DwcJson,
  filePath: string,
  fields: string[]
) => {
  const extensionName = filePath.split('/').pop()?.split('.').shift() as string
  let unknownCount = 0
  console.log(`Adding ${extensionName}`)
  await streamProcessor(filePath, (line) => {
    const values = line.split('\t')
    const id = values[fields.indexOf('INDEX')]
    if (values.slice(1).every((v) => !v)) {
      return
    }
    if (!obj[id]) {
      unknownCount++
      return
    }
    if (!obj[id][extensionName]) {
      obj[id][extensionName] = []
    }
    ;(obj[id][extensionName] as Record<string, unknown>[]).push(
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
  if (unknownCount > 0) {
    console.log(`Unknown ${unknownCount}`)
  }
}

export const buildJson = async (folder: string) => {
  const contents = await Deno.readTextFile(`${folder}/meta.xml`)
  const { archive } = parse(contents) as unknown as {
    archive: { core: CoreSpec; extension: ExtensionSpec[] }
  }
  const ref = {
    core: _parseJsonEntry(archive.core),
    extensions: archive.extension.map(_parseJsonEntry)
  }
  const root = await getFileFields(
    `${folder}/${ref.core.file}`,
    ref.core.fields
  )
  for (const extension of ref.extensions) {
    await addExtension(root, `${folder}/${extension.file}`, extension.fields)
  }
  return {
    json: root,
    ipt: processaEml(
      extractEml(
        parse(await Deno.readTextFile(`${folder}/eml.xml`)) as OuterEml
      )
    )
  }
}

const _addLineToTable = (
  db: InstanceType<typeof DB>,
  line: string,
  fields: string[],
  table: string
) => {
  const values = line.split('\t')
  const id = values[fields.indexOf('INDEX')]
  if (id) {
    const obj: RU = {}
    fields.forEach((field, index) => {
      if (field !== 'INDEX' && values[index]) {
        obj[field] = values[index]
      }
    })
    db.query(`INSERT INTO ${table} VALUES (?, ?)`, [id, JSON.stringify(obj)])
  }
}

export const buildSqlite = async (folder: string, chunkSize = 5000) => {
  {
    const db = new DB(':memory:')
    db.execute('CREATE TABLE core (id TEXT PRIMARY KEY, json JSON)')
    const contents = await Deno.readTextFile(`${folder}/meta.xml`)
    const { archive } = parse(contents) as unknown as {
      archive: { core: CoreSpec; extension: ExtensionSpec[] }
    }
    const ref = {
      core: _parseJsonEntry(archive.core),
      extensions: (Array.isArray(archive.extension)
        ? archive.extension
        : [archive.extension].filter(Boolean)
      ).map(_parseJsonEntry)
    }
    const multibar = new cliProgress.MultiBar(
      {
        clearOnComplete: false,
        hideCursor: true,
        format: ' {bar} | {filename} | {value}/{total}'
      },
      cliProgress.Presets.shades_grey
    )
    const b1 = multibar.create(ref.extensions.length + 1, 0)
    let lineCount = 0
    await streamProcessor(`${folder}/${ref.core.file}`, (_line) => {
      lineCount++
    })
    const b2 = multibar.create(lineCount, 0, { filename: ref.core.file })
    b1.increment(1, { filename: ref.core.file })
    await streamProcessor(`${folder}/${ref.core.file}`, (line) => {
      _addLineToTable(db, line, ref.core.fields, 'core')
      b2.increment()
    })
    for (const extension of ref.extensions) {
      const tableName = extension.file.split('.')[0] as string
      // console.log(`prepping EXT:${tableName}`)
      db.execute(`CREATE TABLE ${tableName} (id, json JSON)`)
      db.execute(`CREATE INDEX idx_${tableName}_id ON ${tableName} (id)`)
      b1.increment(1, { filename: extension.file })
      let lineCount = 0
      await streamProcessor(`${folder}/${extension.file}`, (_line) => {
        lineCount++
      })
      b2.setTotal(lineCount)
      b2.update(0, { filename: extension.file })
      await streamProcessor(`${folder}/${extension.file}`, (line) => {
        _addLineToTable(db, line, extension.fields, tableName)
        b2.increment()
      })
      // console.log(db.query(`SELECT COUNT(*) FROM ${tableName}`)[0][0])
    }
    multibar.stop()
    const extensionNames = ref.extensions.map((ext) => ext.file.split('.')[0])

    return {
      get length() {
        return db.query(`SELECT COUNT(id) FROM core`)[0][0] as number
      },
      *[Symbol.iterator]() {
        let batch: [string, RU][] = []
        let offset = 0
        do {
          batch = db
            .query(
              `SELECT
              c.id,
              json_patch(c.json, json_object(
                ${extensionNames
                  .map((ext) =>
                    [
                      `'${ext}'`,
                      `json_group_array(json(${ext}.json)) filter (
                      where
                        ${ext}.json is not null
                    )`
                    ].join(', ')
                  )
                  .join(', ')}
              )) AS extended_json
            FROM
              core c
            ${extensionNames
              .map((ext) => `LEFT JOIN ${ext} ON c.id = ${ext}.id`)
              .join('\n')}
            GROUP BY
                c.id
            LIMIT ${chunkSize} OFFSET ${offset};`
            )
            .map(([id, json]) => [id, JSON.parse(json as string)]) as [
            string,
            RU
          ][]
          yield batch
          offset += chunkSize
        } while (batch.length > 0)
        db.close()
        return null
      }
    }
  }
}

type RU = Record<string, unknown>
export function processaZip(
  url: string,
  sqlite?: false,
  chunkSize?: number
): Promise<ReturnType<typeof buildJson>>
export function processaZip(
  url: string,
  sqlite: true,
  chunkSize?: number
): Promise<ReturnType<typeof buildSqlite>>
export async function processaZip(
  url: string,
  sqlite = false,
  chunkSize = 5000
): Promise<ReturnType<typeof buildJson> | ReturnType<typeof buildSqlite>> {
  await download(url, { file: 'temp.zip', dir: '.temp' })
  await decompress('.temp/temp.zip', '.temp')
  const ret = sqlite
    ? await buildSqlite('.temp', chunkSize)
    : await buildJson('.temp')
  await Deno.remove('.temp', { recursive: true })
  return ret
}

export type Eml = {
  '@packageId': string
  dataset: {
    alternateIdentifier: string[]
    title: string
    creator: RU
  } & RU
} & RU
type OuterEml = {
  'eml:eml': Eml
} & RU
const extractEml = (OuterEml: OuterEml) => OuterEml['eml:eml']
export const getEml = async (url: string) => {
  const contents = await fetch(url).then((res) => res.text())
  return extractEml(parse(contents) as OuterEml)
}

export type Ipt = {
  id: string
  version: string
} & Eml['dataset']
export const processaEml = (emlJson: Eml): Ipt => {
  const [id, version] =
    emlJson['@packageId'].match(/(.+)\/(.+)/)?.slice(1) ?? []
  return { id, version, ...emlJson.dataset }
}

export type DbIpt = {
  _id: Ipt['id']
  tag: string
  collection: string
} & Omit<Ipt, 'id'>
