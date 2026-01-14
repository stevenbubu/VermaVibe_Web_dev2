(function () {
  const BASE_PATH = window.__BASE_PATH__ || "/VermaVibe_Web_dev/";
  const DOMAIN = window.__DOMAIN__ || "https://stevenbubu.github.io";
  const stage = document.getElementById("stage");
  const albumName = document.getElementById("albumName");
  const toolbar = document.getElementById("toolbar");

  const ROUTES = {
    about: {
      partial: `${BASE_PATH}partials/about.html`,
      title: "VermaVibe｜About",
      desc: "智慧農業技術與合作方案",
      og: `${BASE_PATH}images/About/cover.jpg`,
      init: initAbout,
    },
    tech: {
      partial: `${BASE_PATH}partials/tech.html`,
      title: "VermaVibe｜Tech",
      desc: "技術與研發",
      og: `${BASE_PATH}images/Tech/cover.jpg`,
      init: () => window.initViewer("tech"),
    },
    cases: {
      partial: `${BASE_PATH}partials/cases.html`,
      title: "VermaVibe｜Case",
      desc: "成功案例",
      og: `${BASE_PATH}images/Cases/cover.jpg`,
      init: () => window.initViewer("cases"),
    },
    collaborate: {
      partial: `${BASE_PATH}partials/collaborate.html`,
      title: "VermaVibe｜Collaborate",
      desc: "合作方案",
      og: `${BASE_PATH}images/Collab/cover.jpg`,
      init: () => window.initViewer("collaborate"),
    },
    contact: {
      partial: `${BASE_PATH}partials/contact.html`,
      title: "VermaVibe｜Contact",
      desc: "聯絡我們",
      og: `${BASE_PATH}assets/icons/logo.png`,
      init: () => window.initContact(),
    },
    result: {
      partial: `${BASE_PATH}partials/result.html`,
      title: "VermaVibe｜Result",
      desc: "送出結果",
      og: `${BASE_PATH}assets/icons/logo.png`,
      init: initResult,
    },
  };

  toolbar.addEventListener("click", (e) => {
    const b = e.target.closest("[data-go]");
    if (!b) return;
    const page = b.dataset.go;
    location.hash = `#/${page}`;
    setActive(page);
  });

  function parseHash() {
    const h = (location.hash || "#/about").replace("#/", "");
    const page = h.split("?")[0] || "about";
    const qs = h.includes("?") ? h.split("?")[1] : "";
    const params = new URLSearchParams(qs);
    return { page, params };
  }

  function setActive(page) {
    [...toolbar.querySelectorAll(".tool-btn")].forEach((btn) => {
      const go = btn.dataset.go;
      const isActive = page === go || (page === "result" && go === "contact");
      btn.classList.toggle("active", isActive);
      if (isActive) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    });
    albumName.textContent =
      page === "result"
        ? "Result"
        : window.ALBUMS?.[page]?.label ||
          (ROUTES[page]?.title?.split("｜")[1] ?? "");
  }

  async function injectLD(file, id) {
    try {
      const res = await fetch(file, { cache: "no-store" });
      const txt = await res.text();
      let script = document.getElementById(id);
      if (!script) {
        script = document.createElement("script");
        script.id = id;
        script.type = "application/ld+json";
        document.head.appendChild(script);
      }
      script.textContent = txt;
    } catch (e) {}
  }
  async function injectBaseLD() {
    await injectLD(`${BASE_PATH}seo/organization.jsonld`, "ld-org");
    await injectLD(`${BASE_PATH}seo/website.jsonld`, "ld-website");
  }
  async function injectPageLD(page) {
    await injectLD(`${BASE_PATH}seo/webpage-${page}.jsonld`, "ld-webpage");
  }

  function setHead(page) {
    const cfg = ROUTES[page] || ROUTES.about;
    document.title = cfg.title;
    const canonical = document.getElementById("canonical");
    const ogUrl = document.getElementById("ogUrl");
    const ogImg = document.getElementById("ogImage");
    const twImg = document.getElementById("twitterImage");
    const pageUrl = `${DOMAIN}${BASE_PATH}${
      page === "about" ? "" : "#/" + page
    }`;
    if (canonical) canonical.setAttribute("href", pageUrl);
    if (ogUrl) ogUrl.setAttribute("content", pageUrl);
    if (ogImg)
      ogImg.setAttribute(
        "content",
        `${DOMAIN}${BASE_PATH}images/${
          page === "collaborate"
            ? "Collab"
            : page.charAt(0).toUpperCase() + page.slice(1)
        }/cover.jpg`
      );
    if (twImg)
      twImg.setAttribute(
        "content",
        `${DOMAIN}${BASE_PATH}images/${
          page === "collaborate"
            ? "Collab"
            : page.charAt(0).toUpperCase() + page.slice(1)
        }/cover.jpg`
      );
  }

  async function load(page) {
    const cfg = ROUTES[page] || ROUTES.about;
    const res = await fetch(cfg.partial, { cache: "no-store" });
    stage.innerHTML = await res.text();
    setHead(page);
    await injectPageLD(page);
    setActive(page);
    cfg.init(parseHash().params);
  }

  function initAbout() {
    const stageEl = document.getElementById("stage");
    stageEl.classList.add("scroll"); // 啟用垂直滾動（CSS 已支援）
    stageEl.style.touchAction = "auto"; // 讓手機可正常捲動
  }

  async function initResult(params) {
    const wrap = stage.querySelector(".contact-wrap");
    if (!wrap) return;
    const status = params.get("status") || "success";
    const msg = params.get("msg") || "";
    const box = wrap.querySelector("#resultBox");
    const title = wrap.querySelector("#resultTitle");
    title.textContent =
      status === "success" ? "Sent Successfully" : "Failed to Send";
    box.style.background =
      status === "success"
        ? "rgba(0, 212, 255, 0.10)"
        : "rgba(255, 100, 100, 0.10)";
    box.innerHTML = `<div style=\"font-weight:700\">${
      status === "success"
        ? "✅ Message sent successfully."
        : "❌ Failed to send."
    }</div>${
      msg
        ? `<div class=\"muted\" style=\"margin-top:4px;word-break:break-word;\">${msg}</div>`
        : ""
    }`;
    wrap.querySelector("#backBtn")?.addEventListener("click", () => {
      location.hash = "#/contact";
      setActive("contact");
    });
    wrap.querySelector("#homeBtn")?.addEventListener("click", () => {
      location.hash = "#/about";
      setActive("about");
    });
    wrap.scrollIntoView({ block: "start", inline: "nearest" });
  }

  window.addEventListener("hashchange", () => {
    const { page } = parseHash();
    setActive(page);
    load(page);
  });

  (async function bootstrap() {
    await injectBaseLD();
    const { page } = parseHash();
    await load(page);
  })();
})();
