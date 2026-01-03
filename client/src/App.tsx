import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Container } from '@mui/material';
import Navbar from './components/Navbar';
import Dashboard from './pages/Dashboard';
import SpineLeafDeployment from './pages/SpineLeafDeployment';
import TenantManagement from './pages/TenantManagement';
import PortConfiguration from './pages/PortConfiguration';

function App() {
  return (
    <div className="App">
      <Navbar />
      <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/deployment" element={<SpineLeafDeployment />} />
          <Route path="/tenants" element={<TenantManagement />} />
          <Route path="/ports" element={<PortConfiguration />} />
        </Routes>
      </Container>
    </div>
  );
}

export default App;
