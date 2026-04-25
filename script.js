if ("scrollRestoration" in history) history.scrollRestoration = "manual";
window.scrollTo(0, 0);

const scriptURL = "https://script.google.com/macros/s/AKfycbz7TBH6idJYxkWZXoahqruVXrkWpb17YpsTf92xNHUy8vmeoM9Tsepelu7Q2uiW8Vuk/exec";

const form = document.getElementById("multiStepForm");
const panels = Array.from(document.querySelectorAll(".step-panel"));
const chips = Array.from(document.querySelectorAll("[data-step-chip]"));
const titleCards = Array.from(document.querySelectorAll(".title-card"));
const reviewList = document.getElementById("reviewList");
const confirmRead = document.getElementById("confirmRead");
const startButton = document.getElementById("startButton");
const restartButton = document.getElementById("restartButton");
const submitButton = document.getElementById("submitButton");
const submitMessage = document.getElementById("submitMessage");
const formTrap = document.getElementById("companyWebsite");
const profRadioOther = document.getElementById("profRadioOther");
const professionOther = document.getElementById("professionOther");

const INTRO_STEP = 0;
const INFO_STEP = 1;
const REVIEW_STEP = 2;
const SUCCESS_STEP = 3;

const defaultSubmitText = submitButton ? submitButton.textContent.trim() : "";
const loadingSubmitText = "چاوەڕێ بە...";

const reviewFields = [
  ["ناوی تەواو", "name"],
  ["ژمارەی مۆبایل", "phone"],
  ["ئیمەیڵ", "email"],
  ["شار", "city"],
  ["ڕەگەز", "gender"],
  ["تەمەن", "age"],
  ["بەش", "department"],
  ["پیشە", "profession"],
];

const messages = {
  botBlocked: "ناردن ڕاگیرا، تکایە پەڕەکە نوێ بکەرەوە و دووبارە هەوڵ بدەرەوە.",
  checkboxIntro: "تکایە دڵنیابوونەوەکە هەڵبژێرە.",
  checkboxReview: "تکایە دڵنیابوونەوەی کۆتایی هەڵبژێرە.",
  email: "تکایە ئیمەیڵێکی دروست بنووسە. نموونە: name@gmail.com",
  fullName: "تکایە ناوەکەت تەنها بە ئینگلیزی بنووسە. نموونە: Ahmad Ali",
  gender: "تکایە ڕەگەز هەڵبژێرە.",
  invalid: "تکایە زانیارییەکە بە دروستی بنووسە.",
  phone: "تکایە ژمارەی مۆبایل بە دروستی بنووسە؛ دەبێت بە 07 دەست پێ بکات و 10 بۆ 11 ژمارە بێت.",
  profession: "تکایە پیشە هەڵبژێرە.",
  professionOther: "تکایە پیشەکەت بنووسە.",
  rangeOverflow: "تەمەن دەبێت 80 ساڵ یان کەمتر بێت.",
  rangeUnderflow: "تەمەن دەبێت 10 ساڵ یان زیاتر بێت.",
  required: "تکایە ئەم خانەیە پڕ بکەرەوە.",
  submitFailed: "ناردن سەرکەوتوو نەبوو، تکایە دڵنیابە لە ئینتەرنێت و دووبارە هەوڵ بدەرەوە.",
  submitSuccess: "تۆمارکردن بە سەرکەوتوویی ئەنجامدرا.",
  tooShort: "تکایە زانیارییەکە تەواوتر بنووسە.",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const FULL_NAME_RE = /^[A-Za-z][A-Za-z\s'.-]*$/;
const PHONE_RE = /^07\d{8,9}$/;
const SHEET_FORMULA_RE = /^[=+\-@]/;

let currentStep = INTRO_STEP;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getFieldCard(field) {
  if (!field) return null;

  if (field.type === "checkbox") {
    return field.closest(".checkbox-card") || field.closest(".question-card") || field.closest(".section-card") || field.parentElement;
  }

  return field.closest(".question-card") || field.closest(".section-card") || field.closest(".checkbox-card") || field.parentElement;
}

function getRelatedFields(field) {
  if (!field) return [];

  if (field.type === "radio") {
    const scope = field.closest(".question-card") || field.closest(".section-card") || form;
    return Array.from(scope.querySelectorAll(`input[type="radio"][name="${field.name}"]`));
  }

  return [field];
}

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

function focusInvalidField(field) {
  const card = getFieldCard(field) || field;
  if (!card || !field) return;

  window.requestAnimationFrame(() => {
    card.scrollIntoView({ behavior: "smooth", block: "center" });

    try {
      field.focus({ preventScroll: true });
    } catch (error) {
      field.focus();
    }
  });
}

function smoothScrollToTop(duration) {
  const start = window.scrollY;
  if (start === 0) return;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    window.scrollTo(0, start * (1 - ease));
    if (progress < 1) requestAnimationFrame(step);
  }

  requestAnimationFrame(step);
}

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

  titleCards.forEach((card) => {
    card.classList.toggle("title-card--hidden", currentStep !== INTRO_STEP);
  });

  chips.forEach((chip) => {
    const chipStep = Number(chip.dataset.stepChip);
    const isActiveChip = chipStep === currentStep && currentStep < SUCCESS_STEP;
    const isDoneChip = chipStep < currentStep || currentStep === SUCCESS_STEP;

    chip.classList.toggle("is-active", isActiveChip);
    chip.classList.toggle("is-complete", isDoneChip);

    if (isActiveChip) chip.setAttribute("aria-current", "step");
    else chip.removeAttribute("aria-current");
  });

  window.requestAnimationFrame(() => smoothScrollToTop(400));

  const focusTarget = activePanel?.querySelector("input:not([disabled]), button, h2") || null;
  if (focusTarget) {
    window.requestAnimationFrame(() => {
      if (focusTarget.matches("h2")) {
        focusTarget.setAttribute("tabindex", "-1");
      }

      try {
        focusTarget.focus({ preventScroll: true });
      } catch (error) {
        focusTarget.focus();
      }
    });
  }
}

