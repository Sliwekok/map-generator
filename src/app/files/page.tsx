import Navbar, { Footer } from "@/components/Navbar";
import FilesPage from "@/components/files/FilesPage";

export const metadata = { title: "My files — MapForge" };

export default function Files() {
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh]">
        <FilesPage />
      </main>
      <Footer />
    </>
  );
}
