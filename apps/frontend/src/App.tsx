import { Suspense, lazy } from "react"
import { Route, Routes } from "react-router-dom"

import { Layout } from "@/components/layout/Layout"
import { Spinner } from "@/components/widgets/Spinner"

const Home = lazy(() => import("@/pages/home"))
const TrustScore = lazy(() => import("@/pages/trust-score"))
const Passport = lazy(() => import("@/pages/passport"))
const Underwrite = lazy(() => import("@/pages/underwrite"))
const Delegation = lazy(() => import("@/pages/delegation"))
const Sybil = lazy(() => import("@/pages/sybil"))
const Reputation = lazy(() => import("@/pages/reputation"))
const Counterparty = lazy(() => import("@/pages/counterparty"))
const Endorse = lazy(() => import("@/pages/endorse"))
const Discovery = lazy(() => import("@/pages/discovery"))
const Monitor = lazy(() => import("@/pages/monitor"))
const NotFound = lazy(() => import("@/pages/not-found"))

export default function App() {
  return (
    <Layout>
      <Suspense fallback={<Spinner className="mt-12" />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/score" element={<TrustScore />} />
          <Route path="/passport" element={<Passport />} />
          <Route path="/underwrite" element={<Underwrite />} />
          <Route path="/delegation" element={<Delegation />} />
          <Route path="/sybil" element={<Sybil />} />
          <Route path="/reputation" element={<Reputation />} />
          <Route path="/counterparty" element={<Counterparty />} />
          <Route path="/endorse" element={<Endorse />} />
          <Route path="/discovery" element={<Discovery />} />
          <Route path="/monitor" element={<Monitor />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  )
}
