import { Component, OnInit, OnDestroy, AfterViewChecked, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService, ChatMessage } from '../core/chat.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="assistant-container">
      <div class="assistant-header">
        <h1>🤖 CardDemo AI Assistant</h1>
        <p>Your intelligent guide to account management, transactions, and more</p>
      </div>

      <div class="assistant-content">
        <!-- Chat Messages Area -->
        <div class="chat-section">
          <div class="messages-container" #messagesContainer>
            <!-- Welcome Message -->
            <div class="message assistant-message" *ngIf="messages.length === 0">
              <div class="message-avatar">🤖</div>
              <div class="message-content">
                <div class="message-text">
                  <h3>Welcome to CardDemo AI Assistant!</h3>
                  <p>I'm here to help you with:</p>
                  <ul>
                    <li>Account inquiries and management</li>
                    <li>Card operations and bill payments</li>
                    <li>Transaction history and details</li>
                    <li>Authorization tracking and fraud detection</li>
                    <li>User administration (for admins)</li>
                    <li>Report generation and batch jobs</li>
                  </ul>
                  <p>Ask me anything or try one of the suggestions below!</p>
                </div>
              </div>
            </div>

            <!-- Chat Messages -->
            <div *ngFor="let msg of messages" 
                 class="message"
                 [class.user-message]="msg.sender === 'user'"
                 [class.assistant-message]="msg.sender === 'assistant'">
              <div class="message-avatar">{{ msg.sender === 'user' ? '👤' : '🤖' }}</div>
              <div class="message-content">
                <div class="message-text">{{ msg.text }}</div>
                <div class="message-time">{{ formatTime(msg.timestamp) }}</div>
              </div>
            </div>

            <!-- Loading Indicator -->
            <div class="message assistant-message" *ngIf="isLoading">
              <div class="message-avatar">🤖</div>
              <div class="message-content">
                <div class="message-text">
                  <div class="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Suggestion Chips (only when no messages) -->
          <div class="suggestions" *ngIf="messages.length === 0 && !isLoading">
            <button class="suggestion-chip" (click)="sendSuggestion('How do I view my account balance?')">
              💰 View Balance
            </button>
            <button class="suggestion-chip" (click)="sendSuggestion('Show me pending authorizations')">
              🔍 Pending Auth
            </button>
            <button class="suggestion-chip" (click)="sendSuggestion('How do I process a bill payment?')">
              💳 Bill Payment
            </button>
            <button class="suggestion-chip" (click)="sendSuggestion('What reports can I generate?')">
              📊 Reports
            </button>
          </div>

          <!-- Input Area -->
          <div class="input-section">
            <div class="input-container">
              <textarea
                [(ngModel)]="userInput"
                (keydown)="onEnterKey($event)"
                placeholder="Ask me anything about CardDemo..."
                rows="2"
                [disabled]="isLoading"
              ></textarea>
              <button 
                class="send-button" 
                (click)="sendMessage()"
                [disabled]="!userInput.trim() || isLoading"
                title="Send message">
                {{ isLoading ? '⏳' : '📤' }}
              </button>
              <button 
                class="clear-button" 
                (click)="clearChat()"
                [disabled]="messages.length === 0"
                title="Clear conversation">
                🗑️
              </button>
            </div>
          </div>
        </div>

        <!-- Info Panel -->
        <div class="info-panel">
          <h3>💡 Quick Tips</h3>
          <div class="tip-card">
            <h4>🎯 Example Questions</h4>
            <ul>
              <li>"How do I view account details?"</li>
              <li>"What transactions are pending?"</li>
              <li>"Show me how to add a card"</li>
              <li>"Explain authorization statuses"</li>
              <li>"How do I generate reports?"</li>
            </ul>
          </div>

          <div class="tip-card">
            <h4>⚙️ Features</h4>
            <ul>
              <li>✅ Context-aware responses</li>
              <li>✅ Real-time assistance</li>
              <li>✅ Navigation guidance</li>
              <li>✅ Best practice tips</li>
            </ul>
          </div>

          <div class="tip-card">
            <h4>🔒 Security Note</h4>
            <p>This assistant provides guidance only. For sensitive operations, always use the official menu options.</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .assistant-container {
      min-height: calc(100vh - 60px);
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      padding: 2rem;
    }

    .assistant-header {
      text-align: center;
      color: white;
      margin-bottom: 2rem;
    }

    .assistant-header h1 {
      font-size: 2.5rem;
      margin-bottom: 0.5rem;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .assistant-header p {
      font-size: 1.1rem;
      opacity: 0.9;
    }

    .assistant-content {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 1.5rem;
      max-width: 1400px;
      margin: 0 auto;
    }

    .chat-section {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
      display: flex;
      flex-direction: column;
      height: calc(100vh - 220px);
    }

    .messages-container {
      flex: 1;
      overflow-y: auto;
      padding: 1.5rem;
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .message {
      display: flex;
      gap: 0.75rem;
      animation: slideIn 0.3s ease-out;
    }

    @keyframes slideIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message-avatar {
      font-size: 2rem;
      width: 48px;
      height: 48px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .message-content {
      flex: 1;
      min-width: 0;
    }

    .message-text {
      background: #f0f0f0;
      padding: 1rem;
      border-radius: 12px;
      white-space: pre-wrap;
      word-wrap: break-word;
    }

    .user-message .message-text {
      background: #667eea;
      color: white;
    }

    .assistant-message .message-text {
      background: #f8f9fa;
    }

    .assistant-message .message-text h3 {
      margin-top: 0;
      color: #667eea;
    }

    .assistant-message .message-text ul {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }

    .message-time {
      font-size: 0.75rem;
      color: #666;
      margin-top: 0.25rem;
      padding-left: 1rem;
    }

    .typing-indicator {
      display: flex;
      gap: 4px;
      padding: 0.5rem 0;
    }

    .typing-indicator span {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #667eea;
      animation: typing 1.4s infinite;
    }

    .typing-indicator span:nth-child(2) {
      animation-delay: 0.2s;
    }

    .typing-indicator span:nth-child(3) {
      animation-delay: 0.4s;
    }

    @keyframes typing {
      0%, 60%, 100% {
        transform: translateY(0);
        opacity: 0.7;
      }
      30% {
        transform: translateY(-10px);
        opacity: 1;
      }
    }

    .suggestions {
      padding: 0 1.5rem 1rem;
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
    }

    .suggestion-chip {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      cursor: pointer;
      font-size: 0.9rem;
      transition: all 0.2s;
    }

    .suggestion-chip:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
    }

    .input-section {
      border-top: 1px solid #e0e0e0;
      padding: 1rem 1.5rem;
    }

    .input-container {
      display: flex;
      gap: 0.75rem;
      align-items: flex-end;
    }

    textarea {
      flex: 1;
      padding: 0.75rem;
      border: 2px solid #e0e0e0;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      resize: none;
      transition: border-color 0.2s;
    }

    textarea:focus {
      outline: none;
      border-color: #667eea;
    }

    textarea:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }

    .send-button, .clear-button {
      background: linear-gradient(135deg, #667eea, #764ba2);
      color: white;
      border: none;
      padding: 0.75rem 1.25rem;
      border-radius: 8px;
      cursor: pointer;
      font-size: 1.2rem;
      transition: all 0.2s;
      height: 44px;
    }

    .clear-button {
      background: #dc3545;
    }

    .send-button:hover:not(:disabled), .clear-button:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
    }

    .send-button:disabled, .clear-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
      transform: none;
    }

    .info-panel {
      display: flex;
      flex-direction: column;
      gap: 1rem;
    }

    .info-panel h3 {
      color: white;
      font-size: 1.5rem;
      margin: 0;
      text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
    }

    .tip-card {
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(10px);
      padding: 1.25rem;
      border-radius: 12px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    }

    .tip-card h4 {
      margin-top: 0;
      color: #667eea;
      font-size: 1.1rem;
    }

    .tip-card ul {
      margin: 0.5rem 0;
      padding-left: 1.5rem;
    }

    .tip-card li {
      margin: 0.5rem 0;
      color: #333;
    }

    .tip-card p {
      margin: 0.5rem 0;
      color: #666;
      font-size: 0.9rem;
    }

    @media (max-width: 1024px) {
      .assistant-content {
        grid-template-columns: 1fr;
      }

      .info-panel {
        display: none;
      }
    }

    @media (max-width: 768px) {
      .assistant-container {
        padding: 1rem;
      }

      .assistant-header h1 {
        font-size: 1.8rem;
      }

      .chat-section {
        height: calc(100vh - 180px);
      }

      .suggestion-chip {
        font-size: 0.8rem;
        padding: 0.4rem 0.8rem;
      }
    }
  `]
})
export class AssistantPageComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesContainer') private messagesContainer!: ElementRef;

  messages: ChatMessage[] = [];
  userInput: string = '';
  isLoading: boolean = false;
  private subscription?: Subscription;
  private shouldScrollToBottom = false;

  constructor(private chatService: ChatService) {}

  ngOnInit() {
    this.subscription = this.chatService.messages$.subscribe(messages => {
      this.messages = messages;
      this.shouldScrollToBottom = true;
    });
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  sendMessage() {
    if (!this.userInput.trim() || this.isLoading) return;

    const message = this.userInput.trim();
    this.userInput = '';
    this.isLoading = true;

    this.chatService.sendQuery(message).subscribe({
      next: () => {
        this.isLoading = false;
      },
      error: (err) => {
        console.error('Chat error:', err);
        this.isLoading = false;
      }
    });
  }

  sendSuggestion(suggestion: string) {
    this.userInput = suggestion;
    this.sendMessage();
  }

  clearChat() {
    if (confirm('Clear all messages?')) {
      this.chatService.clearMessages();
    }
  }

  onEnterKey(event: Event) {
    const keyboardEvent = event as KeyboardEvent;
    if (keyboardEvent.key === 'Enter' && !keyboardEvent.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  formatTime(date: Date): string {
    return new Date(date).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  private scrollToBottom() {
    try {
      if (this.messagesContainer) {
        const container = this.messagesContainer.nativeElement;
        container.scrollTop = container.scrollHeight;
      }
    } catch (err) {
      console.error('Scroll error:', err);
    }
  }
}
