# Assessment-Platform

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
- **AWS Chalice** for audio service API
- **AWS S3** for audio file storage

### Storage
- **IndexedDB** for local data persistence
- **PostgreSQL** (via Neon Database) for production data
- **AWS S3** for audio recordings

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
# Edit .env with your database credentials and API endpoints
```

Required environment variables:
```bash
# Main API endpoint
VITE_API_BASE_URL=your-api-base-url

# Proctoring results API endpoint (for behavior monitoring)
VITE_PROCTORING_RESULTS_API=https://fizwdomhnwwc7avz3nufla3m5a0jhqvu.lambda-url.us-west-2.on.aws/results

# Audio service
export S3_BUCKET=your-audio-bucket-name
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

### Frontend & Backend
- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run check` - Type check with TypeScript
- `npm run db:push` - Push database schema changes

### Audio Service (Sparrow-assessments/)
- `chalice local` - Run audio service locally
- `chalice deploy` - Deploy audio service to AWS
- `pip install -r requirements.txt` - Install Python dependencies

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
├── Sparrow-assessments/    # AWS Chalice audio service
│   ├── app.py             # Chalice application
│   ├── api_doc.md         # API documentation
│   └── requirements.txt   # Python dependencies
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
- **Cloud Audio Storage**: Secure S3 storage with presigned URLs
- **Audio Service API**: Scalable AWS Chalice-based audio management

## Audio Service

The application includes a separate AWS Chalice-based audio service for handling audio file operations:

### Features
- **Secure Audio Upload**: Presigned S3 URLs for direct browser uploads
- **Organized Storage**: Files organized by user ID and assessment round
- **Multiple Formats**: Support for WebM, MP3, WAV, and M4A files
- **Efficient Operations**: Direct S3 access with minimal API overhead

### API Endpoints
- `POST /audio/upload` - Generate upload URL
- `GET /audio/{id}` - Get audio file info
- `GET /audio/{id}/download` - Get download URL
- `DELETE /audio/{id}` - Delete audio file
- `GET /audio/list` - List user's audio files
- `GET /health` - Service health check

### Storage Structure
```
S3 Bucket/
└── {user_id}/
    └── {round_id}/
        ├── {audio_id}.webm
        ├── {audio_id}.mp3
        └── {audio_id}.wav
```

### Setup
1. Navigate to `Sparrow-assessments/`
2. Install dependencies: `pip install -r requirements.txt`
3. Set environment: `export S3_BUCKET=your-bucket-name`
4. Deploy: `chalice deploy`

For detailed API documentation, see `Sparrow-assessments/api_doc.md`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details # Sparrow-Interviews
# Sparrow-Interviews
