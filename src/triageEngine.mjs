const severityWeights = {
  Critical: 40,
  High: 28,
  Medium: 16,
  Low: 8
};

const tierWeights = {
  Enterprise: 20,
  Business: 12,
  Startup: 6
};

const statusWeights = {
  Open: 12,
  "In Progress": 6,
  "Waiting Customer": -4,
  Resolved: -25
};

export function enrichTicket(ticket) {
  const remainingMinutes = ticket.slaMinutes - ticket.createdMinutesAgo;
  const slaPercentUsed = Math.min(
    100,
    Math.max(0, Math.round((ticket.createdMinutesAgo / ticket.slaMinutes) * 100))
  );

  let slaState = "Healthy";

  if (remainingMinutes <= 0) {
    slaState = "Breached";
  } else if (remainingMinutes <= 30) {
    slaState = "Critical Risk";
  } else if (remainingMinutes <= 90) {
    slaState = "At Risk";
  }

  const priorityScore = Math.max(
    0,
    Math.round(
      (severityWeights[ticket.severity] || 0) +
      (tierWeights[ticket.customerTier] || 0) +
      (statusWeights[ticket.status] || 0) +
      (ticket.escalationLevel * 8) +
      (slaState === "Breached" ? 30 : 0) +
      (slaState === "Critical Risk" ? 24 : 0) +
      (slaState === "At Risk" ? 14 : 0)
    )
  );

  return {
    ...ticket,
    remainingMinutes,
    slaPercentUsed,
    slaState,
    priorityScore,
    recommendedQueue: recommendQueue(ticket),
    escalationRecommendation: recommendEscalation(ticket, slaState, priorityScore)
  };
}

export function recommendQueue(ticket) {
  const categoryMap = {
    "Cloud Networking": "Cloud Platform",
    "Identity And Access": "Security Operations",
    Database: "Database Reliability",
    Security: "Security Operations",
    Billing: "FinOps",
    "Customer Migration": "Migration Support",
    Compute: "Cloud Platform"
  };

  return categoryMap[ticket.category] || ticket.team || "Cloud Support";
}

export function recommendEscalation(ticket, slaState, priorityScore) {
  if (ticket.status === "Resolved") {
    return "No escalation needed. Keep the ticket in monitoring until customer confirmation.";
  }

  if (ticket.owner === "Unassigned" && (slaState === "Critical Risk" || slaState === "Breached" || priorityScore >= 78)) {
    return "Assign an owner immediately and escalate to the queue lead so the ticket does not stall.";
  }

  if (ticket.owner === "Unassigned") {
    return "Assign an owner now so the ticket does not stall in the intake queue.";
  }

  if (slaState === "Breached") {
    return "Escalate immediately. SLA is breached and the support lead should own the next customer update.";
  }

  if (slaState === "Critical Risk" || priorityScore >= 78) {
    return "Escalate to the queue lead and prepare a 30-minute customer update.";
  }

  if (ticket.severity === "Critical") {
    return "Assign a named owner and keep the incident lead informed until containment is confirmed.";
  }

  return "Continue normal triage. Keep notes current and review before the next shift handoff.";
}

export function buildQueueSummary(tickets) {
  const enrichedTickets = tickets.map(enrichTicket);
  const activeTickets = enrichedTickets.filter((ticket) => ticket.status !== "Resolved");

  const breachedTickets = activeTickets.filter((ticket) => ticket.slaState === "Breached");
  const atRiskTickets = activeTickets.filter((ticket) =>
    ticket.slaState === "At Risk" || ticket.slaState === "Critical Risk"
  );
  const criticalTickets = activeTickets.filter((ticket) => ticket.severity === "Critical");
  const unassignedTickets = activeTickets.filter((ticket) => ticket.owner === "Unassigned");
  const escalationTickets = activeTickets.filter((ticket) =>
    ticket.escalationLevel > 0 || ticket.priorityScore >= 78
  );

  const averagePriority = activeTickets.length
    ? Math.round(activeTickets.reduce((sum, ticket) => sum + ticket.priorityScore, 0) / activeTickets.length)
    : 0;

  let queueHealth = "Stable";

  if (breachedTickets.length > 0 || criticalTickets.length >= 2) {
    queueHealth = "Critical";
  } else if (atRiskTickets.length >= 2 || averagePriority >= 65) {
    queueHealth = "Watch";
  }

  return {
    total: enrichedTickets.length,
    active: activeTickets.length,
    resolved: enrichedTickets.length - activeTickets.length,
    breached: breachedTickets.length,
    atRisk: atRiskTickets.length,
    critical: criticalTickets.length,
    unassigned: unassignedTickets.length,
    escalations: escalationTickets.length,
    averagePriority,
    queueHealth,
    topTicket: [...activeTickets].sort((a, b) => b.priorityScore - a.priorityScore)[0] || null,
    serviceImpact: buildServiceImpact(enrichedTickets)
  };
}

export function buildServiceImpact(tickets) {
  const grouped = new Map();
  const severityOrder = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4
  };

  for (const ticket of tickets) {
    if (!grouped.has(ticket.category)) {
      grouped.set(ticket.category, {
        category: ticket.category,
        count: 0,
        active: 0,
        breached: 0,
        highestSeverity: "Low"
      });
    }

    const item = grouped.get(ticket.category);
    item.count += 1;

    if (ticket.status !== "Resolved") {
      item.active += 1;
    }

    if (ticket.slaState === "Breached") {
      item.breached += 1;
    }

    if (severityOrder[ticket.severity] > severityOrder[item.highestSeverity]) {
      item.highestSeverity = ticket.severity;
    }
  }

  return Array.from(grouped.values()).sort((a, b) => b.active - a.active);
}

export function buildHandoff(tickets) {
  const enrichedTickets = tickets.map(enrichTicket);
  const summary = buildQueueSummary(tickets);

  const activeTickets = enrichedTickets
    .filter((ticket) => ticket.status !== "Resolved")
    .sort((a, b) => b.priorityScore - a.priorityScore);

  const leadItems = activeTickets.slice(0, 3).map((ticket) => ({
    id: ticket.id,
    title: ticket.title,
    customer: ticket.customer,
    priorityScore: ticket.priorityScore,
    slaState: ticket.slaState,
    nextAction: ticket.nextAction
  }));

  const openingLine = summary.queueHealth === "Critical"
    ? "Queue is in critical condition. Prioritize SLA risk, critical incidents, and customer updates first."
    : summary.queueHealth === "Watch"
      ? "Queue needs close monitoring. Focus on at-risk tickets and unassigned ownership."
      : "Queue is stable. Continue normal triage and keep shift notes current.";

  return {
    generatedAt: new Date().toISOString(),
    queueHealth: summary.queueHealth,
    openingLine,
    keyNumbers: {
      active: summary.active,
      atRisk: summary.atRisk,
      breached: summary.breached,
      escalations: summary.escalations,
      unassigned: summary.unassigned
    },
    leadItems,
    nextThirtyMinutes: [
      "Assign or confirm owners for unassigned and critical tickets.",
      "Update customers on tickets with Critical Risk or Breached SLA state.",
      "Escalate the highest priority unresolved ticket to the correct queue lead.",
      "Validate that ticket notes include impact, current action, owner, and next checkpoint."
    ]
  };
}

