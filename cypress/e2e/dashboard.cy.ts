// File: cypress/e2e/dashboard.cy.ts

describe("Dashboard E2E Tests", () => {
  beforeEach(() => {
    // Optional: Intercept API calls if needed for stability
    // cy.intercept('GET', '/api/users*').as('getUsers');
    // cy.intercept('GET', '/api/mrs/*').as('getMRs');
    // cy.intercept('GET', '/api/jira*').as('getJira');

    cy.visit("/dashboard");
    // Wait for initial dashboard elements to be visible
    cy.contains("h1", "Vibe Into Software Tasks & Activities", {
      timeout: 15000,
    }).should("be.visible");
    // Wait for the hygiene cards to appear
    cy.contains("h3", "Old Merge Requests", { timeout: 15000 }).should(
      "be.visible"
    );
  });

  // --- Hygiene View Navigation ---
  it("navigates to hygiene category pages and displays tables", () => {
    // Old MRs
    cy.contains("a", "View Old MRs").click();
    cy.url().should("include", "/dashboard/too-old");
    cy.contains("h1", "Old Merge Requests").should("be.visible");
    cy.get("table tbody tr", { timeout: 15000 }).should(
      "have.length.greaterThan",
      0
    ); // Wait for rows
    cy.go("back"); // Use EnhancedNavbar or main page links if available

    // Inactive MRs
    cy.contains("a", "View Inactive MRs").click();
    cy.url().should("include", "/dashboard/not-updated");
    cy.contains("h1", "Inactive Merge Requests").should("be.visible");
    cy.get("table tbody tr", { timeout: 15000 }).should(
      "have.length.greaterThan",
      0
    );
    cy.go("back");

    // Pending Review
    cy.contains("a", "View Pending Reviews").click();
    cy.url().should("include", "/dashboard/pending-review");
    cy.contains("h1", "Pending Review").should("be.visible");
    cy.get("table tbody tr", { timeout: 15000 }).should(
      "have.length.greaterThan",
      0
    );
  });

  it("handles pagination and sorting within a hygiene category page", () => {
    cy.contains("a", "View Old MRs").click();
    cy.url().should("include", "/dashboard/too-old");
    cy.contains("h1", "Old Merge Requests").should("be.visible");
    cy.get("table tbody tr", { timeout: 15000 }).should("exist"); // Wait for table

    // Pagination (assuming more than one page exists in test data)
    cy.get('nav[aria-label="pagination"]')
      .contains("button", "Next")
      .should("be.visible")
      .click();
    // Check if page indicator updates (use a more specific selector if possible)
    cy.get('nav[aria-label="pagination"]')
      .find('[aria-current="page"]')
      .should("contain.text", "2");

    // Sorting
    cy.contains("button", "Title").should("be.visible").click();
    // Add assertion here: Check if the first row's title changes as expected after sort
    // This requires knowing the test data. Example:
    // cy.get('table tbody tr').first().should('contain.text', 'Expected First Title After Sort');
    cy.contains("button", "Title").click(); // Sort descending
    // cy.get('table tbody tr').first().should('contain.text', 'Expected First Title After Desc Sort');
  });

  // --- Role-Based View Tests (Assuming Feature Flags Enabled) ---

  it("navigates between different views using EnhancedNavbar", () => {
    // Assuming EnhancedNavbar is present and features are enabled
    // PO View
    cy.contains("button", "PO View").should("be.visible").click();
    cy.url().should("include", "/dashboard/po-view");
    cy.contains("h1", "Product Owner View").should("be.visible");

    // Dev View
    cy.contains("button", "Dev View").should("be.visible").click();
    cy.url().should("include", "/dashboard/dev-view");
    cy.contains("h1", "Developer View").should("be.visible");

    // Team View
    cy.contains("button", "Team View").should("be.visible").click();
    cy.url().should("include", "/dashboard/team-view");
    cy.contains("h1", "Team View").should("be.visible");

    // Hygiene View (via Dropdown)
    cy.contains("button", /Hygiene/i)
      .should("be.visible")
      .click(); // Open dropdown
    cy.contains("a", "Old MRs").should("be.visible").click({ force: true }); // Use force if needed for dropdown items
    cy.url().should("include", "/dashboard/too-old");
    cy.contains("h1", "Old Merge Requests").should("be.visible");
  });

  it("interacts with PO View (expand/collapse, filters)", () => {
    cy.contains("button", "PO View").click();
    cy.url().should("include", "/dashboard/po-view");
    cy.contains("h1", "Product Owner View").should("be.visible");

    // Wait for ticket groups to load
    cy.get('div[data-state="closed"]', { timeout: 15000 }).should("exist");

    // Expand the first ticket group
    cy.get('div[data-state="closed"]').first().click();
    cy.get('div[data-state="open"]')
      .first()
      .should("be.visible")
      .within(() => {
        // Check for MR rows inside the expanded group
        cy.get("article").should("have.length.greaterThan", 0); // Assuming MRRow uses <article>
        cy.contains(/MR for PROJ-/i).should("be.visible");
      });

    // Test a filter (Status)
    cy.get('button[role="combobox"]:contains("Status")').click();
    cy.contains('[role="option"]', "In Review").click();
    // Assert filtering effect (requires specific test data)
    cy.contains("div", "PROJ-", { timeout: 10000 }).should("exist"); // Wait for potential re-render
    cy.get("body").then(($body) => {
      // Check if unwanted statuses are GONE
      if ($body.find(':contains("In Progress")').length > 0) {
        cy.contains("div", "In Progress").should("not.exist");
      }
      if ($body.find(':contains("Done")').length > 0) {
        cy.contains("div", "Done").should("not.exist");
      }
      // Ensure the desired status IS present
      cy.contains("div", "In Review").should("exist");
    });

    // Clear filter
    cy.get('button[role="combobox"]:contains("Status")').click();
    cy.contains('[role="option"]', "All Statuses").click();
    cy.contains("div", "In Progress", { timeout: 10000 }).should("be.visible"); // Check if it reappears
  });

  it("interacts with Dev View (expand/collapse, filters)", () => {
    cy.contains("button", "Dev View").click();
    cy.url().should("include", "/dashboard/dev-view");
    cy.contains("h1", "Developer View").should("be.visible");

    // Wait for status groups to load
    cy.contains("div", /Needs Review/i, { timeout: 15000 }).should(
      "be.visible"
    );

    // Expand a status group (e.g., Needs Review)
    // Use a more specific selector for the trigger if possible
    cy.contains("div", /Needs Review \(\d+ MRs?\)/i)
      .first() // Target the specific group header/trigger
      .click();

    // Check for MR rows inside the now open group
    cy.get('div[data-state="open"]')
      .first() // Assuming the clicked group is now the first open one
      .within(() => {
        cy.get("article").should("have.length.greaterThan", 0); // Assuming MRRow uses <article>
      });

    // Test a filter (Author)
    cy.get('button[role="combobox"]:contains("Author")').click();
    // Select the first actual author (more robust than eq(1))
    cy.get('[role="option"]')
      .contains(/^(?!All Authors)/) // Regex to select first option that isn't "All Authors"
      .first()
      .click();
    // Add assertion: Check if MRs from other authors disappear (needs specific data)
    // cy.contains('article', 'MR Title by Other Author').should('not.exist');
  });

  it("interacts with Team View (tabs, metrics, table)", () => {
    cy.contains("button", "Team View").click();
    cy.url().should("include", "/dashboard/team-view");
    cy.contains("h1", "Team View").should("be.visible");

    // Check metrics dashboard rendering
    cy.contains("div", "Avg. MR Age", { timeout: 15000 }).should("be.visible");
    cy.contains("div", "Overdue MRs").should("be.visible");
    cy.contains("div", "Blocked Tickets").should("be.visible");

    // Switch to Tickets tab
    cy.contains("button[role='tab']", "Tickets").click();
    cy.contains("h2", "All Tickets").should("be.visible");
    cy.get("table", { timeout: 15000 }).should("be.visible");
    cy.get("table tbody tr").should("have.length.greaterThan", 0);

    // Test filter on tickets tab
    cy.get('button[role="combobox"]:contains("Status")').click();
    cy.contains('[role="option"]', "Blocked").click();
    // Add assertion: Check if only blocked tickets are shown (needs specific data)
    // cy.get('table tbody tr').should('have.length', 1); // If only 1 blocked ticket
    // cy.get('table tbody tr').first().should('contain.text', 'Blocked');
  });

  it("refresh button updates data across views", () => {
    // Go to PO view
    cy.contains("button", "PO View").click();
    cy.contains("h1", "Product Owner View", { timeout: 15000 }).should(
      "be.visible"
    );
    // cy.wait('@getJira'); // Wait for initial load if using intercept

    // Trigger refresh
    cy.contains("button", "Refresh").click();
    cy.get("button svg.animate-spin").should("be.visible");
    // cy.wait('@getJira'); // Wait for refresh intercept
    cy.get("button svg.animate-spin", { timeout: 15000 }).should("not.exist"); // Wait for refresh to complete

    // Navigate to another view (e.g., Dev View)
    cy.contains("button", "Dev View").click();
    cy.contains("h1", "Developer View", { timeout: 15000 }).should(
      "be.visible"
    );
    // cy.wait('@getMRs'); // Wait for Dev view data if using intercept

    // Basic check that content loads after refresh + navigation
    cy.contains("div", /Needs Review/i, { timeout: 15000 }).should(
      "be.visible"
    );
  });
});
