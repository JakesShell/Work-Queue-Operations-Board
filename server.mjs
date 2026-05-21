import express from "express";
import cors from "cors";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { seedTickets } from "./src/data/tickets.mjs";
import {
  enrichTicket,
  buildQueueSummary,
  buildHandoff
} from "./src/triageEngine.mjs";

const app = express();
const PORT = process.env.PORT || 8080;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDirectory = path.join(__dirname, "public");

let tickets = seedTickets.map((ticket) => ({ ...ticket }));

app.use(helmet({
  contentSecurityPolicy: false
}));

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDirectory));

app.get("/api/health", (request, response) => {
  response.json({
    status: "healthy",
    service: "QueueSignal Cloud Support SLA & Incident Triage Console",
    version: "2.0.0",
    timestamp: new Date().toISOString()
  });
});

app.get("/api/tickets", (request, response) => {
  const { status, severity, team, q } = request.query;

  let result = tickets.map(enrichTicket);

  if (status && status !== "All") {
    result = result.filter((ticket) => ticket.status === status);
  }

  if (severity && severity !== "All") {
    result = result.filter((ticket) => ticket.severity === severity);
  }

  if (team && team !== "All") {
    result = result.filter((ticket) => ticket.team === team);
  }

  if (q) {
    const search = String(q).toLowerCase();

    result = result.filter((ticket) =>
      ticket.title.toLowerCase().includes(search) ||
      ticket.customer.toLowerCase().includes(search) ||
      ticket.id.toLowerCase().includes(search) ||
      ticket.service.toLowerCase().includes(search) ||
      ticket.category.toLowerCase().includes(search)
    );
  }

  result.sort((a, b) => b.priorityScore - a.priorityScore);

  response.json({
    count: result.length,
    tickets: result
  });
});

app.get("/api/tickets/:id", (request, response) => {
  const ticket = tickets.find((item) => item.id === request.params.id);

  if (!ticket) {
    return response.status(404).json({
      error: "Ticket not found."
    });
  }

  response.json(enrichTicket(ticket));
});

app.patch("/api/tickets/:id/status", (request, response) => {
  const ticket = tickets.find((item) => item.id === request.params.id);
  const nextStatus = request.body?.status;

  const allowedStatuses = ["Open", "In Progress", "Waiting Customer", "Resolved"];

  if (!ticket) {
    return response.status(404).json({
      error: "Ticket not found."
    });
  }

  if (!allowedStatuses.includes(nextStatus)) {
    return response.status(400).json({
      error: "Invalid status.",
      allowedStatuses
    });
  }

  ticket.status = nextStatus;
  ticket.lastUpdate = `Status changed to ${nextStatus} from the QueueSignal dashboard.`;

  response.json(enrichTicket(ticket));
});

app.post("/api/tickets/:id/escalate", (request, response) => {
  const ticket = tickets.find((item) => item.id === request.params.id);

  if (!ticket) {
    return response.status(404).json({
      error: "Ticket not found."
    });
  }

  ticket.escalationLevel = Math.min(3, ticket.escalationLevel + 1);

  if (ticket.status === "Open") {
    ticket.status = "In Progress";
  }

  ticket.lastUpdate = `Escalation raised to level ${ticket.escalationLevel}.`;

  response.json(enrichTicket(ticket));
});

app.get("/api/queue-summary", (request, response) => {
  response.json(buildQueueSummary(tickets));
});

app.get("/api/handoff", (request, response) => {
  response.json(buildHandoff(tickets));
});

app.post("/api/reset", (request, response) => {
  tickets = seedTickets.map((ticket) => ({ ...ticket }));

  response.json({
    status: "reset",
    tickets: tickets.map(enrichTicket)
  });
});

app.use((request, response) => {
  response.sendFile(path.join(publicDirectory, "index.html"));
});

app.listen(PORT, () => {
  console.log(`QueueSignal running at http://localhost:${PORT}`);
});
