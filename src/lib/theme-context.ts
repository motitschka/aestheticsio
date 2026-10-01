import { createContext, useContext } from 'react'
import type { Theme } from './theme'

/** The theme dressing the app right now, or null for the default look. */
export const ThemeContext = createContext<Theme | null>(null)

export const useTheme = () => useContext(ThemeContext)
