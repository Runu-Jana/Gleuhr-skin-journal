# Gleuhr Skin Journal PWA

A full-stack patient-facing Progressive Web App for tracking a 90-day skin transformation journey. Built with React (frontend) and Node.js/Express (backend), integrated with Airtable using Personal Access Token (PAT) for data storage.

## Features

### 8 Screens
1. **Welcome/Onboarding** - 3-step carousel with 90-day commitment
2. **Home/Daily Check-in** - Streaks, progress ring, routine toggles, diet tracking, skin mood
3. **My Journey** - Visual timeline from Day 1 to Day 90 with milestones
4. **Skin Score Assessment** - 10 questions (0-2 scale) at Days 1, 28, 56, 84
5. **Weekly Photo** - Camera capture with before/after comparison
6. **Profile** - Patient info, products, coach WhatsApp link
7. **Reorder Banner** - Day 25+ product reorder prompt
8. **Gleuhr Insider** - Day 42+ loyalty program for high consistency patients

### Technical Features
- **Offline Support** - IndexedDB for local storage, auto-sync when online
- **PWA** - Installable app with service worker
- **Responsive** - Mobile-first design with Tailwind CSS
- **Airtable Integration** - PAT-based API for data persistence

## Tech Stack

### Frontend
- React 18
- React Router DOM
- Framer Motion (animations)
- Lucide React (icons)
- Tailwind CSS
- IndexedDB (via idb library)

### Backend
- Node.js
- Express
- Airtable JavaScript SDK
- CORS
- Express Rate Limit

## Project Structure

```
gleuhr-app/
├── server/                      # Backend
│   ├── config/
│   │   └── airtable.js         # Airtable PAT configuration
│   ├── routes/
│   │   ├── auth.js             # Token validation
│   │   ├── checkin.js          # Daily check-ins
│   │   ├── skinscore.js        # Skin score assessments
│   │   ├── photo.js            # Weekly photos
│   │   ├── streak.js           # Streak data
│   │   ├── reorder.js          # Reorder tracking
│   │   └── patient.js          # Profile & commitment
│   └── index.js                # Express server entry
│
├── client/                      # Frontend (React)
│   ├── public/
│   │   ├── manifest.json       # PWA manifest
│   │   ├── service-worker.js   # Service worker
│   │   └── index.html
│   ├── src/
│   │   ├── components/         # All 8 screens + UI components
│   │   ├── contexts/           # Auth & Offline contexts
│   │   ├── utils/              # IndexedDB & helpers
│   │   ├── App.js              # Main app
│   │   └── index.js            # React entry
│   ├── tailwind.config.js
│   └── package.json
│
├── .env.example                # Environment variables template
├── package.json                # Root package.json
└── README.md                   # This file
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Airtable account with Personal Access Token (PAT)

### 1. Clone and Install

```bash
cd gleuhr-app

# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 2. Configure Airtable PAT