function getCurrentPanel() {
  return panels.find((panel) => Number(panel.dataset.step) === currentStep);
}

function getFieldErrorMessage(field) {
  const name = field.name || field.id;
  const value = field.type === "checkbox" ? "" : field.value.trim();

  if (field.type === "checkbox" && field.required && !field.checked) {
    return field.id === "confirmAccuracy" ? messages.checkboxReview : messages.checkboxIntro;
  }

  if (field.required && field.type !== "checkbox" && value === "") {
    if (name === "professionOther") return messages.professionOther;
    return messages.required;
  }

  if (name === "fullName" && value !== "" && !FULL_NAME_RE.test(value)) {
    return messages.fullName;
  }

  if (name === "phone" && value !== "" && !PHONE_RE.test(value)) {
    return messages.phone;
  }

  if (name === "email" && value !== "" && !EMAIL_RE.test(value)) {
    return messages.email;
  }

  if (field.validity.tooShort) {
    return messages.tooShort;
  }

  if (field.validity.rangeUnderflow) {
    return messages.rangeUnderflow;
  }

  if (field.validity.rangeOverflow) {
    return messages.rangeOverflow;
  }

  if (field.validity.typeMismatch) {
    return name === "email" ? messages.email : messages.invalid;
  }

  if (field.validity.patternMismatch) {
    if (name === "fullName") return messages.fullName;
    if (name === "phone") return messages.phone;
    return messages.invalid;
  }

  return "";
}

function validateField(field) {
  if (!field || field.disabled || field.type === "button" || field.type === "submit" || field.type === "radio") {
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
  if (!radios.length) {
    return { valid: true, field: null };
  }

  const checkedRadio = radios.find((radio) => radio.checked);
  if (checkedRadio) {
    radios.forEach((radio) => radio.setCustomValidity(""));
    clearError(radios[0]);
    return { valid: true, field: checkedRadio };
  }

  radios.forEach((radio) => radio.setCustomValidity(message));
  showError(radios[0], message);
  return { valid: false, field: radios[0] };
}

function validatePanel(panel) {
  if (!panel) return false;

  clearPanelErrors(panel);

  const invalidFields = [];
  const radioResults = [
    validateRadioGroup(panel, "gender", messages.gender),
    validateRadioGroup(panel, "profession", messages.profession),
  ];

  radioResults.forEach((result) => {
    if (!result.valid && result.field) {
      invalidFields.push(result.field);
    }
  });

  Array.from(panel.querySelectorAll("input")).forEach((field) => {
    if (field.disabled || field.type === "button" || field.type === "submit" || field.type === "radio") {
      return;
    }

    if (!validateField(field)) {
      invalidFields.push(field);
    }
  });

  if (invalidFields.length) {
    focusInvalidField(invalidFields[0]);
    return false;
  }

  return true;
}

function getFormData() {
  const fd = new FormData(form);
  const professionRadio = String(fd.get("profession") || "").trim();
  const professionOtherText = String(fd.get("professionOther") || "").trim();
  const profession = professionRadio === "other" ? professionOtherText : professionRadio;

  return {
    name: String(fd.get("fullName") || "").trim(),
    phone: String(fd.get("phone") || "").trim(),
    email: String(fd.get("email") || "").trim(),
    city: String(fd.get("city") || "").trim(),
    gender: String(fd.get("gender") || "").trim(),
    age: String(fd.get("age") || "").trim(),
    department: String(fd.get("department") || "").trim(),
    profession,
  };
}

function sanitizeSheetValue(value) {
  const safeValue = String(value ?? "").trim();
  return SHEET_FORMULA_RE.test(safeValue) ? `'${safeValue}` : safeValue;
}

function getSubmissionData() {
  const payload = {
    ...getFormData(),
    submittedAt: new Date().toISOString(),
    pageLanguage: document.documentElement.lang || "",
    pageDirection: document.documentElement.dir || "",
    sourcePage: window.location.href || "",
  };

  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [key, sanitizeSheetValue(value)])
  );
}

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

