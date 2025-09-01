import 'react'

declare module 'react' {
  export const unstable_ViewTransition: React.ComponentType<{
    children: React.ReactNode
    name?: string
    enter?: string | object
    exit?: string | object
    update?: string | object
    share?: string | object
    default?: string | object
  }>
}
