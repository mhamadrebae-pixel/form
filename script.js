/* ═══════════════════════════════════════════════════════════════
   Rwanga Medical Course Registration — Production JS
   Optimised for: Security · Performance · UX · Accessibility
   ═══════════════════════════════════════════════════════════════ */
 
"use strict";
 
// ─── Scroll restoration ─────────────────────────────────────────
if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);
 
// ─── Config ─────────────────────────────────────────────────────
const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbx6y3UAh9o0T44mUec9SiRbicNj7EDg_xWSOANoJ4hKGlSpACZw1vbFFHKhy1y2KWf_/exec";
 
const FETCH_TIMEOUT_MS = 10_000;
 
const INTRO_STEP   = 0;
const INFO_STEP    = 1;
const REVIEW_STEP  = 2;
const SUCCESS_STEP = 3;
 
// ─── Validation Patterns ────────────────────────────────────────
// Iraq numbers only: 07(50|70|80|90) + 7 digits = 11 digits total
const PHONE_RE       = /^07(50|70|80|90)\d{7}$/;
// ASCII-only email (no Unicode characters)
const EMAIL_RE       = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$/;
const KURDISH_NAME_RE = /^[\u0600-\u06FF\s]+$/;
const KURDISH_DIGIT_RE = /[0-9\u0660-\u0669\u06F0-\u06F9]/;
const FULL_NAME_RE   = /^[A-Za-z][A-Za-z\s'.-]*$/;
const SHEET_FORMULA_RE = /^[=+\-@|%]/;  // Extended formula injection protection
 
// ─── DOM Cache (single query per element) ───────────────────────
const form          = document.getElementById("multiStepForm");
const panels        = Array.from(document.querySelectorAll(".step-panel"));
const chips         = Array.from(document.querySelectorAll("[data-step-chip]"));
const titleCards    = Array.from(document.querySelectorAll(".title-card"));
const reviewList    = document.getElementById("reviewList");
const confirmRead   = document.getElementById("confirmRead");
const startButton   = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const submitButton  = document.getElementById("submitButton");
const submitMessage = document.getElementById("submitMessage");
const formTrap      = document.getElementById("companyWebsite");
const profRadioOther = document.getElementById("profRadioOther");
const professionOther = document.getElementById("professionOther");
 
// ─── State ──────────────────────────────────────────────────────
let currentStep  = INTRO_STEP;
let isSubmitting = false;  // Double-submit guard
 
// ─── Review fields definition ───────────────────────────────────
const reviewFields = [
  ["ناوی سیانی بە کوردی", "nameKurdish"],
  ["ناوی تەواو",    "name"],
  ["ژمارەی مۆبایل", "phone"],
  ["ئیمەیڵ",        "email"],
  ["شار",           "city"],
  ["ڕەگەز",         "gender"],
  ["تەمەن",         "age"],
  ["بەش",           "department"],
  ["پیشە",          "profession"],
];
 
// ─── User-facing messages ────────────────────────────────────────
const messages = {
  fullNameKurdish: "تکایە ناوی سیانی بە کوردی بنووسە. نابێت پیتی ئینگلیزی یان ژمارە تێدا بێت. نموونە: محەمەد ئەحمەد عەلی",
  botBlocked:      "ناردن ڕاگیرا، تکایە پەڕەکە نوێ بکەرەوە و دووبارە هەوڵ بدەرەوە.",
  checkboxIntro:   "تکایە دڵنیابوونەوەکە هەڵبژێرە.",
  checkboxReview:  "تکایە دڵنیابوونەوەی کۆتایی هەڵبژێرە.",
  email:           "تکایە ئیمەیڵێکی دروست بنووسە. نموونە: name@gmail.com",
  fullName:        "تکایە ناوەکەت تەنها بە ئینگلیزی بنووسە. نموونە: Ahmad Ali",
  gender:          "تکایە ڕەگەز هەڵبژێرە.",
  invalid:         "تکایە زانیارییەکە بە دروستی بنووسە.",
  phone:           "تکایە ژمارەی مۆبایلی عێراقی دروست بنووسە. دەبێت بە 0750, 0770, 0780, یان 0790 دەست پێ بکات و 11 ژمارە بێت.",
  profession:      "تکایە پیشە هەڵبژێرە.",
  professionOther: "تکایە پیشەکەت بنووسە.",
  rangeOverflow:   "تەمەن دەبێت 80 ساڵ یان کەمتر بێت.",
  rangeUnderflow:  "تەمەن دەبێت 10 ساڵ یان زیاتر بێت.",
  required:        "تکایە ئەم خانەیە پڕ بکەرەوە.",
  submitFailed:    "ناردن سەرکەوتوو نەبوو. تکایە دڵنیابە لە ئینتەرنێت و دووبارە هەوڵ بدەرەوە.",
  submitTimeout:   "ئینتەرنێت هێواش کارئەکات. تکایە دووبارە هەوڵ بدەرەوە.",
  submitSuccess:   "تۆمارکردن بە سەرکەوتوویی ئەنجامدرا.",
  tooShort:        "تکایە زانیارییەکە تەواوتر بنووسە.",
};
 
// ═══════════════════════════════════════════════════════════════
// SECURITY UTILITIES
// ═══════════════════════════════════════════════════════════════
 
/**
 * HTML-escape a value before injecting into innerHTML.
 */
function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;")
    .replace(/'/g,  "&#39;");
}
 
/**
 * Prevent Google Sheets formula injection.
 * Prefixes dangerous characters with a single quote.
 */
function sanitizeSheetValue(value) {
  const safe = String(value ?? "").trim();
  return SHEET_FORMULA_RE.test(safe) ? `'${safe}` : safe;
}
 
// ═══════════════════════════════════════════════════════════════
// NETWORK — fetchWithTimeout
// ═══════════════════════════════════════════════════════════════
 
/**
 * Wraps fetch with an AbortController timeout.
 * @param {string} url
 * @param {RequestInit} options
 * @param {number} timeout - milliseconds (default 10 s)
 * @returns {Promise<Response>}
 */
function fetchWithTimeout(url, options, timeout = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), timeout);
 
  return fetch(url, { ...options, signal: controller.signal })
    .then((response) => {
      clearTimeout(timerId);
      return response;
    })
    .catch((err) => {
      clearTimeout(timerId);
      if (err.name === "AbortError") {
        const timeoutError = new Error("TIMEOUT");
        timeoutError.isTimeout = true;
        throw timeoutError;
      }
      throw err;
    });
}
 
