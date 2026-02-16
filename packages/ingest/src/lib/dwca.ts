import { Database, Statement } from 'bun:sqlite'
import cliProgress from 'cli-progress'
import extract from 'extract-zip'
import { XMLParser } from 'fast-xml-parser'
import { once } from 'node:events'
import { createReadStream, createWriteStream } from 'node:fs'
import { mkdir, readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'

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

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@'
})

const _parseJsonEntry = (entry: CoreSpec | ExtensionSpec) => {
  const fields: string[] = []
  fields[(entry.id ?? entry.coreid)['@index']] = 'INDEX'
  if (!Array.isArray(entry.field)) {
    entry.field = [entry.field]
  }
  entry.field.forEach((field) => {
    fields[field['@index']] = field['@term'].split('/').pop()!
  })
  return { file: entry.files.location, fields }
}

const streamProcessor = async (
  fileName: string,
  lineCallback: (line: string) => void
) => {
  const stream = createReadStream(fileName, { encoding: 'utf-8' })
  let lineRemainder = ''
  let skippedFirstLine = false
  try {
    for await (const chunk of stream) {
      const data = lineRemainder + chunk
      const lines = data.split('\n')
      lineRemainder = lines.pop() ?? ''
      for (const line of lines) {
        if (!skippedFirstLine) {
          skippedFirstLine = true
          continue
        }
        lineCallback(line)
      }
    }
    if (lineRemainder) {
      if (!skippedFirstLine) {
        skippedFirstLine = true
      } else {
        lineCallback(lineRemainder)
      }
    }
  } finally {
    stream.close()
  }
}

const _addLineToObj = (line: string, fields: string[], obj: DwcJson) => {
  const values = line.replace(/\r$/, '').split('\t')
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
  const extensionName = path.parse(filePath).name
  let unknownCount = 0
  console.log(`Adding ${extensionName}`)
  await streamProcessor(filePath, (line) => {
    const values = line.replace(/\r$/, '').split('\t')
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
      fields.reduce(
        (acc, field, index) => {
          if (field !== 'INDEX' && values[index]) {
            acc[field] =
              values[index].charAt(0) === '{'
                ? jsonSafeParse(values[index])
                : values[index]
          }
          return acc
        },
        {} as Record<string, unknown>
      )
    )
  })
  if (unknownCount > 0) {
    console.log(`Unknown ${unknownCount}`)
  }
}

export const buildJson = async (folder: string) => {
  const contents = await readFile(path.join(folder, 'meta.xml'), 'utf-8')
  const { archive } = xmlParser.parse(contents) as unknown as {
    archive: { core: CoreSpec; extension: ExtensionSpec[] }
  }
  const ref = {
    core: _parseJsonEntry(archive.core),
    extensions: (Array.isArray(archive.extension)
      ? archive.extension
      : [archive.extension].filter(Boolean)
    ).map(_parseJsonEntry)
  }
  const root = await getFileFields(
    path.join(folder, ref.core!.file),
    ref.core!.fields
  )
  for (const extension of ref.extensions) {
    await addExtension(
      root,
      path.join(folder, extension!.file),
      extension!.fields
    )
  }
  return {
    json: root,
    ipt: processaEml(
      extractEml(
        xmlParser.parse(
          await readFile(path.join(folder, 'eml.xml'), 'utf-8')
        ) as OuterEml
      )
    )
  }
}

const _addLineToTable = (
  stmt: Statement<unknown, [string, string]>,
  line: string,
  fields: string[],
  indexPosition: number
) => {
  const values = line.replace(/\r$/, '').split('\t')
  const id = values[indexPosition]
  if (!id) {
    return
  }
  const obj: RU = {}
  fields.forEach((field, index) => {
    if (field !== 'INDEX' && values[index]) {
      obj[field] = values[index]
    }
  })
  stmt.run(id, JSON.stringify(obj))
}

