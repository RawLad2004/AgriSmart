/*==========================================================
                    PROFILE MODULE
==========================================================*/

let currentUserId = null;

function setAvatarPreview(el, avatarUrl, fallbackLetter) {
  const avatarCss = safeCssUrl(avatarUrl);
  if (avatarCss) {
    el.style.backgroundImage = avatarCss;
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center";
    el.textContent = "";
  } else {
    el.style.backgroundImage = "";
    el.textContent = fallbackLetter;
  }
}

async function loadProfile() {
  const { data: profile, error } = await sb
    .from("profiles")
    .select("full_name, county, phone_number, avatar_url, preferred_units")
    .eq("id", currentUserId)
    .single();

  if (error) {
    document.getElementById("profile-form-error").textContent = "Couldn't load your profile: " + error.message;
    return;
  }

  const displayName = profile?.full_name || "";
  const fallbackLetter = displayName ? displayName.charAt(0).toUpperCase() : "?";

  document.getElementById("full_name").value = profile?.full_name || "";
  document.getElementById("county").value = profile?.county || "";
  document.getElementById("phone_number").value = profile?.phone_number || "";
  document.getElementById("preferred_units").value = profile?.preferred_units || "metric";

  setAvatarPreview(document.getElementById("profile-avatar-preview"), profile?.avatar_url, fallbackLetter);
  setAvatarPreview(document.getElementById("user-avatar"), profile?.avatar_url, fallbackLetter);

  document.getElementById("user-name").textContent = displayName || "Loading…";

  // Nudge new/incomplete profiles to fill in the county (weather depends on it)
  if (!profile?.county || !profile?.full_name) {
    document.getElementById("profile-setup-banner").style.display = "flex";
  }
}

(async () => {

  const session = await requireSession();
  if (!session) return;

  currentUserId = session.user.id;

  document.getElementById("account_email").value = session.user.email || "";

  await initNotificationBell(currentUserId);
  await loadProfile();

  // ---- Save profile details ----
  document.getElementById("profile-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("profile-form-error");
    const successBox = document.getElementById("profile-form-success");
    errorBox.textContent = "";
    successBox.style.display = "none";

    const full_name = document.getElementById("full_name").value.trim();
    const county = document.getElementById("county").value.trim();
    const phone_number = document.getElementById("phone_number").value.trim() || null;
    const preferred_units = document.getElementById("preferred_units").value;

    const { error } = await sb.from("profiles").update({
      full_name, county, phone_number, preferred_units
    }).eq("id", currentUserId);

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    successBox.style.display = "block";
    successBox.textContent = "Profile updated.";
    document.getElementById("profile-setup-banner").style.display = "none";
    document.getElementById("user-name").textContent = full_name;
    document.getElementById("user-avatar").textContent = full_name.charAt(0).toUpperCase();
  });

  // ---- Avatar upload ----
  document.getElementById("avatar_upload").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const statusBox = document.getElementById("avatar-upload-status");
    statusBox.textContent = "Uploading…";

    // Only real raster images, max 2 MB. The extension is derived from the
    // validated MIME type - never from the user-supplied file name.
    const ALLOWED_AVATAR_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
    const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
    const ext = ALLOWED_AVATAR_TYPES[file.type];

    if (!ext) {
      statusBox.textContent = "Please choose a JPG, PNG or WebP image.";
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      statusBox.textContent = "That photo is too large. Please choose one under 2 MB.";
      return;
    }

    const path = `${currentUserId}/avatar.${ext}`;

    const { error: uploadError } = await sb.storage
      .from("avatars")
      .upload(path, file, { upsert: true, cacheControl: "3600" });

    if (uploadError) {
      statusBox.textContent = "Upload failed: " + uploadError.message;
      return;
    }

    const { data: publicUrlData } = sb.storage.from("avatars").getPublicUrl(path);
    // Cache-bust so the new photo shows immediately instead of a stale cached one
    const avatar_url = `${publicUrlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await sb.from("profiles").update({ avatar_url }).eq("id", currentUserId);

    if (updateError) {
      statusBox.textContent = "Couldn't save photo: " + updateError.message;
      return;
    }

    setAvatarPreview(document.getElementById("profile-avatar-preview"), avatar_url, "?");
    setAvatarPreview(document.getElementById("user-avatar"), avatar_url, "?");
    statusBox.textContent = "Photo updated.";
  });

  // ---- Update email ----
  document.getElementById("email-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("email-form-error");
    const successBox = document.getElementById("email-form-success");
    errorBox.textContent = "";
    successBox.style.display = "none";

    const email = document.getElementById("account_email").value.trim();

    const { error } = await sb.auth.updateUser({ email });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    successBox.style.display = "block";
    successBox.textContent = "Check your new inbox for a confirmation link to finish the email change.";
  });

  // ---- Change password (already logged in) ----
  document.getElementById("password-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorBox = document.getElementById("password-form-error");
    const successBox = document.getElementById("password-form-success");
    errorBox.textContent = "";
    successBox.style.display = "none";

    const newPassword = document.getElementById("pw_new").value;
    const confirmPassword = document.getElementById("pw_confirm").value;

    if (newPassword !== confirmPassword) {
      errorBox.textContent = "Passwords don't match.";
      return;
    }

    const { error } = await sb.auth.updateUser({ password: newPassword });

    if (error) {
      errorBox.textContent = error.message;
      return;
    }

    document.getElementById("password-form").reset();
    successBox.style.display = "block";
    successBox.textContent = "Password updated.";
  });

  // ---- Logout ----
  document.getElementById("logout-btn").addEventListener("click", (e) => {
    e.preventDefault();
    signOut();
  });

})();
