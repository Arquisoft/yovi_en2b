Feature: Game Creation
  As a logged-in user
  I want to create a new game
  So that I can start playing

  Scenario: Create a PvE game and see the game board
    Given a test user account exists
    And I am logged in as the test user
    When I click "Play Now" on Game Y
    And I select "vs Computer" mode
    And I click "Start Game"
    Then I should see the game board
