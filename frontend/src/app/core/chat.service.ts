import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { catchError, delay, map } from 'rxjs/operators';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'assistant';
  timestamp: Date;
}

export interface ChatResponse {
  answer: string;
  context?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {
  private messagesSubject = new BehaviorSubject<ChatMessage[]>([]);
  public messages$ = this.messagesSubject.asObservable();

  constructor(private http: HttpClient) {
    // Load saved messages from localStorage
    const saved = localStorage.getItem('carddemo.chat.messages');
    if (saved) {
      try {
        this.messagesSubject.next(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed to load saved messages');
      }
    }
  }

  sendQuery(message: string, contextPage?: string): Observable<ChatResponse> {
    // Add user message immediately
    this.addMessage(message, 'user');

    // Try to call backend API, fallback to mock response
    return this.http.post<ChatResponse>('/api/chat/query', { message, contextPage })
      .pipe(
        catchError(() => {
          // Fallback to mock response
          return of(this.generateMockResponse(message)).pipe(delay(800));
        }),
        map(response => {
          // Add assistant response
          this.addMessage(response.answer, 'assistant');
          return response;
        })
      );
  }

  private generateMockResponse(userMessage: string): ChatResponse {
    const msg = userMessage.toLowerCase();
    
    // Account-related queries
    if (msg.includes('account') || msg.includes('balance') || msg.includes('credit')) {
      return {
        answer: 'I can help you with account information. You can:\n\n' +
                '• View account details and balances\n' +
                '• Check credit limits and cash credit limits\n' +
                '• Review account status and history\n' +
                '• Update account information\n\n' +
                'Use the Account menu options to access these features.'
      };
    }
    
    // Card-related queries
    if (msg.includes('card') || msg.includes('payment')) {
      return {
        answer: 'For card management:\n\n' +
                '• View all cards associated with accounts\n' +
                '• Add new cards to accounts\n' +
                '• Process bill payments with saved cards\n' +
                '• Update card information and status\n\n' +
                'Navigate to the Card menu to manage your cards.'
      };
    }
    
    // Transaction queries
    if (msg.includes('transaction') || msg.includes('purchase') || msg.includes('history')) {
      return {
        answer: 'Transaction features:\n\n' +
                '• View transaction history with filters\n' +
                '• See detailed transaction information\n' +
                '• Add new transactions\n' +
                '• Generate transaction reports\n\n' +
                'Use Transaction Inquiry from the main menu.'
      };
    }
    
    // Authorization queries
    if (msg.includes('authorization') || msg.includes('pending') || msg.includes('fraud')) {
      return {
        answer: 'Authorization management:\n\n' +
                '• View pending authorizations list\n' +
                '• Review authorization details\n' +
                '• Mark suspicious transactions as fraud\n' +
                '• Filter by status (Pending/Matched/Declined/Error)\n\n' +
                'Access this from menu option 11: Pending Authorizations.'
      };
    }
    
    // User management queries (admin)
    if (msg.includes('user') || msg.includes('admin') || msg.includes('permission')) {
      return {
        answer: 'User administration (Admin only):\n\n' +
                '• Create new users\n' +
                '• Update user information\n' +
                '• Delete users\n' +
                '• Assign user types (Admin/Standard)\n\n' +
                'Administrators can access User Maintenance from the admin menu.'
      };
    }
    
    // Report queries
    if (msg.includes('report') || msg.includes('batch') || msg.includes('job')) {
      return {
        answer: 'Batch and reporting:\n\n' +
                '• Submit report requests\n' +
                '• Track batch job status\n' +
                '• View report history\n' +
                '• Monitor job execution\n\n' +
                'Use Report Submission from the main menu.'
      };
    }
    
    // Help queries
    if (msg.includes('help') || msg.includes('how') || msg.includes('what can')) {
      return {
        answer: 'CardDemo Online Help\n\n' +
                'I can assist you with:\n\n' +
                '✅ Account management and inquiries\n' +
                '✅ Card operations and bill payments\n' +
                '✅ Transaction viewing and adding\n' +
                '✅ Authorization tracking and fraud detection\n' +
                '✅ User administration (for admins)\n' +
                '✅ Report generation and batch jobs\n\n' +
                'Just ask me anything about these features!'
      };
    }
    
    // Default response
    return {
      answer: 'I can help you with account management, card operations, transactions, ' +
              'authorizations, user administration, and reports. What would you like to know?'
    };
  }

  private addMessage(text: string, sender: 'user' | 'assistant') {
    const messages = this.messagesSubject.value;
    const newMessage: ChatMessage = {
      id: Date.now().toString(),
      text,
      sender,
      timestamp: new Date()
    };
    const updated = [...messages, newMessage];
    this.messagesSubject.next(updated);
    
    // Save to localStorage
    localStorage.setItem('carddemo.chat.messages', JSON.stringify(updated));
  }

  clearMessages() {
    this.messagesSubject.next([]);
    localStorage.removeItem('carddemo.chat.messages');
  }

  getMessages(): ChatMessage[] {
    return this.messagesSubject.value;
  }
}
