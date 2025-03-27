This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# Vista

A dashboard for monitoring GitLab merge requests, focusing on team hygiene metrics such as age, update frequency, and review status.

## Features

- Monitor MRs older than 28 days
- Track MRs not updated in 14 days
- Identify MRs pending review for more than 7 days
- Responsive design with mobile support
- Real-time data with caching
- Secure API endpoints with rate limiting
- Time-based display for MR age and last update time ("Created 32 days ago", "Updated 18 days ago")
- Advanced filtering options (by project, author, assignee, reviewer)
- Grouping functionality (by author or assignee)
- Team selection by GitLab group name
- Helpful guidance and suggestions below each MR category

## Tech Stack

- Next.js 14 with TypeScript
- shadcn/ui for components
- Jest & React Testing Library for unit tests
- Cypress for E2E testing
- GitLab CI/CD pipeline
- Docker containerization

## Getting Started

### Prerequisites

- Node.js 18 or later
- npm 9 or later
- Docker (optional)

### Local Development

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd vista
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up environment variables:

   ```bash
   cp .env.example .env
   ```

   Edit `.env` and add:
   - `GITLAB_API_TOKEN`: Your GitLab API token
   - `GITLAB_USER_IDS`: Colon-separated list of team member GitLab user IDs
   - `API_KEY`: Secret key for API authentication

4. Start the development server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

### Testing

#### Unit Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage
```

#### E2E Tests

```bash
# Run E2E tests headlessly
npm run test:e2e

# Open Cypress for development
npm run test:e2e:dev
```

### Docker

Build and run with Docker:

```bash
# Build image
docker build -t vista .

# Run container
docker run -p 3000:3000 \
  -e GITLAB_API_TOKEN=your_token \
  -e GITLAB_USER_IDS=user_ids \
  -e API_KEY=your_api_key \
  vista
```

## Deployment

### Environment Variables

Required environment variables:

| Variable | Description |
|----------|-------------|
| `GITLAB_API_TOKEN` | GitLab personal access token |
| `GITLAB_USER_IDS` | Team member GitLab user IDs (colon-separated) |
| `API_KEY` | Secret key for API authentication |
| `JIRA_HOST` | Your Jira instance URL (e.g., <https://your-domain.atlassian.net>) |
| `JIRA_EMAIL` | Your Jira account email |
| `JIRA_API_TOKEN` | Your Jira API token |
| `JIRA_EPIC_LINK_FIELD` | Custom field ID for epic links (default: customfield_10014) |
| `JIRA_EPIC_NAME_FIELD` | Custom field ID for epic names (default: customfield_10015) |
| `JIRA_STORY_POINTS_FIELD` | Custom field ID for story points (default: customfield_10016) |
| `JIRA_SPRINT_FIELD` | Custom field ID for sprint field (default: customfield_10017) |

### CI/CD Pipeline

The project includes a GitHub Actions workflow with:

1. Automated testing (unit tests and E2E tests)
2. Security scanning with Snyk
3. Docker image building and publishing
4. Production deployment (configurable)

### Production Deployment Checklist

- [ ] Set up environment variables in GitHub Secrets
- [ ] Configure SSL certificates
- [ ] Set up monitoring
- [ ] Configure backup strategy
- [ ] Test rate limiting
- [ ] Verify security headers
