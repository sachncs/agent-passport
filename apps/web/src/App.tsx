import { Toaster } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { Routes, Route, Navigate } from 'react-router-dom';
import { TrustScorePage } from '@/pages/trust-score';
import { PassportPage } from '@/pages/passport';
import { UnderwritePage } from '@/pages/underwrite';
import { DelegationPage } from '@/pages/delegation';
import { SybilPage } from '@/pages/sybil';
import { ReputationPage } from '@/pages/reputation';
import { DiscoveryPage } from '@/pages/discovery';
import { MonitorPage } from '@/pages/monitor';
import { CounterpartyPage } from '@/pages/counterparty';
import { EndorsePage } from '@/pages/endorse';
import { HomePage } from '@/pages/home';

export default function App() {
  return (
    <>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/score" element={<TrustScorePage />} />
          <Route path="/passport" element={<PassportPage />} />
          <Route path="/underwrite" element={<UnderwritePage />} />
          <Route path="/delegation" element={<DelegationPage />} />
          <Route path="/sybil" element={<SybilPage />} />
          <Route path="/reputation" element={<ReputationPage />} />
          <Route path="/counterparty" element={<CounterpartyPage />} />
          <Route path="/endorse" element={<EndorsePage />} />
          <Route path="/discovery" element={<DiscoveryPage />} />
          <Route path="/monitor" element={<MonitorPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
      <Toaster richColors position="top-right" closeButton />
    </>
  );
}