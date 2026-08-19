import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from 'next-themes';
import App from './App';

export default function Root() {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      storageKey="agent-passport-theme"
      enableSystem
      disableTransitionOnChange
    >
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  );
}