import React from 'react';
import { marked } from 'marked';
import type { MessageBubbleProps } from './types';

export const MessageBubble = React.memo(function MessageBubble({ message, className = '' }: MessageBubbleProps) {
  const isUser = message.isUser;
  const timestamp = message.timestamp;

  // Helper function to extract text content from message
  const getTextContent = (content: any): string => {
    if (typeof content === 'string') {
      return content;
    } else if (content && typeof content === 'object') {
      return content.message || content.text || content.content || '';
    }
    return String(content || '');
  };

  // Configure marked for safe HTML rendering
  marked.setOptions({
    breaks: true,
    gfm: true,
  });

  // Convert markdown to HTML safely
  const renderMarkdown = (content: any) => {
    try {
      // Ensure content is a string
      let textContent: string;
      if (typeof content === 'string') {
        textContent = content;
      } else if (content && typeof content === 'object') {
        // Handle ElevenLabs message objects
        textContent = content.message || content.text || content.content || JSON.stringify(content);
      } else {
        textContent = String(content || '');
      }
      
      const html = marked(textContent);
      return { __html: html };
    } catch (error) {
      console.error('Markdown parsing error:', error);
      // Fallback: return the content as-is
      const fallbackContent = typeof content === 'string' ? content : 
                             (content?.message || content?.text || content?.content || String(content || ''));
      return { __html: fallbackContent };
    }
  };

  // Format timestamp
  const formatTime = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    }).format(date);
  };

  // Get message bubble styling based on sender
  const getBubbleClasses = () => {
    if (isUser) {
      // User messages - much wider to keep text on single line
      const userClasses = "max-w-[98%] rounded-2xl px-5 py-4 sm:px-6 sm:py-5 shadow-message message-bubble-user text-white rounded-br-md whitespace-nowrap overflow-hidden text-ellipsis";
      return userClasses;
    } else {
      // AI messages - same width as before
      const aiClasses = "max-w-[90%] xs:max-w-[85%] sm:max-w-[80%] md:max-w-[75%] lg:max-w-[70%] rounded-2xl px-5 py-4 sm:px-6 sm:py-5 shadow-message message-bubble-ai text-gray-800 rounded-bl-md";
      return aiClasses;
    }
  };

  // Get container alignment classes
  const getContainerClasses = () => {
    return `flex ${isUser ? 'justify-end' : 'justify-start'} mb-3 sm:mb-4`;
  };

  // Handle different message types
  const renderMessageContent = () => {
    switch (message.type) {
      case 'image':
        return (
          <div className="space-y-3">
            {message.metadata?.attachments?.[0] && (
              <img 
                src={message.metadata.attachments[0].url} 
                alt="Shared image"
                className="rounded-lg max-w-full h-auto max-h-80 sm:max-h-96"
              />
            )}
            {message.content && (
              <p className="text-base sm:text-lg leading-relaxed">{getTextContent(message.content)}</p>
            )}
          </div>
        );
      
      case 'voice':
        return (
          <div className="space-y-3">
            <div className="flex items-center space-x-2 sm:space-x-3">
              <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/>
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              </svg>
              <span className="text-base sm:text-lg font-medium">Voice message</span>
              {message.metadata?.voiceData?.duration && (
                <span className="text-base opacity-75">
                  {Math.round(message.metadata.voiceData.duration)}s
                </span>
              )}
            </div>
            {message.content && (
              <p className="text-base sm:text-lg italic">"{getTextContent(message.content)}"</p>
            )}
          </div>
        );
      
      case 'system':
        return (
          <div className="flex items-center space-x-2 sm:space-x-3 text-base sm:text-lg text-gray-600">
            <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
            </svg>
            <span>{getTextContent(message.content)}</span>
          </div>
        );
      
      default:
        // Parse BRIEF and DETAILED sections for conversational responses
        const textContent = getTextContent(message.content);
        const hasBriefDetailed = textContent.includes('BRIEF:') && textContent.includes('DETAILED:');
        
        if (hasBriefDetailed && !isUser) {
          const parts = textContent.split('DETAILED:');
          const briefPart = parts[0].replace('BRIEF:', '').trim();
          const detailedPart = parts[1].trim();
          
          return (
            <div className="space-y-4">
              {/* Main response (BRIEF part) */}
              <div 
                className="text-base sm:text-lg md:text-xl leading-relaxed prose prose-base sm:prose-lg max-w-none 
                           prose-headings:text-current prose-headings:font-semibold prose-headings:mb-3
                           prose-p:text-current prose-p:my-3 prose-p:leading-relaxed
                           prose-strong:text-current prose-strong:font-semibold
                           prose-em:text-current prose-em:italic
                           prose-ul:text-current prose-ul:my-4 prose-ul:pl-6
                           prose-ol:text-current prose-ol:my-4 prose-ol:pl-6
                           prose-li:text-current prose-li:my-2 prose-li:leading-relaxed
                           prose-code:text-current prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded
                           [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                dangerouslySetInnerHTML={renderMarkdown(briefPart)}
              />
              
              {/* Additional information (DETAILED part) */}
              <div className="border-t border-gray-200 pt-3 mt-4">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-4 h-4 text-blue-500" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                  <span className="text-sm font-medium text-blue-600">Additional Information</span>
                </div>
                <div 
                  className="text-sm sm:text-base leading-relaxed text-gray-600 bg-blue-50 p-3 rounded-lg
                             prose prose-sm sm:prose-base max-w-none 
                             prose-headings:text-gray-700 prose-headings:font-medium prose-headings:mb-2
                             prose-p:text-gray-600 prose-p:my-2 prose-p:leading-relaxed
                             prose-strong:text-gray-700 prose-strong:font-medium
                             prose-em:text-gray-600 prose-em:italic
                             prose-ul:text-gray-600 prose-ul:my-3 prose-ul:pl-4
                             prose-ol:text-gray-600 prose-ol:my-3 prose-ol:pl-4
                             prose-li:text-gray-600 prose-li:my-1 prose-li:leading-relaxed
                             [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                  dangerouslySetInnerHTML={renderMarkdown(detailedPart)}
                />
              </div>
              
              {/* Hospital and Pharmacy data if available */}
              {message.metadata?.hospitalData && message.metadata.hospitalData.length > 0 && (
                <div className="border-t border-gray-200 pt-3 mt-4">
                  {/* Hospitals Section */}
                  {(() => {
                    const hospitals = message.metadata.hospitalData.filter((p: any) => p.place_type === 'hospital' || !p.place_type);
                    const pharmacies = message.metadata.hospitalData.filter((p: any) => p.place_type === 'pharmacy');
                    
                    return (
                      <>
                        {/* Nearby Hospitals */}
                        {hospitals.length > 0 && (
                          <div className="mb-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <svg className="w-4 h-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 8h-2v3h-3v2h3v3h2v-3h3v-2h-3V8zM4 6H2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2v-2H4V6zm0-2h14c1.1 0 2 .9 2 2H2c0-1.1.9-2 2-2z"/>
                              </svg>
                              <span className="text-sm font-medium text-red-600">Nearby Hospitals</span>
                            </div>
                            <div className="space-y-2">
                              {hospitals.slice(0, 2).map((hospital: any, index: number) => {
                                const googleMapsUrl = hospital.latitude && hospital.longitude
                                  ? `https://www.google.com/maps/search/?api=1&query=${hospital.latitude},${hospital.longitude}`
                                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(hospital.name + ' ' + (hospital.address || ''))}`;
                                
                                return (
                                  <a 
                                    key={`hospital-${index}`} 
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block bg-red-50 p-3 rounded-lg hover:bg-red-100 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium text-red-800 flex items-center">
                                          🏥 {hospital.name}
                                          <span className="ml-2 text-xs text-red-500 font-normal">
                                            ({hospital.distance_km || hospital.distance}km)
                                          </span>
                                          <svg className="w-3 h-3 ml-1 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </div>
                                        <div className="text-sm text-red-600">{hospital.address}</div>
                                      </div>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                        
                        {/* Nearby Pharmacies */}
                        {pharmacies.length > 0 && (
                          <div>
                            <div className="flex items-center space-x-2 mb-3">
                              <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14h-2v-4H6v-2h4V7h2v4h4v2h-4v4z"/>
                              </svg>
                              <span className="text-sm font-medium text-green-600">Nearby Pharmacies</span>
                            </div>
                            <div className="space-y-2">
                              {pharmacies.slice(0, 2).map((pharmacy: any, index: number) => {
                                const googleMapsUrl = pharmacy.latitude && pharmacy.longitude
                                  ? `https://www.google.com/maps/search/?api=1&query=${pharmacy.latitude},${pharmacy.longitude}`
                                  : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(pharmacy.name + ' ' + (pharmacy.address || ''))}`;
                                
                                return (
                                  <a 
                                    key={`pharmacy-${index}`} 
                                    href={googleMapsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="block bg-green-50 p-3 rounded-lg hover:bg-green-100 transition-colors cursor-pointer"
                                  >
                                    <div className="flex items-center justify-between">
                                      <div className="flex-1">
                                        <div className="font-medium text-green-800 flex items-center">
                                          💊 {pharmacy.name}
                                          <span className="ml-2 text-xs text-green-500 font-normal">
                                            ({pharmacy.distance_km || pharmacy.distance}km)
                                          </span>
                                          <svg className="w-3 h-3 ml-1 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                          </svg>
                                        </div>
                                        <div className="text-sm text-green-600">{pharmacy.address}</div>
                                      </div>
                                    </div>
                                  </a>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  <p className="text-xs text-gray-500 mt-3">Click to open in Google Maps</p>
                </div>
              )}
            </div>
          );
        }
        
        // Regular message without BRIEF/DETAILED structure
        return (
          <div 
            className="text-base sm:text-lg md:text-xl leading-relaxed prose prose-base sm:prose-lg max-w-none 
                       prose-headings:text-current prose-headings:font-semibold prose-headings:mb-3
                       prose-p:text-current prose-p:my-3 prose-p:leading-relaxed
                       prose-strong:text-current prose-strong:font-semibold
                       prose-em:text-current prose-em:italic
                       prose-ul:text-current prose-ul:my-4 prose-ul:pl-6
                       prose-ol:text-current prose-ol:my-4 prose-ol:pl-6
                       prose-li:text-current prose-li:my-2 prose-li:leading-relaxed
                       prose-code:text-current prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded
                       [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            dangerouslySetInnerHTML={renderMarkdown(message.content)}
          />
        );
    }
  };

  return (
    <div className={`${getContainerClasses()} ${className}`}>
      <div className="flex flex-col">
        <div className={getBubbleClasses()}>
          {renderMessageContent()}
          
          {/* Confidence indicator for AI messages */}
          {!isUser && message.metadata?.confidence && (
            <div className="mt-3 sm:mt-4 flex items-center space-x-2 text-base opacity-75">
              <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
              </svg>
              <span className="text-base">{Math.round((message.metadata.confidence || 0) * 100)}% confident</span>
            </div>
          )}
        </div>
        
        {/* Timestamp */}
        <div className={`text-base text-gray-500 mt-3 px-2 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatTime(timestamp)}
        </div>
      </div>
    </div>
  );
});