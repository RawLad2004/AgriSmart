/*==========================================================
                SUPABASE CLIENT
    Loaded after the Supabase CDN script on every
    auth/dashboard page. Exposes `sb` globally.
==========================================================*/

// TODO: paste your own project values from
// Supabase Dashboard > Project Settings > API
const SUPABASE_URL = "https://haycqbugzklclostauiy.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhheWNxYnVnemtsY2xvc3RhdWl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ1MzgwNDUsImV4cCI6MjEwMDExNDA0NX0.sWiYAH2K6TGCWMDFKGbslQ5UMHjV9Zr_zu44BOwxqNM";

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/*==========================================================
        HELPER: require a logged-in session
        Redirects to login if nobody is signed in.
        Call this at the top of every dashboard page.
==========================================================*/
async function requireSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    window.location.href = "../auth/login.html";
    return null;
  }
  return session;
}

/*==========================================================
        HELPER: sign out and redirect
==========================================================*/
async function signOut() {
  await sb.auth.signOut();
  window.location.href = "../auth/login.html";
}