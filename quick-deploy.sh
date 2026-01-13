#!/bin/bash

# VaultTube Quick Deployment Script
# Run this on your VPS to quickly deploy or update the application

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
APP_DIR="/var/www/vaulttube"
DOMAIN="walkingpov.com"
API_PORT="3001"

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   VaultTube Quick Deploy Script       ║${NC}"
echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo ""

# Check if running with sudo for certain operations
if [ "$EUID" -ne 0 ]; then 
    echo -e "${YELLOW}Note: Some operations may require sudo password${NC}"
fi

# Function to print step
print_step() {
    echo -e "\n${GREEN}► $1${NC}"
}

# Function to print warning
print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

# Function to print error
print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Function to print success
print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

# Check if we're in the right directory
if [ ! -f "package.json" ] || [ ! -d "server" ]; then
    print_error "Not in the application directory!"
    echo "Please run this script from $APP_DIR"
    exit 1
fi

# Check if environment files exist
print_step "Checking environment files..."
if [ ! -f ".env" ]; then
    print_warning "Frontend .env file not found!"
    echo "Create .env file with your Supabase credentials"
    echo "See DEPLOYMENT_ENV_EXAMPLE.md for reference"
    read -p "Press Enter to continue anyway or Ctrl+C to exit..."
fi

if [ ! -f "server/.env" ]; then
    print_warning "Backend .env file not found!"
    echo "Create server/.env file with your Supabase credentials"
    echo "See DEPLOYMENT_ENV_EXAMPLE.md for reference"
    read -p "Press Enter to continue anyway or Ctrl+C to exit..."
fi

# Ask what to do
echo ""
echo "What would you like to do?"
echo "1) Full deployment (install deps, build, restart)"
echo "2) Update frontend only"
echo "3) Update backend only"
echo "4) Restart services only"
echo "5) View logs"
echo "6) Check status"
read -p "Enter your choice (1-6): " choice

case $choice in
    1)
        print_step "Starting full deployment..."
        
        print_step "Installing backend dependencies..."
        cd server
        npm install
        
        print_step "Building backend..."
        npm run build
        
        print_step "Installing frontend dependencies..."
        cd ..
        npm install
        
        print_step "Building frontend..."
        npm run build
        
        print_step "Creating uploads directory if not exists..."
        mkdir -p server/uploads
        chmod 755 server/uploads
        
        print_step "Creating logs directory if not exists..."
        mkdir -p logs
        
        print_step "Restarting backend with PM2..."
        pm2 restart walkingpov-api || pm2 start ecosystem.config.cjs
        pm2 save
        
        print_step "Reloading Nginx..."
        sudo systemctl reload nginx
        
        print_success "Full deployment complete!"
        echo ""
        echo "Application is running at:"
        echo "  https://$DOMAIN"
        ;;
        
    2)
        print_step "Updating frontend only..."
        
        print_step "Installing dependencies..."
        npm install
        
        print_step "Building frontend..."
        npm run build
        
        print_step "Reloading Nginx..."
        sudo systemctl reload nginx
        
        print_success "Frontend updated!"
        ;;
        
    3)
        print_step "Updating backend only..."
        
        print_step "Installing dependencies..."
        cd server
        npm install
        
        print_step "Building backend..."
        npm run build
        
        print_step "Restarting PM2..."
        cd ..
        pm2 restart walkingpov-api
        
        print_success "Backend updated!"
        ;;
        
    4)
        print_step "Restarting services..."
        pm2 restart walkingpov-api
        sudo systemctl reload nginx
        print_success "Services restarted!"
        ;;
        
    5)
        echo ""
        echo "Viewing logs (Ctrl+C to exit)..."
        pm2 logs walkingpov-api
        ;;
        
    6)
        print_step "Checking status..."
        echo ""
        echo "PM2 Status:"
        pm2 status
        echo ""
        echo "Nginx Status:"
        sudo systemctl status nginx --no-pager -l
        echo ""
        echo "Disk Usage:"
        df -h | grep -E '(Filesystem|/$)'
        echo ""
        echo "Uploads Directory Size:"
        du -sh server/uploads 2>/dev/null || echo "No uploads directory"
        ;;
        
    *)
        print_error "Invalid choice!"
        exit 1
        ;;
esac

echo ""
print_step "Useful Commands:"
echo "  pm2 status              - Check PM2 status"
echo "  pm2 logs                - View logs"
echo "  pm2 restart walkingpov-api - Restart backend"
echo "  sudo systemctl reload nginx - Reload Nginx"
echo "  sudo certbot renew      - Renew SSL certificate"
echo ""

exit 0
