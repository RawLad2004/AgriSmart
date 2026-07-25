/*==========================================================
                NOTIFICATIONS COMPONENT
    Included on every dashboard page, right after
    supabase-client.js. Call initNotificationBell(userId)
    once auth is confirmed — each page's own script already
    does this as part of its startup, so just call it there.
==========================================================*/

let _notifUserId = null;

async function initNotificationBell(userId) {
  _notifUserId = userId;
  await refreshNotifications();

  document.getElementById("notif-bell").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("notif-dropdown").classList.toggle("open");
  });

  document.addEventListener("click", (e) => {
    const dropdown = document.getElementById("notif-dropdown");
    const bell = document.getElementById("notif-bell");
    if (dropdown.classList.contains("open") && !bell.contains(e.target)) {
      dropdown.classList.remove("open");
    }
  });

  document.getElementById("mark-all-read").addEventListener("click", async (e) => {
    e.stopPropagation();
    await sb.from("notifications").update({ read: true }).eq("user_id", _notifUserId).eq("read", false);
    refreshNotifications();
  });
}

async function refreshNotifications() {
  const { data: notifs } = await sb
    .from("notifications")
    .select("id, type, title, body, read, created_at")
    .eq("user_id", _notifUserId)
    .order("created_at", { ascending: false })
    .limit(15);

  const list = notifs || [];
  const unreadCount = list.filter(n => !n.read).length;

  const badge = document.getElementById("notif-badge");
  if (unreadCount > 0) {
    badge.textContent = unreadCount > 9 ? "9+" : unreadCount;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }

  const listBox = document.getElementById("notif-list");

  if (list.length === 0) {
    listBox.innerHTML = `<div class="notif-empty">You're all caught up.</div>`;
    return;
  }

  const iconByType = {
    weather: "fa-cloud-sun-rain",
    market: "fa-chart-line",
    task: "fa-list-check",
    general: "fa-bell"
  };

  listBox.innerHTML = list.map(n => `
    <div class="notif-item ${n.read ? "" : "unread"}" data-id="${n.id}">
      <i class="fa-solid ${iconByType[n.type] || iconByType.general}"></i>
      <div>
        <div class="notif-title">${n.title}</div>
        ${n.body ? `<div class="notif-body">${n.body}</div>` : ""}
        <div class="notif-time">${timeAgo(n.created_at)}</div>
      </div>
    </div>
  `).join("");

  listBox.querySelectorAll(".notif-item").forEach(el => {
    el.addEventListener("click", async () => {
      await sb.from("notifications").update({ read: true }).eq("id", el.dataset.id);
      refreshNotifications();
    });
  });
}

function timeAgo(dateStr) {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/*==========================================================
    pushNotificationOnce(userId, type, title, body)
    Inserts a notification only if one with the same type +
    title hasn't already been created today for this user —
    stops the same rain alert from spamming in on every page
    visit.
==========================================================*/
async function pushNotificationOnce(userId, type, title, body) {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const { data: existing } = await sb
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("type", type)
    .eq("title", title)
    .gte("created_at", startOfDay.toISOString())
    .maybeSingle();

  if (existing) return;

  await sb.from("notifications").insert({ user_id: userId, type, title, body });

  if (_notifUserId === userId) refreshNotifications();
}