function setSubmitMessage(type, text) {
  submitMessage.className = `submit-message ${type || ""}`.trim();
  submitMessage.textContent = text || "";
}

function setSubmittingState() {
  if (!submitButton) return;

  submitButton.disabled = true;
  submitButton.textContent = loadingSubmitText;
  submitButton.setAttribute("aria-busy", "true");
}

function resetSubmitState() {
  if (!submitButton) return;

  submitButton.disabled = false;
  submitButton.textContent = defaultSubmitText;
  submitButton.removeAttribute("aria-busy");
}

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

function submitRegistration(payload) {
  return fetch(scriptURL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8",
    },
    cache: "no-store",
    body: JSON.stringify(payload),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.text();
  });
}

function sanitizePhoneValue(value) {
  let digits = String(value || "").replace(/[^0-9]/g, "");

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

  if (field.id === "phone") {
    field.value = sanitizePhoneValue(field.value);
  }

  if (field.id === "email") {
    field.value = field.value.replace(/[^\x00-\x7F]/g, "");
  }

  if (field.type === "checkbox") {
    if (field.checked) {
      clearError(field);
    } else if (card && card.classList.contains("has-error")) {
      validateField(field);
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

  if (field.id === "phone") {
    if (field.value === "") {
      field.setCustomValidity("");
      clearError(field);
      return;
    }

    const shouldLiveValidate = Boolean(card && card.classList.contains("has-error"))
      || (field.value.length >= 2 && !field.value.startsWith("07"))
      || field.value.length >= 10;

    if (shouldLiveValidate) {
      validateField(field);
    } else if (PHONE_RE.test(field.value)) {
      clearError(field);
    }
    return;
  }

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

  if (card && card.classList.contains("has-error")) {
    validateField(field);
  }
}

if (confirmRead) {
  confirmRead.addEventListener("change", () => {
    if (startButton) {
      startButton.disabled = !confirmRead.checked;
    }

    if (confirmRead.checked) {
      clearError(confirmRead);
    }
  });
}

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

document.querySelectorAll("[data-next]").forEach((btn) => {
  btn.addEventListener("click", () => {
    moveToNextStep();
  });
});

document.querySelectorAll("[data-prev]").forEach((btn) => {
  btn.addEventListener("click", () => {
    if (currentStep === INFO_STEP) {
      showStep(INTRO_STEP);
      return;
    }

    showStep(Math.max(currentStep - 1, INTRO_STEP));
  });
});

document.querySelectorAll(".radio-group").forEach((group) => {
  group.addEventListener("change", () => {
    syncRadioCards(group);

    const checkedRadio = group.querySelector("input[type='radio']:checked");
    if (checkedRadio) {
      clearError(checkedRadio);
    }
  });
});

document.querySelectorAll("input[name='profession']").forEach((radio) => {
  radio.addEventListener("change", () => {
    syncProfessionOtherState(true);
    syncRadioCards(document.getElementById("professionGroup"));
  });
});

const otherCombo = document.querySelector(".other-combo");
if (otherCombo) {
  otherCombo.addEventListener("click", (event) => {
    if (event.target === professionOther || event.target.closest(".other-combo__radio")) return;
    if (profRadioOther && !profRadioOther.checked) profRadioOther.click();
  });
}

document.querySelectorAll("input[name='gender']").forEach((radio) => {
  radio.addEventListener("change", () => {
    syncRadioCards(document.getElementById("genderGroup"));
  });
});

document.querySelectorAll("input").forEach((field) => {
  if (field.type === "radio") return;

  const eventName = field.type === "checkbox" ? "change" : "input";
  field.addEventListener(eventName, () => {
    handleFieldInput(field);
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (currentStep < REVIEW_STEP) {
    moveToNextStep();
    return;
  }

  if (currentStep !== REVIEW_STEP || !submitButton || submitButton.disabled) return;

  const panel = getCurrentPanel();
  if (!panel || !validatePanel(panel)) return;

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
    .catch(() => {
      setSubmitMessage("error", messages.submitFailed);
      resetSubmitState();
    });
});

if (restartButton) {
  restartButton.addEventListener("click", () => {
    form.reset();
    reviewList.innerHTML = "";
    setSubmitMessage("", "");
    resetSubmitState();
    clearPanelErrors(form);
    syncInitialUiState();
    showStep(INTRO_STEP);
  });
}

syncInitialUiState();
normalizeAutofilledFields();
window.setTimeout(normalizeAutofilledFields, 250);
showStep(INTRO_STEP);
