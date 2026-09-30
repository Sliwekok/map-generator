import Navbar, { Footer } from "@/components/Navbar";
import HomePage from "@/components/home/HomePage";
import { demoMap } from "@/components/home/demoMap";
import { publicAssetSummary } from "@/lib/server/assets";

// Rendered per request so assets added to the assets/ folder show up without a rebuild.
export const dynamic = "force-dynamic";

const STRIP_MAX = 24;

export default function Home() {
  const { free, freeCount, accountExtra } = publicAssetSummary();
  const used = new Set(demoMap("").elements.flatMap((e) => (e.type === "asset" ? [e.assetId] : [])));
  const demoAssets = free.assets.filter((a) => used.has(a.id));
  const demoPattern = demoMap("").background.pattern;
  return (
    <>
      <Navbar />
      <main>
        <HomePage
          demoAssets={demoAssets}
          demoPatterns={free.patterns.filter((p) => p.id === demoPattern)}
          strip={free.assets.filter((a) => !a.hidden).slice(0, STRIP_MAX)}
          freeCount={freeCount}
          accountExtra={accountExtra}
        />
      </main>
      <Footer />
    </>
  );
}
