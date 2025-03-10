
# GitLab MR Analytics Dashboard Specification

## 1. Overview

**Purpose:**  
Create a dashboard for managers, the team's scrum master, and product owners to monitor and analyze GitLab merge requests (MRs) for team hygiene. This dashboard highlights MRs that are:

- Too old (created more than 28 days ago)
- Not being actively updated (no updates in the last 14 days)
- Awaiting review with insufficient activity (no updates in the last 7 days)

**Architecture:**  

- **Frontend:** Next.js application using shadcdn for UI with SKA Observatory brand colors.
- **Backend:** Custom API routes built into the Next.js application to provide separate endpoints for each test.  
- **Deployment:** Local deployment via Docker (Dockerfile provided).  
- **Testing:** Automated tests using Jest, React Testing Library (frontend) and Supertest (backend), integrated into a GitLab CI/CD pipeline.

## 2. Functional Requirements

### A. Data Source & GitLab API Integration

- **GitLab API Access**
  - Use environment variables:
    - `GITLAB_API_TOKEN`: For authenticating GitLab API calls.
    - `GITLAB_USER_IDS`: Colon-separated list of GitLab user IDs (to define the team).
  - Use the GitLab group API (e.g., group id `3180705`) similar to the provided Python implementation.
- **Data Handling**
  - Retrieve merge requests where team members are either the author, assignee, or reviewer.
  - Use the raw responses from the GitLab API without additional transformation to keep the approach simple for the MVP.

### B. MR Tests & Thresholds (Fixed for the MVP)

1. **Test – Assigned MRs Are Too Old**
   - **Condition:** If an MR (created by or assigned to a team member) was created more than 28 days ago.
   - **Metadata:** Include threshold value of `28` days.
2. **Test – Assigned MRs Are Not Being Updated**
   - **Condition:** If an MR (created by or assigned to a team member) has not been updated in the last 14 days.
   - **Metadata:** Include threshold value of `14` days.
3. **Test – MRs Under Review Are Not Being Reviewed**
   - **Condition:** If an MR (under review by a team member) has not been updated in the last 7 days.
   - **Metadata:** Include threshold value of `7` days.

### C. API Endpoints

Each of the three tests will have a dedicated API endpoint with the following characteristics:

- **Endpoint Structure:**  
  For example:
  - `/api/mrs/too-old`
  - `/api/mrs/not-updated`
  - `/api/mrs/pending-review`
  
- **Response Schema:**  
  The response for each API call must have a JSON structure similar to:

  ```json
  {
    "items": [
      {
        "id": 12345,
        "title": "Fix CI pipeline issue",
        "created_at": "2023-09-20T14:30:00Z",
        "updated_at": "2023-09-25T10:15:00Z",
        "web_url": "https://gitlab.example.com/group/project/merge_requests/12345",
        "author": { "username": "alice" },
        "assignee": { "username": "bob" },
        "reviewers": [{ "username": "charlie" }]
        // ...other fields returned by GitLab
      }
      // ...more merge request objects as returned by GitLab API
    ],
    "metadata": {
      "lastRefreshed": "2023-09-26T08:00:00Z",
      "threshold": 28
      // This object can be extended later with more details
    }
  }
  ```

- **Pagination Support:**  
  All API endpoints must support:
  - `page` and `per_page` (default page size of 25)
  - Return additional pagination metadata (e.g., total count of items, current page) as required.
  
- **Caching:**  
  - Implement basic in-memory caching (TTL = 60 seconds) to reduce excessive calls to the GitLab API.
  - The cache should be bypassed or cleared when the global refresh is triggered.

- **Security:**  
  - Each endpoint will be secured using a single API key stored server-side (clients do not see this).  
  - Additional authentication will be enforced at the load-balancer level, so no further client-side authentication is necessary.

## 3. Frontend Dashboard

### A. Layout & Panels

- **General Layout:**  
  A dashboard page divided into three separate panels:
  1. **Panel 1:** Assigned MRs that are “Too Old”
  2. **Panel 2:** Assigned MRs that have not been updated in 14 days
  3. **Panel 3:** MRs under review that have not been updated in 7 days

