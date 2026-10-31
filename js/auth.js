/*==========================================================
                    AUTH — LOGIN
==========================================================*/

/*==========================================================
        SAFE POST-LOGIN REDIRECT
    requireSession() stores the requested dashboard page in
    ?next=. Only same-origin dashboard HTML pages are allowed,
    so a crafted link cannot turn login into an open redirect.
==========================================================*/

const DEFAULT_AFTER_LOGIN = "../dashboard/dashboard.html";

function getSafeNextPath() {
  const raw = new URLSearchParams(window.location.search).get("next");
  if (!raw) return null;

  // Reject schemes, protocol-relative URLs, backslashes and control chars.
  if (/[\u0000-\u001f\u007f\\]/.test(raw)) return null;
  if (raw.startsWith("//")) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw)) return null;

  let url;
  try {
    url = new URL(raw, window.location.origin);
  } catch (e) {
    return null;
  }

  if (url.origin !== window.location.origin) return null;

  // Restrict to real dashboard pages; query/hash are preserved.
  if (!/(?:^|\/)dashboard\/[a-z0-9_-]+\.html$/i.test(url.pathname)) return null;

  return url.pathname + url.search + url.hash;
}

function redirectAfterLogin() {
  window.location.href = getSafeNextPath() || DEFAULT_AFTER_LOGIN;
}

const loginForm = document.getElementById("login-form");

if (loginForm) {
  // Already signed in? Skip the form and go to the intended page.
  (async () => {
    try {
      const { data: { session } } = await sb.auth.getSession();
      if (session) redirectAfterLogin();
    } catch (e) {
      // Leave the form usable if the session check fails.
    }
  })();

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("auth-error");
    errorBox.textContent = "";

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;

    const { error } = await sb.auth.signInWithPassword({ email, password });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    redirectAfterLogin();
  });
}

/*==========================================================
                    AUTH — SIGNUP
==========================================================*/

const signupForm = document.getElementById("signup-form");

if (signupForm) {
  signupForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("auth-error");
    errorBox.textContent = "";

    const fullName = document.getElementById("full_name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const county = document.getElementById("county").value.trim();

    if (password.length < 8) {
      errorBox.textContent = "Password must be at least 8 characters.";
      return;
    }

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, county }
      }
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    // Keep the county so it can be saved on first login even if the profile
    // can't be updated yet (e.g. email confirmation is required first).
    savePendingProfile({ county });

    if (data.session) {
      // Signed in immediately (email confirmation is off): save county now.
      await applyPendingProfile(data.user.id);
      window.location.href = "../dashboard/profile.html";
      return;
    }

    // Email confirmation is on: there is no session yet, so tell the user.
    signupForm.reset();
    signupForm.style.display = "none";
    const note = document.createElement("div");
    note.className = "form-success";
    note.style.cssText = "background:#e8f5e9;color:#1e7a3d;padding:14px 16px;border-radius:12px;margin:10px 0;";
    note.textContent = "Account created! Check your email and click the confirmation link, then log in.";
    errorBox.after(note);
    const loginLink = document.createElement("a");
    loginLink.href = "login.html";
    loginLink.className = "primary-btn";
    loginLink.style.cssText = "display:inline-block;margin-top:10px;";
    loginLink.textContent = "Go to login";
    note.after(loginLink);
  });
}

/*==========================================================
                    AUTH — FORGOT PASSWORD
==========================================================*/

const forgotForm = document.getElementById("forgot-password-form");

if (forgotForm) {
  forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("auth-error");
    const successBox = document.getElementById("auth-success");
    const submitBtn = document.getElementById("forgot-submit-btn");
    errorBox.textContent = "";
    successBox.style.display = "none";

    const email = document.getElementById("email").value.trim();

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";

    const redirectTo = new URL("reset-password.html", window.location.href).href;

    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo });

    submitBtn.disabled = false;
    submitBtn.textContent = "Send Reset Link";

    // Always show a neutral success message, whether or not the email exists,
    // so we never confirm/deny an account's existence to the requester.
    if (error && error.status && error.status >= 500) {
      errorBox.textContent = "Something went wrong. Please try again in a moment.";
      return;
    }

    forgotForm.reset();
    successBox.style.display = "block";
    successBox.textContent = "If an account exists for that email, a reset link is on its way. Check your inbox (and spam folder).";
  });
}

/*==========================================================
                    AUTH — RESET PASSWORD
    Reached via the link emailed by resetPasswordForEmail().
    Supabase turns that link into a recovery session
    automatically when the page loads.
==========================================================*/

const resetForm = document.getElementById("reset-password-form");

if (resetForm) {
  (async () => {
    const subtitle = document.getElementById("reset-subtitle");
    const errorBox = document.getElementById("auth-error");

    // Supabase fires this event once it has parsed the recovery
    // token from the URL and established a temporary session.
    let hasRecoverySession = false;

    sb.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        hasRecoverySession = true;
      }
    });

    // Fallback check in case the event already fired before we attached
    // the listener, or the link has already been used/expired.
    const { data: { session } } = await sb.auth.getSession();
    if (session) hasRecoverySession = true;

    setTimeout(() => {
      if (!hasRecoverySession) {
        subtitle.textContent = "";
        resetForm.style.display = "none";
        errorBox.textContent = "This reset link is invalid or has expired. Please request a new one.";
        const retryLink = document.createElement("a");
        retryLink.href = "forgot-password.html";
        retryLink.textContent = "Request a new reset link";
        retryLink.className = "primary-btn";
        retryLink.style.display = "inline-block";
        retryLink.style.marginTop = "10px";
        errorBox.after(retryLink);
      }
    }, 1500);
  })();

  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("auth-error");
    const successBox = document.getElementById("auth-success");
    errorBox.textContent = "";
    successBox.style.display = "none";

    const newPassword = document.getElementById("new_password").value;
    const confirmPassword = document.getElementById("confirm_password").value;

    if (newPassword !== confirmPassword) {
      errorBox.textContent = "Passwords don't match.";
      return;
    }

    const { error } = await sb.auth.updateUser({ password: newPassword });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    resetForm.reset();
    successBox.style.display = "block";
    successBox.textContent = "Password updated! Redirecting to login…";

    await sb.auth.signOut();
    setTimeout(() => { window.location.href = "login.html"; }, 1800);
  });
}