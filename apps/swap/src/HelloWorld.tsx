import React, {lazy, Suspense} from 'react';
import {Text} from 'react-native';

// Async boundary for Module Federation: the exposed entry only imports
// `react`/`react-native` (shared eagerly by the host). The implementation —
// which pulls in `react-redux`, `@reduxjs/toolkit` and `@shared/mobile-host-runtime`
// (declared non-eager) — is lazily imported so Federation can populate the
// shared scope before evaluating it.
const Impl = lazy(() => import('./HelloWorld.impl'));

interface HelloWorldProps {
  name?: string;
}

const HelloWorld: React.FC<HelloWorldProps> = props => (
  <Suspense fallback={<Text>Loading swap…</Text>}>
    <Impl {...props} />
  </Suspense>
);

export default HelloWorld;
