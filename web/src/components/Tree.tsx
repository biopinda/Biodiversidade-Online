import { useEffect } from 'react'
import '/src/lib/arf.css'

export default function Tree() {
  useEffect(() => {
    fetch('/api/tree')
      .then((res) => res.json())
      .then((data) => {
        init(data)
      })
  }, [])

  return
}