1. Go to [Airtable Developer Hub](https://airtable.com/create/tokens)
2. Create a new Personal Access Token (PAT)
3. Add these scopes:
   - `data.records:read`
   - `data.records:write`
   - `schema.bases:read`
4. Add your base to the token's access
5. Copy the token

### 3. Environment Variables

Create `.env` file in the root:

```env
# Server
NODE_ENV=development
PORT=5000

# Airtable PAT (required)
AIRTABLE_PAT=patXXXXXXXXXXXXXX
AIRTABLE_BASE_ID=appXXXXXXXXXXXXXX

# Optional
JWT_SECRET=your_secret_here
CLIENT_URL=http://localhost:3000
```

### 4. Airtable Base Schema

Create these tables in your Airtable base:

**Patients**
- Full Name (Single line text)
- Email (Email)
- Skin Concern (Single line text)
- Plan Type (Single select)
- Start Date (Date)
- Coach Name (Single line text)
- Coach WhatsApp (Phone number)
- Has Committed (Checkbox)
- Journal Token (Single line text)
- Diet Plan (Link to Diet Plans)

**Journal Check-ins**
- Patient Email (Email)
- Date (Date)
- Day (Number)
- AM Routine (Checkbox)
- PM Routine (Checkbox)
- Sunscreen (Checkbox)
- Diet Followed (Single select: Yes/Mostly/No)
- Trigger Foods (Long text)
- Water Intake (Number 1-4)
- Skin Mood (Single select: Good/Okay/Off)
- Notes (Long text)

**Skin Scores**
- Patient Email (Email)
- Date (Date)
- Day (Number)
- Texture (Number 0-2)
- Pigmentation (Number 0-2)
- Brightness (Number 0-2)
- Breakouts (Number 0-2)
- Confidence (Number 0-2)
- Hydration (Number 0-2)
- Smoothness (Number 0-2)
- Evenness (Number 0-2)
- Firmness (Number 0-2)
- Glow (Number 0-2)
- Total Score (Formula: sum of all scores)
- Photo URL (URL)

**Weekly Photos**
- Patient Email (Email)
- Week (Number)
- Date (Date)
- Photo URL (URL)
- Consent Given (Checkbox)

**Streaks**
- Patient Email (Email)
- Current Streak (Number)
- Last Check-in Date (Date)
- Day (Number)

**Reorder Events**
- Patient ID (Single line text)
- Patient Email (Email)
- Day (Number)
- Timestamp (Date)
- Event Type (Single line text)

**Products**
- Product Name (Single line text)
- Category (Single select: AM/PM/Both)
- Instructions (Long text)
- Patient (Link to Patients)

**Diet Plans**
- Version (Single line text)
- Category (Single line text)
- Restrictions (Long text, comma-separated)
- Recommendations (Long text, comma-separated)

### 5. Run the Application

```bash
# Development mode (runs both client and server)
npm run dev

# Or run separately:
npm run server    # Backend on http://localhost:5000
npm run client    # Frontend on http://localhost:3000
```

### 6. Build for Production

```bash
# Build React app
cd client
npm run build

# Deploy server
# Copy client/build to your web server
# Set NODE_ENV=production
# Start with: npm start
```

## API Routes

| Route | Method | Description |
|-------|--------|-------------|
| `/api/auth/token` | POST | Validate journal token, return patient data |
| `/api/checkin` | POST | Save daily check-in |
| `/api/checkin/:email` | GET | Get check-ins for patient |
| `/api/skinscore` | POST | Save skin score assessment |
| `/api/skinscore/:email` | GET | Get skin scores |
| `/api/photo` | POST | Upload weekly photo |
| `/api/photo/:email` | GET | Get weekly photos |
| `/api/streak/:email` | GET | Fetch current streak |
| `/api/reorder/click` | POST | Log banner click event |
| `/api/patient/profile/:email` | GET | Fetch profile |
| `/api/patient/commitment/:email` | PATCH | Update commitment status |
| `/api/health` | GET | Health check |

## Offline Support

The app works offline using:
- **IndexedDB** for local data storage
- **Service Worker** for caching static assets
- **Sync Queue** - Pending submissions queue when offline
- **Auto-sync** - Automatically syncs when connection restored

## PWA Features

- **Install Prompt** - Shows on 3rd visit
- **Add to Home Screen** - Works on iOS and Android
- **Offline Mode** - App works without internet
- **Theme Color** - #c44033 (Gleuhr brand)

## Development Notes

### Using PAT instead of API Key

Airtable is moving from API Keys to Personal Access Tokens (PAT). This app uses PAT:

```javascript
// server/config/airtable.js
const base = new Airtable({ 
  apiKey: process.env.AIRTABLE_PAT  // PAT goes here
}).base(process.env.AIRTABLE_BASE_ID);
```

### Adding New Patients

1. Create patient record in Airtable
2. Generate a unique Journal Token
3. Patient uses token to log in
4. Token links patient to their data

## License

Proprietary - Gleuhr Skincare

## Support

For issues or questions, contact the development team.
