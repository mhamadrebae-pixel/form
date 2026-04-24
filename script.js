const scriptURL = "https://script.google.com/macros/s/AKfycbz7TBH6idJYxkWZXoahqruVXrkWpb17YpsTf92xNHUy8vmeoM9Tsepelu7Q2uiW8Vuk/exec";
 
/* ── DOM refs ──────────────────────────────────── */
const form          = document.getElementById("multiStepForm");
const panels        = Array.from(document.querySelectorAll(".step-panel"));
const chips         = Array.from(document.querySelectorAll("[data-step-chip]"));
const reviewList    = document.getElementById("reviewList");
const confirmRead   = document.getElementById("confirmRead");
const startButton   = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const submitButton  = document.getElementById("submitButton");
const submitMessage = document.getElementById("submitMessage");
const formTrap      = document.getElementById("companyWebsite");
const profRadioOther  = document.getElementById("profRadioOther");
const professionOther = document.getElementById("professionOther");
 
/* ── Constants ─────────────────────────────────── */
const INTRO_STEP        = 0;
const INFO_STEP         = 1;
const REVIEW_STEP       = 2;
const SUCCESS_STEP      = 3;
const SUBMIT_TIMEOUT_MS = 15000;
const MIN_SUBMIT_DELAY  = 1500;
 
const defaultSubmitText = submitButton ? submitButton.textContent.trim() : "";
const loadingSubmitText = defaultSubmitText ? `${defaultSubmitText}...` : "...";
 
const stepFocusSelectors = {
  [INTRO_STEP]:   "#introTitle",
  [INFO_STEP]:    "#fullName",
  [REVIEW_STEP]:  "#reviewTitle",
  [SUCCESS_STEP]: "#successTitle",
};
 
let currentStep    = INTRO_STEP;
let formStartedAt  = Date.now();
 
/* ── Review field definitions ──────────────────── */
const reviewFields = [
  ["ناوی تەواو",      "name"],
  ["ژمارەی مۆبایل",  "phone"],
  ["ئیمەیڵ",         "email"],
  ["شار",            "city"],
  ["ڕەگەز",          "gender"],
  ["تەمەن",          "age"],
  ["بەش",            "department"],
  ["پیشە",           "profession"],
];
 
/* ── Regex helpers ─────────────────────────────── */
const EMAIL_RE        = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SHEET_FORMULA_RE = /^[=+\-@]/;

function syncProfessionOtherState(shouldFocus = false) {
  if (!professionOther) return;

  const isOther = !!(profRadioOther && profRadioOther.checked);
  professionOther.disabled = !isOther;
  professionOther.tabIndex = isOther ? 0 : -1;

  if (!isOther) {
    professionOther.value = "";
    professionOther.setCustomValidity("");
  }

  if (isOther && shouldFocus) {
    professionOther.focus();
  }
}

function syncInitialUiState() {
  if (startButton && confirmRead) {
    startButton.disabled = !confirmRead.checked;
  }

  document.querySelectorAll(".radio-group").forEach(syncRadioCards);
  syncProfessionOtherState(false);
}
 
/* ════════════════════════════════════════════════
   Radio card highlight helper
════════════════════════════════════════════════ */
function syncRadioCards(groupEl) {
  if (!groupEl) return;
  groupEl.querySelectorAll(".radio-card").forEach((card) => {
    const radio = card.querySelector("input[type='radio']");
    card.classList.toggle("is-selected", !!(radio && radio.checked));
  });
}
 
/* Watch all radio groups and update highlight */
document.querySelectorAll(".radio-group").forEach((group) => {
  group.addEventListener("change", () => syncRadioCards(group));
});
 
/* ── Profession "other" — enable / disable text ─ */
document.querySelectorAll("input[name='profession']").forEach((radio) => {
  radio.addEventListener("change", () => {
    syncProfessionOtherState(true);
  });
});
 
/* ════════════════════════════════════════════════
   Utilities
════════════════════════════════════════════════ */
function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}

function getNextCursorPosition(position, originalValue, cleanValue) {
  const safePosition = typeof position === "number" ? position : cleanValue.length;
  const removedChars = originalValue.length - cleanValue.length;
  return Math.max(0, safePosition - removedChars);
}
 
