import { build } from 'vite';
import react from '@vitejs/plugin-react';

await build({
  root: process.cwd(),
  configFile: false,
  base: '/quark-customer-success/',
  plugins: [react()],
  optimizeDeps: { noDiscovery: true, include: ['react', 'react-dom', 'react/jsx-runtime', 'react/jsx-dev-runtime', 'lucide-react'] },
});
