import { MotionConfig, motion } from 'framer-motion';
import { StoreProvider, useStore } from './state/store';
import { Footer, Header } from './components/Shell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { Landing } from './pages/Landing';
import { SgpaFlow } from './pages/SgpaFlow';
import { CgpaFlow } from './pages/CgpaFlow';

/** View changes: the new view fades up quickly; the old one leaves instantly (no waiting on exits). */
function Routes() {
  const { state } = useStore();
  return (
    <motion.div key={state.view} initial={{ opacity: 0, transform: 'translateY(6px)' }} animate={{ opacity: 1, transform: 'translateY(0px)' }} transition={{ duration: 0.22, ease: [0.23, 1, 0.32, 1] }}>
      {state.view === 'landing' && <Landing />}
      {state.view === 'sgpa' && <SgpaFlow />}
      {state.view === 'cgpa' && <CgpaFlow />}
    </motion.div>
  );
}

export default function App() {
  return (
    <MotionConfig reducedMotion="user">
      <ErrorBoundary>
      <StoreProvider>
        <a href="#main" className="sr-only z-50 rounded-xl bg-surface px-4 py-2 text-fg focus:not-sr-only focus:fixed focus:left-3 focus:top-3">
          Skip to content
        </a>
        <div className="relative flex min-h-dvh flex-col">
          <Header />
          <main id="main" className="flex-1">
            <Routes />
          </main>
          <Footer />
        </div>
      </StoreProvider>
      </ErrorBoundary>
    </MotionConfig>
  );
}
