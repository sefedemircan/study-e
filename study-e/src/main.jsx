import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import App from './App.jsx'

const theme = createTheme({
  primaryColor: 'navy',
  colors: {
    navy: [
      '#E5E8F0',
      '#CCD1E1',
      '#99A3C3',
      '#6675A5',
      '#334787',
      '#002366',
      '#001C52',
      '#00153D',
      '#000E29',
      '#000714'
    ],
    orange: [
      '#FFF0E6',
      '#FFD9BF',
      '#FFC299',
      '#FFAA72',
      '#FF934C',
      '#FF7B26',
      '#E65C00',
      '#BF4C00',
      '#993D00',
      '#732E00'
    ]
  }
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications />
      <App />
    </MantineProvider>
  </StrictMode>,
)
