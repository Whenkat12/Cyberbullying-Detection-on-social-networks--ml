# Cyber Sentinel Backend

A comprehensive backend API for the Cyber Sentinel cyberbullying detection platform, built with Node.js, Express, and MongoDB.

## Features

### 🔐 Authentication & User Management
- JWT-based authentication with refresh tokens
- User registration and login
- Profile management and settings
- Role-based access control (User, Moderator, Admin)
- Password reset functionality
- Two-factor authentication support

### 🤖 AI-Powered Detection
- Advanced ML model using Naive Bayes + TF-IDF
- Real-time cyberbullying detection
- Confidence scoring and severity levels
- Multi-platform support (WhatsApp, Instagram, Twitter, Facebook)
- Batch processing capabilities
- Model retraining and updates

### 📊 Analytics & Reporting
- Comprehensive user analytics
- Platform-specific statistics
- Trending word analysis
- Time-based activity tracking
- Predictive risk assessment
- Export functionality (CSV, JSON)

### 💬 Chat Monitoring
- Multi-platform chat integration
- Real-time message analysis
- Automatic blocking based on thresholds
- Strike system for repeated violations
- Chat history and statistics

### 🛡️ Security Features
- Rate limiting and DDoS protection
- Input validation and sanitization
- Helmet.js security headers
- MongoDB injection prevention
- XSS protection
- Request logging and monitoring

## Tech Stack

- **Runtime**: Node.js 18+
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT (jsonwebtoken)
- **ML Libraries**: natural, ml-matrix
- **Security**: helmet, express-rate-limit, express-mongo-sanitize
- **Logging**: winston
- **Validation**: express-validator
- **File Upload**: multer

## Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CyberGuard-main/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system.

5. **Run the server**
   ```bash
   # Development mode
   npm run dev
   
   # Production mode
   npm start
   ```

## Environment Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development

# Database Configuration
MONGODB_URI=mongodb://localhost:27017/CyberGuard

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your-refresh-token-secret
JWT_REFRESH_EXPIRE=30d

# Security Configuration
BCRYPT_ROUNDS=12
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX=100

# Admin Configuration
ADMIN_EMAIL=admin@cybersentinel.com
ADMIN_PASSWORD=admin123
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh JWT token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/logout` - Logout user

### User Management
- `GET /api/users/profile` - Get user profile
- `PATCH /api/users/profile` - Update profile
- `PATCH /api/users/settings` - Update settings
- `PATCH /api/users/password` - Change password
- `GET /api/users/stats` - Get user statistics
- `GET /api/users/activity` - Get activity timeline
- `DELETE /api/users/account` - Delete account

### Detection
- `POST /api/detections/detect` - Detect cyberbullying in text
- `POST /api/detections/batch-detect` - Batch detection
- `GET /api/detections/history` - Get detection history
- `GET /api/detections/:id` - Get single detection
- `PATCH /api/detections/:id/feedback` - Update detection feedback
- `GET /api/detections/stats/overview` - Get detection statistics
- `GET /api/detections/stats/trending` - Get trending words
- `GET /api/detections/export/csv` - Export detections as CSV

### Chat Management
- `GET /api/chats` - Get all user chats
- `POST /api/chats` - Create new chat
- `GET /api/chats/:id` - Get single chat
- `PATCH /api/chats/:id/settings` - Update chat settings
- `POST /api/chats/:id/block` - Block chat
- `POST /api/chats/:id/unblock` - Unblock chat
- `DELETE /api/chats/:id` - Delete chat
- `GET /api/chats/:id/stats` - Get chat statistics

### Messages
- `GET /api/messages/chat/:chatId` - Get messages for chat
- `POST /api/messages` - Send message (with detection)
- `GET /api/messages/:id` - Get single message
- `PATCH /api/messages/:id/feedback` - Update message feedback
- `POST /api/messages/:id/block` - Block message
- `GET /api/messages/review/pending` - Get messages for review
- `POST /api/messages/batch-process` - Batch process messages

### Analytics
- `GET /api/analytics/overview` - Get analytics overview
- `GET /api/analytics/detailed` - Get detailed analytics
- `GET /api/analytics/comparative` - Get comparative analytics
- `GET /api/analytics/predictive` - Get predictive analytics

### ML Model
- `GET /api/ml/model` - Get ML model information
- `GET /api/ml/vocabulary` - Get model vocabulary
- `GET /api/ml/vocabulary/search` - Search vocabulary
- `GET /api/ml/vocabulary/top-bullying` - Get top bullying words
- `POST /api/ml/retrain` - Retrain ML model
- `POST /api/ml/update` - Update model with new data
- `POST /api/ml/test` - Test detection
- `GET /api/ml/performance` - Get model performance metrics

### Admin (Admin only)
- `GET /api/admin/stats` - Get system statistics
- `GET /api/admin/users` - Get all users
- `GET /api/admin/users/:id` - Get single user
- `PATCH /api/admin/users/:id/role` - Update user role
- `PATCH /api/admin/users/:id/toggle-active` - Toggle user active status
- `DELETE /api/admin/users/:id` - Delete user
- `GET /api/admin/analytics/platform` - Get platform analytics
- `GET /api/admin/health` - Get system health
- `GET /api/admin/export` - Export system data

## ML Model Features

### Detection Algorithm
- **Naive Bayes Classifier**: Multinomial Naive Bayes with Laplace smoothing
- **TF-IDF Weighting**: Term Frequency-Inverse Document Frequency for feature importance
- **Ensemble Method**: Combines ML model with heuristic keyword analysis
- **Severity Scoring**: Low, Medium, High, Critical based on confidence and content analysis

### Keyword Database
- **Critical Severity**: Threats, extreme hate speech (0.85-1.0)
- **High Severity**: Slurs, strong insults, harassment (0.65-0.85)
- **Medium Severity**: Moderate insults, put-downs (0.4-0.65)
- **Context Analysis**: Target pronouns, intensifiers, negations

### Model Performance
- **Training Dataset**: 18,000+ labeled samples
- **Vocabulary Size**: Dynamic based on training data
- **Processing Time**: <100ms per detection
- **Accuracy**: Continuously improving with user feedback

## Security Considerations

### Rate Limiting
- General API: 100 requests per 15 minutes per IP
- Authentication: 5 attempts per 15 minutes per IP
- File uploads: 10MB maximum size

### Data Protection
- Passwords hashed with bcrypt (12 rounds)
- JWT tokens with secure configuration
- Input sanitization for MongoDB
- XSS protection on all inputs
- Request logging without sensitive data

### Privacy
- IP addresses logged for security but not stored with detections
- User data encrypted at rest
- GDPR compliance features
- Data retention policies

## Development

### Scripts
- `npm run dev` - Start development server with nodemon
- `npm start` - Start production server
- `npm test` - Run tests
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with test data

### Testing
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm test -- --grep "auth"
```

### Logging
Logs are stored in the `logs/` directory:
- `error.log` - Error-level logs
- `combined.log` - All logs
- Console output in development

## Deployment

### Docker Deployment
```bash
# Build image
docker build -t CyberGuard-backend .

# Run container
docker run -p 5000:5000 --env-file .env CyberGuard-backend
```

### PM2 Deployment
```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start server.js --name "CyberGuard-backend"

# Monitor
pm2 monitor
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new features
5. Run the test suite
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API endpoints

---

**⚠️ Important**: This system is designed for cyberbullying detection and should be used responsibly. Always consider the context and intent when reviewing flagged content.