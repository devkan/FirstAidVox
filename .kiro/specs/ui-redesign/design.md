# Design Document

## Overview

FirstAidVox UI 재디자인은 현대적인 채팅 인터페이스를 구현하여 사용자 경험을 크게 개선합니다. 모바일 우선 설계와 Tailwind CSS를 활용하여 반응형이면서도 시각적으로 임팩트 있는 의료 상담 플랫폼을 구축합니다.

## Architecture

### Component Hierarchy
```
App
├── ChatContainer
│   ├── ChatHeader
│   ├── MessageList
│   │   ├── MessageBubble (User)
│   │   ├── MessageBubble (AI)
│   │   ├── MedicalCard
│   │   └── TypingIndicator
│   └── ChatInput
│       ├── TextInput
│       ├── AttachmentButton
│       ├── VoiceButton
│       └── SendButton
├── EmergencyButton (Floating)
└── NotificationToast
```

### Layout Structure
- **Full Height Layout**: 100vh with flex column
- **Fixed Header**: App title and status indicators
- **Scrollable Message Area**: Flex-grow with auto-scroll
- **Fixed Input Area**: Bottom-pinned with proper safe areas
- **Floating Elements**: Emergency button and notifications

## Components and Interfaces

### ChatContainer Component
```typescript
interface ChatContainerProps {
  className?: string;
}

interface ChatState {
  messages: Message[];
  isTyping: boolean;
  scrollToBottom: () => void;
}
```

**Design Features:**
- Full viewport height with proper mobile safe areas
- Gradient background with medical theme colors
- Smooth scrolling with momentum on mobile
- Auto-scroll to latest message with smooth animation

### MessageBubble Component
```typescript
interface MessageBubbleProps {
  message: Message;
  isUser: boolean;
  timestamp: Date;
  className?: string;
}

interface Message {
  id: string;
  content: string;
  type: 'text' | 'medical' | 'image' | 'voice';
  timestamp: Date;
  isUser: boolean;
  metadata?: MessageMetadata;
}
```

**User Message Styling:**
- Right-aligned with blue gradient background
- Rounded corners (more rounded on left side)
- White text with subtle shadow
- Maximum width 80% on mobile, 60% on desktop

**AI Message Styling:**
- Left-aligned with white/gray background
- Subtle border and shadow
- Dark text for readability
- Avatar icon for AI assistant

### MedicalCard Component
```typescript
interface MedicalCardProps {
  assessment: MedicalAssessment;
  urgencyLevel: 'low' | 'moderate' | 'high';
  className?: string;
}
```

**Enhanced Medical Card Design:**
- Special container with medical theme colors
- Urgency-based color coding (green/yellow/red)
- Structured layout with clear sections
- Icons for different types of information
- Expandable sections for detailed advice
- Call-to-action buttons for emergency situations

### ChatInput Component
```typescript
interface ChatInputProps {
  onSendMessage: (message: string, attachments?: File[]) => void;
  onVoiceInput: () => void;
  disabled?: boolean;
  placeholder?: string;
}
```

**Modern Input Design:**
- Rounded container with subtle shadow
- Auto-expanding textarea
- Integrated attachment and voice buttons
- Send button with loading states
- Character count and typing indicators

## Data Models

### Message Model
```typescript
interface Message {
  id: string;
  content: string;
  type: MessageType;
  timestamp: Date;
  isUser: boolean;
  metadata?: {
    confidence?: number;
    urgency?: UrgencyLevel;
    attachments?: Attachment[];
    voiceData?: VoiceMetadata;
  };
}

type MessageType = 'text' | 'medical' | 'image' | 'voice' | 'system';
type UrgencyLevel = 'low' | 'moderate' | 'high' | 'emergency';
```

### Chat State Model
```typescript
interface ChatState {
  messages: Message[];
  isLoading: boolean;
  isTyping: boolean;
  currentInput: string;
  attachments: File[];
  voiceRecording: boolean;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Message Display Order
*For any* sequence of messages sent to the chat interface, the messages should appear in chronological order with the newest message at the bottom
**Validates: Requirements 1.1, 1.5**

### Property 2: Responsive Layout Consistency
*For any* screen size between 320px and 1920px width, all UI elements should remain accessible and properly proportioned
**Validates: Requirements 2.1, 2.2, 2.3**

### Property 3: Message Bubble Alignment
*For any* message in the conversation, user messages should be right-aligned and AI messages should be left-aligned consistently
**Validates: Requirements 1.2, 1.3**

### Property 4: Input Area Accessibility
*For any* device orientation or screen size, the input area should remain fixed at the bottom and fully accessible
**Validates: Requirements 2.4, 2.5**

### Property 5: Medical Card Highlighting
*For any* medical assessment response, the medical card should have distinct visual styling that differentiates it from regular messages
**Validates: Requirements 4.1, 4.2, 4.5**

### Property 6: Animation Smoothness
*For any* message addition or UI interaction, animations should complete within 300ms and not block user interactions
**Validates: Requirements 5.3, 5.4**

### Property 7: Emergency Feature Visibility
*For any* screen configuration, the emergency button should remain visible and accessible without interfering with the chat flow
**Validates: Requirements 6.1, 6.3**

## Error Handling

### Input Validation
- Empty message prevention
- File size and type validation for attachments
- Network connectivity checks before sending
- Graceful degradation for voice features

### UI Error States
- Loading states for message sending
- Error messages for failed operations
- Retry mechanisms for network failures
- Offline mode indicators

### Accessibility Considerations
- Screen reader compatibility
- Keyboard navigation support
- High contrast mode support
- Touch target size compliance

## Testing Strategy

### Visual Regression Testing
- Screenshot comparisons across different screen sizes
- Component rendering tests for various message types
- Theme and color scheme validation

### Interaction Testing
- Touch and click event handling
- Scroll behavior validation
- Input field functionality
- Animation performance testing

### Responsive Design Testing
- Mobile device testing (iOS/Android)
- Desktop browser compatibility
- Tablet and intermediate screen sizes
- Orientation change handling

### Property-Based Testing
- Message ordering properties
- Layout consistency across screen sizes
- Input validation properties
- Animation timing properties

## Implementation Notes

### Tailwind CSS Strategy
- Custom color palette for medical theme
- Responsive utility classes for all breakpoints
- Animation utilities for smooth transitions
- Component-based styling with @apply directives

### Performance Considerations
- Virtual scrolling for long conversations
- Image lazy loading for attachments
- Debounced input handling
- Optimized re-rendering with React.memo

### Mobile Optimization
- Touch-friendly button sizes (44px minimum)
- Safe area handling for notched devices
- Momentum scrolling for smooth experience
- Haptic feedback for important actions

### Accessibility Features
- ARIA labels for all interactive elements
- Focus management for keyboard navigation
- Color contrast compliance (WCAG AA)
- Screen reader announcements for new messages