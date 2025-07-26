# Instagram Comment Bot

## Overview

This is a full-stack Instagram comment automation application built with React (frontend), Express.js (backend), and PostgreSQL database. The system searches Instagram by keywords (focused on job hunting in Russia), scrapes content, analyzes relevance using OpenAI, generates contextual comments for advertising an auto-response service, and can automatically post them. It includes a real-time dashboard for monitoring the scraping process and managing video approvals with confirmation modals.

## User Preferences

Preferred communication style: Simple, everyday language.
Interface language: Russian
Focus area: Job hunting in Russia
Target service: Automatic response service for job applications

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for development and bundling
- **UI Library**: shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with custom design tokens
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Real-time**: WebSocket integration for live updates

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database ORM**: Drizzle ORM with PostgreSQL
- **Web Scraping**: Puppeteer for browser automation
- **AI Integration**: OpenAI API for content analysis and comment generation
- **Real-time**: WebSocket server for live client updates
- **Session Management**: In-memory storage with interface for easy database migration

## Key Components

### Database Schema
- **Videos**: Stores scraped Instagram content with metadata, analysis results, and status tracking
- **Scraping Sessions**: Manages bulk scraping operations with search query-based sessions and progress tracking
- **System Prompts**: Configurable AI prompts for analysis and comment generation (Russian language, job hunting focus)
- **Chrome Connection**: Tracks browser connection status for scraping

### Core Services
1. **Instagram Scraper**: Puppeteer-based service with Chrome debugging port connection for search-based scraping
2. **OpenAI Service**: Handles content analysis and comment generation using GPT-4o (specialized for job hunting content in Russian)
3. **Human Behavior Service**: Implements realistic delays and interactions to avoid detection during scraping and commenting
4. **Storage Service**: Abstract interface supporting both in-memory and database persistence

### Frontend Components
- **Dashboard**: Main interface showing video queue and session management
- **Sidebar**: Controls for starting scraping sessions and configuring AI prompts
- **Video Cards**: Individual video displays with approval/rejection controls
- **Connection Status**: Chrome browser connection monitoring
- **Confirmation Modal**: Safety check before posting comments

## Data Flow

1. **Search-Based Scraping**: User enters search query (job hunting keywords) → Chrome connects → Puppeteer searches Instagram → Content scraped and stored
2. **Analysis Pipeline**: Content queued → OpenAI analyzes relevance to job hunting → Generates advertising comments → Awaits manual approval
3. **Posting Flow**: User approves video → Confirmation modal → Human behavior emulation → Automated posting to Instagram  
4. **Real-time Updates**: WebSocket broadcasts status changes, progress, and results to all connected clients

## External Dependencies

### Required Services
- **OpenAI API**: GPT-4o model for content analysis and comment generation
- **Chrome Browser**: Must be launched with `--remote-debugging-port=9222` for scraping
- **PostgreSQL Database**: Primary data storage (configurable via DATABASE_URL)
- **Neon Database**: Serverless PostgreSQL provider integration

### Key Libraries
- **AI/ML**: OpenAI SDK, Drizzle-Zod for schema validation
- **UI/UX**: Radix UI primitives, Tailwind CSS, Lucide icons
- **Data Fetching**: TanStack Query, native fetch API
- **Browser Automation**: Puppeteer for Instagram scraping
- **Real-time**: Native WebSocket implementation

## Deployment Strategy

### Development Setup
- Vite dev server with HMR for frontend development
- tsx for TypeScript execution in development
- Automatic database migrations with `drizzle-kit push`
- Chrome debugging connection required for scraping functionality

### Production Build
- Frontend: Vite builds optimized static assets
- Backend: esbuild bundles server code for Node.js execution
- Database: Drizzle migrations handle schema updates
- Environment variables: OpenAI API key, database URL, Chrome port configuration

### Environment Configuration
- `NODE_ENV`: Development/production mode switching
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: Required for AI functionality
- Chrome must be manually started with debugging enabled

The application uses a monorepo structure with shared TypeScript schemas and careful separation between client and server code while maintaining type safety throughout the stack.