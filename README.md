This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# GitLab MRs Dashboard

A dashboard for monitoring GitLab merge requests, focusing on team hygiene metrics such as age, update frequency, and review status.

## Features

- Monitor MRs older than 28 days
- Track MRs not updated in 14 days
- Identify MRs pending review for more than 7 days
- Responsive design with mobile support
- Real-time data with caching
- Secure API endpoints with rate limiting

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
   cd gitlab-mrs-dashboard
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
docker build -t gitlab-mrs-dashboard .

# Run container
docker run -p 3000:3000 \
  -e GITLAB_API_TOKEN=your_token \
  -e GITLAB_USER_IDS=user_ids \
  -e API_KEY=your_api_key \
  gitlab-mrs-dashboard
```

Or use docker-compose:

```bash
docker-compose up
```

## Deployment

### Environment Variables

Required environment variables:

| Variable | Description |
|----------|-------------|
| `GITLAB_API_TOKEN` | GitLab personal access token |
| `GITLAB_USER_IDS` | Team member GitLab user IDs (colon-separated) |
| `API_KEY` | Secret key for API authentication |

### CI/CD Pipeline

The project includes a GitLab CI/CD pipeline with:

1. Automated testing
2. Security scanning
3. Docker image building
4. Production deployment

### Production Deployment Checklist

- [ ] Set up environment variables
- [ ] Configure SSL certificates
- [ ] Set up monitoring
- [ ] Configure backup strategy
- [ ] Test rate limiting
- [ ] Verify security headers

## API Documentation

### Endpoints

#### GET /api/mrs/too-old

Returns MRs older than 28 days.

#### GET /api/mrs/not-updated

Returns MRs not updated in 14 days.

#### GET /api/mrs/pending-review

Returns MRs pending review for more than 7 days.

### Authentication

All API endpoints require an API key in the `x-api-key` header.

### Rate Limiting

- 100 requests per minute per IP
- Returns 429 status code when limit exceeded

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## Additional Documentation

For detailed information about the API endpoints and component structure, see the [API Documentation](./docs/api.md).
