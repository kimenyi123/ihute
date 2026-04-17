/**
 * Full-screen layout for the kiosk customer display.
 * Overrides the supplier sidebar layout so the orders board fills the entire screen.
 */
export default function KioskOrdersLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-slate-900">
            {children}
        </div>
    );
}
