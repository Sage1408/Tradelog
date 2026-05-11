 var SUPA_URL = "https://wkswluzempqggguzjdnx.supabase.co";
      var SUPA_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indrc3dsdXplbXBxZ2dndXpqZG54Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc5NzM1ODcsImV4cCI6MjA5MzU0OTU4N30.rrtO9u6_2zO3_4P_rFHSb9KnVSJSeWBWErC6sTZWa64";
      var sb = window.supabase.createClient(SUPA_URL, SUPA_KEY);
      var trades = [],
        notes = [],
        currentUser = null,
        currentScreenshot = null,
        authMode = "login";
      var filteredTrades = [],
        currentPage = 1,
        pageSize = 15,
        editingId = null,
        editingNoteId = null;
      var sessionChecked = false;

      /* UTILS */
      function showLoading(m) {
        document.getElementById("loading-text").textContent = m || "Loading...";
        document.getElementById("loading-overlay").classList.add("show");
      }
      function hideLoading() {
        document.getElementById("loading-overlay").classList.remove("show");
      }
      function showToast(m) {
        var t = document.getElementById("toast");
        t.textContent = m;
        t.classList.add("show");
        setTimeout(function () {
          t.classList.remove("show");
        }, 3000);
      }

      /* DARK MODE */
      var dark = localStorage.getItem("tl-dark") === "1";
      function applyTheme() {
        document.documentElement.setAttribute(
          "data-theme",
          dark ? "dark" : "light"
        );
        document.getElementById("dark-btn").textContent = dark ? "☀️" : "🌙";
      }
      function toggleDark() {
        dark = !dark;
        localStorage.setItem("tl-dark", dark ? "1" : "0");
        applyTheme();
      }
      applyTheme();

      /* AUTH */
      function showAuthTab(m) {
        authMode = m;
        document.querySelectorAll(".auth-tab").forEach(function (t, i) {
          t.classList.toggle(
            "active",
            (m === "login" && i === 0) || (m === "signup" && i === 1)
          );
        });
        document.getElementById("auth-submit-btn").textContent =
          m === "login" ? "Sign In" : "Create Account";
        document.getElementById("auth-forgot-link").style.display =
          m === "login" ? "block" : "none";
        document.getElementById("auth-error").textContent = "";
      }
      function showForgotPassword() {
        document.getElementById("forgot-modal").classList.add("open");
      }
      function closeForgotModal() {
        document.getElementById("forgot-modal").classList.remove("open");
      }
      async function sendPasswordReset() {
        var email = document.getElementById("forgot-email").value.trim();
        var errEl = document.getElementById("forgot-error");
        if (!email) {
          errEl.textContent = "Enter your email";
          return;
        }
        var res = await sb.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.href,
        });
        if (res.error) {
          errEl.textContent = res.error.message;
        } else {
          errEl.style.color = "var(--green)";
          errEl.textContent = "Reset link sent! Check your email.";
          setTimeout(closeForgotModal, 3000);
        }
      }
      async function signInWithGoogle() {
  showLoading('Connecting to Google...');
  var result = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href }
  });
  if (result.error) {
    hideLoading();
    document.getElementById('auth-error').textContent = result.error.message;
  }
}
      async function handleEmailAuth() {
        var email = document.getElementById("auth-email").value.trim();
        var pass = document.getElementById("auth-password").value;
        var errEl = document.getElementById("auth-error");
        errEl.textContent = "";
        errEl.className = "auth-error";
        if (!email || !pass) {
          errEl.textContent = "Please fill in all fields";
          return;
        }
        showLoading(
          authMode === "login" ? "Signing in..." : "Creating account..."
        );
        var res;
        if (authMode === "login") {
          res = await sb.auth.signInWithPassword({
            email: email,
            password: pass,
          });
          hideLoading();
          if (res.error) {
            errEl.textContent = res.error.message;
          } else if (res.data && res.data.session) {
            sessionChecked = true;
            await initApp(res.data.session);
          }
        } else {
          res = await sb.auth.signUp({ email: email, password: pass });
          hideLoading();
          if (res.error) {
            errEl.textContent = res.error.message;
          } else {
            errEl.className = "auth-error auth-success";
            errEl.textContent = "Account created! You can now sign in.";
          }
        }
      }
      async function signOut() {
        showLoading("Signing out...");
        await sb.auth.signOut();
        trades = [];
        notes = [];
        currentUser = null;
        document.getElementById("app-screen").style.display = "none";
        document.getElementById("auth-screen").style.display = "flex";
        hideLoading();
      }

      /* INIT */
      async function initApp(session) {
        if (!session || !session.user) {
          document.getElementById("app-screen").style.display = "none";
          document.getElementById("auth-screen").style.display = "flex";
          hideLoading();
          return;
        }
        currentUser = session.user;
        document.getElementById("user-email-display").textContent =
          session.user.email;
        document.getElementById("auth-screen").style.display = "none";
        document.getElementById("app-screen").style.display = "block";
        document.getElementById("f-date").value = new Date()
          .toISOString()
          .split("T")[0];
        document.getElementById("f-pair").onchange = function () {
          document.getElementById("custom-pair-group").style.display =
            this.value === "custom" ? "flex" : "none";
        };
        showDashboardSkeleton();
        await loadTrades();
        await loadNotes();
        renderDashboard();
        renderTable();
        renderNotesList();
      }
      (async function () {
        showLoading("Starting...");
        var to = setTimeout(function () {
          hideLoading();
          document.getElementById("auth-screen").style.display = "flex";
        }, 6000);
        try {
          var r = await sb.auth.getSession();
          clearTimeout(to);
          if (r.data && r.data.session) {
            await initApp(r.data.session);
          } else {
            hideLoading();
            document.getElementById("auth-screen").style.display = "flex";
          }
        } catch (e) {
          clearTimeout(to);
          hideLoading();
          document.getElementById("auth-screen").style.display = "flex";
        }
        sessionChecked = true;
      })();
      sb.auth.onAuthStateChange(async function(ev,session){
  if(ev==='SIGNED_IN'||ev==='TOKEN_REFRESHED'){
    if(session&&session.user){
      if(!currentUser||currentUser.id!==session.user.id){
        sessionChecked=true;
        await initApp(session);
      }
    }
  } else if(ev==='SIGNED_OUT'){
    trades=[];notes=[];currentUser=null;
    document.getElementById('app-screen').style.display='none';
    document.getElementById('auth-screen').style.display='flex';
    hideLoading();
  }
});
      /* TABS */
      function switchTab(name, btn) {
        document.querySelectorAll(".view").forEach(function (v) {
          v.classList.remove("active");
        });
        document.querySelectorAll(".bnav-btn").forEach(function (b) {
          b.classList.remove("active");
        });
        document.getElementById("view-" + name).classList.add("active");
        btn.classList.add("active");
        if (name === "dashboard") renderDashboard();
        if (name === "log") {
          applyFilters();
        }
        if (name === "notes") renderNotesList();
      }

      /* SKELETON */
      function showDashboardSkeleton() {
        document.getElementById("dashboard-skeleton").style.display = "block";
        document.getElementById("dashboard-content").style.display = "none";
        document.getElementById("dashboard-empty").style.display = "none";
      }

      /* LOAD TRADES */
      async function loadTrades() {
        showLoading("Loading your trades...");
        try {
          var r = await Promise.race([
            sb
              .from("trades")
              .select("*")
              .eq("user_id", currentUser.id)
              .order("created_at", { ascending: false }),
            new Promise(function (_, rej) {
              setTimeout(function () {
                rej(new Error("timeout"));
              }, 8000);
            }),
          ]);
          hideLoading();
          if (r.error) {
            showToast("Error loading trades");
            trades = [];
            return;
          }
          trades = r.data || [];
        } catch (e) {
          hideLoading();
          showToast("Connection timeout. Refresh to retry.");
          trades = [];
        }
        document.getElementById("dashboard-skeleton").style.display = "none";
        if (trades.length) {
          document.getElementById("dashboard-content").style.display = "block";
          document.getElementById("dashboard-empty").style.display = "none";
        } else {
          document.getElementById("dashboard-content").style.display = "none";
          document.getElementById("dashboard-empty").style.display = "block";
        }
      }

      /* SAVE TRADE */
      async function saveTrade() {
        var pv = document.getElementById("f-pair").value;
        var pair =
          pv === "custom"
            ? document.getElementById("f-custom-pair").value.trim()
            : pv;
        var result = document.getElementById("f-result").value,
          dir = document.getElementById("f-dir").value;
        if (!pair || !dir || !result) {
          showToast("Fill in Pair, Direction and Result");
          return;
        }
        var t = {
          user_id: currentUser.id,
          date: document.getElementById("f-date").value,
          pair: pair,
          dir: dir,
          session: document.getElementById("f-session").value || null,
          entry: parseFloat(document.getElementById("f-entry").value) || null,
          sl: parseFloat(document.getElementById("f-sl").value) || null,
          tp: parseFloat(document.getElementById("f-tp").value) || null,
          lot: parseFloat(document.getElementById("f-lot").value) || null,
          result: result,
          rr: parseFloat(document.getElementById("f-rr").value) || null,
          setup: document.getElementById("f-setup").value || null,
          mindset: parseInt(document.getElementById("f-mindset").value) || null,
          notes: document.getElementById("f-notes").value.trim() || null,
          screenshot: currentScreenshot,
        };
        showLoading("Saving trade...");
        var res = await sb.from("trades").insert([t]).select();
        hideLoading();
        if (res.error) {
          showToast("Error: " + res.error.message);
          return;
        }
        trades.unshift(res.data[0]);
        document.getElementById("dashboard-content").style.display = "block";
        document.getElementById("dashboard-empty").style.display = "none";
        showToast("Trade saved!");
        clearForm();
        switchTab("log", document.querySelectorAll(".bnav-btn")[1]);
      }

      /* EDIT TRADE */
      function openEditModal(id) {
        var t = trades.find(function (x) {
          return String(x.id) === String(id);
        });
        if (!t) return;
        editingId = id;
        document.getElementById("e-date").value = t.date || "";
        document.getElementById("e-pair").value = t.pair || "";
        document.getElementById("e-dir").value = t.dir || "Buy";
        document.getElementById("e-session").value = t.session || "";
        document.getElementById("e-entry").value =
          t.entry !== null && t.entry !== undefined ? t.entry : "";
        document.getElementById("e-sl").value =
          t.sl !== null && t.sl !== undefined ? t.sl : "";
        document.getElementById("e-tp").value =
          t.tp !== null && t.tp !== undefined ? t.tp : "";
        document.getElementById("e-lot").value =
          t.lot !== null && t.lot !== undefined ? t.lot : "";
        document.getElementById("e-result").value = t.result || "Win";
        document.getElementById("e-rr").value =
          t.rr !== null && t.rr !== undefined ? t.rr : "";
        document.getElementById("e-setup").value = t.setup || "";
        document.getElementById("e-mindset").value = t.mindset || "";
        document.getElementById("e-notes").value = t.notes || "";
        document.getElementById("edit-modal").classList.add("open");
      }
      function closeEditModal() {
        document.getElementById("edit-modal").classList.remove("open");
        editingId = null;
      }
      async function updateTrade() {
        if (!editingId) return;
        var upd = {
          date: document.getElementById("e-date").value,
          pair: document.getElementById("e-pair").value,
          dir: document.getElementById("e-dir").value,
          session: document.getElementById("e-session").value || null,
          entry: parseFloat(document.getElementById("e-entry").value) || null,
          sl: parseFloat(document.getElementById("e-sl").value) || null,
          tp: parseFloat(document.getElementById("e-tp").value) || null,
          lot: parseFloat(document.getElementById("e-lot").value) || null,
          result: document.getElementById("e-result").value,
          rr: parseFloat(document.getElementById("e-rr").value) || null,
          setup: document.getElementById("e-setup").value || null,
          mindset: parseInt(document.getElementById("e-mindset").value) || null,
          notes: document.getElementById("e-notes").value.trim() || null,
        };
        showLoading("Updating...");
        var res = await sb
          .from("trades")
          .update(upd)
          .eq("id", editingId)
          .select();
        hideLoading();
        if (res.error) {
          showToast("Error: " + res.error.message);
          return;
        }
        var idx = trades.findIndex(function (x) {
          return String(x.id) === String(editingId);
        });
        if (idx > -1) trades[idx] = Object.assign(trades[idx], upd);
        closeEditModal();
        showToast("Trade updated!");
        applyFilters();
        renderDashboard();
      }

      /* DELETE */
      async function deleteTrade(id) {
        if (!confirm("Delete this trade?")) return;
        showLoading("Deleting...");
        var res = await sb.from("trades").delete().eq("id", id);
        hideLoading();
        if (res.error) {
          showToast("Error deleting");
          return;
        }
        trades = trades.filter(function (t) {
          return String(t.id) !== String(id);
        });
        if (!trades.length) {
          document.getElementById("dashboard-content").style.display = "none";
          document.getElementById("dashboard-empty").style.display = "block";
        }
        applyFilters();
        renderDashboard();
        showToast("Deleted");
      }

      /* FORM */
      function clearForm() {
        ["f-pair", "f-dir", "f-session", "f-result", "f-setup"].forEach(
          function (id) {
            document.getElementById(id).value = "";
          }
        );
        [
          "f-entry",
          "f-sl",
          "f-tp",
          "f-lot",
          "f-rr",
          "f-mindset",
          "f-notes",
          "f-custom-pair",
        ].forEach(function (id) {
          document.getElementById(id).value = "";
        });
        document.getElementById("custom-pair-group").style.display = "none";
        currentScreenshot = null;
        document.getElementById("f-screenshot").value = "";
        document.getElementById("upload-placeholder").style.display = "block";
        document.getElementById("upload-preview-wrap").style.display = "none";
        document.getElementById("upload-preview-img").src = "";
        document.getElementById("f-date").value = new Date()
          .toISOString()
          .split("T")[0];
      }

      /* SCREENSHOT */
      function handleScreenshot(e) {
        var f = e.target.files[0];
        if (!f) return;
        var r = new FileReader();
        r.onload = function (ev) {
          currentScreenshot = ev.target.result;
          document.getElementById("upload-preview-img").src = ev.target.result;
          document.getElementById("upload-placeholder").style.display = "none";
          document.getElementById("upload-preview-wrap").style.display =
            "block";
        };
        r.readAsDataURL(f);
      }
      function removeScreenshot(e) {
        e.preventDefault();
        e.stopPropagation();
        currentScreenshot = null;
        document.getElementById("f-screenshot").value = "";
        document.getElementById("upload-placeholder").style.display = "block";
        document.getElementById("upload-preview-wrap").style.display = "none";
        document.getElementById("upload-preview-img").src = "";
      }
      function viewScreenshot(id) {
        var t = trades.find(function (x) {
          return String(x.id) === String(id);
        });
        if (!t || !t.screenshot) return;
        document.getElementById("screenshot-modal-img").src = t.screenshot;
        document.getElementById("screenshot-modal").style.display = "flex";
      }
      function closeScreenshotModal() {
        document.getElementById("screenshot-modal").style.display = "none";
      }

      /* FILTER + PAGINATION */
      function applyFilters() {
        var pair = (
          document.getElementById("filter-pair").value || ""
        ).toLowerCase();
        var session = document.getElementById("filter-session").value;
        var result = document.getElementById("filter-result").value;
        var from = document.getElementById("filter-from").value;
        var to = document.getElementById("filter-to").value;
        filteredTrades = trades.filter(function (t) {
          if (pair && !(t.pair || "").toLowerCase().includes(pair))
            return false;
          if (session && t.session !== session) return false;
          if (result && t.result !== result) return false;
          if (from && t.date && t.date < from) return false;
          if (to && t.date && t.date > to) return false;
          return true;
        });
        currentPage = 1;
        renderTable();
      }
      function clearFilters() {
        ["filter-pair", "filter-from", "filter-to"].forEach(function (id) {
          document.getElementById(id).value = "";
        });
        ["filter-session", "filter-result"].forEach(function (id) {
          document.getElementById(id).value = "";
        });
        applyFilters();
      }

      /* TABLE */
      function renderTable() {
        if (!filteredTrades.length && trades.length) {
          applyFilters();
          return;
        }
        var tbody = document.getElementById("trade-table-body");
        var src = filteredTrades.length ? filteredTrades : trades;
        if (!src.length) {
          tbody.innerHTML =
            '<tr><td colspan="15"><div class="empty-state"><div class="empty-icon">&#128203;</div><p>No trades yet. Add your first trade!</p></div></td></tr>';
          document.getElementById("pagination").innerHTML = "";
          return;
        }
        var total = src.length,
          pages = Math.ceil(total / pageSize);
        if (currentPage > pages) currentPage = pages;
        var start = (currentPage - 1) * pageSize,
          end = Math.min(start + pageSize, total);
        var page = src.slice(start, end);
        var html = "";
        for (var i = 0; i < page.length; i++) {
          var t = page[i],
            idx = start + i;
          var rr = t.rr !== null && t.rr !== undefined ? Number(t.rr) : null;
          var rrClass =
            t.result === "Win" ? "rr-pos" : t.result === "Loss" ? "rr-neg" : "";
          var resBadge =
            t.result === "Win"
              ? "badge-win"
              : t.result === "Loss"
              ? "badge-loss"
              : "badge-be";
          var dirBadge = t.dir === "Buy" ? "badge-buy" : "badge-sell";
          var rrTxt =
            rr !== null ? (t.result === "Loss" ? "-" : "") + rr + "R" : "--";
          var setup = t.setup ? t.setup.split(" - ")[0] : "--";
          var scCell = t.screenshot
            ? '<img src="' +
              t.screenshot +
              '" class="sc-thumb" onclick="viewScreenshot(\'' +
              t.id +
              '\')" title="View chart"/>'
            : "--";
          html += "<tr>";
          html +=
            '<td class="mono" style="color:var(--ink-muted)">' +
            (total - idx) +
            "</td>";
          html +=
            '<td class="mono" style="font-size:0.72rem">' +
            (t.date || "--") +
            "</td>";
          html += "<td><strong>" + (t.pair || "--") + "</strong></td>";
          html +=
            '<td><span class="badge ' +
            dirBadge +
            '">' +
            (t.dir || "--") +
            "</span></td>";
          html +=
            '<td><span class="badge badge-session">' +
            (t.session || "--") +
            "</span></td>";
          html +=
            '<td><span class="badge badge-setup">' + setup + "</span></td>";
          html +=
            '<td class="mono">' +
            (t.entry !== null && t.entry !== undefined ? t.entry : "--") +
            "</td>";
          html +=
            '<td class="mono">' +
            (t.sl !== null && t.sl !== undefined ? t.sl : "--") +
            "</td>";
          html +=
            '<td class="mono">' +
            (t.tp !== null && t.tp !== undefined ? t.tp : "--") +
            "</td>";
          html +=
            '<td class="mono">' +
            (t.lot !== null && t.lot !== undefined ? t.lot : "--") +
            "</td>";
          html += '<td class="mono ' + rrClass + '">' + rrTxt + "</td>";
          html +=
            '<td><span class="badge ' +
            resBadge +
            '">' +
            t.result +
            "</span></td>";
          html += "<td>" + scCell + "</td>";
          html +=
            '<td style="max-width:120px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.73rem;color:var(--ink-muted)">' +
            (t.notes || "--") +
            "</td>";
          html +=
            '<td style="display:flex;gap:4px;"><button class="btn btn-icon" onclick="openEditModal(\'' +
            t.id +
            '\')">&#9998;</button><button class="btn btn-danger" onclick="deleteTrade(\'' +
            t.id +
            "')\">X</button></td>";
          html += "</tr>";
        }
        tbody.innerHTML = html;
        renderPagination(pages);
      }
      function renderPagination(pages) {
        var el = document.getElementById("pagination");
        if (pages <= 1) {
          el.innerHTML = "";
          return;
        }
        var h =
          '<button class="page-btn" onclick="goPage(' +
          currentPage +
          '-1)" ' +
          (currentPage === 1 ? "disabled" : "") +
          ">Prev</button>";
        for (var i = 1; i <= pages; i++) {
          h +=
            '<button class="page-btn' +
            (i === currentPage ? " active" : "") +
            '" onclick="goPage(' +
            i +
            ')">' +
            i +
            "</button>";
        }
        h +=
          '<button class="page-btn" onclick="goPage(' +
          currentPage +
          '+1)" ' +
          (currentPage === pages ? "disabled" : "") +
          ">Next</button>";
        el.innerHTML = h;
      }
      function goPage(p) {
        currentPage = Number(p);
        renderTable();
      }

      /* DASHBOARD */
      function renderDashboard() {
        if (!trades.length) return;
        var wins = [],
          losses = [],
          bes = [];
        for (var i = 0; i < trades.length; i++) {
          if (trades[i].result === "Win") wins.push(trades[i]);
          else if (trades[i].result === "Loss") losses.push(trades[i]);
          else bes.push(trades[i]);
        }
        var total = trades.length;
        var wr = total ? Math.round((wins.length / total) * 100) : null;
        document.getElementById("stat-wr").textContent =
          wr !== null ? wr + "%" : "--";
        document.getElementById("stat-wr-sub").textContent = total
          ? wins.length + " wins of " + total
          : "No trades";
        var rrSum = 0,
          rrCount = 0;
        for (var i = 0; i < trades.length; i++) {
          if (trades[i].rr !== null && trades[i].rr !== undefined) {
            rrSum += Number(trades[i].rr);
            rrCount++;
          }
        }
        document.getElementById("stat-rr").textContent = rrCount
          ? (rrSum / rrCount).toFixed(2) + "R"
          : "--";
        document.getElementById("stat-total").textContent = total;
        document.getElementById("stat-wlb").textContent =
          wins.length + "W / " + losses.length + "L / " + bes.length + "BE";

        /* Best/worst pair */
        var pairStats = {};
        for (var i = 0; i < trades.length; i++) {
          var p = trades[i].pair || "Unknown";
          if (!pairStats[p]) pairStats[p] = { w: 0, t: 0 };
          pairStats[p].t++;
          if (trades[i].result === "Win") pairStats[p].w++;
        }
        var bestPair = null,
          worstPair = null,
          bestWR = -1,
          worstWR = 101;
        for (var p in pairStats) {
          if (pairStats[p].t < 2) continue;
          var pwr = Math.round((pairStats[p].w / pairStats[p].t) * 100);
          if (pwr > bestWR) {
            bestWR = pwr;
            bestPair = p;
          }
          if (pwr < worstWR) {
            worstWR = pwr;
            worstPair = p;
          }
        }
        document.getElementById("stat-best-pair").textContent =
          bestPair || "--";
        document.getElementById("stat-best-pair-wr").textContent = bestPair
          ? bestWR + "% win rate"
          : "Need 2+ trades per pair";
        document.getElementById("stat-worst-pair").textContent =
          worstPair || "--";
        document.getElementById("stat-worst-pair-wr").textContent = worstPair
          ? worstWR + "% win rate"
          : "--";

        /* Profit factor */
        var winRR = 0,
          lossRR = 0;
        for (var i = 0; i < wins.length; i++) winRR += Number(wins[i].rr || 0);
        for (var i = 0; i < losses.length; i++)
          lossRR += Number(losses[i].rr || 0);
        document.getElementById("stat-pf").textContent =
          lossRR > 0 ? (winRR / lossRR).toFixed(2) : wins.length ? "MAX" : "--";

        /* Streak */
        var sorted = trades.slice().sort(function (a, b) {
          return (a.date || "") < (b.date || "") ? -1 : 1;
        });
        var streak = 1,
          stype = sorted[sorted.length - 1].result;
        for (var i = sorted.length - 2; i >= 0; i--) {
          if (sorted[i].result === stype) streak++;
          else break;
        }
        document.getElementById("stat-streak").textContent = streak;
        document.getElementById("stat-streak-type").textContent =
          stype === "Win"
            ? "Win streak"
            : stype === "Loss"
            ? "Loss streak"
            : "BE streak";

        /* This month */
        var now = new Date(),
          mo = (now.getMonth() + 1).toString().padStart(2, "0"),
          yr = now.getFullYear().toString();
        var monthTrades = trades.filter(function (t) {
          return t.date && t.date.startsWith(yr + "-" + mo);
        });
        var monthWins = monthTrades.filter(function (t) {
          return t.result === "Win";
        }).length;
        document.getElementById("stat-month-wr").textContent =
          monthTrades.length
            ? Math.round((monthWins / monthTrades.length) * 100) + "%"
            : "--";
        document.getElementById("stat-month-sub").textContent =
          monthTrades.length
            ? monthTrades.length + " trades this month"
            : "No trades this month";

        /* Win rate by session */
        var sessions = ["Asian", "London", "New York", "London/NY Overlap"];
        var sHTML = "";
        sessions.forEach(function (s) {
          var st = trades.filter(function (t) {
            return t.session === s;
          });
          if (!st.length) return;
          var sw = st.filter(function (t) {
            return t.result === "Win";
          }).length;
          var swr = Math.round((sw / st.length) * 100);
          sHTML +=
            '<div class="rate-bar-row"><div class="rate-bar-label"><span>' +
            s +
            "</span><span>" +
            swr +
            "% (" +
            st.length +
            ')</span></div><div class="rate-bar-track"><div class="rate-bar-fill" style="width:' +
            swr +
            '%"></div></div></div>';
        });
        document.getElementById("session-rate-bars").innerHTML =
          sHTML ||
          '<div style="font-size:0.8rem;color:var(--ink-muted)">No session data</div>';

        /* Win rate by setup */
        var setupMap = {};
        for (var i = 0; i < trades.length; i++) {
          var s = (trades[i].setup || "Unknown").split(" - ")[0];
          if (!setupMap[s]) setupMap[s] = { w: 0, t: 0 };
          setupMap[s].t++;
          if (trades[i].result === "Win") setupMap[s].w++;
        }
        var stHTML = "";
        for (var s in setupMap) {
          var swr2 = Math.round((setupMap[s].w / setupMap[s].t) * 100);
          stHTML +=
            '<div class="rate-bar-row"><div class="rate-bar-label"><span>' +
            s +
            "</span><span>" +
            swr2 +
            "% (" +
            setupMap[s].t +
            ')</span></div><div class="rate-bar-track"><div class="rate-bar-fill" style="width:' +
            swr2 +
            '%"></div></div></div>';
        }
        document.getElementById("setup-rate-bars").innerHTML =
          stHTML ||
          '<div style="font-size:0.8rem;color:var(--ink-muted)">No setup data</div>';

        drawLineChart();
        drawDonut(wins.length, losses.length, bes.length);
        drawBarChart("sessionChart", countBy("session", null));
        drawMonthChart();
        drawCalendar();
      }

      function countBy(key, transform) {
        var c = {};
        for (var i = 0; i < trades.length; i++) {
          var v = trades[i][key] || "Unknown";
          if (transform) v = transform(v);
          c[v] = (c[v] || 0) + 1;
        }
        return c;
      }

      /* CALENDAR */
      var calYear = new Date().getFullYear();
      var calMonth = new Date().getMonth();
      var monthNames = [
        "January",
        "February",
        "March",
        "April",
        "May",
        "June",
        "July",
        "August",
        "September",
        "October",
        "November",
        "December",
      ];

      function calPrevMonth() {
        calMonth--;
        if (calMonth < 0) {
          calMonth = 11;
          calYear--;
        }
        drawCalendar();
      }
      function calNextMonth() {
        calMonth++;
        if (calMonth > 11) {
          calMonth = 0;
          calYear++;
        }
        drawCalendar();
      }

      function drawCalendar() {
        var grid = document.getElementById("cal-grid");
        var label = document.getElementById("cal-month-label");
        if (label) label.textContent = monthNames[calMonth] + " " + calYear;

        var dayMap = {};
        for (var i = 0; i < trades.length; i++) {
          var d = trades[i].date;
          if (!d) continue;
          if (!dayMap[d]) dayMap[d] = { wins: 0, losses: 0, bes: 0 };
          if (trades[i].result === "Win") dayMap[d].wins++;
          else if (trades[i].result === "Loss") dayMap[d].losses++;
          else dayMap[d].bes++;
        }

        var firstDay = new Date(calYear, calMonth, 1).getDay();
        var daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
        var today = new Date().toISOString().split("T")[0];
        var html = "";

        // Empty cells before first day
        for (var i = 0; i < firstDay; i++)
          html += '<div class="cal-day empty"></div>';

        for (var day = 1; day <= daysInMonth; day++) {
          var mm = String(calMonth + 1).padStart(2, "0");
          var dd = String(day).padStart(2, "0");
          var ds = calYear + "-" + mm + "-" + dd;
          var dm = dayMap[ds];
          var cls = "cal-day";
          var tip = ds;
          var dayNum =
            '<span style="font-size:0.6rem;position:absolute;top:2px;left:3px;color:inherit;opacity:0.7;">' +
            day +
            "</span>";
          if (ds === today) cls += " today";
          if (dm) {
            if (dm.wins > 0 && dm.losses === 0 && dm.bes === 0) cls += " win";
            else if (dm.losses > 0 && dm.wins === 0 && dm.bes === 0)
              cls += " loss";
            else if (dm.bes > 0 && dm.wins === 0 && dm.losses === 0)
              cls += " be";
            else cls += " mixed";
            tip += ": " + dm.wins + "W/" + dm.losses + "L/" + dm.bes + "BE";
          }
          html +=
            '<div class="' +
            cls +
            '" style="position:relative;aspect-ratio:1;">' +
            dayNum +
            '<div class="cal-tooltip">' +
            tip +
            "</div></div>";
        }
        grid.innerHTML = html;
      }

      /* MONTH CHART */
      function drawMonthChart() {
        var canvas = document.getElementById("monthChart"),
          ctx = canvas.getContext("2d");
        var monthMap = {};
        for (var i = 0; i < trades.length; i++) {
          var d = trades[i].date;
          if (!d) continue;
          var m = d.substring(0, 7);
          if (!monthMap[m]) monthMap[m] = { w: 0, l: 0 };
          if (trades[i].result === "Win") monthMap[m].w++;
          else if (trades[i].result === "Loss") monthMap[m].l++;
        }
        var keys = Object.keys(monthMap).sort().slice(-6);
        var W = canvas.offsetWidth || 300,
          H = 140;
        canvas.width = W;
        canvas.height = H;
        ctx.clearRect(0, 0, W, H);
        if (!keys.length) {
          ctx.fillStyle = "#9A948A";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("No data", W / 2, H / 2);
          return;
        }
        var pad = { t: 10, r: 10, b: 36, l: 10 },
          pw = W - pad.l - pad.r,
          ph = H - pad.t - pad.b;
        var maxV = 0;
        for (var i = 0; i < keys.length; i++) {
          var t = monthMap[keys[i]].w + monthMap[keys[i]].l;
          if (t > maxV) maxV = t;
        }
        var bw = (pw / keys.length) * 0.35,
          gap = pw / keys.length;
        for (var i = 0; i < keys.length; i++) {
          var x = pad.l + i * gap + (gap - bw * 2 - 4) / 2,
            yw = monthMap[keys[i]].w,
            yl = monthMap[keys[i]].l;
          var hw = (yw / maxV) * ph,
            hl = (yl / maxV) * ph;
          ctx.fillStyle = "var(--green,#2D6A4F)";
          ctx.beginPath();
          ctx.roundRect(x, pad.t + ph - hw, bw, hw, [3, 3, 0, 0]);
          ctx.fill();
          ctx.fillStyle = "#2D6A4F";
          ctx.beginPath();
          ctx.roundRect(x, pad.t + ph - hw, bw, hw, [3, 3, 0, 0]);
          ctx.fill();
          ctx.fillStyle = "#9B2335";
          ctx.beginPath();
          ctx.roundRect(x + bw + 4, pad.t + ph - hl, bw, hl || 2, [3, 3, 0, 0]);
          ctx.fill();
          ctx.fillStyle = "#4A4640";
          ctx.font = "8px sans-serif";
          ctx.textAlign = "center";
          var lbl = keys[i].substring(5);
          ctx.fillText(lbl, x + bw, H - pad.b + 12);
        }
      }

      /* CHARTS */
      function drawLineChart() {
        var canvas = document.getElementById("rrChart"),
          ctx = canvas.getContext("2d");
        var sorted = trades.slice().sort(function (a, b) {
          return (a.date || "") < (b.date || "") ? -1 : 1;
        });
        var cum = 0,
          points = [];
        for (var i = 0; i < sorted.length; i++) {
          var t = sorted[i];
          if (t.result === "Win") cum += Number(t.rr || 1);
          else if (t.result === "Loss") cum -= Number(t.rr || 1);
          points.push(cum);
        }
        var W = canvas.offsetWidth || 600,
          H = 180;
        canvas.width = W;
        canvas.height = H;
        ctx.clearRect(0, 0, W, H);
        if (points.length < 2) {
          ctx.fillStyle = "#9A948A";
          ctx.font = "13px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("Add more trades to see your curve", W / 2, H / 2);
          return;
        }
        var pad = { t: 16, r: 20, b: 30, l: 44 },
          pw = W - pad.l - pad.r,
          ph = H - pad.t - pad.b;
        var minV = Math.min.apply(null, points.concat([0])),
          maxV = Math.max.apply(null, points.concat([0])),
          range = maxV - minV || 1;
        function tx(i) {
          return pad.l + (i / (points.length - 1)) * pw;
        }
        function ty(v) {
          return pad.t + ph - ((v - minV) / range) * ph;
        }
        ctx.beginPath();
        ctx.strokeStyle = "#DDD8CE";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.moveTo(pad.l, ty(0));
        ctx.lineTo(pad.l + pw, ty(0));
        ctx.stroke();
        ctx.setLineDash([]);
        var grad = ctx.createLinearGradient(0, 0, 0, H);
        grad.addColorStop(0, "rgba(45,106,79,0.2)");
        grad.addColorStop(1, "rgba(45,106,79,0)");
        ctx.beginPath();
        ctx.moveTo(tx(0), ty(points[0]));
        for (var i = 1; i < points.length; i++)
          ctx.lineTo(tx(i), ty(points[i]));
        ctx.lineTo(tx(points.length - 1), ty(0));
        ctx.lineTo(tx(0), ty(0));
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(tx(0), ty(points[0]));
        for (var i = 1; i < points.length; i++)
          ctx.lineTo(tx(i), ty(points[i]));
        ctx.strokeStyle = "#2D6A4F";
        ctx.lineWidth = 2;
        ctx.lineJoin = "round";
        ctx.stroke();
        ctx.fillStyle = "#9A948A";
        ctx.font = "10px monospace";
        ctx.textAlign = "right";
        ctx.fillText(minV.toFixed(1) + "R", pad.l - 4, ty(minV) + 4);
        ctx.fillText(maxV.toFixed(1) + "R", pad.l - 4, ty(maxV) + 4);
      }
      function drawDonut(w, l, b) {
        var canvas = document.getElementById("donutChart"),
          ctx = canvas.getContext("2d"),
          total = w + l + b;
        ctx.clearRect(0, 0, 150, 150);
        if (!total) {
          ctx.fillStyle = "#DDD8CE";
          ctx.beginPath();
          ctx.arc(75, 75, 55, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(75, 75, 35, 0, Math.PI * 2);
          ctx.fill();
          document.getElementById("donut-legend").innerHTML =
            '<div style="text-align:center;color:var(--ink-muted);font-size:0.78rem">No data</div>';
          return;
        }
        var slices = [
          { v: w, c: "#2D6A4F", l: "Win" },
          { v: l, c: "#9B2335", l: "Loss" },
          { v: b, c: "#2C4A7C", l: "BE" },
        ];
        var angle = -Math.PI / 2;
        for (var i = 0; i < slices.length; i++) {
          if (!slices[i].v) continue;
          var sweep = (slices[i].v / total) * Math.PI * 2;
          ctx.beginPath();
          ctx.moveTo(75, 75);
          ctx.arc(75, 75, 65, angle, angle + sweep);
          ctx.closePath();
          ctx.fillStyle = slices[i].c;
          ctx.fill();
          angle += sweep;
        }
        ctx.beginPath();
        ctx.arc(75, 75, 38, 0, Math.PI * 2);
        ctx.fillStyle = "white";
        ctx.fill();
        ctx.fillStyle = "#1A1814";
        ctx.font = "bold 13px monospace";
        ctx.textAlign = "center";
        ctx.fillText(total, 75, 79);
        var legend = "";
        for (var i = 0; i < slices.length; i++) {
          if (!slices[i].v) continue;
          legend +=
            '<div class="legend-item"><div class="legend-dot" style="background:' +
            slices[i].c +
            '"></div><span>' +
            slices[i].l +
            ": <strong>" +
            slices[i].v +
            "</strong> (" +
            Math.round((slices[i].v / total) * 100) +
            "%)</span></div>";
        }
        document.getElementById("donut-legend").innerHTML = legend;
      }
      function drawBarChart(id, data) {
        var canvas = document.getElementById(id),
          ctx = canvas.getContext("2d");
        var keys = Object.keys(data),
          vals = Object.values(data);
        var W = canvas.offsetWidth || 300,
          H = 140;
        canvas.width = W;
        canvas.height = H;
        ctx.clearRect(0, 0, W, H);
        if (!keys.length) {
          ctx.fillStyle = "#9A948A";
          ctx.font = "12px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText("No data", W / 2, H / 2);
          return;
        }
        var pad = { t: 10, r: 10, b: 36, l: 10 },
          pw = W - pad.l - pad.r,
          ph = H - pad.t - pad.b;
        var maxV = Math.max.apply(null, vals),
          bw = (pw / keys.length) * 0.55,
          gap = pw / keys.length;
        var colors = [
          "#C9A84C",
          "#2D6A4F",
          "#9B2335",
          "#2C4A7C",
          "#6A4CA8",
          "#4C8A6A",
        ];
        for (var i = 0; i < keys.length; i++) {
          var bh = (vals[i] / maxV) * ph,
            x = pad.l + i * gap + (gap - bw) / 2,
            y = pad.t + ph - bh;
          ctx.fillStyle = colors[i % colors.length];
          ctx.beginPath();
          ctx.roundRect(x, y, bw, bh, [3, 3, 0, 0]);
          ctx.fill();
          ctx.fillStyle = "#4A4640";
          ctx.font = "8px sans-serif";
          ctx.textAlign = "center";
          ctx.fillText(
            keys[i].length > 10 ? keys[i].slice(0, 9) + "..." : keys[i],
            x + bw / 2,
            H - pad.b + 12
          );
          ctx.fillStyle = "#1A1814";
          ctx.font = "bold 9px monospace";
          ctx.fillText(vals[i], x + bw / 2, y - 3);
        }
      }

      /* NOTES */
      async function loadNotes() {
        var r = await sb
          .from("journal_notes")
          .select("*")
          .eq("user_id", currentUser.id)
          .order("date", { ascending: false });
        if (!r.error) notes = r.data || [];
      }
      function renderNotesList() {
        var el = document.getElementById("notes-list");
        if (!notes.length) {
          el.innerHTML =
            '<div style="padding:24px;text-align:center;color:var(--ink-muted);font-size:0.82rem">No notes yet. Create your first!</div>';
          return;
        }
        var html = "";
        for (var i = 0; i < notes.length; i++) {
          var n = notes[i];
          html +=
            '<div class="note-item' +
            (editingNoteId === n.id ? " active" : "") +
            '" onclick="openNote(\'' +
            n.id +
            '\')"><div class="note-item-date">' +
            (n.date || "") +
            '</div><div class="note-item-preview">' +
            (n.content || "").substring(0, 60) +
            "</div></div>";
        }
        el.innerHTML = html;
      }
      function newNote() {
        editingNoteId = null;
        document.getElementById("note-date").value = new Date()
          .toISOString()
          .split("T")[0];
        document.getElementById("note-content").value = "";
        document.getElementById("note-editor").style.display = "flex";
        document.getElementById("note-editor").style.flexDirection = "column";
        document.getElementById("note-empty").style.display = "none";
        renderNotesList();
      }
      function openNote(id) {
        var n = notes.find(function (x) {
          return String(x.id) === String(id);
        });
        if (!n) return;
        editingNoteId = id;
        document.getElementById("note-date").value = n.date || "";
        document.getElementById("note-content").value = n.content || "";
        document.getElementById("note-editor").style.display = "flex";
        document.getElementById("note-editor").style.flexDirection = "column";
        document.getElementById("note-empty").style.display = "none";
        renderNotesList();
      }
      async function saveNote() {
        var date = document.getElementById("note-date").value;
        var content = document.getElementById("note-content").value.trim();
        if (!content) {
          showToast("Write something first!");
          return;
        }
        showLoading("Saving note...");
        if (editingNoteId) {
          var r = await sb
            .from("journal_notes")
            .update({ date: date, content: content })
            .eq("id", editingNoteId)
            .select();
          hideLoading();
          if (r.error) {
            showToast("Error saving");
            return;
          }
          var idx = notes.findIndex(function (x) {
            return String(x.id) === String(editingNoteId);
          });
          if (idx > -1) notes[idx] = r.data[0];
        } else {
          var r = await sb
            .from("journal_notes")
            .insert([{ user_id: currentUser.id, date: date, content: content }])
            .select();
          hideLoading();
          if (r.error) {
            showToast("Error saving");
            return;
          }
          notes.unshift(r.data[0]);
          editingNoteId = r.data[0].id;
        }
        showToast("Note saved!");
        renderNotesList();
      }
      async function deleteNote() {
        if (!editingNoteId || !confirm("Delete this note?")) return;
        showLoading("Deleting...");
        await sb.from("journal_notes").delete().eq("id", editingNoteId);
        hideLoading();
        notes = notes.filter(function (x) {
          return String(x.id) !== String(editingNoteId);
        });
        editingNoteId = null;
        document.getElementById("note-editor").style.display = "none";
        document.getElementById("note-empty").style.display = "flex";
        renderNotesList();
        showToast("Note deleted");
      }

      /* EXPORT */
      function getExportTrades() {
        var from = document.getElementById("export-from").value,
          to = document.getElementById("export-to").value,
          res = [];
        for (var i = 0; i < trades.length; i++) {
          var t = trades[i];
          if (from && t.date && t.date < from) continue;
          if (to && t.date && t.date > to) continue;
          res.push(t);
        }
        return res;
      }
      function updateExportCount() {
        var n = getExportTrades().length;
        document.getElementById("export-count-label").textContent =
          n + " trade" + (n !== 1 ? "s" : "") + " in range";
      }
      function openExportModal() {
        var today = new Date().toISOString().split("T")[0];
        var dates = [];
        for (var i = 0; i < trades.length; i++) {
          if (trades[i].date) dates.push(trades[i].date);
        }
        dates.sort();
        document.getElementById("export-from").value = dates.length
          ? dates[0]
          : today;
        document.getElementById("export-to").value = today;
        updateExportCount();
        document.getElementById("export-modal").classList.add("open");
      }
      function closeExportModal() {
        document.getElementById("export-modal").classList.remove("open");
      }
      function exportCSV() {
        var f = getExportTrades();
        if (!f.length) {
          showToast("No trades in range!");
          return;
        }
        var w = 0,
          l = 0,
          b = 0,
          rs = 0,
          rc = 0;
        for (var i = 0; i < f.length; i++) {
          if (f[i].result === "Win") w++;
          else if (f[i].result === "Loss") l++;
          else b++;
          if (f[i].rr !== null && f[i].rr !== undefined) {
            rs += Number(f[i].rr);
            rc++;
          }
        }
        var csv =
          "TRADELOG SUMMARY\nGenerated:," +
          new Date().toLocaleDateString() +
          "\nTotal:," +
          f.length +
          "\nWin Rate:," +
          (f.length ? Math.round((w / f.length) * 100) : 0) +
          "%\nWins:," +
          w +
          "\nLosses:," +
          l +
          "\nBE:," +
          b +
          "\nAvg RR:," +
          (rc ? (rs / rc).toFixed(2) : "N/A") +
          "R\n\n";
        csv +=
          "#,Date,Pair,Dir,Session,Setup,Entry,SL,TP,Lot,RR,Result,Mindset,Notes\n";
        var rev = f.slice().reverse();
        for (var i = 0; i < rev.length; i++) {
          var t = rev[i];
          csv +=
            [
              i + 1,
              t.date || "",
              t.pair || "",
              t.dir || "",
              t.session || "",
              (t.setup || "").replace(/,/g, " "),
              t.entry !== null && t.entry !== undefined ? t.entry : "",
              t.sl !== null && t.sl !== undefined ? t.sl : "",
              t.tp !== null && t.tp !== undefined ? t.tp : "",
              t.lot !== null && t.lot !== undefined ? t.lot : "",
              t.rr !== null && t.rr !== undefined ? t.rr : "",
              t.result || "",
              t.mindset !== null && t.mindset !== undefined ? t.mindset : "",
              (t.notes || "").replace(/,/g, " ").replace(/\n/g, " "),
            ].join(",") + "\n";
        }
        var blob = new Blob([csv], { type: "text/csv" }),
          url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download =
          "TradeLog_" + new Date().toISOString().split("T")[0] + ".csv";
        a.click();
        URL.revokeObjectURL(url);
        closeExportModal();
        showToast("CSV downloaded!");
      }
      function exportPDF() {
        var f = getExportTrades();
        if (!f.length) {
          showToast("No trades in range!");
          return;
        }
        var jsPDF = window.jspdf.jsPDF,
          doc = new jsPDF({
            orientation: "landscape",
            unit: "mm",
            format: "a4",
          });
        var w = 0,
          l = 0,
          b = 0,
          rs = 0,
          rc = 0;
        for (var i = 0; i < f.length; i++) {
          if (f[i].result === "Win") w++;
          else if (f[i].result === "Loss") l++;
          else b++;
          if (f[i].rr !== null && f[i].rr !== undefined) {
            rs += Number(f[i].rr);
            rc++;
          }
        }
        doc.setFillColor(26, 24, 20);
        doc.rect(0, 0, 297, 20, "F");
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text("TradeLog Journal", 14, 13);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.text("Generated: " + new Date().toLocaleDateString(), 220, 13);
        doc.setTextColor(26, 24, 20);
        doc.setFontSize(9);
        var sx = 14;
        var sp = [
          ["Total: " + f.length, "Wins: " + w],
          ["Losses: " + l, "BE: " + b],
          [
            "Win Rate: " +
              (f.length ? Math.round((w / f.length) * 100) : 0) +
              "%",
            "Avg RR: " + (rc ? (rs / rc).toFixed(2) : "N/A") + "R",
          ],
        ];
        for (var i = 0; i < sp.length; i++) {
          doc.setFont("helvetica", "bold");
          doc.text(sp[i][0], sx, 28);
          doc.setFont("helvetica", "normal");
          doc.text(sp[i][1], sx, 34);
          sx += 80;
        }
        var headers = [
            "#",
            "Date",
            "Pair",
            "Dir",
            "Session",
            "Setup",
            "Entry",
            "SL",
            "TP",
            "Lot",
            "RR",
            "Result",
            "Notes",
          ],
          colW = [8, 20, 18, 10, 22, 28, 16, 14, 14, 10, 12, 16, 39],
          y = 42;
        doc.setFillColor(243, 240, 232);
        doc.rect(14, y, 269, 7, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        var x = 14;
        for (var i = 0; i < headers.length; i++) {
          doc.text(headers[i], x + 1, y + 5);
          x += colW[i];
        }
        y += 8;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        var rev = f.slice().reverse();
        for (var i = 0; i < rev.length; i++) {
          var t = rev[i];
          if (y > 185) {
            doc.addPage();
            y = 14;
          }
          if (i % 2 === 0) {
            doc.setFillColor(250, 248, 243);
            doc.rect(14, y, 269, 6, "F");
          }
          doc.setTextColor(26, 24, 20);
          var row = [
            i + 1,
            t.date || "-",
            t.pair || "-",
            t.dir || "-",
            t.session || "-",
            (t.setup || "-").split(" - ")[0],
            t.entry !== null && t.entry !== undefined ? t.entry : "-",
            t.sl !== null && t.sl !== undefined ? t.sl : "-",
            t.tp !== null && t.tp !== undefined ? t.tp : "-",
            t.lot !== null && t.lot !== undefined ? t.lot : "-",
            t.rr ? t.rr + "R" : "-",
            t.result || "-",
            (t.notes || "-").substring(0, 35),
          ];
          x = 14;
          for (var j = 0; j < row.length; j++) {
            doc.text(String(row[j]), x + 1, y + 4.5);
            x += colW[j];
          }
          y += 6;
        }
        for (var i = 0; i < f.length; i++) {
          var t = f[i];
          if (!t.screenshot) continue;
          doc.addPage();
          doc.setFillColor(26, 24, 20);
          doc.rect(0, 0, 297, 14, "F");
          doc.setTextColor(255, 255, 255);
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text(
            (t.pair || "") +
              " | " +
              (t.dir || "") +
              " | " +
              (t.date || "") +
              " | " +
              (t.result || "") +
              (t.rr ? " | " + t.rr + "R" : ""),
            14,
            10
          );
          try {
            doc.addImage(
              t.screenshot,
              "JPEG",
              14,
              18,
              269,
              170,
              undefined,
              "FAST"
            );
          } catch (e) {}
        }
        doc.save("TradeLog_" + new Date().toISOString().split("T")[0] + ".pdf");
        closeExportModal();
        showToast("PDF downloaded!");
      }

      window.onresize = function () {
        if (
          document.getElementById("view-dashboard").classList.contains("active")
        )
          renderDashboard();
      };