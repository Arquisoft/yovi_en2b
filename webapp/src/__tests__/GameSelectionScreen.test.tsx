import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import GameSelectionScreen from "../components/GameSelectionScreen";

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const renderComponent = (props = {}) =>
  render(
    <MemoryRouter>
      <GameSelectionScreen {...props} />
    </MemoryRouter>
  );

describe("GameSelectionScreen", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
  });


  describe("Rendering", () => {
    it("renders the YOVI logo", () => {
      renderComponent();
      expect(screen.getByText("YOVI")).toBeInTheDocument();
    });

    it("renders the 'Select a Game' heading", () => {
      renderComponent();
      expect(
        screen.getByRole("heading", { name: /select a game/i })
      ).toBeInTheDocument();
    });

    it("renders the Play Now button", () => {
      renderComponent();
      expect(
        screen.getByRole("button", { name: /play now/i })
      ).toBeInTheDocument();
    });

    it("renders the Back to Login button", () => {
      renderComponent();
      expect(
        screen.getByRole("button", { name: /back to login/i })
      ).toBeInTheDocument();
    });

    it("renders a game card for 'Game Y'", () => {
      renderComponent();
      expect(screen.getByText("Game Y")).toBeInTheDocument();
    });

    it("renders the game description", () => {
      renderComponent();
      expect(
        screen.getByText(/strategic tile-based game/i)
      ).toBeInTheDocument();
    });

    it("shows Game Y as selected by default (aria-pressed=true)", () => {
      renderComponent();
      const card = screen.getByRole("button", { name: /game y/i });
      expect(card).toHaveAttribute("aria-pressed", "true");
    });

    it("renders the preview image for the selected game", () => {
      renderComponent();
      const previewImg = screen.getAllByAltText("Game Y")[0];
      expect(previewImg).toBeInTheDocument();
      expect(previewImg).toHaveAttribute("src", "/GameY-Image.jpeg");
    });

    it("renders the check icon for the selected game", () => {
      renderComponent();
      const activeCard = screen.getByRole("button", { name: /game y/i });
      expect(activeCard.querySelector("svg")).toBeInTheDocument();
    });
  });


  describe("Interaction", () => {
    it("clicking a game card marks it as selected (aria-pressed)", () => {
      renderComponent();
      const card = screen.getByRole("button", { name: /game y/i });
      fireEvent.click(card);
      expect(card).toHaveAttribute("aria-pressed", "true");
    });

    it("clicking Play Now navigates to /gamey", () => {
      renderComponent();
      fireEvent.click(screen.getByRole("button", { name: /play now/i }));
      expect(mockNavigate).toHaveBeenCalledWith("/gamey");
    });

    it("clicking Back to Login navigates to /", () => {
      renderComponent();
      fireEvent.click(screen.getByRole("button", { name: /back to login/i }));
      expect(mockNavigate).toHaveBeenCalledWith("/");
    });

    it("calls onSelectGame prop with the selected game id when Play Now is clicked", () => {
      const onSelectGame = vi.fn();
      renderComponent({ onSelectGame });
      fireEvent.click(screen.getByRole("button", { name: /play now/i }));
      expect(onSelectGame).toHaveBeenCalledWith("gamey");
    });

    it("calls onBack prop when Back to Login is clicked", () => {
      const onBack = vi.fn();
      renderComponent({ onBack });
      fireEvent.click(screen.getByRole("button", { name: /back to login/i }));
      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it("does not throw when onSelectGame prop is not provided", () => {
      renderComponent();
      expect(() =>
        fireEvent.click(screen.getByRole("button", { name: /play now/i }))
      ).not.toThrow();
    });

    it("does not throw when onBack prop is not provided", () => {
      renderComponent();
      expect(() =>
        fireEvent.click(screen.getByRole("button", { name: /back to login/i }))
      ).not.toThrow();
    });
  });


  describe("Active class", () => {
    it("applies --active modifier class to the selected game card", () => {
      renderComponent();
      const card = screen.getByRole("button", { name: /game y/i });
      expect(card).toHaveClass("selection-game-card--active");
    });
  });
});