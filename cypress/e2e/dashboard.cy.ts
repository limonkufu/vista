describe('Dashboard', () => {
  beforeEach(() => {
    cy.visit('/dashboard');
  });

  it('displays all three MR tables', () => {
    cy.findByText('Old Merge Requests').should('be.visible');
    cy.findByText('Inactive Merge Requests').should('be.visible');
    cy.findByText('Pending Review').should('be.visible');
  });

  it('handles pagination in each table', () => {
    // Test Old MRs pagination
    cy.findByText('Old Merge Requests')
      .parent()
      .within(() => {
        cy.findByRole('button', { name: /next/i }).click();
        cy.findByRole('button', { name: /2/i }).should('have.attr', 'aria-current', 'page');
      });

    // Test Inactive MRs pagination
    cy.findByText('Inactive Merge Requests')
      .parent()
      .within(() => {
        cy.findByRole('button', { name: /next/i }).click();
        cy.findByRole('button', { name: /2/i }).should('have.attr', 'aria-current', 'page');
      });

    // Test Pending Review pagination
    cy.findByText('Pending Review')
      .parent()
      .within(() => {
        cy.findByRole('button', { name: /next/i }).click();
        cy.findByRole('button', { name: /2/i }).should('have.attr', 'aria-current', 'page');
      });
  });

  it('handles sorting in each table', () => {
    // Test sorting in Old MRs table
    cy.findByText('Old Merge Requests')
      .parent()
      .within(() => {
        cy.findByRole('button', { name: /title/i }).click();
        // Verify sort order changed
        cy.findAllByRole('row').eq(1).should('contain.text', 'Mock MR');
      });
  });

  it('shows loading states during refresh', () => {
    cy.findByRole('button', { name: /refresh all/i }).click();
    cy.findByRole('status').should('exist');
  });

  it('handles errors gracefully', () => {
    // Simulate network error by disabling network access
    cy.intercept('/api/mrs/*', { forceNetworkError: true });
    cy.findByRole('button', { name: /refresh all/i }).click();
    cy.findByText(/error/i).should('be.visible');
  });

  it('maintains responsive layout on mobile viewport', () => {
    cy.viewport('iphone-x');
    cy.findByText('Old Merge Requests').should('be.visible');
    cy.findByText('Inactive Merge Requests').should('be.visible');
    cy.findByText('Pending Review').should('be.visible');
  });
}); 