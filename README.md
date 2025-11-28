# API Blue Team

Backend API for the Blue Team project, built with Fastify, TypeScript, and Prisma.

## Tech Stack

- **Framework:** Fastify
- **Language:** TypeScript
- **ORM:** Prisma
- **Validation:** Zod
- **Authentication:** JWT, bcrypt
- **File Uploads:** Cloudinary

## Prerequisites

- Node.js (v18+ recommended)
- PostgreSQL

## Environment Variables

Create a `.env` file in the root directory with the following variables:


## Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd api-blue-7eam
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Generate Prisma client:
   ```bash
   npx prisma generate
   ```

## Scripts

- `npm run dev`: Starts the development server with hot reload.
- `npm run build`: Compiles TypeScript to JavaScript.
- `npm start`: Starts the production server (requires build).
- `npm test`: Runs tests (currently not implemented).

## Project Structure

- `src/`: Source code
  - `routes/`: API route definitions
  - `middlewares/`: Custom middlewares (auth, etc.)
  - `hooks/`: Fastify hooks
- `prisma/`: Prisma schema and migrations
