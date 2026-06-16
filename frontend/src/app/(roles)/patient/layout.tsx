import { PatientBottomNav } from "@/components/layout/PatientBottomNav";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="pb-16 md:pb-0">{children}</div>
      <PatientBottomNav />
    </>
  );
}
