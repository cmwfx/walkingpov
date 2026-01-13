#!/bin/bash

# VaultTube VPS Initial Setup Script
# Run this script on a fresh Ubuntu VPS to install all dependencies
# Usage: curl -O https://raw.githubusercontent.com/yourrepo/vaulttube/main/setup-vps.sh && bash setup-vps.sh
# Or: wget https://raw.githubusercontent.com/yourrepo/vaulttube/main/setup-vps.sh && bash setup-vps.sh

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
DOMAIN="walkingpov.com"
APP_DIR="/var/www/vaulttube"
NODE_VERSION="20"

clear
echo -e "${BLUE}╔════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║                                                ║${NC}"
echo -e "${BLUE}║        VaultTube VPS Setup Script              ║${NC}"
echo -e "${BLUE}║        Automated Dependency Installation       ║${NC}"
echo -e "${BLUE}║                                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}This script will install:${NC}"
echo "  • Node.js 20.x"
echo "  • Nginx"
echo "  • PM2"
echo "  • Certbot (for SSL)"
echo "  • Firewall configuration"
echo ""
echo -e "${YELLOW}Press Ctrl+C to cancel, or Enter to continue...${NC}"
read

# Function to print step
print_step() {
    echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}► $1${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

# Check if running as root or with sudo
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run with sudo: sudo bash setup-vps.sh"
    exit 1
fi

print_step "Step 1/8: Updating System Packages"
apt update
apt upgrade -y
print_success "System packages updated"

print_step "Step 2/8: Installing Node.js $NODE_VERSION.x"
if command -v node &> /dev/null; then
    print_warning "Node.js already installed ($(node --version))"
    read -p "Do you want to reinstall? (y/N): " reinstall_node
    if [[ $reinstall_node =~ ^[Yy]$ ]]; then
        curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
        apt-get install -y nodejs
    fi
else
    curl -fsSL https://deb.nodesource.com/setup_${NODE_VERSION}.x | bash -
    apt-get install -y nodejs
fi
print_success "Node.js $(node --version) installed"
print_success "npm $(npm --version) installed"

print_step "Step 3/8: Installing Nginx"
if command -v nginx &> /dev/null; then
    print_warning "Nginx already installed"
else
    apt-get install -y nginx
    systemctl start nginx
    systemctl enable nginx
fi
print_success "Nginx installed and running"

print_step "Step 4/8: Installing PM2"
if command -v pm2 &> /dev/null; then
    print_warning "PM2 already installed ($(pm2 --version))"
else
    npm install -g pm2
fi
print_success "PM2 $(pm2 --version) installed"

print_step "Step 5/8: Installing Certbot (SSL)"
if command -v certbot &> /dev/null; then
    print_warning "Certbot already installed"
else
    apt-get install -y certbot python3-certbot-nginx
fi
print_success "Certbot installed"

print_step "Step 6/8: Installing Git"
if command -v git &> /dev/null; then
    print_warning "Git already installed ($(git --version))"
else
    apt-get install -y git
fi
print_success "Git installed"

print_step "Step 7/8: Configuring Firewall"
if ufw status | grep -q "Status: active"; then
    print_warning "UFW already active"
else
    ufw --force enable
fi

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
print_success "Firewall configured"
ufw status

print_step "Step 8/8: Creating Application Directory"
if [ -d "$APP_DIR" ]; then
    print_warning "Directory $APP_DIR already exists"
else
    mkdir -p $APP_DIR
fi

# Get the non-root user if script was run with sudo
if [ -n "$SUDO_USER" ]; then
    chown -R $SUDO_USER:$SUDO_USER $APP_DIR
    print_success "Directory created and owned by $SUDO_USER"
else
    print_success "Directory created at $APP_DIR"
fi

echo ""
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}                                                   ${NC}"
echo -e "${GREEN}  ✓ VPS Setup Complete!                           ${NC}"
echo -e "${GREEN}                                                   ${NC}"
echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

print_success "All dependencies installed successfully!"
echo ""
echo -e "${CYAN}Installed Components:${NC}"
echo "  ✓ Node.js $(node --version)"
echo "  ✓ npm $(npm --version)"
echo "  ✓ Nginx"
echo "  ✓ PM2 $(pm2 --version)"
echo "  ✓ Certbot"
echo "  ✓ Git $(git --version)"
echo ""

echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${PURPLE}Next Steps:${NC}"
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo "1. Upload your application files to: $APP_DIR"
echo ""
echo "   Option A - Using SCP (from your local machine):"
echo "   ${CYAN}scp -r /path/to/vaulttube/* root@$(hostname -I | awk '{print $1}'):$APP_DIR/${NC}"
echo ""
echo "   Option B - Using Git:"
echo "   ${CYAN}cd $APP_DIR && git clone https://github.com/yourrepo/vaulttube.git .${NC}"
echo ""
echo "2. Create environment files:"
echo "   ${CYAN}cd $APP_DIR${NC}"
echo "   ${CYAN}nano .env${NC}                    # Frontend environment"
echo "   ${CYAN}nano server/.env${NC}             # Backend environment"
echo ""
echo "3. Build and deploy:"
echo "   ${CYAN}cd $APP_DIR/server && npm install && npm run build${NC}"
echo "   ${CYAN}cd $APP_DIR && npm install && npm run build${NC}"
echo "   ${CYAN}pm2 start ecosystem.config.cjs${NC}"
echo ""
echo "4. Configure Nginx:"
echo "   ${CYAN}sudo cp $APP_DIR/nginx.conf /etc/nginx/sites-available/vaulttube${NC}"
echo "   ${CYAN}sudo ln -s /etc/nginx/sites-available/vaulttube /etc/nginx/sites-enabled/${NC}"
echo "   ${CYAN}sudo nginx -t && sudo systemctl reload nginx${NC}"
echo ""
echo "5. Install SSL certificate:"
echo "   ${CYAN}sudo certbot --nginx -d $DOMAIN -d www.$DOMAIN${NC}"
echo ""
echo -e "${PURPLE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${YELLOW}For detailed instructions, see:${NC}"
echo "  • VPS_DEPLOYMENT_GUIDE.md (detailed guide)"
echo "  • DEPLOYMENT_COMMANDS.md (quick commands)"
echo "  • QUICK_REFERENCE.md (daily operations)"
echo ""
echo -e "${GREEN}Happy deploying! 🚀${NC}"
echo ""
