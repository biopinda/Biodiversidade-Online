import fs from 'fs/promises'

export const getJson = async (path: string) => {
  const string = await fs.readFile(path, 'utf-8')
  console.log('read file')
  return JSON.parse(string)
}

export const jsonPromise = getJson('../flora.json')
