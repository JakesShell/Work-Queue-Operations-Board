import assert from "node:assert/strict";
import { seedTickets } from "../src/data/tickets.mjs";
import {
  enrichTicket,
  buildQueueSummary,
  buildHandoff
} from "../src/triageEngine.mjs";

const enrichedTickets = seedTickets.map(enrichTicket);
const topTicket = [...enrichedTickets].sort((a, b) => b.priorityScore - a.priorityScore)[0];

assert.equal(seedTickets.length, 8);
assert.ok(topTicket.priorityScore >= 70);
assert.ok(["Critical", "High"].includes(topTicket.severity));
assert.ok(["Healthy", "At Risk", "Critical Risk", "Breached"].includes(topTicket.slaState));

const criticalTicket = enrichedTickets.find((ticket) => ticket.id === "QS-1048");
assert.equal(criticalTicket.slaState, "Critical Risk");
assert.ok(criticalTicket.escalationRecommendation.includes("Escalate"));

const unassignedTicket = enrichedTickets.find((ticket) => ticket.id === "QS-1047");
assert.equal(unassignedTicket.owner, "Unassigned");
assert.ok(unassignedTicket.escalationRecommendation.includes("Assign"));

const summary = buildQueueSummary(seedTickets);

assert.equal(summary.total, 8);
assert.equal(summary.active, 7);
assert.equal(summary.resolved, 1);
assert.equal(summary.queueHealth, "Critical");
assert.ok(summary.topTicket);
assert.ok(summary.serviceImpact.length > 0);

const handoff = buildHandoff(seedTickets);

assert.equal(handoff.queueHealth, "Critical");
assert.ok(handoff.openingLine.includes("critical"));
assert.equal(handoff.leadItems.length, 3);
assert.ok(handoff.nextThirtyMinutes.length >= 4);

console.log("QueueSignal triage tests passed.");
