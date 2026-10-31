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
    /* Remember where the user was going so login can send them back.
       Only the current path/query/hash is stored — never a URL supplied
       by the user — and auth.js re-validates it before redirecting. */
    const next = window.location.pathname + window.location.search + window.location.hash;
    window.location.href = `../auth/login.html?next=${encodeURIComponent(next)}`;
    return null;
  }
  await applyPendingProfile(session.user.id);
  return session;
}

/*==========================================================
    PENDING PROFILE DATA
    Signup stores the chosen county locally. Once the user has
    a real session (first login after email confirmation) it
    is written to their profile, so weather works right away.
==========================================================*/
const PENDING_PROFILE_KEY = "agrova_pending_profile";

function savePendingProfile(fields) {
  try { localStorage.setItem(PENDING_PROFILE_KEY, JSON.stringify(fields)); } catch (e) { /* storage blocked */ }
}

async function applyPendingProfile(userId) {
  let pending = null;
  try { pending = JSON.parse(localStorage.getItem(PENDING_PROFILE_KEY) || "null"); } catch (e) { return; }
  if (!pending || !pending.county) return;

  const { data: profile } = await sb.from("profiles").select("county").eq("id", userId).maybeSingle();
  if (profile && !profile.county) {
    const { error } = await sb.from("profiles").update({ county: pending.county }).eq("id", userId);
    if (error) return; // keep it and retry on the next page load
  }
  try { localStorage.removeItem(PENDING_PROFILE_KEY); } catch (e) { /* ignore */ }
}

/*==========================================================
        HELPER: sign out and redirect
==========================================================*/
async function signOut() {
  await sb.auth.signOut();
  window.location.href = "../auth/login.html";
}