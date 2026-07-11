const config = {
  title: "Automation Dashboard",
  defaultSection: "onboarding",
  sections: {
    onboarding: {
      title: "Onboarding",
      description: "Overview of new employee setup steps, access approvals, and welcome tasks.",
      list: [
        "Review account provisioning requests",
        "Assign required tools and permissions",
        "Confirm welcome communication has been sent"
      ],
      note: "Keep this section updated so each new joiner has a smooth start."
    },
    offboarding: {
      title: "Offboarding",
      description: "Use the action below to start an offboarding process for an employee.",
      purpose: "The purpose of offboarding is to ensure a secure, respectful, and well-documented transition when an employee leaves the organization.",
      list: [
        "Revoke system and application access",
        "Collect company devices and credentials",
        "Capture final handoff notes"
      ],
      note: "Timely offboarding helps reduce security and compliance risks."
    },
    about: {
      title: "About",
      description: "A simple dashboard for managing onboarding and offboarding operations in one place.",
      list: [
        "Customize the content from this config object",
        "Serve the folder through any local web server",
        "Use the left menu to switch between pages"
      ],
      note: "This view is intentionally lightweight and easy to extend."
    }
  }
};

const menuItems = document.querySelectorAll(".menu-item");
const titleEl = document.getElementById("page-title");
const descriptionEl = document.getElementById("section-description");
const purposeEl = document.getElementById("section-purpose");
const offboardingPanelEl = document.getElementById("offboarding-panel");
const offboardingTableBodyEl = document.getElementById("offboarding-table-body");
const offboardingButtonEl = document.getElementById("offboarding-button");
const offboardingFlowEl = document.getElementById("offboarding-flow");
const offboardingFilterEl = document.getElementById("offboarding-filter");
const offboardingSortEl = document.getElementById("offboarding-sort");
const offboardingResultsSummaryEl = document.getElementById("offboarding-results-summary");
const offboardingPaginationEl = document.getElementById("offboarding-pagination");
const offboardingFormViewEl = document.getElementById("offboarding-form-view");
const offboardingReviewViewEl = document.getElementById("offboarding-review-view");
const offboardingSuccessViewEl = document.getElementById("offboarding-success-view");
const offboardingStatusMessageEl = document.getElementById("offboarding-status-message");
const reviewFieldsListEl = document.getElementById("review-fields-list");
const fieldUsernameEl = document.getElementById("field-username");
const fieldManagerNameEl = document.getElementById("field-manager-name");
const fieldExpirationConfirmationEl = document.getElementById("field-expiration-confirmation");
const fieldDisableConfirmationEl = document.getElementById("field-disable-confirmation");
const reviewButtonEl = document.getElementById("review-offboarding-btn");
const confirmButtonEl = document.getElementById("confirm-offboarding-btn");
const cancelButtonEl = document.getElementById("cancel-offboarding-btn");
const backToFormButtonEl = document.getElementById("back-to-form-btn");
const statusEl = document.getElementById("status-pill");
const offboardingPageSize = 10;
let offboardingHistoryRecords = [];
let offboardingCurrentPage = 1;

function resetOffboardingFlow() {
  if (offboardingFlowEl) {
    offboardingFlowEl.style.display = "none";
  }
  if (offboardingFormViewEl) {
    offboardingFormViewEl.style.display = "block";
  }
  if (offboardingReviewViewEl) {
    offboardingReviewViewEl.style.display = "none";
  }
  if (offboardingSuccessViewEl) {
    offboardingSuccessViewEl.style.display = "none";
  }
}

function openOffboardingFlow() {
  if (offboardingFlowEl) {
    offboardingFlowEl.style.display = "block";
  }
  if (offboardingFormViewEl) {
    offboardingFormViewEl.style.display = "block";
  }
  if (offboardingReviewViewEl) {
    offboardingReviewViewEl.style.display = "none";
  }
  if (offboardingSuccessViewEl) {
    offboardingSuccessViewEl.style.display = "none";
  }
}

