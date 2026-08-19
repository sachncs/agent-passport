import { lazy, Suspense } from 'react';
import { Toaster } from 'sonner';
import { Layout } from '@/components/layout/Layout';
import { Routes, Route, Navigate } from 'react-router-dom';

const TrustScorePage = lazy(() => import('@/pages/trust-score').then(m => ({ default: m.TrustScorePage })));
const PassportPage = lazy(() => import('@/pages/passport').then(m => ({ default: m.PassportPage })));
const UnderwritePage = lazy(() => import('@/pages/underwrite').then(m => ({ default: m.UnderwritePage })));
const DelegationPage = lazy(() => import('@/pages/delegation').then(m => ({ default: m.DelegationPage })));
const SybilPage = lazy(() => import('@/pages/sybil').then(m => ({ default: m.SybilPage })));
const ReputationPage = lazy(() => import('@/pages/reputation').then(m => ({ default: m.ReputationPage })));
const DiscoveryPage = lazy(() => import('@/pages/discovery').then(m => ({ default: m.DiscoveryPage })));
const MonitorPage = lazy(() => import('@/pages/monitor').then(m => ({ default: m.MonitorPage })));
const CounterpartyPage = lazy(() => import('@/pages/counterparty').then(m => ({ default: m.CounterpartyPage })));
const EndorsePage = lazy(() => import('@/pages/endorse').then(m => ({ default: m.EndorsePage })));
const HomePage = lazy(() => import('@/pages/home').then(m => ({ default: m.HomePage })));

export default function App() {
  return (
    <>
      <Layout>
        <Suspense fallback={<div className="p-8 text-muted-foreground">Loading…</div>}>
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
        </Suspense>
      </Layout>
      <Toaster richColors position="top-right" closeButton />
    </>
  );
}