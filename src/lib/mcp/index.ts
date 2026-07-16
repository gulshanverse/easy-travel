import { auth, defineMcp } from "@lovable.dev/mcp-js";

import whoami from "./tools/whoami";
import listTrips from "./tools/list-trips";
import getTrip from "./tools/get-trip";
import createTrip from "./tools/create-trip";

// The OAuth issuer MUST be the direct Supabase host — the .lovable.cloud
// proxy fails RFC 8414 issuer discovery. VITE_SUPABASE_PROJECT_ID is inlined
// as a literal at build time; the fallback keeps the issuer well-formed
// during the throwaway manifest-extract eval.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "easy-trip-mcp",
  title: "Easy Trip",
  version: "0.1.0",
  instructions:
    "Tools for the Easy Trip AI Travel Operating System. Use `whoami` to confirm the connected user, `list_trips` to browse their trips, `get_trip` to inspect one trip in full, and `create_trip` to start a new draft.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [whoami, listTrips, getTrip, createTrip],
});
