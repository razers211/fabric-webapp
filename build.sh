#!/bin/bash

echo "Building Huawei CE6800 Automation application..."

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd client
npm install

# Build frontend
echo "Building frontend..."
npm run build

# Go back to root directory
cd ..

echo "Build complete!"
echo ""
echo "To start the application:"
echo "Run 'npm start'"
echo ""
echo "Application will be available at:"
echo "Backend: http://localhost:3001"
echo "Frontend: http://localhost:3001"
echo ""
echo "For remote access, use your server's IP address:"
echo "http://YOUR_SERVER_IP:3001"
