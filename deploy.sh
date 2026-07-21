#!/bin/bash

set -e

# Color codes for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
PROJECT_DIR="/var/www/LocalGo-BE"
GIT_BRANCH="${1:-main}"
PM2_APP_NAME="localgo-be"

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Header
log_info "Starting deployment for LocalGo-BE backend..."
log_info "Branch: $GIT_BRANCH"
log_info "Project directory: $PROJECT_DIR"
echo ""

# Change to project directory
cd "$PROJECT_DIR" || { log_error "Failed to change directory to $PROJECT_DIR"; exit 1; }
log_success "Changed to project directory"

# 1. Pull latest code from git
log_info "Pulling latest code from git..."
git fetch origin
git checkout "$GIT_BRANCH"
git pull origin "$GIT_BRANCH"
log_success "Code pulled successfully"
echo ""

# 2. Install dependencies
log_info "Installing dependencies..."
npm ci --production=false
log_success "Dependencies installed"
echo ""

# 3. Run Prisma migrations
log_info "Running Prisma migrations..."
npm run prisma:deploy
log_success "Prisma migrations completed"
echo ""

# 4. Build the project
log_info "Building the project..."
npm run build
log_success "Project built successfully"
echo ""

# 5. Restart PM2 application
log_info "Restarting PM2 application..."
if pm2 show "$PM2_APP_NAME" > /dev/null 2>&1; then
    pm2 reload "$PM2_APP_NAME"
    log_success "PM2 application reloaded"
else
    log_warning "PM2 application '$PM2_APP_NAME' not found, starting new instance..."
    pm2 start ecosystem.config.js
    pm2 save
    log_success "PM2 application started"
fi
echo ""

# Final summary
log_success "Deployment completed successfully!"
log_info "Application is running on PM2"
echo ""
log_info "Useful commands:"
echo "  - Check status: pm2 status"
echo "  - View logs: pm2 logs $PM2_APP_NAME"
echo "  - Stop app: pm2 stop $PM2_APP_NAME"
echo "  - Restart app: pm2 restart $PM2_APP_NAME"