function focusActiveStep(panel) {
  if (!panel) return;
  const sel    = stepFocusSelectors[currentStep];
  const target = panel.querySelector(sel) || panel.querySelector("h2, input, button");
  if (!target) return;
  window.requestAnimationFrame(() => {
    if (target.matches("h2") && !target.hasAttribute("tabindex")) {
      target.setAttribute("tabindex", "-1");
    }
    target.focus({ preventScroll: true });
  });
}
 
/* ════════════════════════════════════════════════
   Step navigation
════════════════════════════════════════════════ */
function showStep(stepIndex) {
  currentStep = stepIndex;
  let activePanel = null;
 
  panels.forEach((panel) => {
    const isCurrent = Number(panel.dataset.step) === currentStep;
    panel.classList.toggle("is-active", isCurrent);
    panel.hidden = !isCurrent;
    panel.setAttribute("aria-hidden", String(!isCurrent));
    if (isCurrent) activePanel = panel;
  });
 
  chips.forEach((chip) => {
    const chipStep     = Number(chip.dataset.stepChip);
    const isActiveChip = chipStep === currentStep && currentStep < SUCCESS_STEP;
    const isDoneChip   = chipStep < currentStep || currentStep === SUCCESS_STEP;
    chip.classList.toggle("is-active",   isActiveChip);
    chip.classList.toggle("is-complete", isDoneChip);
    if (isActiveChip) chip.setAttribute("aria-current", "step");
    else              chip.removeAttribute("aria-current");
  });
 
  window.scrollTo({ top: 0, behavior: "smooth" });
  focusActiveStep(activePanel);
}
 
function getCurrentPanel() {
  return panels.find((p) => Number(p.dataset.step) === currentStep);
}
 
/* ════════════════════════════════════════════════
   Validation
════════════════════════════════════════════════ */
function setFieldMessage(field) {
  if (field.validity.valueMissing) {
    field.setCustomValidity(
      field.type === "checkbox"
        ? "تکایە دڵنیابوونەوەکە هەڵبژێرە."
        : "تکایە ئەم خانەیە پڕ بکەرەوە."
    );
  } else if (field.validity.typeMismatch) {
    field.setCustomValidity("تکایە زانیارییەکە بە شێوەی دروست بنووسە.");
  } else if (field.validity.tooShort) {
    field.setCustomValidity("تکایە زانیارییەکی تەواوتر بنووسە.");
  } else if (field.validity.rangeUnderflow) {
    field.setCustomValidity("تەمەن دەبێت ١٠ ساڵ یان زیاتر بێت.");
  } else if (field.validity.rangeOverflow) {
    field.setCustomValidity("تەمەن دەبێت ٨٠ ساڵ یان کەمتر بێت.");
  } else if (field.validity.patternMismatch) {
    if (field.name === "phone") {
      field.setCustomValidity("تکایە ژمارەی مۆبایلێکی دروست بنووسە. نموونە: 07501234567");
    } else if (field.name === "fullName") {
      field.setCustomValidity("تکایە ناوەکەت بە ئینگلیزی بنووسە. نموونە: Ahmad Ali");
    } else {
      field.setCustomValidity("تکایە زانیارییەکە بە شێوەی دروست بنووسە.");
    }
  }
}
 
function validatePanel(panel) {
  const fields = Array.from(panel.querySelectorAll("input"));
  fields.forEach((f) => f.setCustomValidity(""));
 
  for (const field of fields) {
    if (field.disabled || field.type === "button" || field.type === "submit") continue;
 
    const value = field.value.trim();
 
    /* Extra email regex check */
    if (field.type === "email" && value && !EMAIL_RE.test(value)) {
      field.setCustomValidity("تکایە ئیمەیڵێکی دروست بنووسە. نموونە: name@gmail.com");
      field.reportValidity();
      field.addEventListener("input", () => field.setCustomValidity(""), { once: true });
      return false;
    }
 
    /* "Other" text — required when enabled */
    if (field.id === "professionOther" && !field.disabled && value === "") {
      field.setCustomValidity("تکایە پیشەکەت بنووسە.");
      field.reportValidity();
      field.addEventListener("input", () => field.setCustomValidity(""), { once: true });
      return false;
    }
 
    if (!field.checkValidity()) {
      setFieldMessage(field);
      field.reportValidity();
      field.addEventListener("input",  () => field.setCustomValidity(""), { once: true });
      field.addEventListener("change", () => field.setCustomValidity(""), { once: true });
      return false;
    }
  }
  return true;
}
 
