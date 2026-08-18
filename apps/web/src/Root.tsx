import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './components/theme-provider';
import App from './App';

export default function Root() {
  return (
    <ThemeProvider defaultTheme="dark" storageKey="agent-passport-theme">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ThemeProvider>
  );
}