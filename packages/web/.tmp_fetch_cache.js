;(async () => {
  try {
    const r = await fetch('http://localhost:4321/cache/map-initial-load.json')
    console.log('status', r.status)
    const j = await r.json()
    console.log('total', j.total, 'regions', j.regions.length)
  } catch (e) {
    console.error('fetch failed', e)
    process.exit(1)
  }
})()