export const buildSqlite = async (folder: string, chunkSize = 5000) => {
  const db = new Database(':memory:')
  db.exec('CREATE TABLE core (id TEXT PRIMARY KEY, json TEXT)')

  const contents = await readFile(path.join(folder, 'meta.xml'), 'utf-8')
  const { archive } = xmlParser.parse(contents) as unknown as {
    archive: { core: CoreSpec; extension: ExtensionSpec[] }
  }
  const ref = {
    core: _parseJsonEntry(archive.core),
    extensions: (Array.isArray(archive.extension)
      ? archive.extension
      : [archive.extension].filter(Boolean)
    ).map(_parseJsonEntry)
  }
  const extensionRefs = ref.extensions.filter(Boolean)

  const multibar = new cliProgress.MultiBar(
    {
      clearOnComplete: false,
      hideCursor: true,
      format: ' {bar} | {filename} | {value}/{total}'
    },
    cliProgress.Presets.shades_grey
  )

  const stageBar = multibar.create(extensionRefs.length + 1, 0)
  stageBar.increment(0, { filename: ref.core!.file })

  const coreIndexPosition = ref.core!.fields.indexOf('INDEX')
  const coreInsert = db.prepare<unknown, [string, string]>(
    'INSERT INTO core VALUES (?, ?)'
  )
  let coreLineCount = 0
  await streamProcessor(path.join(folder, ref.core!.file), () => {
    coreLineCount++
  })
  const coreProgress = multibar.create(coreLineCount || 1, 0, {
    filename: ref.core!.file
  })
  db.exec('BEGIN TRANSACTION')
  try {
    await streamProcessor(path.join(folder, ref.core!.file), (line) => {
      _addLineToTable(coreInsert, line, ref.core!.fields, coreIndexPosition)
      coreProgress.increment()
    })
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    multibar.remove(coreProgress)
    coreInsert.finalize()
    multibar.stop()
    throw error
  }
  multibar.remove(coreProgress)
  coreInsert.finalize()
  stageBar.increment(1)

  for (const extension of extensionRefs) {
    const tableName = path.parse(extension.file).name
    stageBar.increment(0, { filename: extension.file })
    db.exec(`CREATE TABLE ${tableName} (id TEXT, json TEXT)`)
    db.exec(`CREATE INDEX idx_${tableName}_id ON ${tableName} (id)`)

    const insertStmt = db.prepare<unknown, [string, string]>(
      `INSERT INTO ${tableName} VALUES (?, ?)`
    )
    const indexPosition = extension.fields.indexOf('INDEX')
    let lineCount = 0
    await streamProcessor(path.join(folder, extension.file), () => {
      lineCount++
    })
    const extensionProgress = multibar.create(lineCount || 1, 0, {
      filename: extension.file
    })
    db.exec('BEGIN TRANSACTION')
    try {
      await streamProcessor(path.join(folder, extension.file), (line) => {
        _addLineToTable(insertStmt, line, extension.fields, indexPosition)
        extensionProgress.increment()
      })
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      multibar.remove(extensionProgress)
      insertStmt.finalize()
      multibar.stop()
      throw error
    }
    multibar.remove(extensionProgress)
    insertStmt.finalize()
    stageBar.increment(1)
  }

  multibar.stop()

  const extensionNames = extensionRefs.map((ext) => path.parse(ext.file).name)

  const buildBatchQuery = (offset: number) => {
    const batchRange = `BatchIDRange AS (
      SELECT MIN(id) as min_id, MAX(id) as max_id
      FROM (
          SELECT id
          FROM core
          ORDER BY id
          LIMIT ${chunkSize} OFFSET ${offset}
      )
    )`
    const extensionCtes = extensionNames.map(
      (ext) => `Aggregated${ext} AS (
        SELECT id, json_group_array(json(json)) AS json
        FROM ${ext}
        WHERE id >= (SELECT min_id FROM BatchIDRange)
          AND id <= (SELECT max_id FROM BatchIDRange)
        GROUP BY id
      )`
    )
    const withClause = [batchRange, ...extensionCtes].join(',\n      ')
    const joins = extensionNames
      .map(
        (ext) => `
      LEFT JOIN Aggregated${ext} ON c.id = Aggregated${ext}.id`
      )
      .join('')
    const jsonPatchExpr = extensionNames.length
      ? `json_patch(c.json, json_object(${extensionNames
          .map((ext) => `'${ext}', json(Aggregated${ext}.json)`)
          .join(', ')}))`
      : 'c.json'
    return `WITH ${withClause}
    SELECT
      c.id,
      ${jsonPatchExpr} AS json
    FROM
      core c${joins}
    WHERE c.id >= (SELECT min_id FROM BatchIDRange)
      AND c.id <= (SELECT max_id FROM BatchIDRange)
    ORDER BY c.id;`
  }

  return {
    get length() {
      const row = db.query('SELECT COUNT(id) as count FROM core').get() as
        | { count: number }
        | undefined
      return row?.count ?? 0
    },
    *[Symbol.iterator]() {
      let offset = 0
      while (true) {
        const queryString = buildBatchQuery(offset)
        let rows: { id: string; json: string | null }[] = []
        try {
          rows = db.query(queryString).all() as {
            id: string
            json: string | null
          }[]
        } catch (e) {
          console.log(
            `\n\nSQLITE ERROR: ${(e as Error).name}\n ${(e as Error).message}\n\n${queryString}\n\n`
          )
          throw e
        }
        if (!rows.length) {
          break
        }
        const batch = rows.map(({ id, json }) => [
          id,
          json ? JSON.parse(json) : {}
        ]) as [string, RU][]
        yield batch
        offset += chunkSize
      }
      db.close()
      return null
    }
  }
}

