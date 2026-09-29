import Navbar, { Footer } from "@/components/Navbar";
import HelpPage from "@/components/help/HelpPage";

export const metadata = { title: "Help — MapForge" };

export default function Help() {
  return (
    <>
      <Navbar />
      <main>
        <HelpPage />
      </main>
      <Footer />
    </>
  );
}
