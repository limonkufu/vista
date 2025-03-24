# Prompt Plan

## Phase 1: Project Setup and Foundation

### Step 1.1: Initialize Next.js Project with TypeScript

Create a new Next.js 14 project with TypeScript. Install required dependencies including shadcn/ui, axios, jest, @testing-library/react, @testing-library/jest-dom, and supertest. Configure shadcn/ui with the SKA Observatory brand colors using CSS variables. Add basic Jest configuration for both frontend and backend testing.

### Step 1.2: Docker Setup

Create a Dockerfile for a production-ready Next.js application that:

1. Uses Node.js 18 Alpine base image
2. Installs dependencies
3. Builds the application
4. Exposes port 3000
5. Starts the production server

Also create a docker-compose.yml file for local development with:

- Hot reloading
- Environment variables for GITLAB_API_TOKEN and GITLAB_USER_IDS
- Port mapping 3000:3000

## Phase 2: Backend Implementation

### Step 2.1: GitLab API Utility

Create a TypeScript module 'lib/gitlab.ts' that:

1. Exports async function fetchTeamMRs(options: { groupId: string, page?: number, per_page?: number })
2. Fetches merge requests from GitLab's API using axios
3. Filters MRs where author, assignee, or reviewers are in GITLAB_USER_IDS
4. Handles pagination using provided page/per_page params
5. Includes JSDoc comments and TypeScript interfaces

Write Jest tests that:

- Mock axios responses
- Verify user filtering logic
- Test pagination handling

### Step 2.2: API Route - Too Old MRs

Create '/api/mrs/too-old' route handler that:

1. Accepts page/per_page query params
2. Uses fetchTeamMRs to get MRs
3. Filters MRs older than 28 days from created_at
4. Implements in-memory cache with 60s TTL
5. Returns JSON response matching the spec schema
6. Includes Supertest tests for:
   - Response structure validation
   - Pagination behavior
   - Cache headers verification

### Step 2.3: API Route - Not Updated MRs

Create '/api/mrs/not-updated' following the same pattern as Step 2.2 but:

- Filter based on updated_at < 14 days ago
- Reuse cache implementation with separate cache key
- Add specific test cases for update date filtering

### Step 2.4: API Route - Pending Review MRs

Create '/api/mrs/pending-review' endpoint that:

1. Filters MRs where current user is in reviewers list
2. Checks updated_at < 7 days ago
3. Shares cache infrastructure but with distinct key
4. Includes tests verifying reviewer filtering logic

## Phase 3: Frontend Implementation

### Step 3.1: MR Table Component

Create a reusable MRTable React component using shadcn/ui that:

1. Accepts data prop with MR items
2. Implements sorting via clickable column headers
3. Handles pagination controls (Prev/Next/Page numbers)
4. Displays loading states
5. Shows error messages when data fetching fails
6. Includes React Testing Library tests for:
   - Table rendering with mock data
   - Sorting interaction
   - Pagination behavior

### Step 3.2: Dashboard Layout

Create a dashboard page at /dashboard that:

1. Lays out three MRTable components in vertical stack
2. Implements global refresh button that:
   - Triggers cache-busting reload of all tables
   - Shows loading state during refresh
3. Fetches data from all three API endpoints
4. Passes threshold values to each table's metadata
5. Includes responsive design for mobile layouts
6. Adds Jest tests for:
   - Initial data fetching
   - Refresh button functionality
   - Error state handling

## Phase 4: Final Integration

### Step 4.1: Security Middleware

Create API middleware that:

1. Checks for valid API key in x-api-key header
2. Returns 401 for unauthorized requests
3. Loads API key from environment variable
4. Excludes healthcheck endpoint from auth
5. Add tests for auth scenarios using Supertest

### Step 4.2: CI/CD Pipeline

Create .gitlab-ci.yml that:

1. Runs linting (ESLint, TypeScript)
2. Executes frontend and backend tests
3. Builds Docker image
4. Pushes to registry on main branch
5. Includes job for vulnerability scanning

### Step 4.3: Documentation

Generate comprehensive README.md with:

1. Local development setup instructions
2. Environment variables reference
3. API endpoint documentation
4. Testing guidelines
5. Deployment procedures
6. Troubleshooting section

## Validation Phase

### Final Step: End-to-End Testing Plan

Create cypress test suite that:

1. Verifies dashboard renders all three panels
2. Tests sorting in each table
3. Validates pagination controls
4. Checks error handling for failed API calls
5. Verifies cache behavior via refresh button
6. Ensures mobile responsiveness

This breakdown ensures each component is developed with test coverage before integration. Each step builds on previous work while maintaining isolated testability. The sequence prioritizes core functionality before moving to security and deployment concerns, following the "vertical slice" approach for incremental value delivery.