// ═══════════════════════════════════════════════════════════════
// DOM HELPERS
// ═══════════════════════════════════════════════════════════════
 
function getFieldCard(field) {
  if (!field) return null;
  if (field.type === "checkbox") {
    return (
      field.closest(".checkbox-card") ||
      field.closest(".question-card") ||
      field.closest(".section-card") ||
      field.parentElement
    );
  }
  return (
    field.closest(".question-card") ||
    field.closest(".section-card") ||
    field.closest(".checkbox-card") ||
    field.parentElement
  );
}
 
function getRelatedFields(field) {
  if (!field) return [];
  if (field.type === "radio") {
    const scope = field.closest(".question-card") || field.closest(".section-card") || form;
    return Array.from(scope.querySelectorAll(`input[type="radio"][name="${field.name}"]`));
  }
  return [field];
}
 
// ═══════════════════════════════════════════════════════════════
// ERROR UI
// ═══════════════════════════════════════════════════════════════
 
function clearError(field) {
  const card = getFieldCard(field);
  if (!card) return;
 
  getRelatedFields(field).forEach((target) => {
    target.setCustomValidity("");
    target.removeAttribute("aria-invalid");
    target.removeAttribute("aria-describedby");
  });
 
  card.classList.remove("has-error");
  const oldError = card.querySelector(".field-error");
  if (oldError) oldError.remove();
}
 