/* ════════════════════════════════════════════════
   Form data
════════════════════════════════════════════════ */
function getFormData() {
  const fd = new FormData(form);
 
  const professionRadio = String(fd.get("profession")      || "").trim();
  const professionText  = String(fd.get("professionOther") || "").trim();
  const profession      = professionRadio === "other" ? professionText : professionRadio;
 
  return {
    name:       String(fd.get("fullName")   || "").trim(),
    phone:      String(fd.get("phone")      || "").trim(),
    email:      String(fd.get("email")      || "").trim(),
    city:       String(fd.get("city")       || "").trim(),
    gender:     String(fd.get("gender")     || "").trim(),
    age:        String(fd.get("age")        || "").trim(),
    department: String(fd.get("department") || "").trim(),
    profession,
  };
}
 
function getSubmissionData() {
  return Object.fromEntries(
    Object.entries(getFormData()).map(([key, value]) => [
      key,
      SHEET_FORMULA_RE.test(value) ? `'${value}` : value,
    ])
  );
}
 
/* ════════════════════════════════════════════════
   Review builder
════════════════════════════════════════════════ */
function buildReview() {
  const data = getFormData();
  reviewList.innerHTML = reviewFields
    .map(([label, key]) => {
      const value = data[key] || "هیچ وەڵامێک نەدراوە";
      return `
        <div class="review-item">
          <span class="review-item__label">${escapeHtml(label)}</span>
          <span class="review-item__value">${escapeHtml(value)}</span>
        </div>`;
    })
    .join("");
}
 
/* ════════════════════════════════════════════════
   Submit helpers
════════════════════════════════════════════════ */
function setSubmitMessage(type, text) {
  submitMessage.className  = `submit-message ${type || ""}`;
  submitMessage.textContent = text || "";
}
 
function setSubmittingState() {
  submitButton.disabled = true;
  submitButton.textContent = loadingSubmitText;
  submitButton.setAttribute("aria-busy", "true");
}
 
function resetSubmitState() {
  submitButton.disabled = false;
  submitButton.textContent = defaultSubmitText;
  submitButton.removeAttribute("aria-busy");
}

function isSuccessfulSubmissionResponse(response, responseText) {
  if (!response.ok) return false;

  const trimmedText = String(responseText || "").trim();
  if (!trimmedText) {
    return response.status === 204;
  }

  if (/^(success|ok)$/i.test(trimmedText)) {
    return true;
  }

  try {
    const parsed = JSON.parse(trimmedText);
    return Boolean(
      parsed &&
      (
        parsed.success === true ||
        /^(success|ok)$/i.test(String(parsed.status || "")) ||
        /^(success|ok)$/i.test(String(parsed.result || "")) ||
        /^(success|ok)$/i.test(String(parsed.message || ""))
      )
    );
  } catch {
    return false;
  }
}
 
function submitRegistration(payload) {
  const controller = new AbortController();
  const tid = window.setTimeout(() => controller.abort(), SUBMIT_TIMEOUT_MS);
 
  return fetch(scriptURL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(payload),
    signal: controller.signal,
  })
    .then(async (res) => {
      const text = await res.text();
      if (!isSuccessfulSubmissionResponse(res, text)) {
        throw new Error(text || `Status ${res.status}`);
      }
      return text;
    })
    .finally(() => window.clearTimeout(tid));
}
 
function moveToNextStep() {
  const panel = getCurrentPanel();
  if (!panel || !validatePanel(panel)) return false;
  if (currentStep === INFO_STEP) {
    buildReview();
    setSubmitMessage("", "");
    showStep(REVIEW_STEP);
    return true;
  }
  return false;
}
 
/* ════════════════════════════════════════════════
   Event listeners
════════════════════════════════════════════════ */
confirmRead.addEventListener("change", () => {
  startButton.disabled = !confirmRead.checked;
});
 
startButton.addEventListener("click", () => {
  if (confirmRead.checked) showStep(INFO_STEP);
});
 
document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => moveToNextStep());
});
 
