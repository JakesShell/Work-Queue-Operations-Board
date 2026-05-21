const state = {
  tickets: [],
  selectedTicketId: null,
  summary: null
};

const elements = {
  queueHealth: document.querySelector("#queue-health"),
  queueHealthSummary: document.querySelector("#queue-health-summary"),
  active: document.querySelector("#metric-active"),
  risk: document.querySelector("#metric-risk"),
  critical: document.querySelector("#metric-critical"),
  escalations: document.querySelector("#metric-escalations"),
  ticketTable: document.querySelector("#ticket-table"),
  ticketDetail: document.querySelector("#ticket-detail"),
  serviceImpact: document.querySelector("#service-impact"),
  handoffPanel: document.querySelector("#handoff-panel"),
  searchInput: document.querySelector("#search-input"),
  severityFilter: document.querySelector("#severity-filter"),
  statusFilter: document.querySelector("#status-filter"),
  generateHandoff: document.querySelector("#generate-handoff"),
  resetDemo: document.querySelector("#reset-demo")
};

function getFilters() {
  return {
    q: elements.searchInput.value.trim(),
    severity: elements.severityFilter.value,
    status: elements.statusFilter.value
  };
}

function toQueryString(params) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && value !== "All") {
      search.set(key, value);
    }
  }

  return search.toString();
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data;
}

async function loadDashboard() {
  const filters = getFilters();
  const queryString = toQueryString(filters);
  const ticketsPath = `/api/tickets${queryString ? `?${queryString}` : ""}`;

  const [ticketData, summaryData] = await Promise.all([
    api(ticketsPath),
    api("/api/queue-summary")
  ]);

  state.tickets = ticketData.tickets;
  state.summary = summaryData;

  if (!state.selectedTicketId && state.tickets.length > 0) {
    state.selectedTicketId = state.tickets[0].id;
  }

  if (!state.tickets.some((ticket) => ticket.id === state.selectedTicketId)) {
    state.selectedTicketId = state.tickets[0]?.id || null;
  }

  renderSummary(summaryData);
  renderTickets(ticketData.tickets);
  renderSelectedTicket();
  renderServiceImpact(summaryData.serviceImpact);
}

function renderSummary(summary) {
  elements.queueHealth.textContent = summary.queueHealth;
  elements.active.textContent = summary.active;
  elements.risk.textContent = summary.atRisk + summary.breached;
  elements.critical.textContent = summary.critical;
  elements.escalations.textContent = summary.escalations;

  const topTicket = summary.topTicket
    ? `${summary.topTicket.id} is the highest priority ticket.`
    : "No active tickets need attention.";

  elements.queueHealthSummary.textContent =
    `${summary.active} active tickets. ${summary.atRisk} at risk. ${topTicket}`;

  elements.queueHealth.className = "";
  elements.queueHealth.classList.add(`health-${summary.queueHealth.toLowerCase()}`);
}

function renderTickets(tickets) {
  if (!tickets.length) {
    elements.ticketTable.innerHTML = `
      <tr>
        <td colspan="6" class="empty-table">No tickets match the current filters.</td>
      </tr>
    `;
    return;
  }

  elements.ticketTable.innerHTML = tickets.map((ticket) => `
    <tr class="${ticket.id === state.selectedTicketId ? "selected-row" : ""}" data-ticket-id="${ticket.id}">
      <td>
        <strong>${ticket.id}</strong>
        <span>${ticket.title}</span>
      </td>
      <td>
        <strong>${ticket.customer}</strong>
        <span>${ticket.customerTier}</span>
      </td>
      <td>
        <strong>${ticket.service}</strong>
        <span>${ticket.category}</span>
      </td>
      <td>
        <span class="sla-pill ${slaClass(ticket.slaState)}">${ticket.slaState}</span>
        <small>${formatMinutes(ticket.remainingMinutes)}</small>
      </td>
      <td>
        <span class="score-pill">${ticket.priorityScore}</span>
      </td>
      <td>
        <span class="status-pill">${ticket.status}</span>
      </td>
    </tr>
  `).join("");

  document.querySelectorAll("tbody tr[data-ticket-id]").forEach((row) => {
    row.addEventListener("click", () => {
      state.selectedTicketId = row.dataset.ticketId;
      renderTickets(state.tickets);
      renderSelectedTicket();
    });
  });
}

