# Heroku Deployment Guide

## Prerequisites
- Heroku CLI installed
- Git repository initialized
- Heroku account created

## Setup Steps

### 1. Create Heroku App
```bash
heroku create your-app-name
```

### 2. Set Environment Variables
```bash
# Required environment variables
heroku config:set NODE_ENV=production
heroku config:set FRONTEND_URL=https://your-app-name.herokuapp.com
heroku config:set BYBIT_API_KEY=your_bybit_api_key
heroku config:set BYBIT_API_SECRET=your_bybit_api_secret
heroku config:set OPENAI_API_KEY=your_openai_api_key
heroku config:set BYBIT_TESTNET=false
heroku config:set ENCRYPTION_KEY=your_32_character_encryption_key
```

### 3. Deploy to Heroku
```bash
# Add Heroku remote if not already added
heroku git:remote -a your-app-name

# Deploy
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

### 4. Scale the App
```bash
heroku ps:scale web=1
```

### 5. View Logs
```bash
heroku logs --tail
```

## Important Notes

1. **Environment Variables**: Make sure all required environment variables are set before deployment
2. **Build Process**: The `heroku-postbuild` script will:
   - Build the React frontend
   - Install backend dependencies
3. **Static Files**: The backend serves the React build files in production
4. **Port**: Heroku provides the PORT environment variable automatically

## Troubleshooting

### Build Fails
- Check `heroku logs --tail` for error messages
- Ensure all dependencies are in package.json
- Verify Node.js version in engines field

### App Crashes
- Check environment variables: `heroku config`
- Verify API keys are correct
- Check logs for runtime errors

### CORS Issues
- Ensure FRONTEND_URL is set correctly
- Update CORS configuration if needed