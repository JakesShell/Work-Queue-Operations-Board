# QueueSignal Architecture Notes

## System Flow

```text
Cloud support ticket data
        |
        v
Express backend API
        |
        v
Triage engine enriches each ticket with:
- SLA state
- Priority score
- Recommended queue
- Escalation recommendation
        |
        v
Frontend dashboard renders:
- Queue health
- Support ticket table
- Ticket decision panel
- Service impact summary
- Shift handoff summary
