import { useEffect } from 'react'
import '/src/lib/arf.css'

// Declare the init function from arf.js
declare global {
  function init(data: any): void
}

export default function Tree() {
  useEffect(() => {
    fetch('/api/tree')
      .then((res) => res.json())
      .then((data) => {
        init(data)
      })
  }, [])

  return null
}
