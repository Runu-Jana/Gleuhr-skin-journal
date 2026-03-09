# Gleuhr Admin Dashboard

A comprehensive React-based admin dashboard for managing patients and monitoring their skin journey progress.

## Features

### 📊 Dashboard Overview
- **Real-time Statistics**: View active patients, consistency rates, and urgent cases
- **Patient Queue Management**: Today's queue, all patients, and onboarding views
- **Smart Categorization**: Automatic flagging of patients needing attention
- **React Components**: Modern, responsive UI with React hooks and state management

### 🔥 Key Metrics
- **Need Attention**: Patients absent for 7+ days
- **Calls Today**: Scheduled calls for new patients
- **Average Consistency**: Overall patient compliance rate
- **Reorder Due**: Patients ready for product reordering

### 📱 Patient Management
- **Urgent Cases**: Immediate action required (7+ days absent)
- **Flagged Patients**: Consistency issues, diet struggles, sunscreen skipping
- **Scheduled Calls**: New patient introductions
- **Reorder Conversations**: Patients in reorder window (days 35-37)

## Access

### URL
```
http://localhost:5001/admin
```

### Authentication
The dashboard requires an admin API key for security:

**Demo Key**: `gleuhr-admin-2024`

### API Endpoints

#### Get Dashboard Data
```http
GET /api/admin/dashboard
Headers: X-Admin-API-Key: gleuhr-admin-2024
```

Returns:
- Statistics (need attention, calls today, avg consistency, reorder due)
- Patient lists categorized by urgency
- Summary information

#### Get Patient Details
```http
GET /api/admin/patient/:id
Headers: X-Admin-API-Key: gleuhr-admin-2024
```

Returns:
- Complete patient information
- Recent check-ins (last 30)
- Skin scores (last 12)
- Current streak and consistency

## Technical Details

### Architecture
- **Frontend**: React 18 with modern hooks
- **Backend**: Node.js + Express
- **Database**: MongoDB with Mongoose ODM
- **Styling**: CSS Modules with responsive design
- **Authentication**: API key based (simple for demo)

### React Components
- **AdminDashboard**: Main dashboard component with state management
- **Authentication**: Login modal with session storage
- **Patient Cards**: Interactive patient information display
- **Statistics**: Real-time data visualization
- **Responsive Design**: Mobile-friendly layout

### Data Sources
- **Patients**: Patient collection with demographics
- **Check-ins**: Daily check-in data with routines and compliance
- **Skin Scores**: Weekly skin assessment scores
- **Streaks**: Current and longest streak tracking

### Calculations
- **Consistency**: (Check-in days ÷ Expected days) × 100
- **Streak**: Consecutive daily check-ins
- **Days Absent**: Days since last check-in
- **Reorder Window**: Treatment day 35-37

## Security Notes

⚠️ **Important**: This is a demo implementation with simple API key authentication. For production:

1. Replace API key authentication with JWT or session-based auth
2. Add role-based access control
3. Implement proper password policies
4. Add audit logging for admin actions
5. Use HTTPS in production
6. Set up proper CORS policies

## Development

### File Structure
```
client/src/components/
├── AdminDashboard.js       # Main React component
└── AdminDashboard.css      # Component styles

server/
├── admin.js                # Admin API routes
├── middleware/
│   └── adminAuth.js        # Authentication middleware
└── models/
    ├── Patient.js
    ├── DailyCheckIn.js
    ├── SkinScore.js
    └── Streak.js
```

### React Features Used
- **useState**: Component state management
- **useEffect**: Data fetching and lifecycle
- **React Router**: Navigation and routing
- **Responsive CSS**: Mobile-first design
- **Session Storage**: Authentication persistence

### Adding New Features
1. Add new API endpoints in `server/admin.js`
2. Update React components in `client/src/components/AdminDashboard.js`
3. Modify styles in `client/src/components/AdminDashboard.css`
4. Rebuild the React app: `npm run build` in client directory
5. Restart the server

## Deployment

### Development
```bash
# Start backend server
cd server && npm start

# Build and serve React app
cd client && npm run build
```

### Production
1. Build React app: `npm run build`
2. Serve static files from Express
3. Configure environment variables
4. Set up proper authentication

## Support

For issues or questions:
- Check server logs for API errors
- Verify MongoDB connection
- Ensure admin API key is correct
- Test individual API endpoints with Postman/curl
- Check React console for component errors

---

**Note**: This dashboard connects directly to your existing Gleuhr database and uses the same patient data as the mobile app. The React implementation provides better performance, maintainability, and user experience compared to the static HTML version.
