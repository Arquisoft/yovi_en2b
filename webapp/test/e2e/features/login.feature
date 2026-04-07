Feature: User Login
  As a registered user
  I want to log in to my account
  So that I can access the platform

  Scenario: Successfully log in with valid credentials
    Given a test user account exists
    And I am on the login page
    When I fill in the login form with the test user credentials
    And I submit the login form
    Then I should be on the games page
