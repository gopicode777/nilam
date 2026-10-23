import { createRoot } from 'react-dom/client';
import App from './App';
import { initAuth } from './api';
import './styles.css';
initAuth();
createRoot(document.getElementById('root')!).render(<App />);
