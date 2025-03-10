This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

# GitLab MRs Dashboard

A dashboard for monitoring and analyzing GitLab merge requests for team hygiene.

## Getting Started

### Prerequisites

- Node.js 18 or higher
- npm
- Docker and Docker Compose (for containerized development)
- GitLab API token with read access to repositories

### Environment Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Edit `.env.local` and add your GitLab API token and user IDs:

   ```
   GITLAB_API_TOKEN=your_gitlab_api_token_here
   GITLAB_USER_IDS=123456:789012:345678  # Colon-separated list of GitLab user IDs
   API_KEY=your_api_key_here  # For securing custom endpoints
   ```

### Development

#### Option 1: Local Development

Run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

#### Option 2: Docker Development

Run the application using Docker Compose:

```bash
docker-compose up
```

This will start the application in development mode with hot reloading enabled.

### Production Build

To build the Docker image for production:

```bash
docker build -t gitlab-mrs-dashboard .
```

Run the production container:

```bash
docker run -p 3000:3000 \
  -e GITLAB_API_TOKEN=your_token \
  -e GITLAB_USER_IDS=your_user_ids \
  -e API_KEY=your_api_key \
  gitlab-mrs-dashboard
```

## Testing

Run tests with:

```bash
npm test
```

For watch mode:

```bash
npm run test:watch
```

For coverage report:

```bash
npm run test:coverage
```

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs)
- [Learn Next.js](https://nextjs.org/learn)

## Additional Documentation

For detailed information about the API endpoints and component structure, see the [API Documentation](./docs/api.md).