function renderSelectedTicket() {
  const ticket = state.tickets.find((item) => item.id === state.selectedTicketId);

  if (!ticket) {
    elements.ticketDetail.className = "empty-state";
    elements.ticketDetail.textContent = "No ticket selected.";
    return;
  }

  elements.ticketDetail.className = "ticket-detail-card";
  elements.ticketDetail.innerHTML = `
    <div class="detail-top">
      <div>
        <span class="ticket-id">${ticket.id}</span>
        <h3>${ticket.title}</h3>
        <p>${ticket.impact}</p>
      </div>
      <span class="severity-badge severity-${ticket.severity.toLowerCase()}">${ticket.severity}</span>
    </div>

    <div class="detail-grid">
      <div><span>Customer</span><strong>${ticket.customer}</strong></div>
      <div><span>Owner</span><strong>${ticket.owner}</strong></div>
      <div><span>Team</span><strong>${ticket.team}</strong></div>
      <div><span>SLA</span><strong>${ticket.slaState}</strong></div>
    </div>

    <div class="recommendation-box">
      <span>Recommended Next Action</span>
      <p>${ticket.nextAction}</p>
    </div>

    <div class="recommendation-box soft">
      <span>Escalation Recommendation</span>
      <p>${ticket.escalationRecommendation}</p>
    </div>

    <div class="button-row">
      ${statusButton(ticket, "In Progress")}
      ${statusButton(ticket, "Waiting Customer")}
      ${statusButton(ticket, "Resolved")}
      <button class="danger-button" data-escalate="${ticket.id}" type="button">Escalate</button>
    </div>
  `;

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", () => updateStatus(button.dataset.ticket, button.dataset.status));
  });

  document.querySelector("[data-escalate]")?.addEventListener("click", () => escalateTicket(ticket.id));
}

function statusButton(ticket, status) {
  return `
    <button class="mini-button" data-ticket="${ticket.id}" data-status="${status}" type="button">
      ${status}
    </button>
  `;
}

function renderServiceImpact(items) {
  elements.serviceImpact.innerHTML = items.map((item) => `
    <article class="impact-card">
      <div>
        <strong>${item.category}</strong>
        <span>${item.active} active / ${item.count} total</span>
      </div>
      <p>Highest severity: ${item.highestSeverity}</p>
      <small>${item.breached} breached SLA</small>
    </article>
  `).join("");
}

async function generateHandoff() {
  const handoff = await api("/api/handoff");

  elements.handoffPanel.className = "handoff-card";
  elements.handoffPanel.innerHTML = `
    <p class="handoff-opening">${handoff.openingLine}</p>

    <div class="handoff-numbers">
      <span>Active: <strong>${handoff.keyNumbers.active}</strong></span>
      <span>Risk: <strong>${handoff.keyNumbers.atRisk}</strong></span>
      <span>Breached: <strong>${handoff.keyNumbers.breached}</strong></span>
      <span>Escalations: <strong>${handoff.keyNumbers.escalations}</strong></span>
    </div>

    <h3>Top Handoff Items</h3>
    ${handoff.leadItems.map((item) => `
      <article class="handoff-item">
        <strong>${item.id} · ${item.customer}</strong>
        <p>${item.title}</p>
        <small>${item.slaState} · Priority ${item.priorityScore}</small>
      </article>
    `).join("")}

    <h3>Next 30 Minutes</h3>
    <ul>
      ${handoff.nextThirtyMinutes.map((item) => `<li>${item}</li>`).join("")}
    </ul>
  `;
}

async function updateStatus(ticketId, status) {
  await api(`/api/tickets/${ticketId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status })
  });

  await loadDashboard();
}

async function escalateTicket(ticketId) {
  await api(`/api/tickets/${ticketId}/escalate`, {
    method: "POST"
  });

  await loadDashboard();
}

async function resetDemoData() {
  await api("/api/reset", { method: "POST" });

  state.selectedTicketId = null;
  elements.handoffPanel.className = "handoff-card empty-state";
  elements.handoffPanel.textContent =
    "Generate a shift handoff to summarize the queue for the next engineer.";

  await loadDashboard();
}

function slaClass(state) {
  return String(state).toLowerCase().replace(/\s+/g, "-");
}

function formatMinutes(minutes) {
  if (minutes < 0) {
    return `${Math.abs(minutes)}m breached`;
  }

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m left`;
  }

  return `${minutes}m left`;
}

let debounceTimer;

function debouncedLoad() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(loadDashboard, 220);
}

elements.searchInput.addEventListener("input", debouncedLoad);
elements.severityFilter.addEventListener("change", loadDashboard);
elements.statusFilter.addEventListener("change", loadDashboard);
elements.generateHandoff.addEventListener("click", generateHandoff);
elements.resetDemo.addEventListener("click", resetDemoData);

loadDashboard().catch((error) => {
  console.error(error);
  elements.ticketDetail.className = "empty-state";
  elements.ticketDetail.textContent = error.message;
});
