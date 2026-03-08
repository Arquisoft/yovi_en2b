import { useState, useRef, useEffect } from 'react'
import type { ChatMessage } from '@/types'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Send, MessageCircle, ChevronUp, ChevronDown } from 'lucide-react'
import { cn } from '@/utils'

interface ChatPanelProps {
  messages: ChatMessage[]
  currentUserId: string
  onSendMessage: (content: string) => void
  isCollapsible?: boolean
}

export function ChatPanel({
  messages,
  currentUserId,
  onSendMessage,
  isCollapsible = false,
}: ChatPanelProps) {
  const [input, setInput] = useState('')
  const [isCollapsed, setIsCollapsed] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (!isCollapsed) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isCollapsed])
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = input.trim()
    if (trimmed) {
      onSendMessage(trimmed)
      setInput('')
    }
  }
  
  if (isCollapsible && isCollapsed) {
    return (
      <button
        onClick={() => setIsCollapsed(false)}
        className="flex items-center justify-center gap-2 p-3 rounded-lg border border-border bg-card hover:bg-accent transition-colors w-full"
      >
        <MessageCircle className="w-4 h-4" />
        <span className="text-sm font-medium">Chat</span>
        <ChevronUp className="w-4 h-4" />
        {messages.length > 0 && (
          <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
            {messages.length}
          </span>
        )}
      </button>
    )
  }
  
  return (
    <div className="flex flex-col border border-border rounded-lg bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageCircle className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Chat</span>
        </div>
        {isCollapsible && (
          <button
            onClick={() => setIsCollapsed(true)}
            className="p-1 hover:bg-accent rounded"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        )}
      </div>
      
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 max-h-48 min-h-[120px]">
        {messages.length === 0 ? (
          <p className="text-center text-sm text-muted-foreground py-4">
            No messages yet
          </p>
        ) : (
          messages.map((message) => {
            const isOwn = message.senderId === currentUserId
            const isSystem = message.senderId === 'system'
            
            return (
              <div
                key={message.id}
                className={cn(
                  'text-sm',
                  isSystem && 'text-center text-muted-foreground italic',
                  !isSystem && isOwn && 'text-right',
                  !isSystem && !isOwn && 'text-left'
                )}
              >
                {!isSystem && (
                  <span className="text-xs text-muted-foreground block mb-0.5">
                    {isOwn ? 'You' : message.senderName}
                  </span>
                )}
                <span
                  className={cn(
                    'inline-block px-3 py-1.5 rounded-lg',
                    isSystem && 'bg-muted/50',
                    !isSystem && isOwn && 'bg-primary text-primary-foreground',
                    !isSystem && !isOwn && 'bg-muted'
                  )}
                >
                  {message.content}
                </span>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* Input */}
      <form onSubmit={handleSubmit} className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            className="flex-1"
          />
          <Button type="submit" size="icon" disabled={!input.trim()}>
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </form>
    </div>
  )
}
