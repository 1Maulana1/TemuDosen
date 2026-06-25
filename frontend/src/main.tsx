/**
 * App entry point.
 *
 * CRITICAL: await getCSRFToken() BEFORE rendering the router (Pitfall 3 prevention).
 * This ensures the csrftoken cookie is set by GET /api/csrf/ before any POST happens.
 * Without this, the first login POST would fail with "CSRF verification failed".
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import './index.css';
import { router } from './router';
import { getCSRFToken } from './api/auth';

async function bootstrap() {
  // Fetch CSRF token BEFORE rendering — ensures cookie is present before any POST (Pitfall 3)
  await getCSRFToken();

  const rootEl = document.getElementById('root');
  if (!rootEl) throw new Error('Root element #root not found in DOM.');

  createRoot(rootEl).render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>
  );
}

bootstrap();
