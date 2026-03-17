---
name: utility_logs Period Filter Convention
description: utility_logs KPI aggregation must use period_year/period_month integers, not paid_at/created_at timestamp ranges
type: feedback
---

Never filter `utility_logs` by `paid_at` or `created_at` date ranges for KPI aggregation. The table stores billing period as `period_year INTEGER` and `period_month INTEGER` — those are the correct semantic anchors.

**Why:** A bill can be created weeks after the billing period it represents, or paid months after. Filtering on `created_at`/`paid_at` time ranges silently produces wrong totals for the month and year dashboard periods. The correct query is:
- day/week/month period: `WHERE period_year = Y AND period_month = M`
- year period: `WHERE period_year = Y`

**How to apply:** Any repository function querying `utility_logs` for a "cost in period" aggregate must use the integer columns, not timestamp columns. The `paid_at`/`created_at` columns are appropriate only for "when was this bill paid/entered" audit/filter use-cases, not for period-bucket aggregation.
