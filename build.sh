#!/bin/bash

echo "Building Huawei CE6800 Automation application..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "Error: Node.js is not installed. Please install Node.js 16+ first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "Error: npm is not installed. Please install npm first."
    exit 1
fi

# Install backend dependencies
echo "Installing backend dependencies..."
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install backend dependencies"
        exit 1
    fi
else
    echo "Backend dependencies already installed"
fi

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd client
if [ ! -d "node_modules" ]; then
    npm install
    if [ $? -ne 0 ]; then
        echo "Error: Failed to install frontend dependencies"
        exit 1
    fi
else
    echo "Frontend dependencies already installed"
fi

# Build frontend
echo "Building frontend..."
npm run build
if [ $? -ne 0 ]; then
    echo "Error: Frontend build failed"
    exit 1
fi

# Check if build directory was created
if [ ! -d "build" ]; then
    echo "Error: Build directory was not created"
    exit 1
fi

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