function reviewOffboardingDetails() {
  const values = {
    username: fieldUsernameEl.value.trim() || "Not provided",
    managerName: fieldManagerNameEl.value.trim() || "Not provided",
    expirationConfirmation: fieldExpirationConfirmationEl.value,
    disableConfirmation: fieldDisableConfirmationEl.value
  };

  reviewFieldsListEl.innerHTML = `
    <li><strong>Username:</strong> ${values.username}</li>
    <li><strong>Manager name:</strong> ${values.managerName}</li>
    <li><strong>Proceed despite expiration:</strong> ${values.expirationConfirmation}</li>
    <li><strong>Disable account:</strong> ${values.disableConfirmation}</li>
  `;

  if (offboardingFormViewEl) {
    offboardingFormViewEl.style.display = "none";
  }
  if (offboardingReviewViewEl) {
    offboardingReviewViewEl.style.display = "block";
  }
  if (offboardingSuccessViewEl) {
    offboardingSuccessViewEl.style.display = "none";
  }
}

async function confirmOffboardingDetails() {
  const payload = {
    username: fieldUsernameEl.value.trim(),
    managerName: fieldManagerNameEl.value.trim(),
    expirationConfirmation: fieldExpirationConfirmationEl.value,
    disableConfirmation: fieldDisableConfirmationEl.value
  };

  if (!payload.username) {
    if (offboardingStatusMessageEl) {
      offboardingStatusMessageEl.textContent = "Please enter a username before submitting the offboarding request.";
      offboardingStatusMessageEl.style.color = "#b91c1c";
    }
    return;
  }

  if (offboardingReviewViewEl) {
    offboardingReviewViewEl.style.display = "none";
  }
  if (offboardingSuccessViewEl) {
    offboardingSuccessViewEl.style.display = "block";
  }
  if (offboardingStatusMessageEl) {
    offboardingStatusMessageEl.textContent = "Submitting offboarding request…";
    offboardingStatusMessageEl.style.color = "#92400e";
  }

  try {
    const response = await fetch("/api/offboard-user", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(result.error || "The offboarding request could not be completed.");
    }

    if (offboardingStatusMessageEl) {
      offboardingStatusMessageEl.textContent = result.message || `Offboarding request submitted for ${payload.username}.`;
      offboardingStatusMessageEl.style.color = "#166534";
    }

    if (fieldUsernameEl) fieldUsernameEl.value = "";
    if (fieldManagerNameEl) fieldManagerNameEl.value = "";
    if (fieldExpirationConfirmationEl) fieldExpirationConfirmationEl.value = "yes";
    if (fieldDisableConfirmationEl) fieldDisableConfirmationEl.value = "yes";

    await loadOffboardingHistory();
  } catch (error) {
    console.error("Unable to complete offboarding request", error);
    if (offboardingStatusMessageEl) {
      offboardingStatusMessageEl.textContent = error.message || "The offboarding request could not be completed.";
      offboardingStatusMessageEl.style.color = "#b91c1c";
    }
    if (offboardingReviewViewEl) {
      offboardingReviewViewEl.style.display = "block";
    }
    if (offboardingSuccessViewEl) {
      offboardingSuccessViewEl.style.display = "none";
    }
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseDate(value) {
  const match = String(value || "").match(/(\d{1,2})-([A-Za-z]{3})-(\d{4})/);
  if (!match) {
    return new Date(0);
  }

  const monthMap = {
    Jan: 0,
    Feb: 1,
    Mar: 2,
    Apr: 3,
    May: 4,
    Jun: 5,
    Jul: 6,
    Aug: 7,
    Sep: 8,
    Oct: 9,
    Nov: 10,
    Dec: 11
  };

  return new Date(Number(match[3]), monthMap[match[2]], Number(match[1]));
}

function getFilteredAndSortedRecords() {
  const filterText = (offboardingFilterEl?.value || "").trim().toLowerCase();
  const sortValue = offboardingSortEl?.value || "date-desc";
  const [sortField, direction] = sortValue.split("-");

  let records = [...offboardingHistoryRecords];

  if (filterText) {
    records = records.filter((record) => {
      const haystack = [record.employeeName, record.dateTime, record.offboardedBy]
        .join(" ")
        .toLowerCase();
      return haystack.includes(filterText);
    });
  }

  records.sort((left, right) => {
    let leftValue = left.employeeName || "";
    let rightValue = right.employeeName || "";
    let comparison = 0;

    if (sortField === "date") {
      comparison = parseDate(left.dateTime) - parseDate(right.dateTime);
    } else if (sortField === "offboarded") {
      leftValue = left.offboardedBy || "";
      rightValue = right.offboardedBy || "";
      comparison = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
    } else {
      comparison = leftValue.localeCompare(rightValue, undefined, { sensitivity: "base" });
    }

    return direction === "asc" ? comparison : -comparison;
  });

  return records;
}

function renderPagination(totalRecords) {
  if (!offboardingPaginationEl) {
    return;
  }

  const totalPages = Math.max(1, Math.ceil(totalRecords / offboardingPageSize));
  if (totalPages <= 1) {
    offboardingPaginationEl.innerHTML = "";
    return;
  }

  const buttons = [];
  buttons.push(`<button type="button" ${offboardingCurrentPage === 1 ? "disabled" : ""} data-page="${offboardingCurrentPage - 1}">Previous</button>`);

  const startPage = Math.max(1, offboardingCurrentPage - 2);
  const endPage = Math.min(totalPages, startPage + 4);

  for (let page = startPage; page <= endPage; page += 1) {
    buttons.push(`<button type="button" class="${page === offboardingCurrentPage ? "active" : ""}" data-page="${page}">${page}</button>`);
  }

  buttons.push(`<button type="button" ${offboardingCurrentPage === totalPages ? "disabled" : ""} data-page="${offboardingCurrentPage + 1}">Next</button>`);
  offboardingPaginationEl.innerHTML = buttons.join("");

  offboardingPaginationEl.querySelectorAll("button[data-page]").forEach((button) => {
    button.addEventListener("click", () => {
      const nextPage = Number(button.dataset.page);
      if (Number.isFinite(nextPage) && nextPage >= 1 && nextPage <= totalPages) {
        offboardingCurrentPage = nextPage;
        renderOffboardingTable();
      }
    });
  });
}

function renderOffboardingTable() {
  if (!offboardingTableBodyEl) {
    return;
  }

  const filteredRecords = getFilteredAndSortedRecords();
  const totalRecords = filteredRecords.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / offboardingPageSize));
  if (offboardingCurrentPage > totalPages) {
    offboardingCurrentPage = totalPages;
  }

  const startIndex = (offboardingCurrentPage - 1) * offboardingPageSize;
  const visibleRecords = filteredRecords.slice(startIndex, startIndex + offboardingPageSize);

  if (!visibleRecords.length) {
    offboardingTableBodyEl.innerHTML = '<tr><td colspan="3">No matching offboarding records found.</td></tr>';
    if (offboardingResultsSummaryEl) {
      offboardingResultsSummaryEl.textContent = "No matching records.";
    }
    renderPagination(0);
    return;
  }

  offboardingTableBodyEl.innerHTML = visibleRecords
    .map((record) => `
      <tr>
        <td>${escapeHtml(record.employeeName || "Unknown")}</td>
        <td>${escapeHtml(record.dateTime || "")}</td>
        <td>${escapeHtml(record.offboardedBy || "Unknown")}</td>
      </tr>
    `)
    .join("");

  if (offboardingResultsSummaryEl) {
    const startRange = totalRecords === 0 ? 0 : startIndex + 1;
    const endRange = Math.min(startIndex + visibleRecords.length, totalRecords);
    offboardingResultsSummaryEl.textContent = `Showing ${startRange}-${endRange} of ${totalRecords} records`;
  }

  renderPagination(totalRecords);
}