function showError(field, message) {
  const card = getFieldCard(field);
  if (!card) return;
 
  const relatedFields = getRelatedFields(field);
  const errorId = `${field.id || field.name || "field"}-error`;
 
  card.classList.add("has-error");
 
  relatedFields.forEach((target) => {
    target.setAttribute("aria-invalid", "true");
    target.setAttribute("aria-describedby", errorId);
  });
 
  let error = card.querySelector(".field-error");
  if (!error) {
    error = document.createElement("div");
    error.className = "field-error";
    error.setAttribute("role", "alert");
    card.appendChild(error);
  }
 
  error.id = errorId;
  error.textContent = message;
}
 
function clearPanelErrors(panel) {
  panel.querySelectorAll(".field-error").forEach((el) => el.remove());
  panel.querySelectorAll(".has-error").forEach((el) => el.classList.remove("has-error"));
  panel.querySelectorAll("input").forEach((field) => {
    field.setCustomValidity("");
    field.removeAttribute("aria-invalid");
    field.removeAttribute("aria-describedby");
  });
}
 
// ═══════════════════════════════════════════════════════════════
// RADIO / CHECKBOX SYNC
// ═══════════════════════════════════════════════════════════════
 
function syncRadioCards(groupEl) {
  if (!groupEl) return;
  groupEl.querySelectorAll(".radio-card").forEach((card) => {
    const radio = card.querySelector("input[type='radio']");
    card.classList.toggle("is-selected", Boolean(radio && radio.checked));
  });
}
 
function syncProfessionOtherState(shouldFocus = false) {
  if (!professionOther) return;
 
  const isOther = Boolean(profRadioOther && profRadioOther.checked);
  professionOther.disabled = !isOther;
  professionOther.required = isOther;
  professionOther.tabIndex = isOther ? 0 : -1;
 
  if (!isOther) {
    professionOther.value = "";
    professionOther.setCustomValidity("");
    clearError(professionOther);
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
 
// ═══════════════════════════════════════════════════════════════
// FOCUS / SCROLL
// ═══════════════════════════════════════════════════════════════
 
function focusInvalidField(field) {
  const card = getFieldCard(field) || field;
  if (!card || !field) return;
 
  window.requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: "smooth", block: "center" });
    try {
      field.focus({ preventScroll: true });
    } catch (_) {
      field.focus();
    }
  });
}
 
function smoothScrollToTop(duration) {
  const start = window.scrollY;
  if (start === 0) return;
  const startTime = performance.now();
 
  function step(now) {
    const elapsed  = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease     = 1 - Math.pow(1 - progress, 3); // Cubic ease-out
    window.scrollTo(0, start * (1 - ease));
    if (progress < 1) requestAnimationFrame(step);
  }
 
  requestAnimationFrame(step);
}
 
// ═══════════════════════════════════════════════════════════════
// STEP NAVIGATION
// ═══════════════════════════════════════════════════════════════
 
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
 
  // Hide the title card on non-intro steps
  titleCards.forEach((card) => {
    card.classList.toggle("title-card--hidden", currentStep !== INTRO_STEP);
  });
 
  // Update stepper chips
  chips.forEach((chip) => {
    const chipStep   = Number(chip.dataset.stepChip);
    const isActive   = chipStep === currentStep && currentStep < SUCCESS_STEP;
    const isComplete = chipStep < currentStep || currentStep === SUCCESS_STEP;
 
    chip.classList.toggle("is-active",   isActive);
    chip.classList.toggle("is-complete", isComplete);
 
    if (isActive) chip.setAttribute("aria-current", "step");
    else          chip.removeAttribute("aria-current");
  });
 
  window.requestAnimationFrame(() => smoothScrollToTop(400));
 
  // Move focus to the first interactive element or the heading
  const focusTarget =
    activePanel?.querySelector("input:not([disabled]), button, h2") || null;
 
  if (focusTarget) {
    window.requestAnimationFrame(() => {
      if (focusTarget.matches("h2")) {
        focusTarget.setAttribute("tabindex", "-1");
      }
      try {
        focusTarget.focus({ preventScroll: true });
      } catch (_) {
        focusTarget.focus();
      }
    });
  }
}
 
