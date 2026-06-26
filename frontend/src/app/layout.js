import { AuthProvider } from '../context/AuthContext';
import ParticleCanvas from '../components/ui/ParticleCanvas';
import '../app/globals.css'; // Direct structural link to your Tailwind styles

export const metadata = {
  title: 'DermaScan AI Ecosystem',
  description: 'Multi-Task Deep Learning Telehealth Portal',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full">
      <body className="bg-slate-950 text-slate-100 antialiased h-full overflow-x-hidden relative">
        <AuthProvider>
          {/* Immersive creative background running globally behind all system sub-components */}
          <ParticleCanvas />
          <div className="relative z-10 min-h-full flex flex-col">
            {children}
          </div>
        </AuthProvider>
      </body>
    </html>
  );
}