function normalizeRecords(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && Array.isArray(payload.records)) {
    return payload.records;
  }

  return [];
}

async function loadOffboardingHistory() {
  if (!offboardingTableBodyEl) {
    return;
  }

  offboardingTableBodyEl.innerHTML = '<tr><td colspan="3">Loading offboarding history…</td></tr>';

  const candidateUrls = ["/api/offboarding-logs", "./offboarding_data/offboarding-history.json"];

  for (const url of candidateUrls) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        continue;
      }

      const payload = await response.json();
      offboardingHistoryRecords = normalizeRecords(payload);
      offboardingCurrentPage = 1;

      if (!offboardingHistoryRecords.length) {
        offboardingTableBodyEl.innerHTML = '<tr><td colspan="3">No offboarding log files were found.</td></tr>';
        if (offboardingResultsSummaryEl) {
          offboardingResultsSummaryEl.textContent = "No records available.";
        }
        renderPagination(0);
        return;
      }

      renderOffboardingTable();
      return;
    } catch (error) {
      // Try the next fallback source.
    }
  }

  console.error("Unable to load offboarding history");
  offboardingTableBodyEl.innerHTML = '<tr><td colspan="3">Unable to load offboarding history.</td></tr>';
  if (offboardingResultsSummaryEl) {
    offboardingResultsSummaryEl.textContent = "Unable to load records.";
  }
}