function getCurrentPanel() {
  return panels.find((panel) => Number(panel.dataset.step) === currentStep) || null;
}
 
// ═══════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════
 
function getFieldErrorMessage(field) {
  const name  = field.name || field.id;
  const value = field.type === "checkbox" ? "" : field.value.trim();
  const isKurdishNameField = name === "fullNameKurdish" || field.id === "fullNameKurdish";
 
  // Checkbox required
  if (field.type === "checkbox" && field.required && !field.checked) {
    return field.id === "confirmAccuracy"
      ? messages.checkboxReview
      : messages.checkboxIntro;
  }
 
  // Required empty
  if (field.required && field.type !== "checkbox" && value === "") {
    if (name === "professionOther") return messages.professionOther;
    return messages.required;
  }

  if (
    isKurdishNameField &&
    value !== "" &&
    (!KURDISH_NAME_RE.test(value) || KURDISH_DIGIT_RE.test(value))
  ) {
    return messages.fullNameKurdish;
  }
 
  // Full name: English only, no Unicode
  if (name === "fullName" && value !== "" && !FULL_NAME_RE.test(value)) {
    return messages.fullName;
  }
 
  // Phone: Iraqi mobile prefixes only (11 digits)
  if (name === "phone" && value !== "" && !PHONE_RE.test(value)) {
    return messages.phone;
  }
 
  // Email: ASCII only, no Unicode domains or usernames
  if (name === "email" && value !== "") {
    const hasUnicode = /[^\x00-\x7F]/.test(value);
    if (hasUnicode || !EMAIL_RE.test(value)) {
      return messages.email;
    }
  }
 
  // Native browser validity (too short, range, type mismatch, pattern)
  if (field.validity.tooShort)       return messages.tooShort;
  if (field.validity.rangeUnderflow) return messages.rangeUnderflow;
  if (field.validity.rangeOverflow)  return messages.rangeOverflow;
 
  if (field.validity.typeMismatch) {
    return name === "email" ? messages.email : messages.invalid;
  }
 
  if (field.validity.patternMismatch) {
    if (isKurdishNameField) return messages.fullNameKurdish;
    if (name === "fullName") return messages.fullName;
    if (name === "phone")    return messages.phone;
    return messages.invalid;
  }
 
  return "";
}
 
function validateField(field) {
  if (
    !field ||
    field.disabled ||
    field.type === "button" ||
    field.type === "submit" ||
    field.type === "radio"
  ) {
    return true;
  }
 
  field.setCustomValidity("");
  const message = getFieldErrorMessage(field);
 
  if (!message) {
    clearError(field);
    return true;
  }
 
  field.setCustomValidity(message);
  showError(field, message);
  return false;
}
 
function validateRadioGroup(panel, name, message) {
  const radios = Array.from(panel.querySelectorAll(`input[type="radio"][name="${name}"]`));
  if (!radios.length) return { valid: true, field: null };
 
  const checked = radios.find((r) => r.checked);
  if (checked) {
    radios.forEach((r) => r.setCustomValidity(""));
    clearError(radios[0]);
    return { valid: true, field: checked };
  }
 
  radios.forEach((r) => r.setCustomValidity(message));
  showError(radios[0], message);
  return { valid: false, field: radios[0] };
}
 
function validatePanel(panel) {
  if (!panel) return false;
 
  clearPanelErrors(panel);
 
  const invalidFields = [];
 
  // Radio groups first
  [
    validateRadioGroup(panel, "gender",     messages.gender),
    validateRadioGroup(panel, "profession", messages.profession),
  ].forEach((result) => {
    if (!result.valid && result.field) invalidFields.push(result.field);
  });
 
  // All other inputs
  Array.from(panel.querySelectorAll("input")).forEach((field) => {
    if (
      field.disabled ||
      field.type === "button" ||
      field.type === "submit" ||
      field.type === "radio"
    ) return;
 
    if (!validateField(field)) invalidFields.push(field);
  });
 
  if (invalidFields.length) {
    focusInvalidField(invalidFields[0]);
    return false;
  }
 
  return true;
}
 
