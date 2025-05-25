#!/usr/bin/env node

const { spawn } = require('child_process');
const http = require('http');

console.log('🧪 Testing WhatsApp Message Scheduler Setup...\n');

// Function to check if a port is available
function checkPort(port, callback) {
  const server = http.createServer();
  server.listen(port, () => {
    server.close(() => callback(true));
  });
  server.on('error', () => callback(false));
}

// Function to wait for a service to be ready
function waitForService(url, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    
    function check() {
      http.get(url, (res) => {
        if (res.statusCode === 200) {
          resolve(true);
        } else {
          setTimeout(check, 1000);
        }
      }).on('error', () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error(`Service at ${url} not ready after ${timeout}ms`));
        } else {
          setTimeout(check, 1000);
        }
      });
    }
    
    check();
  });
}

async function runTests() {
  try {
    // Check if ports are available
    console.log('📡 Checking if ports 3000 and 3001 are available...');
    
    const port3000Available = await new Promise(resolve => checkPort(3000, resolve));
    const port3001Available = await new Promise(resolve => checkPort(3001, resolve));
    
    if (!port3000Available) {
      console.log('⚠️  Port 3000 is in use. Please stop any service running on port 3000.');
      return;
    }
    
    if (!port3001Available) {
      console.log('⚠️  Port 3001 is in use. Please stop any service running on port 3001.');
      return;
    }
    
    console.log('✅ Ports 3000 and 3001 are available\n');
    
    // Start backend
    console.log('🚀 Starting NestJS backend...');
    const backend = spawn('npm', ['run', 'start:dev'], { 
      cwd: './backend',
      stdio: 'pipe'
    });
    
    // Wait for backend to be ready
    try {
      await waitForService('http://localhost:3001/api/whatsapp/sessions', 20000);
      console.log('✅ Backend is running on http://localhost:3001\n');
    } catch (error) {
      console.log('❌ Backend failed to start:', error.message);
      backend.kill();
      return;
    }
    
    // Start frontend
    console.log('🎨 Starting Next.js frontend...');
    const frontend = spawn('npm', ['run', 'dev'], { 
      cwd: './frontend',
      stdio: 'pipe'
    });
    
    // Wait for frontend to be ready
    try {
      await waitForService('http://localhost:3000', 20000);
      console.log('✅ Frontend is running on http://localhost:3000\n');
    } catch (error) {
      console.log('❌ Frontend failed to start:', error.message);
      frontend.kill();
      backend.kill();
      return;
    }
    
    console.log('🎉 SUCCESS! Both applications are running:');
    console.log('   Frontend: http://localhost:3000');
    console.log('   Backend:  http://localhost:3001/api');
    console.log('\n📱 You can now open http://localhost:3000 to test WhatsApp QR authentication!');
    console.log('\n⏹️  Press Ctrl+C to stop both services');
    
    // Keep processes running
    process.on('SIGINT', () => {
      console.log('\n🛑 Stopping services...');
      frontend.kill();
      backend.kill();
      process.exit(0);
    });
    
    // Keep the script running
    await new Promise(() => {});
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

runTests(); 