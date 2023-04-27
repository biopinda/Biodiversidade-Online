import fs from 'fs/promises'

const readRawJson = (path: string) => fs.readFile(path, 'utf-8')

const rawJsonPromise = readRawJson('../flora.json')
const jsonPromise: Promise<Record<string, Record<string, unknown>>> =
  rawJsonPromise.then(JSON.parse)

export const getRawJson = () => rawJsonPromise
export const getJson = () => jsonPromise