- **Data Display:**  
  Each panel will render a table with the columns:
  - Title
  - Author
  - Assignee (displayed as a list if multiple)
  - Reviewers (displayed as a list if multiple)
  - Direct URL (clickable link to the MR in GitLab)
  
  Above each panel, display the aggregated count of problematic MRs.

- **Sorting:**  
  - Default sort order should be by **author**.
  - Column headers in the table should be interactive (clickable) to enable client-side sorting on any column (title, creation date, last updated, author, etc.).

- **Pagination:**  
  - Use explicit pagination controls:
    - Display page numbers.
    - "Prev" and "Next" buttons.
    - Page size: 25 items per page.

### B. Global Refresh

- **Refresh Mechanism:**  
  - A single global refresh button is placed on the dashboard.
  - When clicked, it should trigger all three panels to re-fetch data from their respective API endpoints.
  - The refresh action should clear or bypass the cache on the backend.

### C. Styling & Responsiveness

- **Branding:**  
  - Use shadcdn's default components but apply SKA Observatory brand colors.
- **Responsiveness:**  
  - Ensure the UI is mobile-friendly and adjusts gracefully on desktop, tablet, and mobile screens.

### D. Error Handling in the UI

- **Inline Error Messages:**  
  - If an API call fails for a panel, display an error message inline within that panel.
  - Error messages should include both a concise description (e.g., "Error: Unable to fetch data.") and any available error details (error codes, message, etc.) so that technical users can troubleshoot without external support.

## 4. Testing Plan

### A. Backend/API Testing

- **Unit/Integration Tests:**  
  - Use **Supertest** to test each API endpoint.
  - Validate that each endpoint:
    - Returns the correct JSON schema.
    - Supports pagination via `page` and `per_page` query parameters.
    - Returns appropriate metadata (including `lastRefreshed` and `threshold`).
    - Implements caching (i.e., repeated calls within the TTL return cached data unless a refresh is triggered).
  - Test error scenarios (e.g., when GitLab API is unreachable).

### B. Frontend Testing

- **Component Testing:**  
  - Use **Jest** and **React Testing Library**.
  - Write tests to ensure:
    - The dashboard renders correctly with three panels.
    - The tables display correct columns and default sort order (by author).
    - Pagination controls render as expected and control the displayed data.
    - Interactive column headers correctly change sorting order.
    - Inline error messages display in a panel if API fetches fail.
    - The global refresh button triggers re-fetching data in all panels.

### C. CI/CD Pipeline

- **Integration with GitLab CI/CD:**
  - Configure the GitLab CI/CD pipeline to run:
    - Linting
    - Frontend tests (via Jest and React Testing Library)
    - Backend tests (via Supertest)
    - Build checks
  - Provide a README and instructions for local testing and pipeline integration.

## 5. Deployment

### A. Docker Configuration

- **Dockerfile:**  
  - Create a Dockerfile that:
    - Uses an official Node.js base image.
    - Installs dependencies.
    - Builds the Next.js application.
    - Exposes the necessary port for local development.
  - Include instructions on how to build and run the Docker container locally (e.g., using `docker build` and `docker run`).

### B. Environment Setup

- **Environment Variables:**  
  - Set the following variables in your deployment environment:
    - `GITLAB_API_TOKEN`
    - `GITLAB_USER_IDS` (colon-separated)
    - Any additional configuration required for caching and securing the API endpoints.
  - The API key for securing the custom endpoints should be managed securely within the Docker environment (and not exposed to the client).

## 6. Additional Considerations

- **Extensibility:**  
  - The architecture should allow for future improvements such as configurable thresholds, additional filtering options on the dashboard, or expansion of the testing logic.
  
- **Logging & Monitoring:**  
  - (Optional for MVP) Consider basic logging on both frontend and backend to record API request outcomes and errors.
  
- **Documentation:**  
  - Provide inline code docs, a comprehensive README, and deployment instructions.
  - Document how to run tests, build the Docker image, and deploy locally.
