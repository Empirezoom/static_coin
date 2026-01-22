/* ORYX front-end mock app (client-only) */
(function () {
  const STORAGE_KEY = "oryx_users_v1";

  function load() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function save(data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // helper to find user by email
  function findByEmail(email) {
    const s = load();
    return Object.values(s).find((u) => u.email === email);
  }

  const API = {
    register({ name, email, password, phone, country }) {
      const data = load();
      if (findByEmail(email)) throw new Error("Account exists");
      const id = "O_X" + Date.now();
      const defaultWallet = {
        btc: "1KMu1aYqv1N1Jn8YEqDYgAEYyVUnmieeQm",
        eth: "0x73265524c5f9390fa731d72a3565b034a7c2e254",
        usdt: "0x73265524c5f9390fa731d72a3565b034a7c2e254",
      };
      const balances = { btc: 0.012345, eth: 0.3456, usdt: 123.45 };
      const txs = { btc: [], eth: [], usdt: [] };
      data[id] = {
        id,
        name,
        email,
        password,
        phone,
        country,
        verified: false,
        verificationPending: false,
        wallet: defaultWallet,
        balances,
        txs,
        depositRequests: [],
      };
      save(data);
      return data[id];
    },
    login(email, password) {
      const user = findByEmail(email);
      if (user && user.password === password) {
        localStorage.setItem("oryx_current", user.id);
        return true;
      }
      return false;
    },
    currentUser() {
      const id = localStorage.getItem("oryx_current");
      if (!id) return null;
      const data = load();
      return data[id] || null;
    },
    logout() {
      localStorage.removeItem("oryx_current");
    },
    updateProfile({ name, phone, country }) {
      const id = localStorage.getItem("oryx_current");
      if (!id) return;
      const d = load();
      if (name !== undefined) d[id].name = name;
      if (phone !== undefined) d[id].phone = phone;
      if (country !== undefined) d[id].country = country;
      save(d);
    },
    changePassword({ oldPassword, newPassword }) {
      const id = localStorage.getItem("oryx_current");
      if (!id) return { ok: false, error: "not_logged_in" };
      const d = load();
      const user = d[id];
      if (!user) return { ok: false, error: "user_not_found" };
      if (user.password !== oldPassword)
        return { ok: false, error: "wrong_password" };
      user.password = newPassword;
      save(d);
      // send simulated email/notification
      try {
        API.sendNotification(
          id,
          "Password changed",
          "Your account password was changed. If this wasn't you, contact support.",
        );
      } catch (e) {}
      return { ok: true };
    },
    submitVerification({ ssn, fileName }) {
      const id = localStorage.getItem("oryx_current");
      if (!id) return;
      const d = load();
      d[id].verificationPending = true;
      d[id].verification = { ssn, fileName, submittedAt: Date.now() };
      save(d);
    },
    addDepositRequest({ method, amount }) {
      const id = localStorage.getItem("oryx_current");
      if (!id) return;
      const d = load();
      const req = {
        id: "r_" + Date.now(),
        method,
        amount,
        status: "pending",
        createdAt: Date.now(),
      };
      d[id].depositRequests = d[id].depositRequests || [];
      d[id].depositRequests.push(req);
      save(d);
      return req;
    },
    // transaction helpers
    getBalance(currency) {
      const u = API.currentUser();
      if (!u) return 0;
      return (u.balances && u.balances[currency]) || 0;
    },
    getTransactions(currency) {
      const u = API.currentUser();
      if (!u) return [];
      return (u.txs && u.txs[currency]) || [];
    },
    // crypto rates helpers
    getCryptoRate(currency) {
      return window.CryptoPrices ? window.CryptoPrices.getRate(currency) : 0;
    },
    convertToUSD(amount, currency) {
      if (currency === "usdt") return amount; // USDT is already pegged to USD
      const rate = this.getCryptoRate(currency);
      return amount * rate;
    },
    formatUSD(amount) {
      return window.CryptoPrices
        ? window.CryptoPrices.toUsd(amount)
        : `$${amount.toFixed(2)}`;
    },
    addTransaction(currency, tx) {
      const id = localStorage.getItem("oryx_current");
      if (!id) return;
      const d = load();
      d[id].txs = d[id].txs || {};
      d[id].txs[currency] = d[id].txs[currency] || [];
      d[id].txs[currency].unshift(tx);
      // update balances for mock receive/send
      if (tx.type === "receive")
        d[id].balances[currency] =
          (d[id].balances[currency] || 0) + Number(tx.amount);
      if (tx.type === "send")
        d[id].balances[currency] =
          (d[id].balances[currency] || 0) - Number(tx.amount);
      save(d);
    },
    // live chat helpers (global channel stored in localStorage)
    getChatMessages() {
      try {
        return JSON.parse(localStorage.getItem("oryx_livechat_v1") || "[]");
      } catch (e) {
        return [];
      }
    },
    sendChatMessage({ userId, sender, text, attachment }) {
      const msgs = API.getChatMessages();
      const m = {
        id: "m_" + Date.now(),
        userId: userId || null,
        sender,
        text,
        createdAt: Date.now(),
        read: false,
      };
      if (attachment && attachment.name && attachment.dataUrl) {
        m.attachment = { name: attachment.name, dataUrl: attachment.dataUrl };
      }
      msgs.push(m);
      localStorage.setItem("oryx_livechat_v1", JSON.stringify(msgs));
      return m;
    },
    clearChat() {
      localStorage.removeItem("oryx_livechat_v1");
    },
    // mark messages for a conversation as read
    markMessagesRead(userId) {
      const msgs = API.getChatMessages();
      msgs.forEach((m) => {
        if ((userId === null && m.userId === null) || m.userId === userId)
          m.read = true;
      });
      localStorage.setItem("oryx_livechat_v1", JSON.stringify(msgs));
    },
    // conversation metadata helpers
    getConversationMeta(userId) {
      try {
        const meta = JSON.parse(
          localStorage.getItem("oryx_conv_meta_v1") || "{}",
        );
        return meta[userId] || {};
      } catch (e) {
        return {};
      }
    },
    setConversationMeta(userId, meta) {
      try {
        const all = JSON.parse(
          localStorage.getItem("oryx_conv_meta_v1") || "{}",
        );
        all[userId] = Object.assign(all[userId] || {}, meta);
        localStorage.setItem("oryx_conv_meta_v1", JSON.stringify(all));
      } catch (e) {}
    },
    // custom logo as data URL (client-side only)
    setCustomLogo(dataUrl) {
      localStorage.setItem("oryx_custom_logo_v1", dataUrl);
    },
    getCustomLogo() {
      return localStorage.getItem("oryx_custom_logo_v1") || null;
    },
    setCustomFavicon(dataUrl) {
      localStorage.setItem("oryx_custom_favicon_v1", dataUrl);
    },
    getCustomFavicon() {
      return localStorage.getItem("oryx_custom_favicon_v1") || null;
    },
    // deposit helpers for admin
    getAllDepositRequests() {
      const data = load();
      const all = [];
      Object.values(data).forEach((u) => {
        (u.depositRequests || []).forEach((r) =>
          all.push(
            Object.assign({}, r, {
              userId: u.id,
              userName: u.name,
              userEmail: u.email,
            }),
          ),
        );
      });
      return all;
    },
    // simulated notification (email) helpers
    sendNotification(userId, subject, body) {
      try {
        const key = "oryx_notifications_v1";
        const all = JSON.parse(localStorage.getItem(key) || "[]");
        all.push({
          id: "n_" + Date.now(),
          userId,
          subject,
          body,
          createdAt: Date.now(),
          read: false,
        });
        localStorage.setItem(key, JSON.stringify(all));
      } catch (e) {
        console.error(e);
      }
    },
    getNotifications(userId) {
      try {
        const key = "oryx_notifications_v1";
        const all = JSON.parse(localStorage.getItem(key) || "[]");
        return all.filter((n) => n.userId === userId);
      } catch (e) {
        return [];
      }
    },
    markNotificationRead(notificationId) {
      try {
        const key = "oryx_notifications_v1";
        const all = JSON.parse(localStorage.getItem(key) || "[]");
        all.forEach((n) => {
          if (n.id === notificationId) n.read = true;
        });
        localStorage.setItem(key, JSON.stringify(all));
      } catch (e) {}
    },
    // withdrawals
    addWithdrawalRequest(data) {
      const {
        amount,
        currency,
        method,
        reference,
        accountDetails,
        paypalEmail,
        cashappTag,
      } = data;
      const id = localStorage.getItem("oryx_current");
      if (!id) return null;
      const d = load();
      const req = {
        id: "w_" + Date.now(),
        amount,
        currency,
        method,
        reference,
        status: "pending",
        createdAt: Date.now(),
      };

      // Add method-specific details
      if (method === "bank" && accountDetails) {
        req.accountDetails = accountDetails;
      } else if (method === "paypal" && paypalEmail) {
        req.paypalEmail = paypalEmail;
      } else if (method === "cashapp" && cashappTag) {
        req.cashappTag = cashappTag;
      }

      d[id].withdrawalRequests = d[id].withdrawalRequests || [];
      d[id].withdrawalRequests.push(req);
      save(d);

      // Create detailed chat message for admin
      let details = `Withdrawal request: $${amount} via ${method}`;
      if (method === "bank") {
        details += ` to ${accountDetails.accountName} (${accountDetails.bankName})`;
      } else if (method === "paypal") {
        details += ` to ${paypalEmail}`;
      } else if (method === "cashapp") {
        details += ` to ${cashappTag}`;
      }
      if (reference) details += ` (Note: ${reference})`;

      API.sendChatMessage({
        userId: id,
        sender: "user",
        text: details,
      });
      return req;
    },
    getAllWithdrawalRequests() {
      const data = load();
      const all = [];
      Object.values(data).forEach((u) => {
        (u.withdrawalRequests || []).forEach((r) =>
          all.push(
            Object.assign({}, r, {
              userId: u.id,
              userName: u.name,
              userEmail: u.email,
            }),
          ),
        );
      });
      return all;
    },
    updateWithdrawalStatus(requestId, status) {
      const d = load();
      Object.keys(d).forEach((k) => {
        const user = d[k];
        if (!user.withdrawalRequests) return;
        user.withdrawalRequests.forEach((r) => {
          if (r.id === requestId) r.status = status;
        });
      });
      save(d);
      // notify affected user (simulated email)
      const all = load();
      Object.keys(all).forEach((k) => {
        const u = all[k];
        (u.withdrawalRequests || []).forEach((r) => {
          if (r.id === requestId) {
            API.sendNotification(
              u.id,
              "Withdrawal request update",
              `Your withdrawal ${r.id} is now ${r.status}`,
            );
          }
        });
      });
    },
    updateDepositStatus(requestId, status) {
      const d = load();
      Object.keys(d).forEach((k) => {
        const user = d[k];
        if (!user.depositRequests) return;
        user.depositRequests.forEach((r) => {
          if (r.id === requestId) r.status = status;
        });
      });
      save(d);
      // notify affected user (simulated email)
      const all = load();
      Object.keys(all).forEach((k) => {
        const u = all[k];
        (u.depositRequests || []).forEach((r) => {
          if (r.id === requestId) {
            API.sendNotification(
              u.id,
              "Deposit request update",
              `Your deposit request ${r.id} is now ${r.status}`,
            );
          }
        });
      });
    },
    sendReset(email) {
      const user = findByEmail(email);
      if (!user) return false;
      /* simulate email */ return true;
    },
    registerAuto(user) {
      return API.register(user);
    },
    randomBtcAddress() {
      return randomBtcAddress();
    },
  };

  function randomBtcAddress() {
    // not real-safe, just mock
    const chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
    let s = "";
    for (let i = 0; i < 34; i++)
      s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  }

  // expose small helper
  window.ORYXAuth = {
    register: API.register,
    login: API.login,
    currentUser: API.currentUser,
    logout: API.logout,
    updateProfile: API.updateProfile,
    submitVerification: API.submitVerification,
    addDepositRequest: API.addDepositRequest,
    sendReset: API.sendReset,
    randomBtcAddress: API.randomBtcAddress,
    // balances / txs
    getBalance: API.getBalance,
    getTransactions: API.getTransactions,
    addTransaction: API.addTransaction,
    // crypto rates
    getCryptoRate: API.getCryptoRate,
    convertToUSD: API.convertToUSD,
    formatUSD: API.formatUSD,
    // chat / admin
    getChatMessages: API.getChatMessages,
    sendChatMessage: API.sendChatMessage,
    clearChat: API.clearChat,
    markMessagesRead: API.markMessagesRead,
    getConversationMeta: API.getConversationMeta,
    setConversationMeta: API.setConversationMeta,
    getAllDepositRequests: API.getAllDepositRequests,
    updateDepositStatus: API.updateDepositStatus,
    // notifications
    getNotifications: API.getNotifications,
    markNotificationRead: API.markNotificationRead,
    changePassword: API.changePassword,
    // custom logo
    setCustomLogo: API.setCustomLogo,
    getCustomLogo: API.getCustomLogo,
    setCustomFavicon: API.setCustomFavicon,
    getCustomFavicon: API.getCustomFavicon,
    // withdrawals
    addWithdrawalRequest: API.addWithdrawalRequest,
    getAllWithdrawalRequests: API.getAllWithdrawalRequests,
    updateWithdrawalStatus: API.updateWithdrawalStatus,
  };
  // inject lightweight responsive helpers so all pages behave better on small screens
  (function () {
    try {
      const css = `
html,body{-webkit-text-size-adjust:100%;}
img,canvas,svg{max-width:100%;height:auto;}
.font-mono{word-break:break-all;overflow-wrap:anywhere;}
@media (max-width:640px){
  .grid-cols-3{grid-template-columns:repeat(1,minmax(0,1fr));}
  .max-w-6xl,.max-w-4xl,.max-w-lg,.max-w-md{padding-left:1rem;padding-right:1rem;}
  .p-6{padding:1rem;}
  .mt-6{margin-top:1.25rem;}
  .flex.items-center.justify-between{flex-direction:column;align-items:flex-start;gap:0.5rem;}
  button, .px-4, .px-3{min-height:44px;}
  .font-medium{font-size:1rem;}
  /* chat form mobile fixes */
  .flex.gap-2{flex-direction:column;gap:0.5rem;}
  input[type="file"]{font-size:14px;padding:0.5rem;border:1px solid #d1d5db;border-radius:0.375rem;}
  .flex-1{min-width:0;}
}
/* Dark mode styles */
.dark {
  background-color: #1f2937;
  color: #f9fafb;
}
.dark .bg-white { background-color: #374151; }
.dark .bg-slate-50 { background-color: #111827; }
.dark .bg-slate-100 { background-color: #374151; }
.dark .bg-indigo-600 { background-color: #4f46e5; }
.dark .text-slate-600 { color: #d1d5db; }
.dark .text-slate-500 { color: #9ca3af; }
.dark .text-slate-700 { color: #d1d5db; }
.dark .text-slate-800 { color: #f9fafb; }
.dark .text-indigo-600 { color: #a5b4fc; }
.dark .border { border-color: #4b5563; }
.dark .shadow { box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.5); }
.dark input, .dark select, .dark textarea {
  background-color: #374151;
  color: #f9fafb;
  border-color: #4b5563;
}
.dark input::placeholder, .dark select::placeholder {
  color: #9ca3af;
}
.dark button.bg-slate-200 { background-color: #4b5563; color: #d1d5db; }
.dark .bg-emerald-500 { background-color: #10b981; }
nav { background-color: #ffffff; }
.dark nav { background-color: #000000; }
a { text-decoration: none; color: #2563eb; transition: color 0.2s; }
a:hover { color: #1d4ed8; }
.dark a { color: #60a5fa; }
.dark a:hover { color: #93c5fd; }
/* #homeLink { position: fixed; top: 10px; left: 10px; z-index: 1000; padding: 5px 10px; background-color: #f3f4f6; border-radius: 4px; text-decoration: none; color: #374151; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.dark #homeLink { background-color: #374151; color: #f9fafb; } */
/* Floating toggle button */
#darkModeToggle {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #4f46e5;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 20px;
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
}
.dark #darkModeToggle {
  background-color: #1f2937;
}
`;
      const s = document.createElement("style");
      s.setAttribute("data-oryx-responsive", "1");
      s.appendChild(document.createTextNode(css));
      if (document && document.head) document.head.appendChild(s);
    } catch (e) {}
  })();
  function updateLogo() {
    const logo = document.getElementById("brandLogo");
    if (logo) {
      logo.src = document.body.classList.contains("dark")
        ? "/image/logo.svg"
        : "/image/logo_light.svg";
    }
  }

  // dark mode toggle
  (function () {
    try {
      const btn = document.createElement("button");
      btn.id = "darkModeToggle";
      btn.innerHTML = "🌙";
      btn.title = "Toggle Dark Mode";
      document.body.appendChild(btn);
      // check saved preference
      if (localStorage.getItem("oryx_dark_mode") === "true") {
        document.body.classList.add("dark");
        btn.innerHTML = "☀️";
      }
      updateLogo();
      btn.addEventListener("click", function () {
        document.body.classList.toggle("dark");
        const isDark = document.body.classList.contains("dark");
        localStorage.setItem("oryx_dark_mode", isDark);
        btn.innerHTML = isDark ? "☀️" : "🌙";
        updateLogo();
      });
    } catch (e) {}
  })();

  // add home link on user pages
  /*
  (function () {
    if (
      window.location.pathname !== "/index.html" &&
      !window.location.pathname.includes("admin")
    ) {
      const homeLink = document.createElement("a");
      homeLink.id = "homeLink";
      homeLink.href = "/index.html";
      homeLink.textContent = "Home";
      document.body.appendChild(homeLink);
    }
  })();
  */

  // add link emoji to all anchor tags
  (function () {
    document.querySelectorAll("a").forEach((a) => {
      if (!a.textContent.includes("🔗") && a.textContent.trim()) {
        a.textContent += " 🔗";
      }
    });
  })();
  // Real-time price fetcher (CoinGecko)
  (function () {
    const mapping = { btc: "bitcoin", eth: "ethereum", usdt: "tether" };
    const RATES_KEY = "oryx_crypto_rates_v1";
    let rates = { btc: 0, eth: 0, usdt: 0 };
    let ratesReady = false;
    let timer = null;

    // load cached rates (if any) so UI can show immediate values
    try {
      const cached = JSON.parse(localStorage.getItem(RATES_KEY) || "null");
      if (cached && cached.rates) {
        rates = Object.assign(rates, cached.rates);
        ratesReady = true;
      }
    } catch (e) {}

    async function fetchPrices() {
      try {
        const ids = Object.values(mapping).join(",");
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`,
        );
        const data = await res.json();
        rates.btc = (data.bitcoin && data.bitcoin.usd) || rates.btc;
        rates.eth = (data.ethereum && data.ethereum.usd) || rates.eth;
        rates.usdt = (data.tether && data.tether.usd) || rates.usdt;
        ratesReady = true;
        // persist latest rates for faster subsequent loads
        try {
          localStorage.setItem(
            RATES_KEY,
            JSON.stringify({ rates: rates, ts: Date.now() }),
          );
        } catch (e) {}
        updateFiatDisplays();
        return rates;
      } catch (e) {
        // leave any cached rates in place (ratesReady may already be true)
        if (!ratesReady) updateFiatDisplays();
        return rates;
      }
    }

    function getRate(currency) {
      return rates[currency] || 0;
    }

    function toUsd(amount) {
      if (!amount && amount !== 0) return "$0.00";
      const v = Number(amount) || 0;
      return v.toLocaleString(undefined, {
        style: "currency",
        currency: "USD",
      });
    }

    function updateFiatDisplays() {
      try {
        const btcEl = document.getElementById("balBtc");
        const ethEl = document.getElementById("balEth");
        const usdtEl = document.getElementById("balUsdt");
        if (!ratesReady) {
          // show loading state while we wait for first successful fetch
          const outB = document.getElementById("balBtcUsd");
          if (outB) outB.textContent = "Loading...";
          const outE = document.getElementById("balEthUsd");
          if (outE) outE.textContent = "Loading...";
          const outU = document.getElementById("balUsdtUsd");
          if (outU) outU.textContent = "Loading...";
        } else {
          if (btcEl) {
            const amt = Number(btcEl.textContent) || 0;
            const usd = amt * getRate("btc") || 0;
            const out = document.getElementById("balBtcUsd");
            if (out) out.textContent = toUsd(usd);
          }
          if (ethEl) {
            const amt = Number(ethEl.textContent) || 0;
            const usd = amt * getRate("eth") || 0;
            const out = document.getElementById("balEthUsd");
            if (out) out.textContent = toUsd(usd);
          }
          if (usdtEl) {
            const amt = Number(usdtEl.textContent) || 0;
            const usd = amt * getRate("usdt") || 0;
            const out = document.getElementById("balUsdtUsd");
            if (out) out.textContent = toUsd(usd);
          }
        }
        const ethBal = document.getElementById("ethBalance");
        if (ethBal) {
          const out = document.getElementById("ethBalanceUsd");
          if (!ratesReady) {
            if (out) out.textContent = "Loading...";
          } else {
            const amt = Number(ethBal.textContent) || 0;
            if (out) out.textContent = toUsd(amt * getRate("eth"));
          }
        }
        const usdtBal = document.getElementById("usdtBalance");
        if (usdtBal) {
          const out = document.getElementById("usdtBalanceUsd");
          if (!ratesReady) {
            if (out) out.textContent = "Loading...";
          } else {
            const amt = Number(usdtBal.textContent) || 0;
            if (out) out.textContent = toUsd(amt * getRate("usdt"));
          }
        }
      } catch (e) {}
    }

    function startAuto(intervalMs = 15000) {
      if (timer) clearInterval(timer);
      fetchPrices();
      timer = setInterval(fetchPrices, intervalMs);
    }

    window.CryptoPrices = {
      startAuto,
      fetchPrices,
      getRate,
      updateFiatDisplays,
      toUsd,
    };

    try {
      if (window && window.document) startAuto(15000);
    } catch (e) {}
  })();
})();
