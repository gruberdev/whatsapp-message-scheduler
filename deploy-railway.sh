#!/bin/bash

echo "🚂 Railway Deployment Script for WhatsApp Message Scheduler"
echo "============================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if Railway CLI is installed
print_status "Checking if Railway CLI is installed..."
if ! command -v railway &> /dev/null; then
    print_warning "Railway CLI not found. Installing..."
    npm install -g @railway/cli
    if [ $? -eq 0 ]; then
        print_success "Railway CLI installed successfully!"
    else
        print_error "Failed to install Railway CLI. Please install manually: npm install -g @railway/cli"
        exit 1
    fi
else
    print_success "Railway CLI is already installed!"
fi

# Check if user is logged in
print_status "Checking Railway authentication..."
if ! railway whoami &> /dev/null; then
    print_warning "Not logged in to Railway. Please login..."
    railway login
    if [ $? -ne 0 ]; then
        print_error "Failed to login to Railway. Please try again."
        exit 1
    fi
else
    print_success "Already logged in to Railway!"
fi

# Link project if not already linked
print_status "Linking project to Railway..."
if ! railway status &> /dev/null; then
    print_warning "Project not linked. Linking now..."
    railway link
    if [ $? -ne 0 ]; then
        print_error "Failed to link project. Please link manually: railway link"
        exit 1
    fi
else
    print_success "Project already linked!"
fi

# Set environment variables
print_status "Setting up environment variables..."
railway variables set PORT=3001
railway variables set NODE_ENV=production
railway variables set PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
railway variables set PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

print_warning "Please set FRONTEND_URL manually after deploying frontend:"
print_warning "railway variables set FRONTEND_URL=https://your-frontend-url.vercel.app"

# Deploy backend
print_status "Deploying backend to Railway..."
cd backend
railway up --detach

if [ $? -eq 0 ]; then
    print_success "Backend deployment initiated!"
    print_status "Checking deployment status..."
    sleep 10
    railway status
    
    print_success "🎉 Deployment complete!"
    print_status "Useful commands:"
    echo "  railway logs --follow    # View real-time logs"
    echo "  railway status          # Check deployment status"
    echo "  railway open            # Open Railway dashboard"
    echo "  railway domain          # Get deployment URL"
    
else
    print_error "Deployment failed. Check the logs with: railway logs"
    exit 1
fi 