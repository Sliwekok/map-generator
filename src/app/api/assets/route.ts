import { getSessionUser } from "@/lib/server/auth";
import { accessKey, libraryFor } from "@/lib/server/assets";

export const dynamic = "force-dynamic";

// The asset library (all groups from assets/). Groups the user may not use are sent as a
// body-less catalog only, so their SVGs never reach guests.
export async function GET(req: Request) {
  const user = await getSessionUser();
  const lib = libraryFor(user);
  const etag = `"assets-${lib.version}-${accessKey(user)}"`;
  const headers = { ETag: etag, "Cache-Control": "private, no-cache", Vary: "Cookie" };
  if (req.headers.get("if-none-match") === etag) return new Response(null, { status: 304, headers });
  return Response.json(lib, { headers });
}