// ═══════════════════════════════════════════════════════════════
// DATA COLLECTION
// ═══════════════════════════════════════════════════════════════
 
function getFormData() {
  const fd = new FormData(form);
  const professionRadio = String(fd.get("profession") || "").trim();
  const professionOtherText = String(fd.get("professionOther") || "").trim();
  const profession = professionRadio === "other" ? professionOtherText : professionRadio;
 
  return {
    nameKurdish: String(fd.get("fullNameKurdish") || "").trim(),
    name: String(fd.get("fullName") || "").trim(),
    phone: String(fd.get("phone") || "").trim(),
    email: String(fd.get("email") || "").trim().toLowerCase(),
    city: String(fd.get("city") || "").trim(),
    gender: String(fd.get("gender") || "").trim(),
    age: String(fd.get("age") || "").trim(),
    department: String(fd.get("department") || "").trim(),
    profession,
  };
}
 
function getSubmissionData() {
  const data = getFormData();

  // Keep the payload limited to the sheet fields and in sheet column order.
  return {
    nameKurdish: sanitizeSheetValue(data.nameKurdish),
    name: sanitizeSheetValue(data.name),
    phone: sanitizeSheetValue(data.phone),
    email: sanitizeSheetValue(data.email),
    city: sanitizeSheetValue(data.city),
    gender: sanitizeSheetValue(data.gender),
    age: sanitizeSheetValue(data.age),
    department: sanitizeSheetValue(data.department),
    profession: sanitizeSheetValue(data.profession),
  };
}
 
// ═══════════════════════════════════════════════════════════════
// REVIEW SCREEN
// ═══════════════════════════════════════════════════════════════
 
function buildReview() {
  const data = getFormData();
 
  reviewList.innerHTML = reviewFields
    .map(([label, key]) => {
      const value = data[key] || "بەتاڵە";
      return `
        <div class="review-item">
          <span class="review-item__label">${escapeHtml(label)}</span>
          <span class="review-item__value">${escapeHtml(value)}</span>
        </div>
      `;
    })
    .join("");
}
 
// ═══════════════════════════════════════════════════════════════
// SUBMIT UI STATE
// ═══════════════════════════════════════════════════════════════
 
function setSubmitMessage(type, text) {
  submitMessage.className = `submit-message ${type || ""}`.trim();
  submitMessage.textContent = text || "";
}
 
function setSubmittingState() {
  if (!submitButton) return;
  isSubmitting = true;
  submitButton.disabled = true;
  submitButton.classList.add("is-loading");
  submitButton.setAttribute("aria-busy", "true");
  submitButton.setAttribute("aria-label", "چاوەڕێ بە، فۆڕمەکە دەنێردرێت...");
}
 
function resetSubmitState() {
  if (!submitButton) return;
  isSubmitting = false;
  submitButton.disabled = false;
  submitButton.classList.remove("is-loading");
  submitButton.removeAttribute("aria-busy");
  submitButton.removeAttribute("aria-label");
}
 
// ═══════════════════════════════════════════════════════════════
// NETWORK SUBMISSION
// ═══════════════════════════════════════════════════════════════
 
function submitRegistration(payload) {
  return fetchWithTimeout(
    SCRIPT_URL,
    {
      method:  "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      cache:   "no-store",
      body:    JSON.stringify(payload),
    },
    FETCH_TIMEOUT_MS
  ).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return response.text();
  });
}
 
// ═══════════════════════════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════════════════════════
 
function moveToNextStep() {
  const panel = getCurrentPanel();
  if (!panel || !validatePanel(panel)) return false;
 
  if (currentStep === INTRO_STEP) {
    showStep(INFO_STEP);
    return true;
  }
 
  if (currentStep === INFO_STEP) {
    buildReview();
    setSubmitMessage("", "");
    showStep(REVIEW_STEP);
    return true;
  }
 
  return false;
}
 
