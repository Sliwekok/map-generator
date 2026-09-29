import Navbar, { Footer } from "@/components/Navbar";
import MapsDashboard from "./MapsDashboard";

export default async function MapsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <>
      <Navbar />
      <main className="min-h-[70vh]">
        <MapsDashboard openWizard={sp.new === "1"} />
      </main>
      <Footer />
    </>
  );
}
