const scriptURL = "https://script.google.com/macros/s/AKfycbz7TBH6idJYxkWZXoahqruVXrkWpb17YpsTf92xNHUy8vmeoM9Tsepelu7Q2uiW8Vuk/exec";

const form = document.getElementById("multiStepForm");
const panels = Array.from(document.querySelectorAll(".step-panel"));
const chips = Array.from(document.querySelectorAll("[data-step-chip]"));
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

const defaultSubmitText = submitButton ? submitButton.textContent.trim() : "ناردنی فۆڕم";
const loadingSubmitText = "چاوەڕوان بە...";

let currentStep = INTRO_STEP;

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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SHEET_FORMULA_RE = /^[=+\-@]/;

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  }

  if (isOther && shouldFocus) {
    professionOther.focus();
  }
}

function syncInitialUiState() {
  startButton.disabled = !confirmRead.checked;
  document.querySelectorAll(".radio-group").forEach(syncRadioCards);
  syncProfessionOtherState(false);
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

  chips.forEach((chip) => {
    const chipStep = Number(chip.dataset.stepChip);
    const isActiveChip = chipStep === currentStep && currentStep < SUCCESS_STEP;
    const isDoneChip = chipStep < currentStep || currentStep === SUCCESS_STEP;

    chip.classList.toggle("is-active", isActiveChip);
    chip.classList.toggle("is-complete", isDoneChip);

    if (isActiveChip) chip.setAttribute("aria-current", "step");
    else chip.removeAttribute("aria-current");
  });

  window.scrollTo({ top: 0, behavior: "smooth" });

  const focusTarget =
    activePanel?.querySelector("input, button, h2") || null;

  if (focusTarget) {
    window.requestAnimationFrame(() => {
      if (focusTarget.matches("h2")) focusTarget.setAttribute("tabindex", "-1");
      focusTarget.focus({ preventScroll: true });
    });
  }
}

function getCurrentPanel() {
  return panels.find((panel) => Number(panel.dataset.step) === currentStep);
}

function clearFieldMessage(field) {
  field.setCustomValidity("");
}

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

  fields.forEach(clearFieldMessage);

  for (const field of fields) {
    if (field.disabled || field.type === "button" || field.type === "submit") continue;

    const value = field.value.trim();

    if (field.type === "email" && value && !EMAIL_RE.test(value)) {
      field.setCustomValidity("تکایە ئیمەیڵێکی دروست بنووسە. نموونە: name@gmail.com");
      field.reportValidity();
      field.addEventListener("input", () => clearFieldMessage(field), { once: true });
      return false;
    }

    if (field.id === "professionOther" && !field.disabled && value === "") {
      field.setCustomValidity("تکایە پیشەکەت بنووسە.");
      field.reportValidity();
      field.addEventListener("input", () => clearFieldMessage(field), { once: true });
      return false;
    }

    if (!field.checkValidity()) {
      setFieldMessage(field);
      field.reportValidity();
      field.addEventListener("input", () => clearFieldMessage(field), { once: true });
      field.addEventListener("change", () => clearFieldMessage(field), { once: true });
      return false;
    }
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

function getSubmissionData() {
  const data = getFormData();

  return Object.fromEntries(
    Object.entries(data).map(([key, value]) => [
      key,
      SHEET_FORMULA_RE.test(value) ? `'${value}` : value,
    ])
  );
}

function buildReview() {
  const data = getFormData();

  reviewList.innerHTML = reviewFields
    .map(([label, key]) => {
      const value = data[key] || "هیچ وەڵامێک نەدراوە";
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
  submitMessage.className = `submit-message ${type || ""}`;
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

function submitRegistration(payload) {
  return fetch(scriptURL, {
    method: "POST",
    body: JSON.stringify(payload),
  }).then((res) => res.text());
}

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
    if (currentStep === INFO_STEP) {
      showStep(INTRO_STEP);
      return;
    }

    showStep(Math.max(currentStep - 1, INTRO_STEP));
  });
});

document.querySelectorAll(".radio-group").forEach((group) => {
  group.addEventListener("change", () => syncRadioCards(group));
});

document.querySelectorAll("input[name='profession']").forEach((radio) => {
  radio.addEventListener("change", () => {
    syncProfessionOtherState(true);
    syncRadioCards(document.getElementById("professionGroup"));
  });
});

document.querySelectorAll("input[name='gender']").forEach((radio) => {
  radio.addEventListener("change", () => {
    syncRadioCards(document.getElementById("genderGroup"));
  });
});

form.addEventListener("submit", (event) => {
  event.preventDefault();

  if (currentStep < REVIEW_STEP) {
    moveToNextStep();
    return;
  }

  if (currentStep !== REVIEW_STEP || submitButton.disabled) return;

  const panel = getCurrentPanel();
  if (!panel || !validatePanel(panel)) return;

  if (formTrap && formTrap.value.trim()) {
    setSubmitMessage("error", "ناردن ڕاگیرا. تکایە پەڕەکە نوێ بکەرەوە و دووبارە هەوڵ بدەرەوە.");
    return;
  }

  setSubmitMessage("", "");
  setSubmittingState();

  submitRegistration(getSubmissionData())
    .then((text) => {
      if (String(text || "").trim().toLowerCase() !== "success") {
        throw new Error(text || "Unknown error");
      }

      setSubmitMessage("success", "تۆمارکردن بە سەرکەوتوویی ئەنجامدرا.");
      showStep(SUCCESS_STEP);
    })
    .catch(() => {
      setSubmitMessage("error", "هەڵەیەک ڕوویدا، تکایە دووبارە هەوڵ بدەرەوە.");
      resetSubmitState();
    });
});

restartButton.addEventListener("click", () => {
  form.reset();
  reviewList.innerHTML = "";
  setSubmitMessage("", "");
  resetSubmitState();
  syncInitialUiState();
  showStep(INTRO_STEP);
});

const fullNameInput = document.getElementById("fullName");
if (fullNameInput) {
  fullNameInput.addEventListener("input", () => {
    fullNameInput.value = fullNameInput.value.replace(/[^A-Za-z\s]/g, "");
  });
}

const phoneInput = document.getElementById("phone");
if (phoneInput) {
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/[^0-9]/g, "");
  });
}

const emailInput = document.getElementById("email");
if (emailInput) {
  emailInput.addEventListener("input", () => {
    emailInput.value = emailInput.value.replace(/[^\x00-\x7F]/g, "");
  });
}

syncInitialUiState();
showStep(INTRO_STEP);
