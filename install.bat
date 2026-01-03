@echo off
echo Installing Huawei CE6800 Automation dependencies...

REM Install backend dependencies
echo Installing backend dependencies...
call npm install

REM Install frontend dependencies
echo Installing frontend dependencies...
cd client
call npm install

REM Go back to root directory
cd ..

echo Installation complete!
echo.
echo To start the application:
echo 1. Copy .env.example to .env and configure your settings
echo 2. Run 'npm run dev' for development or 'npm start' for production
echo 3. Open http://localhost:3000 in your browser
pause
