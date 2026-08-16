# Open House Reporting


## Setup

Copy `.env.example` to `.env`. None of these values are included in this repository — they must be supplied per-deployment via environment variables.

## Local development

```bash
npm install
npm run dev
```

## Deployment

Deploy as a persistent Node service (not serverless) pointed at this repository, with the environment variables from `.env` configured on the host.