type RU = Record<string, unknown>

type DownloadOptions = {
  dir: string
  file: string
}

async function downloadWithTimeout(
  url: string,
  options: DownloadOptions,
  timeoutMs = 10000
) {
  const controller = new AbortController()
  const requestTimeout = setTimeout(() => controller.abort(), timeoutMs)
  let inactivityId: ReturnType<typeof setTimeout> | undefined

  const resetInactivity = () => {
    if (inactivityId !== undefined) clearTimeout(inactivityId)
    inactivityId = setTimeout(() => controller.abort(), timeoutMs)
  }

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(requestTimeout)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }

    await mkdir(options.dir, { recursive: true })

    const filePath = path.join(options.dir, options.file)
    const writeStream = createWriteStream(filePath)

    try {
      const body = response.body
      if (!body) {
        throw new Error('Response body is empty')
      }
      const reader = Readable.fromWeb(body as any)
      resetInactivity()
      for await (const chunk of reader) {
        resetInactivity()
        if (!writeStream.write(chunk)) {
          await once(writeStream, 'drain')
        }
      }
      writeStream.end()
      await once(writeStream, 'finish')
    } catch (error) {
      writeStream.destroy()
      throw error
    } finally {
      if (inactivityId !== undefined) clearTimeout(inactivityId)
    }
  } catch (error) {
    if (inactivityId !== undefined) clearTimeout(inactivityId)
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Download inactivity timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    clearTimeout(requestTimeout)
  }
}

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
  try {
    await downloadWithTimeout(url, { file: 'temp.zip', dir: '.temp' })
  } catch (error: any) {
    // Handle 404 errors when IPT resources no longer exist
    if (
      error.name === 'Http' &&
      (error.message.includes('404') || error.message.includes('Not Found'))
    ) {
      throw error // Re-throw to be handled by caller
    }
    throw error // Re-throw any other errors
  }

  try {
    await extract(path.join('.temp', 'temp.zip'), {
      dir: path.resolve('.temp')
    })
    const ret = sqlite
      ? await buildSqlite('.temp', chunkSize)
      : await buildJson('.temp')
    return ret
  } finally {
    // Always clean up temporary files
    try {
      await rm('.temp', { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  }
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
export const getEml = async (url: string, timeoutMs = 10000) => {
  const controller = new AbortController()
  let timeoutId: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort()
      reject(new Error(`Request timeout after ${timeoutMs}ms`))
    }, timeoutMs)
  })

  try {
    const contents = (await Promise.race([
      fetch(url, { signal: controller.signal }).then((res) => {
        if (!res.ok) {
          throw new Error(res.statusText)
        }
        return res.text()
      }),
      timeoutPromise
    ])) as string

    return extractEml(xmlParser.parse(contents) as OuterEml)
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      throw new Error(`Request timeout after ${timeoutMs}ms`)
    }
    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
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
