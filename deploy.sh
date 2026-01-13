#!/bin/bash

# VaultTube Deployment Script
# Run this script on your VPS to deploy or update the application

set -e

echo "🚀 Starting VaultTube Deployment..."

# Configuration
APP_DIR="/var/www/vaulttube"
DOMAIN="walkingpov.com"
REPO_URL="https://github.com/yourusername/vaulttube.git"  # Update with your repo

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Installing system dependencies...${NC}"
# Install Node.js, npm, nginx if not already installed
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
fi

if ! command -v nginx &> /dev/null; then
    sudo apt-get update
    sudo apt-get install -y nginx
fi

# Install PM2 globally if not installed
if ! command -v pm2 &> /dev/null; then
    sudo npm install -g pm2
fi

echo -e "${YELLOW}📂 Setting up application directory...${NC}"
# Create app directory if it doesn't exist
if [ ! -d "$APP_DIR" ]; then
    echo "Creating directory $APP_DIR"
    sudo mkdir -p $APP_DIR
    sudo chown -R $USER:$USER $APP_DIR
    
    # Clone repository
    echo "Cloning repository..."
    # git clone $REPO_URL $APP_DIR
    # For now, copy files manually
else
    echo "Directory exists, updating..."
    # cd $APP_DIR && git pull
fi

cd $APP_DIR

echo -e "${YELLOW}📝 Checking environment files...${NC}"
# Check for .env files
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}⚠️  Frontend .env file not found. Please create it.${NC}"
    echo "Copy .env.example to .env and fill in your values"
fi

if [ ! -f "server/.env" ]; then
    echo -e "${YELLOW}⚠️  Server .env file not found. Please create it.${NC}"
    echo "Copy server/.env.example to server/.env and fill in your values"
fi

echo -e "${YELLOW}📦 Installing backend dependencies...${NC}"
cd server
npm install
npm run build

echo -e "${YELLOW}📦 Installing frontend dependencies...${NC}"
cd ..
npm install
npm run build

echo -e "${YELLOW}🔧 Setting up PM2...${NC}"
# Stop existing PM2 processes
pm2 delete vaulttube-api || true

# Start the API server with PM2
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

echo -e "${YELLOW}🌐 Setting up Nginx...${NC}"
# Copy nginx configuration
sudo cp nginx.conf /etc/nginx/sites-available/vaulttube

# Enable site if not already
if [ ! -L /etc/nginx/sites-enabled/vaulttube ]; then
    sudo ln -s /etc/nginx/sites-available/vaulttube /etc/nginx/sites-enabled/
fi

# Test nginx configuration
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx
sudo systemctl enable nginx

echo -e "${GREEN}✅ Deployment complete!${NC}"
echo ""
echo "Next steps:"
echo "1. Update .env files with your Supabase credentials"
echo "2. Update nginx.conf with your domain name"
echo "3. Set up SSL with: sudo certbot --nginx -d your-domain.com"
echo "4. Create your first admin user in Supabase dashboard"
echo ""
echo "Useful commands:"
echo "  - View API logs: pm2 logs vaulttube-api"
echo "  - Restart API: pm2 restart vaulttube-api"
echo "  - Check status: pm2 status"
echo "  - Reload nginx: sudo systemctl reload nginx"
