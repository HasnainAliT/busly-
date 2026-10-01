import { createContext, useContext } from 'react'

interface ShellValue {
  openScanner: () => void
}

export const ShellContext = createContext<ShellValue>({ openScanner: () => {} })

// eslint-disable-next-line react-refresh/only-export-components
export const useShell = () => useContext(ShellContext)
