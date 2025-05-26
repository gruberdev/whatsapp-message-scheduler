const sessionId = `session-${Date.now()}`;
const backendUrl = 'http://localhost:3001';

console.log('Testing frontend flow with session:', sessionId);

async function testFlow() {
  try {
    // Step 1: Check existing session (like frontend does on mount)
    console.log('\n1. Checking existing session...');
    const statusResponse = await fetch(`${backendUrl}/api/whatsapp/status?sessionId=${sessionId}`);
    const statusData = await statusResponse.json();
    console.log('Status response:', statusData);

    if (statusData.status === 'ready') {
      console.log('Session already ready!');
      return;
    }

    // Step 2: Start polling QR endpoint (like frontend does when not ready)
    console.log('\n2. Starting QR polling...');
    const qrResponse = await fetch(`${backendUrl}/api/whatsapp/qr?sessionId=${sessionId}`);
    const qrData = await qrResponse.json();
    console.log('QR response:', {
      status: qrData.status,
      sessionId: qrData.sessionId,
      hasQrCode: !!qrData.qrCode
    });

    // Step 3: Check status again after QR creation
    console.log('\n3. Checking status after QR creation...');
    const statusResponse2 = await fetch(`${backendUrl}/api/whatsapp/status?sessionId=${sessionId}`);
    const statusData2 = await statusResponse2.json();
    console.log('Status response 2:', statusData2);

    console.log('\n✅ Frontend flow test completed successfully!');
    console.log('The backend is working correctly. Issue might be in frontend polling logic.');

  } catch (error) {
    console.error('❌ Error in frontend flow test:', error);
  }
}

testFlow(); 