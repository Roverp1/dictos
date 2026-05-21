# Dictos 

Dictos is a local-first text processing application built to help language learners turn raw text from e-books and articles into structured study material. It provides a keyboard-driven Terminal User Interface (TUI) for fast capture and uses the Gemini API to automatically generate definitions.

*Note: This is currently a work-in-progress basic TUI version, built as a foundation to test the core logic. Future versions will include mobile and web interfaces, as well as browser extensions for easier text capturing.*

## Features

- **Local-First Architecture:** All data is stored locally in a libSQL database.
- **Fast Terminal UI:** Keyboard-driven interface for efficient navigation and editing.
- **AI-Powered Definitions:** Integrates with Google's Gemini API to automatically define captured terms.
- **Anki Export:** Ready to export your captures to spaced-repetition tools like Anki.
- **Prompt Management:** Save and reuse custom prompts for different types of text.

## Tech Stack

- **Runtime:** Bun
- **Backend:** ElysiaJS
- **Frontend:** OpenTUI (React-based Terminal UI)
- **Database:** libSQL (SQLite)
- **Architecture:** Hexagonal Architecture

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/)
- Docker & Docker Compose (optional, for running the backend)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dictos
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

### Running the App

You can run the different parts of the application using Bun:

- **Terminal UI:**
  ```bash
  bun run dev:tui
  ```

- **Backend Server (Local):**
  ```bash
  bun run dev:server
  ```

- **Backend Server (Docker):**
  ```bash
  docker-compose up --build
  ```

## Project Structure

Dictos is structured as a monorepo using Bun workspaces:

- `apps/server/`: The ElysiaJS backend API.
- `apps/tui/`: The React-based Terminal User Interface.
- `packages/core/`: The core business logic and domain models.
- `packages/adapters/`: External integrations (libSQL, Gemini).
- `docs/report/`: The LaTeX and Typst project documentation.