// ═══════════════════════════════════════════════════════════════
// INPUT NORMALISERS
// ═══════════════════════════════════════════════════════════════
 
function sanitizePhoneValue(value) {
  let digits = String(value || "").replace(/[^0-9]/g, "");
 
  // Handle international prefix variants
  if (digits.startsWith("00964")) {
    digits = `0${digits.slice(5)}`;
  } else if (digits.startsWith("964")) {
    digits = `0${digits.slice(3)}`;
  }
 
  return digits;
}
 
function normalizeAutofilledFields() {
  document.querySelectorAll("input").forEach((field) => {
    if (field.type === "radio" || field.type === "checkbox") return;
    handleFieldInput(field);
  });
}
 
function handleFieldInput(field) {
  const card = getFieldCard(field);
 
  // Phone normalisation
  if (field.id === "phone") {
    field.value = sanitizePhoneValue(field.value);
  }
 
  // Email: strip non-ASCII / Unicode characters
  if (field.id === "email") {
    field.value = field.value.replace(/[^\x00-\x7F]/g, "");
  }
 
  // Checkbox — binary clear/validate
  if (field.type === "checkbox") {
    if (field.checked) {
      clearError(field);
    } else if (card && card.classList.contains("has-error")) {
      validateField(field);
    }
    return;
  }
 
  // Full name — live validate
  if (field.id === "fullNameKurdish") {
    if (field.value === "") {
      field.setCustomValidity("");
      clearError(field);
      return;
    }
    const hasInvalidChars =
      !KURDISH_NAME_RE.test(field.value) ||
      KURDISH_DIGIT_RE.test(field.value);
    if (hasInvalidChars || (card && card.classList.contains("has-error"))) {
      validateField(field);
    } else if (field.value.trim().length >= Number(field.minLength || 0)) {
      clearError(field);
    }
    return;
  }

  if (field.id === "fullName") {
    if (field.value === "") {
      field.setCustomValidity("");
      clearError(field);
      return;
    }
    const hasInvalidChars = !FULL_NAME_RE.test(field.value);
    if (hasInvalidChars || (card && card.classList.contains("has-error"))) {
      validateField(field);
    } else if (field.value.trim().length >= Number(field.minLength || 0)) {
      clearError(field);
    }
    return;
  }
 
  // Phone — live validate
  if (field.id === "phone") {
    if (field.value === "") {
      field.setCustomValidity("");
      clearError(field);
      return;
    }
    const shouldLiveValidate =
      Boolean(card && card.classList.contains("has-error")) ||
      (field.value.length >= 2 && !field.value.startsWith("07")) ||
      field.value.length >= 10;
 
    if (shouldLiveValidate) {
      validateField(field);
    } else if (PHONE_RE.test(field.value)) {
      clearError(field);
    }
    return;
  }
 
  // Profession other — live validate
  if (field.id === "professionOther") {
    if (field.disabled) {
      clearError(field);
      return;
    }
    if (card && card.classList.contains("has-error")) {
      validateField(field);
    }
    return;
  }
 
  // Generic: clear error once field is valid
  if (card && card.classList.contains("has-error")) {
    validateField(field);
  }
}
 
// ═══════════════════════════════════════════════════════════════
// EVENT LISTENERS
// ═══════════════════════════════════════════════════════════════
 
// ── Intro checkbox ──────────────────────────────────────────────
if (confirmRead) {
  confirmRead.addEventListener("change", () => {
    if (startButton) startButton.disabled = !confirmRead.checked;
    if (confirmRead.checked) clearError(confirmRead);
  });
}
 
// ── Start button ────────────────────────────────────────────────
if (startButton) {
  startButton.addEventListener("click", () => {
    if (!confirmRead || !confirmRead.checked) {
      showError(confirmRead, messages.checkboxIntro);
      focusInvalidField(confirmRead);
      return;
    }
    clearError(confirmRead);
    showStep(INFO_STEP);
  });
}
 
