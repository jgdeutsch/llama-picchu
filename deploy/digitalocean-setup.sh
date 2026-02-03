#!/bin/bash
# DigitalOcean Droplet Setup Script for Llama Picchu MUD
# Run this on a fresh Ubuntu 22.04 droplet

set -e

echo "=== Llama Picchu MUD - DigitalOcean Setup ==="

# Update system
echo "Updating system..."
apt-get update && apt-get upgrade -y

# Install Node.js 20
echo "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install build tools for better-sqlite3
echo "Installing build tools..."
apt-get install -y python3 make g++ git

# Create app user
echo "Creating mud user..."
useradd -m -s /bin/bash mud || true

# Clone or update repo
echo "Setting up application..."
cd /home/mud

if [ -d "llama-picchu-web" ]; then
    cd llama-picchu-web
    sudo -u mud git pull
else
    sudo -u mud git clone https://github.com/jgdeutsch/llama-picchu-web.git
    cd llama-picchu-web
fi

# Install dependencies
echo "Installing dependencies..."
sudo -u mud npm ci

# Initialize database
echo "Initializing database..."
sudo -u mud npm run db:init
sudo -u mud npm run db:seed

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/llama-mud.service << 'EOF'
[Unit]
Description=Llama Picchu MUD Telnet Server
After=network.target

[Service]
Type=simple
User=mud
WorkingDirectory=/home/mud/llama-picchu-web
ExecStart=/usr/bin/npx tsx server/telnet.ts
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=TELNET_PORT=4000

[Install]
WantedBy=multi-user.target
EOF

# Enable and start service
systemctl daemon-reload
systemctl enable llama-mud
systemctl start llama-mud

# Configure firewall
echo "Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 4000/tcp  # MUD telnet
ufw --force enable

echo ""
echo "=== Setup Complete! ==="
echo ""
echo "Your MUD is now running on port 4000"
echo "Players can connect with: telnet $(curl -s ifconfig.me) 4000"
echo ""
echo "Useful commands:"
echo "  systemctl status llama-mud   # Check status"
echo "  systemctl restart llama-mud  # Restart server"
echo "  journalctl -u llama-mud -f   # View logs"
echo ""
