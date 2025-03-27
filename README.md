# VISTA - Vibe Into Software Tasks & Activities

[![CI](https://github.com/your-username/your-repo-name/actions/workflows/ci.yml/badge.svg)](https://github.com/your-username/your-repo-name/actions/workflows/ci.yml)
<!-- Add other badges if applicable (License, Coverage, etc.) -->

VISTA is a context-aware work management dashboard designed to monitor GitLab merge requests (MRs). It provides insights into team hygiene metrics (MR age, update frequency, review status) and offers role-based views tailored for Product Owners, Developers, and Team Leads, integrating seamlessly with Jira.

## ✨ Key Features

* **Hygiene Tracking:** Monitors MRs based on age, inactivity, and pending review status with configurable thresholds.
* **Role-Based Views:**
  * **PO View:** Organizes MRs by associated Jira tickets.
  * **Dev View:** Groups MRs by status (Needs Review, Changes Requested, etc.) relevant to developers.
  * **Team View:** Provides aggregated metrics and ticket summaries for a team-wide perspective.
* **Jira Integration:** Automatically links MRs to Jira tickets based on title, description, or branch name, and allows manual association.
* **Context Preservation:** Maintains filters and context when switching between views.
* **Advanced Filtering:** Filter MRs and tickets by various criteria (project, author, assignee, reviewer, status, priority, type, etc.).
* **Dynamic Grouping:** Group MR data by author or assignee within hygiene views.
* **Team Management:** Select team members by importing from GitLab groups or adding individuals.
* **Caching:** Multi-layered caching (GitLab API, Jira API, Processed Data, Client-side) for performance.
* **Feature Flags:** Control the availability of new features (like role-based views) via localStorage.
* **Theme Switching:** Light and Dark mode support.
* **Responsive Design:** Adapts to various screen sizes (desktop, tablet, mobile).
* **Keyboard Shortcuts:** Refresh data using `Ctrl+R`.

## 🚀 Tech Stack

* **Framework:** [Next.js](https://nextjs.org/) 14+ (App Router)
* **Language:** [TypeScript](https://www.typescriptlang.org/)
* **UI:** [shadcn/ui](https://ui.shadcn.com/), [Tailwind CSS](https://tailwindcss.com/)
* **Icons:** [Lucide React](https://lucide.dev/)
* **API Client:** [Axios](https://axios-http.com/)
* **State Management:** React Context API, `useState`, `useMemo`, `useCallback`
* **Testing:** [Jest](https://jestjs.io/), [React Testing Library](https://testing-library.com/docs/react-testing-library/intro/), [Cypress](https://www.cypress.io/)
* **CI/CD:** [GitHub Actions](https://github.com/features/actions)
* **Containerization:** [Docker](https://www.docker.com/)
* **Rate Limiting:** [Bottleneck](https://github.com/SGrondin/bottleneck) (for Jira API), [limiter](https://github.com/jhurliman/node-rate-limiter) (for internal API)

## 🏁 Getting Started

### Prerequisites

* Node.js (v18.x recommended)
* npm (v9 or later)
* Docker (optional, for containerized deployment)
* Access to a GitLab instance and (optionally) a Jira instance.

### Installation & Setup

1. **Clone the repository:**

    ```bash
    git clone <repository-url>
    cd vista
    ```

2. **Install dependencies:**

    ```bash
    npm install
    ```

3. **Set up environment variables:**
    Copy the example environment file:

    ```bash
    cp .env.example .env
    ```

    Edit the `.env` file and provide values for the following variables:

    | Variable                  | Description                                                                 | Required | Example                               |
    | :------------------------ | :-------------------------------------------------------------------------- | :------- | :------------------------------------ |
    | `GITLAB_API_TOKEN`        | GitLab Personal Access Token with `api` scope.                              | Yes      | `glpat-xxxxxxxxxxxxxxxxxxxx`          |
    | `GITLAB_GROUP_ID`         | The ID of the main GitLab group to fetch MRs from.                          | Yes      | `1234567`                             |
    | `GITLAB_USER_IDS`         | **Default** team member GitLab user IDs (colon-separated).                  | Yes      | `101:102:103`                         |
    | `API_KEY`                 | Secret key for securing internal API routes (used by middleware).           | Yes      | `your-secure-api-key`                 |
    | `JIRA_HOST`               | Your Jira instance hostname (e.g., `your-domain.atlassian.net`).            | Yes      | `mycompany.atlassian.net`             |
    | `JIRA_EMAIL`              | Email address associated with your Jira account.                            | Yes      | `user@example.com`                    |
    | `JIRA_API_TOKEN`          | Jira API token (generate from Atlassian account settings).                  | Yes      | `xxxxxxxxxxxxxxxxxxxxxxxx`            |
    | `JIRA_EPIC_LINK_FIELD`    | Custom field ID for Epic Link (check your Jira instance config).            | No       | `customfield_10014` (Example Default) |
    | `JIRA_EPIC_NAME_FIELD`    | Custom field ID for Epic Name (check your Jira instance config).            | No       | `customfield_10015` (Example Default) |
    | `JIRA_STORY_POINTS_FIELD` | Custom field ID for Story Points (check your Jira instance config).         | No       | `customfield_10016` (Example Default) |
    | `JIRA_SPRINT_FIELD`       | Custom field ID for Sprint (check your Jira instance config).               | No       | `customfield_10017` (Example Default) |
    | `NEXT_PUBLIC_NODE_ENV`    | Set to `development` for local dev (enables dev-only features/logging).     | No       | `development`                         |
    | `NEXT_PUBLIC_DASHBOARD_API_KEY` | API key accessible by the client (if needed, currently uses server-side `API_KEY`). | No | `client-accessible-key` |

4. **Run the development server:**

    ```bash
    npm run dev
    ```

5. Open [http://localhost:3000](http://localhost:3000) in your browser. The app will redirect to `/dashboard`.

## 🔭 Available Views

Vista provides multiple perspectives on your team's merge requests:

* **Hygiene View:** The original dashboard focusing on MR health metrics:
  * *Old MRs:* MRs open longer than the configured threshold (default: 28 days).
  * *Inactive MRs:* MRs without updates beyond the threshold (default: 14 days).
  * *Pending Review:* MRs awaiting review longer than the threshold (default: 7 days).
* **PO View:** Organizes MRs under their associated Jira tickets, providing visibility for Product Owners. Includes actions like marking tickets as reviewed or flagging for follow-up.
* **Dev View:** Groups MRs by their current status (Needs Review, Changes Requested, Waiting for CI, Ready to Merge, Blocked) to help developers prioritize their work.
* **Team View:** Offers a high-level overview with aggregated metrics (Total MRs, Open MRs, Avg. Age, Overdue, Blocked Tickets) and a summary table of Jira tickets with associated MR counts.

You can switch between views using the main navigation tabs. The Hygiene view categories are accessible via a dropdown under the "Hygiene" tab.

## 🧪 Testing

The project includes unit, integration, and end-to-end tests.

* **Run all Jest tests (Unit/Integration):**

    ```bash
    npm test
    ```

* **Run Jest tests in watch mode:**

    ```bash
    npm run test:watch
    ```

* **Generate Jest test coverage report:**

    ```bash
    npm run test:coverage
    ```

* **Run Cypress E2E tests headlessly:**
    *(Requires the dev server to be running)*

    ```bash
    npm run test:e2e
    ```

* **Open Cypress UI for interactive E2E testing:**
    *(Requires the dev server to be running)*

    ```bash
    npm run test:e2e:dev
    ```

## 🐳 Docker

A `Dockerfile` is provided for building a production-ready container image.

1. **Build the image:**

    ```bash
    docker build -t vista .
    ```

2. **Run the container:**
    *(Replace placeholders with your actual environment variable values)*

    ```bash
    docker run -p 3000:3000 \
      -e GITLAB_API_TOKEN="YOUR_GITLAB_TOKEN" \
      -e GITLAB_GROUP_ID="YOUR_GROUP_ID" \
      -e GITLAB_USER_IDS="ID1:ID2:ID3" \
      -e API_KEY="YOUR_INTERNAL_API_KEY" \
      -e JIRA_HOST="YOUR_JIRA_HOST" \
      -e JIRA_EMAIL="YOUR_JIRA_EMAIL" \
      -e JIRA_API_TOKEN="YOUR_JIRA_TOKEN" \
      # Add other JIRA_* variables if needed
      -e NODE_ENV="production" \
      --name vista-app \
      vista
    ```

    The application will be available at `http://localhost:3000`.

## ⚙️ API Endpoints

The application uses internal Next.js API routes:

* `/api/mrs/{too-old|not-updated|pending-review}`: Fetch MRs for the hygiene view categories (potentially deprecated in favor of `UnifiedDataService`).
* `/api/users`: Fetch GitLab users (default team, by group, by ID, search).
* `/api/jira`: Proxy endpoint for interacting with the Jira API (get ticket, search).
* `/api/cache`: Manage server-side caches (clear, get stats).
* `/api/health`: Simple health check endpoint.

These endpoints are primarily consumed by the frontend hooks and services. Direct access is secured by the `API_KEY` (except for `/api/health`).

## caching Strategy

Vista employs multiple caching layers:

1. **GitLab API Cache:** Caches raw responses from the GitLab API (`gitlabApiCache.ts`). TTL configured via `cacheConfig.ts`.
2. **Jira API Cache:** Caches raw responses from the internal `/api/jira` endpoint (`jiraCache.ts`). TTL configured via `cacheConfig.ts`.
3. **Processed Data Cache:** Caches the results of combined/filtered data within `UnifiedDataService` (`UnifiedDataService.ts`). TTL configured via `cacheConfig.ts`.
4. **Client Cache:** Simple client-side cache for specific frontend data (`clientCache.ts`). TTL configured via `cacheConfig.ts`.

Caches can be managed (cleared, stats viewed) via the Settings menu in the UI (accessible via the cog icon).

## 🚩 Feature Flags

New features, particularly the role-based views, are controlled by feature flags managed via `src/services/FeatureFlags.ts`. Flags can be toggled in development using browser localStorage.

* `roleBased`: Enables the overall role-based view system (PO, Dev, Team).
* `poView`: Enables the Product Owner view.
* `devView`: Enables the Developer view.
* `teamView`: Enables the Team view.
* `jiraIntegration`: Enables features relying on Jira data.

To modify flags locally:

1. Open your browser's Developer Tools.
2. Go to the "Application" (or "Storage") tab.
3. Select "Local Storage" for `http://localhost:3000`.
4. Find the key `gitlab-mrs-dashboard-feature-flags`.
5. Edit the JSON value to enable (`true`) or disable (`false`) specific flags, e.g., `{"roleBased":true,"poView":false,...}`.
6. Refresh the page.

## 🔄 CI/CD

The project uses GitHub Actions (`.github/workflows/ci.yml`) for continuous integration:

* **On Push/Pull Request to `main`:** Runs linting and all tests (Jest & Cypress).
* **On Push to `main`:**
  * Runs tests and security scan (Snyk).
  * Builds and pushes a Docker image to Docker Hub tagged with `latest` and the commit SHA.
  * Includes a placeholder deployment step.

## Contributing

Contributions are welcome! Please follow standard fork-and-pull-request workflow. Ensure tests pass and linting is clean before submitting a PR.

<!-- ## License -->
<!-- Add license information if applicable, e.g., MIT -->
<!-- This project is licensed under the MIT License - see the LICENSE.md file for details. -->
