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
      description: "Track exit tasks, access removal, and handoff activities for departing employees.",
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
const headingEl = document.getElementById("section-heading");
const descriptionEl = document.getElementById("section-description");
const listEl = document.getElementById("section-list");
const noteEl = document.getElementById("section-note");
const statusEl = document.getElementById("status-pill");

function renderSection(sectionKey) {
  const section = config.sections[sectionKey] || config.sections[config.defaultSection];
  titleEl.textContent = section.title;
  headingEl.textContent = `${section.title} Overview`;
  descriptionEl.textContent = section.description;
  listEl.innerHTML = section.list.map((item) => `<li>${item}</li>`).join("");
  noteEl.textContent = section.note;
  statusEl.textContent = `${config.title} • ${section.title}`;

  menuItems.forEach((button) => {
    button.classList.toggle("active", button.dataset.target === sectionKey);
  });
}

menuItems.forEach((button) => {
  button.addEventListener("click", () => renderSection(button.dataset.target));
});

renderSection(config.defaultSection);
