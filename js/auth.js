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

    window.location.href = "../dashboard/dashboard.html";
  });
}