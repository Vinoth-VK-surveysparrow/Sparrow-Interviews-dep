# Assessment Platform

## Overview

This is a React-based professional interview assessment platform that allows users to take timed assessments while being monitored through camera, microphone, and speech recognition. The application follows the flow: Dashboard → Rules → Assessment → Results, with continuous real-time recording and monitoring throughout the entire assessment session.

## Features

✓ **Continuous Recording Architecture**: Single continuous session recording
✓ **Single-Page Assessment**: All questions handled within one component to prevent audio interruption  
✓ **Auto-capture**: Images captured automatically every 5 seconds with proper video validation
✓ **Progressive Audio Saving**: Audio saved to IndexedDB every 10 seconds to prevent data loss
✓ **Enhanced Dashboard**: Modern card design with intuitive navigation
✓ **Complete Data Persistence**: Audio, images, and transcripts properly saved to IndexedDB
✓ **Strict 60-Second Timer**: Enforced exactly 60 seconds per question with automatic progression
✓ **Responsive Design**: Clean, modern UI with light/dark mode support

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Wouter** for routing
- **TanStack React Query** for state management

### Backend
- **Express.js** with TypeScript
- **Drizzle ORM** with PostgreSQL
- **Zod** for validation

### Storage
- **IndexedDB** for local data persistence
- **PostgreSQL** (via Neon Database) for production data

## Getting Started

### Prerequisites
- Node.js 18 or higher
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd Sparrow-Interviews
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your database credentials
```

4. Push database schema:
```bash
npm run db:push
```

5. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check with TypeScript
- `npm run db:push` - Push database schema changes

## Project Structure

```
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── contexts/       # React context providers
│   │   └── lib/            # Utility libraries
├── server/                 # Backend Express server
├── shared/                 # Shared types and schemas
└── attached_assets/        # Static assets
```

## Assessment Flow

1. **Dashboard** - Overview and assessment selection
2. **Rules** - Assessment guidelines and requirements
3. **Assessment** - Timed questions with continuous monitoring
4. **Results** - Review completed assessment data

## Media Features

- **Audio Recording**: Continuous recording throughout the assessment
- **Camera Monitoring**: Real-time video feed with automatic image capture
- **Speech Recognition**: Live transcription of spoken responses
- **Permission Management**: Handles camera and microphone permissions

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details # Sparrow-Interviews
