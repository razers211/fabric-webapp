#!/bin/bash

echo "Installing Huawei CE6800 Automation dependencies..."

# Install backend dependencies
echo "Installing backend dependencies..."
npm install

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd client
npm install

# Go back to root directory
cd ..

echo "Installation complete!"
echo ""
echo "To start the application:"
echo "1. Copy .env.example to .env and configure your settings"
echo "2. Run 'npm run dev' for development or 'npm start' for production"
echo "3. Open http://localhost:3000 in your browser"