// ── Next buttons ────────────────────────────────────────────────
document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => {
    moveToNextStep();
  });
});
 
// ── Prev buttons ────────────────────────────────────────────────
document.querySelectorAll("[data-prev]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (currentStep === INFO_STEP) {
      showStep(INTRO_STEP);
      return;
    }
    showStep(Math.max(currentStep - 1, INTRO_STEP));
  });
});
 
// ── Radio groups: sync selected state + clear error ─────────────
document.querySelectorAll(".radio-group").forEach((group) => {
  group.addEventListener("change", () => {
    syncRadioCards(group);
    const checked = group.querySelector("input[type='radio']:checked");
    if (checked) clearError(checked);
  });
});
 
// ── Profession radio: manage "other" input ───────────────────────
document.querySelectorAll("input[name='profession']").forEach((radio) => {
  radio.addEventListener("change", () => {
    syncProfessionOtherState(true);
    syncRadioCards(document.getElementById("professionGroup"));
  });
});
 
// ── Other combo: click anywhere on pill activates radio ──────────
const otherCombo = document.querySelector(".other-combo");
if (otherCombo) {
  otherCombo.addEventListener("click", (event) => {
    if (
      event.target === professionOther ||
      event.target.closest(".other-combo__radio")
    ) return;
    if (profRadioOther && !profRadioOther.checked) profRadioOther.click();
  });
}
 
// ── Gender radio ─────────────────────────────────────────────────
document.querySelectorAll("input[name='gender']").forEach((radio) => {
  radio.addEventListener("change", () => {
    syncRadioCards(document.getElementById("genderGroup"));
  });
});
 
// ── All inputs: live validation ──────────────────────────────────
document.querySelectorAll("input").forEach((field) => {
  if (field.type === "radio") return;
  const eventName = field.type === "checkbox" ? "change" : "input";
  field.addEventListener(eventName, () => handleFieldInput(field));
});
 
// ── Form submit ──────────────────────────────────────────────────
form.addEventListener("submit", (event) => {
  event.preventDefault();
 
  // Forward submit on non-review steps
  if (currentStep < REVIEW_STEP) {
    moveToNextStep();
    return;
  }
 
  // Guard: must be on review step with a live submit button
  if (currentStep !== REVIEW_STEP || !submitButton || submitButton.disabled) return;
 
  // Double-submit protection
  if (isSubmitting) return;
 
  const panel = getCurrentPanel();
  if (!panel || !validatePanel(panel)) return;
 
  // Anti-bot honeypot check
  if (formTrap && formTrap.value.trim()) {
    setSubmitMessage("error", messages.botBlocked);
    return;
  }
 
  setSubmitMessage("", "");
  setSubmittingState();
 
  submitRegistration(getSubmissionData())
    .then((text) => {
      if (String(text || "").trim().toLowerCase() !== "success") {
        throw new Error(text || "Unexpected server response");
      }
      setSubmitMessage("success", messages.submitSuccess);
      showStep(SUCCESS_STEP);
    })
    .catch((err) => {
      const msg = err && err.isTimeout ? messages.submitTimeout : messages.submitFailed;
      setSubmitMessage("error", msg);
      resetSubmitState();
    });
});
 
// ── Restart ──────────────────────────────────────────────────────
if (restartButton) {
  restartButton.addEventListener("click", () => {
    form.reset();
    if (reviewList) reviewList.innerHTML = "";
    setSubmitMessage("", "");
    resetSubmitState();
    clearPanelErrors(form);
    syncInitialUiState();
    showStep(INTRO_STEP);
  });
}
 
// ═══════════════════════════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════════════════════════
 
syncInitialUiState();
normalizeAutofilledFields();
 
// Second pass catches browser autofill that fires after DOMContentLoaded
window.setTimeout(normalizeAutofilledFields, 300);
 
showStep(INTRO_STEP);
