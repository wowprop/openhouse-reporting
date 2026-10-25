# Open House Reporting


## Setup

Copy `.env.example` to `.env`. None of these values are included in this repository — they must be supplied per-deployment via environment variables.

## Local development

```bash
npm install
npm run dev
```

## Lark schema: Active checkboxes

Properties and Agents need an `Active` checkbox. Only ticked rows appear in the
`/check-in` and `/report` dropdowns; historical leads keep their original property/agent.

With a `.env` containing the Lark credentials, run:

```bash
npm run ensure-active-fields -- --dry-run   # show what would change
npm run ensure-active-fields               # create the field + tick existing rows
```

`--backfill` re-ticks every existing row if the field already exists. If you created the
column by hand in Lark instead of running this script, run it once with `--backfill` so
the existing rows do not disappear from the dropdowns. Both routes fail open (show
everything) while the field is missing, so this migration can be run before or after the
code deploy without emptying the dropdowns.

## Deployment

Deploy as a persistent Node service (not serverless) pointed at this repository, with the environment variables from `.env` configured on the host.