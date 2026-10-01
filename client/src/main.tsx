import React from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import NewCase from './pages/NewCase';
import CasePage from './pages/CasePage';
import Sources from './pages/Sources';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="new" element={<NewCase />} />
          <Route path="cases/:id/*" element={<CasePage />} />
          <Route path="sources" element={<Sources />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
