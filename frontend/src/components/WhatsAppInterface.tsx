'use client';

import { useState, useEffect, useRef } from 'react';

interface WhatsAppChat {
  id: string;
  name: string;
  isGroup: boolean;
  lastMessage?: {
    body: string;
    timestamp: number;
    fromMe: boolean;
  };
  unreadCount: number;
  profilePicUrl?: string;
}

interface WhatsAppMessage {
  id: string;
  body: string;
  timestamp: number;
  fromMe: boolean;
  author?: string;
  authorName?: string; // Display name for group messages
  authorNumber?: string; // Formatted phone number (only for non-contacts)
  isContact?: boolean; // Whether the author is in user's contacts
  type: string;
  mediaData?: {
    data: string; // Base64 encoded media data
    mimetype: string;
    filename?: string;
  };
}

interface WhatsAppInterfaceProps {
  sessionId: string;
  onDisconnect: () => void;
}

export default function WhatsAppInterface({ sessionId, onDisconnect }: WhatsAppInterfaceProps) {
  const [chats, setChats] = useState<WhatsAppChat[]>([]);
  const [selectedChat, setSelectedChat] = useState<WhatsAppChat | null>(null);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isLoadingMoreChats, setIsLoadingMoreChats] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [hasMoreChats, setHasMoreChats] = useState(true);
  const [totalChats, setTotalChats] = useState(0);
  const [profilePictures, setProfilePictures] = useState<Record<string, string>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3001';

  // Handle session disconnection
  const handleSessionDisconnected = () => {
    // Clear the stored session ID to force a new session
    localStorage.removeItem('whatsapp-session-id');
    // Trigger the parent component to restart the connection process
    onDisconnect();
  };

  // Load chats on component mount
  useEffect(() => {
    loadChats();
  }, [sessionId]);

  // Update messages when selected chat changes
  useEffect(() => {
    if (selectedChat) {
      loadMessages(selectedChat.id);
    }
  }, [selectedChat?.id]);

  // Polling for chat list updates every 10 seconds - reduced to avoid rate limits
  useEffect(() => {
    // Only start polling after we have initial chats loaded
    if (chats.length === 0) return;
    
    const interval = setInterval(() => {
      updateChats();
    }, 10000); // Increased from 5s to 30s to reduce API calls

    return () => clearInterval(interval);
  }, [sessionId, chats.length]); // Add chats.length as dependency

  // Polling for message updates every 3 seconds (only when a chat is selected)
  useEffect(() => {
    if (selectedChat) {
      const interval = setInterval(() => {
        updateMessages(selectedChat.id);
      }, 10000);

      return () => clearInterval(interval);
    }
  }, [selectedChat?.id]);

  const loadChats = async (reset: boolean = true) => {
    if (reset) {
      setIsLoadingChats(true);
      setChats([]);
    } else {
      setIsLoadingMoreChats(true);
    }
    
    try {
      const offset = reset ? 0 : chats.length;
      const limit = reset ? 20 : 10; // Load 3 initially, then 3 more for maximum speed
      
      // Add timeout to frontend request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
      
      const response = await fetch(`${backendUrl}/api/whatsapp/chats?sessionId=${sessionId}&offset=${offset}&limit=${limit}`, {
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        
        if (reset) {
          setChats(data.chats);
        } else {
          setChats(prevChats => [...prevChats, ...data.chats]);
        }
        
        setHasMoreChats(data.hasMore);
        setTotalChats(data.total);
      } else {
        const errorData = await response.json();
        console.error('Failed to load chats:', errorData);
        
        // Check if this is a session disconnected error
        if (errorData.details && errorData.details.includes('WhatsApp session has been disconnected')) {
          console.log('Session disconnected, triggering reconnection...');
          handleSessionDisconnected();
          return;
        }
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.error('Request timed out while loading chats');
        // Don't trigger reconnection for timeouts, just show error
      } else {
        console.error('Error loading chats:', error);
      }
    } finally {
      if (reset) {
        setIsLoadingChats(false);
      } else {
        setIsLoadingMoreChats(false);
      }
    }
  };

  // Seamless chat list update for polling (no loading state)
  const updateChats = async () => {
    try {
      // Only update the first page of chats to avoid complexity with pagination
      const response = await fetch(`${backendUrl}/api/whatsapp/chats?sessionId=${sessionId}&offset=0&limit=2`);
      if (response.ok) {
        const data = await response.json();
        
        setChats(prevChats => {
          // If no previous chats, just set the new ones (shouldn't happen in polling)
          if (prevChats.length === 0) {
            return data.chats;
          }
          
          // Check if there are any actual changes before updating
          const hasChanges = data.chats.some((newChat: WhatsAppChat) => {
            const existingChat = prevChats.find(chat => chat.id === newChat.id);
            if (!existingChat) return true; // New chat
            
            // Check if last message or unread count changed
            const lastMessageChanged = 
              (!existingChat.lastMessage && newChat.lastMessage) ||
              (existingChat.lastMessage && !newChat.lastMessage) ||
              (existingChat.lastMessage && newChat.lastMessage && 
               existingChat.lastMessage.timestamp !== newChat.lastMessage.timestamp);
            
            const unreadCountChanged = existingChat.unreadCount !== newChat.unreadCount;
            
            return lastMessageChanged || unreadCountChanged;
          });
          
          // Only update if there are actual changes
          if (!hasChanges) {
            return prevChats;
          }
          
          // Update existing chats with new data (last messages, unread counts)
          const updatedChats = data.chats.map((newChat: WhatsAppChat) => {
            const existingChat = prevChats.find(chat => chat.id === newChat.id);
            
            // If this is a completely new chat, add it
            if (!existingChat) {
              return newChat;
            }
            
            // Update existing chat with new last message and unread count
            return {
              ...existingChat,
              lastMessage: newChat.lastMessage,
              unreadCount: newChat.unreadCount
            };
          });
          
          // Add any existing chats that weren't in the new list (for pagination)
          const newChatIds = data.chats.map((chat: WhatsAppChat) => chat.id);
          const existingOtherChats = prevChats.filter(chat => !newChatIds.includes(chat.id));
          
          // Combine and sort by last message timestamp
          const allChats = [...updatedChats, ...existingOtherChats];
          allChats.sort((a, b) => {
            const aTime = a.lastMessage?.timestamp || 0;
            const bTime = b.lastMessage?.timestamp || 0;
            return bTime - aTime;
          });
          
          return allChats;
        });
        
        // Update pagination info
        setHasMoreChats(data.hasMore);
        setTotalChats(data.total);
      } else {
        const errorData = await response.json();
        console.error('Failed to update chats:', errorData);
        
        // Check if this is a session disconnected error
        if (errorData.details && errorData.details.includes('WhatsApp session has been disconnected')) {
          console.log('Session disconnected while updating chats, triggering reconnection...');
          handleSessionDisconnected();
          return;
        }
      }
    } catch (error) {
      console.error('Error updating chats:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  };

  const loadMessages = async (chatId: string) => {
    setIsLoadingMessages(true);
    try {
      const response = await fetch(`${backendUrl}/api/whatsapp/messages?sessionId=${sessionId}&chatId=${chatId}&limit=50`);
      if (response.ok) {
        const messagesData = await response.json();
        setMessages(messagesData);
        // Scroll to bottom after messages load
        setTimeout(scrollToBottom, 100);
      } else {
        const errorData = await response.json();
        console.error('Failed to load messages:', errorData);
        
        // Check if this is a session disconnected error
        if (errorData.details && errorData.details.includes('WhatsApp session has been disconnected')) {
          console.log('Session disconnected while loading messages, triggering reconnection...');
          handleSessionDisconnected();
          return;
        }
      }
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Seamless message update for polling (no loading state)
  const updateMessages = async (chatId: string) => {
    try {
      const response = await fetch(`${backendUrl}/api/whatsapp/messages?sessionId=${sessionId}&chatId=${chatId}&limit=50`);
      if (response.ok) {
        const messagesData = await response.json();
        
        // Only update if we have new messages
        setMessages(prevMessages => {
          // If no previous messages, just set the new ones
          if (prevMessages.length === 0) {
            setTimeout(scrollToBottom, 100);
            return messagesData;
          }
          
          // Check if there are new messages by comparing the last message timestamp
          const lastPrevMessage = prevMessages[prevMessages.length - 1];
          const lastNewMessage = messagesData[messagesData.length - 1];
          
          if (!lastNewMessage || lastPrevMessage.timestamp >= lastNewMessage.timestamp) {
            // No new messages, keep existing ones
            return prevMessages;
          }
          
          // Find new messages that aren't in the previous list
          const newMessages = messagesData.filter((newMsg: WhatsAppMessage) => 
            !prevMessages.some((prevMsg: WhatsAppMessage) => prevMsg.id === newMsg.id)
          );
          
          if (newMessages.length > 0) {
            // Scroll to bottom when new messages are added
            setTimeout(scrollToBottom, 100);
            return messagesData; // Use the complete updated list from backend
          }
          
          return prevMessages;
        });
      } else {
        const errorData = await response.json();
        console.error('Failed to update messages:', errorData);
        
        // Check if this is a session disconnected error
        if (errorData.details && errorData.details.includes('WhatsApp session has been disconnected')) {
          console.log('Session disconnected while updating messages, triggering reconnection...');
          handleSessionDisconnected();
          return;
        }
      }
    } catch (error) {
      console.error('Error updating messages:', error);
    }
  };

  const handleChatSelect = async (chat: WhatsAppChat) => {
    setSelectedChat(chat);
    await loadMessages(chat.id);
    
    // Mark chat as read if it has unread messages
    if (chat.unreadCount > 0) {
      try {
        await fetch(`${backendUrl}/api/whatsapp/mark-read`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sessionId,
            chatId: chat.id,
          }),
        });
        
        // Update the chat in the list to remove unread count
        setChats(prevChats => 
          prevChats.map(c => 
            c.id === chat.id ? { ...c, unreadCount: 0 } : c
          )
        );
      } catch (error) {
        console.error('Error marking chat as read:', error);
      }
    }
  };

  const handleSendMessage = async () => {
    if (!selectedChat || !newMessage.trim() || isSending) return;

    setIsSending(true);
    try {
      const response = await fetch(`${backendUrl}/api/whatsapp/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          to: selectedChat.id,
          message: newMessage.trim(),
        }),
      });

      if (response.ok) {
        setNewMessage('');
        // Update messages to show the sent message
        await updateMessages(selectedChat.id);
        // Update chat list to show the new message
        await updateChats();
      } else {
        console.error('Failed to send message');
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleChatListScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    
    // Load more chats when user scrolls near the bottom
    if (scrollHeight - scrollTop <= clientHeight * 1.5 && hasMoreChats && !isLoadingMoreChats) {
      loadChats(false);
    }
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('en-US', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      });
    } else {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const formatMessageTime = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // Generate consistent color for each contact name
  const getContactColor = (authorName: string) => {
    // WhatsApp-style colors for contact names
    const colors = [
      '#00a884', // WhatsApp green
      '#ff6b35', // Orange
      '#f7931e', // Amber
      '#25d366', // Light green
      '#128c7e', // Teal
      '#075e54', // Dark teal
      '#34b7f1', // Blue
      '#7c4dff', // Purple
      '#e91e63', // Pink
      '#ff5722', // Deep orange
      '#795548', // Brown
      '#607d8b', // Blue grey
    ];
    
    // Create a simple hash from the name to ensure consistency
    let hash = 0;
    for (let i = 0; i < authorName.length; i++) {
      const char = authorName.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use absolute value and modulo to get a color index
    const colorIndex = Math.abs(hash) % colors.length;
    return colors[colorIndex];
  };

  // Custom hook for profile picture loading
  const useProfilePicture = (chatId: string) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    const profilePicUrl = profilePictures[chatId];

    useEffect(() => {
      if (profilePictures[chatId] === undefined && !loading) {
        setLoading(true);
        setError(false);
        
        const url = `${backendUrl}/api/whatsapp/profile-picture?sessionId=${sessionId}&chatId=${encodeURIComponent(chatId)}`;
        
        fetch(url)
          .then(response => {
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}`);
            }
            return response.json();
          })
          .then(data => {
            setProfilePictures(prev => ({
              ...prev,
              [chatId]: data.profilePicUrl || ''
            }));
          })
          .catch(err => {
            console.error(`Failed to load profile picture for ${chatId}:`, err);
            setError(true);
            setProfilePictures(prev => ({
              ...prev,
              [chatId]: ''
            }));
          })
          .finally(() => {
            setLoading(false);
          });
      }
    }, [chatId, loading]);

    return { profilePicUrl, loading, error };
  };

  // Profile Picture Component
  const ProfilePicture = ({ chatId, name, size = 'w-12 h-12' }: { chatId: string; name: string; size?: string }) => {
    const { profilePicUrl, loading } = useProfilePicture(chatId);
    const [imageError, setImageError] = useState(false);
    
    const isSmall = size.includes('w-10');
    const textSize = isSmall ? 'text-sm' : 'text-lg';

    return (
      <div className={`${size} bg-[#3b4a54] rounded-full flex items-center justify-center overflow-hidden relative`}>
        {profilePicUrl && profilePicUrl !== '' && !imageError ? (
          <img 
            src={profilePicUrl} 
            alt={name}
            className="w-full h-full object-cover"
            onError={() => {
              setImageError(true);
            }}
          />
        ) : (
          <span className={`${textSize} font-semibold text-white/80`}>
            {name.charAt(0).toUpperCase()}
          </span>
        )}
        {loading && (
          <div className="absolute inset-0 bg-[#3b4a54] bg-opacity-50 flex items-center justify-center">
            <span className="loading loading-spinner loading-xs text-white"></span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-screen bg-base-100 flex">
      {/* Left Sidebar */}
      <div className="w-16 bg-[#202c33] flex flex-col items-center py-4 border-r border-[#2a3942]">
        {/* Chat Icon */}
        <button className="w-10 h-10 bg-[#00a884] hover:bg-[#00a884]/90 rounded-lg flex items-center justify-center mb-4 transition-colors">
          <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h4l4 4 4-4h4c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
        
        {/* Disconnect Button */}
        <button 
          onClick={onDisconnect}
          className="w-10 h-10 bg-[#f15c6d] hover:bg-[#f15c6d]/90 rounded-lg flex items-center justify-center mt-auto transition-colors"
          title="Disconnect"
        >
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M16 17v-3H9v-4h7V7l5 5-5 5M14 2a2 2 0 012 2v2h-2V4H4v16h10v-2h2v2a2 2 0 01-2 2H4a2 2 0 01-2-2V4a2 2 0 012-2h10z"/>
          </svg>
        </button>
      </div>

      {/* Chat List */}
      <div className="w-80 bg-[#111b21] border-r border-[#2a3942] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-[#2a3942]">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Chats</h2>
            <div className="flex items-center gap-2">
              {totalChats > 0 && (
                <span className="text-sm text-white/60">
                  {chats.length} of {totalChats}
                </span>
              )}
              <button
                onClick={() => loadChats(true)}
                disabled={isLoadingChats}
                className="w-8 h-8 bg-[#00a884] hover:bg-[#00a884]/90 disabled:bg-[#3b4a54] disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
                title="Refresh chats"
              >
                {isLoadingChats ? (
                  <span className="loading loading-spinner loading-xs text-white"></span>
                ) : (
                  <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/>
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Chat List */}
        <div className="flex-1 overflow-y-auto" onScroll={handleChatListScroll}>
          {isLoadingChats ? (
            <div className="p-4 text-center">
              <span className="loading loading-spinner loading-md text-white"></span>
              <p className="mt-2 text-sm text-white/60">Loading chats...</p>
            </div>
          ) : chats.length === 0 ? (
            <div className="p-4 text-center">
              <p className="text-white/60">No chats found</p>
            </div>
          ) : (
            <>
              {chats.map((chat) => (
                <div
                  key={chat.id}
                  onClick={() => handleChatSelect(chat)}
                  className={`p-4 border-b border-[#2a3942] cursor-pointer hover:bg-[#2a3942] transition-colors ${
                    selectedChat?.id === chat.id ? 'bg-[#2a3942]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Profile Picture */}
                    <ProfilePicture chatId={chat.id} name={chat.name} />

                    {/* Chat Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold truncate text-white">{chat.name}</h3>
                        {chat.lastMessage && (
                          <span className="text-xs text-white/60">
                            {formatTime(chat.lastMessage.timestamp)}
                          </span>
                        )}
                      </div>
                      {chat.lastMessage && (
                        <p className="text-sm text-white/60 truncate">
                          {chat.lastMessage.fromMe ? 'You: ' : ''}
                          {chat.lastMessage.body}
                        </p>
                      )}
                    </div>

                    {/* Unread Count */}
                    {chat.unreadCount > 0 && (
                      <div className="w-5 h-5 bg-[#00a884] rounded-full flex items-center justify-center">
                        <span className="text-xs text-white font-semibold">
                          {chat.unreadCount > 9 ? '9+' : chat.unreadCount}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Loading more indicator */}
              {isLoadingMoreChats && (
                <div className="p-4 text-center">
                  <span className="loading loading-spinner loading-sm text-white"></span>
                  <p className="mt-2 text-xs text-white/60">Loading more chats...</p>
                </div>
              )}
              
              {/* End of chats indicator */}
              {!hasMoreChats && chats.length > 0 && (
                <div className="p-4 text-center">
                  <p className="text-xs text-white/40">
                    Showing all {totalChats} chats
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {selectedChat ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-[#2a3942] bg-[#202c33]">
              <div className="flex items-center gap-3">
                <ProfilePicture chatId={selectedChat.id} name={selectedChat.name} size="w-10 h-10" />
                <div>
                  <h3 className="font-semibold text-white">{selectedChat.name}</h3>
                  <p className="text-xs text-white/60">
                    {selectedChat.isGroup ? 'Group' : 'Contact'}
                  </p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4" style={{ backgroundColor: '#0b141a', backgroundImage: 'url("data:image/svg+xml,%3Csvg width="100" height="100" xmlns="http://www.w3.org/2000/svg"%3E%3Cdefs%3E%3Cpattern id="a" patternUnits="userSpaceOnUse" width="100" height="100"%3E%3Cpath d="M0 0h100v100H0z" fill="%23182229"/%3E%3Cpath d="M20 20h60v60H20z" fill="%231e2428" opacity="0.1"/%3E%3C/pattern%3E%3C/defs%3E%3Crect width="100%25" height="100%25" fill="url(%23a)"/%3E%3C/svg%3E")' }}>
              {isLoadingMessages ? (
                <div className="text-center py-8">
                  <span className="loading loading-spinner loading-md text-white"></span>
                  <p className="mt-2 text-sm text-white/60">Loading messages...</p>
                </div>
              ) : messages.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-white/60">No messages in this chat</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {messages.map((message, index) => {
                    const prevMessage = index > 0 ? messages[index - 1] : null;
                    const nextMessage = index < messages.length - 1 ? messages[index + 1] : null;
                    
                    // Group logic: same person if fromMe status and author match
                    const isSameAuthorAsPrev = prevMessage && 
                      prevMessage.fromMe === message.fromMe && 
                      (message.fromMe || prevMessage.author === message.author);
                    
                    const isSameAuthorAsNext = nextMessage && 
                      nextMessage.fromMe === message.fromMe && 
                      (message.fromMe || nextMessage.author === message.author);
                    
                    const isFirstInGroup = !isSameAuthorAsPrev;
                    const isLastInGroup = !isSameAuthorAsNext;
                    
                    // Show author name only for the first message in a group
                    const shouldShowAuthor = selectedChat?.isGroup && !message.fromMe && message.authorName && isFirstInGroup;
                    
                    return (
                      <div
                        key={message.id}
                        className={`flex ${message.fromMe ? 'justify-end' : 'justify-start'} ${
                          isFirstInGroup ? 'mt-2' : 'mt-0.5'
                        }`}
                      >
                        <div
                          className={`max-w-xs lg:max-w-md px-3 py-1.5 relative ${
                            message.fromMe
                              ? 'bg-[#005c4b] text-white rounded-lg'
                              : 'bg-[#202c33] text-white rounded-lg'
                          } ${
                            isFirstInGroup && message.fromMe
                              ? 'rounded-tr-sm'
                              : isFirstInGroup && !message.fromMe
                              ? 'rounded-tl-sm'
                              : ''
                          } ${
                            isLastInGroup && message.fromMe
                              ? 'rounded-br-sm'
                              : isLastInGroup && !message.fromMe
                              ? 'rounded-bl-sm'
                              : ''
                          }`}
                        >
                          {/* Author name for group messages - only show on first message in group */}
                          {shouldShowAuthor && (
                            <p 
                              className="text-xs font-semibold mb-1"
                              style={{ color: getContactColor(message.authorName || '') }}
                            >
                              {message.authorName}
                            </p>
                          )}
                          {/* Message content with special handling for different types */}
                          {message.type === 'sticker' ? (
                            message.mediaData ? (
                              <div className="max-w-[200px]">
                                <img 
                                  src={`data:${message.mediaData.mimetype};base64,${message.mediaData.data}`}
                                  alt="Sticker"
                                  className="max-w-full h-auto rounded-lg"
                                  style={{ maxHeight: '200px' }}
                                />
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-2xl">🎭</span>
                                <span className="text-sm italic text-white/80">Sticker</span>
                              </div>
                            )
                          ) : message.type === 'image' ? (
                            message.mediaData ? (
                              <div className="max-w-[300px]">
                                <img 
                                  src={`data:${message.mediaData.mimetype};base64,${message.mediaData.data}`}
                                  alt="Image"
                                  className="max-w-full h-auto rounded-lg"
                                  style={{ maxHeight: '300px' }}
                                />
                                {message.body && (
                                  <p className="text-sm mt-2 leading-relaxed break-words whitespace-pre-wrap">
                                    {message.body}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2">
                                <span className="text-lg">📷</span>
                                <span className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                  {message.body}
                                </span>
                              </div>
                            )
                          ) : message.type === 'video' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎥</span>
                              <span className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                {message.body}
                              </span>
                            </div>
                          ) : message.type === 'audio' || message.type === 'ptt' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">🎵</span>
                              <span className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                {message.body}
                              </span>
                            </div>
                          ) : message.type === 'document' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📄</span>
                              <span className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                {message.body}
                              </span>
                            </div>
                          ) : message.type === 'location' ? (
                            <div className="flex items-center gap-2">
                              <span className="text-lg">📍</span>
                              <span className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                                {message.body}
                              </span>
                            </div>
                          ) : (
                            <p className="text-sm leading-relaxed break-words whitespace-pre-wrap">
                              {message.body}
                            </p>
                          )}
                          <div className="flex items-center justify-end gap-1 mt-1">
                            <span className={`text-xs ${
                              message.fromMe ? 'text-white/70' : 'text-white/60'
                            }`}>
                              {formatMessageTime(message.timestamp)}
                            </span>
                            {message.fromMe && (
                              <svg className="w-4 h-4 text-white/70" fill="currentColor" viewBox="0 0 16 15">
                                <path d="M15.01 3.316l-.478-.372a.365.365 0 0 0-.51.063L8.666 9.879a.32.32 0 0 1-.484.033l-.358-.325a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l1.32 1.266c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.063-.51zm-4.1 0l-.478-.372a.365.365 0 0 0-.51.063L4.566 9.879a.32.32 0 0 1-.484.033L1.891 7.769a.319.319 0 0 0-.484.032l-.378.483a.418.418 0 0 0 .036.541l3.61 3.463c.143.14.361.125.484-.033l6.272-8.048a.366.366 0 0 0-.063-.51z"/>
                              </svg>
                            )}
                          </div>
                          
                          {/* Message tail */}
                          {isLastInGroup && (
                            <div
                              className={`absolute bottom-0 w-3 h-3 ${
                                message.fromMe
                                  ? '-right-1 bg-[#005c4b]'
                                  : '-left-1 bg-[#202c33]'
                              }`}
                              style={{
                                clipPath: message.fromMe
                                  ? 'polygon(0 0, 100% 0, 0 100%)'
                                  : 'polygon(100% 0, 0 0, 100% 100%)'
                              }}
                            />
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {/* Scroll anchor */}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-[#2a3942] bg-[#202c33]">
              <div className="flex items-center gap-3">
                <div className="flex-1 bg-[#2a3942] rounded-lg px-4 py-2 flex items-center">
                  <input
                    type="text"
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Type a message"
                    className="flex-1 bg-transparent text-white placeholder-white/60 outline-none"
                    disabled={isSending}
                  />
                </div>
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || isSending}
                  className="w-10 h-10 bg-[#00a884] hover:bg-[#00a884]/90 disabled:bg-[#3b4a54] disabled:cursor-not-allowed rounded-full flex items-center justify-center transition-colors"
                >
                  {isSending ? (
                    <span className="loading loading-spinner loading-sm text-white"></span>
                  ) : (
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: '#0b141a' }}>
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2 text-white">WhatsApp Web</h3>
              <p className="text-white/60">Select a chat to start messaging</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 