document.querySelectorAll("[data-prev]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (currentStep === INFO_STEP) { showStep(INTRO_STEP); return; }
    showStep(Math.max(currentStep - 1, INTRO_STEP));
  });
});
 
form.addEventListener("submit", (event) => {
  event.preventDefault();
 
  if (currentStep < REVIEW_STEP)  { moveToNextStep(); return; }
  if (currentStep !== REVIEW_STEP || submitButton.disabled) return;
 
  const panel = getCurrentPanel();
  if (!panel || !validatePanel(panel)) return;
 
  if (formTrap && formTrap.value.trim()) {
    setSubmitMessage("error", "ناردن ڕاگیرا. تکایە پەڕەکە نوێ بکەرەوە و دووبارە هەوڵ بدەرەوە.");
    return;
  }
 
  if (Date.now() - formStartedAt < MIN_SUBMIT_DELAY) {
    setSubmitMessage("error", "ناردن زۆر خێرا بوو. تکایە دووبارە هەوڵ بدەرەوە.");
    return;
  }
 
  setSubmitMessage("", "");
  setSubmittingState();
 
  submitRegistration(getSubmissionData())
    .then(() => {
      setSubmitMessage("success", "تۆمارکردن بە سەرکەوتوویی ئەنجامدرا.");
      showStep(SUCCESS_STEP);
    })
    .catch((err) => {
      const msg = err && err.name === "AbortError"
        ? "هەڵەی تۆڕ یان دواکەوتنی وەڵام ڕوویدا. تکایە دووبارە هەوڵ بدەرەوە."
        : "هەڵەیەک ڕوویدا، تکایە دووبارە هەوڵ بدەرەوە.";
      setSubmitMessage("error", msg);
      resetSubmitState();
    });
});
 
restartButton.addEventListener("click", () => {
  form.reset();
  formStartedAt = Date.now();
  reviewList.innerHTML = "";
  setSubmitMessage("", "");
  resetSubmitState();
  syncInitialUiState();
  showStep(INTRO_STEP);
});
 
 
/* ════════════════════════════════════════════════
   English-only input filters
   ناو، ژمارە، ئیمێڵ — تەنها ئینگلیزی قبوڵ دەکرێت
════════════════════════════════════════════════ */
 
// Name — letters and spaces only
const fullNameInput = document.getElementById("fullName");
if (fullNameInput) {
  fullNameInput.addEventListener("input", () => {
    const original = fullNameInput.value;
    const clean = original.replace(/[^A-Za-z\s]/g, "");
    if (clean !== original) {
      const nextPos = getNextCursorPosition(fullNameInput.selectionStart, original, clean);
      fullNameInput.value = clean;
      fullNameInput.setSelectionRange(nextPos, nextPos);
    }
  });
  fullNameInput.addEventListener("keypress", (e) => {
    if (!/[A-Za-z\s]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  });
}
 
// Phone — digits only (pattern already enforces format)
const phoneInput = document.getElementById("phone");
if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    const original = phoneInput.value;
    const clean = original.replace(/[^0-9]/g, "");
    if (clean !== original) {
      const nextPos = getNextCursorPosition(phoneInput.selectionStart, original, clean);
      phoneInput.value = clean;
      phoneInput.setSelectionRange(nextPos, nextPos);
    }
  });
  phoneInput.addEventListener("keypress", (e) => {
    if (!/[0-9]/.test(e.key) && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
    }
  });
}
 
// Email — ASCII/Latin only (no Arabic/Kurdish chars)
const emailInput = document.getElementById("email");
if (emailInput) {
  emailInput.addEventListener("input", () => {
    const original = emailInput.value;
    const clean = original.replace(/[^\x00-\x7F]/g, "");
    if (clean !== original) {
      const nextPos = getNextCursorPosition(emailInput.selectionStart, original, clean);
      emailInput.value = clean;
      emailInput.setSelectionRange(nextPos, nextPos);
    }
  });
  emailInput.addEventListener("keypress", (e) => {
    if (e.key.length === 1 && e.key.charCodeAt(0) > 127) {
      e.preventDefault();
    }
  });
}
 
/* ── Init ───────────────────────────────────────── */
syncInitialUiState();
showStep(INTRO_STEP);
 
