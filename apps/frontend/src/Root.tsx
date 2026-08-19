import { ThemeProvider as NextThemesProvider } from "next-themes"
import { BrowserRouter } from "react-router-dom"

import App from "./App"

export default function Root() {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </NextThemesProvider>
  )
}
