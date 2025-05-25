'use client';

import { useState, useEffect } from 'react';

interface WhatsAppStatus {
  status: 'connecting' | 'qr' | 'authenticating' | 'ready' | 'disconnected';
  qrCode?: string;
  sessionId?: string;
}

export default function Home() {
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>({ status: 'connecting' });
  const [stayLoggedIn, setStayLoggedIn] = useState(true);
  const [sessionId] = useState(() => `session-${Date.now()}`);
  const [isPolling, setIsPolling] = useState(false);

  // Get backend URL from environment
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  // Poll for QR code and status updates
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;

    const pollWhatsAppStatus = async () => {
      try {
        const response = await fetch(`${backendUrl}/api/whatsapp/qr?sessionId=${sessionId}`);
        const data: WhatsAppStatus = await response.json();
        
        setWhatsappStatus(data);

        // Stop polling if connected or disconnected
        if (data.status === 'ready' || data.status === 'disconnected') {
          setIsPolling(false);
        }
        
        // Continue polling for authenticating state
        if (data.status === 'authenticating') {
          setIsPolling(true);
        }
      } catch (error) {
        console.error('Error polling WhatsApp status:', error);
        setWhatsappStatus({ status: 'disconnected' });
        setIsPolling(false);
      }
    };

    if (isPolling || whatsappStatus.status === 'connecting' || whatsappStatus.status === 'authenticating') {
      setIsPolling(true);
      pollWhatsAppStatus(); // Initial call
      pollInterval = setInterval(pollWhatsAppStatus, 2000); // Poll every 2 seconds
    }

    return () => {
      if (pollInterval) {
        clearInterval(pollInterval);
      }
    };
  }, [sessionId, isPolling, whatsappStatus.status, backendUrl]);

  // Start polling when component mounts
  useEffect(() => {
    setIsPolling(true);
  }, []);

  const handlePhoneLogin = () => {
    alert('Phone number login would redirect to WhatsApp Web');
    window.open('https://web.whatsapp.com', '_blank');
  };

  const handleDownload = () => {
    window.open('https://www.whatsapp.com/download', '_blank');
  };

  const handleRetry = () => {
    setWhatsappStatus({ status: 'connecting' });
    setIsPolling(true);
  };

  // Authenticating state - QR code scanned, waiting for connection
  if (whatsappStatus.status === 'authenticating') {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">📱</div>
          <h1 className="text-3xl font-bold text-primary mb-4">QR Code Scanned!</h1>
          <p className="text-lg mb-6 text-base-content/70">
            Great! We detected that you scanned the QR code.<br/>
            Please wait while we establish the connection...
          </p>
          <div className="flex flex-col items-center space-y-4">
            <span className="loading loading-spinner loading-lg text-primary"></span>
            <p className="text-sm text-base-content/60">
              Authenticating with WhatsApp...
            </p>
            <div className="text-xs text-base-content/40">
              Session: {sessionId}
            </div>
          </div>
          
          {/* Progress steps */}
          <div className="mt-8 max-w-md mx-auto">
            <div className="flex items-center justify-between text-sm">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center mb-2">
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-success font-medium">QR Scanned</span>
              </div>
              <div className="flex-1 h-0.5 bg-primary mx-4"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center mb-2">
                  <span className="loading loading-spinner loading-sm text-white"></span>
                </div>
                <span className="text-primary font-medium">Connecting</span>
              </div>
              <div className="flex-1 h-0.5 bg-base-300 mx-4"></div>
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 bg-base-300 rounded-full flex items-center justify-center mb-2">
                  <span className="text-base-content/40">3</span>
                </div>
                <span className="text-base-content/40">Ready</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (whatsappStatus.status === 'ready') {
    return (
      <div className="min-h-screen bg-base-100 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">✅</div>
          <h1 className="text-3xl font-bold text-success mb-4">Connected Successfully!</h1>
          <p className="text-lg mb-6">Your WhatsApp account is now connected and ready to schedule messages.</p>
          <div className="space-y-4">
            <button className="btn btn-primary btn-lg">
              Start Scheduling Messages
            </button>
            <div className="text-sm text-base-content/60">
              Session ID: {sessionId}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-100">
      {/* Header */}
      <div className="navbar bg-base-100 border-b border-base-300">
        <div className="navbar-start">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-success rounded-full flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.687"/>
              </svg>
            </div>
            <span className="text-xl font-semibold">WhatsApp Message Scheduler</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center min-h-[80vh]">
          
          {/* Left Side - Instructions */}
          <div className="order-2 lg:order-1">
            <div className="card bg-base-100 shadow-xl border border-base-300 p-8">
              <div className="card-body items-center text-center">
                <h2 className="card-title text-2xl mb-6 text-base-content">
                  {whatsappStatus.status === 'connecting' && 'Initializing WhatsApp...'}
                  {whatsappStatus.status === 'qr' && 'Steps to log in'}
                  {whatsappStatus.status === 'disconnected' && 'Connection Failed'}
                </h2>
                
                {whatsappStatus.status === 'connecting' && (
                  <div className="text-center">
                    <span className="loading loading-spinner loading-lg text-primary"></span>
                    <p className="mt-4 text-base-content/70">Setting up your WhatsApp connection...</p>
                  </div>
                )}



                {whatsappStatus.status === 'qr' && (
                  <>
                    <div className="space-y-4 mb-8 text-left w-full max-w-md">
                      <div className="flex items-start gap-3">
                        <div className="badge badge-outline badge-lg">1</div>
                        <div>
                          <span className="font-medium">Open WhatsApp </span>
                          <div className="inline-flex items-center gap-1">
                            <div className="w-4 h-4 bg-success rounded-full flex items-center justify-center">
                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.821 11.821 0 0020.885 3.687"/>
                              </svg>
                            </div>
                            <span className="text-sm">on your phone</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="badge badge-outline badge-lg">2</div>
                        <div>
                          <span>On Android tap </span>
                          <span className="font-medium">Menu</span>
                          <span className="mx-2">⋮</span>
                          <span> • On iPhone tap </span>
                          <span className="font-medium">Settings</span>
                          <span className="ml-2">⚙️</span>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="badge badge-outline badge-lg">3</div>
                        <div>
                          <span>Tap </span>
                          <span className="font-medium">Linked devices</span>
                          <span>, then </span>
                          <span className="font-medium">Link device</span>
                        </div>
                      </div>
                      
                      <div className="flex items-start gap-3">
                        <div className="badge badge-outline badge-lg">4</div>
                        <div>
                          <span className="font-medium">Scan the QR code to confirm</span>
                        </div>
                      </div>
                    </div>

                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-3">
                        <input 
                          type="checkbox" 
                          checked={stayLoggedIn}
                          onChange={(e) => setStayLoggedIn(e.target.checked)}
                          className="checkbox checkbox-success" 
                        />
                        <span className="label-text font-medium">Stay logged in on this browser</span>
                      </label>
                    </div>
                  </>
                )}

                {whatsappStatus.status === 'disconnected' && (
                  <div className="text-center">
                    <div className="text-4xl mb-4">❌</div>
                    <p className="mb-6 text-base-content/70">
                      Failed to connect to WhatsApp. Please try again.
                    </p>
                    <button 
                      className="btn btn-primary"
                      onClick={handleRetry}
                    >
                      Try Again
                    </button>
                  </div>
                )}

                <div className="mt-6">
                  <button 
                    className="btn btn-outline btn-primary"
                    onClick={handlePhoneLogin}
                  >
                    Log in with phone number →
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side - QR Code Display */}
          <div className="order-1 lg:order-2 flex justify-center">
            <div className="bg-white p-8 rounded-2xl shadow-lg border border-base-300">
              {whatsappStatus.status === 'qr' && whatsappStatus.qrCode ? (
                <img 
                  src={whatsappStatus.qrCode} 
                  alt="WhatsApp QR Code"
                  className="w-[280px] h-[280px]"
                />
              ) : (
                <div className="w-[280px] h-[280px] bg-base-200 animate-pulse rounded-lg flex items-center justify-center">
                  <div className="text-center">
                    <span className="loading loading-spinner loading-lg"></span>
                    <p className="mt-4 text-sm text-base-content/60">
                      {whatsappStatus.status === 'connecting' && 'Generating QR Code...'}
                      {whatsappStatus.status === 'disconnected' && 'Connection Failed'}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Download Section */}
        <div className="mt-12">
          <div className="card bg-base-100 shadow-lg border border-base-300">
            <div className="card-body">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-success rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Download WhatsApp for Mac</h3>
                    <p className="text-base-content/70">Make calls and get a faster experience when you download the Mac app.</p>
                  </div>
                </div>
                <button 
                  className="btn btn-success"
                  onClick={handleDownload}
                >
                  Download ↓
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="mt-8 text-center">
          <div className="flex items-center justify-center gap-2 text-base-content/60">
            <p>Don&apos;t have a WhatsApp account?</p>
            <a href="https://www.whatsapp.com/download" target="_blank" rel="noopener noreferrer" className="link link-success font-medium">Get started →</a>
          </div>
          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-base-content/50">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/>
            </svg>
            <span>Your personal messages are end-to-end encrypted</span>
          </div>
          {(whatsappStatus.status === 'qr' || whatsappStatus.status === 'disconnected') && (
            <div className="mt-2 text-xs text-base-content/40">
              Session: {sessionId} • Status: {whatsappStatus.status}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
