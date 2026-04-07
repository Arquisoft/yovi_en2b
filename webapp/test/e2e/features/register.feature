Feature: User Registration
  As a new visitor
  I want to create an account
  So that I can start playing

  Scenario: Successfully register a new user
    Given I am on the registration page
    When I fill in the registration form with valid data
    And I submit the registration form
    Then I should see the account created message
