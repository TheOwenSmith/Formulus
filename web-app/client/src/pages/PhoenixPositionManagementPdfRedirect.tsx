import { useEffect } from 'react';

const PDF_FILE = 'Phoenix_Trader_Position_Management_System.pdf';

/** Hard-navigates to the static PDF so the request is served from /public, not React Router. */
export function PhoenixPositionManagementPdfRedirect() {
  useEffect(() => {
    const base = import.meta.env.BASE_URL;
    const prefix = base.endsWith('/') ? base : `${base}/`;
    window.location.replace(`${prefix}${PDF_FILE}`);
  }, []);
  return (
    <div className="min-h-screen bg-slate-900 text-white/90 flex items-center justify-center font-sans">
      Opening document…
    </div>
  );
}
