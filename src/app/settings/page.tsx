import Navbar, { Footer } from "@/components/Navbar";
import SettingsPage from "@/components/settings/SettingsPage";

export const metadata = { title: "Settings — MapForge" };

export default function Settings() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh]">
        <SettingsPage />
      </main>
      <Footer />
    </>
  );
}