function renderSection(sectionKey) {
  const section = config.sections[sectionKey] || config.sections[config.defaultSection];
  titleEl.textContent = section.title;
  descriptionEl.textContent = section.description;
  purposeEl.textContent = section.purpose || "";
  purposeEl.style.display = sectionKey === "offboarding" ? "block" : "none";
  offboardingPanelEl.style.display = sectionKey === "offboarding" ? "block" : "none";
  offboardingButtonEl.style.display = sectionKey === "offboarding" ? "block" : "none";
  statusEl.textContent = `${config.title} • ${section.title}`;

  if (sectionKey !== "offboarding") {
    resetOffboardingFlow();
  }

  if (sectionKey === "offboarding") {
    loadOffboardingHistory();
  }

  menuItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === sectionKey);
  });
}

menuItems.forEach((button) => {
  button.addEventListener("click", () => renderSection(button.dataset.target));
});

offboardingButtonEl.addEventListener("click", openOffboardingFlow);
reviewButtonEl.addEventListener("click", reviewOffboardingDetails);
confirmButtonEl.addEventListener("click", confirmOffboardingDetails);
cancelButtonEl.addEventListener("click", () => {
  if (offboardingReviewViewEl) {
    offboardingReviewViewEl.style.display = "none";
  }
  if (offboardingFormViewEl) {
    offboardingFormViewEl.style.display = "block";
  }
  if (offboardingSuccessViewEl) {
    offboardingSuccessViewEl.style.display = "none";
  }
});
backToFormButtonEl.addEventListener("click", () => {
  if (offboardingSuccessViewEl) {
    offboardingSuccessViewEl.style.display = "none";
  }
  if (offboardingFormViewEl) {
    offboardingFormViewEl.style.display = "block";
  }
  if (offboardingReviewViewEl) {
    offboardingReviewViewEl.style.display = "none";
  }
});

if (offboardingFilterEl) {
  offboardingFilterEl.addEventListener("input", () => {
    offboardingCurrentPage = 1;
    renderOffboardingTable();
  });
}

if (offboardingSortEl) {
  offboardingSortEl.addEventListener("change", () => {
    offboardingCurrentPage = 1;
    renderOffboardingTable();
  });
}

renderSection(config.defaultSection);
