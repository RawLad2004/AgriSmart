/*==========================================================
                    AUTH — LOGIN
==========================================================*/

const loginForm = document.getElementById("login-form");

if (loginForm) {
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

    window.location.href = "../dashboard/dashboard.html";
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

    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName }
      }
    });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    // Fill in county now that the profile row exists (trigger creates it)
    if (data.user) {
      await sb.from("profiles").update({ county }).eq("id", data.user.id);
    }

    window.location.href = "../dashboard/profile.html";
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