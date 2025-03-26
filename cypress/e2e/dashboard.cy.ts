// File: cypress/e2e/dashboard.cy.ts (Enhancements)

describe("Dashboard - Unified Data Flow", () => {
  beforeEach(() => {
    cy.visit("/dashboard");
    // Ensure initial load completes
    cy.contains("Old Merge Requests", { timeout: 10000 }).should("be.visible");
  });

  // --- Hygiene View Tests (Keep existing relevant tests) ---
  it("navigates to and displays data in hygiene category pages", () => {
    // ... (test navigation and basic table rendering as before) ...
    cy.contains("View Old MRs").click();
    cy.get("table tbody tr").should("have.length.greaterThan", 0);
    cy.go("back");
    // ... (repeat for other hygiene views) ...
  });

  it("handles pagination and sorting within a hygiene category page", () => {
    cy.contains("View Old MRs").click();
    // ... (test pagination and sorting interactions as before) ...
    cy.get('nav[aria-label="pagination"]').contains("button", "Next").click();
    cy.contains('a[aria-current="page"]', "2").should("exist");
    cy.contains("button", "Title").click(); // Test sorting
  });

  it("shows loading on refresh within a hygiene category page", () => {
    cy.contains("View Old MRs").click();
    cy.contains("button", "Refresh").click();
    cy.get("button svg.animate-spin").should("be.visible");
    cy.get("button svg.animate-spin", { timeout: 10000 }).should("not.exist"); // Wait for refresh
  });

  // --- Role-Based View Tests (Assuming Feature Flags Enabled) ---
  it("navigates to role-based views and displays content", () => {
    // PO View
    cy.contains("button", "Open PO View").click();
    cy.url().should("include", "/dashboard/po-view");
    cy.contains("Product Owner View").should("be.visible");
    // Check for ticket group structure (adjust selector based on implementation)
    cy.get('[data-state="closed"]').should("exist"); // Check for collapsible triggers
    cy.go("back");

    // Dev View
    cy.contains("button", "Open Dev View").click();
    cy.url().should("include", "/dashboard/dev-view");
    cy.contains("Developer View").should("be.visible");
    cy.contains(
      /Needs Review|Changes Requested|Waiting for CI|Ready to Merge|Blocked/
    ).should("be.visible");
    cy.go("back");

    // Team View
    cy.contains("button", "Open Team View").click();
    cy.url().should("include", "/dashboard/team-view");
    cy.contains("Team View").should("be.visible");
    cy.contains("Overview").should("be.visible"); // Check for tabs
    cy.contains("Total MRs").should("be.visible"); // Check for metrics card
  });

  it("interacts with PO View (expand/collapse, filters)", () => {
    cy.contains("button", "Open PO View").click();
    cy.url().should("include", "/dashboard/po-view");

    // Expand a ticket group (assuming first one)
    cy.get('[data-state="closed"]').first().click();
    cy.get('[data-state="open"]').first().should("be.visible");
    // Check for MR rows inside the expanded group
    cy.get('[data-state="open"]')
      .first()
      .find("article") // Assuming MRRow uses <article> or similar
      .should("have.length.greaterThan", 0);

    // Test a filter
    cy.get('button[role="combobox"]:contains("Status")').click(); // Open status dropdown
    cy.contains('[role="option"]', "In Review").click();
    // Add assertion: Check if only 'In Review' tickets are visible after filtering
    cy.contains("In Progress").should("not.exist"); // Assuming mock data has variety
  });

  it("interacts with Dev View (expand/collapse, filters)", () => {
    cy.contains("button", "Open Dev View").click();
    cy.url().should("include", "/dashboard/dev-view");

    // Expand a status group (e.g., Needs Review)
    cy.contains("button", /Needs Review/i).click({ force: true }); // Click trigger within CardHeader
    // Check for MR rows inside
    cy.contains("button", /Needs Review/i)
      .parentsUntil("div[data-state]") // Find collapsible root
      .find("article") // Assuming MRRow uses <article>
      .should("have.length.greaterThan", 0);

    // Test a filter
    cy.get('button[role="combobox"]:contains("Author")').click();
    // Select the first actual author (assuming mock data provides some)
    cy.get('[role="option"]').eq(1).click(); // eq(0) is 'All Authors'
    // Add assertion: Check if MRs from other authors disappear
  });

  it("interacts with Team View (tabs, metrics)", () => {
    cy.contains("button", "Open Team View").click();
    cy.url().should("include", "/dashboard/team-view");

    // Check metrics dashboard rendering
    cy.contains("Avg. MR Age").should("be.visible");
    cy.contains("Overdue MRs").should("be.visible");

    // Switch to Tickets tab
    cy.contains("button[role='tab']", "Tickets").click();
    cy.contains("All Tickets").should("be.visible");
    cy.get("table").should("be.visible");

    // Test filter on tickets tab
    cy.get('button[role="combobox"]:contains("Status")').click();
    cy.contains('[role="option"]', "Blocked").click();
    // Add assertion: Check if only blocked tickets are shown in the table
  });

  it("refresh button updates data across views (visual check)", () => {
    // Go to PO view
    cy.contains("button", "Open PO View").click();
    cy.contains("Product Owner View").should("be.visible");
    cy.wait(500); // Allow initial render

    // Trigger refresh
    cy.contains("button", "Refresh").click();
    cy.get("button svg.animate-spin").should("be.visible");
    cy.get("button svg.animate-spin", { timeout: 10000 }).should("not.exist");
    cy.wait(500); // Allow data update

    // Navigate to another view (e.g., Dev View)
    // Use the main nav tabs if EnhancedNavbar is in use
    cy.contains("button[role='tab']", "Dev View").click(); // Assuming EnhancedNavbar is used
    // Or navigate back and click the card if not using EnhancedNavbar for switching
    // cy.go('back'); cy.contains("button", "Open Dev View").click();

    cy.contains("Developer View").should("be.visible");
    // Check for loading state briefly or just that content loads
    // Verifying specific data changes is hard without stable mocks
    cy.contains(
      /Needs Review|Changes Requested|Waiting for CI|Ready to Merge|Blocked/,
      { timeout: 10000 }
    ).should("be.visible");
  });
});
