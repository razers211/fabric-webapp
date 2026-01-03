@echo off
echo Building Huawei CE6800 Automation application...

REM Install backend dependencies
echo Installing backend dependencies...
call npm install

REM Install frontend dependencies
echo Installing frontend dependencies...
cd client
call npm install

REM Build frontend
echo Building frontend...
call npm run build

REM Go back to root directory
cd ..

echo Build complete!
echo.
echo To start the application:
echo Run 'npm start'
echo.
echo Application will be available at:
echo Backend: http://localhost:3001
echo Frontend: http://localhost:3001
pause
