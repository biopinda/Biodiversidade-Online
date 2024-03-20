const MONGO_FILE = './src/lib/mongo.ts'

const op = Deno.args[0]

if (op === 'build') {
  const mongoFile = await Deno.readTextFile(MONGO_FILE)
  await Deno.writeTextFile(
    MONGO_FILE,
    mongoFile.replace('  isDeno ? ', '').replace(" : 'mongodb'", '')
  )
}
if (op === 'dev') {
  await new Deno.Command('git', {
    args: ['checkout', 'origin/main', '--', MONGO_FILE]
  }).output()
}
